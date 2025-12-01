# Muse Club Support & Implementation Summary
**Last Updated:** December 1, 2025

This document summarizes the key technical challenges, solutions, and architectural decisions made during the development of the Muse Club application. It serves as a guide for future maintenance and troubleshooting.

## 1. Architecture & Deployment

### A. Docker & Containerization
*   **Structure:** The app runs in a Docker container (`node:18-alpine`) managed by `docker-compose`.
*   **Database:** PostgreSQL 15 runs in a separate container (`db`) within the same Docker network (`gemini-network`).
*   **Setup Script:** `setup.sh` is the **source of truth** for deployment. It handles:
    *   Installing Docker/Compose.
    *   Creating `.env` (if missing).
    *   Building containers (`docker compose up -d --build`).
    *   Running migrations (`server/migrate.js`).
*   **Common Issue:** If the app fails to start, check `docker compose logs app`. Often due to DB connection retry logic (the app must wait for the DB to be ready).

### B. Nginx Reverse Proxy
*   **Role:** Nginx sits in front of the Docker container to handle port 80/443 traffic and forward it to port 3000.
*   **Configuration:** Located at `/etc/nginx/sites-enabled/default`.
*   **Critical Config:**
    ```nginx
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
    ```
*   **Troubleshooting:**
    *   "Refused to connect": Check if Nginx is running (`systemctl status nginx`) and if port 3000 is accessible locally.
    *   "Conflicting server name": Ensure only one config file exists in `/etc/nginx/sites-enabled/` and `/etc/nginx/conf.d/`.

## 2. Backend & Database

### A. Database Schema
*   **Users Table:** `id` (String), `username` (Unique), `password_hash` (String), `name`, `role` ('admin'|'user').
*   **Transactions Table:**
    *   `id` (String/UUID)
    *   `timestamp` (BIGINT): **Critical** - Stores submission time.
    *   `distribution` (JSONB): Stores calculated splits `{taker, controller, superior}`.
    *   `status`: 'pending' | 'approved' | 'paid' | 'rejected'.

### B. API & Logic
*   **User Management:**
    *   **Issue:** "Save failed" error caused by `ORDER BY created_at` when the column didn't exist. **Fix:** Removed invalid clause.
    *   **ID Generation:** Uses `Date.now() + Math.random()` instead of `crypto.randomUUID()` for broader compatibility (non-HTTPS).
*   **AI Integration (Gemini):**
    *   **Model:** Uses `gemini-1.5-flash` (fast/cheap).
    *   **Legacy Issue:** `gemini-pro-vision` is deprecated and causes 404 errors. **Fix:** Updated to 1.5 models.
    *   **Prompting:** The prompt in `server/index.js` is tuned to extract JSON data from receipts (Date, Amount, Taker, etc.).

## 3. Frontend & User Experience

### A. State Management
*   **Migration:** Moved from `localStorage` (client-side only) to full API integration (`fetch` calls to `/api/users` and `/api/transactions`).
*   **Sync:** Frontend manually calls `fetchUsers()` or `fetchTransactions()` after mutations to refresh UI.

### B. Date & Time Handling (Critical)
*   **Requirement:** All displays and logic must use **Beijing Time (UTC+8)**.
*   **Implementation:**
    *   `Intl.DateTimeFormat` with `timeZone: 'Asia/Shanghai'` is used for all date formatting.
    *   **Stats Grouping:** "Top 20" and Monthly stats are grouped by the **submission timestamp** (`timestamp`), NOT the date in the picture.
*   **Timestamp Pitfall:**
    *   **Issue:** Database/Driver sometimes returns `BIGINT` timestamps as Strings. Also, some sources might use Seconds instead of Milliseconds.
    *   **Fix:** `getMonthKeyFromTimestamp` helper function:
        1.  Converts input to `Number`.
        2.  Detects "Seconds" format (value < 100 billion) and multiplies by 1000.
        3.  Validates date validity before formatting.

### C. Statistics & "Top 20"
*   **Filtering:** Stats are filtered by `selectedMonth`.
*   **Default:** Defaults to the current month (Beijing Time).
*   **Logic:**
    ```typescript
    // Filters transactions where the submission timestamp falls in the selected YYYY-MM (Beijing)
    transactions.filter(t => getMonthKeyFromTimestamp(t.timestamp) === selectedMonth)
    ```

## 4. Common Troubleshooting Scenarios

1.  **"Stats are empty for the current month":**
    *   Check `Debug Info` (if enabled) or console logs.
    *   Verify if the record's `timestamp` is correct (is it 1970? is it valid?).
    *   Verify `currentMonthKey` matches the expected month.

2.  **"AI Analysis Failed":**
    *   Check server logs.
    *   Verify `GEMINI_API_KEY` in `.env`.
    *   Ensure the model name in `server/index.js` is valid (`gemini-1.5-flash`).

3.  **"502 Bad Gateway":**
    *   Nginx is running but cannot reach the Node app.
    *   Check if the app container crashed (`docker compose ps`).
    *   Check app logs (`docker compose logs app`).

4.  **"Save Failed, please retry":**
    *   Usually a backend SQL error. Check server logs for details (e.g., duplicate username, missing column).
