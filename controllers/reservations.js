const Reservation = require("../models/Reservation");
const CoworkingSpace = require("../models/CoworkingSpace");
const User = require("../models/User");
const sendError = require("../utils/sendError");
const { withSpaceLock, lockSpace } = require("../utils/spaceLock");
const { findCapacityConflict } = require("../utils/capacity");
const { findClosureConflict } = require("../utils/closureConflict");
const {
  MAX_RESERVATIONS,
  isAtReservationLimit,
} = require("../utils/reservationLimit");
const { fillFromWaitlist } = require("../utils/waitlist");
const {
  notifyAdminEdited,
  notifyAdminDeleted,
  notifyWaitlistGiven,
} = require("../utils/notifications");
const { checkReservationTime } = require("../utils/reservationTime");

const populateSpace = {
  path: "coworkingSpace",
  select: "name address tel openTime closeTime",
};
const populateUser = { path: "user", select: "name email tel" };

// True when an admin acts on the reservation of a different user
const isAdminOnOther = (reservation, user) =>
  user.role === "admin" && reservation.user.toString() !== user.id;

// The owner of a reservation, for an email. Null when the user was deleted.
const findOwner = (reservation) =>
  User.findById(reservation.user).select("name email");

const isOwnerOrAdmin = (reservation, user) =>
  reservation.user.toString() === user.id || user.role === "admin";

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@route    GET /api/v1/coworkingspaces/:coworkingSpaceId/reservations
//@access   Private
exports.getReservations = async (req, res, next) => {
  try {
    const filter = {};

    if (req.params.coworkingSpaceId) {
      filter.coworkingSpace = req.params.coworkingSpaceId;
    }

    // General users can see only their own reservations; admins see all
    if (req.user.role !== "admin") {
      filter.user = req.user.id;
    }

    let query = Reservation.find(filter)
      .populate(populateSpace)
      .sort("startTime");

    if (req.user.role === "admin") {
      query = query.populate(populateUser);
    }

    const reservations = await query;

    res.status(200).json({
      success: true,
      count: reservations.length,
      data: reservations,
    });
  } catch (err) {
    return sendError(res, err, "Cannot find Reservation");
  }
};

