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
  const year = parseInt(urlObj.searchParams.get('year') || new Date().getFullYear());

  const userSales = store.sales.filter(s => s.ownerId === userId);
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const monthSales = userSales.filter(s => {
      const d = new Date(s.saleDate || s.createdAt);
      return d.getFullYear() === year && d.getMonth() + 1 === m;
    });
    months.push({
      year,
      month: m,
      revenue: monthSales.reduce((a, s) => a + s.totalPrice, 0),
      items: monthSales.reduce((a, s) => a + s.quantity, 0)
    });
  }
  return sendJson(res, 200, months);
};
