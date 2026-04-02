const Worker = require("../models/Worker");
const WorkerBooking = require("../models/WorkerBooking");
const User = require("../models/User");
const { createNotification } = require("../utils/notify");

const PLATFORM_COMMISSION_RATE = 0.16;
const PRIORITY_COMMISSION_RATE = 0.15;
const OPEN_AVAILABILITY_VALUES = new Set(["available", "online"]);
const CLOSED_AVAILABILITY_VALUES = new Set(["offline", "unavailable"]);
const IMAGE_URL_REGEX = /^https?:\/\/\S+$/i;
const IMAGE_DATA_URI_REGEX = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i;
const toLocalDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeAvailability = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) return "available";
  if (OPEN_AVAILABILITY_VALUES.has(normalized)) return normalized;
  if (CLOSED_AVAILABILITY_VALUES.has(normalized)) return normalized;
  return null;
};

const normalizeProfileImage = (value) => {
  if (value === undefined || value === null) return undefined;

  const normalized = String(value).trim();
  if (!normalized) return "";
  if (IMAGE_URL_REGEX.test(normalized) || IMAGE_DATA_URI_REGEX.test(normalized)) {
    return normalized;
  }
  return null;
};

const calculateCommissionBreakdown = (amount, isPriorityMember) => {
  const rate = isPriorityMember
    ? PRIORITY_COMMISSION_RATE
    : PLATFORM_COMMISSION_RATE;
  const commission = Math.round(amount * rate);
  const finalWorkerAmount = Math.max(amount - commission, 0);
  return { commission, finalWorkerAmount, rate };
};

const registerWorker = async (req, res) => {
  try {
    const { serviceType, city, charges, availability, profileImage } = req.body;

    if (!serviceType || !city || charges === undefined) {
      return res.status(400).json({
        success: false,
        message: "serviceType, city, and charges are required.",
      });
    }

    const parsedCharges = Number(charges);
    if (!Number.isFinite(parsedCharges) || parsedCharges < 0) {
      return res.status(400).json({
        success: false,
        message: "charges must be a valid non-negative number.",
      });
    }

    const normalizedAvailability = normalizeAvailability(availability);
    if (!normalizedAvailability) {
      return res.status(400).json({
        success: false,
        message: "availability must be online, offline, available, or unavailable.",
      });
    }

    const normalizedProfileImage = normalizeProfileImage(profileImage);
    if (normalizedProfileImage === null) {
      return res.status(400).json({
        success: false,
        message: "profileImage must be a valid http(s) URL or image data URL.",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Worker user account not found.",
      });
    }

    if (normalizedProfileImage !== undefined) {
      user.profileImage = normalizedProfileImage;
      await user.save();
    }

    const payload = {
      serviceType,
      city: city.trim(),
      charges: parsedCharges,
      availability: normalizedAvailability,
    };

    let worker = await Worker.findOne({ userId: req.user.userId });
    if (worker) {
      worker.serviceType = payload.serviceType;
      worker.city = payload.city;
      worker.charges = payload.charges;
      worker.availability = payload.availability;
      await worker.save();
    } else {
      worker = await Worker.create({
        userId: req.user.userId,
        ...payload,
        verificationStatus: "pending",
      });
    }

    const populatedWorker = await Worker.findById(worker._id).populate(
      "userId",
      "name email phone city profileImage isPriorityMember"
    );

    return res.status(200).json({
      success: true,
      message: "Worker profile saved successfully.",
      worker: populatedWorker,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to register worker profile.",
      error: error.message,
    });
  }
};

const getWorkers = async (req, res) => {
  try {
    const { city, type } = req.query;

    const query = {
      verificationStatus: { $in: ["verified", "pending"] },
      availability: { $in: [...OPEN_AVAILABILITY_VALUES] },
    };

    if (city) {
      query.city = { $regex: city.trim(), $options: "i" };
    }

    if (type) {
      query.serviceType = type;
    }

    const workers = await Worker.find(query)
      .sort({ rating: -1, createdAt: -1 })
      .populate("userId", "name email phone city profileImage isPriorityMember");

    return res.status(200).json({
      success: true,
      count: workers.length,
      workers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch workers.",
      error: error.message,
    });
  }
};

