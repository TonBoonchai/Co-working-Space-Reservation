const express = require("express");
const {
  getReviews,
  getReview,
  addReview,
  deleteReview,
} = require("../controllers/reviews");

const router = express.Router({ mergeParams: true });

const { protect, authorize } = require("../middleware/auth");

router
  .route("/")
  .get(getReviews)
  .post(protect, authorize("admin", "user"), addReview);
router
  .route("/:id")
  .get(getReview)
  .delete(protect, authorize("admin"), deleteReview);

module.exports = router;
