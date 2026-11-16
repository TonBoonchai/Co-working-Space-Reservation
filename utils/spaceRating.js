const mongoose = require("mongoose");
const CoworkingSpace = require("../models/CoworkingSpace");
const Review = require("../models/Review");

// Fields that only this file writes. Remove them from a client's body.
exports.RATING_FIELDS = ["averageRating", "reviewCount"];

// Calculate averageRating and reviewCount of a space again from its reviews,
// and save them on the space.
// Run it inside withSpaceLock, with the same session as the review write,
// so that two review writes for one space cannot save an old value.
exports.updateSpaceRating = async (coworkingSpaceId, session) => {
  const [stats] = await Review.aggregate([
    {
      $match: {
        coworkingSpace: new mongoose.Types.ObjectId(String(coworkingSpaceId)),
      },
    },
    {
      $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } },
    },
  ]).session(session);

  await CoworkingSpace.updateOne(
    { _id: coworkingSpaceId },
    {
      averageRating: stats ? Math.round(stats.average * 100) / 100 : null,
      reviewCount: stats ? stats.count : 0,
    },
    { session },
  );
};
