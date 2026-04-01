const sanitizeObject = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      // Block Mongo operator injection patterns in request payloads.
      if (key.startsWith("$") || key.includes(".")) {
        return acc;
      }
      acc[key] = sanitizeObject(val);
      return acc;
    }, {});
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
};

const sanitizeInput = (req, res, next) => {
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);
  next();
};

module.exports = sanitizeInput;
