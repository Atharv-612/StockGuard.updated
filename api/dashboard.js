const { getStore, verifyToken, sendJson } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = getStore();
  const user = store.users.find(u => u.id === payload.id) || store.users[0];
  const userProducts = store.products.filter(p => p.ownerId === user.id && p.active !== false);
  const userBatches = store.batches.filter(b => userProducts.some(p => p.id === b.productId) && b.status === 'ACTIVE');

  const today = new Date().toISOString().slice(0, 10);
  const alertDays = user.expiryAlertDays || 7;
  const alertLimitDate = new Date();
  alertLimitDate.setDate(alertLimitDate.getDate() + alertDays);
  const alertLimitStr = alertLimitDate.toISOString().slice(0, 10);

  const expiredBatches = userBatches.filter(b => b.expiryDate && b.expiryDate < today);
  const expiringSoonBatches = userBatches.filter(b => b.expiryDate && b.expiryDate >= today && b.expiryDate <= alertLimitStr);

  const lowStockProducts = userProducts.filter(p => p.currentStock > 0 && p.currentStock <= (p.lowStockThreshold || 5));
  const outOfStockProducts = userProducts.filter(p => p.currentStock <= 0);

  let totalUnits = 0;
  let stockValue = 0;
  userProducts.forEach(p => {
    totalUnits += p.currentStock;
    stockValue += p.currentStock * p.price;
  });

  const userSales = store.sales.filter(s => s.ownerId === user.id);
  const todaySales = userSales.filter(s => (s.saleDate || '').startsWith(today));
  let todayRevenue = 0;
  let todayItems = 0;
  todaySales.forEach(s => {
    todayRevenue += s.totalPrice;
    todayItems += s.quantity;
  });

  let monthRevenue = 0;
  const currentMonth = today.slice(0, 7);
  userSales.filter(s => (s.saleDate || '').startsWith(currentMonth)).forEach(s => {
    monthRevenue += s.totalPrice;
  });

  // Top products this week
  const topMap = {};
  userSales.forEach(s => {
    topMap[s.productName] = (topMap[s.productName] || 0) + s.quantity;
  });
  const topProductsThisWeek = Object.entries(topMap)
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const daySales = userSales.filter(s => (s.saleDate || '').startsWith(dateStr));
    const revenue = daySales.reduce((acc, s) => acc + s.totalPrice, 0);
    const items = daySales.reduce((acc, s) => acc + s.quantity, 0);
    last7Days.push({ date: dateStr, revenue, items, bills: daySales.length });
  }

  const alertSummary = {
    expiryAlertDays: alertDays,
    expiringSoon: expiringSoonBatches.map(b => {
      const p = userProducts.find(prod => prod.id === b.productId);
      return { ...b, productName: p ? p.name : 'Unknown' };
    }),
    expired: expiredBatches.map(b => {
      const p = userProducts.find(prod => prod.id === b.productId);
      return { ...b, productName: p ? p.name : 'Unknown' };
    }),
    lowStock: lowStockProducts,
    outOfStock: outOfStockProducts
  };

  return sendJson(res, 200, {
    shopName: user.shopName,
    totalProducts: userProducts.length,
    totalUnits,
    stockValue,
    todayRevenue,
    todayItems,
    monthRevenue,
    expiringSoonCount: expiringSoonBatches.length,
    expiredCount: expiredBatches.length,
    lowStockCount: lowStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
    last7Days,
    topProductsThisWeek,
    recentSales: userSales.slice(-5).reverse(),
    alerts: alertSummary
  });
};
