const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'stockguard-secret-key-please-use-a-long-random-string';
const TMP_FILE = path.join(process.env.TMPDIR || process.env.TEMP || '/tmp', 'stockguard_store.json');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, originalHash] = stored.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// Embed the FULL user profile in the JWT so /api/auth/me works
// across stateless Vercel serverless function invocations
// (each lambda has isolated memory — only the signed token is shared).
function createToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    ownerName: user.ownerName || '',
    shopName: user.shopName || '',
    phoneNumber: user.phoneNumber || null,
    expiryAlertDays: user.expiryAlertDays || 7,
    alertsEnabled: user.alertsEnabled !== false,
    exp: Math.floor(Date.now() / 1000) + 86400 * 7
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function verifyToken(req) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  if (s !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
    });
  });
}

function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function initSeedData() {
  const defaultUser = {
    id: 1,
    ownerName: 'Demo Owner',
    shopName: 'Sai Kirana Stores',
    email: 'demo@stockguard.com',
    phoneNumber: '919876543210',
    password: hashPassword('demo123'),
    expiryAlertDays: 7,
    alertsEnabled: true,
    createdAt: new Date().toISOString()
  };

  const seedProducts = [
    { id: 1, name: 'Amul Milk 500ml', category: 'Dairy', price: 28, unit: 'pcs', lowStockThreshold: 10, currentStock: 24, ownerId: 1, active: true },
    { id: 2, name: 'Fresh Curd 400g', category: 'Dairy', price: 35, unit: 'pcs', lowStockThreshold: 5, currentStock: 8, ownerId: 1, active: true },
    { id: 3, name: 'Paneer 200g', category: 'Dairy', price: 90, unit: 'pcs', lowStockThreshold: 4, currentStock: 3, ownerId: 1, active: true },
    { id: 4, name: 'Brown Bread', category: 'Bakery', price: 45, unit: 'pcs', lowStockThreshold: 5, currentStock: 12, ownerId: 1, active: true },
    { id: 5, name: 'Parle-G Biscuits', category: 'Snacks', price: 10, unit: 'pcs', lowStockThreshold: 20, currentStock: 120, ownerId: 1, active: true },
    { id: 6, name: 'Lays Chips 52g', category: 'Snacks', price: 20, unit: 'pcs', lowStockThreshold: 10, currentStock: 15, ownerId: 1, active: true },
    { id: 7, name: 'Basmati Rice 5kg', category: 'Grocery', price: 520, unit: 'bag', lowStockThreshold: 3, currentStock: 14, ownerId: 1, active: true },
    { id: 8, name: 'Sugar 1kg', category: 'Grocery', price: 48, unit: 'kg', lowStockThreshold: 5, currentStock: 4, ownerId: 1, active: true },
    { id: 9, name: 'Sunflower Oil 1L', category: 'Grocery', price: 155, unit: 'bottle', lowStockThreshold: 4, currentStock: 18, ownerId: 1, active: true },
    { id: 10, name: 'Toor Dal 1kg', category: 'Grocery', price: 160, unit: 'kg', lowStockThreshold: 4, currentStock: 0, ownerId: 1, active: true },
    { id: 11, name: 'Colgate Toothpaste', category: 'Personal Care', price: 95, unit: 'pcs', lowStockThreshold: 3, currentStock: 22, ownerId: 1, active: true },
    { id: 12, name: 'Coca-Cola 750ml', category: 'Beverages', price: 40, unit: 'bottle', lowStockThreshold: 6, currentStock: 30, ownerId: 1, active: true },
  ];

  const now = new Date();
  const isoDate = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };

  const seedBatches = [
    { id: 1, productId: 1, batchNumber: 'B1001', quantity: 24, initialQuantity: 144, expiryDate: addDays(2), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 2, productId: 2, batchNumber: 'B1002', quantity: 8, initialQuantity: 48, expiryDate: addDays(-1), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 3, productId: 3, batchNumber: 'B1003', quantity: 3, initialQuantity: 23, expiryDate: addDays(5), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 4, productId: 4, batchNumber: 'B1004', quantity: 12, initialQuantity: 72, expiryDate: addDays(3), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 5, productId: 5, batchNumber: 'B1005', quantity: 120, initialQuantity: 280, expiryDate: addDays(120), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 6, productId: 6, batchNumber: 'B1006', quantity: 15, initialQuantity: 95, expiryDate: addDays(6), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 7, productId: 7, batchNumber: 'B1007', quantity: 14, initialQuantity: 34, expiryDate: addDays(300), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 8, productId: 8, batchNumber: 'B1008', quantity: 4, initialQuantity: 44, expiryDate: null, purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 9, productId: 9, batchNumber: 'B1009', quantity: 18, initialQuantity: 38, expiryDate: addDays(200), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 10, productId: 10, batchNumber: 'B1010', quantity: 0, initialQuantity: 20, expiryDate: addDays(150), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 11, productId: 11, batchNumber: 'B1011', quantity: 22, initialQuantity: 42, expiryDate: addDays(400), purchaseDate: addDays(-20), status: 'ACTIVE' },
    { id: 12, productId: 12, batchNumber: 'B1012', quantity: 30, initialQuantity: 90, expiryDate: addDays(45), purchaseDate: addDays(-20), status: 'ACTIVE' },
  ];

  const seedSales = [];
  for (let i = 0; i < 7; i++) {
    const saleDate = addDays(-i);
    seedSales.push({
      id: i + 1,
      ownerId: 1,
      billNumber: `DEMO-${100 + i}`,
      productId: (i % 12) + 1,
      productName: seedProducts[i % 12].name,
      quantity: 3 + (i % 4),
      unitPrice: seedProducts[i % 12].price,
      totalPrice: (3 + (i % 4)) * seedProducts[i % 12].price,
      saleDate: `${saleDate}T14:30:00`,
      createdAt: `${saleDate}T14:30:00`
    });
  }

  return {
    users: [defaultUser],
    products: seedProducts,
    batches: seedBatches,
    sales: seedSales,
    alerts: [],
    nextId: { user: 2, product: 13, batch: 13, sale: 8, alert: 1 }
  };
}

let inMemoryStore = null;

function getStore() {
  if (inMemoryStore) return inMemoryStore;
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf8');
      inMemoryStore = JSON.parse(raw);
      return inMemoryStore;
    }
  } catch (e) {
    // fallback to memory
  }
  inMemoryStore = initSeedData();
  saveStore(inMemoryStore);
  return inMemoryStore;
}

function saveStore(store) {
  inMemoryStore = store;
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(store));
  } catch (e) {
    // non-fatal in read-only environments
  }
}

function toUserDto(user) {
  return {
    id: user.id,
    ownerName: user.ownerName,
    shopName: user.shopName,
    email: user.email,
    phoneNumber: user.phoneNumber || null,
    expiryAlertDays: user.expiryAlertDays || 7,
    alertsEnabled: user.alertsEnabled !== false
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  parseBody,
  sendJson,
  getStore,
  saveStore,
  toUserDto
};
