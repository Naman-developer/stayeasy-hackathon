const HostelMess = require("../models/HostelMess");
const HostelStudent = require("../models/HostelStudent");
const OutpassRequest = require("../models/OutpassRequest");
const User = require("../models/User");
const mongoose = require("mongoose");
const { createNotification } = require("../utils/notify");
const { isParentLinkedToStudent } = require("../utils/parentLink");
const { isStudentCode, normalizeStudentCode } = require("../utils/studentCode");

const isMongoObjectId = (value = "") => {
  const normalized = String(value).trim();
  return /^[a-fA-F0-9]{24}$/.test(normalized) && mongoose.Types.ObjectId.isValid(normalized);
};

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findStudentByIdentifier = async (identifier) => {
  if (!identifier) return null;

  const value = String(identifier).trim();

  if (isMongoObjectId(value)) {
    const byId = await User.findById(value);
    if (byId?.role === "student") return byId;
  }

  if (isStudentCode(value)) {
    const byStudentCode = await User.findOne({
      role: "student",
      studentCode: normalizeStudentCode(value),
    });
    if (byStudentCode) return byStudentCode;
  }

  return User.findOne({
    role: "student",
    $or: [
      { email: value.toLowerCase() },
      { phone: value },
      { name: { $regex: `^${escapeRegex(value)}$`, $options: "i" } },
    ],
  });
};

const canAccessStudent = async (parentId, studentIdentifier, parentRole) => {
  if (parentRole === "admin") return { allowed: true };

  const [parent, student] = await Promise.all([
    User.findById(parentId),
    findStudentByIdentifier(studentIdentifier),
  ]);

  if (!parent || !student) {
    return { allowed: false, message: "Parent or student not found." };
  }

  const hasLinkedChild = String(parent.roleDetails?.childReference || "").trim();
  if (!hasLinkedChild) {
    return {
      allowed: false,
      message:
        "No child is linked to your account. Add child reference during signup or ask admin to link it.",
    };
  }

  if (!isParentLinkedToStudent(parent, student)) {
    return { allowed: false, message: "You are not linked to this student." };
  }

  return { allowed: true, student };
};

const getChildProfile = async (req, res) => {
  try {
    const { studentId: studentIdentifier } = req.params;
    const permission = await canAccessStudent(
      req.user.userId,
      studentIdentifier,
      req.user.role
    );

    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.message,
      });
    }

    const targetStudent = await findStudentByIdentifier(studentIdentifier);
    if (!targetStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const [student, hostelRecord, outpassRequests] = await Promise.all([
      User.findById(targetStudent._id).select("name email phone city role studentCode"),
      HostelStudent.findOne({ studentId: targetStudent._id })
        .populate("propertyId", "title city address")
        .populate("hostelOwnerId", "name email phone"),
      OutpassRequest.find({ studentId: targetStudent._id })
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    return res.status(200).json({
      success: true,
      child: student,
      hostelRecord,
      outpassRequests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch child profile.",
      error: error.message,
    });
  }
};

const getParentAttendance = async (req, res) => {
  try {
    const { studentId: studentIdentifier } = req.params;
    const permission = await canAccessStudent(
      req.user.userId,
      studentIdentifier,
      req.user.role
    );

    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.message,
      });
    }

    const targetStudent = await findStudentByIdentifier(studentIdentifier);
    if (!targetStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const record = await HostelStudent.findOne({ studentId: targetStudent._id }).populate(
      "studentId",
      "name email studentCode"
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      student: record.studentId,
      attendanceLogs: record.attendanceLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance logs.",
      error: error.message,
    });
  }
};

