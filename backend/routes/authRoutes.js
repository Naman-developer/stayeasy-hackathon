const express = require("express");
const {
  signup,
  login,
  forgotPassword,
  resetPassword,
  otpLogin,
  getMe,
} = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/otp-login", otpLogin);
router.get("/me", verifyToken, getMe);

module.exports = router;
