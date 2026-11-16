const express = require("express");
const {
  register,
  login,
  googleLogin,
  googleCallback,
  getMe,
  logout,
} = require("../controllers/auth");

const router = express.Router();

const { protect } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.get("/me", protect, getMe);
router.get("/logout", logout);

module.exports = router;
