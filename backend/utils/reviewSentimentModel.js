const MODEL_VERSION = "sentiment-v1";
const MAX_VOCAB_SIZE = 220;
const MIN_TOKEN_LENGTH = 3;
const CACHE_TTL_MS = 10 * 60 * 1000;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "was",
  "were",
  "have",
  "has",
  "had",
  "very",
  "really",
  "just",
  "from",
  "about",
  "your",
  "our",
  "they",
  "them",
  "their",
  "you",
  "are",
  "but",
  "not",
  "all",
  "any",
  "too",
  "can",
  "could",
  "would",
  "should",
  "there",
  "here",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "into",
  "near",
  "also",
  "only",
  "than",
  "then",
  "room",
  "hostel",
  "flat",
  "property",
  "pg",
  "hotel",
]);

const LEXICON = {
  positive: [
    "clean",
    "safe",
    "friendly",
    "helpful",
    "great",
    "good",
    "best",
    "excellent",
    "comfortable",
    "spacious",
    "secure",
    "affordable",
    "peaceful",
    "nice",
    "fast",
    "hygienic",
  ],
  negative: [
    "dirty",
    "unsafe",
    "rude",
    "bad",
    "worst",
    "poor",
    "delay",
    "noisy",
    "small",
    "expensive",
    "smell",
    "broken",
    "issue",
    "problem",
    "leak",
    "late",
    "crowded",
  ],
};

let cachedModel = null;
let cachedAt = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const sigmoid = (value) => 1 / (1 + Math.exp(-value));

const tokenize = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        token.length >= MIN_TOKEN_LENGTH &&
        !STOP_WORDS.has(token)
    );

const reviewToText = (review = {}) =>
  [review.title || "", review.message || ""].join(" ").trim();

const getLabelFromRating = (rating) => {
  if (rating >= 4) return 1;
  if (rating <= 2) return 0;
  return 0.5;
};

