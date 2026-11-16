# Co-working Space Reservation API

Term project #6 for **2110503 Software Development Practice**: a REST API that lets users reserve co-working spaces. It is built by modifying the course's **VacQ** tutorial code (hospitals/appointments became co-working spaces/reservations).

## Requirements

**Functional**

1. A user registers with a name, telephone number (Thai format), email and password.
2. A registered user logs in with email and password, and can log out.
3. After logging in, a user can reserve up to **3** times by choosing a date (with a start and end time) and a co-working space. The co-working space list is provided; each space has a name, address, telephone number, open-close time and capacity.
4. A user can view, edit and delete **their own** reservations.
5. An admin can view, edit and delete **any** reservation.

**Non-functional:** username-password authentication, confidential transactions (users only see their own reservations), a response within 3 seconds, and testing via Postman.

**Constraints:** a REST web API with no frontend, and MongoDB Atlas as the database. Per the project rules it runs on **localhost only**, with no cloud deploy, Swagger or security-hardening middleware.

## Tech stack

Node.js, Express 5, MongoDB Atlas with Mongoose, JWT (`jsonwebtoken`), `bcryptjs`, `cookie-parser`, `nodemailer`, and Postman/Newman for testing.

## Getting started

```bash
npm install
cp config/config.env.example config/config.env   # then fill in MONGO_URI and JWT_SECRET
npm run dev                                       # http://localhost:5050
```

`config/config.env` is gitignored. Never commit it.

To send emails, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_EMAIL` and `SMTP_PASSWORD` in `config/config.env` (see `config/config.env.example`). When `SMTP_HOST` is empty, the server writes each email to its console and does not send it.

## API

Base URL: `http://localhost:5050/api/v1`. Private routes need `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register (`name`, `tel`, `email`, `password`, optional `role`) |
| POST | `/auth/login` | Public | Log in, returns a token and sets a `token` cookie |
| GET | `/auth/me` | Private | Current user |
| GET | `/auth/logout` | Public | Clear the token cookie |
| GET | `/coworkingspaces` | Public | List spaces (supports `select`, `sort`, `page`, `limit`, `gt/gte/lt/lte/in` filters) |
| GET | `/coworkingspaces/:id` | Public | One space |
| POST | `/coworkingspaces` | Admin | Create a space (`name`, `address`, `tel`, `openTime`, `closeTime`, `capacity`) |
| PUT | `/coworkingspaces/:id` | Admin | Update a space, for example its `capacity` |
| DELETE | `/coworkingspaces/:id` | Admin | Delete a space, its reservations, its closures, its reviews and its waitlist entries |
| POST | `/coworkingspaces/:coworkingSpaceId/reservations` | User/Admin | Create a reservation (`startTime`, `endTime`) |
| GET | `/coworkingspaces/:coworkingSpaceId/reservations` | Private | Reservations at one space (own only for users) |
| GET | `/reservations` | Private | Users: own reservations. Admin: all |
| GET | `/reservations/:id` | Owner/Admin | One reservation |
| PUT | `/reservations/:id` | Owner/Admin | Change `startTime`, `endTime` or `coworkingSpace` |
| DELETE | `/reservations/:id` | Owner/Admin | Delete a reservation |
| GET | `/coworkingspaces/:coworkingSpaceId/closures` | Public | Closures of one space, sorted by `startTime` |
| POST | `/coworkingspaces/:coworkingSpaceId/closures` | Admin | Create a closure (`startTime`, `endTime`, optional `reason`, optional `force`) |
| GET | `/closures` | Public | All closures, with the space name and address |
| GET | `/closures/:id` | Public | One closure |
| PUT | `/closures/:id` | Admin | Change `startTime`, `endTime` or `reason` (optional `force`) |
| DELETE | `/closures/:id` | Admin | Delete a closure |
| POST | `/reservations/:reservationId/reviews` | Owner | Review the space of one ended reservation (`rating` 1-5, `comment`) |
| GET | `/reservations/:reservationId/reviews` | Public | The review of one reservation |
| GET | `/coworkingspaces/:coworkingSpaceId/reviews` | Public | Reviews of one space, newest first |
| GET | `/reviews` | Public | All reviews, with the reviewer name and the space |
| GET | `/reviews/:id` | Public | One review |
| DELETE | `/reviews/:id` | Admin | Delete a review |
| POST | `/coworkingspaces/:coworkingSpaceId/waitlist` | User/Admin | Join the waitlist of a full space (`startTime`, `endTime`) |
| GET | `/coworkingspaces/:coworkingSpaceId/waitlist` | Private | Waitlist entries at one space (own only for users) |
| GET | `/waitlist` | Private | Users: own waitlist entries. Admin: all |
| DELETE | `/waitlist/:id` | Owner/Admin | Leave the waitlist (delete one entry) |

Example co-working space body:

