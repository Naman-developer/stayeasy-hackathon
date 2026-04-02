const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const connectDB = require("./config/db");
const User = require("./models/User");
const Property = require("./models/Property");
const Booking = require("./models/Booking");
const Payment = require("./models/Payment");
const Worker = require("./models/Worker");
const WorkerBooking = require("./models/WorkerBooking");
const HostelStudent = require("./models/HostelStudent");
const HostelMess = require("./models/HostelMess");
const OutpassRequest = require("./models/OutpassRequest");
const Complaint = require("./models/Complaint");
const SosAlert = require("./models/SosAlert");
const Notification = require("./models/Notification");
const { formatStudentCode } = require("./utils/studentCode");

dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const DEMO_PASSWORD = "StayEasy@123";
const TOTAL_RECORDS = 25;
const OWNER_ROLES = ["flat_owner", "pg_owner", "hostel_owner"];
const CUSTOMER_ROLES = ["student", "tenant"];

const ROLE_PLAN = [
  { role: "flat_owner", count: 3 },
  { role: "pg_owner", count: 3 },
  { role: "hostel_owner", count: 3 },
  { role: "student", count: 5 },
  { role: "tenant", count: 3 },
  { role: "parent", count: 2 },
  { role: "worker", count: 3 },
];

const CITIES = ["Delhi", "Noida", "Gurugram", "Ghaziabad", "Faridabad"];
const PROPERTY_TYPES = ["hostel", "pg", "flat", "room", "hotel"];
const WORKER_SERVICES = ["maid", "cook", "sweeper", "electrician", "plumber", "cleaner"];
const COMPLAINT_CATEGORIES = ["maintenance", "payment", "behavior", "service", "mess", "cleanliness"];

const AMENITIES_BY_TYPE = {
  hostel: ["wifi", "mess", "cctv", "warden", "laundry"],
  pg: ["wifi", "food", "housekeeping", "security"],
  flat: ["parking", "lift", "power_backup", "water_supply"],
  room: ["wifi", "fan", "cupboard", "attached_bathroom"],
  hotel: ["ac", "room_service", "wifi", "cleaning"],
};

