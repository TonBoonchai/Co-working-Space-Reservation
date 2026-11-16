const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

// Price of a period at an hourly rate in Thai Baht (THB).
// The price is in proportion to the duration, so 90 minutes at 100 THB per
// hour is 150 THB. The total is rounded to 2 decimal places (satang).
// Run it only after checkReservationTime, so that the dates are valid.
exports.calculatePrice = (hourlyRate, startTime, endTime) => {
  const durationMs = new Date(endTime) - new Date(startTime);

  return {
    durationMinutes: durationMs / MS_PER_MINUTE,
    totalPrice: Math.round((hourlyRate * durationMs * 100) / MS_PER_HOUR) / 100,
  };
};
