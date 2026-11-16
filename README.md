# Co-working Space Reservation API

Term project #6 for **2110503 Software Development Practice**: a REST API that lets users reserve co-working spaces. It is built by modifying the course's **VacQ** tutorial code (hospitals/appointments became co-working spaces/reservations).

## Requirements

**Functional**

1. A user registers with a name, telephone number (Thai format), email and password.
2. A registered user logs in with email and password, and can log out.
3. After logging in, a user can reserve up to **3** times by choosing a date (with a start and end time) and a co-working space. The co-working space list is provided; each space has a name, address, telephone number and open-close time.
4. A user can view, edit and delete **their own** reservations.
5. An admin can view, edit and delete **any** reservation.

**Non-functional:** username-password authentication, confidential transactions (users only see their own reservations), a response within 3 seconds, and testing via Postman.

**Constraints:** a REST web API with no frontend, and MongoDB Atlas as the database. Per the project rules it runs on **localhost only**, with no cloud deploy, Swagger or security-hardening middleware.

## Tech stack

Node.js, Express 5, MongoDB Atlas with Mongoose, JWT (`jsonwebtoken`), `bcryptjs`, `cookie-parser`, and Postman/Newman for testing.

## Getting started

```bash
npm install
cp config/config.env.example config/config.env   # then fill in MONGO_URI and JWT_SECRET
npm run dev                                       # http://localhost:5050
```

`config/config.env` is gitignored. Never commit it.

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
| POST | `/coworkingspaces` | Admin | Create a space (`name`, `address`, `tel`, `openTime`, `closeTime`, `hourlyRate`) |
| PUT | `/coworkingspaces/:id` | Admin | Update a space |
| DELETE | `/coworkingspaces/:id` | Admin | Delete a space, its reservations and its closures |
| POST | `/coworkingspaces/:id/price` | Public | Calculate the price of a reservation (`startTime`, `endTime`) |
| POST | `/coworkingspaces/:coworkingSpaceId/reservations` | User/Admin | Create a reservation (`startTime`, `endTime`) |
| GET | `/coworkingspaces/:coworkingSpaceId/reservations` | Private | Reservations at one space (own only for users) |
| GET | `/reservations` | Private | Users: own reservations. Admin: all |
| GET | `/reservations/:id` | Owner/Admin | One reservation |
| PUT | `/reservations/:id` | Owner/Admin | Change `startTime`, `endTime` or `coworkingSpace` |
| DELETE | `/reservations/:id` | Owner/Admin | Delete a reservation |
| GET | `/coworkingspaces/:coworkingSpaceId/closures` | Public | Closures of one space, sorted by `startTime` |
| POST | `/coworkingspaces/:coworkingSpaceId/closures` | Admin | Create a closure (`startTime`, `endTime`, optional `reason`) |
| GET | `/closures` | Public | All closures, with the space name and address |
| GET | `/closures/:id` | Public | One closure |
| PUT | `/closures/:id` | Admin | Change `startTime`, `endTime` or `reason` |
| DELETE | `/closures/:id` | Admin | Delete a closure |

Example space body (`hourlyRate` is in THB per hour):

```json
{ "name": "Siam Co-Work Hub", "address": "254 Phayathai Rd, Pathum Wan, Bangkok 10330", "tel": "02-123-4567", "openTime": "08:00", "closeTime": "20:00", "hourlyRate": 150 }
```

Example reservation body (times are Bangkok time). The price calculation uses the same body:

```json
{ "startTime": "2026-12-01T09:00:00+07:00", "endTime": "2026-12-01T12:00:00+07:00" }
```

Example closure body (a closure can span many days):

```json
{ "startTime": "2026-12-05T00:00:00+07:00", "endTime": "2026-12-07T00:00:00+07:00", "reason": "Air conditioner maintenance" }
```

### Rules and validation

