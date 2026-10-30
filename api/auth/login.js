const { getStore, verifyPassword, verifyCredToken, createToken, createCredToken, toUserDto, parseBody, sendJson } = require('../_store');

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
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  // credToken is stored in localStorage after registration and sent on login
  // so we can verify credentials statelessly across Lambda invocations.
  const credToken = body.credToken || null;

  if (!email || !password) {
    return sendJson(res, 400, { message: 'Email and password are required' });
  }

  // 1. Try the in-memory store first (covers demo user + same warm Lambda).
  const store = getStore();
  const storeUser = store.users.find(u => (u.email || '').toLowerCase() === email);

  if (storeUser && verifyPassword(password, storeUser.password)) {
    const token = createToken(storeUser);
    const newCredToken = createCredToken(storeUser);
    return sendJson(res, 200, { token, credToken: newCredToken, user: toUserDto(storeUser) });
  }

  // 2. Fallback: verify using the signed credential token from localStorage.
  //    This handles newly registered users whose data isn't in this Lambda's memory.
  if (credToken) {
    const cred = verifyCredToken(credToken);
    if (cred && (cred.email || '').toLowerCase() === email && verifyPassword(password, cred.password)) {
      // Reconstruct user object from credential token
      const user = {
        id: cred.id,
        email: cred.email,
        ownerName: cred.ownerName || '',
        shopName: cred.shopName || '',
        phoneNumber: cred.phoneNumber || null,
        expiryAlertDays: cred.expiryAlertDays || 7,
        alertsEnabled: cred.alertsEnabled !== false,
        password: cred.password
      };
      const token = createToken(user);
      const newCredToken = createCredToken(user);
      return sendJson(res, 200, { token, credToken: newCredToken, user: toUserDto(user) });
    }
  }

  return sendJson(res, 401, { message: 'Wrong email or password' });
};
