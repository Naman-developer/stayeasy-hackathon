const dotenv = require("dotenv");
const path = require("path");
const app = require("./app");
const connectDB = require("./config/db");
const User = require("./models/User");
const { backfillMissingStudentCodes } = require("./utils/studentCode");

dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  try {
    const updatedCount = await backfillMissingStudentCodes(User);
    if (updatedCount > 0) {
      console.log(`Assigned student codes to ${updatedCount} existing student account(s).`);
    }
  } catch (error) {
    console.warn("Student code backfill skipped:", error.message);
  }

  app.listen(PORT, () => {
    console.log(`StayEasy backend running on port ${PORT}`);
  });
};

startServer();
