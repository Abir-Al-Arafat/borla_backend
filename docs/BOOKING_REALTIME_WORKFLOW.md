# Booking Realtime Workflow

This document explains how the booking realtime flow works when a rider accepts a booking or arrives at the pickup point.

## 1. Overview

Two booking actions now produce both realtime updates and persisted notifications:

1. `/:id/accept`
2. `/:id/arrive-pickup`

When either action happens, the backend:

1. Updates the booking in the database.
2. Creates notifications for the rider and the booking user.
3. Emits a realtime socket event to the booking user so the UI updates immediately.

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
booking: accepted;
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
booking: arrived_pickup;
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

## 5. Notifications

Notifications are created through `src/app/modules/notifications/notification.service.ts`.

The notification service does two things:

1. Saves the notification in the database.
2. Emits `notification:new` to the target user room.

That means the frontend gets both:

- persistent notification history
- live popup/in-app update

## 6. Current Notification Types

The booking flow currently creates these notification records:

- `booking_accepted`
- `rider_arrived_pickup`

Each notification includes booking context in `data`, such as:

```ts
{
  bookingId,
  riderId,
  userId,
  status,
}
```

## 7. Frontend Integration

### Listen for booking events

Subscribe to these socket events:

- `booking:accepted`
- `booking:arrived_pickup`
- `notification:new`

### Suggested UI behavior

1. On `booking:accepted`, update the booking card to show the assigned rider.
2. On `booking:arrived_pickup`, show that the rider has reached the pickup point.
3. Use `notification:new` to update the notifications panel and badge count.

## 8. Testing Notes

To test the flow:

1. Connect the customer and rider sockets with valid JWT tokens.
2. Open the booking screen for the customer.
3. Rider calls `PATCH /bookings/:id/accept`.
4. Confirm the customer receives `booking:accepted` and a `notification:new` event.
5. Rider calls `PATCH /bookings/:id/arrive-pickup`.
6. Confirm the customer receives `booking:arrived_pickup` and another `notification:new` event.

## 9. File References

- Socket layer: `src/app/utils/socket.ts`
- Booking service: `src/app/modules/bookings/booking.service.ts`
- Booking routes: `src/app/modules/bookings/booking.route.ts`
- Notification service: `src/app/modules/notifications/notification.service.ts`
