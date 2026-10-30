const { verifyToken, toUserDto, getStore, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  // If full profile is embedded in the JWT (all new tokens), return it directly.
  // This works statelessly across all Vercel Lambda invocations.
  if (payload.ownerName !== undefined && payload.shopName !== undefined) {
    // Also try to get fresh data from DB (in case settings were updated)
    try {
      const store = await getStore();
      const dbUser = store.users.find(u => u.id === payload.id);
      if (dbUser) return sendJson(res, 200, toUserDto(dbUser));
    } catch (e) { /* fall through to JWT payload */ }

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

  // Fallback: in-memory store
  const store = await getStore();
  const user = store.users.find(u => u.id === payload.id);
  if (!user) return sendJson(res, 401, { message: 'Account not found, please log in again' });
  return sendJson(res, 200, toUserDto(user));
};
