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
  // Price in whole Thai Baht (THB) per hour. 0 marks a free space.
  hourlyRate: {
    type: Number,
    required: [true, "Please add an hourly rate (THB per hour)"],
    cast: "Hourly rate must be a number (THB per hour)",
    min: [0, "Hourly rate can not be less than 0 THB per hour"],
    validate: {
      validator: Number.isInteger,
      message: "Hourly rate must be a whole number of Baht",
    },
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
