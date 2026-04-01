const express = require("express");
const {
  getPendingProperties,
  approveProperty,
  rejectProperty,
  updatePropertyOccupancy,
  getAdminBookings,
  getAdminDashboard,
} = require("../controllers/adminController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(verifyToken, authorizeRoles("admin"));

router.get("/properties/pending", getPendingProperties);
router.put("/properties/:id/approve", approveProperty);
router.put("/properties/:id/reject", rejectProperty);
router.patch("/properties/:id/occupancy", updatePropertyOccupancy);
router.get("/bookings", getAdminBookings);
router.get("/dashboard", getAdminDashboard);

module.exports = router;
