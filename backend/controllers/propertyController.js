const Property = require("../models/Property");
const {
  parseAmenities,
  predictRentWithML,
  median,
} = require("../utils/pricePredictionModel");

const ALLOWED_PROPERTY_TYPES = ["hostel", "pg", "flat", "room", "hotel"];
const ALLOWED_PRICE_TYPES = ["monthly", "daily", "hourly"];
const ALLOWED_GENDER = ["male", "female", "any"];

const normalizeArrayInput = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const getPublicProperties = async (req, res) => {
  try {
    const { city, type, minPrice, maxPrice, locality } = req.query;

    const query = { status: "approved" };

    if (city) {
      query.city = { $regex: city.trim(), $options: "i" };
    }

    if (locality) {
      query.address = { $regex: locality.trim(), $options: "i" };
    }

    if (type) {
      query.propertyType = type;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      const min = Number(minPrice);
      const max = Number(maxPrice);
      if (minPrice && Number.isFinite(min)) query.price.$gte = min;
      if (maxPrice && Number.isFinite(max)) query.price.$lte = max;
      if (!Object.keys(query.price).length) {
        delete query.price;
      }
    }

    const properties = await Property.find(query)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name phone email")
      .lean();

    return res.status(200).json({
      success: true,
      count: properties.length,
      properties,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch properties.",
      error: error.message,
    });
  }
};

const getPriceSuggestion = async (req, res) => {
  try {
    const { city, locality, propertyType, occupancy, amenities } = req.body;

    if (!city || !propertyType) {
      return res.status(400).json({
        success: false,
        message: "city and propertyType are required for rent suggestion.",
      });
    }

    if (!ALLOWED_PROPERTY_TYPES.includes(propertyType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property type.",
      });
    }

    const primaryQuery = {
      status: "approved",
      city: { $regex: String(city).trim(), $options: "i" },
      propertyType,
    };
    if (locality) {
      primaryQuery.address = { $regex: String(locality).trim(), $options: "i" };
    }

    let comparables = await Property.find(primaryQuery)
      .sort({ createdAt: -1 })
      .limit(120)
      .select("price amenities occupancy city address propertyType rating isVerified")
      .lean();

    if (comparables.length < 12) {
      const cityLevel = await Property.find({
        status: "approved",
        city: { $regex: String(city).trim(), $options: "i" },
        propertyType,
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .select("price amenities occupancy city address propertyType rating isVerified")
        .lean();

      comparables = cityLevel;
    }

    if (comparables.length < 8) {
      const typeLevel = await Property.find({
        status: "approved",
        propertyType,
      })
        .sort({ createdAt: -1 })
        .limit(240)
        .select("price amenities occupancy city address propertyType rating isVerified")
        .lean();

      comparables = typeLevel;
    }

    const parsedOccupancy = Number(occupancy || 1);
    const occupancyValue = Number.isFinite(parsedOccupancy) && parsedOccupancy > 0
      ? parsedOccupancy
      : 1;

    const amenitiesList = parseAmenities(amenities);

    let marketAverage = 0;
    let marketMedian = 0;
    if (comparables.length) {
      const prices = comparables.map((item) => Number(item.price || 0)).filter((item) => item > 0);
      marketAverage = prices.length
        ? prices.reduce((sum, value) => sum + value, 0) / prices.length
        : 0;
      marketMedian = median(prices);
    }

    const fallbackBaseByType = {
      hostel: 8500,
      pg: 9000,
      flat: 16500,
      room: 7000,
      hotel: 2500,
    };

    const basePrice = marketMedian || marketAverage || fallbackBaseByType[propertyType] || 9000;

    const mlPrediction = predictRentWithML({
      comparables,
      propertyInput: {
        propertyType,
        occupancy: occupancyValue,
        amenities: amenitiesList,
        isVerified: false,
        rating: 0,
      },
    });

    const blendedSuggested = Math.round(
      (mlPrediction.predictedRent * 0.82 + basePrice * 0.18) / 50
    ) * 50;

    const spread = Math.max(0.05, 0.14 - mlPrediction.confidence * 0.06);
    const suggestedMin = Math.max(1000, Math.round((blendedSuggested * (1 - spread)) / 50) * 50);
    const suggestedMax = Math.round((blendedSuggested * (1 + spread)) / 50) * 50;

    const factors = [];
    if (comparables.length) factors.push(`Based on ${comparables.length} approved comparable listings`);
    if (amenitiesList.length) factors.push(`Amenity-aware ML features include ${amenitiesList.slice(0, 4).join(", ")}`);
    if (occupancyValue > 1) factors.push(`Occupancy adjustment for ${occupancyValue} occupants`);
    factors.push(`Model confidence ${Math.round(mlPrediction.confidence * 100)}%`);

    return res.status(200).json({
      success: true,
      title: "ML rent prediction + optimization hint",
      inputs: {
        city: String(city).trim(),
        locality: locality ? String(locality).trim() : "",
        propertyType,
        occupancy: occupancyValue,
        amenities: amenitiesList,
      },
      comparableCount: comparables.length,
      marketAverage: Math.round(marketAverage),
      marketMedian: Math.round(marketMedian),
      recommendedRent: blendedSuggested,
      suggestedRange: {
        min: suggestedMin,
        max: suggestedMax,
      },
      mlModel: {
        algorithm: mlPrediction.diagnostics.algorithm,
        confidence: mlPrediction.confidence,
        trainingSize: mlPrediction.diagnostics.trainingSize,
        rmse: mlPrediction.diagnostics.rmse,
      },
      factors: factors.length ? factors : ["Using category-level baseline due to limited market data"],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate price suggestion.",
      error: error.message,
    });
  }
};

const getPropertySuggestions = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(200).json({
        success: true,
        suggestions: [],
      });
    }

    const suggestions = await Property.find({
      status: "approved",
      $or: [
        { title: { $regex: q, $options: "i" } },
        { city: { $regex: q, $options: "i" } },
      ],
    })
      .select("title city propertyType")
      .sort({ rating: -1, createdAt: -1 })
      .limit(8)
      .lean();

    return res.status(200).json({
      success: true,
      suggestions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch search suggestions.",
      error: error.message,
    });
  }
};

