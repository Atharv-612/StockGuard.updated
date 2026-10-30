const { getStore, saveStore, verifyToken, createToken, createCredToken, toUserDto, parseBody, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  let user = store.users.find(u => u.id === payload.id);

  // If user is not in this Lambda's store (new user registered in a different Lambda),
  // reconstruct from JWT payload and add to store.
  if (!user && payload.ownerName !== undefined) {
    user = {
      id: payload.id,
      email: payload.email,
      ownerName: payload.ownerName || '',
      shopName: payload.shopName || '',
      phoneNumber: payload.phoneNumber || null,
      expiryAlertDays: payload.expiryAlertDays || 7,
      alertsEnabled: payload.alertsEnabled !== false,
      password: '',
      createdAt: new Date().toISOString()
    };
    store.users.push(user);
  }

  if (!user) return sendJson(res, 401, { message: 'Account not found, please log in again' });

  const body = await parseBody(req);
  if (body.ownerName) user.ownerName = body.ownerName.trim();
  if (body.shopName) user.shopName = body.shopName.trim();
  if (body.phoneNumber !== undefined) user.phoneNumber = body.phoneNumber ? body.phoneNumber.trim() : null;
  if (body.expiryAlertDays !== undefined) user.expiryAlertDays = Number(body.expiryAlertDays) || 7;
  if (body.alertsEnabled !== undefined) user.alertsEnabled = Boolean(body.alertsEnabled);

  await saveStore(store);

  // Issue fresh JWT so the updated profile is reflected in subsequent /me calls
  const newToken = createToken(user);
  const newCredToken = createCredToken(user);
  const dto = toUserDto(user);
  return sendJson(res, 200, { ...dto, token: newToken, credToken: newCredToken });
};
