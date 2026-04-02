const Complaint = require("../models/Complaint");
const Property = require("../models/Property");
const User = require("../models/User");
const { createNotification } = require("../utils/notify");
const {
  ESCALATION_HOURS,
  escalateOldComplaints,
} = require("../utils/complaintEscalation");

const createComplaint = async (req, res) => {
  try {
    const { targetUserId, propertyId, category, message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Complaint message is required.",
      });
    }

    if (targetUserId) {
      const target = await User.findById(targetUserId);
      if (!target) {
        return res.status(404).json({
          success: false,
          message: "Target user not found.",
        });
      }
    }

    if (propertyId) {
      const property = await Property.findById(propertyId);
      if (!property) {
        return res.status(404).json({
          success: false,
          message: "Property not found.",
        });
      }
    }

    const complaint = await Complaint.create({
      userId: req.user.userId,
      targetUserId: targetUserId || undefined,
      propertyId: propertyId || undefined,
      category: category || "general",
      message: message.trim(),
      status: "open",
    });

    return res.status(201).json({
      success: true,
      message: "Complaint raised successfully.",
      complaint,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to raise complaint.",
      error: error.message,
    });
  }
};

const getMyComplaints = async (req, res) => {
  try {
    await escalateOldComplaints();

    const complaints = await Complaint.find({
      $or: [{ userId: req.user.userId }, { targetUserId: req.user.userId }],
    })
      .sort({ createdAt: -1 })
      .populate("userId", "name email")
      .populate("targetUserId", "name email")
      .populate("propertyId", "title city");

    return res.status(200).json({
      success: true,
      escalationWindowHours: ESCALATION_HOURS,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints.",
      error: error.message,
    });
  }
};

const canRespondToComplaint = async (complaint, actor) => {
  if (!complaint || !actor) return false;
  if (actor.role === "admin") return true;
  if (String(complaint.targetUserId) === actor.userId) return true;

  if (
    complaint.propertyId &&
    ["flat_owner", "pg_owner", "hostel_owner"].includes(actor.role)
  ) {
    const property = await Property.findById(complaint.propertyId);
    if (property && String(property.ownerId) === actor.userId) return true;
  }

  return false;
};

const respondToComplaint = async (req, res) => {
  try {
    const { response, status } = req.body;

    if (!response) {
      return res.status(400).json({
        success: false,
        message: "Response message is required.",
      });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    const allowed = await canRespondToComplaint(complaint, req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to respond to this complaint.",
      });
    }

    complaint.response = response.trim();
    if (status && ["in_progress", "resolved"].includes(status)) {
      complaint.status = status;
    } else if (complaint.status !== "resolved") {
      complaint.status = "in_progress";
    }
    if (complaint.status === "resolved") {
      complaint.resolvedAt = new Date();
    }

    await complaint.save();

    await createNotification({
      userId: complaint.userId,
      title: "Complaint Updated",
      message: `Your complaint status is now ${complaint.status}.`,
      type: "complaint",
      meta: { complaintId: complaint._id },
    });

    return res.status(200).json({
      success: true,
      message: "Complaint response submitted.",
      complaint,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to respond to complaint.",
      error: error.message,
    });
  }
};

const resolveComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found.",
      });
    }

    complaint.status = "resolved";
    complaint.resolvedAt = new Date();
    if (req.body.response) {
      complaint.response = String(req.body.response).trim();
    }
    await complaint.save();

    await createNotification({
      userId: complaint.userId,
      title: "Complaint Resolved",
      message: "Your complaint was marked resolved.",
      type: "complaint",
      meta: { complaintId: complaint._id },
    });

    return res.status(200).json({
      success: true,
      message: "Complaint resolved successfully.",
      complaint,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to resolve complaint.",
      error: error.message,
    });
  }
};

const getEscalatedComplaints = async (req, res) => {
  try {
    await escalateOldComplaints();

    const complaints = await Complaint.find({ status: "escalated" })
      .sort({ createdAt: -1 })
      .populate("userId", "name email")
      .populate("targetUserId", "name email")
      .populate("propertyId", "title city");

    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch escalated complaints.",
      error: error.message,
    });
  }
};

const getAllComplaintsForAdmin = async (req, res) => {
  try {
    await escalateOldComplaints();

    const { status, category, q } = req.query;

    const query = {};
    if (status && status !== "all") {
      query.status = String(status).trim();
    }
    if (category && category !== "all") {
      query.category = String(category).trim();
    }
    if (q) {
      const keyword = String(q).trim();
      if (keyword) {
        query.$or = [
          { message: { $regex: keyword, $options: "i" } },
          { response: { $regex: keyword, $options: "i" } },
          { category: { $regex: keyword, $options: "i" } },
        ];
      }
    }

    const [complaints, statusCountsRaw] = await Promise.all([
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .limit(500)
        .populate("userId", "name email role")
        .populate("targetUserId", "name email role")
        .populate("propertyId", "title city status"),
      Complaint.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const statusCounts = statusCountsRaw.reduce((acc, item) => {
      if (item?._id) {
        acc[item._id] = item.count;
      }
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      count: complaints.length,
      statusCounts,
      complaints,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all complaints.",
      error: error.message,
    });
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  respondToComplaint,
  resolveComplaint,
  getEscalatedComplaints,
  getAllComplaintsForAdmin,
};
