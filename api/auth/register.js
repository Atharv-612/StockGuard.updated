const { getStore, saveStore, hashPassword, createToken, toUserDto, parseBody, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { message: 'Method not allowed' });
  }

  const body = await parseBody(req);
  const ownerName = (body.ownerName || '').trim();
  const shopName = (body.shopName || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phoneNumber = (body.phoneNumber || '').trim();
  const password = body.password || '';

  if (!ownerName) {
    return sendJson(res, 400, { message: 'Owner name is required' });
  }
  if (!shopName) {
    return sendJson(res, 400, { message: 'Shop name is required' });
  }
  if (!email || !email.includes('@')) {
    return sendJson(res, 400, { message: 'Enter a valid email' });
  }
  if (!password || password.length < 6) {
    return sendJson(res, 400, { message: 'Password must be at least 6 characters' });
  }

  const store = getStore();
  const existing = store.users.find(u => (u.email || '').toLowerCase() === email);
  if (existing) {
    return sendJson(res, 409, { message: 'An account with this email already exists' });
  }

  const newUser = {
    id: store.nextId.user++,
    ownerName,
    shopName,
    email,
    phoneNumber: phoneNumber || null,
    password: hashPassword(password),
    expiryAlertDays: 7,
    alertsEnabled: true,
    createdAt: new Date().toISOString()
  };

  store.users.push(newUser);
  saveStore(store);

  const token = createToken(newUser);
  return sendJson(res, 201, {
    token,
    user: toUserDto(newUser)
  });
};
