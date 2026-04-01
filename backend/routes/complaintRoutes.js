const express = require("express");
const {
  createComplaint,
  getMyComplaints,
  respondToComplaint,
  resolveComplaint,
  getEscalatedComplaints,
  getAllComplaintsForAdmin,
} = require("../controllers/complaintController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", verifyToken, createComplaint);
router.get("/my", verifyToken, getMyComplaints);
router.put("/:id/respond", verifyToken, respondToComplaint);
router.put("/:id/resolve", verifyToken, authorizeRoles("admin"), resolveComplaint);
router.get(
  "/admin/escalated",
  verifyToken,
  authorizeRoles("admin"),
  getEscalatedComplaints
);
router.get("/admin/all", verifyToken, authorizeRoles("admin"), getAllComplaintsForAdmin);

module.exports = router;
