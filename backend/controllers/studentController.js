const Complaint = require("../models/Complaint");
const HostelStudent = require("../models/HostelStudent");
const MoveInChecklist = require("../models/MoveInChecklist");
const OutpassRequest = require("../models/OutpassRequest");
const SosAlert = require("../models/SosAlert");

const ACTIVE_COMPLAINT_STATUSES = ["open", "in_progress", "escalated"];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getDateDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const getStudentInsights = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const sinceDate = getDateDaysAgo(7);

    const [record, activeComplaints, pendingOutpass, sosCount] = await Promise.all([
      HostelStudent.findOne({ studentId })
        .populate("propertyId", "title city price priceType")
        .populate("hostelOwnerId", "name email phone"),
      Complaint.countDocuments({
        userId: studentId,
        status: { $in: ACTIVE_COMPLAINT_STATUSES },
      }),
      OutpassRequest.countDocuments({
        studentId,
        status: "pending",
      }),
      SosAlert.countDocuments({
        userId: studentId,
        createdAt: { $gte: sinceDate },
      }),
    ]);

    const attendanceLogs = (record?.attendanceLogs || []).filter(
      (item) => new Date(item.date).getTime() >= sinceDate.getTime()
    );
    const lateCount = attendanceLogs.filter((item) => item.status === "late").length;
    const absentCount = attendanceLogs.filter((item) => item.status === "absent").length;
    const presentCount = attendanceLogs.filter((item) => item.status === "present").length;

    const rawScore =
      100 -
      lateCount * 5 -
      absentCount * 12 -
      activeComplaints * 7 -
      pendingOutpass * 6 -
      sosCount * 4;
    const safetyScore = clamp(rawScore, 0, 100);

    return res.status(200).json({
      success: true,
      safetyScore,
      penalties: {
        lateCount,
        absentCount,
        activeComplaints,
        pendingOutpass,
        sosCount,
      },
      weekly: {
        attendanceEntries: attendanceLogs.length,
        presentCount,
        absentCount,
        lateCount,
      },
      hostel: record
        ? {
            roomNumber: record.roomNumber,
            feeStatus: record.feeStatus,
            property: record.propertyId || null,
            hostelOwner: record.hostelOwnerId || null,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student insights.",
      error: error.message,
    });
  }
};

const getMoveInChecklist = async (req, res) => {
  try {
    const checklist = await MoveInChecklist.findOne({ studentId: req.user.userId });

    return res.status(200).json({
      success: true,
      checklist: checklist || {
        studentId: req.user.userId,
        electricity: false,
        water: false,
        agreement: false,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch move-in checklist.",
      error: error.message,
    });
  }
};

const upsertMoveInChecklist = async (req, res) => {
  try {
    const payload = {
      electricity: Boolean(req.body.electricity),
      water: Boolean(req.body.water),
      agreement: Boolean(req.body.agreement),
    };

    const checklist = await MoveInChecklist.findOneAndUpdate(
      { studentId: req.user.userId },
      { $set: payload },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Move-in checklist saved.",
      checklist,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to save move-in checklist.",
      error: error.message,
    });
  }
};

module.exports = {
  getStudentInsights,
  getMoveInChecklist,
  upsertMoveInChecklist,
};
