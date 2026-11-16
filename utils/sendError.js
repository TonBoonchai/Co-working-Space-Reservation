const errorMessage = require("./errorMessage");

// Bad ids / invalid data are the client's fault (400); anything else is 500
module.exports = (res, err, fallback) => {
  console.log(err);
  const clientError = ["CastError", "ValidationError"].includes(err.name);
  return res.status(clientError ? 400 : 500).json({
    success: false,
    message: errorMessage(err, fallback),
  });
};
