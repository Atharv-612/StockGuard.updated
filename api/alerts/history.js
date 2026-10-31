const { verifyToken, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  return sendJson(res, 200, [
    {
      id: 1,
      trigger: 'DAILY_DIGEST',
      status: 'SENT',
      message: 'Daily expiry & stock summary sent',
      detail: 'Alerts processed for your inventory',
      createdAt: new Date().toISOString()
    }
  ]);
};
