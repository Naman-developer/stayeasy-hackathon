const PROPERTY_TYPES = ["hostel", "pg", "flat", "room", "hotel"];
const FOCUS_AMENITIES = ["ac", "wifi", "parking", "security", "mess", "food", "laundry"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseAmenities = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

const median = (numbers = []) => {
  if (!numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
};

const buildFeatureRow = (property = {}) => {
  const amenities = parseAmenities(property.amenities);
  const amenitySet = new Set(amenities);
  const propertyType = String(property.propertyType || "").toLowerCase();

  const row = [
    1,
    clamp(Number(property.occupancy || 1), 1, 20),
    amenities.length,
    clamp(Number(property.rating || 0), 0, 5),
    property.isVerified ? 1 : 0,
  ];

  FOCUS_AMENITIES.forEach((amenity) => row.push(amenitySet.has(amenity) ? 1 : 0));
  PROPERTY_TYPES.forEach((type) => row.push(propertyType === type ? 1 : 0));

  return row;
};

const computeFeatureStats = (rows = []) => {
  if (!rows.length) return { means: [], stds: [] };
  const featureCount = rows[0].length;
  const means = new Array(featureCount).fill(0);
  const stds = new Array(featureCount).fill(1);

  rows.forEach((row) => {
    for (let i = 0; i < featureCount; i += 1) {
      means[i] += row[i];
    }
  });
  for (let i = 0; i < featureCount; i += 1) {
    means[i] /= rows.length;
  }

  rows.forEach((row) => {
    for (let i = 0; i < featureCount; i += 1) {
      const diff = row[i] - means[i];
      stds[i] += diff * diff;
    }
  });
  for (let i = 0; i < featureCount; i += 1) {
    stds[i] = Math.sqrt(stds[i] / rows.length) || 1;
  }

  return { means, stds };
};

const scaleRows = (rows = [], stats) =>
  rows.map((row) =>
    row.map((value, idx) => {
      if (idx === 0) return 1;
      return (value - stats.means[idx]) / stats.stds[idx];
    })
  );

const trainLinearRegressionSGD = (rows, targets) => {
  if (!rows.length || rows.length !== targets.length) return null;

  const featureCount = rows[0].length;
  const yMean = targets.reduce((sum, value) => sum + value, 0) / targets.length;
  const yVariance =
    targets.reduce((sum, value) => sum + (value - yMean) ** 2, 0) / Math.max(targets.length, 1);
  const yStd = Math.sqrt(yVariance) || 1;
  const scaledY = targets.map((value) => (value - yMean) / yStd);

  const stats = computeFeatureStats(rows);
  const scaledRows = scaleRows(rows, stats);
  const weights = new Array(featureCount).fill(0);
  const learningRate = 0.02;
  const regularization = 0.0006;
  const epochs = 260;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let i = 0; i < scaledRows.length; i += 1) {
      const row = scaledRows[i];
      const y = scaledY[i];
      let prediction = 0;
      for (let j = 0; j < featureCount; j += 1) {
        prediction += row[j] * weights[j];
      }

      const error = prediction - y;
      for (let j = 0; j < featureCount; j += 1) {
        const gradient = error * row[j] + regularization * weights[j];
        weights[j] -= learningRate * gradient;
      }
    }
  }

  const predictions = scaledRows.map((row) => {
    let pred = 0;
    for (let j = 0; j < featureCount; j += 1) {
      pred += row[j] * weights[j];
    }
    return pred * yStd + yMean;
  });

  const rmse = Math.sqrt(
    predictions.reduce((sum, pred, i) => sum + (pred - targets[i]) ** 2, 0) /
      Math.max(targets.length, 1)
  );

  return {
    weights,
    featureMeans: stats.means,
    featureStds: stats.stds,
    targetMean: yMean,
    targetStd: yStd,
    rmse,
  };
};

const predictWithModel = (model, propertyInput) => {
  const row = buildFeatureRow(propertyInput);
  const scaledRow = row.map((value, idx) => {
    if (idx === 0) return 1;
    return (value - (model.featureMeans[idx] || 0)) / (model.featureStds[idx] || 1);
  });

  let scaledPrediction = 0;
  for (let i = 0; i < scaledRow.length; i += 1) {
    scaledPrediction += scaledRow[i] * (model.weights[i] || 0);
  }

  return scaledPrediction * model.targetStd + model.targetMean;
};

const buildFallback = ({ comparables = [], propertyType }) => {
  const prices = comparables
    .map((item) => Number(item.price || 0))
    .filter((price) => Number.isFinite(price) && price > 0);

  const fallbackByType = {
    hostel: 8500,
    pg: 9000,
    flat: 16500,
    room: 7000,
    hotel: 2500,
  };

  return median(prices) || fallbackByType[propertyType] || 9000;
};

const predictRentWithML = ({
  comparables = [],
  propertyInput = {},
}) => {
  const cleanComparables = comparables.filter((item) => Number(item.price || 0) > 0);
  const fallbackPrice = buildFallback({
    comparables: cleanComparables,
    propertyType: propertyInput.propertyType,
  });

  if (cleanComparables.length < 8) {
    return {
      predictedRent: Math.round(fallbackPrice),
      confidence: 0.35,
      diagnostics: {
        algorithm: "fallback_median",
        trainingSize: cleanComparables.length,
        rmse: null,
      },
    };
  }

  const rows = cleanComparables.map((item) => buildFeatureRow(item));
  const targets = cleanComparables.map((item) => Number(item.price));
  const model = trainLinearRegressionSGD(rows, targets);

  if (!model) {
    return {
      predictedRent: Math.round(fallbackPrice),
      confidence: 0.4,
      diagnostics: {
        algorithm: "fallback_median",
        trainingSize: cleanComparables.length,
        rmse: null,
      },
    };
  }

  const rawPrediction = predictWithModel(model, propertyInput);
  const blended = clamp(rawPrediction * 0.75 + fallbackPrice * 0.25, fallbackPrice * 0.7, fallbackPrice * 1.45);
  const normalizedError = model.rmse / Math.max(fallbackPrice, 1);
  const confidence = clamp(1 - normalizedError, 0.25, 0.92);

  return {
    predictedRent: Math.round(blended),
    confidence: Number(confidence.toFixed(2)),
    diagnostics: {
      algorithm: "linear_regression_sgd",
      trainingSize: cleanComparables.length,
      rmse: Math.round(model.rmse),
    },
  };
};

module.exports = {
  parseAmenities,
  predictRentWithML,
  median,
};
