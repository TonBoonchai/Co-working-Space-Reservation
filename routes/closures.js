const express = require("express");
const {
  getClosures,
  getClosure,
  addClosure,
  updateClosure,
  deleteClosure,
} = require("../controllers/closures");

const router = express.Router({ mergeParams: true });

const { protect, authorize } = require("../middleware/auth");

router
  .route("/")
  .get(getClosures)
  .post(protect, authorize("admin"), addClosure);
router
  .route("/:id")
  .get(getClosure)
  .put(protect, authorize("admin"), updateClosure)
  .delete(protect, authorize("admin"), deleteClosure);

module.exports = router;
