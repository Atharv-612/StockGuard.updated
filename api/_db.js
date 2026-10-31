/**
 * Persistent storage via Upstash Redis HTTP API.
 * No npm packages needed — uses the built-in fetch() available in Node 18+.
 *
 * Environment variables required (set in Vercel dashboard):
 *   UPSTASH_REDIS_REST_URL   e.g. https://xxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN e.g. AXxxxx...
 *
 * If env vars are not set, falls back to in-memory + /tmp (development mode).
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const STORE_KEY = 'sg_store_v2';

const isRedisConfigured = () => !!(REDIS_URL && REDIS_TOKEN);

/**
 * Read the full store JSON from Redis.
 * Returns parsed object or null if not found / on error.
 */
async function dbRead() {
  if (!isRedisConfigured()) return null;
  try {
    const res = await fetch(`${REDIS_URL}/get/${STORE_KEY}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.result) return null;
    return JSON.parse(json.result);
  } catch (e) {
    console.error('[DB] Read error:', e.message);
    return null;
  }
}

/**
 * Write the full store JSON to Redis.
 * Redis SET with no expiry — data persists forever.
 */
async function dbWrite(data) {
  if (!isRedisConfigured()) return false;
  try {
    const res = await fetch(`${REDIS_URL}/set/${STORE_KEY}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(JSON.stringify(data))
    });
    return res.ok;
  } catch (e) {
    console.error('[DB] Write error:', e.message);
    return false;
  }
}

module.exports = { dbRead, dbWrite, isRedisConfigured };

