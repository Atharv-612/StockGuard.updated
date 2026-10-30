const { getStore, saveStore, verifyToken, parseBody, sendJson } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  const payload = verifyToken(req);
  if (!payload) return sendJson(res, 401, { message: 'Session expired' });

  const store = await getStore();
  const userId = payload.id;

  if (req.method === 'GET') {
    const list = store.sales.filter(s => s.ownerId === userId).reverse();
    return sendJson(res, 200, list);
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const items = body.items || [];
    if (!items.length) return sendJson(res, 400, { message: 'No items in sale' });

    const billNumber = `BILL-${Date.now().toString().slice(-6)}`;
    const createdSales = [];

    for (const item of items) {
      const p = store.products.find(prod => prod.id === Number(item.productId) && prod.ownerId === userId);
      if (!p) continue;
      const qty = Number(item.quantity) || 1;
      const sale = {
        id: store.nextId.sale++,
        ownerId: userId,
        billNumber,
        productId: p.id,
        productName: p.name,
        quantity: qty,
        unitPrice: p.price,
        totalPrice: qty * p.price,
        saleDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      p.currentStock = Math.max(0, (p.currentStock || 0) - qty);
      store.sales.push(sale);
      createdSales.push(sale);
    }

    await saveStore(store);
    return sendJson(res, 201, { billNumber, items: createdSales });
  }

  return sendJson(res, 405, { message: 'Method not allowed' });
};
