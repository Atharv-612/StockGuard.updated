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

  if (req.method === 'GET') {
    const list = store.products.filter(p => p.ownerId === userId && p.active !== false);
    return sendJson(res, 200, list);
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const newProd = {
      id: store.nextId.product++,
      ownerId: userId,
      name: body.name || 'Unnamed Product',
      category: body.category || 'General',
      price: Number(body.price) || 0,
      unit: body.unit || 'pcs',
      sku: body.sku || null,
      lowStockThreshold: Number(body.lowStockThreshold) || 5,
      currentStock: 0,
      active: true,
      createdAt: new Date().toISOString()
    };
    store.products.push(newProd);
    saveStore(store);
    return sendJson(res, 201, newProd);
  }

  return sendJson(res, 405, { message: 'Method not allowed' });
};
