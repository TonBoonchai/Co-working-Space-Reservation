// Run the Postman collection with Newman, then delete the data of this run.
//
// The collection deletes its spaces in "99 Cleanup", but it cannot delete its
// admin and user, because the API has no route for that. This script reads the
// emails and space ids from the environment that Newman exports, and deletes
// them in MongoDB (see tests/teardown.js). It does this also when the run fails.
//
// Usage: npm run test:api [-- extra newman options]

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { removeTestData } = require("./teardown");

const root = path.join(__dirname, "..");
const exported = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "newman-")),
  "environment.json",
);

const run = spawnSync(
  "newman",
  [
    "run",
    path.join(root, "postman/Coworking-Space-Reservation.postman_collection.json"),
    "-e",
    path.join(root, "postman/Coworking-Space-Reservation.postman_environment.json"),
    "--export-environment",
    exported,
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);

const main = async () => {
  let exitCode = run.error ? 1 : run.status ?? 1;
  if (run.error) console.error("Cannot start newman:", run.error.message);

  if (!fs.existsSync(exported)) {
    console.error("Teardown skipped: newman did not export the environment");
    process.exit(1);
  }

  const values = Object.fromEntries(
    JSON.parse(fs.readFileSync(exported, "utf8")).values.map((v) => [
      v.key,
      v.value,
    ]),
  );

  try {
    await removeTestData({
      emails: [values.adminEmail, values.userEmail],
      // extraSpaceIds: spaces that a request made by mistake (see folder 14)
      spaceIds: [
        values.spaceAId,
        values.spaceBId,
        ...JSON.parse(values.extraSpaceIds || "[]"),
      ],
    });
  } catch (err) {
    console.error("TEARDOWN ERROR:", err.message);
    exitCode = 1;
  } finally {
    fs.rmSync(path.dirname(exported), { recursive: true, force: true });
  }

  process.exit(exitCode);
};

main();
