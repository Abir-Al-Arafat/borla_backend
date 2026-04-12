# Socket Testing With Postman

This guide explains how to test your Socket.IO messaging flow using Postman.

## Prerequisites

1. Backend server is running.
2. You already installed socket dependency (`npm i socket.io`).
3. You have valid JWT access tokens for test users.
4. You have at least one valid `chatId` or `bookingId` to trigger messages.

## Important Note

Use **Socket.IO request** in Postman, not plain WebSocket request.

Your backend uses Socket.IO protocol (`src/app/utils/socket.ts`), so plain WebSocket will not fully work for event-based testing.

## 1. Get Access Token

Get a token from login endpoint.

Example:

- `POST /api/v1/auth/login`

Use the returned `accessToken` for socket auth.

## 2. Open Socket.IO Connection in Postman

1. Open Postman.
2. Click `New`.
3. Select `Socket.IO` request.
4. Set URL to your server base URL.

Example:

- `http://0.0.0.0:5000`

5. In auth payload/handshake auth, pass token:

```json
{
  "token": "<ACCESS_TOKEN>"
}
```

Your backend reads token from:

- `socket.handshake.auth.token`
- fallback: `Authorization` header

It does not read token from URL query (for example `?token=...`).

If token is invalid, connection will fail with unauthorized error.

To test booking availability events, connect as a verified rider whose zone matches the booking pickup location.

## 3. Join Chat Room

After connection, emit event:

- Event name: `chat:join`
- Data: chat id string

Example data:

```json
"<CHAT_ID>"
```

This joins room:

- `chat:<CHAT_ID>`

Expected acknowledgement to same socket:

- Event: `chat:join:success`
- Payload example:

```json
{
  "success": true,
  "chatId": "<CHAT_ID>",
  "userId": "<USER_ID>"
}
```

If `chatId` is empty:

- Event: `chat:join:failure`

```json
{
  "success": false,
  "message": "chatId is required"
}
```

## 4. Listen For Incoming Events

In the same Socket.IO tab, subscribe/listen to:

1. `message:new`
2. `booking:new`
3. `chat:typing`
4. `chat:join:success`
5. `chat:join:failure`
6. `chat:leave:success`
7. `chat:leave:failure`
8. `chat:typing:success`
9. `chat:typing:failure`
10. `socket:connection:success`

Keep this tab open.

## 5. Test `chat:typing`

From another Socket.IO tab (second user), connect with a different user token and join same chat.

Emit:

- Event: `chat:typing`
- Data:

```json
{
  "chatId": "<CHAT_ID>",
  "isTyping": true
}
```

Expected result:

- Other user receives `chat:typing` with:

```json
{
  "chatId": "<CHAT_ID>",
  "userId": "<SENDER_USER_ID>",
  "isTyping": true
}
```

- Sender receives `chat:typing:success` with:

```json
{
  "success": true,
  "chatId": "<CHAT_ID>",
  "userId": "<SENDER_USER_ID>",
  "isTyping": true
}
```

## 6. Test `message:new` (Booking Chat)

Use HTTP request in Postman to send message:

- `POST /api/v1/messages/booking/:bookingId`
- Auth: Bearer token of sender
- Body (form-data):
  - `text`: `hello from postman`
  - `images`: optional file uploads

Expected socket result:

- Receiver socket gets `message:new`
- Any socket in joined chat room also gets `message:new`

Payload includes fields like:

- `id`
- `chatId`
- `senderId`
- `receiverId`
- `text`
- `images`
- `createdAt`

## 7. Test `message:new` (Support Chat)

### User to support

- `POST /api/v1/messages/support`
- Auth: support user token
- Body: `text` (+ optional `images`)

### Admin reply

- `POST /api/v1/messages/support/admin/chats/:chatId/reply`
- Auth: admin token
- Body: `text` (+ optional `images`)

Expected:

- `message:new` is emitted to chat room and receiver user room.

## 8. Leave Room

Emit:

- Event: `chat:leave`
- Data:

```json
"<CHAT_ID>"
```

Expected acknowledgement:

- `chat:leave:success`

If `chatId` is empty:

- `chat:leave:failure`

## 9. Quick Troubleshooting

1. Connection fails immediately:

- Check JWT token is valid and not expired.
- Confirm token is passed in handshake auth as `token`.
- If auth UI is difficult in your Postman version, set header: `Authorization: Bearer <ACCESS_TOKEN>`.

2. Connected but no events:

- Make sure you emitted `chat:join` with correct chat id.
- Confirm message was actually created by HTTP API.

3. Typing event not received:

- `chat:typing` is sent to others in room, not the same sender socket.

4. Wrong URL:

- Use backend server URL, not frontend URL.

5. You connected but received only failure acks:

- Confirm payload format is correct for each event.
- `chat:join` and `chat:leave` expect a raw string `"<CHAT_ID>"`.
- `chat:typing` expects `{ "chatId": "...", "isTyping": true }`.

6. You do not see `booking:new`:

- Confirm the socket user is a verified rider.
- Confirm the rider belongs to the zone that contains the booking pickup location.
- Confirm the booking was created after the socket connection was established.

## 10. Recommended Test Sequence

1. Open Socket.IO tab as user A, connect, join chat.
2. Open Socket.IO tab as user B, connect, join same chat.
3. Emit `chat:typing` from A, verify B receives.
4. Send message HTTP request as A, verify B receives `message:new`.
5. Send message HTTP request as B, verify A receives `message:new`.
