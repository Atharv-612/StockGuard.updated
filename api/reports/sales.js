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

  // Parse date filters from query string
  const urlObj = new URL('http://x' + (req.url || ''));
  const from = urlObj.searchParams.get('from') || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const to = urlObj.searchParams.get('to') || new Date().toISOString().slice(0, 10);

  const userSales = store.sales.filter(s => {
    if (s.ownerId !== userId) return false;
    const d = (s.saleDate || '').slice(0, 10);
    return d >= from && d <= to;
  });

  const totalRevenue = userSales.reduce((a, s) => a + s.totalPrice, 0);
  const totalItems = userSales.reduce((a, s) => a + s.quantity, 0);

  // Build daily breakdown
  const dailyMap = {};
  userSales.forEach(s => {
    const d = (s.saleDate || '').slice(0, 10);
    if (!dailyMap[d]) dailyMap[d] = { date: d, revenue: 0, items: 0, bills: new Set() };
    dailyMap[d].revenue += s.totalPrice;
    dailyMap[d].items += s.quantity;
    dailyMap[d].bills.add(s.billNumber);
  });
  // Fill every day in range
  const daily = [];
  let cur = new Date(from);
  const end = new Date(to);
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10);
    const entry = dailyMap[d] || { date: d, revenue: 0, items: 0, bills: new Set() };
    daily.push({ date: d, revenue: entry.revenue, items: entry.items, bills: entry.bills instanceof Set ? entry.bills.size : entry.bills });
    cur.setDate(cur.getDate() + 1);
  }

  const billSet = new Set(userSales.map(s => s.billNumber));

  return sendJson(res, 200, {
    from,
    to,
    totalRevenue,
    totalItems,
    totalBills: billSet.size,
    daily,
    sales: userSales
  });
};
