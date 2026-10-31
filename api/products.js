const { getStore, saveStore, verifyToken, parseBody, sendJson } = require('./_store');

function enrichProduct(p, batches) {
  const today = new Date().toISOString().slice(0, 10);
  const activeBatches = batches.filter(b => b.productId === p.id && b.status === 'ACTIVE');
  const sellableStock = activeBatches
    .filter(b => !b.expiryDate || b.expiryDate >= today)
    .reduce((a, b) => a + b.quantity, 0);
  const expiredStock = activeBatches
    .filter(b => b.expiryDate && b.expiryDate < today)
    .reduce((a, b) => a + b.quantity, 0);
  const nearestExpiry = activeBatches
    .filter(b => b.expiryDate && b.expiryDate >= today)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0]?.expiryDate || null;
  const stockValue = sellableStock * p.price;
  let stockStatus = 'IN_STOCK';
  if (sellableStock <= 0) stockStatus = 'OUT_OF_STOCK';
  else if (sellableStock <= (p.lowStockThreshold || 5)) stockStatus = 'LOW_STOCK';

  return { ...p, sellableStock, expiredStock, nearestExpiry, stockValue, stockStatus };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;

  // Extract product ID if present (via rewrite /api/products?id=... or URL path)
  const urlPath = (req.url || '').split('?')[0];
  const prodId = Number(req.query?.id || (urlPath.match(/\/api\/products\/(\d+)/) || [])[1]);

  if (req.method === 'GET') {
    const list = store.products
      .filter(p => p.ownerId === userId && p.active !== false)
      .map(p => enrichProduct(p, store.batches));
    return sendJson(res, 200, list);
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.name || !body.name.trim()) return sendJson(res, 400, { message: 'Product name is required' });
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
    return sendJson(res, 201, enrichProduct(newProd, store.batches));
  }

  if (req.method === 'PUT' && prodId) {
    const body = await parseBody(req);
    const prod = store.products.find(p => p.id === prodId && p.ownerId === userId);
    if (!prod) return sendJson(res, 404, { message: 'Product not found' });
    if (body.name) prod.name = body.name.trim();
    if (body.category) prod.category = body.category;
    if (body.price !== undefined) prod.price = Number(body.price) || 0;
    if (body.unit) prod.unit = body.unit;
    if (body.lowStockThreshold !== undefined) prod.lowStockThreshold = Number(body.lowStockThreshold) || 5;
    await saveStore(store);
    return sendJson(res, 200, enrichProduct(prod, store.batches));
  }

  if (req.method === 'DELETE' && prodId) {
    const prod = store.products.find(p => p.id === prodId && p.ownerId === userId);
    if (!prod) return sendJson(res, 404, { message: 'Product not found' });
    prod.active = false;
    await saveStore(store);
    return sendJson(res, 200, { success: true });
  }

  return sendJson(res, 405, { message: 'Method not allowed' });
};
