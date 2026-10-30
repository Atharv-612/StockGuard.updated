const { getStore, verifyToken, toUserDto, sendJson } = require('../_store');

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

  const store = getStore();
  const user = store.users.find(u => u.id === payload.id);
  if (!user) {
    return sendJson(res, 401, { message: 'Account not found, please log in again' });
  }

  return sendJson(res, 200, toUserDto(user));
};
