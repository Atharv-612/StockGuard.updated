# StockGuard

**Smart Inventory | Track Expiry | Grow Your Business**

StockGuard is an inventory and expiry tracker for small shops. It tracks stock, expiry dates, low-stock items and sales, and sends the owner alerts before products expire.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (no framework), Chart.js for graphs |
| Backend | Java 17+, Spring Boot 3 (Web, Data JPA, Security, Validation, Scheduling) |
| Database | MySQL 8 |
| Notifications | In-app alerts, scheduled digests & Server-Sent Events |
| Auth | JWT tokens + BCrypt password hashing |
| Real-time | Server-Sent Events (open browsers refresh automatically) |

## Workflow / system architecture

```
Shop Owner ──► Add / Update ──► System ──► Alerts ──► Reports
Login/Register  Products, Stock,  Stores data in   Expiry / Low Stock   Sales, Stock &
(Web App)       Expiry Date,      MySQL &          System Alerts        Expiry Reports
                Price, Category   processes logic  & History
     ▲                                                                  │
     └─────────────────────── Real-time Updates ◄──────────────────────┘
```

```
Browser (HTML/CSS/JS)  ──REST + JWT──►  Spring Boot controllers ─► services ─► JPA ─► MySQL
        ▲                                         │
        └──── Server-Sent Events (/api/events) ◄──┤  (refresh after every change)
                                                  └─► Alert Service (daily digest, instant low-stock, digest trigger)
```

## Features

* **Stock management**: product registry (name, category, price, unit, SKU, low-stock level); stock counts update in real time as items are added or sold.
* **Expiry tracking**: every delivery is a batch with a batch number, quantity, purchase date and expiry date. Batches are marked *Fresh*, *Expiring soon* (within N days, set per shop) or *Expired*.
* **First expiry, first out (FEFO)**: a sale takes stock from the batch that expires first. Expired stock can't be sold.
* **Waste tracking**: expired batches can be marked as disposed; Reports shows the value lost.
* **Sales / billing**: a cart-style bill with several items, a receipt, and a sales register with date filters. Replaces the paper register.
* **Low-stock notifications**: an instant alert generated when a sale brings a product down to its low-stock level.
* **Expiry alerts**: a daily digest (09:00 by default) of expired, expiring, low-stock and out-of-stock items, plus a **Trigger alert digest now** button.
* **Reports**: daily and monthly sales charts, top products (week / 30 / 90 days), reorder suggestions based on the last 30 days of sales (to stop overbuying), a stock report, waste, and CSV export.
* **Secure and reliable**: JWT login, BCrypt passwords, each shop sees only its own data, validated input, row locking when stock is deducted.
* **Easy to use**: responsive layout for desktop and phone; the live indicator shows real-time sync.

## Project structure

```
pom.xml                         Maven build (Spring Boot 3.3)
mvnw, mvnw.cmd, .mvn/           Maven wrapper - no Maven install needed
database/schema.sql             MySQL schema (reference; tables are auto-created)
src/main/java/com/stockguard/
  StockGuardApplication.java
  config/      SecurityConfig, AppProperties, DemoDataLoader
  security/    JwtService, JwtAuthFilter, AuthUser
  model/       User, Product, StockBatch, Sale, AlertLog (JPA entities)
  repository/  Spring Data JPA repositories
  dto/         Request/response records
  service/     ProductService, BatchService, SaleService (FEFO), ReportService,
               AlertService (scheduler), RealtimeService (SSE)
  controller/  REST API
  exception/   ApiException, GlobalExceptionHandler
src/main/resources/
  application.properties        MySQL, JWT, alert schedule settings
  application-demo.properties   In-memory demo mode (no MySQL needed)
  static/                       Frontend
    index.html                  Login / Register
    app.html                    Main app
    css/style.css
    js/api.js, app.js, auth.js
    js/pages/dashboard.js, products.js, stock.js, sales.js, reports.js, alerts.js, settings.js
```

## How to run

### Requirements
* JDK 17 or newer (`java -version`)
* MySQL 8 (for normal use; not needed for demo mode)
* Maven is **not** required: use the included `mvnw` wrapper.

### 1. Quick demo (no MySQL)
Uses an in-memory database and creates a sample shop with 30 days of sales:

```bash
# Windows
mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=demo
# macOS / Linux
./mvnw spring-boot:run -Dspring-boot.run.profiles=demo
```

Open <http://localhost:8080> and log in with **demo@stockguard.com / demo123**. Demo data is lost when the app stops.

### 2. With MySQL
1. Start MySQL. The `stockguard` database is created automatically on first start. You can also run `database/schema.sql` yourself.
2. Set your MySQL username and password, either in `src/main/resources/application.properties` (`spring.datasource.username` / `password`, default `root` / `root`) or as environment variables:
   ```powershell
   $env:DB_USERNAME="root"; $env:DB_PASSWORD="your_password"
   ```
3. Run:
   ```bash
   mvnw.cmd spring-boot:run          # Windows
   ./mvnw spring-boot:run            # macOS / Linux
   ```
4. Open <http://localhost:8080> and click **Register** to create your shop.

To build a runnable jar: `mvnw.cmd clean package`, then `java -jar target/stockguard-1.0.0.jar`.

## Alerts & notifications

StockGuard monitors stock levels and upcoming expiry dates:
- **Daily Digest**: Runs automatically according to `stockguard.alerts.cron` (default: 09:00 AM) and records current alerts in the alert log.
- **Low Stock Alerts**: Automatically recorded whenever a sale causes stock to reach or fall below its minimum threshold.
- **On-demand Trigger**: Shop owners can trigger an immediate alert check from the **Alerts** page using the **Trigger alert digest now** button.

Other settings (in `application.properties` or as environment variables):

| Setting | Default | Meaning |
|---|---|---|
| `ALERT_CRON` | `0 0 9 * * *` | Time of the daily digest (sec min hour day month weekday) |
| `ALERT_ZONE` | `Asia/Kolkata` | Time zone for the daily digest |
| `JWT_SECRET` | dev value | **Change in production.** Random string of 32 or more characters |
| `PORT` | `8080` | HTTP port |

## REST API

All endpoints except register and login need the header `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Create an account / log in (returns a JWT) |
| GET / PUT | `/api/auth/me`, `/api/auth/settings` | Profile, contact, alert settings |
| GET / POST | `/api/products` | List / create products (optional opening stock) |
| GET / PUT / DELETE | `/api/products/{id}` | View / edit / remove a product |
| GET | `/api/batches?filter=instock\|expiring\|expired\|all\|disposed` | Stock batches |
| POST / PUT / DELETE | `/api/batches`, `/api/batches/{id}` | Stock in / edit / delete a batch |
| POST | `/api/batches/{id}/dispose` | Throw away an expired batch (counted as waste) |
| POST | `/api/sales` | Create a bill `{ "items": [{ "productId": 1, "quantity": 2 }] }` |
| GET | `/api/sales?from=&to=` | Sales register |
| GET | `/api/dashboard` | Dashboard summary |
| GET | `/api/reports/sales`, `/monthly`, `/top-products`, `/reorder`, `/stock`, `/waste` | Reports |
| GET | `/api/alerts`, `/api/alerts/status`, `/api/alerts/history` | Current alerts, alert status, history |
| POST | `/api/alerts/send` | Trigger the alert digest now |
| GET | `/api/events?token=` | Real-time update stream (Server-Sent Events) |

## Project team

**Group:** SE_IT_C7 • **Guide:** Prof. Rucha Kulkarni
**Members:** Atharv Raut, Alankar Shinde, Samarth Rokade, Sujeet Salunke

*Less Waste, More Profit!*
