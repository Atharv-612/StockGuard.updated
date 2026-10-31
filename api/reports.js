const { getStore, verifyToken, sendJson } = require('./_store');

function enrichProduct(p, batches) {
  const today = new Date().toISOString().slice(0, 10);
  const activeBatches = batches.filter(b => b.productId === p.id && b.status === 'ACTIVE');
  const sellableStock = activeBatches.filter(b => !b.expiryDate || b.expiryDate >= today).reduce((a, b) => a + b.quantity, 0);
  const expiredStock = activeBatches.filter(b => b.expiryDate && b.expiryDate < today).reduce((a, b) => a + b.quantity, 0);
  const nearestExpiry = activeBatches.filter(b => b.expiryDate && b.expiryDate >= today)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0]?.expiryDate || null;
  const stockValue = sellableStock * p.price;
  let stockStatus = sellableStock <= 0 ? 'OUT_OF_STOCK' : (sellableStock <= (p.lowStockThreshold || 5) ? 'LOW_STOCK' : 'IN_STOCK');
  return { ...p, sellableStock, expiredStock, nearestExpiry, stockValue, stockStatus };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;
  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);

  // Extract sub-route from query (from rewrite: /api/reports?sub=sales) or from URL path
  const urlPath = (req.url || '').split('?')[0].replace(/\/+$/, '');
  const urlSub = urlPath.replace(/^\/api\/reports\/?/, '');
  const sub = ((req.query && req.query.sub) || urlSub || '').toLowerCase();

  // Parse query params (from URL search string)
  const urlObj = new URL('http://x' + (req.url || ''));
  const from = (req.query && req.query.from) || urlObj.searchParams.get('from') || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const to = (req.query && req.query.to) || urlObj.searchParams.get('to') || new Date().toISOString().slice(0, 10);
  const year = parseInt((req.query && req.query.year) || urlObj.searchParams.get('year') || new Date().getFullYear());
  const days = parseInt((req.query && req.query.days) || urlObj.searchParams.get('days') || '7');

  // GET /api/reports/sales
  if (sub === 'sales') {
    const userSales = store.sales.filter(s => {
      if (s.ownerId !== userId) return false;
      const d = (s.saleDate || '').slice(0, 10);
      return d >= from && d <= to;
    });
    const totalRevenue = userSales.reduce((a, s) => a + s.totalPrice, 0);
    const totalItems = userSales.reduce((a, s) => a + s.quantity, 0);
    const dailyMap = {};
    userSales.forEach(s => {
      const d = (s.saleDate || '').slice(0, 10);
      if (!dailyMap[d]) dailyMap[d] = { date: d, revenue: 0, items: 0, bills: new Set() };
      dailyMap[d].revenue += s.totalPrice;
      dailyMap[d].items += s.quantity;
      dailyMap[d].bills.add(s.billNumber);
    });
    const daily = [];
    let cur = new Date(from), end = new Date(to);
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10);
      const e = dailyMap[d] || { revenue: 0, items: 0, bills: new Set() };
      daily.push({ date: d, revenue: e.revenue, items: e.items, bills: e.bills instanceof Set ? e.bills.size : 0 });
      cur.setDate(cur.getDate() + 1);
    }
    const billSet = new Set(userSales.map(s => s.billNumber));
    return sendJson(res, 200, { from, to, totalRevenue, totalItems, totalBills: billSet.size, daily, sales: userSales });
  }

  // GET /api/reports/monthly
  if (sub === 'monthly') {
    const userSales = store.sales.filter(s => s.ownerId === userId);
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const ms = userSales.filter(s => { const d = new Date(s.saleDate || s.createdAt); return d.getFullYear() === year && d.getMonth() + 1 === m; });
      months.push({ year, month: m, revenue: ms.reduce((a, s) => a + s.totalPrice, 0), items: ms.reduce((a, s) => a + s.quantity, 0) });
    }
    return sendJson(res, 200, months);
  }

  // GET /api/reports/top-products
  if (sub === 'top-products') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const salesInPeriod = store.sales.filter(s => s.ownerId === userId && (s.saleDate || '').slice(0, 10) >= cutoffStr);
    const map = {};
    salesInPeriod.forEach(s => {
      if (!map[s.productName]) { const p = userProducts.find(pr => pr.id === s.productId); map[s.productName] = { productId: s.productId, name: s.productName, category: p ? p.category : 'General', quantity: 0, revenue: 0 }; }
      map[s.productName].quantity += s.quantity;
      map[s.productName].revenue += s.totalPrice;
    });
    return sendJson(res, 200, Object.values(map).sort((a, b) => b.quantity - a.quantity).slice(0, 10));
  }

  // GET /api/reports/reorder
  if (sub === 'reorder') {
    const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const list = userProducts.map(p => {
      const sold = store.sales.filter(s => s.ownerId === userId && s.productId === p.id && (s.saleDate || '').slice(0, 10) >= cutoff30).reduce((a, s) => a + s.quantity, 0);
      const avg = sold > 0 ? Math.round(sold / 30 * 10) / 10 : 0;
      const daysLeft = avg > 0 ? Math.round(p.currentStock / avg) : (p.currentStock > 0 ? 999 : 0);
      return {
        productId: p.id, name: p.name, category: p.category, unit: p.unit, currentStock: p.currentStock,
        soldLast30Days: sold, avgDailySales: avg, daysOfStockLeft: Math.min(daysLeft, 999),
        suggestedOrderQty: Math.max(0, (p.lowStockThreshold || 5) * 3 - p.currentStock),
        advice: p.currentStock <= 0 ? 'Out of stock — order now' : p.currentStock <= (p.lowStockThreshold || 5) ? 'Order soon' : 'Stock adequate'
      };
    });
    return sendJson(res, 200, list);
  }

  // GET /api/reports/stock
  if (sub === 'stock') {
    return sendJson(res, 200, userProducts.map(p => enrichProduct(p, store.batches)));
  }

  // GET /api/reports/waste
  if (sub === 'waste') {
    const today = new Date().toISOString().slice(0, 10);
    const disposed = store.batches.filter(b => b.status === 'DISPOSED' && userProducts.some(p => p.id === b.productId));
    const disposedUnits = disposed.reduce((a, b) => a + (b.initialQuantity - b.quantity || 0), 0);
    const disposedValue = disposed.reduce((a, b) => { const p = userProducts.find(pr => pr.id === b.productId); return a + (b.initialQuantity - b.quantity || 0) * (p ? p.price : 0); }, 0);
    const expOnShelf = store.batches.filter(b => b.status === 'ACTIVE' && b.expiryDate && b.expiryDate < today && userProducts.some(p => p.id === b.productId));
    return sendJson(res, 200, {
      disposedUnits, disposedValue,
      expiredUnitsOnShelf: expOnShelf.reduce((a, b) => a + b.quantity, 0),
      expiredValueOnShelf: expOnShelf.reduce((a, b) => { const p = userProducts.find(pr => pr.id === b.productId); return a + b.quantity * (p ? p.price : 0); }, 0)
    });
  }

  return sendJson(res, 404, { message: `Report "${sub}" not found` });
};
