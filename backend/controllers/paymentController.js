const crypto = require("crypto");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const { createNotification } = require("../utils/notify");

let RazorpayClient = null;
try {
  RazorpayClient = require("razorpay");
} catch (error) {
  RazorpayClient = null;
}

const generateOrderId = () => `order_${Date.now()}_${Math.floor(Math.random() * 99999)}`;
const generatePaymentId = () => `pay_${Date.now()}_${Math.floor(Math.random() * 99999)}`;

const SUPPORTED_PAYMENT_METHODS = ["upi_qr", "card", "netbanking", "wallet"];

const normalizePaymentMethod = (method) => {
  const cleaned = String(method || "")
    .trim()
    .toLowerCase();

  if (!cleaned) return "upi_qr";
  if (!SUPPORTED_PAYMENT_METHODS.includes(cleaned)) return null;
  return cleaned;
};

const buildUpiData = ({ amount, bookingId }) => {
  const upiId = String(process.env.UPI_ID || "stayeasy.demo@upi").trim();
  const bookingCode = String(bookingId).slice(-6).toUpperCase();
  const txnRef = `SE${Date.now()}`;

  const upiUri = `upi://pay?pa=${encodeURIComponent(
    upiId
  )}&pn=${encodeURIComponent("StayEasy")}&am=${encodeURIComponent(
    Number(amount || 0).toFixed(2)
  )}&cu=INR&tn=${encodeURIComponent(
    `StayEasy Booking ${bookingCode}`
  )}&tr=${encodeURIComponent(txnRef)}`;

  return { upiId, upiUri, txnRef };
};

const hasPlaceholderValue = (value = "") =>
  /replace|xxxxx|example|your_/i.test(String(value));

const isRazorpayEnabled = () => {
  if (!RazorpayClient) return false;

  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!keyId || !keySecret) return false;
  if (!/^rzp_(test|live)_/i.test(keyId)) return false;
  if (hasPlaceholderValue(keyId) || hasPlaceholderValue(keySecret)) return false;

  return true;
};

