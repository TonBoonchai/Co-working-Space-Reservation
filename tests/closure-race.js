// Race test: a reservation and a closure for the same space and time, sent at
// the same moment, must never both succeed.
//
// Usage: start the server, then run `npm run test:race`.
// The script makes its own admin and space. It deletes both at the end, also
// when the test fails (see tests/teardown.js).
// Exit code 0 = pass, 1 = an overlap was created or a request failed.

const { removeTestData } = require("./teardown");

const BASE = (process.env.URL || "http://localhost:5050") + "/api/v1";
const ROUNDS = 20;

const call = async (method, path, token, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

// "YYYY-MM-DD" in Bangkok time, n days from now
const bkkDay = (n) =>
  new Date(Date.now() + 7 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

const runRounds = async (email, created) => {
  const runId = Date.now().toString().slice(-6);

  const admin = await call("POST", "/auth/register", null, {
    name: "Race Admin",
    tel: "02-218-6000",
    email,
    password: "race1234",
    role: "admin",
  });
  if (admin.status !== 201) throw new Error(`register: ${admin.status}`);
  const token = admin.json.token;

  const space = await call("POST", "/coworkingspaces", token, {
    name: `Race Space #${runId}`,
    address: "1 Test Rd, Bangkok 10330",
    tel: "02-123-4567",
    openTime: "08:00",
    closeTime: "20:00",
  });
  if (space.status !== 201) throw new Error(`create space: ${space.status}`);
  const spaceId = space.json.data._id;
  created.spaceIds.push(spaceId);

  const failures = [];

  // One pair per round, each round on its own day. All pairs start together.
  const rounds = Array.from({ length: ROUNDS }, async (_, i) => {
    const day = bkkDay(30 + i);
    const [resv, closure] = await Promise.all([
      call("POST", `/coworkingspaces/${spaceId}/reservations`, token, {
        startTime: `${day}T10:00:00+07:00`,
        endTime: `${day}T11:00:00+07:00`,
      }),
      call("POST", `/coworkingspaces/${spaceId}/closures`, token, {
        startTime: `${day}T09:00:00+07:00`,
        endTime: `${day}T12:00:00+07:00`,
        reason: "Race test",
      }),
    ]);

    const statuses = [resv.status, closure.status].sort().join("/");
    // Exactly one request may win. The other must get the overlap error.
    if (statuses !== "201/400") {
      failures.push(
        `${day}: reservation ${resv.status} ${resv.json.message ?? ""}, ` +
          `closure ${closure.status} ${closure.json.message ?? ""}`,
      );
    }
  });

  await Promise.all(rounds);

  return failures;
};

const main = async () => {
  const email = `race${Date.now()}@coworking.test`;
  const created = { emails: [email], spaceIds: [] };
  let exitCode = 0;

  try {
    const failures = await runRounds(email, created);

    if (failures.length > 0) {
      console.error(
        `FAIL: ${failures.length} of ${ROUNDS} rounds did not give exactly one 201 and one 400:`,
      );
      failures.forEach((f) => console.error("  " + f));
      exitCode = 1;
    } else {
      console.log(
        `PASS: ${ROUNDS} of ${ROUNDS} rounds gave exactly one 201 and one 400`,
      );
    }
  } catch (err) {
    console.error("ERROR:", err.message);
    exitCode = 1;
  } finally {
    try {
      await removeTestData(created);
    } catch (err) {
      console.error("TEARDOWN ERROR:", err.message);
      exitCode = 1;
    }
  }

  process.exit(exitCode);
};

main();
