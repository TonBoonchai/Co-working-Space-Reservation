# Additional Requirements

Note: IDs are for verbal referencing only. Do not persist them anywhere. Do not reference unimplement requirements anywhere either.

## Review Management

- \[x\] RM-1 The system shall allow the user to rate a co-working space from 1 to 5 and write a review, only after one of their own reservations at that space has ended, and only once per reservation.
- \[x\] RM-2 The system shall show the average rating and review count of each co-working space.
- \[x\] RM-3 The system shall allow the admin to view and delete any review.
- \[x\] RM-4 The system shall allow the user to view reviews of any co-working spaces.

## Space Management

- \[x\] SM-1 The system shall allow the admin to create/read/update/delete closure periods for a co-working space (e.g., for maintenance)
- \[x\] SM-2 The system shall reject new reservations or edits to existing reservations that overlap a closure period.
- \[x\] SM-3 The system shall reject new closure periods that overlap with existing reservations.
- \[x\] SM-4 The system shall allow the admin to specify co-working space capacity.
- \[x\] SM-5 The system shall reject new reservations if the co-working space is full.
- \[x\] SM-6 The system shall allow the admin to perform force co-working space closure (evict all reservations in the closure period).

## Notification Management

- \[x\] NM-1 The system shall send an email to notify the user if their reservations have been canceled by closure.
- \[x\] NM-2 The system shall send an email to the user if the admin edits or deletes their reservation.
- \[x\] NM-3 The system shall send an email to the user when the system gives them a reservation from the waitlist.

## Waitlist Management

- \[x\] WM-1 The system shall allow the user to join a waitlist for a co-working space when the space is full for the requested period.
- \[x\] WM-2 The system shall automatically give the reservation to the first user on the waitlist when a reservation in that period is canceled.
- \[x\] WM-3 The system shall allow the user to view and leave their waitlist entries.