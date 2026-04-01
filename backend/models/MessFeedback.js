const mongoose = require("mongoose");

const messFeedbackSchema = new mongoose.Schema(
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
    dateKey: {
      type: String,
      required: true,
      trim: true,
    },
    vote: {
      type: String,
      enum: ["up", "down"],
      required: true,
    },
  },
  { timestamps: true }
);

messFeedbackSchema.index({ studentId: 1, dateKey: 1 }, { unique: true });
messFeedbackSchema.index({ hostelOwnerId: 1, dateKey: 1 });

module.exports = mongoose.model("MessFeedback", messFeedbackSchema);
