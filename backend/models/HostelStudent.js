const mongoose = require("mongoose");

const attendanceLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["present", "absent", "late"],
      default: "present",
    },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const inOutLogSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["in", "out"], required: true },
    time: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const hostelStudentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostelOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    roomNumber: {
      type: String,
      required: true,
      trim: true,
    },
    inOutLogs: {
      type: [inOutLogSchema],
      default: [],
    },
    attendanceLogs: {
      type: [attendanceLogSchema],
      default: [],
    },
    feeStatus: {
      type: String,
      enum: ["paid", "pending", "overdue"],
      default: "pending",
    },
    messPlan: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

hostelStudentSchema.index({ studentId: 1, hostelOwnerId: 1, propertyId: 1 }, { unique: true });

module.exports = mongoose.model("HostelStudent", hostelStudentSchema);
