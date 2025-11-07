import express from "express";
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { fetchLiveLotSnapshot, mergeLiveLots } from "./liveData.js";

sqlite3.verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "parkkean.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const VALID_STATUSES = new Set(["OPEN", "LIMITED", "FULL"]);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(
    `CREATE TABLE IF NOT EXISTS lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      occupancy INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN',
      walk_time INTEGER DEFAULT 0,
      full_by TEXT,
      last_updated INTEGER DEFAULT 0
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      reports INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    )`
  );

  await run(
    `CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL REFERENCES lots(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      reported_status TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    )`
  );

  const lotCount = await get("SELECT COUNT(*) AS count FROM lots");
  if (!lotCount?.count) {
    await seedLots();
  }

  const userCount = await get("SELECT COUNT(*) AS count FROM users");
  if (!userCount?.count) {
    await seedUsers();
  }
}

async function seedLots() {
  const now = Date.now();
  const hours = (n) => n * 60 * 60 * 1000;
  const mins = (n) => n * 60 * 1000;
  const seedLots = [
    {
      code: "VAUGHN_EAMES",
      name: "Vaughn-Eames Lot",
      capacity: 140,
      occupancy: 110,
      walk_time: 4,
      full_by: "08:30",
      status: "LIMITED",
      last_updated: now - hours(2) - mins(15),
    },
    {
      code: "LIBERTY_HALL",
      name: "Liberty Hall Academic Building Lot",
      capacity: 180,
      occupancy: 95,
      walk_time: 6,
      full_by: "09:45",
      status: "OPEN",
      last_updated: now - hours(3),
    },
    {
      code: "OVERNIGHT",
      name: "Overnight Lot",
      capacity: 220,
      occupancy: 210,
      walk_time: 10,
      full_by: "07:15",
      status: "FULL",
      last_updated: now - hours(1) - mins(40),
    },
    {
      code: "STEM",
      name: "STEM Lot",
      capacity: 160,
      occupancy: 120,
      walk_time: 5,
      full_by: "09:30",
      status: "LIMITED",
      last_updated: now - hours(2),
    },
    {
      code: "EAST_CAMPUS",
      name: "East Campus Lot",
      capacity: 200,
      occupancy: 80,
      walk_time: 8,
      full_by: "11:00",
      status: "OPEN",
      last_updated: now - hours(3) - mins(30),
    },
    {
      code: "HYNES_HALL",
      name: "Hynes Hall Lot",
      capacity: 90,
      occupancy: 75,
      walk_time: 3,
      full_by: "08:15",
      status: "LIMITED",
      last_updated: now - hours(2) - mins(45),
    },
    {
      code: "KEAN_HALL",
      name: "Kean Hall Lot",
      capacity: 125,
      occupancy: 60,
      walk_time: 4,
      full_by: "12:00",
      status: "OPEN",
      last_updated: now - hours(4),
    },
    {
      code: "COUGAR_HALL",
      name: "Cougar Hall Lot",
      capacity: 150,
      occupancy: 130,
      walk_time: 7,
      full_by: "08:50",
      status: "LIMITED",
      last_updated: now - hours(1) - mins(20),
    },
    {
      code: "HARWOOD",
      name: "Harwood Lot",
      capacity: 110,
      occupancy: 45,
      walk_time: 9,
      full_by: "13:00",
      status: "OPEN",
      last_updated: now - hours(5),
    },
    {
      code: "D_ANGOLA",
      name: "D'Angola Lot",
      capacity: 95,
      occupancy: 92,
      walk_time: 6,
      full_by: "07:55",
      status: "FULL",
      last_updated: now - hours(2) - mins(5),
    },
    {
      code: "GLAB",
      name: "GLAB Lot",
      capacity: 130,
      occupancy: 70,
      walk_time: 4,
      full_by: "10:30",
      status: "OPEN",
      last_updated: now - hours(3) - mins(50),
    },
    {
      code: "ADMISSIONS",
      name: "Admissions Lot",
      capacity: 85,
      occupancy: 65,
      walk_time: 5,
      full_by: "09:10",
      status: "LIMITED",
      last_updated: now - hours(1) - mins(55),
    },
    {
      code: "MORRIS_AVE",
      name: "Morris Ave Lot",
      capacity: 210,
      occupancy: 150,
      walk_time: 12,
      full_by: "10:45",
      status: "OPEN",
      last_updated: now - hours(4) - mins(10),
    },
  ];

  for (const lot of seedLots) {
    await run(
      `INSERT INTO lots (code, name, capacity, occupancy, status, walk_time, full_by, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lot.code,
        lot.name,
        lot.capacity,
        lot.occupancy,
        lot.status,
        lot.walk_time,
        lot.full_by,
        lot.last_updated,
      ]
    );
  }
}

async function seedUsers() {
  const seedUsers = [
    { username: "michael", points: 45, reports: 9 },
    { username: "ava", points: 30, reports: 6 },
    { username: "jayden", points: 25, reports: 5 },
  ];

  for (const user of seedUsers) {
    await run(
      `INSERT INTO users (username, points, reports, created_at)
       VALUES (?, ?, ?, ?)`,
      [user.username, user.points, user.reports, Date.now() - Math.floor(Math.random() * 86400000)]
    );
  }

  const lot = await get("SELECT id FROM lots WHERE code = ?", ["OVERNIGHT"]);
  const user = await get("SELECT id FROM users WHERE username = ?", ["michael"]);
  if (lot && user) {
    await run(
      `INSERT INTO reports (lot_id, user_id, reported_status, note, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [lot.id, user.id, "FULL", "Upper deck closed for event prep.", Date.now() - 3600000]
    );
  }
}

async function getLotsWithReports(targetId = null) {
  const lots = await all(
    `SELECT id, code, name, capacity, occupancy, status, walk_time, full_by, last_updated
     FROM lots
     ORDER BY name ASC`
  );

  if (!lots.length) return targetId ? null : [];

  const lotIds = targetId ? [targetId] : lots.map((lot) => lot.id);
  const placeholders = lotIds.map(() => "?").join(",");
  const reports = await all(
    `SELECT r.id, r.lot_id, r.reported_status, r.note, r.created_at, u.username AS user
     FROM reports r
     JOIN users u ON u.id = r.user_id
     WHERE r.lot_id IN (${placeholders})
     ORDER BY r.created_at DESC`,
    lotIds
  );

  const grouped = new Map();
  reports.forEach((report) => {
    if (!grouped.has(report.lot_id)) grouped.set(report.lot_id, []);
    grouped.get(report.lot_id).push({
      id: report.id,
      lot_id: report.lot_id,
      reported_status: report.reported_status,
      note: report.note,
      created_at: Number(report.created_at),
      user: report.user,
    });
  });

  const normalizeLot = (lot) => ({
    id: lot.id,
    code: lot.code,
    name: lot.name,
    capacity: Number(lot.capacity),
    occupancy: Number(lot.occupancy),
    status: lot.status,
    walk_time: Number(lot.walk_time),
    full_by: lot.full_by,
    last_updated: Number(lot.last_updated),
    lastReport: grouped.get(lot.id)?.[0] ?? null,
  });

  if (targetId) {
    const lot = lots.find((item) => item.id === Number(targetId));
    return lot ? normalizeLot(lot) : null;
  }

  return lots.map(normalizeLot);
}

async function persistLiveLots(liveLots, previousLots = []) {
  if (!Array.isArray(liveLots) || !liveLots.length) return;
  const previousMap = new Map(previousLots.map((lot) => [lot.id, lot]));
  for (const lot of liveLots) {
    if (!lot?.id) continue;
    const prior = previousMap.get(lot.id) ?? {};
    const capacity = Number.isFinite(Number(lot.capacity))
      ? Number(lot.capacity)
      : Number(prior.capacity) || 0;
    const occupancy = Number.isFinite(Number(lot.occupancy))
      ? Math.max(0, Math.round(Number(lot.occupancy)))
      : Number(prior.occupancy) || 0;
    const walkTime = Number.isFinite(Number(lot.walk_time))
      ? Number(lot.walk_time)
      : Number(prior.walk_time) || 0;
    const fullBy =
      typeof lot.full_by === "string" && lot.full_by.trim()
        ? lot.full_by.trim()
        : prior.full_by ?? null;
    const status = VALID_STATUSES.has(lot.status) ? lot.status : prior.status ?? "OPEN";
    const lastUpdated = Number.isFinite(Number(lot.last_updated))
      ? Number(lot.last_updated)
      : Date.now();

    await run(
      `UPDATE lots
         SET capacity = ?,
             occupancy = ?,
             status = ?,
             walk_time = ?,
             full_by = ?,
             last_updated = ?
       WHERE id = ?`,
      [capacity, occupancy, status, walkTime, fullBy, lastUpdated, lot.id]
    );
  }
}

app.get("/api/lots", async (req, res, next) => {
  try {
    const lotsFromDb = await getLotsWithReports();
    const liveLots = await fetchLiveLotSnapshot().catch(() => null);
    const mergedLots = Array.isArray(liveLots) && liveLots.length
      ? mergeLiveLots(lotsFromDb, liveLots)
      : lotsFromDb;
    if (Array.isArray(liveLots) && liveLots.length) {
      await persistLiveLots(mergedLots, lotsFromDb);
    }
    res.json({
      lots: mergedLots,
      live: Array.isArray(liveLots) && liveLots.length > 0,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/lots/:id/reports", async (req, res, next) => {
  try {
    const { id } = req.params;
    const reports = await all(
      `SELECT r.id, r.lot_id, r.reported_status, r.note, r.created_at, u.username AS user
       FROM reports r
       JOIN users u ON u.id = r.user_id
       WHERE r.lot_id = ?
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [id]
    );
    res.json({
      reports: reports.map((report) => ({
        id: report.id,
        lot_id: report.lot_id,
        reported_status: report.reported_status,
        note: report.note,
        created_at: Number(report.created_at),
        user: report.user,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/lots/refresh", async (req, res, next) => {
  try {
    const lotsFromDb = await getLotsWithReports();
    const liveLots = await fetchLiveLotSnapshot().catch(() => null);
    if (Array.isArray(liveLots) && liveLots.length) {
      const merged = mergeLiveLots(lotsFromDb, liveLots);
      await persistLiveLots(merged, lotsFromDb);
      return res.json({ lots: merged, live: true });
    }

    const lots = await all("SELECT id, capacity, occupancy FROM lots");
    const now = Date.now();
    for (const lot of lots) {
      const capacity = Number(lot.capacity) || 0;
      const current = Number(lot.occupancy) || 0;
      const fluctuation = Math.round((Math.random() - 0.5) * capacity * 0.05);
      const nextOccupancy = Math.min(capacity, Math.max(0, current + fluctuation));
      await run(
        `UPDATE lots SET occupancy = ?, last_updated = ? WHERE id = ?`,
        [nextOccupancy, now, lot.id]
      );
    }
    const updated = await getLotsWithReports();
    res.json({ lots: updated, live: false });
  } catch (error) {
    next(error);
  }
});

app.post("/api/users", async (req, res, next) => {
  try {
    const username = req.body?.username?.trim();
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const lower = username.toLowerCase();
    let user = await get("SELECT id, username, points, reports FROM users WHERE lower(username) = ?", [
      lower,
    ]);
    if (!user) {
      const result = await run(
        `INSERT INTO users (username, points, reports, created_at) VALUES (?, 0, 0, ?)`,
        [username, Date.now()]
      );
      user = await get("SELECT id, username, points, reports FROM users WHERE id = ?", [
        result.id,
      ]);
    }
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

app.get("/api/users/:username", async (req, res, next) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    const user = await get(
      "SELECT id, username, points, reports FROM users WHERE lower(username) = ?",
      [username]
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.get("/api/leaderboard", async (req, res, next) => {
  try {
    const leaderboard = await all(
      `SELECT username, points
       FROM users
       ORDER BY points DESC, username ASC
       LIMIT 20`
    );
    res.json({ leaderboard: leaderboard.map((user) => ({ ...user, points: Number(user.points) })) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/reports", async (req, res, next) => {
  try {
    const { username, lotId, status, note } = req.body ?? {};
    if (!username || !lotId || !status) {
      return res.status(400).json({ error: "username, lotId, and status are required" });
    }
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const lot = await get("SELECT id FROM lots WHERE id = ?", [lotId]);
    if (!lot) {
      return res.status(404).json({ error: "Lot not found" });
    }

    const trimmedUsername = username.trim();
    const lowerUsername = trimmedUsername.toLowerCase();
    let user = await get(
      "SELECT id, username, points, reports FROM users WHERE lower(username) = ?",
      [lowerUsername]
    );
    if (!user) {
      const created = await run(
        `INSERT INTO users (username, points, reports, created_at) VALUES (?, 0, 0, ?)`,
        [trimmedUsername, Date.now()]
      );
      user = await get("SELECT id, username, points, reports FROM users WHERE id = ?", [
        created.id,
      ]);
    }

    const timestamp = Date.now();
    await run(
      `INSERT INTO reports (lot_id, user_id, reported_status, note, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [lotId, user.id, status, note?.trim() || "", timestamp]
    );
    await run(`UPDATE lots SET status = ?, last_updated = ? WHERE id = ?`, [status, timestamp, lotId]);
    await run(`UPDATE users SET points = points + 5, reports = reports + 1 WHERE id = ?`, [user.id]);

    const updatedUser = await get("SELECT id, username, points, reports FROM users WHERE id = ?", [
      user.id,
    ]);
    const updatedLot = await getLotsWithReports(lotId);

    res.status(201).json({
      user: updatedUser,
      lot: updatedLot,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ParkKean server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