const bookWorker = async (req, res) => {
  try {
    const { workerId, serviceType, date, time, amount } = req.body;

    if (!workerId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "workerId, date and time are required.",
      });
    }

    const worker = await Worker.findById(workerId).populate("userId", "name");
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found.",
      });
    }

    const workerAvailability = normalizeAvailability(worker.availability);
    if (!workerAvailability || !OPEN_AVAILABILITY_VALUES.has(workerAvailability)) {
      return res.status(400).json({
        success: false,
        message: "Worker is currently offline/unavailable. Please try another helper.",
      });
    }

    if (String(worker.userId._id) === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot book yourself as a worker.",
      });
    }

    const customer = await User.findById(req.user.userId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer account not found.",
      });
    }

    const totalAmount = Number(amount || worker.charges);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid amount.",
      });
    }

    const { commission, finalWorkerAmount, rate } = calculateCommissionBreakdown(
      totalAmount,
      customer.isPriorityMember
    );

    const booking = await WorkerBooking.create({
      customerId: customer._id,
      workerId: worker._id,
      serviceType: serviceType || worker.serviceType,
      date: new Date(date),
      time,
      amount: totalAmount,
      commission,
      finalWorkerAmount,
      status: customer.isPriorityMember ? "confirmed" : "pending",
      paymentStatus: "paid",
      bookingPriority: Boolean(customer.isPriorityMember),
    });

    const populatedBooking = await WorkerBooking.findById(booking._id)
      .populate("customerId", "name email phone isPriorityMember")
      .populate({
        path: "workerId",
        populate: { path: "userId", select: "name email phone city" },
      });

    await Promise.all([
      createNotification({
        userId: customer._id,
        title: "Worker Booking Confirmed",
        message: `Your helper booking with ${
          worker.userId?.name || "worker"
        } is ${booking.status}.`,
        type: "worker_booking",
        meta: { workerBookingId: booking._id },
      }),
      createNotification({
        userId: worker.userId._id,
        title: "New Service Booking",
        message: `You received a new ${booking.serviceType} booking request.`,
        type: "worker_booking",
        meta: { workerBookingId: booking._id },
      }),
    ]);

    return res.status(201).json({
      success: true,
      message: customer.isPriorityMember
        ? "Priority booking confirmed quickly."
        : "Worker booking created successfully.",
      booking: populatedBooking,
      pricing: {
        totalAmount,
        commission,
        finalWorkerAmount,
        commissionRate: rate,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to book worker.",
      error: error.message,
    });
  }
};

const getMyWorkerBookings = async (req, res) => {
  try {
    let bookings = [];
    let mode = "customer";

    if (req.user.role === "worker") {
      mode = "worker";
      const workerProfile = await Worker.findOne({ userId: req.user.userId });
      if (workerProfile) {
        bookings = await WorkerBooking.find({ workerId: workerProfile._id })
          .sort({ createdAt: -1 })
          .populate("customerId", "name email phone")
          .populate({
            path: "workerId",
            populate: { path: "userId", select: "name email phone city" },
          });
      }
    } else {
      bookings = await WorkerBooking.find({ customerId: req.user.userId })
        .sort({ createdAt: -1 })
        .populate("customerId", "name email phone")
        .populate({
          path: "workerId",
          populate: { path: "userId", select: "name email phone city" },
        });
    }

    const summary = {
      total: bookings.length,
      completed: bookings.filter((item) => item.status === "completed").length,
      confirmed: bookings.filter((item) => item.status === "confirmed").length,
      pending: bookings.filter((item) => item.status === "pending").length,
      earnings: bookings
        .filter(
          (item) =>
            item.status !== "cancelled" &&
            item.paymentStatus === "paid" &&
            mode === "worker"
        )
        .reduce((sum, item) => sum + Number(item.finalWorkerAmount || 0), 0),
      spending: bookings
        .filter(
          (item) =>
            item.status !== "cancelled" &&
            item.paymentStatus === "paid" &&
            mode === "customer"
        )
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    };

    return res.status(200).json({
      success: true,
      mode,
      count: bookings.length,
      summary,
      bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch worker bookings.",
      error: error.message,
    });
  }
};

const cancelWorkerBooking = async (req, res) => {
  try {
    const booking = await WorkerBooking.findById(req.params.id).populate({
      path: "workerId",
      select: "userId",
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Worker booking not found.",
      });
    }

    const isCustomer = String(booking.customerId) === req.user.userId;
    const isWorker =
      req.user.role === "worker" &&
      booking.workerId &&
      String(booking.workerId.userId) === req.user.userId;
    const isAdmin = req.user.role === "admin";

    if (!isCustomer && !isWorker && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You cannot cancel this booking.",
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled.",
      });
    }

    const now = Date.now();
    const bookingTime = new Date(booking.date).getTime();
    const hoursLeft = (bookingTime - now) / (1000 * 60 * 60);

    let cancellationFee = 0;
    if (hoursLeft <= 6) cancellationFee = 100;
    else if (hoursLeft <= 24) cancellationFee = 50;

    booking.status = "cancelled";
    booking.cancellationFee = cancellationFee;

    if (booking.paymentStatus === "paid") {
      booking.paymentStatus = "refunded";
    }

    await booking.save();

    await Promise.all([
      createNotification({
        userId: booking.customerId,
        title: "Worker Booking Cancelled",
        message: `Worker booking ${booking._id
          .toString()
          .slice(-6)
          .toUpperCase()} was cancelled.`,
        type: "worker_booking",
        meta: { workerBookingId: booking._id, cancellationFee },
      }),
      createNotification({
        userId: booking.workerId.userId,
        title: "Service Booking Cancelled",
        message: `A service booking assigned to you was cancelled.`,
        type: "worker_booking",
        meta: { workerBookingId: booking._id, cancellationFee },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message:
        cancellationFee > 0
          ? `Booking cancelled. Cancellation fee applied: Rs ${cancellationFee}.`
          : "Booking cancelled successfully.",
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to cancel worker booking.",
      error: error.message,
    });
  }
};

