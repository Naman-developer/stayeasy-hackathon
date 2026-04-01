const express = require("express");
const {
  createOrder,
  verifyPayment,
} = require("../controllers/paymentController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create-order", verifyToken, createOrder);
router.post("/verify", verifyToken, verifyPayment);

module.exports = router;
