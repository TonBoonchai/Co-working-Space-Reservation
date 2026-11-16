const sendEmail = require("./sendEmail");
const { formatBangkok } = require("./reservationTime");

// All the emails that the server sends to users.
// Call them only after the transaction commits. They do not wait for the
// email, and an email that fails does not undo the change.

const send = (user, subject, text) => {
  if (!user?.email) return;

  sendEmail({ to: user.email, subject, text }).catch((err) =>
    console.log(`Cannot send email to ${user.email}: ${err.message}`),
  );
};

// "<start> to <end> (Bangkok time)"
const period = (reservation) =>
  `${formatBangkok(reservation.startTime)} to ` +
  `${formatBangkok(reservation.endTime)} (Bangkok time)`;

// One email to the owner of each reservation that a closure canceled.
// Each reservation must have its user populated (name and email).
exports.notifyClosureCanceled = (canceled, spaceName, closure) => {
  const closed =
    `${formatBangkok(closure.startTime)} to ${formatBangkok(closure.endTime)}` +
    (closure.reason ? ` (${closure.reason})` : "");

  canceled.forEach((reservation) =>
    send(
      reservation.user,
      `Your reservation at ${spaceName} is canceled`,
      `Hello ${reservation.user.name},\n\n` +
        `Your reservation at ${spaceName} from ${period(reservation)} ` +
        `is canceled, because the co-working space is closed from ${closed}.\n\n` +
        `Please make a new reservation at a different time or space.\n`,
    ),
  );
};

// One email to the owner when an admin changes their reservation.
// before and after have startTime, endTime and spaceName.
// owner is null when the user was deleted.
exports.notifyAdminEdited = (owner, before, after) =>
  owner &&
  send(
    owner,
    `An admin changed your reservation at ${before.spaceName}`,
    `Hello ${owner.name},\n\n` +
      `An admin changed your reservation.\n\n` +
      `Before: ${before.spaceName}, ${period(before)}\n` +
      `After: ${after.spaceName}, ${period(after)}\n`,
  );

// One email to the owner when an admin deletes their reservation.
// owner is null when the user was deleted.
exports.notifyAdminDeleted = (owner, reservation, spaceName) =>
  owner &&
  send(
    owner,
    `An admin deleted your reservation at ${spaceName}`,
    `Hello ${owner.name},\n\n` +
      `An admin deleted your reservation at ${spaceName} from ` +
      `${period(reservation)}.\n\n` +
      `Please make a new reservation if you still need the space.\n`,
  );

// One email to the user of each waitlist entry that became a reservation.
// given is the result of fillFromWaitlist.
exports.notifyWaitlistGiven = (given) =>
  given.forEach(({ reservation, user, coworkingSpace }) =>
    send(
      user,
      `You have a reservation at ${coworkingSpace.name}`,
      `Hello ${user.name},\n\n` +
        `A place opened at ${coworkingSpace.name}. Your waitlist entry ` +
        `is now a reservation from ${period(reservation)}.\n\n` +
        `If you do not need it, please delete the reservation.\n`,
    ),
  );
