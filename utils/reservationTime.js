// Thailand has no daylight saving time: local time is always UTC+7
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

// Calendar day ("YYYY-MM-DD") and time of day ("HH:mm") of a Date in Bangkok
const toBangkok = (date) => {
  const iso = new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
};

// Check a reservation's time against the rules.
// Returns an error message, or null when the time is allowed.
exports.checkReservationTime = (startTime, endTime, coworkingSpace) => {
  if (!startTime || !endTime) {
    return "Please add a start time and an end time";
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start) || isNaN(end)) {
    return "Start time and end time must be valid dates (e.g. 2026-12-01T09:00:00+07:00)";
  }

  if (start <= new Date()) {
    return "Start time must be in the future";
  }

  if (end <= start) {
    return "End time must be later than start time";
  }

  const s = toBangkok(start);
  const e = toBangkok(end);

  if (s.day !== e.day) {
    return "A reservation must start and end on the same day";
  }

  if (s.time < coworkingSpace.openTime || e.time > coworkingSpace.closeTime) {
    return `${coworkingSpace.name} is open ${coworkingSpace.openTime}-${coworkingSpace.closeTime}, so the reservation must be within these hours`;
  }

  return null;
};
