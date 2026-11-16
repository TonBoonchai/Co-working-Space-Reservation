const mongoose = require("mongoose");
const CoworkingSpace = require("../models/CoworkingSpace");

// Write to the co-working space in the transaction of session.
// Two transactions that lock the same space write to the same document.
const lockSpace = (coworkingSpaceId, session) =>
  CoworkingSpace.updateOne(
    { _id: coworkingSpaceId },
    { $inc: { lockVersion: 1 } },
    { session },
  );

exports.lockSpace = lockSpace;

// Run fn(session) in a transaction that first writes to the co-working space.
//
// The overlap checks read one collection and write to the other, so two
// requests at the same time could both find no conflict and both write.
// With this lock, two transactions for the same space write to the same
// document. MongoDB aborts one of them with a write conflict, and
// withTransaction runs it again. The second run sees the data of the first.
//
// fn can run more than once. It must use the session for every query and
// write, and it must not change state outside the transaction.
// When fn also changes a second space, it must call lockSpace for that space.
exports.withSpaceLock = (coworkingSpaceId, fn) =>
  mongoose.connection.transaction(async (session) => {
    await lockSpace(coworkingSpaceId, session);
    return fn(session);
  });
