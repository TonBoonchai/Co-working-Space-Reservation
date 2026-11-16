// Reset the data of the Extra Requirements Demo collection, directly in
// MongoDB. After the reset, the collection can register its users and create
// its space again with plain requests.
//
// Usage: `npm run demo:reset`. The server does not have to run.
//
// The script deletes:
// - the users named in DEMO_USER_NAMES, and their reservations, reviews and
//   waitlist entries
// - the spaces whose name starts with DEMO_SPACE_NAME, and their reservations,
//   closures, reviews and waitlist entries
//
// The script finds the demo users by name, not by email. Thus the emails stay
// only in the collection variables adminEmail, aliceEmail and bobEmail.

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

// Must be the same as the user names in the "0. Setup" register requests
const DEMO_USER_NAMES = ["Demo Admin", "Demo Alice", "Demo Bob"];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const main = async () => {
  dotenv.config({ path: path.join(__dirname, "../config/config.env"), quiet: true });

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const users = await User.find({ name: { $in: DEMO_USER_NAMES } }).select(
      "email",
    );
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

    if (users.length) {
      console.log(`Demo users: ${users.map((u) => u.email).join(", ")}`);
    }
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
