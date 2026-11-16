const Review = require("../models/Review");
const Reservation = require("../models/Reservation");
const sendError = require("../utils/sendError");
const { withSpaceLock } = require("../utils/spaceLock");
const { updateSpaceRating } = require("../utils/spaceRating");

// Only the reviewer's name is public (never the email or the telephone)
const populateReview = [
  { path: "user", select: "name" },
  { path: "coworkingSpace", select: "name address" },
];

//@desc     Get all reviews
//@route    GET /api/v1/reviews
//@route    GET /api/v1/coworkingspaces/:coworkingSpaceId/reviews
//@route    GET /api/v1/reservations/:reservationId/reviews
//@access   Public
exports.getReviews = async (req, res, next) => {
  try {
    const filter = {};

    if (req.params.coworkingSpaceId) {
      filter.coworkingSpace = req.params.coworkingSpaceId;
    }

    if (req.params.reservationId) {
      filter.reservation = req.params.reservationId;
    }

    const reviews = await Review.find(filter)
      .populate(populateReview)
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (err) {
    return sendError(res, err, "Cannot find Review");
  }
};

//@desc     Get single review
//@route    GET /api/v1/reviews/:id
//@access   Public
exports.getReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id).populate(
      populateReview,
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: `No review with the id of ${req.params.id}`,
      });
    }

    res.status(200).json({ success: true, data: review });
  } catch (err) {
    return sendError(res, err, "Cannot find Review");
  }
};

//@desc     Add review for one ended reservation
//@route    POST /api/v1/reservations/:reservationId/reviews
//@access   Private (reservation owner)
exports.addReview = async (req, res, next) => {
  try {
    // POST /reviews and POST /coworkingspaces/:id/reviews have no reservation
    if (!req.params.reservationId) {
      return res.status(400).json({
        success: false,
        message:
          "Create a review with POST /api/v1/reservations/:reservationId/reviews",
      });
    }

    const reservation = await Reservation.findById(req.params.reservationId);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: `No reservation with the id of ${req.params.reservationId}`,
      });
    }

    // Only the owner can review a reservation. An admin cannot review for a user.
    if (reservation.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to review this reservation`,
      });
    }

    if (reservation.endTime > new Date()) {
      return res.status(400).json({
        success: false,
        message: "You can review a reservation only after it ends",
      });
    }

    // A request with no body has req.body undefined in Express 5
    const { rating, comment } = req.body ?? {};

    // The check, the create and the new average run under one lock
    // (see utils/spaceLock.js)
    const result = await withSpaceLock(
      reservation.coworkingSpace,
      async (session) => {
        const existing = await Review.exists({
          reservation: reservation._id,
        }).session(session);

        if (existing) return { error: "This reservation already has a review" };

        // The user, the space and the reservation never come from the body
        const [review] = await Review.create(
          [
            {
              rating,
              comment,
              user: req.user.id,
              coworkingSpace: reservation.coworkingSpace,
              reservation: reservation._id,
            },
          ],
          { session },
        );

        await updateSpaceRating(reservation.coworkingSpace, session);
        return { review };
      },
    );

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    await result.review.populate(populateReview);

    res.status(201).json({ success: true, data: result.review });
  } catch (err) {
    return sendError(res, err, "Cannot create Review");
  }
};

//@desc     Delete review
//@route    DELETE /api/v1/reviews/:id
//@access   Private (admin)
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: `No review with the id of ${req.params.id}`,
      });
    }

    // The delete and the new average run under one lock
    await withSpaceLock(review.coworkingSpace, async (session) => {
      await Review.deleteOne({ _id: review._id }).session(session);
      await updateSpaceRating(review.coworkingSpace, session);
    });

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    return sendError(res, err, "Cannot delete Review");
  }
};
