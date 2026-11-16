const mongoose = require("mongoose");

const ClosureSchema = new mongoose.Schema({
  coworkingSpace: {
    type: mongoose.Schema.ObjectId,
    ref: "CoworkingSpace",
    required: true,
  },
  startTime: {
    type: Date,
    required: [true, "Please add a start time"],
  },
  endTime: {
    type: Date,
    required: [true, "Please add an end time"],
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [512, "Reason can not be more than 512 characters"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Used by the overlap queries (see utils/overlap.js)
ClosureSchema.index({ coworkingSpace: 1, startTime: 1, endTime: 1 });

// End time must be later than start time
ClosureSchema.pre("validate", function () {
  const bothValid =
    this.startTime instanceof Date &&
    this.endTime instanceof Date &&
    !isNaN(this.startTime) &&
    !isNaN(this.endTime);

  if (bothValid && this.endTime <= this.startTime) {
    this.invalidate("endTime", "End time must be later than start time");
  }
});

module.exports = mongoose.model("Closure", ClosureSchema);
