const Reservation = require("../models/Reservation");
const CoworkingSpace = require("../models/CoworkingSpace");
const errorMessage = require("../utils/errorMessage");
const { checkReservationTime } = require("../utils/reservationTime");

// A general user can hold at most this many reservations (admins are exempt)
const MAX_RESERVATIONS = 3;

const populateSpace = {
  path: "coworkingSpace",
  select: "name address tel openTime closeTime",
};
const populateUser = { path: "user", select: "name email tel" };

// Bad ids / invalid data are the client's fault (400); anything else is 500
const sendError = (res, err, fallback) => {
  console.log(err);
  const clientError = ["CastError", "ValidationError"].includes(err.name);
  return res.status(clientError ? 400 : 500).json({
    success: false,
    message: errorMessage(err, fallback),
  });
};

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
    const { startTime, endTime } = req.body;
    const timeError = checkReservationTime(startTime, endTime, coworkingSpace);

    if (timeError) {
      return res.status(400).json({ success: false, message: timeError });
    }

    // If the user is not an admin, they can only create 3 reservations
    if (req.user.role !== "admin") {
      const existedReservations = await Reservation.countDocuments({
        user: req.user.id,
      });

      if (existedReservations >= MAX_RESERVATIONS) {
        return res.status(400).json({
          success: false,
          message: `The user with ID ${req.user.id} has already made ${MAX_RESERVATIONS} reservations`,
        });
      }
    }

    const reservation = await Reservation.create({
      startTime,
      endTime,
      user: req.user.id,
      coworkingSpace: coworkingSpace._id,
    });

    res.status(201).json({
      success: true,
      data: reservation,
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
    const startTime = req.body.startTime ?? reservation.startTime;
    const endTime = req.body.endTime ?? reservation.endTime;
    const coworkingSpaceId =
      req.body.coworkingSpace ?? reservation.coworkingSpace;

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

    reservation.startTime = startTime;
    reservation.endTime = endTime;
    reservation.coworkingSpace = coworkingSpace._id;
    await reservation.save();
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

    await reservation.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    return sendError(res, err, "Cannot delete Reservation");
  }
};
