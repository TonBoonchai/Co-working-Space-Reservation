const mongoose = require("mongoose");
const {
  THAI_PHONE_REGEX,
  THAI_PHONE_MESSAGE,
  TIME_HHMM_REGEX,
} = require("../utils/validators");

const CoworkingSpaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a name"],
    unique: true,
    trim: true,
    maxlength: [50, "Name can not be more than 50 characters"],
  },
  address: {
    type: String,
    required: [true, "Please add an address"],
  },
  tel: {
    type: String,
    required: [true, "Please add a telephone number"],
    trim: true,
    match: [THAI_PHONE_REGEX, THAI_PHONE_MESSAGE],
  },
  openTime: {
    type: String,
    required: [true, "Please add an open time"],
    match: [TIME_HHMM_REGEX, "Open time must be in HH:mm format (e.g. 08:00)"],
  },
  closeTime: {
    type: String,
    required: [true, "Please add a close time"],
    match: [TIME_HHMM_REGEX, "Close time must be in HH:mm format (e.g. 20:00)"],
  },
  // The maximum number of reservations that can overlap at the same time
  capacity: {
    type: Number,
    required: [true, "Please add a capacity"],
    min: [1, "Capacity must be at least 1"],
    validate: {
      validator: Number.isInteger,
      message: "Capacity must be a whole number",
    },
  },
  // Written only by utils/spaceRating.js, after each review change.
  // averageRating is null when the space has no reviews.
  averageRating: {
    type: Number,
    default: null,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Written only by utils/spaceLock.js. Hidden from API responses.
  lockVersion: {
    type: Number,
    select: false,
  },
});

// Close time must be later than open time ("HH:mm" strings compare correctly)
CoworkingSpaceSchema.pre("validate", function () {
  const bothValid =
    TIME_HHMM_REGEX.test(this.openTime) && TIME_HHMM_REGEX.test(this.closeTime);

  if (bothValid && this.closeTime <= this.openTime) {
    this.invalidate("closeTime", "Close time must be later than open time");
  }
});

module.exports = mongoose.model("CoworkingSpace", CoworkingSpaceSchema);
