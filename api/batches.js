const { getStore, saveStore, verifyToken, parseBody, sendJson } = require('./_store');

function getExpiryStatus(expiryDate, alertDays) {
  if (!expiryDate) return { status: 'NO_EXPIRY', daysToExpiry: null };
  const today = new Date().toISOString().slice(0, 10);
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + alertDays);
  const limitStr = limitDate.toISOString().slice(0, 10);
  if (expiryDate < today) return { status: 'EXPIRED', daysToExpiry: Math.floor((new Date(expiryDate) - new Date(today)) / 86400000) };
  if (expiryDate <= limitStr) return { status: 'EXPIRING_SOON', daysToExpiry: Math.floor((new Date(expiryDate) - new Date()) / 86400000) };
  return { status: 'OK', daysToExpiry: Math.floor((new Date(expiryDate) - new Date()) / 86400000) };
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
  const userProducts = store.products.filter(p => p.ownerId === userId);
  const userProductIds = userProducts.map(p => p.id);
  const user = store.users.find(u => u.id === userId);
  const alertDays = user ? (user.expiryAlertDays || 7) : (payload.expiryAlertDays || 7);

  // Extract batch ID and action if present (via rewrite /api/batches?id=...&action=... or URL path)
  const urlPath = (req.url || '').split('?')[0];
  const batchId = Number(req.query?.id || (urlPath.match(/\/api\/batches\/(\d+)/) || [])[1]);
  const isDispose = req.query?.action === 'dispose' || urlPath.includes('/dispose');

  // ---------- POST .../dispose ----------
  if (isDispose && batchId) {
    const batch = store.batches.find(b => b.id === batchId);
    if (!batch) return sendJson(res, 404, { message: 'Batch not found' });
    const product = store.products.find(p => p.id === batch.productId && p.ownerId === userId);
    if (!product) return sendJson(res, 403, { message: 'Not authorized' });

    if (batch.status === 'ACTIVE') {
      product.currentStock = Math.max(0, (product.currentStock || 0) - batch.quantity);
    }
    batch.status = 'DISPOSED';
    batch.quantity = 0;
    await saveStore(store);
    return sendJson(res, 200, { success: true });
  }

  // ---------- PUT /api/batches/:id ----------
  if (req.method === 'PUT' && batchId) {
    const batch = store.batches.find(b => b.id === batchId);
    if (!batch) return sendJson(res, 404, { message: 'Batch not found' });
    const product = store.products.find(p => p.id === batch.productId && p.ownerId === userId);
    if (!product) return sendJson(res, 403, { message: 'Not authorized' });

    const body = await parseBody(req);
    if (body.quantity !== undefined && body.quantity !== null) {
      const diff = Number(body.quantity) - batch.quantity;
      batch.quantity = Number(body.quantity);
      product.currentStock = Math.max(0, (product.currentStock || 0) + diff);
    }
    if (body.batchNumber) batch.batchNumber = body.batchNumber;
    if (body.expiryDate !== undefined) batch.expiryDate = body.expiryDate || null;
    if (body.purchaseDate) batch.purchaseDate = body.purchaseDate;
    await saveStore(store);
    return sendJson(res, 200, batch);
  }

  // ---------- DELETE /api/batches/:id ----------
  if (req.method === 'DELETE' && batchId) {
    const batch = store.batches.find(b => b.id === batchId);
    if (!batch) return sendJson(res, 404, { message: 'Batch not found' });
    const product = store.products.find(p => p.id === batch.productId && p.ownerId === userId);
    if (!product) return sendJson(res, 403, { message: 'Not authorized' });

    if (batch.status === 'ACTIVE') {
      product.currentStock = Math.max(0, (product.currentStock || 0) - batch.quantity);
    }
    store.batches = store.batches.filter(b => b.id !== batchId);
    await saveStore(store);
    return sendJson(res, 200, { success: true });
  }

  // ---------- GET /api/batches ----------
  if (req.method === 'GET') {
    const urlObj = new URL('http://x' + (req.url || ''));
    const filter = (req.query && req.query.filter) || urlObj.searchParams.get('filter') || 'ALL';

    let statusFilter = null;
    let disposedFilter = false;
    if (filter === 'EXPIRED' || filter === 'expired') statusFilter = 'EXPIRED';
    else if (filter === 'EXPIRING_SOON' || filter === 'expiring') statusFilter = 'EXPIRING_SOON';
    else if (filter === 'FRESH' || filter === 'instock') statusFilter = 'FRESH';
    else if (filter === 'disposed') disposedFilter = true;

    let list = store.batches.filter(b => userProductIds.includes(b.productId));
    if (disposedFilter) {
      list = list.filter(b => b.status === 'DISPOSED');
    } else {
      list = list.filter(b => b.status === 'ACTIVE');
    }

    const enriched = list.map(b => {
      const p = userProducts.find(prod => prod.id === b.productId);
      const { status: expiryStatus, daysToExpiry } = getExpiryStatus(b.expiryDate, alertDays);
      return {
        ...b,
        productName: p ? p.name : 'Unknown',
        category: p ? p.category : 'General',
        unit: p ? p.unit : 'pcs',
        price: p ? p.price : 0,
        value: b.quantity * (p ? p.price : 0),
        expiryStatus,
        daysToExpiry,
        sellableStock: b.quantity
      };
    });

    let filtered = enriched;
    if (statusFilter === 'EXPIRED') filtered = enriched.filter(b => b.expiryStatus === 'EXPIRED');
    else if (statusFilter === 'EXPIRING_SOON') filtered = enriched.filter(b => b.expiryStatus === 'EXPIRING_SOON');
    else if (statusFilter === 'FRESH') filtered = enriched.filter(b => b.expiryStatus === 'OK' || b.expiryStatus === 'NO_EXPIRY');

    return sendJson(res, 200, filtered);
  }

  // ---------- POST /api/batches ----------
  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body.productId) return sendJson(res, 400, { message: 'productId is required' });
    if (!Number(body.quantity) || Number(body.quantity) < 1) return sendJson(res, 400, { message: 'quantity must be a positive number' });

    const newBatch = {
      id: store.nextId.batch++,
      productId: Number(body.productId),
      batchNumber: body.batchNumber || `B${Date.now()}`,
      quantity: Number(body.quantity),
      initialQuantity: Number(body.quantity),
      expiryDate: body.expiryDate || null,
      purchaseDate: body.purchaseDate || new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    store.batches.push(newBatch);
    const p = store.products.find(prod => prod.id === newBatch.productId);
    if (p) p.currentStock = (p.currentStock || 0) + newBatch.quantity;

    await saveStore(store);
    return sendJson(res, 201, newBatch);
  }

  return sendJson(res, 405, { message: 'Method not allowed' });
};