```json
{ "name": "Siam Co-Work Hub", "address": "254 Phayathai Rd, Pathum Wan, Bangkok 10330", "tel": "02-123-4567", "openTime": "08:00", "closeTime": "20:00", "capacity": 20 }
```

Example reservation body (times are Bangkok time):

```json
{ "startTime": "2026-12-01T09:00:00+07:00", "endTime": "2026-12-01T12:00:00+07:00" }
```

Example closure body (a closure can span many days):

```json
{ "startTime": "2026-12-05T00:00:00+07:00", "endTime": "2026-12-07T00:00:00+07:00", "reason": "Air conditioner maintenance" }
```

Example force closure body (cancels the reservations in the period):

```json
{ "startTime": "2026-12-05T00:00:00+07:00", "endTime": "2026-12-07T00:00:00+07:00", "reason": "Water leak", "force": true }
```

Example review body:

```json
{ "rating": 4, "comment": "Quiet room and fast Wi-Fi." }
```

### Rules and validation

- **Reservation:** must start in the future, end after it starts, start and end on the same day, and fit inside the space's `openTime`-`closeTime`. It must not overlap a closure of its space, and the space must not be full at any time during it. A general user can hold at most 3 reservations; admins have no limit.
- **Capacity:** the maximum number of reservations at one space that can overlap at the same time. It is a whole number, at least 1, and it is required when a space is created. A space is full at a time when that many reservations are active. A new or edited reservation is rejected when the space is full at any time during it (the error gives the first full time). An edited reservation does not count against its own capacity. Reservations that only touch (12:00-12:00) do not overlap. A lower capacity does not change the reservations that already exist. The check and the write run under the same space lock as the closure checks.
- **Closure:** a period when one space is closed, for example for maintenance. The end must be later than the start. A closure must not overlap a reservation at its space (the error gives the number of reservations). A `PUT` cannot move a closure to a different space. Two periods overlap only when one starts before the other ends, so periods that only touch (12:00-12:00) are allowed. The overlap rules apply to admins too. The overlap check and the write run in one MongoDB transaction that locks the space, so two requests at the same time cannot create an overlap.
- **Force closure:** with `"force": true`, a closure `POST` or `PUT` does not reject the reservations in its period. It deletes them in the same transaction as the closure write. `force` must be `true` or `false`. The response gives the number of deleted reservations in `canceledReservations` (`0` without force).
- **Cancellation email:** after a force closure, the server sends one email to the owner of each deleted reservation. The email gives the space, the reservation time, the closure time and the reason. The response does not wait for the emails, and an email that fails does not undo the closure.
- **Admin change email:** when an admin edits or deletes the reservation of a different user, the server sends one email to that user. An edit email gives the space and the time before and after the edit. A delete email gives the space and the time. The response does not wait for the email.
- **Waitlist:** a user can join the waitlist of a space only when the space is full at some time in the requested period. The period follows the reservation time rules, and it must not overlap a closure. A user at the reservation limit cannot join. One user cannot have two entries at one space that overlap.
- **Waitlist reservation:** a delete, an edit or a force closure can free a place at a space. In the same transaction, the server checks the future waitlist entries of that space, oldest first. An entry becomes a reservation when the space has a place for its whole period, no closure overlaps it, and its user is under the reservation limit. Other entries stay on the waitlist. The server then sends one email to the user of each new reservation.
- **Review:** only the owner of a reservation can review it, and only after the reservation ends. A reservation can have one review. The rating is a whole number from 1 to 5, and the comment is required (at most 1000 characters). The space comes from the reservation. Only the admin can delete a review. A review stays when its reservation is deleted. A review shows only the reviewer's name.
- **Rating of a space:** each space has `averageRating` (rounded to 2 decimals, `null` when there are no reviews) and `reviewCount`. The API calculates them again after each review create or delete, under the same space lock as the closure checks. A client cannot set them in a space `POST` or `PUT`.
- **Ownership:** a user can only view, edit or delete their own reservations (401 otherwise). An edit can never change who owns a reservation.
- **Thai telephone numbers** (users and spaces, dashes optional):
  - mobile `081-234-5678` / `0812345678`
  - Bangkok `02-123-4567`
  - provincial `053-123-456`
- **Co-working space hours:** `openTime` and `closeTime` use `HH:mm` (24-hour), and the close time must be later than the open time.

## Testing with Postman / Newman

Import both files from [`postman/`](postman/) into Postman, select the **Co-working Space Reservation - Local** environment, and run the collection with the **Collection Runner**. Or run it from the terminal (with the server running):

```bash
npm install -g newman newman-reporter-htmlextra
npm run test:api            # CLI output
npm run test:api:report     # also writes newman/report.html
npm run test:race           # concurrent reservation + closure requests (about 15 s)
```

The collection creates its own admin, user and spaces with unique names for each run, and deletes the spaces at the end, so it can be run repeatedly. Current result: 83 requests, 149 assertions, all passing.

