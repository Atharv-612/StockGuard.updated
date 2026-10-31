const { getStore, verifyToken, parseBody, sendJson } = require('./_store');

function getExpiryStatus(expiryDate, alertDays) {
  if (!expiryDate) return { status: 'NO_EXPIRY', daysToExpiry: null };
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + alertDays);
  const limitStr = limitDate.toISOString().slice(0, 10);
  const daysToExpiry = Math.ceil((new Date(expiryDate) - now) / 86400000);
  if (expiryDate < today) return { status: 'EXPIRED', daysToExpiry };
  if (expiryDate <= limitStr) return { status: 'EXPIRING_SOON', daysToExpiry };
  return { status: 'OK', daysToExpiry };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;
  const user = store.users.find(u => u.id === userId);
  const alertDays = user ? (user.expiryAlertDays || 7) : (payload.expiryAlertDays || 7);

  const rawPath = (req.url || '').split('?')[0].replace(/\/+$/, '');
  // strip leading /api
  const sub = rawPath.replace(/^\/api\/alerts/, '') || '/';

  const today = new Date().toISOString().slice(0, 10);
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + alertDays);
  const limitStr = limitDate.toISOString().slice(0, 10);

  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);
  const userProductIds = userProducts.map(p => p.id);
  const userBatches = store.batches.filter(b => userProductIds.includes(b.productId) && b.status === 'ACTIVE');

  // Enrich batches with expiry info
  const enrichBatch = (b) => {
    const p = userProducts.find(pr => pr.id === b.productId);
    const { status: expiryStatus, daysToExpiry } = getExpiryStatus(b.expiryDate, alertDays);
    return { ...b, productName: p ? p.name : 'Unknown', unit: p ? p.unit : 'pcs',
      value: b.quantity * (p ? p.price : 0), expiryStatus, daysToExpiry };
  };

  const expired = userBatches.filter(b => b.expiryDate && b.expiryDate < today).map(enrichBatch);
  const expiringSoon = userBatches.filter(b => b.expiryDate && b.expiryDate >= today && b.expiryDate <= limitStr).map(enrichBatch);
  const lowStock = userProducts.filter(p => p.currentStock > 0 && p.currentStock <= (p.lowStockThreshold || 5));
  const outOfStock = userProducts.filter(p => p.currentStock <= 0);
  const totalAlerts = expired.length + expiringSoon.length + lowStock.length + outOfStock.length;

  // GET /api/alerts/status
  if (sub === '/status') {
    return sendJson(res, 200, {
      alertsEnabled: user ? user.alertsEnabled : true,
      phoneNumber: user ? (user.phoneNumber || '') : '',
      scheduleCron: '0 0 9 * * *'
    });
  }

  // GET /api/alerts/history
  if (sub === '/history') {
    return sendJson(res, 200, [
      { id: 1, trigger: 'DAILY_DIGEST', status: 'SENT',
        message: 'Daily expiry & stock summary', detail: 'Alerts processed',
        createdAt: new Date().toISOString() }
    ]);
  }

  // POST /api/alerts/send
  if (sub === '/send') {
    let msg = `*StockGuard Alert Digest*\n\n`;
    if (expired.length) msg += `*Expired (${expired.length}):*\n` + expired.map(b => `- ${b.productName} (Batch ${b.batchNumber})`).join('\n') + '\n\n';
    if (expiringSoon.length) msg += `*Expiring soon (${expiringSoon.length}):*\n` + expiringSoon.map(b => `- ${b.productName} (Batch ${b.batchNumber}) expires ${b.expiryDate}`).join('\n') + '\n\n';
    if (lowStock.length) msg += `*Low stock (${lowStock.length}):*\n` + lowStock.map(p => `- ${p.name}: ${p.currentStock} ${p.unit} left`).join('\n') + '\n\n';
    if (!expired.length && !expiringSoon.length && !lowStock.length) msg += '✅ All good! No alerts at this time.';
    return sendJson(res, 200, { sent: true, status: 'SENT', message: msg,
      detail: `${expired.length} expired, ${expiringSoon.length} expiring, ${lowStock.length} low stock` });
  }

  // GET /api/alerts (main)
  return sendJson(res, 200, {
    count: totalAlerts, total: totalAlerts,
    expiryAlertDays: alertDays,
    expired, expiringSoon, lowStock, outOfStock
  });
};
