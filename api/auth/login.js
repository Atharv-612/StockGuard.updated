const { getStore, verifyPassword, createToken, toUserDto, parseBody, sendJson } = require('../_store');

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

  if (!email || !password) {
    return sendJson(res, 400, { message: 'Email and password are required' });
  }

  const store = getStore();
  const user = store.users.find(u => (u.email || '').toLowerCase() === email);

  if (!user || !verifyPassword(password, user.password)) {
    return sendJson(res, 401, { message: 'Wrong email or password' });
  }

  const token = createToken(user);
  return sendJson(res, 200, {
    token,
    user: toUserDto(user)
  });
};
