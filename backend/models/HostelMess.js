const mongoose = require("mongoose");

const hostelMessSchema = new mongoose.Schema(
  {
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
    weeklyMenu: {
      type: [
        {
          day: { type: String, required: true, trim: true },
          breakfast: { type: String, default: "" },
          lunch: { type: String, default: "" },
          dinner: { type: String, default: "" },
        },
      ],
      default: [],
    },
    rules: {
      type: String,
      default: "",
      trim: true,
    },
    timings: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

hostelMessSchema.index({ hostelOwnerId: 1, propertyId: 1 }, { unique: true });

module.exports = mongoose.model("HostelMess", hostelMessSchema);
