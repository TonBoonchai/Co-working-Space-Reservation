const mongoose = require("mongoose");

// A request for a period when the co-working space is full.
// When a place opens, utils/waitlist.js turns the entry into a reservation.
const WaitlistEntrySchema = new mongoose.Schema({
  startTime: {
    type: Date,
    required: [true, "Please add a start time"],
  },
  endTime: {
    type: Date,
    required: [true, "Please add an end time"],
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  coworkingSpace: {
    type: mongoose.Schema.ObjectId,
    ref: "CoworkingSpace",
    required: true,
  },
  // The waitlist order: the first entry gets the first place
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

WaitlistEntrySchema.index({ coworkingSpace: 1, createdAt: 1 });

module.exports = mongoose.model("WaitlistEntry", WaitlistEntrySchema);
