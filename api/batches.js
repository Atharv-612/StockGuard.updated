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

  if (req.method === 'GET') {
    const urlObj = new URL('http://x' + (req.url || ''));
    const filter = urlObj.searchParams.get('filter') || 'ALL';
    const today = new Date().toISOString().slice(0, 10);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + alertDays);
    const limitStr = limitDate.toISOString().slice(0, 10);

    // Map filter names from frontend to logic
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

    // Enrich with expiry info
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

    // Apply expiry status filter
    let filtered = enriched;
    if (statusFilter === 'EXPIRED') filtered = enriched.filter(b => b.expiryStatus === 'EXPIRED');
    else if (statusFilter === 'EXPIRING_SOON') filtered = enriched.filter(b => b.expiryStatus === 'EXPIRING_SOON');
    else if (statusFilter === 'FRESH') filtered = enriched.filter(b => b.expiryStatus === 'OK' || b.expiryStatus === 'NO_EXPIRY');

    return sendJson(res, 200, filtered);
  }

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
