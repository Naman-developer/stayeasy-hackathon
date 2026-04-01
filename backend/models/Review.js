const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewerName: {
      type: String,
      required: true,
      trim: true,
    },
    reviewerRole: {
      type: String,
      enum: ["student", "tenant", "parent"],
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    visibility: {
      type: String,
      enum: ["public", "hidden"],
      default: "public",
    },
  },
  { timestamps: true }
);

reviewSchema.index({ visibility: 1, createdAt: -1 });
reviewSchema.index({ reviewerId: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
