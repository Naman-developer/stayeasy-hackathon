const express = require("express");
const {
  addHostelStudent,
  createHostelBroadcast,
  getMessFeedbackSummary,
  getHostelStudents,
  markAttendance,
  getAttendance,
  upsertMessSchedule,
  getMessSchedule,
  createOutpassRequest,
  getOutpassRequests,
  approveOutpass,
  rejectOutpass,
  submitMessFeedback,
} = require("../controllers/hostelController");
const { getStudentInsights } = require("../controllers/studentController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/students/add",
  verifyToken,
  authorizeRoles("hostel_owner"),
  addHostelStudent
);
router.get(
  "/students",
  verifyToken,
  authorizeRoles("hostel_owner"),
  getHostelStudents
);
router.post(
  "/attendance/mark",
  verifyToken,
  authorizeRoles("hostel_owner"),
  markAttendance
);
router.get(
  "/attendance/:studentId",
  verifyToken,
  authorizeRoles("hostel_owner", "student", "parent"),
  getAttendance
);
router.get(
  "/student-insights",
  verifyToken,
  authorizeRoles("student"),
  getStudentInsights
);

router.post(
  "/mess",
  verifyToken,
  authorizeRoles("hostel_owner"),
  upsertMessSchedule
);
router.get(
  "/mess",
  verifyToken,
  authorizeRoles("hostel_owner", "student"),
  getMessSchedule
);
router.post(
  "/mess-feedback",
  verifyToken,
  authorizeRoles("student"),
  submitMessFeedback
);
router.get(
  "/mess-feedback/summary",
  verifyToken,
  authorizeRoles("hostel_owner"),
  getMessFeedbackSummary
);
router.post(
  "/broadcast",
  verifyToken,
  authorizeRoles("hostel_owner"),
  createHostelBroadcast
);

router.post(
  "/outpass",
  verifyToken,
  authorizeRoles("student"),
  createOutpassRequest
);
router.get(
  "/outpass",
  verifyToken,
  authorizeRoles("hostel_owner", "student"),
  getOutpassRequests
);
router.put(
  "/outpass/:id/approve",
  verifyToken,
  authorizeRoles("hostel_owner"),
  approveOutpass
);
router.put(
  "/outpass/:id/reject",
  verifyToken,
  authorizeRoles("hostel_owner"),
  rejectOutpass
);

module.exports = router;
