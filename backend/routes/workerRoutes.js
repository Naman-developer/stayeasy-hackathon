const express = require("express");
const {
  registerWorker,
  getWorkers,
  bookWorker,
  getMyWorkerBookings,
  cancelWorkerBooking,
  completeWorkerBooking,
  getWorkerDashboard,
} = require("../controllers/workerController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getWorkers);
router.post("/register", verifyToken, authorizeRoles("worker"), registerWorker);
router.post("/book", verifyToken, bookWorker);
router.get("/my-bookings", verifyToken, getMyWorkerBookings);
router.put("/bookings/:id/cancel", verifyToken, cancelWorkerBooking);
router.put(
  "/bookings/:id/complete",
  verifyToken,
  authorizeRoles("worker"),
  completeWorkerBooking
);
router.get("/dashboard", verifyToken, authorizeRoles("worker"), getWorkerDashboard);

module.exports = router;
