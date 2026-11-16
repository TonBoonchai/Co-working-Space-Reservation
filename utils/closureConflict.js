const Closure = require("../models/Closure");
const { overlapFilter } = require("./overlap");
const { formatBangkok } = require("./reservationTime");

// Returns an error message when a closure overlaps the period, or null.
// Run it only after checkReservationTime, so that the dates are valid.
// Run it inside withSpaceLock, with the same session as the write.
exports.findClosureConflict = async (
  coworkingSpace,
  startTime,
  endTime,
  session,
) => {
  const closure = await Closure.findOne(
    overlapFilter(coworkingSpace._id, new Date(startTime), new Date(endTime)),
  )
    .sort("startTime")
    .session(session);

  if (!closure) return null;

  const reason = closure.reason ? ` (${closure.reason})` : "";
  return `${coworkingSpace.name} is closed from ${formatBangkok(closure.startTime)} to ${formatBangkok(closure.endTime)}${reason}`;
};
