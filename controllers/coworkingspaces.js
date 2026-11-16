const CoworkingSpace = require("../models/CoworkingSpace");
const Reservation = require("../models/Reservation");
const Closure = require("../models/Closure");
const errorMessage = require("../utils/errorMessage");
const { checkReservationTime } = require("../utils/reservationTime");
const { calculatePrice } = require("../utils/price");

//@desc     Get all co-working spaces
//@route    GET /api/v1/coworkingspaces
//@access   Public
exports.getCoworkingSpaces = async (req, res, next) => {
  try {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"];

    // Loop over remove fields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`,
    );

    // Finding resource
    query = CoworkingSpace.find(JSON.parse(queryStr));

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await CoworkingSpace.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const coworkingSpaces = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: coworkingSpaces.length,
      pagination,
      data: coworkingSpaces,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: errorMessage(err, "Cannot get co-working spaces"),
    });
  }
};

//@desc     Get single co-working space
//@route    GET /api/v1/coworkingspaces/:id
//@access   Public
exports.getCoworkingSpace = async (req, res, next) => {
  try {
    const coworkingSpace = await CoworkingSpace.findById(req.params.id);

    if (!coworkingSpace) {
      return res.status(404).json({
        success: false,
        message: `No co-working space with the id of ${req.params.id}`,
      });
    }

    res.status(200).json({ success: true, data: coworkingSpace });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: errorMessage(err, "Cannot get co-working space"),
    });
  }
};

//@desc     Create new co-working space
//@route    POST /api/v1/coworkingspaces
//@access   Private (admin)
exports.createCoworkingSpace = async (req, res, next) => {
  try {
    const coworkingSpace = await CoworkingSpace.create(req.body);
    res.status(201).json({ success: true, data: coworkingSpace });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: errorMessage(err, "Cannot create co-working space"),
    });
  }
};

//@desc     Update co-working space
//@route    PUT /api/v1/coworkingspaces/:id
//@access   Private (admin)
exports.updateCoworkingSpace = async (req, res, next) => {
  try {
    const coworkingSpace = await CoworkingSpace.findById(req.params.id);

    if (!coworkingSpace) {
      return res.status(404).json({
        success: false,
        message: `No co-working space with the id of ${req.params.id}`,
      });
    }

    // save() runs the full validation, including the open/close time check
    Object.assign(coworkingSpace, req.body);
    await coworkingSpace.save();

    res.status(200).json({ success: true, data: coworkingSpace });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: errorMessage(err, "Cannot update co-working space"),
    });
  }
};

//@desc     Delete co-working space (and its reservations and closures)
//@route    DELETE /api/v1/coworkingspaces/:id
//@access   Private (admin)
exports.deleteCoworkingSpace = async (req, res, next) => {
  try {
    const coworkingSpace = await CoworkingSpace.findById(req.params.id);

    if (!coworkingSpace) {
      return res.status(404).json({
        success: false,
        message: `No co-working space with the id of ${req.params.id}`,
      });
    }

    await Reservation.deleteMany({ coworkingSpace: req.params.id });
    await Closure.deleteMany({ coworkingSpace: req.params.id });
    await CoworkingSpace.deleteOne({ _id: req.params.id });

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: errorMessage(err, "Cannot delete co-working space"),
    });
  }
};

//@desc     Calculate the total price of a reservation from its duration
//@route    POST /api/v1/coworkingspaces/:id/price
//@access   Public
exports.calculateReservationPrice = async (req, res, next) => {
  try {
    const coworkingSpace = await CoworkingSpace.findById(req.params.id);

    if (!coworkingSpace) {
      return res.status(404).json({
        success: false,
        message: `No co-working space with the id of ${req.params.id}`,
      });
    }

    // A space from before the hourly rate field has no rate
    if (coworkingSpace.hourlyRate == null) {
      return res.status(400).json({
        success: false,
        message: `${coworkingSpace.name} has no hourly rate`,
      });
    }

    // The same time rules as a new reservation.
    // (A request with no body has req.body undefined in Express 5)
    const { startTime, endTime } = req.body ?? {};
    const timeError = checkReservationTime(startTime, endTime, coworkingSpace);

    if (timeError) {
      return res.status(400).json({ success: false, message: timeError });
    }

    const { durationMinutes, totalPrice } = calculatePrice(
      coworkingSpace.hourlyRate,
      startTime,
      endTime,
    );

    res.status(200).json({
      success: true,
      data: {
        coworkingSpace: coworkingSpace._id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        durationMinutes,
        hourlyRate: coworkingSpace.hourlyRate,
        totalPrice,
        currency: "THB",
      },
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: errorMessage(err, "Cannot calculate the price"),
    });
  }
};