const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      "ownerId",
      "name phone email city"
    );

    if (!property || property.status !== "approved") {
      return res.status(404).json({
        success: false,
        message: "Property not found or not available.",
      });
    }

    return res.status(200).json({
      success: true,
      property,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch property details.",
      error: error.message,
    });
  }
};

const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      propertyType,
      city,
      address,
      price,
      priceType,
      images,
      amenities,
      occupancy,
      genderPreference,
    } = req.body;

    if (
      !title ||
      !description ||
      !propertyType ||
      !city ||
      !address ||
      price === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required property fields.",
      });
    }

    if (!ALLOWED_PROPERTY_TYPES.includes(propertyType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property type.",
      });
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid positive number.",
      });
    }

    const resolvedPriceType = priceType || "monthly";
    if (!ALLOWED_PRICE_TYPES.includes(resolvedPriceType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid price type.",
      });
    }

    const resolvedGender = genderPreference || "any";
    if (!ALLOWED_GENDER.includes(resolvedGender)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gender preference.",
      });
    }

    const parsedOccupancy = occupancy ? Number(occupancy) : 1;
    if (!Number.isInteger(parsedOccupancy) || parsedOccupancy < 1 || parsedOccupancy > 20) {
      return res.status(400).json({
        success: false,
        message: "Occupancy must be between 1 and 20.",
      });
    }

    const property = await Property.create({
      title: title.trim(),
      description: description.trim(),
      propertyType,
      city: city.trim(),
      address: address.trim(),
      price: parsedPrice,
      priceType: resolvedPriceType,
      images: normalizeArrayInput(images),
      amenities: normalizeArrayInput(amenities),
      ownerId: req.user.userId,
      occupancy: parsedOccupancy,
      genderPreference: resolvedGender,
      // New property must go to admin approval queue for demo flow.
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Property listing created and sent for admin approval.",
      property,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Property creation failed.",
      error: error.message,
    });
  }
};

const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (String(property.ownerId) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own listing.",
      });
    }

    const editableFields = [
      "title",
      "description",
      "propertyType",
      "city",
      "address",
      "price",
      "priceType",
      "occupancy",
      "genderPreference",
    ];

    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        property[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    });

    if (
      req.body.propertyType !== undefined &&
      !ALLOWED_PROPERTY_TYPES.includes(property.propertyType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid property type.",
      });
    }

    if (req.body.priceType !== undefined && !ALLOWED_PRICE_TYPES.includes(property.priceType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid price type.",
      });
    }

    if (
      req.body.genderPreference !== undefined &&
      !ALLOWED_GENDER.includes(property.genderPreference)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid gender preference.",
      });
    }

    if (req.body.images !== undefined) {
      property.images = normalizeArrayInput(req.body.images);
    }

    if (req.body.amenities !== undefined) {
      property.amenities = normalizeArrayInput(req.body.amenities);
    }

    if (req.body.price !== undefined) {
      const parsedPrice = Number(req.body.price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid positive number.",
        });
      }
      property.price = parsedPrice;
    }

    if (req.body.occupancy !== undefined) {
      const parsedOccupancy = Number(req.body.occupancy);
      if (!Number.isInteger(parsedOccupancy) || parsedOccupancy < 1 || parsedOccupancy > 20) {
        return res.status(400).json({
          success: false,
          message: "Occupancy must be between 1 and 20.",
        });
      }
      property.occupancy = parsedOccupancy;
    }

    await property.save();

    return res.status(200).json({
      success: true,
      message: "Property updated successfully.",
      property,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Property update failed.",
      error: error.message,
    });
  }
};

const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (String(property.ownerId) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own listing.",
      });
    }

    await property.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Property deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete property.",
      error: error.message,
    });
  }
};

const boostProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found.",
      });
    }

    if (String(property.ownerId) !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only boost your own listing.",
      });
    }

    property.isFeatured = true;
    property.featuredAt = new Date();
    await property.save();

    return res.status(200).json({
      success: true,
      message: "Property marked as featured.",
      property,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to boost property.",
      error: error.message,
    });
  }
};

const getMyListings = async (req, res) => {
  try {
    const listings = await Property.find({ ownerId: req.user.userId })
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email phone");

    return res.status(200).json({
      success: true,
      count: listings.length,
      properties: listings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your listings.",
      error: error.message,
    });
  }
};

module.exports = {
  getPublicProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getMyListings,
  getPropertySuggestions,
  getPriceSuggestion,
  boostProperty,
};
