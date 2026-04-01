const HostelStudent = require("../models/HostelStudent");
const Notification = require("../models/Notification");
const SosAlert = require("../models/SosAlert");
const User = require("../models/User");
const { getLinkedParents } = require("../utils/parentLink");

const createSosAlert = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude are required.",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const alert = await SosAlert.create({
      userId: user._id,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });

    const [linkedParents, hostelRecord, admins] = await Promise.all([
      getLinkedParents(user),
      HostelStudent.findOne({ studentId: user._id }),
      User.find({ role: "admin" }),
    ]);

    const recipientIds = new Set();
    linkedParents.forEach((parent) => recipientIds.add(String(parent._id)));
    admins.forEach((admin) => recipientIds.add(String(admin._id)));
    if (hostelRecord?.hostelOwnerId) {
      recipientIds.add(String(hostelRecord.hostelOwnerId));
    }

    const notifications = [...recipientIds].map((recipientId) => ({
      userId: recipientId,
      title: "SOS Alert Triggered",
      message: `${user.name} triggered SOS from location (${latitude}, ${longitude}).`,
      type: "sos",
      meta: {
        alertId: alert._id,
        sourceUserId: user._id,
        latitude: Number(latitude),
        longitude: Number(longitude),
      },
    }));

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }

    return res.status(201).json({
      success: true,
      message: "SOS sent successfully. Parent/hostel/admin notified (simulated).",
      alert,
      notifiedCount: notifications.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process SOS alert.",
      error: error.message,
    });
  }
};

const createQuickEmergencyAction = async (req, res) => {
  try {
    const { actionType } = req.body;
    if (!["call_parent", "call_hostel"].includes(actionType)) {
      return res.status(400).json({
        success: false,
        message: "actionType must be call_parent or call_hostel.",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const [linkedParents, hostelRecord] = await Promise.all([
      getLinkedParents(user),
      HostelStudent.findOne({ studentId: user._id }),
    ]);

    const recipientIds = new Set();
    if (actionType === "call_parent") {
      linkedParents.forEach((parent) => recipientIds.add(String(parent._id)));
    } else if (hostelRecord?.hostelOwnerId) {
      recipientIds.add(String(hostelRecord.hostelOwnerId));
    }

    const notifications = [...recipientIds].map((recipientId) => ({
      userId: recipientId,
      title: "Quick Emergency Action Triggered",
      message: `${user.name} triggered ${actionType.replace("_", " ")} from Student Portal.`,
      type: "sos",
      meta: {
        actionType,
        sourceUserId: user._id,
      },
    }));

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }

    return res.status(200).json({
      success: true,
      message: "Quick emergency action sent as notification.",
      actionType,
      notifiedCount: notifications.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process quick emergency action.",
      error: error.message,
    });
  }
};

module.exports = {
  createSosAlert,
  createQuickEmergencyAction,
};
