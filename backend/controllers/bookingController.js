const Booking = require("../models/Booking");
const Property = require("../models/Property");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const { createNotification } = require("../utils/notify");

const createBooking = async (req, res) => {
  try {
    const { propertyId, checkInDate, checkOutDate, amount } = req.body;

    if (!propertyId || !checkInDate || !checkOutDate) {
      return res.status(400).json({
        success: false,
        message: "propertyId, checkInDate and checkOutDate are required.",
      });
    }

    const property = await Property.findById(propertyId);
    if (!property || property.status !== "approved") {
      return res.status(404).json({
        success: false,
        message: "Property is not available for booking.",
      });
    }

    if (String(property.ownerId) === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot book your own property.",
      });
    }

    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid date range.",
      });
    }

    const parsedAmount = amount ? Number(amount) : property.price;
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking amount.",
      });
    }

    const booking = await Booking.create({
      userId: req.user.userId,
      propertyId: property._id,
      ownerId: property.ownerId,
      checkInDate: start,
      checkOutDate: end,
      amount: parsedAmount,
      status: "pending",
      paymentStatus: "unpaid",
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("propertyId", "title city price")
      .populate("ownerId", "name email phone");

    await createNotification({
      userId: property.ownerId,
      title: "New Property Booking Request",
      message: `A new booking request was created for ${property.title}.`,
      type: "booking",
      meta: { bookingId: booking._id, propertyId: property._id },
    });

    return res.status(201).json({
      success: true,
      message: "Booking created. Complete payment to confirm.",
      booking: populatedBooking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create booking.",
      error: error.message,
    });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .populate("propertyId", "title city price propertyType images")
      .populate("ownerId", "name phone email");

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your bookings.",
      error: error.message,
    });
  }
};

const getOwnerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ ownerId: req.user.userId })
      .sort({ createdAt: -1 })
      .populate("propertyId", "title city price propertyType")
      .populate("userId", "name phone email");

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch owner bookings.",
      error: error.message,
    });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    const isBookingUser = String(booking.userId) === req.user.userId;
    const isPropertyOwner = String(booking.ownerId) === req.user.userId;
    const isAdmin = req.user.role === "admin";

    if (!isBookingUser && !isPropertyOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this booking.",
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled.",
      });
    }

    booking.status = "cancelled";
    if (booking.paymentStatus === "paid") {
      booking.paymentStatus = "refunded";
    }
    await booking.save();

    const recipients = [booking.userId, booking.ownerId];
    await Promise.all(
      recipients.map((recipient) =>
        createNotification({
          userId: recipient,
          title: "Booking Cancelled",
          message: `Booking ${booking._id.toString().slice(-6).toUpperCase()} was cancelled.`,
          type: "booking",
          meta: { bookingId: booking._id },
        })
      )
    );

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking.",
      error: error.message,
    });
  }
};

const getTenantRiskScore = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await User.findById(tenantId).select("name email role city isVerified");
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found.",
      });
    }

    const ownerLinkedBooking = await Booking.findOne({
      ownerId: req.user.userId,
      userId: tenantId,
    }).lean();

    if (!ownerLinkedBooking) {
      return res.status(403).json({
        success: false,
        message: "This tenant has no booking history on your listings.",
      });
    }

    const [bookingHistory, complaintsAgainst, complaintsByTenant] = await Promise.all([
      Booking.find({ userId: tenantId }).select("status paymentStatus amount checkInDate checkOutDate").lean(),
      Complaint.countDocuments({
        targetUserId: tenantId,
        status: { $in: ["open", "in_progress", "escalated"] },
      }),
      Complaint.countDocuments({
        userId: tenantId,
        status: { $in: ["open", "in_progress", "escalated"] },
      }),
    ]);

    const totalBookings = bookingHistory.length;
    const paidBookings = bookingHistory.filter((item) => item.paymentStatus === "paid").length;
    const cancelledBookings = bookingHistory.filter((item) => item.status === "cancelled").length;
    const confirmedBookings = bookingHistory.filter((item) => item.status === "confirmed").length;

    const paymentReliability = totalBookings
      ? paidBookings / totalBookings
      : 0;

    let score = 40;
    if (tenant.isVerified) score += 20;
    score += Math.round(paymentReliability * 28);
    score += Math.min(confirmedBookings * 2, 12);
    score -= complaintsAgainst * 8;
    score -= cancelledBookings * 4;
    score -= Math.min(complaintsByTenant * 2, 8);

    score = Math.max(5, Math.min(98, score));

    let trustBand = "High Risk";
    if (score >= 80) trustBand = "High Trust";
    else if (score >= 60) trustBand = "Medium Trust";

    return res.status(200).json({
      success: true,
      title: "Tenant-Trust-Score",
      tenant: {
        id: tenant._id,
        name: tenant.name,
        email: tenant.email,
        role: tenant.role,
        city: tenant.city || "-",
        isVerified: tenant.isVerified,
      },
      score,
      trustBand,
      factors: {
        totalBookings,
        paidBookings,
        confirmedBookings,
        cancelledBookings,
        paymentReliability: Number((paymentReliability * 100).toFixed(1)),
        activeComplaintsAgainstTenant: complaintsAgainst,
        activeComplaintsRaisedByTenant: complaintsByTenant,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate tenant trust score.",
      error: error.message,
    });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getOwnerBookings,
  cancelBooking,
  getTenantRiskScore,
};
