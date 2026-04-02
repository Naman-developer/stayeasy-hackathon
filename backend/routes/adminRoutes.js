const express = require("express");
const {
  getPendingProperties,
  approveProperty,
  rejectProperty,
  getPendingWorkers,
  approveWorker,
  rejectWorker,
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
router.get("/workers/pending", getPendingWorkers);
router.put("/workers/:id/approve", approveWorker);
router.put("/workers/:id/reject", rejectWorker);
router.patch("/properties/:id/occupancy", updatePropertyOccupancy);
router.get("/bookings", getAdminBookings);
router.get("/dashboard", getAdminDashboard);

module.exports = router;
