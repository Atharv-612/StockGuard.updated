const { getStore, saveStore, verifyToken, parseBody, sendJson } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;

  if (req.method === 'GET') {
    const list = store.products.filter(p => p.ownerId === userId && p.active !== false);
    return sendJson(res, 200, list);
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.name || !body.name.trim()) {
      return sendJson(res, 400, { message: 'Product name is required' });
    }
    const newProd = {
      id: store.nextId.product++,
      ownerId: userId,
      name: body.name.trim(),
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
    await saveStore(store);
    return sendJson(res, 201, newProd);
  }

  if (req.method === 'PUT') {
    const body = await parseBody(req);
    const urlPath = req.url ? req.url.split('?')[0] : '';
    const match = urlPath.match(/\/api\/products\/(\d+)/);
    if (match) {
      const prodId = Number(match[1]);
      const prod = store.products.find(p => p.id === prodId && p.ownerId === userId);
      if (!prod) return sendJson(res, 404, { message: 'Product not found' });
      if (body.name) prod.name = body.name.trim();
      if (body.category) prod.category = body.category;
      if (body.price !== undefined) prod.price = Number(body.price) || 0;
      if (body.unit) prod.unit = body.unit;
      if (body.lowStockThreshold !== undefined) prod.lowStockThreshold = Number(body.lowStockThreshold) || 5;
      await saveStore(store);
      return sendJson(res, 200, prod);
    }
    return sendJson(res, 400, { message: 'Product ID required' });
  }

  if (req.method === 'DELETE') {
    const urlPath = req.url ? req.url.split('?')[0] : '';
    const match = urlPath.match(/\/api\/products\/(\d+)/);
    if (match) {
      const prodId = Number(match[1]);
      const prod = store.products.find(p => p.id === prodId && p.ownerId === userId);
      if (!prod) return sendJson(res, 404, { message: 'Product not found' });
      prod.active = false;
      await saveStore(store);
      return sendJson(res, 200, { success: true });
    }
    return sendJson(res, 400, { message: 'Product ID required' });
  }

  return sendJson(res, 405, { message: 'Method not allowed' });
};
