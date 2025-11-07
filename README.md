# ParkKean

Campus parking assistant built with Node.js, Express, SQLite, and vanilla HTML/CSS/JS.

The app serves a dashboard of campus parking lots, allows students to submit status reports, and keeps a simple leaderboard of community contributions.

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the development server with hot reload:
   ```sh
   npm run dev
   ```
   or start the production server without nodemon:
   ```sh
   npm start
   ```
3. Open `http://localhost:3000` in your browser.

The first run seeds `data/parkkean.db` with example lots and users. New reports and leaderboard points are persisted in the SQLite database.

## Enabling Live Parking Data

By default, the dashboard serves the seeded database values and a soft-randomized refresh. To replace that with a real-time feed:

1. Provide an API endpoint that returns JSON describing the live lot occupancy.
2. Set the environment variables before starting the server:

   | Variable | Required | Description |
   | --- | --- | --- |
   | `PARKKEAN_LIVE_API_URL` | ✅ | HTTPS URL that returns live lot data. |
   | `PARKKEAN_LIVE_API_KEY` | ⬜️ | Optional token sent with each request. |
   | `PARKKEAN_LIVE_API_KEY_HEADER` | ⬜️ | Header name for the token (defaults to `Authorization`). |
   | `PARKKEAN_LIVE_TIMEOUT_MS` | ⬜️ | Request timeout in milliseconds (defaults to `5000`). |

   Example (macOS/Linux):
   ```sh
   export PARKKEAN_LIVE_API_URL="https://example.com/parking/live"
   export PARKKEAN_LIVE_API_KEY="Bearer your-token"
   npm run dev
   ```

3. The express server now merges the remote data into the local lot list each time `/api/lots` or `/api/lots/refresh` is called. Successful syncs are persisted into SQLite so the UI keeps the last known values if the feed goes offline.

### Expected Payload Shape

The live endpoint can return either:

```json
[
  {
    "code": "STADIUM",
    "name": "Stadium Parking",
    "capacity": 300,
    "occupancy": 275,
    "status": "LIMITED",
    "walk_time": 5,
    "full_by": "08:15",
    "last_updated": 1713556800000
  }
]
```

or an object with a `lots` array. Field names are flexible—the server normalizes common alternatives such as `lotCode`, `occupied`, `updated_at`, etc. Status values are mapped into `OPEN`, `LIMITED`, or `FULL`. If the feed omits a status, it is inferred from capacity and occupancy.

When the feed is unavailable or returns an empty payload, the server falls back to the stored values and the existing simulated refresh endpoint.

## Front-End Indicators

The app header displays a "Live feed" badge whenever the remote data is in use. If the feed becomes stale (last update older than five minutes) or unavailable, the badge switches to a warning/“Offline data” state so users know what they are seeing.

## API Overview

- `GET /api/lots` – list lots (merged with live feed when configured).
- `POST /api/lots/refresh` – force a refresh; uses the live feed if available, otherwise simulates minor changes.
- `POST /api/reports` – submit a user report and award points.
- `GET /api/leaderboard` – top reporters.
- `POST /api/users` / `GET /api/users/:username` – lightweight user registration and lookup.

## Development Notes

- The project uses native `fetch` in Node 18+; no additional client library is required for the live API call.
- All tables are created automatically on boot. To reset, delete `data/parkkean.db` and restart the server.
- No network requests occur unless `PARKKEAN_LIVE_API_URL` is set, so the app works entirely offline with the seeded data.
