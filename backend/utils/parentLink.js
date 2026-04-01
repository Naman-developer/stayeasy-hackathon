const User = require("../models/User");

const normalize = (value) => String(value || "").trim().toLowerCase();

const isParentLinkedToStudent = (parentUser, studentUser) => {
  if (!parentUser || !studentUser || parentUser.role !== "parent") {
    return false;
  }

  const childReference = normalize(parentUser.roleDetails?.childReference);
  if (!childReference) {
    return false;
  }

  const candidates = [
    studentUser._id?.toString(),
    studentUser.studentCode,
    studentUser.email,
    studentUser.phone,
    studentUser.name,
  ]
    .filter(Boolean)
    .map((item) => normalize(item));

  return candidates.includes(childReference);
};

const getLinkedParents = async (studentUser) => {
  if (!studentUser) return [];

  const parents = await User.find({ role: "parent" });
  return parents.filter((parent) => isParentLinkedToStudent(parent, studentUser));
};

module.exports = {
  isParentLinkedToStudent,
  getLinkedParents,
};
