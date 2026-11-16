const Reservation = require("../models/Reservation");
const { overlapFilter } = require("./overlap");
const { formatBangkok } = require("./reservationTime");

// The largest number of reservations that are active at the same time
// inside [start, end), and the first time when that number starts.
// A reservation that ends at time t and one that starts at t do not overlap,
// so at the same time an end counts before a start.
const peakOverlap = (reservations, start, end) => {
  const events = [];

  reservations.forEach((r) => {
    const from = Math.max(r.startTime.getTime(), start.getTime());
    const to = Math.min(r.endTime.getTime(), end.getTime());
    events.push({ time: from, change: 1 }, { time: to, change: -1 });
  });

  events.sort((a, b) => a.time - b.time || a.change - b.change);

  let active = 0;
  let peak = 0;
  let peakTime = null;

  events.forEach((e) => {
    active += e.change;
    if (active > peak) {
      peak = active;
      peakTime = e.time;
    }
  });

  return { peak, peakTime };
};

// Returns an error message when the space is full at some time in
// [startTime, endTime), or null.
// excludeId is the reservation that is being edited. It does not count.
// Run it only after checkReservationTime, so that the dates are valid.
// Run it inside withSpaceLock, with the same session as the write.
exports.findCapacityConflict = async (
  coworkingSpace,
  startTime,
  endTime,
  session,
  excludeId,
) => {
  // A space that was created before capacity existed has no limit
  if (coworkingSpace.capacity == null) return null;

  const start = new Date(startTime);
  const end = new Date(endTime);

  const filter = overlapFilter(coworkingSpace._id, start, end);
  if (excludeId) filter._id = { $ne: excludeId };

  const reservations = await Reservation.find(filter)
    .select("startTime endTime")
    .session(session);

  const { peak, peakTime } = peakOverlap(reservations, start, end);

  if (peak < coworkingSpace.capacity) return null;

  return `${coworkingSpace.name} is full at ${formatBangkok(peakTime)} (capacity ${coworkingSpace.capacity})`;
};
