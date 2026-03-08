# Analytics Dashboard APIs

This document describes the analytics APIs for the operations dashboard.

## Base URL

```
/api/v1/operations
```

## Authentication

All endpoints require admin or super admin authentication.

**Headers:**

```
Authorization: Bearer <admin_token>
```

---

## 1. Pickup Success Rate

Get daily pickup success rate (percentage of successful pickups).

**Endpoint:** `GET /pickup-success-rate`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| period | enum | No | weekly | Time period: `daily`, `weekly`, `monthly` |
| startDate | string | No | - | Start date (ISO format) |
| endDate | string | No | now | End date (ISO format) |

**Response:**

```json
{
  "success": true,
  "message": "Pickup success rate retrieved successfully",
  "data": [
    { "day": "Day 1", "rate": 88 },
    { "day": "Day 2", "rate": 92 },
    { "day": "Day 3", "rate": 86 },
    { "day": "Day 4", "rate": 80 },
    { "day": "Day 5", "rate": 89 },
    { "day": "Day 6", "rate": 83 },
    { "day": "Day 7", "rate": 85 }
  ]
}
```

**Frontend Integration (React):**

```tsx
const { data } = await fetch(
  '/api/v1/operations/pickup-success-rate?period=weekly',
);
// Use data array directly in BarChart component
```

---

## 2. Zone Performance Ranking

Get zones ranked by revenue with performance metrics.

**Endpoint:** `GET /zone-ranking`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| period | enum | No | monthly | Time period: `daily`, `weekly`, `monthly` |
| startDate | string | No | - | Start date (ISO format) |
| endDate | string | No | now | End date (ISO format) |
| limit | number | No | 10 | Number of zones to return |

**Response:**

```json
{
  "success": true,
  "message": "Zone ranking retrieved successfully",
  "data": [
    {
      "rank": 1,
      "zone": "Central Zone",
      "zoneId": "507f1f77bcf86cd799439011",
      "revenue": 42500,
      "pickups": 892,
      "growth": 12.5,
      "status": "High"
    },
    {
      "rank": 2,
      "zone": "North Zone",
      "zoneId": "507f1f77bcf86cd799439012",
      "revenue": 36300,
      "pickups": 765,
      "growth": 8.3,
      "status": "High"
    },
    {
      "rank": 3,
      "zone": "South Zone",
      "zoneId": "507f1f77bcf86cd799439013",
      "revenue": 31700,
      "pickups": 698,
      "growth": 5.7,
      "status": "Medium"
    }
  ]
}
```

**Status Determination:**

- **High**: Growth ≥ 8% AND Pickups ≥ 700
- **Medium**: Growth ≥ 3% AND Pickups ≥ 500
- **Low**: Below medium thresholds

**Growth Calculation:**
Growth percentage is calculated by comparing revenue in the current period with the previous period of the same duration.

**Frontend Integration (React):**

```tsx
const { data } = await fetch(
  '/api/v1/operations/zone-ranking?period=monthly&limit=5',
);
// Map data to table rows
```

---

## 3. Top Performing Riders

Get top riders ranked by trips and earnings.

**Endpoint:** `GET /top-riders`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| period | enum | No | weekly | Time period: `daily`, `weekly`, `monthly` |
| startDate | string | No | - | Start date (ISO format) |
| endDate | string | No | now | End date (ISO format) |
| limit | number | No | 5 | Number of riders to return |

**Response:**

```json
{
  "success": true,
  "message": "Top performing riders retrieved successfully",
  "data": [
    {
      "rank": 1,
      "riderId": "507f1f77bcf86cd799439011",
      "name": "Kwame Mensah",
      "zone": "Central Zone",
      "trips": 87,
      "earnings": 12450,
      "rating": 4.9
    },
    {
      "rank": 2,
      "riderId": "507f1f77bcf86cd799439012",
      "name": "Ama Serwaa",
      "zone": "Central Zone",
      "trips": 82,
      "earnings": 11680,
      "rating": 4.8
    },
    {
      "rank": 3,
      "riderId": "507f1f77bcf86cd799439013",
      "name": "Kofi Asante",
      "zone": "Central Zone",
      "trips": 78,
      "earnings": 11120,
      "rating": 4.8
    }
  ]
}
```

**Ranking Logic:**

1. Primary sort: Number of trips (descending)
2. Secondary sort: Total earnings (descending)
3. Only riders with at least 1 completed trip are included

**Rating Calculation:**
Average rating is calculated from all ratings received on completed bookings within the specified period.

**Frontend Integration (React):**

```tsx
const { data } = await fetch(
  '/api/v1/operations/top-riders?period=weekly&limit=5',
);
// Map data to table rows with Avatar, name, zone, trips, earnings, rating
```

---

## 4. Zone Comparison

Get revenue and pickups comparison for all zones.