const getRazorpayInstance = () =>
  new RazorpayClient({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

const createOrder = async (req, res) => {
  try {
    const { bookingId, paymentMethod } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "bookingId is required.",
      });
    }

    const selectedMethod = normalizePaymentMethod(paymentMethod);
    if (!selectedMethod) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method selected.",
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (String(booking.userId) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only pay for your own booking.",
      });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This booking is already paid.",
      });
    }

    const useRazorpay = isRazorpayEnabled();

    let orderId = generateOrderId();
    let paymentGateway = "mock_gateway";
    let finalPaymentMethod = selectedMethod;
    let amountInPaise = Math.round(Number(booking.amount) * 100);
    let upiData = null;

    if (useRazorpay) {
      const razorpay = getRazorpayInstance();
      const gatewayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `stayeasy_${booking._id.toString().slice(-6)}_${Date.now()}`,
        notes: {
          bookingId: booking._id.toString(),
          userId: req.user.userId,
        },
      });

      orderId = gatewayOrder.id;
      paymentGateway = "razorpay";
      amountInPaise = gatewayOrder.amount;
    } else if (selectedMethod === "upi_qr") {
      upiData = buildUpiData({
        amount: booking.amount,
        bookingId: booking._id,
      });
    }

    const payment = await Payment.create({
      userId: req.user.userId,
      bookingId: booking._id,
      amount: booking.amount,
      method: finalPaymentMethod,
      paymentGateway,
      orderId,
      status: "created",
    });

    booking.paymentOrderId = orderId;
    await booking.save();

    return res.status(201).json({
      success: true,
      message: useRazorpay ? "Razorpay order created." : "Mock order created.",
      gateway: useRazorpay ? "razorpay" : "mock",
      keyId: useRazorpay ? process.env.RAZORPAY_KEY_ID : null,
      paymentMethod: finalPaymentMethod,
      order: {
        orderId,
        amount: booking.amount,
        amountInPaise,
        currency: "INR",
        bookingId: booking._id,
      },
      upiData,
      paymentId: payment._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create payment order.",
      error: error.message,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      bookingId,
      orderId,
      paymentId,
      razorpaySignature,
      paymentMethod,
      utrId,
      cardLast4,
      cardHolder,
      bankRef,
      walletRef,
    } = req.body;

    if (!bookingId || !orderId) {
      return res.status(400).json({
        success: false,
        message: "bookingId and orderId are required.",
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    if (String(booking.userId) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized payment verification request.",
      });
    }

    const payment = await Payment.findOne({
      bookingId: booking._id,
      orderId,
      userId: req.user.userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found.",
      });
    }

    if (payment.status === "paid" && booking.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified.",
        booking,
        payment,
      });
    }

    let finalPaymentId = paymentId || generatePaymentId();
    const requestedMethod = normalizePaymentMethod(paymentMethod) || payment.method;

    if (payment.paymentGateway === "razorpay") {
      if (!paymentId || !razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: "Razorpay paymentId and signature are required.",
        });
      }

      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        payment.status = "failed";
        await payment.save();
        return res.status(400).json({
          success: false,
          message: "Payment signature verification failed.",
        });
      }

      finalPaymentId = paymentId;
      payment.method = requestedMethod || "upi_qr";
      payment.paymentGateway = "razorpay";
    } else {
      payment.method = requestedMethod || payment.method || "upi_qr";

      if (payment.method === "upi_qr") {
        const cleanUtr = String(utrId || "").trim().toUpperCase();
        if (!cleanUtr) {
          return res.status(400).json({
            success: false,
            message: "Enter UTR/transaction ID after scanning QR.",
          });
        }

        if (!/^[A-Z0-9]{8,30}$/.test(cleanUtr)) {
          return res.status(400).json({
            success: false,
            message: "Invalid UTR format. Use 8-30 letters/numbers.",
          });
        }

        finalPaymentId = cleanUtr;
      } else if (payment.method === "card") {
        const cleanCardLast4 = String(cardLast4 || "").trim();
        const cleanCardHolder = String(cardHolder || "").trim();

        if (!/^\d{4}$/.test(cleanCardLast4)) {
          return res.status(400).json({
            success: false,
            message: "Invalid card reference. Re-enter card details.",
          });
        }

        if (cleanCardHolder.length < 2) {
          return res.status(400).json({
            success: false,
            message: "Card holder name is required.",
          });
        }

        finalPaymentId = `CARD${cleanCardLast4}${Date.now()}`;
      } else if (payment.method === "netbanking") {
        const cleanBankRef = String(bankRef || "").trim().toUpperCase();

        if (!/^[A-Z0-9]{6,30}$/.test(cleanBankRef)) {
          return res.status(400).json({
            success: false,
            message: "Invalid bank reference ID.",
          });
        }

        finalPaymentId = cleanBankRef;
      } else if (payment.method === "wallet") {
        const cleanWalletRef = String(walletRef || "").trim().toUpperCase();

        if (!/^[A-Z0-9]{6,30}$/.test(cleanWalletRef)) {
          return res.status(400).json({
            success: false,
            message: "Invalid wallet transaction ID.",
          });
        }

        finalPaymentId = cleanWalletRef;
      }
    }

    payment.status = "paid";
    payment.paymentId = finalPaymentId;
    await payment.save();

    booking.paymentStatus = "paid";
    booking.status = "confirmed";
    booking.paymentId = finalPaymentId;
    booking.paymentOrderId = orderId;
    await booking.save();

    await Promise.all([
      createNotification({
        userId: booking.userId,
        title: "Payment Successful",
        message: `Payment completed for booking ${booking._id
          .toString()
          .slice(-6)
          .toUpperCase()}.`,
        type: "payment",
        meta: { bookingId: booking._id, paymentId: finalPaymentId },
      }),
      createNotification({
        userId: booking.ownerId,
        title: "Booking Confirmed",
        message: `A booking on your property has been confirmed and paid.`,
        type: "booking",
        meta: { bookingId: booking._id },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      booking,
      payment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Payment verification failed.",
      error: error.message,
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
};
