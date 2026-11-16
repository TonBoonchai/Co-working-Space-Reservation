const Closure = require("../models/Closure");
const CoworkingSpace = require("../models/CoworkingSpace");
const Reservation = require("../models/Reservation");
const sendError = require("../utils/sendError");
const { overlapFilter } = require("../utils/overlap");
const { withSpaceLock } = require("../utils/spaceLock");
const { formatBangkok } = require("../utils/reservationTime");
const sendEmail = require("../utils/sendEmail");

const populateSpace = { path: "coworkingSpace", select: "name address" };

// Check a closure's time. Returns an error message, or null when it is valid.
// This must run before the overlap query, so that MongoDB never gets an Invalid Date.
const checkClosureTime = (startTime, endTime) => {
  if (!startTime || !endTime) {
    return "Please add a start time and an end time";
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start) || isNaN(end)) {
    return "Start time and end time must be valid dates (e.g. 2026-12-05T00:00:00+07:00)";
  }

  if (end <= start) {
    return "End time must be later than start time";
  }

  return null;
};

// Returns an error message when reservations overlap the period, or null.
// Run it inside withSpaceLock, with the same session as the write.
const findReservationConflict = async (
  coworkingSpaceId,
  startTime,
  endTime,
  session,
) => {
  const count = await Reservation.countDocuments(
    overlapFilter(coworkingSpaceId, new Date(startTime), new Date(endTime)),
  ).session(session);

  if (count === 0) return null;

  return count === 1
    ? "1 reservation overlaps this closure period"
    : `${count} reservations overlap this closure period`;
};

// Check the optional "force" field. Returns an error message, or null.
const checkForce = (force) =>
  force === undefined || typeof force === "boolean"
    ? null
    : "Force must be true or false";

// Delete the reservations that overlap the period, and return them with
// the name and email of each owner.
// Run it inside withSpaceLock, with the same session as the write.
const cancelReservations = async (
  coworkingSpaceId,
  startTime,
  endTime,
  session,
) => {
  const canceled = await Reservation.find(
    overlapFilter(coworkingSpaceId, new Date(startTime), new Date(endTime)),
  )
    .populate({ path: "user", select: "name email" })
    .session(session);

  if (canceled.length > 0) {
    await Reservation.deleteMany({
      _id: { $in: canceled.map((r) => r._id) },
    }).session(session);
  }

  return canceled;
};

// Send one email to the owner of each canceled reservation.
// Run it only after the transaction commits. The response does not wait for
// the emails, and an email that fails does not undo the closure.
const notifyCanceled = (canceled, spaceName, closure) => {
  const closed =
    `${formatBangkok(closure.startTime)} to ${formatBangkok(closure.endTime)}` +
    (closure.reason ? ` (${closure.reason})` : "");

  canceled.forEach((reservation) => {
    const user = reservation.user;
    if (!user?.email) return;

    sendEmail({
      to: user.email,
      subject: `Your reservation at ${spaceName} is canceled`,
      text:
        `Hello ${user.name},\n\n` +
        `Your reservation at ${spaceName} from ` +
        `${formatBangkok(reservation.startTime)} to ` +
        `${formatBangkok(reservation.endTime)} (Bangkok time) is canceled, ` +
        `because the co-working space is closed from ${closed}.\n\n` +
        `Please make a new reservation at a different time or space.\n`,
    }).catch((err) =>
      console.log(`Cannot send email to ${user.email}: ${err.message}`),
    );
  });
};

//@desc     Get all closures
//@route    GET /api/v1/closures
//@route    GET /api/v1/coworkingspaces/:coworkingSpaceId/closures
//@access   Public
exports.getClosures = async (req, res, next) => {
  try {
    const filter = {};

    if (req.params.coworkingSpaceId) {
      filter.coworkingSpace = req.params.coworkingSpaceId;
    }

    const closures = await Closure.find(filter)
      .populate(populateSpace)
      .sort("startTime");

    res.status(200).json({
      success: true,
      count: closures.length,
      data: closures,
    });
  } catch (err) {
    return sendError(res, err, "Cannot find Closure");
  }
};

