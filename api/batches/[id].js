const { getStore, saveStore, verifyToken, parseBody, sendJson } = require('../_store');

// Handles: PUT /api/batches/:id  and  DELETE /api/batches/:id
// Also handles POST /api/batches/:id/dispose  (Vercel will route dispose here)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;
  const userProducts = store.products.filter(p => p.ownerId === userId);

  // Extract batch ID from URL
  const urlPath = (req.url || '').split('?')[0];
  const disposeMatch = urlPath.match(/\/api\/batches\/(\d+)\/dispose/);
  const idMatch = urlPath.match(/\/api\/batches\/(\d+)/);
  const batchId = Number((disposeMatch || idMatch || [])[1]);

  if (!batchId) return sendJson(res, 400, { message: 'Batch ID required' });

  const batch = store.batches.find(b => b.id === batchId);
  if (!batch) return sendJson(res, 404, { message: 'Batch not found' });

  const productOwned = userProducts.some(p => p.id === batch.productId);
  if (!productOwned) return sendJson(res, 403, { message: 'Not authorized' });

  // POST .../dispose
  if (disposeMatch || (req.method === 'POST' && urlPath.includes('/dispose'))) {
    const product = store.products.find(p => p.id === batch.productId);
    if (product && batch.status === 'ACTIVE') {
      product.currentStock = Math.max(0, (product.currentStock || 0) - batch.quantity);
    }
    batch.status = 'DISPOSED';
    batch.quantity = 0;
    await saveStore(store);
    return sendJson(res, 200, { success: true });
  }

  // PUT — edit batch
  if (req.method === 'PUT') {
    const body = await parseBody(req);
    if (body.quantity !== undefined && body.quantity !== null) {
      const diff = Number(body.quantity) - batch.quantity;
      batch.quantity = Number(body.quantity);
      // Update product stock
      const product = store.products.find(p => p.id === batch.productId);
      if (product) product.currentStock = Math.max(0, (product.currentStock || 0) + diff);
    }
    if (body.batchNumber) batch.batchNumber = body.batchNumber;
    if (body.expiryDate !== undefined) batch.expiryDate = body.expiryDate || null;
    if (body.purchaseDate) batch.purchaseDate = body.purchaseDate;
    await saveStore(store);
    return sendJson(res, 200, batch);
  }

  // DELETE — remove batch
  if (req.method === 'DELETE') {
    const product = store.products.find(p => p.id === batch.productId);
    if (product && batch.status === 'ACTIVE') {
      product.currentStock = Math.max(0, (product.currentStock || 0) - batch.quantity);
    }
    store.batches = store.batches.filter(b => b.id !== batchId);
    await saveStore(store);
    return sendJson(res, 200, { success: true });
  }

  return sendJson(res, 405, { message: 'Method not allowed' });
};
