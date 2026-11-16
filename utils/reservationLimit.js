const Reservation = require("../models/Reservation");

// A general user can hold at most this many reservations (admins are exempt)
const MAX_RESERVATIONS = 3;

exports.MAX_RESERVATIONS = MAX_RESERVATIONS;

// True when the user cannot hold one more reservation.
// session is optional. Pass it when the check is part of a transaction.
exports.isAtReservationLimit = async (user, session) => {
  if (user.role === "admin") return false;

  const count = await Reservation.countDocuments({
    user: user._id ?? user.id,
  }).session(session ?? null);

  return count >= MAX_RESERVATIONS;
};
