const express = require("express");
const {
  getWaitlistEntries,
  addWaitlistEntry,
  deleteWaitlistEntry,
} = require("../controllers/waitlist");

const router = express.Router({ mergeParams: true });

const { protect, authorize } = require("../middleware/auth");

router
  .route("/")
  .get(protect, getWaitlistEntries)
  .post(protect, authorize("admin", "user"), addWaitlistEntry);
router
  .route("/:id")
  .delete(protect, authorize("admin", "user"), deleteWaitlistEntry);

module.exports = router;
