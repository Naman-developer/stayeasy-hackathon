const STUDENT_CODE_PREFIX = "STU";
const STUDENT_CODE_PATTERN = /^STU\d{4,}$/;

const normalizeStudentCode = (value = "") =>
  String(value).trim().toUpperCase();

const isStudentCode = (value = "") =>
  STUDENT_CODE_PATTERN.test(normalizeStudentCode(value));

const parseStudentCodeSequence = (value = "") => {
  const normalized = normalizeStudentCode(value);
  if (!isStudentCode(normalized)) return 0;
  return Number(normalized.slice(STUDENT_CODE_PREFIX.length)) || 0;
};

const formatStudentCode = (sequence = 0) =>
  `${STUDENT_CODE_PREFIX}${String(sequence).padStart(4, "0")}`;

const getNextStudentCode = async (UserModel) => {
  const students = await UserModel.find({
    role: "student",
    studentCode: { $exists: true, $ne: "" },
  })
    .select("studentCode")
    .lean();

  const maxSequence = students.reduce((max, student) => {
    const current = parseStudentCodeSequence(student.studentCode);
    return current > max ? current : max;
  }, 0);

  let nextSequence = maxSequence + 1;
  let candidate = formatStudentCode(nextSequence);

  while (await UserModel.exists({ studentCode: candidate })) {
    nextSequence += 1;
    candidate = formatStudentCode(nextSequence);
  }

  return candidate;
};

const backfillMissingStudentCodes = async (UserModel) => {
  const studentsWithoutCode = await UserModel.find({
    role: "student",
    $or: [{ studentCode: { $exists: false } }, { studentCode: "" }],
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id")
    .lean();

  let updatedCount = 0;
  for (const student of studentsWithoutCode) {
    const studentCode = await getNextStudentCode(UserModel);
    await UserModel.updateOne(
      { _id: student._id },
      { $set: { studentCode } }
    );
    updatedCount += 1;
  }

  return updatedCount;
};

module.exports = {
  normalizeStudentCode,
  isStudentCode,
  formatStudentCode,
  getNextStudentCode,
  backfillMissingStudentCodes,
};
