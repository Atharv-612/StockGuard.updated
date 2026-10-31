const { getStore, verifyToken, sendJson } = require('../_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;

  const urlObj = new URL('http://x' + (req.url || ''));
  const days = parseInt(urlObj.searchParams.get('days') || '7');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);
  const salesInPeriod = store.sales.filter(s => s.ownerId === userId && (s.saleDate || '').slice(0, 10) >= cutoffStr);

  const map = {};
  salesInPeriod.forEach(s => {
    if (!map[s.productName]) {
      const p = userProducts.find(pr => pr.id === s.productId);
      map[s.productName] = {
        productId: s.productId,
        name: s.productName,
        category: p ? p.category : 'General',
        quantity: 0,
        revenue: 0
      };
    }
    map[s.productName].quantity += s.quantity;
    map[s.productName].revenue += s.totalPrice;
  });

  return sendJson(res, 200, Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 10));
};
