const Review = require("../models/Review");
const User = require("../models/User");
const { createBulkNotifications, createNotification } = require("../utils/notify");
const {
  analyzeReviewSentiment,
  buildSentimentSummary,
  extractTopTerms,
  MODEL_VERSION,
} = require("../utils/reviewSentimentModel");

const REVIEWER_ROLES = ["student", "tenant", "parent"];
const OWNER_ADMIN_ROLES = ["flat_owner", "pg_owner", "hostel_owner", "admin"];

const parseRating = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.round(parsed);
  if (normalized < 1 || normalized > 5) return null;
  return normalized;
};

const toReviewResponse = (review) => ({
  id: review._id,
  reviewerId: review.reviewerId,
  reviewerName: review.reviewerName,
  reviewerRole: review.reviewerRole,
  rating: review.rating,
  title: review.title || "",
  message: review.message,
  visibility: review.visibility,
  sentiment: {
    label: review.sentimentLabel || "neutral",
    score: Number(review.sentimentScore || 0),
    confidence: Number(review.sentimentConfidence || 0),
    version: review.sentimentVersion || MODEL_VERSION,
  },
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

const enrichReviewWithSentiment = async (review) => {
  if (review.sentimentLabel && Number.isFinite(Number(review.sentimentScore))) {
    return review;
  }

  try {
    const sentiment = await analyzeReviewSentiment(Review, {
      title: review.title,
      message: review.message,
      rating: review.rating,
    });

    return {
      ...review,
      sentimentLabel: sentiment.label,
      sentimentScore: sentiment.score,
      sentimentConfidence: sentiment.confidence,
      sentimentVersion: sentiment.modelVersion || MODEL_VERSION,
    };
  } catch (error) {
    return {
      ...review,
      sentimentLabel: "neutral",
      sentimentScore: 0,
      sentimentConfidence: 0,
      sentimentVersion: MODEL_VERSION,
    };
  }
};

const createReview = async (req, res) => {
  try {
    const rating = parseRating(req.body.rating);
    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();

    if (!rating) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5.",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Review message is required.",
      });
    }

    const reviewer = await User.findById(req.user.userId).select("name role");
    if (!reviewer) {
      return res.status(404).json({
        success: false,
        message: "Reviewer account not found.",
      });
    }

    if (!REVIEWER_ROLES.includes(reviewer.role)) {
      return res.status(403).json({
        success: false,
        message: "Only student, tenant, and parent can submit reviews.",
      });
    }

    const sentiment = await analyzeReviewSentiment(Review, {
      title,
      message,
      rating,
    });

    const review = await Review.create({
      reviewerId: reviewer._id,
      reviewerName: reviewer.name,
      reviewerRole: reviewer.role,
      rating,
      title,
      message,
      visibility: "public",
      sentimentLabel: sentiment.label,
      sentimentScore: sentiment.score,
      sentimentConfidence: sentiment.confidence,
      sentimentVersion: sentiment.modelVersion || MODEL_VERSION,
    });

    const recipients = await User.find(
      { role: { $in: OWNER_ADMIN_ROLES } },
      "_id"
    ).lean();

    const notificationItems = recipients.map((recipient) => ({
      userId: recipient._id,
      title: "New Community Review",
      message: `${reviewer.name} (${reviewer.role}) submitted a ${rating}/5 review.`,
      type: "review",
      meta: {
        reviewId: review._id,
        reviewerId: reviewer._id,
        reviewerRole: reviewer.role,
      },
    }));

    await createBulkNotifications(notificationItems);

    return res.status(201).json({
      success: true,
      message: "Review submitted. Owners and admins have been notified.",
      review: toReviewResponse(review),
      recipientCount: recipients.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit review.",
      error: error.message,
    });
  }
};

