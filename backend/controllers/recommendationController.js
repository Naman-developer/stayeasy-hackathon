const Property = require("../models/Property");
const User = require("../models/User");

const AMENITY_ALIASES = {
  ac: ["ac", "air conditioner", "air-conditioned"],
  wifi: ["wifi", "wi-fi", "internet"],
  privacy: ["privacy", "private room", "single room", "independent"],
  veg_food: ["veg", "vegetarian", "mess", "food"],
  campus_distance: ["campus", "college", "university", "near college", "distance"],
};

const normalizeText = (value = "") => String(value).trim().toLowerCase();

const parsePreferenceTerms = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))];
  }

  return [
    ...new Set(
      String(value)
        .split(",")
        .map((item) => normalizeText(item))
        .filter(Boolean)
    ),
  ];
};

const buildPropertyText = (property) =>
  normalizeText(
    [
      property.title,
      property.description,
      property.city,
      property.address,
      ...(property.amenities || []),
      property.propertyType,
    ].join(" ")
  );

const isPreferenceMatched = (term, propertyText) => {
  if (!term) return false;

  const aliases = AMENITY_ALIASES[term] || [term];
  return aliases.some((alias) => propertyText.includes(normalizeText(alias)));
};

const getRoleTypeBoost = (role, propertyType) => {
  if (role === "student") {
    if (propertyType === "hostel") return 12;
    if (propertyType === "pg") return 10;
    if (propertyType === "room") return 4;
    return 1;
  }

  if (role === "tenant") {
    if (propertyType === "flat") return 12;
    if (propertyType === "room") return 9;
    if (propertyType === "pg") return 4;
    return 1;
  }

  return 2;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const scorePropertyForUser = (property, context) => {
  const {
    userRole,
    city,
    locality,
    budget,
    propertyType,
    preferences = [],
  } = context;

  const propertyText = buildPropertyText(property);
  const reasons = [];
  let score = 45;

  if (property.rating) {
    score += Number(property.rating) * 5;
    reasons.push(`High rating ${property.rating}/5`);
  }

  if (property.isVerified) {
    score += 4;
    reasons.push("Verified listing");
  }

  if (city && normalizeText(property.city) === normalizeText(city)) {
    score += 14;
    reasons.push("City match");
  }

  if (locality && normalizeText(property.address).includes(normalizeText(locality))) {
    score += 10;
    reasons.push("Locality match");
  }

  if (propertyType && property.propertyType === propertyType) {
    score += 14;
    reasons.push("Property type match");
  }

  score += getRoleTypeBoost(userRole, property.propertyType);

  if (Number.isFinite(budget) && budget > 0) {
    if (property.price <= budget) {
      const closeness = 1 - Math.abs(budget - property.price) / Math.max(budget, 1);
      score += 12 + clamp(closeness * 8, 0, 8);
      reasons.push("Within budget");
    } else {
      const overBudgetRatio = (property.price - budget) / Math.max(budget, 1);
      score -= clamp(overBudgetRatio * 35, 0, 35);
    }
  }

  const matchedPreferences = preferences.filter((term) =>
    isPreferenceMatched(term, propertyText)
  );
  if (matchedPreferences.length) {
    score += matchedPreferences.length * 6;
    reasons.push(`Preference match: ${matchedPreferences.slice(0, 2).join(", ")}`);
  }

  const finalScore = Math.round(clamp(score, 25, 99));
  return {
    aiScore: finalScore,
    aiReason:
      reasons.slice(0, 3).join(" | ") ||
      "Best available match based on your current filters.",
  };
};

const getRecommendationsForContext = async ({
  user,
  filters = {},
  limit = 8,
}) => {
  const city = normalizeText(filters.city || user?.city || "");
  const locality = normalizeText(filters.locality || "");
  const propertyType = normalizeText(filters.propertyType || filters.type || "");
  const budget = Number(filters.budget || filters.maxPrice);
  const preferences = parsePreferenceTerms(filters.preferences || filters.preference);

  const query = { status: "approved" };
  if (city) {
    query.city = { $regex: city, $options: "i" };
  }
  if (propertyType) {
    query.propertyType = propertyType;
  }
  if (locality) {
    query.address = { $regex: locality, $options: "i" };
  }

  const shortlist = await Property.find(query)
    .sort({ rating: -1, totalReviews: -1, createdAt: -1 })
    .limit(120)
    .populate("ownerId", "name phone")
    .lean();

  const context = {
    userRole: user?.role || "",
    city,
    locality,
    propertyType,
    budget: Number.isFinite(budget) ? budget : NaN,
    preferences,
  };

  const ranked = shortlist
    .map((property) => {
      const scored = scorePropertyForUser(property, context);
      return {
        ...property,
        aiScore: scored.aiScore,
        aiReason: scored.aiReason,
      };
    })
    .sort((a, b) => b.aiScore - a.aiScore || a.price - b.price)
    .slice(0, clamp(Number(limit) || 8, 1, 20));

  return {
    recommendations: ranked,
    filters: {
      city: city || "any",
      locality: locality || "any",
      propertyType: propertyType || "any",
      budget: Number.isFinite(budget) && budget > 0 ? budget : "any",
      preferences: preferences.length ? preferences : ["any"],
    },
  };
};

const getRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const result = await getRecommendationsForContext({
      user,
      filters: req.query,
      limit: req.query.limit || 8,
    });

    return res.status(200).json({
      success: true,
      title: "AI-powered recommendation system",
      filters: result.filters,
      count: result.recommendations.length,
      recommendations: result.recommendations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recommendations.",
      error: error.message,
    });
  }
};

module.exports = {
  getRecommendations,
  getRecommendationsForContext,
};
