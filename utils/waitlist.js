const CoworkingSpace = require("../models/CoworkingSpace");
const Reservation = require("../models/Reservation");
const WaitlistEntry = require("../models/WaitlistEntry");
const { findCapacityConflict } = require("./capacity");
const { findClosureConflict } = require("./closureConflict");
const { isAtReservationLimit } = require("./reservationLimit");

// Turn waitlist entries of one space into reservations, in waitlist order.
// An entry gets a reservation when all of these are true:
//   - it starts in the future
//   - its user can hold one more reservation
//   - no closure overlaps it
//   - the space is not full at any time during it
// An entry that cannot get a reservation stays, and the next entry gets a
// chance. Returns the new reservations, each with its user and its space.
//
// Run it inside withSpaceLock for this space, after the write that frees a
// place, with the same session as that write.
exports.fillFromWaitlist = async (coworkingSpaceId, session) => {
  const coworkingSpace =
    await CoworkingSpace.findById(coworkingSpaceId).session(session);
  if (!coworkingSpace) return [];

  const entries = await WaitlistEntry.find({
    coworkingSpace: coworkingSpace._id,
    startTime: { $gt: new Date() },
  })
    .sort("createdAt _id")
    .populate({ path: "user", select: "name email role" })
    .session(session);

  const given = [];

  for (const entry of entries) {
    // The user of the entry was deleted
    if (!entry.user) continue;

    if (await isAtReservationLimit(entry.user, session)) continue;

    const conflict =
      (await findClosureConflict(
        coworkingSpace,
        entry.startTime,
        entry.endTime,
        session,
      )) ??
      (await findCapacityConflict(
        coworkingSpace,
        entry.startTime,
        entry.endTime,
        session,
      ));

    if (conflict) continue;

    const [reservation] = await Reservation.create(
      [
        {
          startTime: entry.startTime,
          endTime: entry.endTime,
          user: entry.user._id,
          coworkingSpace: coworkingSpace._id,
        },
      ],
      { session },
    );
    await WaitlistEntry.deleteOne({ _id: entry._id }).session(session);

    given.push({ reservation, user: entry.user, coworkingSpace });
  }

  return given;
};
