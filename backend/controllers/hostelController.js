const mongoose = require("mongoose");
const HostelBroadcast = require("../models/HostelBroadcast");
const HostelMess = require("../models/HostelMess");
const MessFeedback = require("../models/MessFeedback");
const HostelStudent = require("../models/HostelStudent");
const OutpassRequest = require("../models/OutpassRequest");
const Property = require("../models/Property");
const User = require("../models/User");
const { createBulkNotifications } = require("../utils/notify");
const { getLinkedParents, isParentLinkedToStudent } = require("../utils/parentLink");
const { isStudentCode, normalizeStudentCode } = require("../utils/studentCode");

const parseWeeklyMenu = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      // fallback simple parser for demo input formats
    }

    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [day, breakfast = "", lunch = "", dinner = ""] = line
          .split("|")
          .map((item) => item.trim());
        return { day, breakfast, lunch, dinner };
      });
  }

  return [];
};

const ensureHostelPropertyOwnership = async (propertyId, hostelOwnerId) => {
  const property = await Property.findById(propertyId);
  if (!property) return { valid: false, message: "Property not found." };
  if (String(property.ownerId) !== String(hostelOwnerId)) {
    return {
      valid: false,
      message: "This property does not belong to your account.",
    };
  }
  return { valid: true, property };
};

const isMongoObjectId = (value = "") => {
  const normalized = String(value).trim();
  return /^[a-fA-F0-9]{24}$/.test(normalized) && mongoose.Types.ObjectId.isValid(normalized);
};

const getDateDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const resolveStudentByIdentifier = async (studentIdentifier) => {
  const raw = String(studentIdentifier || "").trim();
  if (!raw) return null;

  let query = null;
  if (isMongoObjectId(raw)) {
    query = { _id: raw };
  } else if (isStudentCode(raw)) {
    query = { studentCode: normalizeStudentCode(raw) };
  }

  if (!query) return null;

  const student = await User.findOne(query).select(
    "_id role name email phone city studentCode"
  );

  if (!student || student.role !== "student") {
    return null;
  }

  return student;
};

const addHostelStudent = async (req, res) => {
  try {
    const { studentId, propertyId, roomNumber, feeStatus, messPlan } = req.body;

    if (!studentId || !propertyId || !roomNumber) {
      return res.status(400).json({
        success: false,
        message:
          "studentId (Mongo ID or Student Code), propertyId, and roomNumber are required.",
      });
    }

    const student = await resolveStudentByIdentifier(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student user not found. Use a valid student ID or code like STU0001.",
      });
    }

    const ownership = await ensureHostelPropertyOwnership(
      propertyId,
      req.user.userId
    );
    if (!ownership.valid) {
      return res.status(403).json({
        success: false,
        message: ownership.message,
      });
    }

    const hostelStudent = await HostelStudent.findOneAndUpdate(
      {
        studentId: student._id,
        hostelOwnerId: req.user.userId,
        propertyId,
      },
      {
        $set: {
          roomNumber,
          feeStatus: feeStatus || "pending",
          messPlan: messPlan || "",
        },
      },
      {
        new: true,
        upsert: true,
      }
    )
      .populate("studentId", "name email phone city studentCode")
      .populate("propertyId", "title city");

    return res.status(200).json({
      success: true,
      message: "Student added to hostel successfully.",
      hostelStudent,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add hostel student.",
      error: error.message,
    });
  }
};

