# Analytics API — Contract for Frontend

> Source of truth for the `/api/v1/analytics/**` surface.
> The companion OpenAPI spec lives at `docs/contracts/analytics.yaml`.
> Generated Swagger UI: <http://localhost:8080/swagger-ui/index.html#/Analytics>.

## 1. Scope

Five analytical modules, all read-only, all admin-only:

| # | Module | Path prefix | Backing aggregate |
|---|--------|-------------|-------------------|
| 1 | Prime Cost & Margins | `/prime-cost` | `monthly_financial_summary` (rolled up from daily) |
| 2 | Menu Engineering (BCG) | `/menu-engineering` | `menu_performance_cache` (invalidated on price/recipe change) |
| 3 | Operational Efficiency (RevPASH & Turns) | `/operations` | Live + daily rollups |
| 4 | Customer Cohort | `/cohort` | Live (window functions over `orders`) |
| 5 | Variance Alerts | `/alerts` | `system_alerts` (populated by nightly job) |

## 2. Auth

- **Required**: `Authorization: Bearer <jwt>`
- **Role**: `ROLE_ADMIN` only. Any other authenticated role → `403 Forbidden`.
- Token validation: standard JWT chain (`/.well-known/jwks.json`).
- Errors follow RFC 7807 `application/problem+json`.

## 3. Time buckets

Four buckets supported everywhere a period is accepted:

| `bucket` | Key format | Example |
|----------|------------|---------|
| `daily`   | `YYYY-MM-DD` | `2026-07-17` |
| `weekly`  | `YYYY-Www` (ISO week) | `2026-W29` |
| `monthly` | `YYYY-MM` | `2026-07` |
| `yearly`  | `YYYY` | `2026` |

### Query pattern

Two equivalent ways to ask for a range:

```http
# (A) Range form — preferred for charts
GET /api/v1/analytics/prime-cost?bucket=monthly&from=2026-01&to=2026-07

# (B) Point form — single period
GET /api/v1/analytics/prime-cost?bucket=monthly&year=2026&month=7
```

| Param | Required | Notes |
|-------|----------|-------|
| `bucket` | yes | `daily` \| `weekly` \| `monthly` \| `yearly` |
| `from`   | yes (A) | inclusive, format must match bucket |
| `to`     | yes (A) | inclusive, must be `>= from` |
| `year`   | yes (B) | 4 digits |
| `month`  | only for `monthly` (B) | 1–12 |
| `week`   | only for `weekly` (B)  | 1–53 (ISO) |
| `day`    | only for `daily` (B)   | 1–31 |
| `categoryId` | optional, menu-engineering only | filter menu items by product category |
| `limit`, `offset` | optional, alerts only | paging, max `limit=100` |

### Validation

| Failure | HTTP | `type` URI |
|---------|------|-----------|
| Bad date format for bucket | 400 | `/analytics/invalid-period` |
| `to < from` | 422 | `/analytics/invalid-range` |
| Range > 366 days | 422 | `/analytics/range-too-large` |

## 4. Money

Per Activity 4 (Money value object):

```json
{ "amount": "1234.56", "currency": "COP" }
```

All monetary fields in responses use this wrapper. Never raw floats.

## 5. Module contracts

### 5.1 Prime Cost (`GET /api/v1/analytics/prime-cost`)