const completeWorkerBooking = async (req, res) => {
  try {
    if (req.user.role !== "worker") {
      return res.status(403).json({
        success: false,
        message: "Only workers can complete jobs.",
      });
    }

    const workerProfile = await Worker.findOne({ userId: req.user.userId });
    if (!workerProfile) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found.",
      });
    }

    const booking = await WorkerBooking.findById(req.params.id);
    if (!booking || String(booking.workerId) !== String(workerProfile._id)) {
      return res.status(404).json({
        success: false,
        message: "Worker booking not found.",
      });
    }

    booking.status = "completed";
    await booking.save();

    workerProfile.totalJobs += 1;
    await workerProfile.save();

    await Promise.all([
      createNotification({
        userId: booking.customerId,
        title: "Service Completed",
        message: "Your worker service has been marked completed.",
        type: "worker_booking",
        meta: { workerBookingId: booking._id },
      }),
      createNotification({
        userId: req.user.userId,
        title: "Job Completion Recorded",
        message: "Booking marked as completed and stats updated.",
        type: "worker_booking",
        meta: { workerBookingId: booking._id },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Worker job marked as completed.",
      booking,
      worker: workerProfile,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark worker booking complete.",
      error: error.message,
    });
  }
};

const getWorkerDashboard = async (req, res) => {
  try {
    const workerProfile = await Worker.findOne({ userId: req.user.userId }).populate(
      "userId",
      "name email phone city profileImage"
    );

    if (!workerProfile) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found. Please register first.",
      });
    }

    const [bookingsRaw, customerFrequencyRows, recentEarningRows, lifetimeStatsRaw] =
      await Promise.all([
      WorkerBooking.find({ workerId: workerProfile._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("customerId", "name phone email"),
      WorkerBooking.aggregate([
        {
          $match: {
            workerId: workerProfile._id,
          },
        },
        {
          $group: {
            _id: "$customerId",
            count: { $sum: 1 },
          },
        },
      ]),
      (() => {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 6);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        return WorkerBooking.find({
          workerId: workerProfile._id,
          paymentStatus: "paid",
          status: { $ne: "cancelled" },
          createdAt: { $gte: sinceDate, $lte: endDate },
        }).select("createdAt date finalWorkerAmount amount");
      })(),
      WorkerBooking.aggregate([
        {
          $match: {
            workerId: workerProfile._id,
          },
        },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            completedJobs: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            confirmedJobs: {
              $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
            },
            totalEarnings: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$status", "cancelled"] },
                      { $eq: ["$paymentStatus", "paid"] },
                    ],
                  },
                  "$finalWorkerAmount",
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const customerFrequency = customerFrequencyRows.reduce((acc, row) => {
      acc[String(row._id)] = row.count;
      return acc;
    }, {});

    const bookings = bookingsRaw.map((bookingDoc) => {
      const booking = bookingDoc.toObject();
      const customerId = String(booking.customerId?._id || "");
      booking.isRepeatCustomer = (customerFrequency[customerId] || 0) > 1;
      return booking;
    });

    const lifetimeStats = lifetimeStatsRaw[0] || {};
    const stats = {
      totalBookings: Number(lifetimeStats.totalBookings || 0),
      completedJobs: Number(lifetimeStats.completedJobs || 0),
      confirmedJobs: Number(lifetimeStats.confirmedJobs || 0),
      totalEarnings: Number(lifetimeStats.totalEarnings || 0),
    };

    const dailyEarnings7d = [];
    const today = new Date();
    const earningsMap = {};
    for (let i = 6; i >= 0; i -= 1) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - i);
      const key = toLocalDateKey(dayDate);
      earningsMap[key] = 0;
      dailyEarnings7d.push({
        dateKey: key,
        label: dayDate.toLocaleDateString("en-IN", { weekday: "short" }),
        earnings: 0,
      });
    }

    recentEarningRows.forEach((row) => {
      const key = toLocalDateKey(row.createdAt || row.date);
      if (earningsMap[key] === undefined) return;
      const payout = Number(row.finalWorkerAmount ?? row.amount ?? 0);
      earningsMap[key] += Number.isFinite(payout) ? payout : 0;
    });

    dailyEarnings7d.forEach((item) => {
      item.earnings = earningsMap[item.dateKey] || 0;
    });

    return res.status(200).json({
      success: true,
      worker: workerProfile,
      stats,
      bookings,
      dailyEarnings7d,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch worker dashboard.",
      error: error.message,
    });
  }
};

module.exports = {
  registerWorker,
  getWorkers,
  bookWorker,
  getMyWorkerBookings,
  cancelWorkerBooking,
  completeWorkerBooking,
  getWorkerDashboard,
};
