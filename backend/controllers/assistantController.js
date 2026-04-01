const User = require("../models/User");
const Property = require("../models/Property");
const Complaint = require("../models/Complaint");
const { getRecommendationsForContext } = require("./recommendationController");

const normalize = (value = "") => String(value).trim().toLowerCase();

const CITY_HINTS = ["delhi", "noida", "gurugram", "ghaziabad", "faridabad"];

const extractBudget = (message) => {
  const underMatch = message.match(
    /\b(?:under|below|less than|upto|up to|max)\s*(?:rs|inr|₹)?\s*(\d{3,6})\b/i
  );
  if (underMatch) return Number(underMatch[1]);

  const generic = message.match(/\b(\d{4,6})\b/);
  if (generic) return Number(generic[1]);

  return NaN;
};

const extractPropertyType = (message) => {
  if (/\bhostel\b/i.test(message)) return "hostel";
  if (/\bpg\b/i.test(message)) return "pg";
  if (/\bflat\b/i.test(message)) return "flat";
  if (/\broom\b/i.test(message)) return "room";
  if (/\bhotel\b/i.test(message)) return "hotel";
  return "";
};

const extractCity = (message, fallbackCity = "") => {
  const normalized = normalize(message);
  const knownCity = CITY_HINTS.find((city) => normalized.includes(city));
  if (knownCity) return knownCity;

  const match = message.match(/\b(?:in|near|around)\s+([a-zA-Z\s]{3,30})/);
  if (match) {
    const guessed = normalize(match[1]).split(" ").slice(0, 2).join(" ");
    if (!["college", "campus", "hostel", "pg", "flat"].includes(guessed)) {
      return guessed;
    }
  }

  return fallbackCity || "";
};

const extractPreferences = (message) => {
  const text = normalize(message);
  const preferences = [];

  if (text.includes("privacy") || text.includes("private")) preferences.push("privacy");
  if (text.includes("ac")) preferences.push("ac");
  if (text.includes("wifi") || text.includes("wi-fi")) preferences.push("wifi");
  if (text.includes("veg") || text.includes("vegetarian")) preferences.push("veg_food");
  if (text.includes("campus") || text.includes("college") || text.includes("distance")) {
    preferences.push("campus_distance");
  }

  return preferences;
};

const buildPropertyCards = (recommendations = []) =>
  recommendations.slice(0, 5).map((item) => ({
    id: item._id,
    title: item.title,
    city: item.city,
    type: item.propertyType,
    price: item.price,
    priceType: item.priceType,
    aiScore: item.aiScore,
    aiReason: item.aiReason,
  }));

const chatWithAssistant = async (req, res) => {
  try {
    const { message } = req.body;
    const text = String(message || "").trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    const user = await User.findById(req.user.userId).select("name role city");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const lower = normalize(text);

    const asksComplaintStatus =
      /(complaint|issue|ticket)/.test(lower) &&
      /(pending|status|why|delay|not resolved)/.test(lower);

    if (asksComplaintStatus) {
      const complaints = await Complaint.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("category status message createdAt response")
        .lean();

      const pending = complaints.filter((item) =>
        ["open", "in_progress", "escalated"].includes(item.status)
      );

      const latestPending = pending[0];
      const reply = pending.length
        ? `You have ${pending.length} active complaint(s). Latest is "${latestPending.category}" with status "${latestPending.status}". If it stays unresolved, admin escalation flow will handle it automatically.`
        : "Great news. You currently have no pending complaints.";

      return res.status(200).json({
        success: true,
        intent: "complaint_status",
        reply,
        cards: complaints.map((item) => ({
          type: "complaint",
          category: item.category,
          status: item.status,
          message: item.message,
          response: item.response || "",
          createdAt: item.createdAt,
        })),
      });
    }

    const asksListingHelp =
      /(show|find|suggest|recommend|cheap|affordable|hostel|pg|flat|room|hotel)/.test(
        lower
      );

    if (asksListingHelp) {
      const budget = extractBudget(text);
      const propertyType = extractPropertyType(text);
      const city = extractCity(text, user.city || "");
      const preferences = extractPreferences(text);

      const result = await getRecommendationsForContext({
        user,
        filters: {
          city,
          type: propertyType,
          budget: Number.isFinite(budget) ? budget : undefined,
          preferences,
        },
        limit: 5,
      });

      if (!result.recommendations.length) {
        return res.status(200).json({
          success: true,
          intent: "property_search",
          reply:
            "I could not find good matches for that request. Try increasing budget or removing strict filters.",
          cards: [],
        });
      }

      const cheapest = result.recommendations.reduce((min, item) =>
        item.price < min.price ? item : min
      );

      const reply = `Found ${result.recommendations.length} options. Best value starts at Rs ${cheapest.price.toLocaleString(
        "en-IN"
      )} in ${cheapest.city}.`;

      return res.status(200).json({
        success: true,
        intent: "property_search",
        reply,
        cards: buildPropertyCards(result.recommendations),
      });
    }

    const sampleProperties = await Property.find({ status: "approved" })
      .sort({ createdAt: -1 })
      .limit(3)
      .select("title city propertyType price priceType")
      .lean();

    return res.status(200).json({
      success: true,
      intent: "general_help",
      reply:
        'Try asking: "Show me cheap PGs near college", "Recommend flat under 15000 in Noida", or "Why is my complaint pending?".',
      cards: sampleProperties.map((item) => ({
        id: item._id,
        title: item.title,
        city: item.city,
        type: item.propertyType,
        price: item.price,
        priceType: item.priceType,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Assistant failed to process your query.",
      error: error.message,
    });
  }
};

module.exports = {
  chatWithAssistant,
};
