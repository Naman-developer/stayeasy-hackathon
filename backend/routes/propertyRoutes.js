const express = require("express");
const {
  getPublicProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getMyListings,
  getPropertySuggestions,
  getPriceSuggestion,
  boostProperty,
} = require("../controllers/propertyController");
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getPublicProperties);
router.get("/suggestions", getPropertySuggestions);
router.post(
  "/price-suggestion",
  verifyToken,
  authorizeRoles("owner", "flat_owner", "pg_owner", "hostel_owner"),
  getPriceSuggestion
);
router.get(
  "/my-listings",
  verifyToken,
  authorizeRoles("owner", "flat_owner", "pg_owner", "hostel_owner"),
  getMyListings
);
router.get("/:id", getPropertyById);
router.post(
  "/",
  verifyToken,
  authorizeRoles("owner", "flat_owner", "pg_owner", "hostel_owner"),
  createProperty
);
router.put(
  "/:id",
  verifyToken,
  authorizeRoles("owner", "flat_owner", "pg_owner", "hostel_owner"),
  updateProperty
);
router.post(
  "/:id/boost",
  verifyToken,
  authorizeRoles("owner", "flat_owner", "pg_owner", "hostel_owner"),
  boostProperty
);
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("owner", "flat_owner", "pg_owner", "hostel_owner"),
  deleteProperty
);

module.exports = router;
