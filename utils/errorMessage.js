// Turn a Mongoose error into a short, readable message for API responses
module.exports = (err, fallback) => {
  if (err.code === 11000) {
    return `Duplicate value for ${Object.keys(err.keyValue || {}).join(", ")}`;
  }

  if (err.name === "ValidationError") {
    return Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  if (err.name === "CastError") {
    return `Invalid ${err.path}: ${err.value}`;
  }

  return fallback;
};
