const { verifyToken, toUserDto, getStore, sendJson } = require('../_store');
const { isRedisConfigured } = require('../_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  // 1. If a real database (Redis) is connected, get the latest data from it
  if (isRedisConfigured()) {
    try {
      const store = await getStore();
      const dbUser = store.users.find(u => u.id === payload.id);
      if (dbUser) return sendJson(res, 200, toUserDto(dbUser));
    } catch (e) { /* fall through to JWT */ }
  }

  // 2. In stateless mode, the signed JWT payload holds the user's latest saved profile
  if (payload.ownerName !== undefined && payload.shopName !== undefined) {
    return sendJson(res, 200, {
      id: payload.id,
      ownerName: payload.ownerName,
      shopName: payload.shopName,
      email: payload.email,
      phoneNumber: payload.phoneNumber || null,
      expiryAlertDays: payload.expiryAlertDays || 7,
      alertsEnabled: payload.alertsEnabled !== false
    });
  }

  // 3. Fallback: in-memory store
  const store = await getStore();
  const user = store.users.find(u => u.id === payload.id);
  if (!user) return sendJson(res, 401, { message: 'Account not found, please log in again' });
  return sendJson(res, 200, toUserDto(user));
};
