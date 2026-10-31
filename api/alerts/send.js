const { getStore, verifyToken, parseBody, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;
  const today = new Date().toISOString().slice(0, 10);
  const user = store.users.find(u => u.id === userId);
  const alertDays = user ? (user.expiryAlertDays || 7) : 7;
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + alertDays);
  const limitStr = limitDate.toISOString().slice(0, 10);

  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);
  const userProductIds = userProducts.map(p => p.id);
  const userBatches = store.batches.filter(b => userProductIds.includes(b.productId) && b.status === 'ACTIVE');

  const expired = userBatches.filter(b => b.expiryDate && b.expiryDate < today);
  const expiringSoon = userBatches.filter(b => b.expiryDate && b.expiryDate >= today && b.expiryDate <= limitStr);
  const lowStock = userProducts.filter(p => p.currentStock > 0 && p.currentStock <= (p.lowStockThreshold || 5));

  let msg = `*StockGuard Alert Digest*\n\n`;
  if (expired.length) msg += `*Expired (${expired.length}):*\n` + expired.map(b => {
    const p = userProducts.find(pr => pr.id === b.productId);
    return `- ${p ? p.name : 'Unknown'} (Batch ${b.batchNumber})`;
  }).join('\n') + '\n\n';
  if (expiringSoon.length) msg += `*Expiring soon (${expiringSoon.length}):*\n` + expiringSoon.map(b => {
    const p = userProducts.find(pr => pr.id === b.productId);
    return `- ${p ? p.name : 'Unknown'} (Batch ${b.batchNumber}) - ${b.expiryDate}`;
  }).join('\n') + '\n\n';
  if (lowStock.length) msg += `*Low stock (${lowStock.length}):*\n` + lowStock.map(p => `- ${p.name}: ${p.currentStock} ${p.unit} left`).join('\n') + '\n\n';
  if (!expired.length && !expiringSoon.length && !lowStock.length) msg += '✅ All good! No alerts at this time.';

  return sendJson(res, 200, {
    sent: true,
    status: 'SENT',
    message: msg,
    detail: `${expired.length} expired, ${expiringSoon.length} expiring, ${lowStock.length} low stock`
  });
};
