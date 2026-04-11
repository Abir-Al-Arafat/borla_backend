# Booking Realtime Workflow

This document explains how booking realtime and notification flows work for rider progress and payment updates.

## 1. Overview

Booking and payment actions now produce both realtime updates and persisted notifications:

1. `/:id/accept`
2. `/:id/arrive-pickup`
3. `/payments/initiate`
4. `/payments/booking-callback`
5. `/payments/initiate/cash`

When any of these actions happen, the backend:

1. Updates the booking in the database.
2. Creates notifications for the rider and the booking user.
3. Emits realtime socket events to the target user(s) so the UI updates immediately.

## 2. Socket Setup

Socket.IO is initialized in `src/app/utils/socket.ts` and attached during server boot in `src/server.ts`.

### Authentication

The socket connection expects a JWT token in one of these places:

1. `socket.handshake.auth.token`
2. `Authorization` header

If the token is missing or invalid, the connection is rejected.

### Delivery Rooms

After authentication, the server joins the user to:

- `user:{userId}`

This room is used for direct realtime updates to one specific user.

## 3. Booking Accepted Flow

Route:

- `PATCH /bookings/:id/accept`

What happens:

1. Rider accepts the booking.
2. Booking status is updated to `accepted`.
3. A notification is created for:
   - the booking user
   - the rider
4. The backend emits a socket event to the booking user:

```ts
'booking:accepted';
```

### Payload

The emitted event contains:

```ts
{
  bookingId: string;
  userId: string;
  riderId: string;
  status: string;
  message: string;
}
```

### UI meaning

The customer can immediately see that a rider has accepted the request without refreshing the page.

## 4. Arrive Pickup Flow

Route:

- `PATCH /bookings/:id/arrive-pickup`

What happens:

1. Rider presses arrive at pickup.
2. Booking status is updated to `arrived_pickup`.
3. A notification is created for:
   - the booking user
   - the rider
4. The backend emits a socket event to the booking user:

```ts
'booking:arrived_pickup';
```

### Payload

The emitted event contains:

```ts
{
  bookingId: string;
  userId: string;
  riderId: string;
  status: string;
  message: string;
}
```

### UI meaning

The customer can immediately see that the rider has arrived at the pickup point.

## 5. Payment Initiated Flow

Route:

- `POST /payments/initiate`

What happens:

1. Customer initiates online payment for a booking.
2. Pending payment transaction is created.
3. Notification is created for:
   - booking user
   - rider
4. Realtime socket event is sent to rider:

```ts
'payment:initiated';
```

### Payload

```ts
{
  bookingId: string;
  userId: string;
  riderId: string;
  status: 'pending';
  message: string;
}
```

## 6. Booking Callback Flow (Hubtel)

Route:

- `POST /payments/booking-callback`

What happens:

1. Hubtel callback reaches backend.
2. Transaction status is updated to `success` or `failed`.
3. Notification is created for booking user and rider.
4. Realtime socket event is sent to both user and rider:

```ts
'payment:callback';
```

### Payload

```ts
{
  bookingId: string | null;
  transactionId: string;
  status: 'success' | 'failed';
  message: string;
}
```

## 7. Cash Payment Initiated Flow

Route:

- `POST /payments/initiate/cash`

What happens:

1. Customer confirms cash payment.
2. Booking is updated as cash-paid by customer.
3. Notification is created for booking user and rider.
4. Realtime socket event is sent to rider:

```ts
'payment:cash_completed';
```

### Payload

```ts
{
  bookingId: string;
  userId: string;
  riderId: string;
  status: 'success';
  message: string;
}
```

## 8. Notifications

Notifications are created through `src/app/modules/notifications/notification.service.ts`.

The notification service does two things:

1. Saves the notification in the database.
2. Emits `notification:new` to the target user room.

That means the frontend gets both:

- persistent notification history
- live popup/in-app update

## 9. Current Notification Types

The booking flow currently creates these notification records:

- `booking_accepted`
- `rider_arrived_pickup`
- `booking_payment_initiated`
- `booking_payment_callback_success`
- `booking_payment_callback_failed`
- `booking_payment_cash_completed`

Each notification includes booking context in `data`, such as:

```ts
{
  bookingId,
  riderId,
  userId,
  status,
}
```

## 10. Frontend Integration

### Listen for booking events

Subscribe to these socket events:

- `booking:accepted`
- `booking:arrived_pickup`
- `payment:initiated`
- `payment:callback`
- `payment:cash_completed`
- `notification:new`

### Suggested UI behavior

1. On `booking:accepted`, update the booking card to show the assigned rider.
2. On `booking:arrived_pickup`, show that the rider has reached the pickup point.
3. After `arrive-pickup`, show payment progress using:

- `payment:initiated`
- `payment:callback`
- `payment:cash_completed`

4. Use `notification:new` to update the notifications panel and badge count.

## 11. Testing Notes

To test the flow:

1. Connect the customer and rider sockets with valid JWT tokens.
2. Open the booking screen for the customer.
3. Rider calls `PATCH /bookings/:id/accept`.
4. Confirm the customer receives `booking:accepted` and a `notification:new` event.
5. Rider calls `PATCH /bookings/:id/arrive-pickup`.
6. Confirm the customer receives `booking:arrived_pickup` and another `notification:new` event.
7. Customer calls `POST /payments/initiate`.
8. Confirm rider receives `payment:initiated` and both users receive notification entries.
9. Trigger callback (`POST /payments/booking-callback`) with success/failed payload.
10. Confirm both users receive `payment:callback` and notifications.
11. Customer calls `POST /payments/initiate/cash`.
12. Confirm rider receives `payment:cash_completed` and both users receive notification entries.

## 12. File References

- Socket layer: `src/app/utils/socket.ts`
- Booking service: `src/app/modules/bookings/booking.service.ts`
- Booking routes: `src/app/modules/bookings/booking.route.ts`
- Notification service: `src/app/modules/notifications/notification.service.ts`
- Payment controller: `src/app/modules/payments/payment.controller.ts`
- Payment routes: `src/app/modules/payments/payment.routes.ts`