**Endpoint:** `GET /zone-comparison`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| period | enum | No | monthly | Time period: `daily`, `weekly`, `monthly` |
| startDate | string | No | - | Start date (ISO format) |
| endDate | string | No | now | End date (ISO format) |

**Response:**

```json
{
  "success": true,
  "message": "Zone comparison data retrieved successfully",
  "data": [
    { "zone": "Central Zone", "revenue": 45000, "pickups": 892 },
    { "zone": "North Zone", "revenue": 36300, "pickups": 765 },
    { "zone": "South Zone", "revenue": 31700, "pickups": 698 },
    { "zone": "West Zone", "revenue": 29000, "pickups": 623 },
    { "zone": "East Zone", "revenue": 26100, "pickups": 547 }
  ]
}
```

**Data Structure:**

- **zone**: Zone name
- **revenue**: Total revenue from completed bookings in the period (GHS)
- **pickups**: Count of completed bookings in the period
- Results are sorted by revenue (descending)

**Frontend Integration (React):**

```tsx
const [period, setPeriod] = useState('Weekly');
const { data } = await fetch(
  `/api/v1/operations/zone-comparison?period=${period.toLowerCase()}`,
);

// Use directly in dual-axis BarChart:
<BarChart data={data}>
  <Bar yAxisId="right" dataKey="pickups" name="Pickups" fill="#2F80ED" />
  <Bar yAxisId="left" dataKey="revenue" name="Revenue (GHC)" fill="#10B981" />
</BarChart>;
```

---

## 5. Zone Details (KPIs)

Get detailed KPIs for a specific zone.

**Endpoint:** `GET /zones/:zoneId/details`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| zoneId | string | Yes | MongoDB ObjectId of the zone |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| period | enum | No | monthly | Time period: `daily`, `weekly`, `monthly` |
| startDate | string | No | - | Start date (ISO format) |
| endDate | string | No | now | End date (ISO format) |

**Response:**

```json
{
  "success": true,
  "message": "Zone details retrieved successfully",
  "data": {
    "zoneId": "507f1f77bcf86cd799439011",
    "zoneName": "Central Zone",
    "totalRevenue": 42500,
    "totalPickups": 892,
    "avgRating": 4.8,
    "activeRiders": 12,
    "growth": 12.5,
    "status": "High"
  }
}
```

**Metrics Explanation:**

- **totalRevenue**: Sum of all completed booking prices in the period
- **totalPickups**: Count of completed bookings in the period
- **avgRating**: Average rating from all bookings in the period
- **activeRiders**: Current count of verified riders assigned to this zone
- **growth**: Percentage change in revenue compared to previous period
- **status**: Performance status (High/Medium/Low) based on growth and pickups

**Frontend Integration (React):**

```tsx
const zoneId = '507f1f77bcf86cd799439011';
const { data } = await fetch(`/api/v1/operations/zones/${zoneId}/details?period=monthly`);

// Use in KPI cards:
<KpiCard label="Total Revenue" value={`GHC₵ ${data.totalRevenue.toLocaleString()}`} />
<KpiCard label="Total Pickups" value={data.totalPickups} />
<KpiCard label="Avg Rating" value={`${data.avgRating} ★`} />
<KpiCard label="Active Riders" value={data.activeRiders} />
```

---

## 6. Zone Performance Trends

Get daily trends (pickups and revenue) for a specific zone.

**Endpoint:** `GET /zones/:zoneId/trends`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| zoneId | string | Yes | MongoDB ObjectId of the zone |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| period | enum | No | weekly | Time period: `daily`, `weekly`, `monthly` |
| startDate | string | No | - | Start date (ISO format) |
| endDate | string | No | now | End date (ISO format) |

**Response:**

```json
{
  "success": true,
  "message": "Zone performance trends retrieved successfully",
  "data": [
    { "day": "Day 1", "pickups": 7500, "revenue": 5000 },
    { "day": "Day 2", "pickups": 7700, "revenue": 5200 },
    { "day": "Day 3", "pickups": 8000, "revenue": 6500 },
    { "day": "Day 4", "pickups": 7600, "revenue": 6400 },
    { "day": "Day 5", "pickups": 7300, "revenue": 6300 },
    { "day": "Day 6", "pickups": 7900, "revenue": 5600 },
    { "day": "Day 7", "pickups": 7100, "revenue": 5100 }
  ]
}
```

**Data Structure:**

- **day**: Day label (Day 1, Day 2, etc.)
- **pickups**: Count of completed bookings on that day
- **revenue**: Total revenue (in GHS) from completed bookings on that day

**Frontend Integration (React):**

```tsx
const zoneId = '507f1f77bcf86cd799439011';
const { data } = await fetch(
  `/api/v1/operations/zones/${zoneId}/trends?period=weekly`,
);

// Use directly in dual-axis LineChart:
<LineChart data={data}>
  <Line yAxisId="left" dataKey="pickups" stroke="#374151" />
  <Line yAxisId="right" dataKey="revenue" stroke="#10B981" />
</LineChart>;
```

