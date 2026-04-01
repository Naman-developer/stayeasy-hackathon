const express = require("express");
const {
  getChildProfile,
  getParentAttendance,
  getParentMessSchedule,
  getParentWeeklyReport,
  approveOutpassByParent,
  rejectOutpassByParent,
  sendParentQuickCheck,
} = require("../controllers/parentController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/child/:studentId",
  verifyToken,
  authorizeRoles("parent", "admin"),
  getChildProfile
);
router.get(
  "/attendance/:studentId",
  verifyToken,
  authorizeRoles("parent", "admin"),
  getParentAttendance
);
router.get(
  "/mess/:studentId",
  verifyToken,
  authorizeRoles("parent", "admin"),
  getParentMessSchedule
);
router.get(
  "/report/:studentId",
  verifyToken,
  authorizeRoles("parent", "admin"),
  getParentWeeklyReport
);
router.post(
  "/check-child/:studentId",
  verifyToken,
  authorizeRoles("parent", "admin"),
  sendParentQuickCheck
);
router.put(
  "/outpass/:id/approve",
  verifyToken,
  authorizeRoles("parent", "admin"),
  approveOutpassByParent
);
router.put(
  "/outpass/:id/reject",
  verifyToken,
  authorizeRoles("parent", "admin"),
  rejectOutpassByParent
);

module.exports = router;
