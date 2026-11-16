// Delete the data that one test run created, directly in MongoDB.
// The API has no route that deletes a user, so the tests cannot do this
// through HTTP. Run this even when the test fails.

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("../models/User");
const CoworkingSpace = require("../models/CoworkingSpace");
const Reservation = require("../models/Reservation");
const Closure = require("../models/Closure");

// Only accounts on this test domain can be deleted
const TEST_EMAIL = /@coworking\.test$/;

exports.removeTestData = async ({ emails = [], spaceIds = [] }) => {
  const testEmails = emails.filter((e) => e && TEST_EMAIL.test(e));
  const ids = spaceIds.filter((id) => mongoose.isValidObjectId(id));

  dotenv.config({ path: path.join(__dirname, "../config/config.env"), quiet: true });
  await mongoose.connect(process.env.MONGO_URI);

  try {
    const users = await User.find({ email: { $in: testEmails } }).select("_id");
    const userIds = users.map((u) => u._id);

    const removed = {
      reservations: (
        await Reservation.deleteMany({
          $or: [{ user: { $in: userIds } }, { coworkingSpace: { $in: ids } }],
        })
      ).deletedCount,
      closures: (await Closure.deleteMany({ coworkingSpace: { $in: ids } }))
        .deletedCount,
      spaces: (await CoworkingSpace.deleteMany({ _id: { $in: ids } }))
        .deletedCount,
      users: (await User.deleteMany({ _id: { $in: userIds } })).deletedCount,
    };

    console.log(
      `Teardown: removed ${removed.users} users, ${removed.spaces} spaces, ` +
        `${removed.reservations} reservations, ${removed.closures} closures`,
    );
    return removed;
  } finally {
    await mongoose.disconnect();
  }
};