The review folders make a reservation that ends a few seconds after it starts, and wait for it to end. A reservation must start and end on the same day, so these folders fail near midnight Bangkok time.

`npm run test:api` also deletes the admin, the users and any spaces left by the run, also when the run fails. It connects to MongoDB directly ([`tests/teardown.js`](tests/teardown.js)), because the API has no route that deletes a user. It deletes only `@coworking.test` accounts. A run in the Postman app does not do this, so its admin and users stay in the database.

`npm run test:race` sends 20 pairs of requests at the same time. Each pair is one reservation and one closure for the same space and time. Exactly one request of each pair must succeed. The script makes its own admin and space, and deletes both at the end, also when the test fails.

### Presentation steps → Postman folders

| Step | Function check | Folder |
|---|---|---|
| – | Admin prepares spaces | `00 Setup (Admin prepares data)` |
| 1 | User Registration + Validation Check | `01 User Registration + Validation Check` |
| 2 | User Log-in | `02 User Log-in` |
| 3 | User View Product | `03 User View Co-working Spaces` |
| 4 | User Create Booking | `04 User Create Reservation` |
| 4+ | Check Create Condition | `04+ Check Create Condition` |
| 5 | User View Own Booking | `05 User View Own Reservations` |
| 6 | User Edit Own Booking | `06 User Edit Own Reservation` |
| 7 | User Delete Own Booking | `07 User Delete Own Reservation` |
| 8 | User Log-out | `08 User Log-out` |
| 9 | Admin Log-in | `09 Admin Log-in` |
| 10 | Admin View Any Booking | `10 Admin View Any Reservation` |
| 11 | Admin Edit Any Booking | `11 Admin Edit Any Reservation` |
| 12 | Admin Delete Any Booking | `12 Admin Delete Any Reservation` |
| 13 | Admin Manage Closure Periods | `13 Admin Manage Closure Periods` |
| 13+ | Check Closure Conditions | `13+ Check Closure Conditions` |
| 14 | User Review Co-working Space | `14 User Review Co-working Space` |
| 14+ | Check Review Conditions | `14+ Check Review Conditions` |
| 15 | Admin Manage Reviews | `15 Admin Manage Reviews` |
| 16 | Admin Set Capacity | `16 Admin Set Capacity` |
| 17 | Admin Force Closure | `17 Admin Force Closure` |
| 18 | User Join Waitlist | `18 User Join Waitlist` |
| 19 | Waitlist Gives Reservation | `19 Waitlist Gives Reservation` |
| 20 | User Leave Waitlist | `20 User Leave Waitlist` |
| – | Remove demo spaces | `99 Cleanup` |

## Diagrams

PlantUML sources are in [`docs/diagrams/`](docs/diagrams/), and rendered PNGs are in [`docs/diagrams/png/`](docs/diagrams/png/).

- Use case: [`usecase.png`](docs/diagrams/png/usecase.png)
- Class diagram (UML Profile for REST): [`class.png`](docs/diagrams/png/class.png)
- Sequence diagrams: [register](docs/diagrams/png/01-register.png), [login](docs/diagrams/png/02-login.png), [view spaces](docs/diagrams/png/03-view-coworking-spaces.png), [create reservation](docs/diagrams/png/04-create-reservation.png), [view reservations](docs/diagrams/png/05-view-reservations.png), [edit reservation](docs/diagrams/png/06-update-reservation.png), [delete reservation](docs/diagrams/png/07-delete-reservation.png), [logout](docs/diagrams/png/08-logout.png), [create closure](docs/diagrams/png/09-create-closure.png), [create review](docs/diagrams/png/10-create-review.png), [join waitlist](docs/diagrams/png/11-join-waitlist.png)

To re-render, use the PlantUML VS Code extension, or run `java -jar plantuml.jar -tpng docs/diagrams/**/*.puml`.

## Changes from the original VacQ code

The first commit is VacQ as it was, so `git diff` against it (or the pull request) shows every change.

| Area | VacQ | This project |
|---|---|---|
| Resources | `Hospital`, `Appointment` | `CoworkingSpace` (name, address, tel, openTime, closeTime, capacity), `Reservation` (startTime, endTime) |
| Routes | `/hospitals`, `/appointments` | `/coworkingspaces`, `/reservations`, nested `/coworkingspaces/:id/reservations` |
| Registration | name, email, password | adds required **Thai telephone number**; errors explain what is wrong (invalid tel, duplicate email) |
| Create rules | max 3 appointments | max 3, plus future start, end after start, same day, within open-close hours |
| View single | any logged-in user could read any appointment | owner or admin only |
| Update | whole body applied (could change the owner) | only `startTime` / `endTime` / `coworkingSpace`, re-validated |
| Public space list | populated every appointment | no reservation data exposed |
| Removed | Swagger, Ch12 security middleware, Postgres albums demo | not required by the project rules |

## Team

| Member | Responsibility |
|---|---|

GitHub: https://github.com/TonBoonchai/Co-working-Space-Reservation
