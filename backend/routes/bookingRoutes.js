const express = require("express");
const {
  createBooking,
  getMyBookings,
  getOwnerBookings,
  cancelBooking,
  getTenantRiskScore,
} = require("../controllers/bookingController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", verifyToken, createBooking);
router.get("/my-bookings", verifyToken, getMyBookings);
router.get(
  "/owner",
  verifyToken,
  authorizeRoles("owner", "flat_owner", "pg_owner", "hostel_owner"),
  getOwnerBookings
);
router.get(
  "/owner/tenant-risk/:tenantId",
  verifyToken,
  authorizeRoles("owner", "flat_owner", "pg_owner", "hostel_owner"),
  getTenantRiskScore
);
router.put("/:id/cancel", verifyToken, cancelBooking);

module.exports = router;
