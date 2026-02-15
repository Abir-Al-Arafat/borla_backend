graph TD
User((User/Rider App)) -->|REST API/JSON| Express[Express.js Server]
Express -->|Auth/Middleware| JWT[JWT & express-validator]
Express -->|ORM/ODM| Prisma[Prisma Client]
Prisma -->|GeoJSON Queries| MongoDB[(MongoDB)]
Express -->|Uploads| S3[Storage: Waste Images]
Express -->|Payments| MoMo[MoMo PSB API]
Express -->|Real-time| WS[Socket.io: Live Tracking]

erDiagram
USER ||--o{ BOOKING : places
RIDER ||--o{ BOOKING : accepts
USER {
string id PK
string phone
string email
string role "User or Rider"
string location_geojson
}
BOOKING {
string id PK
string userId FK
string riderId FK
string status "Pending, Accepted, Completed"
string wasteCategory "Plastic, Organic, etc."
float weight
string photoUrl
datetime scheduledTime
}
ADDRESS {
string id PK
string userId FK
string label "Home, Office, Shop"
string coordinates "GeoJSON"
}
USER ||--o{ ADDRESS : saves

sequenceDiagram
participant U as User
participant S as Express Backend
participant DB as MongoDB
participant R as Rider

    U->>S: POST /api/bookings (Category, Photo, Location)
    S->>DB: Save Booking (Status: Finding Rider)
    S->>S: Query nearby Riders (GeoSpatial 2dsphere)
    S-->>R: Push Notification: New Request Available
    R->>S: PATCH /api/bookings/:id (Accept)
    S->>DB: Update Booking (riderId, Status: Accepted)
    S-->>U: Notify User: Rider is on the way
    loop Real-time Tracking
        R->>S: Socket.emit (Current Lat/Lng)
        S->>U: Socket.emit (Rider Location)
    end
