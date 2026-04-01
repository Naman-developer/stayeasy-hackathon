const mongoose = require("mongoose");

const hostelBroadcastSchema = new mongoose.Schema(
  {
    hostelOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    studentRecipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    parentRecipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HostelBroadcast", hostelBroadcastSchema);