- **Reservation:** must start in the future, end after it starts, start and end on the same day, and fit inside the space's `openTime`-`closeTime`. It must not overlap a closure of its space. A general user can hold at most 3 reservations; admins have no limit.
- **Closure:** a period when one space is closed, for example for maintenance. The end must be later than the start. A closure must not overlap a reservation at its space (the error gives the number of reservations). A `PUT` cannot move a closure to a different space. Two periods overlap only when one starts before the other ends, so periods that only touch (12:00-12:00) are allowed. The overlap rules apply to admins too. The overlap check and the write run in one MongoDB transaction that locks the space, so two requests at the same time cannot create an overlap.
- **Ownership:** a user can only view, edit or delete their own reservations (401 otherwise). An edit can never change who owns a reservation.
- **Thai telephone numbers** (users and spaces, dashes optional):
  - mobile `081-234-5678` / `0812345678`
  - Bangkok `02-123-4567`
  - provincial `053-123-456`
- **Co-working space hours:** `openTime` and `closeTime` use `HH:mm` (24-hour), and the close time must be later than the open time.
- **Hourly rate:** `hourlyRate` is the price of a space in whole Thai Baht (THB) per hour. The minimum is `0`, and `0` means a free space. The rate is required on create and on update. Only the admin can set it. Everyone can see it, and `GET /coworkingspaces?hourlyRate[lte]=200&sort=hourlyRate` filters and sorts by it. A space from before this field has no rate. A `PUT` on such a space fails until the body includes `hourlyRate`.
- **Price:** `POST /coworkingspaces/:id/price` calculates the total price in THB of a reservation from its duration. The body is the same as a reservation body. The price is in proportion to the duration: 90 minutes at 180 THB per hour cost 270 THB. The total is rounded to 2 decimal places (satang). The same time rules as a new reservation apply. The calculation does not check closures or the limit of 3 reservations, and it does not create a reservation. A space with no rate gives a 400 error.

## Testing with Postman / Newman

Import both files from [`postman/`](postman/) into Postman, select the **Co-working Space Reservation - Local** environment, and run the collection with the **Collection Runner**. Or run it from the terminal (with the server running):

```bash
npm install                 # newman and the htmlextra reporter are devDependencies
npm run test:api            # CLI output
npm run test:api:report     # also writes newman/report.html
npm run test:race           # concurrent reservation + closure requests (about 15 s)
```

The collection creates its own admin, user and spaces with unique names for each run, and deletes the spaces at the end, so it can be run repeatedly. Current result: 83 requests, 159 assertions, all passing.

`npm run test:api` also deletes the admin, the user and any spaces left by the run, also when the run fails. It connects to MongoDB directly ([`tests/teardown.js`](tests/teardown.js)), because the API has no route that deletes a user. It deletes only `@coworking.test` accounts. A run in the Postman app does not do this, so its admin and user stay in the database.

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
| 14 | Admin Set Hourly Rate | `14 Admin Set Hourly Rate` |
| 15 | User Calculate Reservation Price | `15 User Calculate Reservation Price` |
| – | Remove demo spaces | `99 Cleanup` |

## Diagrams

PlantUML sources are in [`docs/diagrams/`](docs/diagrams/), and rendered PNGs are in [`docs/diagrams/png/`](docs/diagrams/png/).

- Use case: [`usecase.png`](docs/diagrams/png/usecase.png)
- Class diagram (UML Profile for REST): [`class.png`](docs/diagrams/png/class.png)
- Sequence diagrams: [register](docs/diagrams/png/01-register.png), [login](docs/diagrams/png/02-login.png), [view spaces](docs/diagrams/png/03-view-coworking-spaces.png), [create reservation](docs/diagrams/png/04-create-reservation.png), [view reservations](docs/diagrams/png/05-view-reservations.png), [edit reservation](docs/diagrams/png/06-update-reservation.png), [delete reservation](docs/diagrams/png/07-delete-reservation.png), [logout](docs/diagrams/png/08-logout.png), [create closure](docs/diagrams/png/09-create-closure.png), [calculate price](docs/diagrams/png/10-calculate-price.png)

To re-render, use the PlantUML VS Code extension, or run `java -jar plantuml.jar -tpng docs/diagrams/**/*.puml`.

## Changes from the original VacQ code

The first commit is VacQ as it was, so `git diff` against it (or the pull request) shows every change.

| Area | VacQ | This project |
|---|---|---|
| Resources | `Hospital`, `Appointment` | `CoworkingSpace` (name, address, tel, openTime, closeTime, hourlyRate), `Reservation` (startTime, endTime) |
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
