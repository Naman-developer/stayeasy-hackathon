const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { ROLES } = require("../utils/constants");
const generateToken = require("../utils/generateToken");
const {
  getNextStudentCode,
  isStudentCode,
  normalizeStudentCode,
} = require("../utils/studentCode");

const cleanUser = (userDoc) => {
  const user = userDoc.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const buildLoginQuery = ({ email, phone, identifier }) => {
  if (email) {
    return { email: email.toLowerCase().trim() };
  }

  if (phone) {
    return { phone: phone.trim() };
  }

  if (identifier) {
    const value = identifier.trim();
    if (value.includes("@")) {
      return { email: value.toLowerCase() };
    }
    if (isStudentCode(value)) {
      return { studentCode: normalizeStudentCode(value) };
    }
    return { phone: value };
  }

  return null;
};

const signup = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      confirmPassword,
      role,
      city,
      roleDetails = {},
    } = req.body;

    if (!name || !email || !phone || !password || !confirmPassword || !role) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirm password do not match.",
      });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { phone: phone.trim() }],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email or phone.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const studentCode = role === "student" ? await getNextStudentCode(User) : "";

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role,
      ...(studentCode ? { studentCode } : {}),
      city: city ? city.trim() : "",
      lastLoginAt: new Date(),
      roleDetails: {
        businessName: roleDetails.businessName || "",
        propertyInfo: roleDetails.propertyInfo || "",
        childReference: roleDetails.childReference || "",
        serviceCategory: roleDetails.serviceCategory || "",
        preference: roleDetails.preference || "",
      },
    });

    const token = generateToken({ userId: user._id, role: user.role });

    return res.status(201).json({
      success: true,
      message: "Signup successful.",
      token,
      user: cleanUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Signup failed.",
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body;

    const query = buildLoginQuery({ email, phone, identifier });
    if (!query || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and password.",
      });
    }

    const user = await User.findOne(query).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    // Backfill a readable student code for older records.
    if (user.role === "student" && !user.studentCode) {
      user.studentCode = await getNextStudentCode(User);
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken({ userId: user._id, role: user.role });
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: cleanUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login failed.",
      error: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone is required.",
      });
    }

    const user = await User.findOne(
      email
        ? { email: email.toLowerCase().trim() }
        : { phone: phone.trim() }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Hackathon MVP mock token flow.
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

    return res.status(200).json({
      success: true,
      message: "Mock reset token generated. Use this token in reset-password.",
      resetToken,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to process forgot password request.",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, phone, newPassword, confirmPassword } = req.body;

    if ((!email && !phone) || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirm password do not match.",
      });
    }

    const query = email
      ? { email: email.toLowerCase().trim() }
      : { phone: phone.trim() };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Reset password failed.",
      error: error.message,
    });
  }
};

const otpLogin = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP are required.",
      });
    }

    // Hackathon MVP mock OTP check.
    if (otp !== "123456") {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP. Use 123456 for demo.",
      });
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken({ userId: user._id, role: user.role });
    return res.status(200).json({
      success: true,
      message: "OTP login successful.",
      token,
      user: cleanUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "OTP login failed.",
      error: error.message,
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: cleanUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch user profile.",
      error: error.message,
    });
  }
};

module.exports = {
  signup,
  login,
  forgotPassword,
  resetPassword,
  otpLogin,
  getMe,
};