**Math** (per user's spec):
```
COGS_category   = starting_inventory + purchases − ending_inventory       (per category)
labor_area      = gross_wages + employer_taxes + benefits                  (per area FOH/BOH)
prime_cost      = Σ COGS_category (food + beverage + alcohol + other) + Σ labor_area (FOH + BOH + other)
net_sales       = gross_sales − discounts − comped
prime_cost_pct  = prime_cost / net_sales
```

**Response shape** (`PrimeCostReport`):

```jsonc
{
  "period": { "bucket": "monthly", "from": "2026-01", "to": "2026-07", "keys": ["2026-01", ..., "2026-07"] },
  "series": [
    {
      "key": "2026-07",
      "netSales":   { "amount": "125000000.00", "currency": "COP" },
      "grossSales": { "amount": "138000000.00", "currency": "COP" },
      "discounts":  { "amount": "8000000.00",   "currency": "COP" },
      "comped":     { "amount": "5000000.00",   "currency": "COP" },
      "cogs": {
        "total":  { "amount": "42000000.00", "currency": "COP" },
        "byCategory": [
          { "category": "FOOD",     "amount": { "amount": "30000000.00", "currency": "COP" }, "pct": 71.43 },
          { "category": "BEVERAGE", "amount": { "amount": " 8000000.00", "currency": "COP" }, "pct": 19.05 },
          { "category": "ALCOHOL",   "amount": { "amount": " 4000000.00", "currency": "COP" }, "pct":  9.52 }
        ]
      },
      "labor": {
        "total":  { "amount": "35000000.00", "currency": "COP" },
        "byArea": [
          { "area": "FOH", "amount": { "amount": "18000000.00", "currency": "COP" }, "pct": 51.43 },
          { "area": "BOH", "amount": { "amount": "17000000.00", "currency": "COP" }, "pct": 48.57 }
        ]
      },
      "primeCost":    { "amount": "77000000.00", "currency": "COP" },
      "primeCostPct": 61.60,
      "margins": {
        "grossProfitPct": 66.40,
        "netProfitPct":   4.20
      },
      "dataCompleteness": "FULL"   // FULL | PARTIAL | EMPTY
    }
  ],
  "dataCompleteness": "PARTIAL",
  "notes": [
    "Inventory snapshots missing — COGS approximated via FIFO over inventory_movements."
  ]
}
```

**Performance**: pre-aggregated daily rollups → `monthly_financial_summary` table.
`dataCompleteness` flags ranges where source data is missing.

### 5.2 Menu Engineering (`GET /api/v1/analytics/menu-engineering`)

**Math**:
```
For each active SKU:
  units_sold      = Σ quantity over period
  revenue         = Σ (quantity × sell_price)
  recipe_cost     = product.recipe.total_cost (Money value object)
  gp_per_unit     = sell_price − recipe_cost
  contribution    = units_sold × gp_per_unit
  median_volume   = median(units_sold across SKUs)
  median_margin   = median(gp_per_unit across SKUs)

Quadrant:
  STAR       = units >= median_volume AND gp >= median_margin
  PLOWHORSE  = units >= median_volume AND gp <  median_margin
  PUZZLE     = units <  median_volume AND gp >= median_margin
  DOG        = units <  median_volume AND gp <  median_margin
```

**Response shape** (`MenuEngineeringReport`):

```jsonc
{
  "period": { "bucket": "monthly", "from": "2026-07", "to": "2026-07", "keys": ["2026-07"] },
  "median": { "volume": 142, "margin": { "amount": "8500.00", "currency": "COP" } },
  "items": [
    {
      "productId": 42,
      "productName": "Lomo en salsa",
      "categoryId": 3,
      "categoryName": "Platos fuertes",
      "unitsSold": 320,
      "revenue":   { "amount": "9600000.00", "currency": "COP" },
      "recipeCost":{ "amount": "3200000.00", "currency": "COP" },
      "grossProfitPerUnit": { "amount": "20000.00", "currency": "COP" },
      "totalContribution":  { "amount": "6400000.00", "currency": "COP" },
      "quadrant": "STAR"
    }
  ],
  "cacheStatus": {
    "lastRefreshedAt": "2026-07-17T02:00:00Z",
    "sourceVersion": "v17",
    "ttlSeconds": 86400
  },
  "dataCompleteness": "FULL"
}
```

**Cache**: `menu_performance_cache` table. Invalidated on:
- `products.base_price` change
- any row in `product_recipes` change

### 5.3 Operational Efficiency (`GET /api/v1/analytics/operations`)

**Math**:
```
For each order:
  occupied_minutes = close_time − open_time
Total:
  total_occupied_seat_minutes   = Σ occupied_minutes × party_size
  total_available_seat_minutes  = Σ seats_per_table × operating_minutes_per_table
  total_available_seat_hours    = total_available_seat_minutes / 60
RevPASH = total_net_sales / total_available_seat_hours
Turns   = total_covers / number_of_tables
Segment turns by day_part: LUNCH (11:00–15:00), DINNER (18:00–23:00), OTHER

**Performance index** (range scan over `orders`):
```sql
CREATE INDEX idx_orders_open_close ON orders (open_time, close_time);
```

**Response shape** (`OperationsReport`):

```jsonc
{
  "period": { "bucket": "monthly", "from": "2026-07", "to": "2026-07", "keys": ["2026-07"] },
  "revPash": {
    "value":                   { "amount": "18500.00", "currency": "COP" },
    "totalNetSales":           { "amount": "125000000.00", "currency": "COP" },
    "totalAvailableSeatHours": 6757.5
  },
  "tableTurnover": {
    "overall": 4.8,
    "byDayPart": [
      { "dayPart": "LUNCH",  "turns": 2.1, "covers":  42, "tables": 20 },
      { "dayPart": "DINNER", "turns": 2.7, "covers":  54, "tables": 20 }
    ]
  },
  "avgOccupancyMinutes": 47.3,
  "dataCompleteness": "PARTIAL",
  "notes": [
    "Operating hours taken from analytics_config.default (00:00-23:59); override pending."
  ]
}
```

**Assumption until schema migration**: if `orders.open_time`/`close_time` do not exist yet, duration is approximated from `created_at` → `updated_at` and flagged in `notes`.

### 5.4 Customer Cohort (`GET /api/v1/analytics/cohort`)

**Re-framed per user**: there is **no `customers` table**; per the user's instruction *"a client is an order"*, we do **not** persist customers. Instead, this module treats each `orders.id` as the atomic unit of a "client visit" and computes:

```
new_in_period    = COUNT(orders.id WHERE created_at IN [from, to])
recurring_in_period = COUNT(orders.id WHERE fingerprint appears ≥2 in last 90 days)
                       # fingerprint = SHA256(phone_normalized ?? table_id ?? device_id)
avg_ticket_per_order = Σ order_total / COUNT(orders.id)
avg_ticket_per_cover  = Σ order_total / Σ party_size   (party_size defaults to 1 if column missing)
```

**Response shape** (`CohortReport`):

```jsonc
{
  "period": { "bucket": "monthly", "from": "2026-07", "to": "2026-07", "keys": ["2026-07"] },
  "newClients":       1820,
  "recurringClients":  943,
  "totalOrders":      2763,
  "recurringRatePct": 34.13,
  "averageTicketPerOrder": { "amount": "45232.00", "currency": "COP" },
  "averageTicketPerCover":  { "amount": "22616.00", "currency": "COP" },
  "fingerprintStrategy": "PHONE_OR_TABLE",   // PHONE | PHONE_OR_TABLE | TABLE_ONLY
  "dataCompleteness": "PARTIAL",
  "notes": [
    "Phone number captured on 62% of orders in range; remaining rows fingerprint by table_id."
  ]
}
```

**Implementation hint for FE**: when `dataCompleteness` ≠ `FULL`, render the `notes[]` banner before charts.

### 5.5 Variance Alerts (`GET /api/v1/analytics/alerts`)

**Read list** with paging and filters. Plus a mark-read endpoint.

```http
GET    /api/v1/analytics/alerts?status=open&severity=RED&bucket=monthly&from=2026-01&to=2026-07&limit=50&offset=0
PATCH  /api/v1/analytics/alerts/{id}/read
```

**Response shape** (`AlertsPage`):

```jsonc
{
  "items": [
    {
      "id": 17,
      "severity": "RED",          // RED | YELLOW | INFO
      "type": "FOOD_COST_DEVIATION", // see enum
      "message": "Food cost is 4.2pp above 12-month MA",
      "metric": "food_cost_pct",
      "baseline":  { "amount": "28.50" },        // number-as-string
      "current":   { "amount": "32.70" },
      "deviationPct": 14.74,
      "period": "2026-07",
      "detectedAt": "2026-07-17T02:00:00Z",
      "status": "OPEN"            // OPEN | READ | DISMISSED
    }
  ],
  "page": { "limit": 50, "offset": 0, "total": 134 }
}
```

**Alert types** (enum):

| `type` | Trigger |
|--------|---------|
| `FOOD_COST_DEVIATION` | food cost % deviates > 2 pp vs 12-month MA |
| `LABOR_COST_DEVIATION` | labor cost % deviates > 3 pp vs 12-month MA |
| `SALES_DROP_YOY` | sales drop > 10 % vs same weekday last year |
| `LOW_MARGIN_SKU_SPIKE` | a DOG-quadrant SKU increases units > 50 % WoW |
| `REVPASH_DROP` | RevPASH drops > 15 % vs 4-week MA |

`PATCH /alerts/{id}/read` returns `204 No Content`; idempotent.

## 6. Cross-cutting error model

RFC 7807 `application/problem+json`:

```json
{
  "type": "/analytics/invalid-period",
  "title": "Invalid period",
  "status": 400,
  "detail": "bucket=monthly but 'from' is not YYYY-MM",
  "instance": "/api/v1/analytics/prime-cost",
  "errors": [
    { "parameter": "from", "value": "2026-1", "expected": "YYYY-MM" }
  ]
}
```

Status code map (single source):

| Status | Type URI |
|--------|----------|
| 400 | `/analytics/invalid-period`, `/analytics/invalid-parameter` |
| 401 | `/auth/unauthorized` |
| 403 | `/auth/forbidden` |
| 404 | `/analytics/alert-not-found` |
| 422 | `/analytics/invalid-range`, `/analytics/range-too-large` |
| 500 | `/internal` |

## 7. Data-source assumptions & fallback strategy

Per user's instruction *"use what we have now; only create tables if the business model needs them"*:

| Module | Source today | Action if missing |
|--------|--------------|-------------------|
| Prime Cost — COGS | `inventory_movements`, `purchase_orders`, `inventory_stock` | If no snapshot table → approximate FIFO; flag `dataCompleteness=PARTIAL` |
| Prime Cost — Labor | `schedules` + `time_logs` (V22) | Need hourly rate per user. Add `users.hourly_rate` column in A6 (business-essential). Fallback: skip labor row, flag note |
| Menu Engineering | `order_details`, `products`, `product_recipes` | OK today; cache invalidation needs hooks on price/recipe change |
| Operations | `tables`, `orders` | Need `open_time`, `close_time` on orders, `seat_count` on tables (verify), `analytics_config` for hours |
| Cohort | `orders` only | "Client = order" proxy. No new table |
| Alerts | All aggregates above | Need 30+ days history for MA to work; cold-start flagged |

Tables/columns that **are required** by the business model and will be created in follow-up activities:

1. `users.hourly_rate DECIMAL(10,2)` — labor cost needs a rate per worker.
2. `orders.open_time TIMESTAMP`, `orders.close_time TIMESTAMP` — RevPASH math.
3. `analytics_config` singleton table — operating hours per day-of-week.

Tables/columns we **do NOT** create per user instruction: `customers`, `customer_id` on orders.

## 8. Versioning

- All paths under `/api/v1/analytics/**`.
- Breaking changes → `/api/v2/analytics/**`.
- New query params on existing endpoints = additive, non-breaking.

## 9. Pagination & rate limits

- Alerts: `limit` ≤ 100, `offset` ≥ 0. Default `limit=50`.
- Other endpoints: not paginated; if range > 366 days → 422.
- Internal rate limit: 60 req/min per admin (subject to evolve).

## 10. Frontend integration recipe

```bash
# Generate TS types from the contract
npx openapi-typescript docs/contracts/analytics.yaml -o src/api/analytics-schema.ts

# Mock server for parallel FE work
npx prism mock docs/contracts/analytics.yaml --port 4011
```

FE team can start consuming the contract without waiting for backend completion.