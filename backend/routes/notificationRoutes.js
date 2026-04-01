const express = require("express");
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, getMyNotifications);
router.put("/read-all", verifyToken, markAllNotificationsRead);
router.put("/:id/read", verifyToken, markNotificationRead);

module.exports = router;
