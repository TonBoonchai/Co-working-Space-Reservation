// Mongo filter for documents whose [startTime, endTime) overlaps [start, end).
// Periods that only touch (one ends when the next starts) do not overlap.
exports.overlapFilter = (coworkingSpace, start, end) => ({
  coworkingSpace,
  startTime: { $lt: end },
  endTime: { $gt: start },
});