const getMyReviews = async (req, res) => {
  try {
    const rawReviews = await Review.find({ reviewerId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const reviews = await Promise.all(rawReviews.map(enrichReviewWithSentiment));

    return res.status(200).json({
      success: true,
      count: reviews.length,
      sentimentSummary: buildSentimentSummary(reviews),
      reviews: reviews.map(toReviewResponse),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your reviews.",
      error: error.message,
    });
  }
};

const getOwnerReviewInbox = async (req, res) => {
  try {
    const rawReviews = await Review.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const reviews = await Promise.all(rawReviews.map(enrichReviewWithSentiment));

    return res.status(200).json({
      success: true,
      count: reviews.length,
      sentimentSummary: buildSentimentSummary(reviews),
      reviews: reviews.map(toReviewResponse),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews.",
      error: error.message,
    });
  }
};

const getAdminReviewInbox = async (req, res) => {
  try {
    const rawReviews = await Review.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const reviews = await Promise.all(rawReviews.map(enrichReviewWithSentiment));

    const visibilityCounts = reviews.reduce(
      (acc, item) => {
        acc[item.visibility] = (acc[item.visibility] || 0) + 1;
        return acc;
      },
      { public: 0, hidden: 0 }
    );

    return res.status(200).json({
      success: true,
      count: reviews.length,
      visibilityCounts,
      sentimentSummary: buildSentimentSummary(reviews),
      reviews: reviews.map(toReviewResponse),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin review inbox.",
      error: error.message,
    });
  }
};

const updateReviewVisibility = async (req, res) => {
  try {
    const visibility = String(req.body.visibility || "").trim().toLowerCase();
    if (!["public", "hidden"].includes(visibility)) {
      return res.status(400).json({
        success: false,
        message: "Visibility must be either public or hidden.",
      });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found.",
      });
    }

    review.visibility = visibility;
    await review.save();

    await createNotification({
      userId: review.reviewerId,
      title: "Review Visibility Updated",
      message: `Your review is now ${visibility} on landing page.`,
      type: "review",
      meta: {
        reviewId: review._id,
        visibility,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Review marked as ${visibility}.`,
      review: toReviewResponse(review),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update review visibility.",
      error: error.message,
    });
  }
};

const getPublicReviews = async (req, res) => {
  try {
    const limitValue = Number(req.query.limit || 6);
    const limit = Math.max(1, Math.min(20, Number.isFinite(limitValue) ? limitValue : 6));

    const rawReviews = await Review.find({ visibility: "public" })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const reviews = await Promise.all(rawReviews.map(enrichReviewWithSentiment));

    return res.status(200).json({
      success: true,
      count: reviews.length,
      sentimentSummary: buildSentimentSummary(reviews),
      reviews: reviews.map((review) => ({
        id: review._id,
        reviewerName: review.reviewerName,
        reviewerRole: review.reviewerRole,
        rating: review.rating,
        title: review.title || "",
        message: review.message,
        sentiment: {
          label: review.sentimentLabel || "neutral",
          score: Number(review.sentimentScore || 0),
          confidence: Number(review.sentimentConfidence || 0),
        },
        createdAt: review.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load public reviews.",
      error: error.message,
    });
  }
};

const getReviewSentimentInsights = async (req, res) => {
  try {
    const limitValue = Number(req.query.limit || 300);
    const limit = Math.max(20, Math.min(1000, Number.isFinite(limitValue) ? limitValue : 300));

    const rawReviews = await Review.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const reviews = await Promise.all(rawReviews.map(enrichReviewWithSentiment));
    const sentimentSummary = buildSentimentSummary(reviews);
    const topNegativeTerms = extractTopTerms(reviews, { label: "negative", limit: 8 });
    const topPositiveTerms = extractTopTerms(reviews, { label: "positive", limit: 8 });

    return res.status(200).json({
      success: true,
      analyzedCount: reviews.length,
      sentimentSummary,
      topNegativeTerms,
      topPositiveTerms,
      modelVersion: MODEL_VERSION,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate sentiment insights.",
      error: error.message,
    });
  }
};

module.exports = {
  createReview,
  getMyReviews,
  getOwnerReviewInbox,
  getAdminReviewInbox,
  updateReviewVisibility,
  getPublicReviews,
  getReviewSentimentInsights,
};
