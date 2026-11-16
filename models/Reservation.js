const mongoose = require("mongoose");

const ReservationSchema = new mongoose.Schema({
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Used by the overlap queries (see utils/overlap.js)
ReservationSchema.index({ coworkingSpace: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model("Reservation", ReservationSchema);
