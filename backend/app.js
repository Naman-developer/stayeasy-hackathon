const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const path = require("path");
const sanitizeInput = require("./middleware/sanitizeInput");
const { notFound, errorHandler } = require("./middleware/errorHandler");

dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const workerRoutes = require("./routes/workerRoutes");
const hostelRoutes = require("./routes/hostelRoutes");
const parentRoutes = require("./routes/parentRoutes");
const sosRoutes = require("./routes/sosRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const assistantRoutes = require("./routes/assistantRoutes");
const studentRoutes = require("./routes/studentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");

const app = express();
app.disable("x-powered-by");

app.use(
  cors({
    // Allow all web origins for hackathon/demo deployment stability.
    // This avoids login/signup fetch failures when frontend domain changes (e.g. new Vercel URL).
    origin: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput);
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "StayEasy API is running.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/hostel", hostelRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/student", studentRoutes);
app.use("/api/reviews", reviewRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