//@desc     Get single reservation
//@route    GET /api/v1/reservations/:id
//@access   Private (owner or admin)
exports.getReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `No reservation with the id of ${req.params.id}`,
      });
    }

    // Keep reservations confidential: only the owner or an admin may view
    if (!isOwnerOrAdmin(reservation, req.user)) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to view this reservation`,
      });
    }

    await reservation.populate([populateSpace, populateUser]);

    res.status(200).json({
      success: true,
      data: reservation,
    });
  } catch (err) {
    return sendError(res, err, "Cannot find Reservation");
  }
};

//@desc     Add reservation
//@route    POST /api/v1/coworkingspaces/:coworkingSpaceId/reservations
//@access   Private
exports.addReservation = async (req, res, next) => {
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

    // Same day, inside opening hours, in the future, end after start
    // (A request with no body has req.body undefined in Express 5)
    const { startTime, endTime } = req.body ?? {};
    const timeError = checkReservationTime(startTime, endTime, coworkingSpace);

    if (timeError) {
      return res.status(400).json({ success: false, message: timeError });
    }

    // If the user is not an admin, they can only create 3 reservations
    if (await isAtReservationLimit(req.user)) {
      return res.status(400).json({
        success: false,
        message: `The user with ID ${req.user.id} has already made ${MAX_RESERVATIONS} reservations`,
      });
    }

    // The space must not be closed or full at any time during the reservation.
    // The checks and the create run under one lock (see utils/spaceLock.js).
    const result = await withSpaceLock(coworkingSpace._id, async (session) => {
      const conflict =
        (await findClosureConflict(
          coworkingSpace,
          startTime,
          endTime,
          session,
        )) ??
        (await findCapacityConflict(
          coworkingSpace,
          startTime,
          endTime,
          session,
        ));

      if (conflict) return { error: conflict };

      const [reservation] = await Reservation.create(
        [
          {
            startTime,
            endTime,
            user: req.user.id,
            coworkingSpace: coworkingSpace._id,
          },
        ],
        { session },
      );
      return { reservation };
    });

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.status(201).json({
      success: true,
      data: result.reservation,
    });
  } catch (err) {
    return sendError(res, err, "Cannot create Reservation");
  }
};

//@desc     Update reservation
//@route    PUT /api/v1/reservations/:id
//@access   Private (owner or admin)
exports.updateReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `No reservation with the id of ${req.params.id}`,
      });
    }

    // Make sure user is the reservation owner
    if (!isOwnerOrAdmin(reservation, req.user)) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this reservation`,
      });
    }

    // Only the time and the co-working space can change (never the owner)
    const body = req.body ?? {};
    const startTime = body.startTime ?? reservation.startTime;
    const endTime = body.endTime ?? reservation.endTime;
    const coworkingSpaceId = body.coworkingSpace ?? reservation.coworkingSpace;

    const coworkingSpace = await CoworkingSpace.findById(coworkingSpaceId);

    if (!coworkingSpace) {
      return res.status(404).json({
        success: false,
        message: `No co-working space with the id of ${coworkingSpaceId}`,
      });
    }

    const timeError = checkReservationTime(startTime, endTime, coworkingSpace);

    if (timeError) {
      return res.status(400).json({ success: false, message: timeError });
    }

    // Keep the old values for the waitlist and for the email
    const before = {
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      coworkingSpace: reservation.coworkingSpace,
    };
    const movesSpace = !before.coworkingSpace.equals(coworkingSpace._id);

    // The new space must not be closed or full at any time during the
    // reservation. This reservation does not count against the capacity.
    // The checks and the save run under one lock on the new space.
    // The edit can free a place in the old period, so the waitlist of the old
    // space gets a chance in the same transaction.
    const result = await withSpaceLock(coworkingSpace._id, async (session) => {
      if (movesSpace) await lockSpace(before.coworkingSpace, session);

      const conflict =
        (await findClosureConflict(
          coworkingSpace,
          startTime,
          endTime,
          session,
        )) ??
        (await findCapacityConflict(
          coworkingSpace,
          startTime,
          endTime,
          session,
          reservation._id,
        ));

      if (conflict) return { error: conflict };

      reservation.startTime = startTime;
      reservation.endTime = endTime;
      reservation.coworkingSpace = coworkingSpace._id;
      await reservation.save({ session });

      const given = await fillFromWaitlist(before.coworkingSpace, session);
      return { given };
    });

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    notifyWaitlistGiven(result.given);

    if (isAdminOnOther(reservation, req.user)) {
      const owner = await findOwner(reservation);
      const oldSpace = movesSpace
        ? await CoworkingSpace.findById(before.coworkingSpace)
        : coworkingSpace;

      notifyAdminEdited(
        owner,
        { ...before, spaceName: oldSpace?.name ?? "a deleted space" },
        { startTime, endTime, spaceName: coworkingSpace.name },
      );
    }

    await reservation.populate(populateSpace);

    res.status(200).json({
      success: true,
      data: reservation,
    });
  } catch (err) {
    return sendError(res, err, "Cannot update Reservation");
  }
};

//@desc     Delete reservation
//@route    DELETE /api/v1/reservations/:id
//@access   Private (owner or admin)
exports.deleteReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `No reservation with the id of ${req.params.id}`,
      });
    }

    // Make sure user is the reservation owner
    if (!isOwnerOrAdmin(reservation, req.user)) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this reservation`,
      });
    }

    // The delete frees a place, so the waitlist of the space gets a chance
    // in the same transaction.
    const given = await withSpaceLock(
      reservation.coworkingSpace,
      async (session) => {
        await Reservation.deleteOne({ _id: reservation._id }).session(session);
        return fillFromWaitlist(reservation.coworkingSpace, session);
      },
    );

    notifyWaitlistGiven(given);

    if (isAdminOnOther(reservation, req.user)) {
      const owner = await findOwner(reservation);
      const space = await CoworkingSpace.findById(reservation.coworkingSpace);
      notifyAdminDeleted(owner, reservation, space?.name ?? "a deleted space");
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    return sendError(res, err, "Cannot delete Reservation");
  }
};
