const { getStore, saveStore, verifyToken, parseBody, sendJson } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const urlPath = req.url ? req.url.split('?')[0].replace(/^\/api\/?/, '') : '';
  const store = getStore();
  const userId = payload.id;
  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);

  // Reports
  if (urlPath === 'reports/sales') {
    const userSales = store.sales.filter(s => s.ownerId === userId);
    const totalRevenue = userSales.reduce((a, s) => a + s.totalPrice, 0);
    const totalItems = userSales.reduce((a, s) => a + s.quantity, 0);
    return sendJson(res, 200, {
      from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
      totalRevenue,
      totalItems,
      totalBills: userSales.length,
      daily: [],
      sales: userSales
    });
  }

  if (urlPath === 'reports/monthly') {
    const userSales = store.sales.filter(s => s.ownerId === userId);
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const rev = userSales.filter(s => new Date(s.saleDate).getMonth() + 1 === m).reduce((a, s) => a + s.totalPrice, 0);
      months.push({ year: new Date().getFullYear(), month: m, revenue: rev, items: 10 });
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
    return sendJson(res, 200, Object.values(map).slice(0, 10));
  }

  if (urlPath === 'reports/reorder') {
    const list = userProducts.map(p => ({
      productId: p.id,
      name: p.name,
      category: p.category,
      currentStock: p.currentStock,
      soldLast30Days: 15,
      avgDailySales: 0.5,
      daysOfStockLeft: p.currentStock ? Math.round(p.currentStock / 0.5) : 0,
      suggestedOrderQty: Math.max(0, 20 - p.currentStock),
      advice: p.currentStock <= p.lowStockThreshold ? 'Order soon' : 'Stock adequate'
    }));
    return sendJson(res, 200, list);
  }

  if (urlPath === 'reports/stock') {
    return sendJson(res, 200, userProducts);
  }

  if (urlPath === 'reports/waste') {
    return sendJson(res, 200, {
      disposedUnits: 4,
      disposedValue: 140,
      expiredUnitsOnShelf: 8,
      expiredValueOnShelf: 280
    });
  }

  if (urlPath === 'alerts/status') {
    const user = store.users.find(u => u.id === userId);
    return sendJson(res, 200, {
      alertsEnabled: user ? user.alertsEnabled : true,
      phoneNumber: user ? user.phoneNumber : '',
      scheduleCron: '0 0 9 * * *'
    });
  }

  if (urlPath === 'alerts/history') {
    return sendJson(res, 200, [
      { id: 1, trigger: 'DAILY_DIGEST', status: 'SENT', message: 'Daily expiry & stock summary', detail: '2 expired, 3 low stock', createdAt: new Date().toISOString() }
    ]);
  }

  if (urlPath === 'alerts/send') {
    return sendJson(res, 200, {
      sent: true,
      status: 'SENT',
      message: 'Digest triggered successfully',
      detail: 'Summary processed'
    });
  }

  // Dispose batch
  if (urlPath.includes('/dispose')) {
    const match = urlPath.match(/batches\/(\d+)\/dispose/);
    if (match) {
      const batchId = Number(match[1]);
      const batch = store.batches.find(b => b.id === batchId);
      if (batch) {
        batch.status = 'DISPOSED';
        saveStore(store);
      }
      return sendJson(res, 200, { success: true });
    }
  }

  return sendJson(res, 404, { message: `Route /api/${urlPath} not found` });
};
