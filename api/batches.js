const { getStore, saveStore, verifyToken, parseBody, sendJson } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = getStore();
  const userId = payload.id;
  const userProducts = store.products.filter(p => p.ownerId === userId);
  const userProductIds = userProducts.map(p => p.id);

  if (req.method === 'GET') {
    const filter = (req.query && req.query.filter) || 'ALL';
    const today = new Date().toISOString().slice(0, 10);
    const user = store.users.find(u => u.id === userId);
    const alertDays = user ? user.expiryAlertDays : 7;
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + alertDays);
    const limitStr = limitDate.toISOString().slice(0, 10);

    let list = store.batches.filter(b => userProductIds.includes(b.productId) && b.status === 'ACTIVE');
    if (filter === 'EXPIRED') list = list.filter(b => b.expiryDate && b.expiryDate < today);
    else if (filter === 'EXPIRING_SOON') list = list.filter(b => b.expiryDate && b.expiryDate >= today && b.expiryDate <= limitStr);
    else if (filter === 'FRESH') list = list.filter(b => !b.expiryDate || b.expiryDate > limitStr);

    const enriched = list.map(b => {
      const p = userProducts.find(prod => prod.id === b.productId);
      return {
        ...b,
        productName: p ? p.name : 'Unknown',
        unit: p ? p.unit : 'pcs',
        price: p ? p.price : 0
      };
    });
    return sendJson(res, 200, enriched);
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const newBatch = {
      id: store.nextId.batch++,
      productId: Number(body.productId),
      batchNumber: body.batchNumber || `B${Date.now()}`,
      quantity: Number(body.quantity) || 0,
      initialQuantity: Number(body.quantity) || 0,
      expiryDate: body.expiryDate || null,
      purchaseDate: body.purchaseDate || new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    store.batches.push(newBatch);
    const p = store.products.find(prod => prod.id === newBatch.productId);
    if (p) p.currentStock = (p.currentStock || 0) + newBatch.quantity;
    saveStore(store);
    return sendJson(res, 201, newBatch);
  }

  return sendJson(res, 405, { message: 'Method not allowed' });
};
