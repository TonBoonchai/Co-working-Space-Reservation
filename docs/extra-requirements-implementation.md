# How the Extra Requirements Work

A short guide for a 5-minute video. Each section gives the idea, then the code to show.

## Suggested timing

| Part | Time |
|---|---|
| Two shared parts: overlap filter and space lock | 0:45 |
| Review management | 0:50 |
| Closure and force closure | 1:00 |
| Capacity | 0:40 |
| Notifications | 0:45 |
| Waitlist | 1:00 |

## 1. Two shared parts

Closures, capacity, reviews and the waitlist all use these two parts.

**Overlap filter.** Two periods overlap when one starts before the other ends. Periods that only touch (12:00–12:00) do not overlap.

- [`utils/overlap.js:3`](../utils/overlap.js#L3): `startTime < end` and `endTime > start`.

**Space lock.** A check ("is there a conflict?") and a write ("create the reservation") must run as one step. If they do not, two requests at the same time can both pass the check. Each check-and-write runs in one MongoDB transaction that first writes to the space document. MongoDB then lets only one transaction for a space go through, and it runs the other again.

- [`utils/spaceLock.js:26`](../utils/spaceLock.js#L26): `withSpaceLock(spaceId, fn)`.
- `npm run test:race` sends 20 reservation-and-closure pairs at the same time. In each pair, exactly one request succeeds.

## 2. Review management

| Rule | How | Code |
|---|---|---|
| Review only your own reservation | The reservation owner must be the user. | [`controllers/reviews.js:90`](../controllers/reviews.js#L90) |
| Review only after it ends | `reservation.endTime > now` is rejected. | [`controllers/reviews.js:97`](../controllers/reviews.js#L97) |
| Rating 1 to 5 | Schema `min`, `max` and a whole-number check. | [`models/Review.js:4`](../models/Review.js#L4) |
| Once per reservation | A check in the lock, plus a `unique` index on `reservation`. | [`controllers/reviews.js:112`](../controllers/reviews.js#L112), [`models/Review.js:32`](../models/Review.js#L32) |
| Average rating and count | Each review create or delete calculates them again with an aggregate, in the same transaction. They are stored on the space, so every space response has them. | [`utils/spaceRating.js:12`](../utils/spaceRating.js#L12) |
| Users view reviews | `GET /coworkingspaces/:id/reviews` and `GET /reviews` are public. Only the reviewer's name shows. | [`controllers/reviews.js:8`](../controllers/reviews.js#L8) |
| Admin deletes any review | The route allows the admin only. | [`routes/reviews.js:20`](../routes/reviews.js#L20) |

Clients cannot set `averageRating` or `reviewCount`, because the space create and update remove these fields ([`controllers/coworkingspaces.js:10`](../controllers/coworkingspaces.js#L10)).

## 3. Closure and force closure

**Closure CRUD.** A closure is a period when one space is closed. The model is [`models/Closure.js`](../models/Closure.js). The routes allow the admin only to create, update and delete ([`routes/closures.js:15`](../routes/closures.js#L15)).

**Reservation in a closure is rejected.** A reservation create or edit calls `findClosureConflict` inside the lock.

- [`utils/closureConflict.js:8`](../utils/closureConflict.js#L8)
- Used in [`controllers/reservations.js:144`](../controllers/reservations.js#L144) (create) and [`controllers/reservations.js:246`](../controllers/reservations.js#L246) (edit).

**Closure over a reservation is rejected.** The closure create counts the overlapping reservations ([`controllers/closures.js:38`](../controllers/closures.js#L38)).

**Force closure.** With `"force": true`, the closure create does not reject. It deletes the overlapping reservations in the same transaction, and returns `canceledReservations` ([`controllers/closures.js:64`](../controllers/closures.js#L64), [`controllers/closures.js:164`](../controllers/closures.js#L164)). The freed places then go to the waitlist.

## 4. Capacity

**Admin sets capacity.** `capacity` is a required whole number, at least 1, on the space ([`models/CoworkingSpace.js:37`](../models/CoworkingSpace.js#L37)).

**Full space rejects a reservation.** "Full" means: at some time in the requested period, the number of active reservations equals the capacity. A simple count of overlapping reservations is not correct. For example, 9:00–10:00 and 11:00–12:00 both overlap 9:00–12:00, but they are never active at the same time.

- [`utils/capacity.js:9`](../utils/capacity.js#L9) `peakOverlap`: a sweep over the start and end times finds the largest number of reservations active at the same time.
- [`utils/capacity.js:40`](../utils/capacity.js#L40) `findCapacityConflict`: the error gives the first full time. An edited reservation does not count against itself.

## 5. Notifications

All emails are in one file: [`utils/notifications.js`](../utils/notifications.js). [`utils/sendEmail.js`](../utils/sendEmail.js) sends them with Nodemailer. Without `SMTP_HOST`, the server writes each email to the console.

| Email | Sent from |
|---|---|
| A closure canceled your reservation | [`controllers/closures.js:200`](../controllers/closures.js#L200) |
| An admin edited your reservation | [`controllers/reservations.js:283`](../controllers/reservations.js#L283) |
| An admin deleted your reservation | [`controllers/reservations.js:338`](../controllers/reservations.js#L338) |
| You got a reservation from the waitlist | after each `fillFromWaitlist`, for example [`controllers/reservations.js:333`](../controllers/reservations.js#L333) |

The admin emails go only when an admin changes the reservation of a different user ([`controllers/reservations.js:27`](../controllers/reservations.js#L27)).

The server sends emails only after the transaction commits, and it does not wait for them. A failed email does not undo the change.

## 6. Waitlist

**Join only when full.** A join uses the same time rules as a reservation. The space must be full at some time in the period, and one user cannot have two overlapping entries ([`controllers/waitlist.js:63`](../controllers/waitlist.js#L63)). The model is [`models/WaitlistEntry.js`](../models/WaitlistEntry.js). `createdAt` gives the waitlist order.

**First user gets the place.** `fillFromWaitlist` ([`utils/waitlist.js:19`](../utils/waitlist.js#L19)) reads the future entries of the space, oldest first. An entry becomes a reservation when all of these are true:

- the user is under the reservation limit
- no closure overlaps the entry
- the space has a place for the whole period

An entry that fails stays, and the next entry gets a chance.

`fillFromWaitlist` runs in the same transaction as each write that can free a place:

- reservation delete ([`controllers/reservations.js:329`](../controllers/reservations.js#L329))
- reservation edit ([`controllers/reservations.js:267`](../controllers/reservations.js#L267))
- force closure ([`controllers/closures.js:191`](../controllers/closures.js#L191))

**View and leave.** `GET /waitlist` shows a user only their own entries. The admin sees all entries ([`controllers/waitlist.js:36`](../controllers/waitlist.js#L36)). `DELETE /waitlist/:id` removes one entry ([`controllers/waitlist.js:167`](../controllers/waitlist.js#L167)).
