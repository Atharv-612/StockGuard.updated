const { verifyToken, toUserDto, getStore, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  const payload = verifyToken(req);
  if (!payload) {
    return sendJson(res, 401, { message: 'Session expired' });
  }

  // If full profile is embedded in the JWT (new tokens), return it directly.
  // This works across all stateless Vercel serverless invocations.
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

  // Fallback: try the in-memory store (works for demo user in same lambda warm state).
  const store = getStore();
  const user = store.users.find(u => u.id === payload.id);
  if (!user) {
    return sendJson(res, 401, { message: 'Account not found, please log in again' });
  }

  return sendJson(res, 200, toUserDto(user));
};
