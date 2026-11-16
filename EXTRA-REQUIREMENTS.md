# Additional Requirements

Note: IDs are for verbal referencing only. Do not persist them anywhere. Do not reference unimplement requirements anywhere either.

## Payment Management

- PM-1 The system shall allow the admin to set an hourly rate for each co-working space, and shall calculate the total price of a reservation from its duration and show it in the reservation details.
- PM-2 The system shall keep a new reservation in pending status until the user completes payment through a third-party payment gateway (Stripe, in test mode for the demo), and shall automatically cancel a reservation that remains unpaid 10 minutes after creation.
- PM-3 The system shall reject an edit or cancellation by a user less than 2 hours before the scheduled start time, and shall issue a full refund through the payment gateway when a paid reservation is cancelled earlier than that.
- PM-4 The system shall allow a registered user to rate a co-working space from 1 to 5 and write a review, only after one of their own reservations at that space has ended, and only once per reservation.
- PM-5 The system shall show the average rating and review count of each co-working space, and shall allow the admin to delete any review.

## Space Management

- SM-1 The system shall allow the admin to create/read/update/delete closure periods for a co-working space (e.g., for maintenance)
- SM-2 The system shall reject new reservations or edits to existing reservations that overlap a closure period.
- SM-3 The system shall reject new closure periods that overlap with existing reservations.
