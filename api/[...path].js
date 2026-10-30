const { getStore, saveStore, verifyToken, parseBody, sendJson } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const urlPath = req.url ? req.url.split('?')[0].replace(/^\/api\/?/, '') : '';
  const store = await getStore();
  const userId = payload.id;
  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);

  // ---------- Reports ----------

  if (urlPath === 'reports/sales') {
    const userSales = store.sales.filter(s => s.ownerId === userId);
    return sendJson(res, 200, {
      from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
      totalRevenue: userSales.reduce((a, s) => a + s.totalPrice, 0),
      totalItems: userSales.reduce((a, s) => a + s.quantity, 0),
      totalBills: userSales.length,
      daily: [],
      sales: userSales
    });
  }

  if (urlPath === 'reports/monthly') {
    const userSales = store.sales.filter(s => s.ownerId === userId);
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const rev = userSales
        .filter(s => new Date(s.saleDate).getMonth() + 1 === m)
        .reduce((a, s) => a + s.totalPrice, 0);
      months.push({ year: new Date().getFullYear(), month: m, revenue: rev, items: 0 });
    }
    return sendJson(res, 200, months);
  }

  if (urlPath === 'reports/top-products') {
    const map = {};
    store.sales.filter(s => s.ownerId === userId).forEach(s => {
      if (!map[s.productName]) map[s.productName] = { productId: s.productId, name: s.productName, category: 'General', quantity: 0, revenue: 0 };
      map[s.productName].quantity += s.quantity;
      map[s.productName].revenue += s.totalPrice;
    });
    return sendJson(res, 200, Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 10));
  }

  if (urlPath === 'reports/reorder') {
    const list = userProducts.map(p => ({
      productId: p.id,
      name: p.name,
      category: p.category,
      currentStock: p.currentStock,
      soldLast30Days: store.sales.filter(s => s.ownerId === userId && s.productId === p.id).reduce((a, s) => a + s.quantity, 0),
      avgDailySales: 0.5,
      daysOfStockLeft: p.currentStock ? Math.round(p.currentStock / 0.5) : 0,
      suggestedOrderQty: Math.max(0, 20 - p.currentStock),
      advice: p.currentStock <= (p.lowStockThreshold || 5) ? 'Order soon' : 'Stock adequate'
    }));
    return sendJson(res, 200, list);
  }

  if (urlPath === 'reports/stock') return sendJson(res, 200, userProducts);

  if (urlPath === 'reports/waste') {
    const expiredBatches = store.batches.filter(b => {
      const isUser = userProducts.some(p => p.id === b.productId);
      return isUser && b.status === 'DISPOSED';
    });
    return sendJson(res, 200, {
      disposedUnits: expiredBatches.reduce((a, b) => a + (b.quantity || 0), 0),
      disposedValue: expiredBatches.reduce((a, b) => {
        const p = userProducts.find(pr => pr.id === b.productId);
        return a + (b.quantity || 0) * (p ? p.price : 0);
      }, 0),
      expiredUnitsOnShelf: 0,
      expiredValueOnShelf: 0
    });
  }

  // ---------- Alerts ----------

  if (urlPath === 'alerts/status') {
    const user = store.users.find(u => u.id === userId);
    return sendJson(res, 200, {
      alertsEnabled: user ? user.alertsEnabled : (payload.alertsEnabled !== false),
      phoneNumber: user ? user.phoneNumber : (payload.phoneNumber || ''),
      scheduleCron: '0 0 9 * * *'
    });
  }

  if (urlPath === 'alerts/history') {
    return sendJson(res, 200, [
      { id: 1, trigger: 'DAILY_DIGEST', status: 'SENT', message: 'Daily expiry & stock summary', detail: 'Summary sent', createdAt: new Date().toISOString() }
    ]);
  }

  if (urlPath === 'alerts/send') {
    return sendJson(res, 200, { sent: true, status: 'SENT', message: 'Digest triggered successfully', detail: 'Summary processed' });
  }

  // ---------- Batch dispose ----------

  if (urlPath.includes('/dispose')) {
    const match = urlPath.match(/batches\/(\d+)\/dispose/);
    if (match) {
      const batchId = Number(match[1]);
      const batch = store.batches.find(b => b.id === batchId);
      if (batch) {
        const p = store.products.find(pr => pr.id === batch.productId && pr.ownerId === userId);
        if (p) {
          p.currentStock = Math.max(0, (p.currentStock || 0) - (batch.quantity || 0));
          batch.quantity = 0;
        }
        batch.status = 'DISPOSED';
        await saveStore(store);
      }
      return sendJson(res, 200, { success: true });
    }
  }

  return sendJson(res, 404, { message: `Route /api/${urlPath} not found` });
};
