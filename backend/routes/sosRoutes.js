const express = require("express");
const {
  createQuickEmergencyAction,
  createSosAlert,
} = require("../controllers/sosController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", verifyToken, authorizeRoles("student"), createSosAlert);
router.post(
  "/quick-action",
  verifyToken,
  authorizeRoles("student"),
  createQuickEmergencyAction
);

module.exports = router;