const getHostelStudents = async (req, res) => {
  try {
    const records = await HostelStudent.find({ hostelOwnerId: req.user.userId })
      .sort({ createdAt: -1 })
      .populate("studentId", "name email phone city studentCode")
      .populate("propertyId", "title city");

    const sinceDate = getDateDaysAgo(7);
    const attendanceSummary = records.reduce(
      (acc, record) => {
        record.attendanceLogs.forEach((log) => {
          acc.total += 1;
          if (log.status === "present") acc.present += 1;
          if (log.status === "absent") acc.absent += 1;
          if (log.status === "late") acc.late += 1;
        });
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0 }
    );

    const lateEntries = records
      .map((record) => {
        const latestLog = [...record.attendanceLogs]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .find((log) => new Date(log.date).getTime() >= sinceDate.getTime());

        if (!latestLog || latestLog.status !== "late") return null;

        return {
          studentId: record.studentId?._id || null,
          studentName: record.studentId?.name || "N/A",
          studentCode: record.studentId?.studentCode || "N/A",
          roomNumber: record.roomNumber,
          propertyTitle: record.propertyId?.title || "N/A",
          date: latestLog.date,
          note: latestLog.note || "",
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      count: records.length,
      students: records,
      attendanceSummary,
      lateEntries,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch hostel students.",
      error: error.message,
    });
  }
};

const markAttendance = async (req, res) => {
  try {
    const { studentId, status, note, date } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "studentId is required (Mongo ID or Student Code).",
      });
    }

    const student = await resolveStudentByIdentifier(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student user not found. Use a valid student ID or code like STU0001.",
      });
    }

    const record = await HostelStudent.findOne({
      studentId: student._id,
      hostelOwnerId: req.user.userId,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Hostel student record not found.",
      });
    }

    const attendanceDate = date ? new Date(date) : new Date();
    const sameDayKey = attendanceDate.toISOString().slice(0, 10);

    record.attendanceLogs = record.attendanceLogs.filter(
      (log) => new Date(log.date).toISOString().slice(0, 10) !== sameDayKey
    );

    record.attendanceLogs.push({
      date: attendanceDate,
      status: status || "present",
      markedBy: req.user.userId,
      note: note || "",
    });

    await record.save();

    return res.status(200).json({
      success: true,
      message: "Attendance marked successfully.",
      attendanceLogs: record.attendanceLogs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark attendance.",
      error: error.message,
    });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await resolveStudentByIdentifier(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student record not found.",
      });
    }

    let record = null;

    if (req.user.role === "hostel_owner") {
      record = await HostelStudent.findOne({
        studentId: student._id,
        hostelOwnerId: req.user.userId,
      }).populate("studentId", "name email studentCode");
    } else if (req.user.role === "student") {
      if (req.user.userId !== String(student._id)) {
        return res.status(403).json({
          success: false,
          message: "You can only view your own attendance.",
        });
      }
      record = await HostelStudent.findOne({ studentId: student._id }).populate(
        "studentId",
        "name email studentCode"
      );
    } else if (req.user.role === "parent") {
      const [parent, studentUser] = await Promise.all([
        User.findById(req.user.userId),
        User.findById(student._id),
      ]);

      if (!studentUser || !isParentLinkedToStudent(parent, studentUser)) {
        return res.status(403).json({
          success: false,
          message: "You are not linked to this student.",
        });
      }
      record = await HostelStudent.findOne({ studentId: student._id }).populate(
        "studentId",
        "name email studentCode"
      );
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

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

const upsertMessSchedule = async (req, res) => {
  try {
    const { propertyId, weeklyMenu, rules, timings } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required.",
      });
    }

    const ownership = await ensureHostelPropertyOwnership(
      propertyId,
      req.user.userId
    );
    if (!ownership.valid) {
      return res.status(403).json({
        success: false,
        message: ownership.message,
      });
    }

    const parsedMenu = parseWeeklyMenu(weeklyMenu);

    const mess = await HostelMess.findOneAndUpdate(
      {
        hostelOwnerId: req.user.userId,
        propertyId,
      },
      {
        $set: {
          weeklyMenu: parsedMenu,
          rules: rules || "",
          timings: timings || "",
        },
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Mess schedule updated successfully.",
      mess,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update mess schedule.",
      error: error.message,
    });
  }
};

const getMessSchedule = async (req, res) => {
  try {
    if (req.user.role === "hostel_owner") {
      const mess = await HostelMess.find({ hostelOwnerId: req.user.userId })
        .sort({ createdAt: -1 })
        .populate("propertyId", "title city");

      return res.status(200).json({
        success: true,
        count: mess.length,
        mess,
      });
    }

    if (req.user.role === "student") {
      const record = await HostelStudent.findOne({ studentId: req.user.userId });
      if (!record) {
        return res.status(404).json({
          success: false,
          message: "Student hostel record not found.",
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
    }

    return res.status(403).json({
      success: false,
      message: "Access denied for mess schedule.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch mess schedule.",
      error: error.message,
    });
  }
};

const createOutpassRequest = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Outpass reason is required.",
      });
    }

    const record = await HostelStudent.findOne({ studentId: req.user.userId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Hostel student record not found.",
      });
    }

    const outpass = await OutpassRequest.create({
      studentId: req.user.userId,
      hostelOwnerId: record.hostelOwnerId,
      reason: reason.trim(),
      status: "pending",
      parentApproval: false,
    });

    return res.status(201).json({
      success: true,
      message: "Outpass request submitted successfully.",
      outpass,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create outpass request.",
      error: error.message,
    });
  }
};

const getOutpassRequests = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "hostel_owner") {
      query = { hostelOwnerId: req.user.userId };
    } else if (req.user.role === "student") {
      query = { studentId: req.user.userId };
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const requests = await OutpassRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("studentId", "name email phone studentCode");

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch outpass requests.",
      error: error.message,
    });
  }
};

const approveOutpass = async (req, res) => {
  try {
    const request = await OutpassRequest.findOne({
      _id: req.params.id,
      hostelOwnerId: req.user.userId,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Outpass request not found.",
      });
    }

    if (!request.parentApproval) {
      return res.status(400).json({
        success: false,
        message: "Parent approval is pending for this request.",
      });
    }

    request.status = "approved";
    request.reviewedByHostelAt = new Date();
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Outpass request approved.",
      outpass: request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve outpass request.",
      error: error.message,
    });
  }
};

