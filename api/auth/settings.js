const { getStore, saveStore, verifyToken, toUserDto, parseBody, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
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

  const body = await parseBody(req);
  if (body.ownerName) user.ownerName = body.ownerName.trim();
  if (body.shopName) user.shopName = body.shopName.trim();
  if (body.phoneNumber !== undefined) user.phoneNumber = body.phoneNumber ? body.phoneNumber.trim() : null;
  if (body.expiryAlertDays !== undefined) user.expiryAlertDays = Number(body.expiryAlertDays) || 7;
  if (body.alertsEnabled !== undefined) user.alertsEnabled = Boolean(body.alertsEnabled);

  saveStore(store);
  return sendJson(res, 200, toUserDto(user));
};