const buildVocabulary = (reviews = []) => {
  const counts = new Map();
  reviews.forEach((review) => {
    const tokens = tokenize(reviewToText(review));
    tokens.forEach((token) => {
      counts.set(token, (counts.get(token) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_VOCAB_SIZE)
    .map(([token]) => token);
};

const vectorizeReview = (review, vocabIndex) => {
  const vector = new Array(vocabIndex.size + 3).fill(0);
  const tokens = tokenize(reviewToText(review));

  vector[0] = 1; // bias
  vector[1] = clamp(Number(review.rating || 0), 1, 5) / 5;
  vector[2] = Math.min(tokens.length / 45, 1);

  tokens.forEach((token) => {
    if (vocabIndex.has(token)) {
      const idx = vocabIndex.get(token);
      vector[idx + 3] += 1;
    }
  });

  return vector.map((item, index) => (index >= 3 ? Math.min(item, 3) / 3 : item));
};

const initializeWeights = (size) => new Array(size).fill(0);

const trainLogisticModel = (rows, labels) => {
  const featureCount = rows[0]?.length || 0;
  if (!featureCount || rows.length < 6) return null;

  const weights = initializeWeights(featureCount);
  const learningRate = 0.08;
  const regularization = 0.0008;
  const epochs = 120;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx += 1) {
      const x = rows[rowIdx];
      const y = labels[rowIdx];
      if (y === 0.5) continue;

      let score = 0;
      for (let i = 0; i < featureCount; i += 1) {
        score += x[i] * weights[i];
      }

      const prediction = sigmoid(score);
      const error = prediction - y;

      for (let i = 0; i < featureCount; i += 1) {
        const gradient = error * x[i] + regularization * weights[i];
        weights[i] -= learningRate * gradient;
      }
    }
  }

  return { weights };
};

const trainSentimentModel = (reviews = []) => {
  const cleanReviews = reviews.filter(
    (review) =>
      review &&
      Number.isFinite(Number(review.rating)) &&
      String(review.message || "").trim().length >= 3
  );

  if (cleanReviews.length < 6) {
    return {
      type: "lexicon_fallback",
      version: MODEL_VERSION,
      trainedOn: cleanReviews.length,
      vocab: [],
      weights: [],
    };
  }

  const vocab = buildVocabulary(cleanReviews);
  const vocabIndex = new Map(vocab.map((token, index) => [token, index]));
  const rows = cleanReviews.map((review) => vectorizeReview(review, vocabIndex));
  const labels = cleanReviews.map((review) => getLabelFromRating(Number(review.rating)));

  const model = trainLogisticModel(rows, labels);
  if (!model) {
    return {
      type: "lexicon_fallback",
      version: MODEL_VERSION,
      trainedOn: cleanReviews.length,
      vocab: [],
      weights: [],
    };
  }

  return {
    type: "logistic_regression",
    version: MODEL_VERSION,
    trainedOn: cleanReviews.length,
    vocab,
    weights: model.weights,
  };
};

const predictFromLexicon = (review) => {
  const tokens = tokenize(reviewToText(review));
  let pos = 0;
  let neg = 0;

  tokens.forEach((token) => {
    if (LEXICON.positive.includes(token)) pos += 1;
    if (LEXICON.negative.includes(token)) neg += 1;
  });

  const rating = Number(review.rating || 3);
  const ratingSignal = (clamp(rating, 1, 5) - 3) / 2;
  const textSignal = clamp((pos - neg) / Math.max(tokens.length, 1), -1, 1);
  const score = clamp(ratingSignal * 0.7 + textSignal * 0.3, -1, 1);

  if (score > 0.2) {
    return { label: "positive", score, confidence: clamp(0.45 + Math.abs(score), 0, 0.9) };
  }
  if (score < -0.2) {
    return { label: "negative", score, confidence: clamp(0.45 + Math.abs(score), 0, 0.9) };
  }
  return { label: "neutral", score, confidence: 0.5 };
};

const predictSentiment = (review, model) => {
  if (!model || model.type !== "logistic_regression" || !model.vocab?.length) {
    return {
      ...predictFromLexicon(review),
      modelType: "lexicon_fallback",
      modelVersion: MODEL_VERSION,
    };
  }

  const vocabIndex = new Map(model.vocab.map((token, index) => [token, index]));
  const vector = vectorizeReview(review, vocabIndex);
  let score = 0;
  for (let i = 0; i < vector.length; i += 1) {
    score += vector[i] * (model.weights[i] || 0);
  }

  const probability = sigmoid(score);
  const centeredScore = clamp((probability - 0.5) * 2, -1, 1);
  let label = "neutral";
  if (probability >= 0.62) label = "positive";
  if (probability <= 0.38) label = "negative";

  return {
    label,
    score: centeredScore,
    confidence: clamp(Math.abs(probability - 0.5) * 2, 0.1, 0.99),
    modelType: model.type,
    modelVersion: model.version || MODEL_VERSION,
  };
};

const getSentimentModel = async (ReviewModel) => {
  const now = Date.now();
  if (cachedModel && now - cachedAt < CACHE_TTL_MS) {
    return cachedModel;
  }

  const reviews = await ReviewModel.find({})
    .sort({ createdAt: -1 })
    .limit(1200)
    .select("title message rating")
    .lean();

  cachedModel = trainSentimentModel(reviews);
  cachedAt = now;
  return cachedModel;
};

const analyzeReviewSentiment = async (ReviewModel, review) => {
  const model = await getSentimentModel(ReviewModel);
  return predictSentiment(review, model);
};

const buildSentimentSummary = (reviews = []) => {
  const summary = {
    total: reviews.length,
    positive: 0,
    neutral: 0,
    negative: 0,
    averageSentimentScore: 0,
  };

  if (!reviews.length) return summary;

  let scoreSum = 0;
  reviews.forEach((review) => {
    const label = review.sentimentLabel || "neutral";
    summary[label] = (summary[label] || 0) + 1;
    scoreSum += Number(review.sentimentScore || 0);
  });

  summary.averageSentimentScore = Number((scoreSum / reviews.length).toFixed(3));
  return summary;
};

const extractTopTerms = (reviews = [], { label = "negative", limit = 6 } = {}) => {
  const counter = new Map();
  reviews
    .filter((review) => review.sentimentLabel === label)
    .forEach((review) => {
      tokenize(reviewToText(review)).forEach((token) => {
        counter.set(token, (counter.get(token) || 0) + 1);
      });
    });

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
};

module.exports = {
  MODEL_VERSION,
  analyzeReviewSentiment,
  buildSentimentSummary,
  extractTopTerms,
};
