const express = require("express");
const {
  createReview,
  getMyReviews,
  getOwnerReviewInbox,
  getAdminReviewInbox,
  updateReviewVisibility,
  getPublicReviews,
} = require("../controllers/reviewController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/public", getPublicReviews);

router.post(
  "/",
  verifyToken,
  authorizeRoles("student", "tenant", "parent"),
  createReview
);
router.get(
  "/my",
  verifyToken,
  authorizeRoles("student", "tenant", "parent"),
  getMyReviews
);
router.get(
  "/owner",
  verifyToken,
  authorizeRoles("flat_owner", "pg_owner", "hostel_owner"),
  getOwnerReviewInbox
);
router.get("/admin", verifyToken, authorizeRoles("admin"), getAdminReviewInbox);
router.patch(
  "/:id/visibility",
  verifyToken,
  authorizeRoles("admin"),
  updateReviewVisibility
);

module.exports = router;
