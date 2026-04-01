const mongoose = require("mongoose");

const outpassRequestSchema = new mongoose.Schema(
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
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    parentApproval: {
      type: Boolean,
      default: false,
    },
    parentReviewedAt: {
      type: Date,
    },
    reviewedByHostelAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OutpassRequest", outpassRequestSchema);