---

## Complete Example Requests

### Get Weekly Success Rate

```bash
curl -X GET "http://localhost:5000/api/v1/operations/pickup-success-rate?period=weekly" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Monthly Zone Rankings (Top 10)

```bash
curl -X GET "http://localhost:5000/api/v1/operations/zone-ranking?period=monthly&limit=10" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Top 5 Riders This Week

```bash
curl -X GET "http://localhost:5000/api/v1/operations/top-riders?period=weekly&limit=5" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Zone Comparison

```bash
curl -X GET "http://localhost:5000/api/v1/operations/zone-comparison?period=monthly" \
  -H "Authorization: Bearer <admin_token>"
```

### Custom Date Range

```bash
curl -X GET "http://localhost:5000/api/v1/operations/zone-ranking?startDate=2026-01-01&endDate=2026-01-31" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Zone Details with KPIs

```bash
curl -X GET "http://localhost:5000/api/v1/operations/zones/507f1f77bcf86cd799439011/details?period=monthly" \
  -H "Authorization: Bearer <admin_token>"
```

### Get Zone Performance Trends

```bash
curl -X GET "http://localhost:5000/api/v1/operations/zones/507f1f77bcf86cd799439011/trends?period=weekly" \
  -H "Authorization: Bearer <admin_token>"
```

---

## Frontend Implementation Example

```tsx
// React component for analytics dashboard
import { useEffect, useState } from 'react';

export function AnalyticsDashboard() {
  const [successRate, setSuccessRate] = useState([]);
  const [zoneRanking, setZoneRanking] = useState([]);
  const [topRiders, setTopRiders] = useState([]);

  useEffect(() => {
    // Fetch all analytics data
    Promise.all([
      fetch('/api/v1/operations/pickup-success-rate?period=weekly'),
      fetch('/api/v1/operations/zone-ranking?period=monthly&limit=5'),
      fetch('/api/v1/operations/top-riders?period=weekly&limit=5'),
    ])
      .then(responses => Promise.all(responses.map(r => r.json())))
      .then(([successData, zoneData, riderData]) => {
        setSuccessRate(successData.data);
        setZoneRanking(zoneData.data);
        setTopRiders(riderData.data);
      });
  }, []);

  return (
    <div className="grid gap-6">
      <PickupSuccessRateChart data={successRate} />
      <RankedZonesTable data={zoneRanking} />
      <TopPerformingRiders data={topRiders} />
    </div>
  );
}
```

### Zone Details Page Example

```tsx
// React component for zone details page
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export function ZoneDetailsPage() {
  const params = useParams();
  const zoneId = params.zoneId as string;

  const [zoneDetails, setZoneDetails] = useState(null);
  const [zoneTrends, setZoneTrends] = useState([]);
  const [topRiders, setTopRiders] = useState([]);

  useEffect(() => {
    // Fetch zone-specific data
    Promise.all([
      fetch(`/api/v1/operations/zones/${zoneId}/details?period=monthly`),
      fetch(`/api/v1/operations/zones/${zoneId}/trends?period=weekly`),
      fetch(`/api/v1/operations/top-riders?period=weekly&limit=5`),
    ])
      .then(responses => Promise.all(responses.map(r => r.json())))
      .then(([detailsData, trendsData, ridersData]) => {
        setZoneDetails(detailsData.data);
        setZoneTrends(trendsData.data);
        setTopRiders(ridersData.data);
      });
  }, [zoneId]);

  if (!zoneDetails) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Zone Header */}
      <div>
        <h1>{zoneDetails.zoneName}</h1>
        <div className="badge">{zoneDetails.status} Performance</div>
        <p>Growth: +{zoneDetails.growth}%</p>
      </div>

      {/* KPI Cards */}
      <KpiGrid
        items={[
          {
            label: 'Total Revenue',
            value: `GHC₵ ${zoneDetails.totalRevenue.toLocaleString()}`,
          },
          { label: 'Total Pickups', value: zoneDetails.totalPickups },
          { label: 'Avg Rating', value: `${zoneDetails.avgRating} ★` },
          { label: 'Active Riders', value: zoneDetails.activeRiders },
        ]}
      />

      {/* Performance Trends Chart */}
      <ZonePerformanceTrends data={zoneTrends} />

      {/* Top Riders Table */}
      <TopPerformingRiders data={topRiders} />
    </div>
  );
}
```

---

## Notes

- All revenue and earnings values are in the system's base currency (GHS - Ghana Cedis)
- Dates are in ISO 8601 format
- Ratings are on a scale of 1-5 (calculated as average)
- Growth is calculated as percentage change from previous period
- Only completed bookings are included in calculations (cancelled bookings are excluded)
- Riders must have `riderVerified: true` to appear in rankings
