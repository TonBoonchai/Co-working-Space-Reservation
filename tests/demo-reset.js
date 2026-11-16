// Reset the data of the Extra Requirements Demo collection, directly in
// MongoDB. After the reset, the collection can register its users and create
// its space again with plain requests.
//
// Usage: `npm run demo:reset`. The server does not have to run.
//
// The script deletes:
// - the users with the demo emails, and their reservations, reviews and
//   waitlist entries
// - the spaces whose name starts with DEMO_SPACE_NAME, and their reservations,
//   closures, reviews and waitlist entries
//
// The demo emails come from DEMO_ADMIN_EMAIL, DEMO_ALICE_EMAIL and
// DEMO_BOB_EMAIL in config/config.env. They must be the same as the collection
// variables adminEmail, aliceEmail and bobEmail.

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("../models/User");
const CoworkingSpace = require("../models/CoworkingSpace");
const Reservation = require("../models/Reservation");
const Closure = require("../models/Closure");
const Review = require("../models/Review");
const WaitlistEntry = require("../models/WaitlistEntry");

// Must be the same as the space name in the collection. The prefix match also
// deletes the "Demo Co-Work Hub #<runId>" spaces of older collection versions.
const DEMO_SPACE_NAME = "Demo Co-Work Hub";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const main = async () => {
  dotenv.config({ path: path.join(__dirname, "../config/config.env"), quiet: true });

  const emails = [
    process.env.DEMO_ADMIN_EMAIL || "demo-admin@coworking.test",
    process.env.DEMO_ALICE_EMAIL || "demo-alice@coworking.test",
    process.env.DEMO_BOB_EMAIL || "demo-bob@coworking.test",
  ].map((e) => e.trim());

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const users = await User.find({ email: { $in: emails } }).select("_id");
    const userIds = users.map((u) => u._id);
    const spaces = await CoworkingSpace.find({
      name: { $regex: "^" + escapeRegex(DEMO_SPACE_NAME) },
    }).select("_id");
    const spaceIds = spaces.map((s) => s._id);

    const byUserOrSpace = {
      $or: [{ user: { $in: userIds } }, { coworkingSpace: { $in: spaceIds } }],
    };
    const removed = {
      users: 0,
      spaces: 0,
      reservations: (await Reservation.deleteMany(byUserOrSpace)).deletedCount,
      closures: (await Closure.deleteMany({ coworkingSpace: { $in: spaceIds } }))
        .deletedCount,
      reviews: (await Review.deleteMany(byUserOrSpace)).deletedCount,
      waitlistEntries: (await WaitlistEntry.deleteMany(byUserOrSpace))
        .deletedCount,
    };
    removed.spaces = (
      await CoworkingSpace.deleteMany({ _id: { $in: spaceIds } })
    ).deletedCount;
    removed.users = (await User.deleteMany({ _id: { $in: userIds } }))
      .deletedCount;

    console.log(`Demo emails: ${emails.join(", ")}`);
    console.log(
      `Demo reset: removed ${removed.users} users, ${removed.spaces} spaces, ` +
        `${removed.reservations} reservations, ${removed.closures} closures, ` +
        `${removed.reviews} reviews, ${removed.waitlistEntries} waitlist entries`,
    );
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
