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
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);

  const list = userProducts.map(p => {
    const soldLast30Days = store.sales
      .filter(s => s.ownerId === userId && s.productId === p.id && (s.saleDate || '').slice(0, 10) >= cutoff30)
      .reduce((a, s) => a + s.quantity, 0);
    const avgDailySales = soldLast30Days > 0 ? Math.round((soldLast30Days / 30) * 10) / 10 : 0;
    const daysOfStockLeft = avgDailySales > 0 ? Math.round(p.currentStock / avgDailySales) : (p.currentStock > 0 ? 999 : 0);
    const suggestedOrderQty = Math.max(0, (p.lowStockThreshold || 5) * 3 - p.currentStock);
    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      currentStock: p.currentStock,
      unit: p.unit,
      soldLast30Days,
      avgDailySales,
      daysOfStockLeft: daysOfStockLeft > 999 ? 999 : daysOfStockLeft,
      suggestedOrderQty,
      advice: p.currentStock <= 0 ? 'Out of stock — order now' :
              p.currentStock <= (p.lowStockThreshold || 5) ? 'Order soon' : 'Stock adequate'
    };
  });

  return sendJson(res, 200, list);
};
