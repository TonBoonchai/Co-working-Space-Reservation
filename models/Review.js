const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: [true, "Please add a rating"],
    min: [1, "Rating must be from 1 to 5"],
    max: [5, "Rating must be from 1 to 5"],
    validate: {
      validator: Number.isInteger,
      message: "Rating must be a whole number from 1 to 5",
    },
  },
  comment: {
    type: String,
    required: [true, "Please add a comment"],
    trim: true,
    maxlength: [1000, "Comment can not be more than 1000 characters"],
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
  // One review per reservation. The reservation can be deleted later,
  // and the review stays.
  reservation: {
    type: mongoose.Schema.ObjectId,
    ref: "Reservation",
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ReviewSchema.index({ coworkingSpace: 1, createdAt: -1 });

module.exports = mongoose.model("Review", ReviewSchema);
