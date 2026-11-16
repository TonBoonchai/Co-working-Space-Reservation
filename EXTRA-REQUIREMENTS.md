# Additional Requirements

Note: IDs are for verbal referencing only. Do not persist them anywhere. Do not reference unimplement requirements anywhere either.

## Payment Management

- \[x\] PM-1 The system shall allow the admin to set an hourly rate for each co-working space in Thai Baht per hour.
- \[ \] PM-2 The system shall allow the user to calculate the total price in THB of a reservation from its duration.
- \[ \] PM-3 The system shall keep a new reservation in pending status until the user completes payment through Stripe payment gateway. 
- \[ \] PM-4 The system shall automatically cancel a reservation that remains unpaid 10 minutes after creation.
- \[ \] PM-5 The system shall issue a full refund through the payment gateway when a paid reservation is cancelled earlier than 2 hours before the scheduled start time.

## Review Management

- \[ \] RM-1 The system shall allow a user to rate a co-working space from 1 to 5 and write a review, only after one of their own reservations at that space has ended, and only once per reservation.
- \[ \] RM-2 The system shall allow the user to view the average rating and review count of each co-working space
- \[ \] RM-3 The system shall allow the admin to view and delete any review.

## Space Management

- \[x\] SM-1 The system shall allow the admin to create/read/update/delete closure periods for a co-working space (e.g., for maintenance)
- \[x\] SM-2 The system shall reject new reservations or edits to existing reservations that overlap a closure period.
- \[x\] SM-3 The system shall reject new closure periods that overlap with existing reservations.
- \[ \] SM-4 The system shall reject an edit or cancellation by a user less than 2 hours before the scheduled start time. 
