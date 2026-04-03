const Booking = require("../models/Booking");
const Property = require("../models/Property");
const User = require("../models/User");
const Worker = require("../models/Worker");
const WorkerBooking = require("../models/WorkerBooking");
const HostelStudent = require("../models/HostelStudent");
const HostelMess = require("../models/HostelMess");
const HostelBroadcast = require("../models/HostelBroadcast");
const MessFeedback = require("../models/MessFeedback");
const MoveInChecklist = require("../models/MoveInChecklist");
const OutpassRequest = require("../models/OutpassRequest");
const Payment = require("../models/Payment");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");
const Review = require("../models/Review");
const SosAlert = require("../models/SosAlert");
const { escalateOldComplaints } = require("../utils/complaintEscalation");
const OWNER_ROLES = ["flat_owner", "pg_owner", "hostel_owner"];
const PENDING_PROPERTY_FILTER = {
  $or: [{ status: "pending" }, { status: { $exists: false } }, { status: null }, { status: "" }],
  isVerified: { $ne: true },
};
const PENDING_WORKER_FILTER = { verificationStatus: "pending" };

const toCountMap = (entries = []) =>
  entries.reduce((acc, item) => {
    if (item?._id) {
      acc[item._id] = item.count;
    }
    return acc;
  }, {});

const toIdSet = (values = []) => [...new Set(values.map((item) => String(item)))];

const deletePropertyWithCascade = async (propertyId) => {
  const property = await Property.findById(propertyId).select("_id title");
  if (!property) {
    return null;
  }

  const bookingIds = await Booking.find({ propertyId: property._id }).distinct("_id");

  const [
    bookingDeleteResult,
    paymentDeleteResult,
    complaintDeleteResult,
    hostelStudentDeleteResult,
    hostelMessDeleteResult,
    messFeedbackDeleteResult,
    propertyDeleteResult,
  ] = await Promise.all([
    Booking.deleteMany({ propertyId: property._id }),
    bookingIds.length
      ? Payment.deleteMany({ bookingId: { $in: bookingIds } })
      : Promise.resolve({ deletedCount: 0 }),
    Complaint.deleteMany({ propertyId: property._id }),
    HostelStudent.deleteMany({ propertyId: property._id }),
    HostelMess.deleteMany({ propertyId: property._id }),
    MessFeedback.deleteMany({ propertyId: property._id }),
    Property.deleteOne({ _id: property._id }),
  ]);

  return {
    propertyId: property._id,
    propertyTitle: property.title,
    deleted: {
      properties: propertyDeleteResult.deletedCount || 0,
      bookings: bookingDeleteResult.deletedCount || 0,
      payments: paymentDeleteResult.deletedCount || 0,
      complaints: complaintDeleteResult.deletedCount || 0,
      hostelStudents: hostelStudentDeleteResult.deletedCount || 0,
      hostelMess: hostelMessDeleteResult.deletedCount || 0,
      messFeedback: messFeedbackDeleteResult.deletedCount || 0,
    },
  };
};

const getPendingProperties = async (req, res) => {
  try {
    const properties = await Property.find(PENDING_PROPERTY_FILTER)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email phone");

    return res.status(200).json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending properties.",
      error: error.message,
    });
  }
};

const updatePropertyStatus = async (propertyId, status) => {
  const property = await Property.findById(propertyId);
  if (!property) {
    return null;
  }

  property.status = status;
  property.isVerified = status === "approved";
  await property.save();
  return property;
};

const approveProperty = async (req, res) => {
  try {
    const property = await updatePropertyStatus(req.params.id, "approved");
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Property approved successfully.",
      property,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve property.",
      error: error.message,
    });
  }
};

const rejectProperty = async (req, res) => {
  try {
    const property = await updatePropertyStatus(req.params.id, "rejected");
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Property rejected successfully.",
      property,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject property.",
      error: error.message,
    });
  }
};

const getPendingWorkers = async (req, res) => {
  try {
    const workers = await Worker.find(PENDING_WORKER_FILTER)
      .sort({ createdAt: -1 })
      .populate("userId", "name email phone city");

    return res.status(200).json({
      success: true,
      count: workers.length,
      workers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending workers.",
      error: error.message,
    });
  }
};

const updateWorkerVerificationStatus = async (workerId, status) => {
  const worker = await Worker.findById(workerId);
  if (!worker) {
    return null;
  }

  worker.verificationStatus = status;
  await worker.save();
  return worker;
};

