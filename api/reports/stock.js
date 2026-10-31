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
  const today = new Date().toISOString().slice(0, 10);

  const user = store.users.find(u => u.id === userId);
  const alertDays = user ? (user.expiryAlertDays || 7) : 7;
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + alertDays);
  const limitStr = limitDate.toISOString().slice(0, 10);

  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);

  const enriched = userProducts.map(p => {
    const activeBatches = store.batches.filter(b => b.productId === p.id && b.status === 'ACTIVE');
    const sellableStock = activeBatches
      .filter(b => !b.expiryDate || b.expiryDate >= today)
      .reduce((a, b) => a + b.quantity, 0);
    const expiredStock = activeBatches
      .filter(b => b.expiryDate && b.expiryDate < today)
      .reduce((a, b) => a + b.quantity, 0);

    // Nearest expiry from active non-expired batches
    const nearestExpiry = activeBatches
      .filter(b => b.expiryDate && b.expiryDate >= today)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0]?.expiryDate || null;

    const stockValue = sellableStock * p.price;
    let stockStatus = 'IN_STOCK';
    if (sellableStock <= 0) stockStatus = 'OUT_OF_STOCK';
    else if (sellableStock <= (p.lowStockThreshold || 5)) stockStatus = 'LOW_STOCK';

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      price: p.price,
      lowStockThreshold: p.lowStockThreshold,
      currentStock: p.currentStock,
      sellableStock,
      expiredStock,
      nearestExpiry,
      stockValue,
      stockStatus
    };
  });

  return sendJson(res, 200, enriched);
};