const rejectOutpass = async (req, res) => {
  try {
    const request = await OutpassRequest.findOne({
      _id: req.params.id,
      hostelOwnerId: req.user.userId,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Outpass request not found.",
      });
    }

    request.status = "rejected";
    request.reviewedByHostelAt = new Date();
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Outpass request rejected.",
      outpass: request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject outpass request.",
      error: error.message,
    });
  }
};

const submitMessFeedback = async (req, res) => {
  try {
    const { vote } = req.body;
    if (!["up", "down"].includes(vote)) {
      return res.status(400).json({
        success: false,
        message: "vote must be 'up' or 'down'.",
      });
    }

    const hostelRecord = await HostelStudent.findOne({
      studentId: req.user.userId,
    }).select("hostelOwnerId propertyId");

    if (!hostelRecord) {
      return res.status(404).json({
        success: false,
        message: "Hostel mapping not found for this student.",
      });
    }

    const dateKey = getDateKey();
    const feedback = await MessFeedback.findOneAndUpdate(
      {
        studentId: req.user.userId,
        dateKey,
      },
      {
        $set: {
          hostelOwnerId: hostelRecord.hostelOwnerId,
          propertyId: hostelRecord.propertyId,
          vote,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Mess feedback saved.",
      feedback,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to save mess feedback.",
      error: error.message,
    });
  }
};

const getMessFeedbackSummary = async (req, res) => {
  try {
    const todayKey = getDateKey();
    const weekStartKey = getDateKey(getDateDaysAgo(6));

    const [todayRows, weeklyRows] = await Promise.all([
      MessFeedback.aggregate([
        {
          $match: {
            hostelOwnerId: new mongoose.Types.ObjectId(req.user.userId),
            dateKey: todayKey,
          },
        },
        { $group: { _id: "$vote", count: { $sum: 1 } } },
      ]),
      MessFeedback.aggregate([
        {
          $match: {
            hostelOwnerId: new mongoose.Types.ObjectId(req.user.userId),
            dateKey: { $gte: weekStartKey, $lte: todayKey },
          },
        },
        { $group: { _id: "$vote", count: { $sum: 1 } } },
      ]),
    ]);

    const toCountMap = (rows) =>
      rows.reduce((acc, row) => {
        if (row?._id) acc[row._id] = row.count;
        return acc;
      }, {});

    const today = toCountMap(todayRows);
    const weekly = toCountMap(weeklyRows);

    return res.status(200).json({
      success: true,
      today: {
        up: today.up || 0,
        down: today.down || 0,
        total: (today.up || 0) + (today.down || 0),
      },
      weekly: {
        up: weekly.up || 0,
        down: weekly.down || 0,
        total: (weekly.up || 0) + (weekly.down || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch mess feedback summary.",
      error: error.message,
    });
  }
};

const createHostelBroadcast = async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Broadcast message is required.",
      });
    }

    const hostelRecords = await HostelStudent.find({
      hostelOwnerId: req.user.userId,
    }).populate("studentId", "name email phone roleDetails studentCode");

    const studentIds = [
      ...new Set(hostelRecords.map((item) => String(item.studentId?._id || "")).filter(Boolean)),
    ];

    const parentIds = new Set();
    for (const record of hostelRecords) {
      if (!record.studentId) continue;
      // Parent mapping is dynamic from childReference linking.
      const linkedParents = await getLinkedParents(record.studentId);
      linkedParents.forEach((parent) => parentIds.add(String(parent._id)));
    }

    const payload = [
      ...studentIds.map((userId) => ({
        userId,
        title: "Hostel Broadcast",
        message,
        type: "hostel_broadcast",
        meta: { senderRole: "hostel_owner" },
      })),
      ...[...parentIds].map((userId) => ({
        userId,
        title: "Hostel Update for Your Child",
        message,
        type: "hostel_broadcast",
        meta: { senderRole: "hostel_owner" },
      })),
    ];

    await createBulkNotifications(payload);

    const broadcast = await HostelBroadcast.create({
      hostelOwnerId: req.user.userId,
      message,
      studentRecipientCount: studentIds.length,
      parentRecipientCount: parentIds.size,
    });

    return res.status(201).json({
      success: true,
      message: "Broadcast sent successfully.",
      broadcast,
      recipients: {
        students: studentIds.length,
        parents: parentIds.size,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send broadcast.",
      error: error.message,
    });
  }
};

module.exports = {
  addHostelStudent,
  getHostelStudents,
  markAttendance,
  getAttendance,
  upsertMessSchedule,
  getMessSchedule,
  createOutpassRequest,
  getOutpassRequests,
  approveOutpass,
  rejectOutpass,
  submitMessFeedback,
  getMessFeedbackSummary,
  createHostelBroadcast,
};