const getParentMessSchedule = async (req, res) => {
  try {
    const { studentId: studentIdentifier } = req.params;
    const permission = await canAccessStudent(
      req.user.userId,
      studentIdentifier,
      req.user.role
    );

    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.message,
      });
    }

    const targetStudent = await findStudentByIdentifier(studentIdentifier);
    if (!targetStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const record = await HostelStudent.findOne({ studentId: targetStudent._id });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Hostel student record not found.",
      });
    }

    const mess = await HostelMess.findOne({
      hostelOwnerId: record.hostelOwnerId,
      propertyId: record.propertyId,
    }).populate("propertyId", "title city");

    return res.status(200).json({
      success: true,
      mess,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch mess schedule.",
      error: error.message,
    });
  }
};

const getParentWeeklyReport = async (req, res) => {
  try {
    const { studentId: studentIdentifier } = req.params;
    const permission = await canAccessStudent(
      req.user.userId,
      studentIdentifier,
      req.user.role
    );

    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.message,
      });
    }

    const targetStudent = await findStudentByIdentifier(studentIdentifier);
    if (!targetStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 7);

    const [record, outpassCount] = await Promise.all([
      HostelStudent.findOne({ studentId: targetStudent._id }).select(
        "attendanceLogs roomNumber feeStatus"
      ),
      OutpassRequest.countDocuments({
        studentId: targetStudent._id,
        createdAt: { $gte: sinceDate },
      }),
    ]);

    const attendanceLogs = (record?.attendanceLogs || []).filter(
      (item) => new Date(item.date).getTime() >= sinceDate.getTime()
    );
    const presentCount = attendanceLogs.filter((item) => item.status === "present").length;
    const attendancePct = attendanceLogs.length
      ? Number(((presentCount / attendanceLogs.length) * 100).toFixed(1))
      : 0;

    const latestAttendance = [...(record?.attendanceLogs || [])].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    )[0];
    const liveStatus = latestAttendance?.status === "present" ? "Inside Hostel" : "Outside";

    return res.status(200).json({
      success: true,
      liveStatus,
      latestAttendanceStatus: latestAttendance?.status || "unknown",
      weekly: {
        attendancePercent: attendancePct,
        attendanceEntries: attendanceLogs.length,
        outpassCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch parent weekly report.",
      error: error.message,
    });
  }
};

const sendParentQuickCheck = async (req, res) => {
  try {
    const { studentId: studentIdentifier } = req.params;
    const permission = await canAccessStudent(
      req.user.userId,
      studentIdentifier,
      req.user.role
    );

    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.message,
      });
    }

    const targetStudent = await findStudentByIdentifier(studentIdentifier);
    if (!targetStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    await createNotification({
      userId: targetStudent._id,
      title: "Parent Quick Check",
      message: "Your parent just checked on you from Parent Portal.",
      type: "parent_check",
      meta: {
        parentUserId: req.user.userId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Quick check notification sent to child (simulated).",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send quick check notification.",
      error: error.message,
    });
  }
};

const approveOutpassByParent = async (req, res) => {
  try {
    const request = await OutpassRequest.findById(req.params.id).populate(
      "studentId",
      "name email phone"
    );
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Outpass request not found.",
      });
    }

    const permission = await canAccessStudent(
      req.user.userId,
      request.studentId._id,
      req.user.role
    );
    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.message,
      });
    }

    request.parentApproval = true;
    request.parentReviewedAt = new Date();
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Outpass request approved by parent.",
      request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve outpass request.",
      error: error.message,
    });
  }
};

const rejectOutpassByParent = async (req, res) => {
  try {
    const request = await OutpassRequest.findById(req.params.id).populate(
      "studentId",
      "name email phone"
    );
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Outpass request not found.",
      });
    }

    const permission = await canAccessStudent(
      req.user.userId,
      request.studentId._id,
      req.user.role
    );
    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.message,
      });
    }

    request.parentApproval = false;
    request.parentReviewedAt = new Date();
    request.status = "rejected";
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Outpass request rejected by parent.",
      request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject outpass request.",
      error: error.message,
    });
  }
};

module.exports = {
  getChildProfile,
  getParentAttendance,
  getParentMessSchedule,
  approveOutpassByParent,
  rejectOutpassByParent,
  getParentWeeklyReport,
  sendParentQuickCheck,
};