const approveWorker = async (req, res) => {
  try {
    const worker = await updateWorkerVerificationStatus(req.params.id, "verified");
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Worker verified successfully.",
      worker,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify worker.",
      error: error.message,
    });
  }
};

const rejectWorker = async (req, res) => {
  try {
    const worker = await updateWorkerVerificationStatus(req.params.id, "rejected");
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Worker rejected successfully.",
      worker,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject worker.",
      error: error.message,
    });
  }
};

const removeUserProfile = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id).select(
      "_id role email studentCode name"
    );
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (String(targetUser._id) === String(req.user.userId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own admin account.",
      });
    }

    if (targetUser.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin profiles are protected from deletion.",
      });
    }

    const [ownedPropertyIds, userBookingIds, workerDoc] = await Promise.all([
      Property.find({ ownerId: targetUser._id }).distinct("_id"),
      Booking.find({
        $or: [{ userId: targetUser._id }, { ownerId: targetUser._id }],
      }).distinct("_id"),
      Worker.findOne({ userId: targetUser._id }).select("_id"),
    ]);

    const ownedPropertyBookingIds = ownedPropertyIds.length
      ? await Booking.find({ propertyId: { $in: ownedPropertyIds } }).distinct("_id")
      : [];

    const bookingIds = toIdSet([...userBookingIds, ...ownedPropertyBookingIds]);
    const workerId = workerDoc?._id || null;

    const propertyDeleteSummaries = [];
    for (const propertyId of ownedPropertyIds) {
      const summary = await deletePropertyWithCascade(propertyId);
      if (summary) {
        propertyDeleteSummaries.push(summary);
      }
    }

    const refsToUnlink = [
      String(targetUser.email || "").trim().toLowerCase(),
      String(targetUser.studentCode || "").trim().toUpperCase(),
      String(targetUser.name || "").trim(),
    ].filter(Boolean);

    const [
      userDeleteResult,
      paymentDeleteResult,
      bookingDeleteResult,
      complaintDeleteResult,
      notificationDeleteResult,
      sosDeleteResult,
      reviewDeleteResult,
      workerDeleteResult,
      workerBookingDeleteResult,
      hostelStudentDeleteResult,
      hostelMessDeleteResult,
      outpassDeleteResult,
      messFeedbackDeleteResult,
      hostelBroadcastDeleteResult,
      moveInChecklistDeleteResult,
      parentUnlinkResult,
    ] = await Promise.all([
      User.deleteOne({ _id: targetUser._id }),
      bookingIds.length
        ? Payment.deleteMany({ bookingId: { $in: bookingIds } })
        : Promise.resolve({ deletedCount: 0 }),
      Booking.deleteMany({
        $or: [{ userId: targetUser._id }, { ownerId: targetUser._id }],
      }),
      Complaint.deleteMany({
        $or: [{ userId: targetUser._id }, { targetUserId: targetUser._id }],
      }),
      Notification.deleteMany({ userId: targetUser._id }),
      SosAlert.deleteMany({ userId: targetUser._id }),
      Review.deleteMany({ reviewerId: targetUser._id }),
      Worker.deleteMany({ userId: targetUser._id }),
      WorkerBooking.deleteMany({
        $or: [
          { customerId: targetUser._id },
          ...(workerId ? [{ workerId }] : []),
        ],
      }),
      HostelStudent.deleteMany({
        $or: [{ studentId: targetUser._id }, { hostelOwnerId: targetUser._id }],
      }),
      HostelMess.deleteMany({ hostelOwnerId: targetUser._id }),
      OutpassRequest.deleteMany({
        $or: [{ studentId: targetUser._id }, { hostelOwnerId: targetUser._id }],
      }),
      MessFeedback.deleteMany({
        $or: [{ studentId: targetUser._id }, { hostelOwnerId: targetUser._id }],
      }),
      HostelBroadcast.deleteMany({ hostelOwnerId: targetUser._id }),
      MoveInChecklist.deleteMany({ studentId: targetUser._id }),
      refsToUnlink.length
        ? User.updateMany(
            {
              role: "parent",
              "roleDetails.childReference": { $in: refsToUnlink },
            },
            {
              $set: {
                "roleDetails.childReference": "",
              },
            }
          )
        : Promise.resolve({ modifiedCount: 0 }),
    ]);

    const propertyCascadeTotals = propertyDeleteSummaries.reduce(
      (acc, item) => {
        acc.properties += item.deleted.properties || 0;
        acc.bookings += item.deleted.bookings || 0;
        acc.payments += item.deleted.payments || 0;
        acc.complaints += item.deleted.complaints || 0;
        acc.hostelStudents += item.deleted.hostelStudents || 0;
        acc.hostelMess += item.deleted.hostelMess || 0;
        acc.messFeedback += item.deleted.messFeedback || 0;
        return acc;
      },
      {
        properties: 0,
        bookings: 0,
        payments: 0,
        complaints: 0,
        hostelStudents: 0,
        hostelMess: 0,
        messFeedback: 0,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Profile "${targetUser.name}" removed successfully.`,
      deleted: {
        users: userDeleteResult.deletedCount || 0,
        properties: propertyCascadeTotals.properties,
        bookings:
          (bookingDeleteResult.deletedCount || 0) + propertyCascadeTotals.bookings,
        payments:
          (paymentDeleteResult.deletedCount || 0) + propertyCascadeTotals.payments,
        complaints:
          (complaintDeleteResult.deletedCount || 0) + propertyCascadeTotals.complaints,
        notifications: notificationDeleteResult.deletedCount || 0,
        sosAlerts: sosDeleteResult.deletedCount || 0,
        reviews: reviewDeleteResult.deletedCount || 0,
        workers: workerDeleteResult.deletedCount || 0,
        workerBookings: workerBookingDeleteResult.deletedCount || 0,
        hostelStudents:
          (hostelStudentDeleteResult.deletedCount || 0) +
          propertyCascadeTotals.hostelStudents,
        hostelMess:
          (hostelMessDeleteResult.deletedCount || 0) + propertyCascadeTotals.hostelMess,
        outpassRequests: outpassDeleteResult.deletedCount || 0,
        messFeedback:
          (messFeedbackDeleteResult.deletedCount || 0) +
          propertyCascadeTotals.messFeedback,
        hostelBroadcasts: hostelBroadcastDeleteResult.deletedCount || 0,
        moveInChecklists: moveInChecklistDeleteResult.deletedCount || 0,
        parentLinksUnlinked: parentUnlinkResult.modifiedCount || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove user profile.",
      error: error.message,
    });
  }
};

const removeProperty = async (req, res) => {
  try {
    const summary = await deletePropertyWithCascade(req.params.id);
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Property "${summary.propertyTitle}" removed successfully.`,
      deleted: summary.deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove property.",
      error: error.message,
    });
  }
};

