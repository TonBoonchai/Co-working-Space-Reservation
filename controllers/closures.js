const Closure = require("../models/Closure");
const CoworkingSpace = require("../models/CoworkingSpace");
const Reservation = require("../models/Reservation");
const sendError = require("../utils/sendError");
const { overlapFilter } = require("../utils/overlap");

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

// Returns an error message when reservations overlap the period, or null
const findReservationConflict = async (coworkingSpaceId, startTime, endTime) => {
  const count = await Reservation.countDocuments(
    overlapFilter(coworkingSpaceId, new Date(startTime), new Date(endTime)),
  );

  if (count === 0) return null;

  return count === 1
    ? "1 reservation overlaps this closure period"
    : `${count} reservations overlap this closure period`;
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

    const { startTime, endTime, reason } = req.body;
    const timeError = checkClosureTime(startTime, endTime);

    if (timeError) {
      return res.status(400).json({ success: false, message: timeError });
    }

    const conflict = await findReservationConflict(
      coworkingSpace._id,
      startTime,
      endTime,
    );

    if (conflict) {
      return res.status(400).json({ success: false, message: conflict });
    }

    // The space comes from the URL, never from the body
    const closure = await Closure.create({
      coworkingSpace: coworkingSpace._id,
      startTime,
      endTime,
      reason,
    });

    res.status(201).json({ success: true, data: closure });
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
    const startTime = req.body.startTime ?? closure.startTime;
    const endTime = req.body.endTime ?? closure.endTime;
    const timeError = checkClosureTime(startTime, endTime);

    if (timeError) {
      return res.status(400).json({ success: false, message: timeError });
    }

    const conflict = await findReservationConflict(
      closure.coworkingSpace,
      startTime,
      endTime,
    );

    if (conflict) {
      return res.status(400).json({ success: false, message: conflict });
    }

    closure.startTime = startTime;
    closure.endTime = endTime;
    if (req.body.reason !== undefined) closure.reason = req.body.reason;
    await closure.save();
    await closure.populate(populateSpace);

    res.status(200).json({ success: true, data: closure });
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