const IMAGES_BY_TYPE = {
  hostel:
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
  pg: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
  flat: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
  room: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  hotel:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const pickByIndex = (arr, index) => arr[index % arr.length];

const buildUsers = (hashedPassword) => {
  const users = [];
  const studentEmails = [];
  const roleCounters = {};
  let studentCodeCounter = 1;
  let serial = 1;

  ROLE_PLAN.forEach(({ role, count }) => {
    roleCounters[role] = 0;

    for (let i = 0; i < count; i += 1) {
      roleCounters[role] += 1;
      const roleShort = role.replace(/_/g, "");
      const roleIndex = roleCounters[role];
      const city = pickByIndex(CITIES, serial + i);
      const email = `${roleShort}${roleIndex}@demo.stayeasy.com`;
      const phone = String(9100000000 + serial);
      const name = `${capitalize(role.replace(/_/g, " "))} ${roleIndex}`;
      const createdAt = new Date(Date.now() - (serial + 5) * 24 * 60 * 60 * 1000);
      const lastLoginAt = new Date(Date.now() - (serial % 5) * 60 * 60 * 1000);

      const roleDetails = {
        businessName: "",
        propertyInfo: "",
        childReference: "",
        serviceCategory: "",
        preference: "",
      };

      if (OWNER_ROLES.includes(role)) {
        roleDetails.propertyInfo = `${capitalize(role.replace(/_/g, " "))} listing manager`;
      }
      if (role === "hostel_owner") {
        roleDetails.businessName = `SafeNest Hostel Group ${roleIndex}`;
      }
      if (role === "worker") {
        roleDetails.serviceCategory = pickByIndex(WORKER_SERVICES, roleIndex);
      }
      if (role === "student" || role === "tenant") {
        roleDetails.preference = role === "student" ? "safe hostel near coaching" : "brokerage free flat";
      }

      users.push({
        name,
        email,
        phone,
        password: hashedPassword,
        role,
        ...(role === "student"
          ? { studentCode: formatStudentCode(studentCodeCounter) }
          : {}),
        city,
        isVerified: true,
        isPriorityMember: role === "tenant" ? roleIndex % 2 === 1 : false,
        createdAt,
        lastLoginAt,
        roleDetails,
      });

      if (role === "student") {
        studentEmails.push(email);
        studentCodeCounter += 1;
      }

      serial += 1;
    }
  });

  let parentPointer = 0;
  users.forEach((user) => {
    if (user.role === "parent" && studentEmails.length) {
      user.roleDetails.childReference = studentEmails[parentPointer % studentEmails.length];
      parentPointer += 1;
    }
  });

  return users;
};

const seed = async () => {
  try {
    await connectDB();

    await Promise.all([
      Notification.deleteMany({}),
      SosAlert.deleteMany({}),
      Complaint.deleteMany({}),
      OutpassRequest.deleteMany({}),
      HostelMess.deleteMany({}),
      HostelStudent.deleteMany({}),
      WorkerBooking.deleteMany({}),
      Worker.deleteMany({}),
      Payment.deleteMany({}),
      Booking.deleteMany({}),
      Property.deleteMany({}),
      User.deleteMany({ role: { $ne: "admin" } }),
    ]);

    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
    const userPayload = buildUsers(hashedPassword);
    const insertedUsers = await User.insertMany(userPayload);

    const usersByRole = insertedUsers.reduce((acc, user) => {
      if (!acc[user.role]) acc[user.role] = [];
      acc[user.role].push(user);
      return acc;
    }, {});

    const ownerUsers = OWNER_ROLES.flatMap((role) => usersByRole[role] || []);
    const customerUsers = CUSTOMER_ROLES.flatMap((role) => usersByRole[role] || []);
    const hostelOwnerUsers = usersByRole.hostel_owner || [];
    const studentUsers = usersByRole.student || [];

    const propertyPayload = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
      const owner = ownerUsers[index % ownerUsers.length];
      let propertyType = pickByIndex(PROPERTY_TYPES, index);

      if (owner.role === "hostel_owner") propertyType = index % 2 === 0 ? "hostel" : "pg";
      if (owner.role === "pg_owner") propertyType = "pg";
      if (owner.role === "flat_owner") propertyType = index % 2 === 0 ? "flat" : "room";

      const priceType = propertyType === "hotel" ? (index % 2 === 0 ? "daily" : "hourly") : "monthly";
      const status = index % 8 === 0 ? "pending" : index % 11 === 0 ? "rejected" : "approved";
      const priceBase = propertyType === "hotel" ? 1800 : 6500;
      const price = priceBase + index * 450;

      return {
        title: `${capitalize(propertyType)} Listing ${index + 1}`,
        description: `Demo ${propertyType} listing ${index + 1} for StayEasy marketplace testing.`,
        propertyType,
        city: owner.city || pickByIndex(CITIES, index),
        address: `${120 + index}, Demo Street, ${owner.city || "Delhi"}`,
        price,
        priceType,
        images: [IMAGES_BY_TYPE[propertyType]],
        amenities: AMENITIES_BY_TYPE[propertyType],
        ownerId: owner._id,
        status,
        occupancy: (index % 4) + 1,
        genderPreference: index % 3 === 0 ? "female" : index % 3 === 1 ? "male" : "any",
        isVerified: status === "approved",
        rating: status === "approved" ? Number((3.5 + (index % 2) * 0.7).toFixed(1)) : 0,
        totalReviews: status === "approved" ? 5 + (index % 10) : 0,
        manualTotalRooms: 5 + (index % 6),
        manualFilledRooms: 2 + (index % 4),
        isFeatured: index % 9 === 0,
        featuredAt: index % 9 === 0 ? new Date(Date.now() - index * 24 * 60 * 60 * 1000) : null,
        createdAt: new Date(Date.now() - (35 - index) * 24 * 60 * 60 * 1000),
      };
    });

    const insertedProperties = await Property.insertMany(propertyPayload);
    const approvedProperties = insertedProperties.filter((item) => item.status === "approved");

    const bookingPayload = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
      const customer = customerUsers[index % customerUsers.length];
      const property = approvedProperties[index % approvedProperties.length] || insertedProperties[index % insertedProperties.length];
      const checkInDate = new Date(Date.now() + (index + 3) * 24 * 60 * 60 * 1000);
      const checkOutDate = new Date(checkInDate.getTime() + (20 + (index % 10)) * 24 * 60 * 60 * 1000);
      const status = index % 7 === 0 ? "cancelled" : index % 3 === 0 ? "pending" : "confirmed";

      let paymentStatus = "unpaid";
      if (status === "confirmed") paymentStatus = "paid";
      if (status === "cancelled") paymentStatus = "refunded";
      if (status === "pending" && index % 4 === 0) paymentStatus = "failed";

      const amount = Number((property.price * (property.priceType === "monthly" ? 1 : 2)).toFixed(0));
      const orderId = paymentStatus === "paid" ? `order_seed_${String(index + 1).padStart(3, "0")}` : "";
      const paymentId = paymentStatus === "paid" ? `pay_seed_${String(index + 1).padStart(3, "0")}` : "";

      return {
        userId: customer._id,
        propertyId: property._id,
        ownerId: property.ownerId,
        checkInDate,
        checkOutDate,
        amount,
        status,
        paymentStatus,
        paymentOrderId: orderId,
        paymentId,
        createdAt: new Date(Date.now() - (index + 2) * 24 * 60 * 60 * 1000),
      };
    });

    const insertedBookings = await Booking.insertMany(bookingPayload);

    const paymentPayload = insertedBookings.map((booking, index) => {
      let status = "created";
      if (booking.paymentStatus === "paid") status = "paid";
      if (booking.paymentStatus === "failed") status = "failed";

      return {
        userId: booking.userId,
        bookingId: booking._id,
        amount: booking.amount,
        method: "mock",
        paymentGateway: "mock_gateway",
        orderId: booking.paymentOrderId || `order_seed_open_${String(index + 1).padStart(3, "0")}`,
        paymentId: booking.paymentId || "",
        status,
        createdAt: booking.createdAt,
      };
    });

    const insertedPayments = await Payment.insertMany(paymentPayload);

    const workerPayload = insertedUsers.map((user, index) => ({
      userId: user._id,
      serviceType: pickByIndex(WORKER_SERVICES, index),
      city: user.city,
      charges: 350 + index * 110,
      availability: index % 2 === 0 ? "available" : "busy until evening",
      verificationStatus: index % 3 === 0 ? "verified" : "pending",
      rating: Number((4 + (index % 2) * 0.6).toFixed(1)),
      totalJobs: 6 + index * 2,
      createdAt: new Date(Date.now() - (index + 4) * 24 * 60 * 60 * 1000),
    }));

    const insertedWorkers = await Worker.insertMany(workerPayload);

    const workerBookingPayload = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
      const customer = customerUsers[index % customerUsers.length];
      const worker = insertedWorkers[index % insertedWorkers.length];
      const amount = worker.charges + (index % 3) * 100;
      const commissionRate = 0.16;
      const commission = Number((amount * commissionRate).toFixed(0));
      const finalWorkerAmount = amount - commission;
      const status = index % 6 === 0 ? "cancelled" : index % 3 === 0 ? "completed" : "confirmed";

      return {
        customerId: customer._id,
        workerId: worker._id,
        serviceType: worker.serviceType,
        date: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000),
        time: `${String(9 + (index % 8)).padStart(2, "0")}:00`,
        amount,
        commission,
        finalWorkerAmount,
        cancellationFee: status === "cancelled" ? 80 : 0,
        status,
        paymentStatus: status === "cancelled" ? "refunded" : "paid",
        bookingPriority: index % 4 === 0,
        createdAt: new Date(Date.now() - (index + 3) * 24 * 60 * 60 * 1000),
      };
    });

    const insertedWorkerBookings = await WorkerBooking.insertMany(workerBookingPayload);

    const hostelProperties = insertedProperties.filter((property) => {
      if (property.propertyType !== "hostel" && property.propertyType !== "pg") return false;
      return hostelOwnerUsers.some((owner) => String(owner._id) === String(property.ownerId));
    });

    const hostelStudentPayload = [];
    const usedHostelKeys = new Set();

    let hostelStudentIndex = 0;
    while (hostelStudentPayload.length < TOTAL_RECORDS && hostelProperties.length && studentUsers.length) {
      const student = studentUsers[hostelStudentIndex % studentUsers.length];
      const property = hostelProperties[hostelStudentIndex % hostelProperties.length];
      const hostelOwner = hostelOwnerUsers.find((owner) => String(owner._id) === String(property.ownerId));

      if (!hostelOwner) {
        hostelStudentIndex += 1;
        continue;
      }

      const uniqueKey = `${student._id}_${hostelOwner._id}_${property._id}`;
      if (!usedHostelKeys.has(uniqueKey)) {
        usedHostelKeys.add(uniqueKey);

        hostelStudentPayload.push({
          studentId: student._id,
          hostelOwnerId: hostelOwner._id,
          propertyId: property._id,
          roomNumber: `R-${100 + hostelStudentPayload.length}`,
          feeStatus: hostelStudentPayload.length % 3 === 0 ? "paid" : hostelStudentPayload.length % 3 === 1 ? "pending" : "overdue",
          messPlan: hostelStudentPayload.length % 2 === 0 ? "Standard Veg Plan" : "High Protein Plan",
          inOutLogs: [
            {
              type: "out",
              time: new Date(Date.now() - (hostelStudentPayload.length + 1) * 60 * 60 * 1000),
              note: "Library",
            },
            {
              type: "in",
              time: new Date(Date.now() - hostelStudentPayload.length * 60 * 60 * 1000),
              note: "Returned",
            },
          ],
          attendanceLogs: [
            {
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              status: hostelStudentPayload.length % 4 === 0 ? "late" : "present",
            },
            {
              date: new Date(Date.now() - 24 * 60 * 60 * 1000),
              status: hostelStudentPayload.length % 5 === 0 ? "absent" : "present",
            },
          ],
          createdAt: new Date(Date.now() - (hostelStudentPayload.length + 6) * 24 * 60 * 60 * 1000),
        });
      }

      hostelStudentIndex += 1;
      if (hostelStudentIndex > 400) break;
    }

    const insertedHostelStudents = hostelStudentPayload.length
      ? await HostelStudent.insertMany(hostelStudentPayload)
      : [];

    const messPayload = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
      const property = insertedProperties[index % insertedProperties.length];
      const hostelOwner = hostelOwnerUsers[index % hostelOwnerUsers.length];

      return {
        hostelOwnerId: hostelOwner._id,
        propertyId: property._id,
        weeklyMenu: [
          { day: "Monday", breakfast: "Poha", lunch: "Dal Rice", dinner: "Paneer Roti" },
          { day: "Tuesday", breakfast: "Upma", lunch: "Rajma Rice", dinner: "Veg Pulao" },
          { day: "Wednesday", breakfast: "Idli", lunch: "Chole Rice", dinner: "Mix Veg Roti" },
        ],
        rules: "Entry before 10 PM. Keep common areas clean.",
        timings: `Breakfast 8 AM, Lunch 1 PM, Dinner ${8 + (index % 2)} PM`,
        createdAt: new Date(Date.now() - (index + 5) * 24 * 60 * 60 * 1000),
      };
    });

    const insertedMess = messPayload.length ? await HostelMess.insertMany(messPayload) : [];

    const outpassPayload = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
      const hostelRecord = insertedHostelStudents[index % insertedHostelStudents.length];
      const status = index % 4 === 0 ? "approved" : index % 5 === 0 ? "rejected" : "pending";

      return {
        studentId: hostelRecord.studentId,
        hostelOwnerId: hostelRecord.hostelOwnerId,
        reason: `Outpass request ${index + 1} for coaching/class visit.`,
        status,
        parentApproval: index % 3 !== 0,
        parentReviewedAt: index % 3 !== 0 ? new Date(Date.now() - index * 60 * 60 * 1000) : null,
        reviewedByHostelAt: status !== "pending" ? new Date(Date.now() - index * 30 * 60 * 1000) : null,
        createdAt: new Date(Date.now() - (index + 2) * 24 * 60 * 60 * 1000),
      };
    });

    const insertedOutpass = insertedHostelStudents.length
      ? await OutpassRequest.insertMany(outpassPayload)
      : [];

    const complaintPayload = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
      const raisedBy = insertedUsers[index % insertedUsers.length];
      const target = insertedUsers[(index + 5) % insertedUsers.length];
      const property = insertedProperties[index % insertedProperties.length];
      const status = index % 6 === 0 ? "escalated" : index % 3 === 0 ? "in_progress" : index % 2 === 0 ? "resolved" : "open";

      return {
        userId: raisedBy._id,
        targetUserId: target._id,
        propertyId: property._id,
        category: pickByIndex(COMPLAINT_CATEGORIES, index),
        message: `Demo complaint ${index + 1}: issue raised for ${property.title}.`,
        response: status === "resolved" || status === "in_progress" ? "We are reviewing and taking action." : "",
        status,
        resolvedAt: status === "resolved" ? new Date(Date.now() - index * 60 * 60 * 1000) : null,
        createdAt: new Date(Date.now() - (index + 7) * 24 * 60 * 60 * 1000),
      };
    });

    const insertedComplaints = await Complaint.insertMany(complaintPayload);

    const sosPayload = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
      const user = customerUsers[index % customerUsers.length];
      return {
        userId: user._id,
        latitude: 28.45 + index * 0.01,
        longitude: 77.05 + index * 0.01,
        createdAt: new Date(Date.now() - index * 5 * 60 * 1000),
      };
    });

    const insertedSosAlerts = await SosAlert.insertMany(sosPayload);

    const notificationPayload = Array.from({ length: TOTAL_RECORDS }, (_, index) => {
      const user = insertedUsers[index % insertedUsers.length];
      const booking = insertedBookings[index % insertedBookings.length];
      const complaint = insertedComplaints[index % insertedComplaints.length];
      const sos = insertedSosAlerts[index % insertedSosAlerts.length];

      return {
        userId: user._id,
        title: `Demo alert ${index + 1}`,
        message: `Booking ${String(booking._id).slice(-6).toUpperCase()} update and complaint follow-up.`,
        type: index % 4 === 0 ? "sos" : index % 3 === 0 ? "complaint" : "booking",
        isRead: index % 2 === 0,
        meta: {
          bookingId: booking._id,
          complaintId: complaint._id,
          sosId: sos._id,
        },
        createdAt: new Date(Date.now() - index * 20 * 60 * 1000),
      };
    });

    const insertedNotifications = await Notification.insertMany(notificationPayload);

    const credentials = insertedUsers
      .map((user) => ({
        role: user.role,
        name: user.name,
        ...(user.role === "student" ? { studentCode: user.studentCode || "" } : {}),
        email: user.email,
        phone: user.phone,
        password: DEMO_PASSWORD,
      }))
      .sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));

    const credentialsPath = path.join(__dirname, "demo-credentials.json");
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), "utf8");

    console.log("StayEasy demo seed complete (NON-ADMIN dataset).");
    console.log("Common password for all seeded accounts:", DEMO_PASSWORD);
    console.log("Credentials exported to:", credentialsPath);
    console.log("Counts:");
    console.table({
      users_non_admin: insertedUsers.length,
      properties: insertedProperties.length,
      bookings: insertedBookings.length,
      payments: insertedPayments.length,
      workers: insertedWorkers.length,
      worker_bookings: insertedWorkerBookings.length,
      hostel_students: insertedHostelStudents.length,
      hostel_mess: insertedMess.length,
      outpass_requests: insertedOutpass.length,
      complaints: insertedComplaints.length,
      sos_alerts: insertedSosAlerts.length,
      notifications: insertedNotifications.length,
    });
    console.table(credentials);

    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
};

seed();