const removeWorker = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id).populate("userId", "name");
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found.",
      });
    }

    const [workerBookingDeleteResult, workerDeleteResult] = await Promise.all([
      WorkerBooking.deleteMany({ workerId: worker._id }),
      Worker.deleteOne({ _id: worker._id }),
    ]);

    return res.status(200).json({
      success: true,
      message: `Worker "${worker.userId?.name || "profile"}" removed successfully.`,
      deleted: {
        workers: workerDeleteResult.deletedCount || 0,
        workerBookings: workerBookingDeleteResult.deletedCount || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove worker.",
      error: error.message,
    });
  }
};

const updatePropertyOccupancy = async (req, res) => {
  try {
    const totalRooms = Number(req.body.manualTotalRooms);
    const filledRooms = Number(req.body.manualFilledRooms);

    if (
      !Number.isFinite(totalRooms) ||
      !Number.isFinite(filledRooms) ||
      totalRooms < 0 ||
      filledRooms < 0 ||
      !Number.isInteger(totalRooms) ||
      !Number.isInteger(filledRooms)
    ) {
      return res.status(400).json({
        success: false,
        message: "manualTotalRooms and manualFilledRooms must be non-negative integers.",
      });
    }

    if (filledRooms > totalRooms) {
      return res.status(400).json({
        success: false,
        message: "Filled rooms cannot be greater than total rooms.",
      });
    }

    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    property.manualTotalRooms = totalRooms;
    property.manualFilledRooms = filledRooms;
    await property.save();

    return res.status(200).json({
      success: true,
      message: "Occupancy values updated successfully.",
      property: {
        _id: property._id,
        title: property.title,
        city: property.city,
        manualTotalRooms: property.manualTotalRooms,
        manualFilledRooms: property.manualFilledRooms,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update occupancy values.",
      error: error.message,
    });
  }
};

const getAdminBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("userId", "name email")
      .populate("propertyId", "title city")
      .populate("ownerId", "name");

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin bookings.",
      error: error.message,
    });
  }
};

