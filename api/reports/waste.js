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
  const userProducts = store.products.filter(p => p.ownerId === userId && p.active !== false);

  // Count disposed batches for waste report
  const disposedBatches = store.batches.filter(b => {
    return b.status === 'DISPOSED' && userProducts.some(p => p.id === b.productId);
  });

  const disposedUnits = disposedBatches.reduce((a, b) => a + (b.initialQuantity - b.quantity || 0), 0);
  const disposedValue = disposedBatches.reduce((a, b) => {
    const p = userProducts.find(pr => pr.id === b.productId);
    return a + (b.initialQuantity - b.quantity || 0) * (p ? p.price : 0);
  }, 0);

  // Expired still on shelf (ACTIVE batches past expiry date)
  const today = new Date().toISOString().slice(0, 10);
  const expiredOnShelf = store.batches.filter(b => {
    return b.status === 'ACTIVE' && b.expiryDate && b.expiryDate < today &&
           userProducts.some(p => p.id === b.productId);
  });
  const expiredUnitsOnShelf = expiredOnShelf.reduce((a, b) => a + b.quantity, 0);
  const expiredValueOnShelf = expiredOnShelf.reduce((a, b) => {
    const p = userProducts.find(pr => pr.id === b.productId);
    return a + b.quantity * (p ? p.price : 0);
  }, 0);

  return sendJson(res, 200, {
    disposedUnits,
    disposedValue,
    expiredUnitsOnShelf,
    expiredValueOnShelf
  });
};
