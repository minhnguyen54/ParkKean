import { URL } from "url";

const VALID_STATUSES = new Set(["OPEN", "LIMITED", "FULL"]);
const STATUS_MAPPINGS = new Map([
  ["AVAILABLE", "OPEN"],
  ["OPEN", "OPEN"],
  ["FREE", "OPEN"],
  ["EMPTY", "OPEN"],
  ["PARTIAL", "LIMITED"],
  ["LIMITED", "LIMITED"],
  ["NEAR CAPACITY", "LIMITED"],
  ["ALMOST FULL", "LIMITED"],
  ["CROWDED", "LIMITED"],
  ["FULL", "FULL"],
  ["CLOSED", "FULL"],
  ["BLOCKED", "FULL"],
]);

const API_URL = process.env.PARKKEAN_LIVE_API_URL?.trim();
const API_KEY = process.env.PARKKEAN_LIVE_API_KEY?.trim();
const API_KEY_HEADER = process.env.PARKKEAN_LIVE_API_KEY_HEADER?.trim() || "Authorization";
const API_REQUEST_TIMEOUT = Number.parseInt(process.env.PARKKEAN_LIVE_TIMEOUT_MS || "", 10) || 5000;

function coerceTimestamp(input) {
  if (!input) return Date.now();
  if (typeof input === "number" && Number.isFinite(input)) {
    return input > 1e12 ? input : input * 1000;
  }
  const asNumber = Number.parseFloat(input);
  if (Number.isFinite(asNumber)) {
    return asNumber > 1e12 ? asNumber : asNumber * 1000;
  }
  const date = new Date(input);
  const value = date.getTime();
  return Number.isFinite(value) ? value : Date.now();
}

function normalizeStatus(rawStatus, capacity, occupancy) {
  if (rawStatus) {
    const normalized = rawStatus.toString().trim().toUpperCase();
    if (STATUS_MAPPINGS.has(normalized)) {
      return STATUS_MAPPINGS.get(normalized);
    }
    if (VALID_STATUSES.has(normalized)) {
      return normalized;
    }
  }
  if (Number.isFinite(capacity) && capacity > 0 && Number.isFinite(occupancy)) {
    if (occupancy >= capacity) return "FULL";
    if (occupancy >= capacity * 0.75) return "LIMITED";
  }
  return "OPEN";
}

function toNumber(value) {
  if (value === null || typeof value === "undefined") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLots(payload) {
  const data = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.lots)
    ? payload.lots
    : [];

  return data
    .map((item) => {
      const code =
        item?.code ??
        item?.lotCode ??
        item?.lot_code ??
        item?.id ??
        item?.lotId ??
        item?.lot_id ??
        null;

      if (!code) return null;

      const name = item?.name ?? item?.lotName ?? item?.lot_name ?? String(code);
      const capacity =
        toNumber(item?.capacity ?? item?.totalCapacity ?? item?.max ?? item?.total) ?? null;
      const occupancy =
        toNumber(item?.occupancy ?? item?.occupied ?? item?.used ?? item?.vehicles) ?? null;
      const walkTime =
        toNumber(item?.walk_time ?? item?.walkTime ?? item?.walking_minutes ?? null) ?? null;
      const fullBy =
        typeof item?.full_by === "string"
          ? item.full_by
          : typeof item?.fullBy === "string"
          ? item.fullBy
          : null;
      const status = normalizeStatus(item?.status ?? item?.state, capacity, occupancy);
      const lastUpdated = coerceTimestamp(
        item?.last_updated ?? item?.lastUpdated ?? item?.updated_at ?? item?.timestamp
      );

      return {
        code: String(code).trim().toUpperCase(),
        name: String(name).trim(),
        capacity,
        occupancy,
        status,
        walk_time: walkTime,
        full_by: fullBy,
        last_updated: lastUpdated,
      };
    })
    .filter(Boolean);
}

export async function fetchLiveLotSnapshot(logger = console) {
  if (!API_URL) return null;
  if (typeof fetch !== "function") {
    logger.warn("[LiveData] fetch API not available in this Node.js runtime");
    return null;
  }

  let requestUrl;
  try {
    requestUrl = new URL(API_URL);
  } catch (error) {
    logger.error("[LiveData] Invalid PARKKEAN_LIVE_API_URL:", error);
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT);

  const headers = {};
  if (API_KEY) {
    headers[API_KEY_HEADER] = API_KEY;
  }

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      logger.error("[LiveData] Live API responded with status", response.status);
      return null;
    }
    const payload = await response.json();
    const lots = normalizeLots(payload);
    if (!lots.length) {
      logger.warn("[LiveData] Live API returned no lot data");
      return null;
    }
    return lots;
  } catch (error) {
    if (error.name === "AbortError") {
      logger.error("[LiveData] Live API request timed out");
    } else {
      logger.error("[LiveData] Failed to fetch live data", error);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function mergeLiveLots(databaseLots, liveLots) {
  if (!Array.isArray(databaseLots) || !Array.isArray(liveLots)) return databaseLots ?? [];
  const liveByCode = new Map(liveLots.map((lot) => [lot.code, lot]));

  return databaseLots.map((lot) => {
    const live = liveByCode.get(lot.code?.toUpperCase());
    if (!live) return lot;
    return {
      ...lot,
      occupancy: live.occupancy ?? lot.occupancy,
      capacity: live.capacity ?? lot.capacity,
      status: VALID_STATUSES.has(live.status) ? live.status : lot.status,
      walk_time: live.walk_time ?? lot.walk_time,
      full_by: live.full_by ?? lot.full_by,
      last_updated: live.last_updated ?? lot.last_updated,
    };
  });
}

export function hasLiveDataConfigured() {
  return Boolean(API_URL);
}