const getAdminDashboard = async (req, res) => {
  try {
    await escalateOldComplaints();

    const [
      totalUsers,
      totalProperties,
      totalBookings,
      totalWorkers,
      totalOwners,
      hostelStudents,
      escalatedComplaints,
    ] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Booking.countDocuments(),
      Worker.countDocuments(),
      User.countDocuments({ role: { $in: OWNER_ROLES } }),
      HostelStudent.countDocuments(),
      Complaint.countDocuments({ status: "escalated" }),
    ]);

    const [
      roleCountsRaw,
      propertyStatusCountsRaw,
      propertyTypeCountsRaw,
      bookingStatusCountsRaw,
      bookingPaymentCountsRaw,
      workerVerificationCountsRaw,
      workerServiceCountsRaw,
      hostelFeeCountsRaw,
      complaintStatusCountsRaw,
      paidBookingCount,
    ] = await Promise.all([
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      Property.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Property.aggregate([{ $group: { _id: "$propertyType", count: { $sum: 1 } } }]),
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Booking.aggregate([{ $group: { _id: "$paymentStatus", count: { $sum: 1 } } }]),
      Worker.aggregate([{ $group: { _id: "$verificationStatus", count: { $sum: 1 } } }]),
      Worker.aggregate([{ $group: { _id: "$serviceType", count: { $sum: 1 } } }]),
      HostelStudent.aggregate([{ $group: { _id: "$feeStatus", count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Booking.countDocuments({ paymentStatus: "paid", status: { $ne: "cancelled" } }),
    ]);

    const revenueAggregate = await Booking.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalRevenue = revenueAggregate[0]?.total || 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const monthlyRevenueRaw = await Booking.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          status: { $ne: "cancelled" },
          createdAt: { $gte: monthStart },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlyMap = {};
    monthlyRevenueRaw.forEach((entry) => {
      const key = `${entry._id.year}-${entry._id.month}`;
      monthlyMap[key] = entry.total;
    });

    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const label = date.toLocaleString("en-IN", { month: "short" });
      monthlyRevenue.push({
        label,
        revenue: monthlyMap[key] || 0,
      });
    }

    const topPropertiesRevenueRaw = await Booking.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: "$propertyId",
          revenue: { $sum: "$amount" },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topPropertyIds = topPropertiesRevenueRaw.map((item) => item._id);
    const topPropertyDocs = await Property.find({ _id: { $in: topPropertyIds } }).select(
      "title city propertyType isFeatured manualTotalRooms manualFilledRooms"
    );
    const topPropertyMap = topPropertyDocs.reduce((acc, item) => {
      acc[String(item._id)] = item;
      return acc;
    }, {});

    const topPropertiesByRevenue = topPropertiesRevenueRaw.map((item) => {
      const property = topPropertyMap[String(item._id)];
      const total = Number(property?.manualTotalRooms || 0);
      const filled = Number(property?.manualFilledRooms || 0);
      const occupancyRate = total > 0 ? Number(((filled / total) * 100).toFixed(1)) : 0;

      return {
        propertyId: item._id,
        title: property?.title || "Unknown Property",
        city: property?.city || "-",
        propertyType: property?.propertyType || "-",
        isFeatured: Boolean(property?.isFeatured),
        revenue: item.revenue || 0,
        bookingCount: item.bookingCount || 0,
        manualTotalRooms: total,
        manualFilledRooms: filled,
        occupancyRate,
      };
    });

    const [
      pendingProperties,
      pendingWorkers,
      recentBookings,
      escalatedComplaintList,
      recentNotifications,
      usersDetailRaw,
      propertiesDetailRaw,
      bookingsDetailRaw,
      revenueBookingsRaw,
      workersDetailRaw,
      ownerAccountsRaw,
      hostelStudentsRaw,
      escalatedComplaintDetailsRaw,
    ] = await Promise.all([
      Property.find(PENDING_PROPERTY_FILTER)
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("ownerId", "name email"),
      Worker.find(PENDING_WORKER_FILTER)
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("userId", "name email phone city"),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("userId", "name email")
        .populate("propertyId", "title city"),
      Complaint.find({ status: "escalated" })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("userId", "name email")
        .populate("targetUserId", "name email")
        .populate("propertyId", "title city"),
      Notification.find()
        .sort({ createdAt: -1 })
        .limit(15)
        .populate("userId", "name role"),
      User.find()
        .sort({ createdAt: -1 })
        .limit(250)
        .select("name email phone role city isVerified createdAt lastLoginAt"),
      Property.find()
        .sort({ createdAt: -1 })
        .limit(250)
        .populate("ownerId", "name email phone")
        .select(
          "title propertyType city address price priceType status isVerified createdAt ownerId manualTotalRooms manualFilledRooms isFeatured featuredAt"
        ),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(250)
        .populate("userId", "name email city")
        .populate("ownerId", "name email city")
        .populate("propertyId", "title city propertyType"),
      Booking.find({ paymentStatus: "paid", status: { $ne: "cancelled" } })
        .sort({ createdAt: -1 })
        .limit(250)
        .populate("userId", "name email city")
        .populate("ownerId", "name email city")
        .populate("propertyId", "title city propertyType"),
      Worker.find()
        .sort({ createdAt: -1 })
        .limit(250)
        .populate("userId", "name email phone city lastLoginAt createdAt"),
      User.find({ role: { $in: OWNER_ROLES } })
        .sort({ createdAt: -1 })
        .limit(250)
        .select("name email phone city role createdAt lastLoginAt"),
      HostelStudent.find()
        .sort({ createdAt: -1 })
        .limit(250)
        .populate("studentId", "name email city")
        .populate("hostelOwnerId", "name email city")
        .populate("propertyId", "title city"),
      Complaint.find({ status: "escalated" })
        .sort({ createdAt: -1 })
        .limit(250)
        .populate("userId", "name email city")
        .populate("targetUserId", "name email city")
        .populate("propertyId", "title city"),
    ]);

    const recentActivity = recentNotifications.map((item) => ({
      id: item._id,
      title: item.title,
      message: item.message,
      type: item.type || "general",
      userName: item.userId?.name || "User",
      userRole: item.userId?.role || "user",
      createdAt: item.createdAt,
      isRead: item.isRead,
    }));

    const ownerAccountIds = ownerAccountsRaw.map((owner) => owner._id);
    const ownerListingMap = {};

    if (ownerAccountIds.length) {
      const listingCountsRaw = await Property.aggregate([
        { $match: { ownerId: { $in: ownerAccountIds } } },
        {
          $group: {
            _id: { ownerId: "$ownerId", propertyType: "$propertyType" },
            count: { $sum: 1 },
          },
        },
      ]);

      listingCountsRaw.forEach((entry) => {
        const ownerId = String(entry._id.ownerId);
        if (!ownerListingMap[ownerId]) {
          ownerListingMap[ownerId] = { total: 0 };
        }

        const type = entry._id.propertyType || "other";
        ownerListingMap[ownerId][type] = entry.count;
        ownerListingMap[ownerId].total += entry.count;
      });
    }

    const detailRecords = {
      users: usersDetailRaw.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        city: user.city || "-",
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      })),
      properties: propertiesDetailRaw.map((property) => ({
        id: String(property._id),
        title: property.title,
        propertyType: property.propertyType,
        city: property.city,
        address: property.address,
        price: property.price,
        priceType: property.priceType,
        status: property.status,
        isVerified: property.isVerified,
        manualTotalRooms: property.manualTotalRooms || 0,
        manualFilledRooms: property.manualFilledRooms || 0,
        isFeatured: Boolean(property.isFeatured),
        featuredAt: property.featuredAt || null,
        ownerName: property.ownerId?.name || "N/A",
        ownerEmail: property.ownerId?.email || "N/A",
        ownerPhone: property.ownerId?.phone || "N/A",
        createdAt: property.createdAt,
      })),
      bookings: bookingsDetailRaw.map((booking) => ({
        id: booking._id,
        userName: booking.userId?.name || "N/A",
        userEmail: booking.userId?.email || "N/A",
        userCity: booking.userId?.city || "-",
        ownerName: booking.ownerId?.name || "N/A",
        ownerEmail: booking.ownerId?.email || "N/A",
        propertyTitle: booking.propertyId?.title || "N/A",
        propertyCity: booking.propertyId?.city || "-",
        propertyType: booking.propertyId?.propertyType || "-",
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        amount: booking.amount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        createdAt: booking.createdAt,
      })),
      revenueBookings: revenueBookingsRaw.map((booking) => ({
        id: booking._id,
        userName: booking.userId?.name || "N/A",
        propertyTitle: booking.propertyId?.title || "N/A",
        propertyCity: booking.propertyId?.city || "-",
        amount: booking.amount,
        paymentStatus: booking.paymentStatus,
        status: booking.status,
        paymentOrderId: booking.paymentOrderId || "-",
        paymentId: booking.paymentId || "-",
        createdAt: booking.createdAt,
      })),
      workers: workersDetailRaw.map((worker) => ({
        id: worker._id,
        name: worker.userId?.name || "N/A",
        email: worker.userId?.email || "N/A",
        phone: worker.userId?.phone || "N/A",
        city: worker.city || worker.userId?.city || "-",
        serviceType: worker.serviceType,
        charges: worker.charges,
        availability: worker.availability,
        verificationStatus: worker.verificationStatus,
        rating: worker.rating,
        totalJobs: worker.totalJobs,
        createdAt: worker.createdAt,
        lastLoginAt: worker.userId?.lastLoginAt || null,
      })),
      owners: ownerAccountsRaw.map((owner) => {
        const listingSummary = ownerListingMap[String(owner._id)] || { total: 0 };
        return {
          id: owner._id,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          role: owner.role || "-",
          city: owner.city || "-",
          totalListings: listingSummary.total || 0,
          hostelListings: listingSummary.hostel || 0,
          pgListings: listingSummary.pg || 0,
          flatListings: listingSummary.flat || 0,
          roomListings: listingSummary.room || 0,
          hotelListings: listingSummary.hotel || 0,
          createdAt: owner.createdAt,
          lastLoginAt: owner.lastLoginAt,
        };
      }),
      hostelStudents: hostelStudentsRaw.map((record) => {
        const lastAttendance = record.attendanceLogs?.length
          ? record.attendanceLogs[record.attendanceLogs.length - 1]
          : null;

        return {
          id: record._id,
          studentName: record.studentId?.name || "N/A",
          studentEmail: record.studentId?.email || "N/A",
          studentCity: record.studentId?.city || "-",
          hostelOwnerName: record.hostelOwnerId?.name || "N/A",
          propertyTitle: record.propertyId?.title || "N/A",
          propertyCity: record.propertyId?.city || "-",
          roomNumber: record.roomNumber,
          feeStatus: record.feeStatus,
          messPlan: record.messPlan || "-",
          attendanceCount: record.attendanceLogs?.length || 0,
          inOutCount: record.inOutLogs?.length || 0,
          lastAttendanceDate: lastAttendance?.date || null,
          lastAttendanceStatus: lastAttendance?.status || "-",
          createdAt: record.createdAt,
        };
      }),
      escalatedComplaints: escalatedComplaintDetailsRaw.map((complaint) => ({
        id: complaint._id,
        category: complaint.category || "general",
        message: complaint.message,
        status: complaint.status,
        raisedByName: complaint.userId?.name || "N/A",
        raisedByEmail: complaint.userId?.email || "N/A",
        targetName: complaint.targetUserId?.name || "N/A",
        targetEmail: complaint.targetUserId?.email || "N/A",
        propertyTitle: complaint.propertyId?.title || "N/A",
        propertyCity: complaint.propertyId?.city || "-",
        createdAt: complaint.createdAt,
        resolvedAt: complaint.resolvedAt || null,
      })),
    };

    return res.status(200).json({
      success: true,
      kpis: {
        totalUsers,
        totalProperties,
        totalBookings,
        totalRevenue,
        totalWorkers,
        totalOwners,
        hostelStudents,
        escalatedComplaints,
      },
      breakdowns: {
        roleCounts: toCountMap(roleCountsRaw),
        propertyStatusCounts: toCountMap(propertyStatusCountsRaw),
        propertyTypeCounts: toCountMap(propertyTypeCountsRaw),
        bookingStatusCounts: toCountMap(bookingStatusCountsRaw),
        bookingPaymentCounts: toCountMap(bookingPaymentCountsRaw),
        workerVerificationCounts: toCountMap(workerVerificationCountsRaw),
        workerServiceCounts: toCountMap(workerServiceCountsRaw),
        hostelFeeCounts: toCountMap(hostelFeeCountsRaw),
        complaintStatusCounts: toCountMap(complaintStatusCountsRaw),
        paidBookingCount,
      },
      pendingProperties,
      pendingWorkers,
      recentBookings,
      monthlyRevenue,
      topPropertiesByRevenue,
      escalatedComplaintsList: escalatedComplaintList,
      recentActivity,
      detailRecords,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard.",
      error: error.message,
    });
  }
};

module.exports = {
  getPendingProperties,
  approveProperty,
  rejectProperty,
  getPendingWorkers,
  approveWorker,
  rejectWorker,
  removeUserProfile,
  removeProperty,
  removeWorker,
  updatePropertyOccupancy,
  getAdminBookings,
  getAdminDashboard,
};
