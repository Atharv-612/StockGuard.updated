const { getStore, verifyToken, sendJson } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = getStore();
  const userId = payload.id;
  const user = store.users.find(u => u.id === userId) || store.users[0];

  const today = new Date().toISOString().slice(0, 10);
  const alertDays = user.expiryAlertDays || 7;
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + alertDays);
  const limitStr = limitDate.toISOString().slice(0, 10);

  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);
  const userProductIds = userProducts.map(p => p.id);
  const userBatches = store.batches.filter(b => userProductIds.includes(b.productId) && b.status === 'ACTIVE');

  const expired = userBatches.filter(b => b.expiryDate && b.expiryDate < today);
  const expiringSoon = userBatches.filter(b => b.expiryDate && b.expiryDate >= today && b.expiryDate <= limitStr);
  const lowStock = userProducts.filter(p => p.currentStock > 0 && p.currentStock <= (p.lowStockThreshold || 5));
  const outOfStock = userProducts.filter(p => p.currentStock <= 0);

  const totalAlerts = expired.length + expiringSoon.length + lowStock.length + outOfStock.length;

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      count: totalAlerts,
      total: totalAlerts,
      expiryAlertDays: alertDays,
      expired,
      expiringSoon,
      lowStock,
      outOfStock
    });
  }

  return sendJson(res, 200, { sent: true, message: 'Alerts processed' });
};
