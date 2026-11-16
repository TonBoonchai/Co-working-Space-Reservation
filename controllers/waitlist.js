const WaitlistEntry = require("../models/WaitlistEntry");
const CoworkingSpace = require("../models/CoworkingSpace");
const sendError = require("../utils/sendError");
const { overlapFilter } = require("../utils/overlap");
const { withSpaceLock } = require("../utils/spaceLock");
const { findCapacityConflict } = require("../utils/capacity");
const { findClosureConflict } = require("../utils/closureConflict");
const {
  MAX_RESERVATIONS,
  isAtReservationLimit,
} = require("../utils/reservationLimit");
const {
  checkReservationTime,
  formatBangkok,
} = require("../utils/reservationTime");

const populateSpace = {
  path: "coworkingSpace",
  select: "name address tel openTime closeTime",
};
const populateUser = { path: "user", select: "name email tel" };

//@desc     Get waitlist entries
//@route    GET /api/v1/waitlist
//@route    GET /api/v1/coworkingspaces/:coworkingSpaceId/waitlist
//@access   Private
exports.getWaitlistEntries = async (req, res, next) => {
  try {
    const filter = {};

    if (req.params.coworkingSpaceId) {
      filter.coworkingSpace = req.params.coworkingSpaceId;
    }

    // General users can see only their own entries. Admins see all.
    if (req.user.role !== "admin") {
      filter.user = req.user.id;
    }

    let query = WaitlistEntry.find(filter)
      .populate(populateSpace)
      .sort("startTime createdAt");

    if (req.user.role === "admin") {
      query = query.populate(populateUser);
    }

    const entries = await query;

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (err) {
    return sendError(res, err, "Cannot find Waitlist Entry");
  }
};

//@desc     Join the waitlist of a full co-working space
//@route    POST /api/v1/coworkingspaces/:coworkingSpaceId/waitlist
//@access   Private
exports.addWaitlistEntry = async (req, res, next) => {
  try {
    // POST /waitlist has no co-working space
    if (!req.params.coworkingSpaceId) {
      return res.status(400).json({
        success: false,
        message:
          "Join a waitlist with POST /api/v1/coworkingspaces/:coworkingSpaceId/waitlist",
      });
    }

    const coworkingSpace = await CoworkingSpace.findById(
      req.params.coworkingSpaceId,
    );

    if (!coworkingSpace) {
      return res.status(404).json({
        success: false,
        message: `No co-working space with the id of ${req.params.coworkingSpaceId}`,
      });
    }

    // The same time rules as a reservation
    // (A request with no body has req.body undefined in Express 5)
    const { startTime, endTime } = req.body ?? {};
    const timeError = checkReservationTime(startTime, endTime, coworkingSpace);

    if (timeError) {
      return res.status(400).json({ success: false, message: timeError });
    }

    // The entry can never become a reservation for a user at the limit
    if (await isAtReservationLimit(req.user)) {
      return res.status(400).json({
        success: false,
        message: `The user with ID ${req.user.id} has already made ${MAX_RESERVATIONS} reservations`,
      });
    }

    // The checks and the create run under one lock (see utils/spaceLock.js)
    const result = await withSpaceLock(coworkingSpace._id, async (session) => {
      const closed = await findClosureConflict(
        coworkingSpace,
        startTime,
        endTime,
        session,
      );
      if (closed) return { error: closed };

      const full = await findCapacityConflict(
        coworkingSpace,
        startTime,
        endTime,
        session,
      );
      if (!full) {
        return {
          error: `${coworkingSpace.name} is not full from ${formatBangkok(startTime)} to ${formatBangkok(endTime)}, so please make a reservation`,
        };
      }

      const duplicate = await WaitlistEntry.exists({
        ...overlapFilter(
          coworkingSpace._id,
          new Date(startTime),
          new Date(endTime),
        ),
        user: req.user.id,
      }).session(session);
      if (duplicate) {
        return {
          error:
            "You already have a waitlist entry at this space that overlaps this period",
        };
      }

      // The user and the space never come from the body
      const [entry] = await WaitlistEntry.create(
        [
          {
            startTime,
            endTime,
            user: req.user.id,
            coworkingSpace: coworkingSpace._id,
          },
        ],
        { session },
      );
      return { entry };
    });

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.status(201).json({ success: true, data: result.entry });
  } catch (err) {
    return sendError(res, err, "Cannot create Waitlist Entry");
  }
};

//@desc     Leave the waitlist (delete one entry)
//@route    DELETE /api/v1/waitlist/:id
//@access   Private (owner or admin)
exports.deleteWaitlistEntry = async (req, res, next) => {
  try {
    const entry = await WaitlistEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: `No waitlist entry with the id of ${req.params.id}`,
      });
    }

    if (entry.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this waitlist entry`,
      });
    }

    await entry.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    return sendError(res, err, "Cannot delete Waitlist Entry");
  }
};
