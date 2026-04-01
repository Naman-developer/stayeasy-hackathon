const Complaint = require("../models/Complaint");

const ESCALATION_HOURS = 48;

const escalateOldComplaints = async () => {
  const threshold = new Date(Date.now() - ESCALATION_HOURS * 60 * 60 * 1000);

  await Complaint.updateMany(
    {
      status: { $in: ["open", "in_progress"] },
      createdAt: { $lte: threshold },
    },
    {
      $set: { status: "escalated" },
    }
  );
};

module.exports = {
  ESCALATION_HOURS,
  escalateOldComplaints,
};
