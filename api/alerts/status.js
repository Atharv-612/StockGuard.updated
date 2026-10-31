const { getStore, verifyToken, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;
  const user = store.users.find(u => u.id === userId);

  return sendJson(res, 200, {
    alertsEnabled: user ? user.alertsEnabled : (payload.alertsEnabled !== false),
    phoneNumber: user ? (user.phoneNumber || '') : (payload.phoneNumber || ''),
    scheduleCron: '0 0 9 * * *'
  });
};