//@desc     Get single closure
//@route    GET /api/v1/closures/:id
//@access   Public
exports.getClosure = async (req, res, next) => {
  try {
    const closure = await Closure.findById(req.params.id).populate(
      populateSpace,
    );

    if (!closure) {
      return res.status(404).json({
        success: false,
        message: `No closure with the id of ${req.params.id}`,
      });
    }

    res.status(200).json({ success: true, data: closure });
  } catch (err) {
    return sendError(res, err, "Cannot find Closure");
  }
};

//@desc     Add closure
//@route    POST /api/v1/coworkingspaces/:coworkingSpaceId/closures
//@access   Private (admin)
exports.addClosure = async (req, res, next) => {
  try {
    const coworkingSpace = await CoworkingSpace.findById(
      req.params.coworkingSpaceId,
    );

    if (!coworkingSpace) {
      return res.status(404).json({
        success: false,
        message: `No co-working space with the id of ${req.params.coworkingSpaceId}`,
      });
    }

    // A request with no body has req.body undefined in Express 5
    const { startTime, endTime, reason, force } = req.body ?? {};
    const inputError = checkClosureTime(startTime, endTime) ?? checkForce(force);

    if (inputError) {
      return res.status(400).json({ success: false, message: inputError });
    }

    // Without force, a reservation in the period rejects the closure.
    // With force, the closure cancels those reservations.
    // The check and the create run under one lock (see utils/spaceLock.js).
    const result = await withSpaceLock(coworkingSpace._id, async (session) => {
      let canceled = [];

      if (force) {
        canceled = await cancelReservations(
          coworkingSpace._id,
          startTime,
          endTime,
          session,
        );
      } else {
        const conflict = await findReservationConflict(
          coworkingSpace._id,
          startTime,
          endTime,
          session,
        );

        if (conflict) return { error: conflict };
      }

      // The space comes from the URL, never from the body
      const [closure] = await Closure.create(
        [{ coworkingSpace: coworkingSpace._id, startTime, endTime, reason }],
        { session },
      );
      return { closure, canceled };
    });

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    notifyCanceled(result.canceled, coworkingSpace.name, result.closure);

    res.status(201).json({
      success: true,
      canceledReservations: result.canceled.length,
      data: result.closure,
    });
  } catch (err) {
    return sendError(res, err, "Cannot create Closure");
  }
};

//@desc     Update closure
//@route    PUT /api/v1/closures/:id
//@access   Private (admin)
exports.updateClosure = async (req, res, next) => {
  try {
    const closure = await Closure.findById(req.params.id);

    if (!closure) {
      return res.status(404).json({
        success: false,
        message: `No closure with the id of ${req.params.id}`,
      });
    }

    // Only the time and the reason can change (never the co-working space)
    const body = req.body ?? {};
    const startTime = body.startTime ?? closure.startTime;
    const endTime = body.endTime ?? closure.endTime;
    const inputError =
      checkClosureTime(startTime, endTime) ?? checkForce(body.force);

    if (inputError) {
      return res.status(400).json({ success: false, message: inputError });
    }

    // Without force, a reservation in the new period rejects the change.
    // With force, the change cancels those reservations.
    // The check and the save run under one lock (see utils/spaceLock.js).
    const result = await withSpaceLock(
      closure.coworkingSpace,
      async (session) => {
        let canceled = [];

        if (body.force) {
          canceled = await cancelReservations(
            closure.coworkingSpace,
            startTime,
            endTime,
            session,
          );
        } else {
          const conflict = await findReservationConflict(
            closure.coworkingSpace,
            startTime,
            endTime,
            session,
          );

          if (conflict) return { error: conflict };
        }

        closure.startTime = startTime;
        closure.endTime = endTime;
        if (body.reason !== undefined) closure.reason = body.reason;
        await closure.save({ session });
        return { canceled };
      },
    );

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    await closure.populate(populateSpace);

    notifyCanceled(result.canceled, closure.coworkingSpace.name, closure);

    res.status(200).json({
      success: true,
      canceledReservations: result.canceled.length,
      data: closure,
    });
  } catch (err) {
    return sendError(res, err, "Cannot update Closure");
  }
};

//@desc     Delete closure
//@route    DELETE /api/v1/closures/:id
//@access   Private (admin)
exports.deleteClosure = async (req, res, next) => {
  try {
    const closure = await Closure.findById(req.params.id);

    if (!closure) {
      return res.status(404).json({
        success: false,
        message: `No closure with the id of ${req.params.id}`,
      });
    }

    await closure.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    return sendError(res, err, "Cannot delete Closure");
  }
};
