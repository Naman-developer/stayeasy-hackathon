const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    serviceType: {
      type: String,
      enum: ["maid", "cook", "sweeper", "electrician", "plumber", "cleaner"],
      required: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    charges: {
      type: Number,
      required: true,
      min: 0,
    },
    availability: {
      type: String,
      enum: ["available", "online", "offline", "unavailable"],
      default: "available",
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalJobs: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Worker", workerSchema);
