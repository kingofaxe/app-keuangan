require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { Pool } = require('pg');

const app  = express();
const pool = new Pool({
  host:     process.env.DB_HOST     || 'db',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'catatan',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const JWT_SECRET = process.env.JWT_SECRET || 'catatan-secret-ganti-ini';
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── MULTER ───────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random()*1e6) + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/jpg','application/pdf'];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format tidak didukung'));
  }
});

// ─── AUTH MIDDLEWARE ──────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}
function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

// ─── LOGIN ────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const r = await pool.query('SELECT * FROM users WHERE username=$1', [username.toLowerCase()]);
    const u = r.rows[0];
    if (!u || !await bcrypt.compare(password, u.password_hash))
      return res.status(401).json({ error: 'Username atau password salah' });
    const token = jwt.sign(
      { id: u.id, username: u.username, displayName: u.display_name, isAdmin: u.is_admin },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ token, displayName: u.display_name, isAdmin: u.is_admin });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── ADMIN: USERS ─────────────────────────────
app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.is_admin, u.created_at,
        (SELECT COUNT(*) FROM wallets WHERE user_id=u.id) AS wallet_count,
        (SELECT COUNT(*) FROM transactions t JOIN wallets w ON w.id=t.wallet_id WHERE w.user_id=u.id) AS tx_count
      FROM users u ORDER BY u.created_at
    `);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const { username, password, display_name, is_admin } = req.body;
    if (!username || !password || !display_name)
      return res.status(400).json({ error: 'Username, password, dan nama wajib diisi' });
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO users (username,password_hash,display_name,is_admin) VALUES ($1,$2,$3,$4) RETURNING id,username,display_name,is_admin',
      [username.toLowerCase(), hash, display_name, is_admin||false]
    );
    res.json(r.rows[0]);
  } catch(e) {
    if (e.code==='23505') return res.status(400).json({ error: 'Username sudah dipakai' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { password, display_name, is_admin } = req.body;
    const sets = []; const params = []; let i = 1;
    if (password)           { sets.push(`password_hash=$${i++}`); params.push(await bcrypt.hash(password,10)); }
    if (display_name)       { sets.push(`display_name=$${i++}`);  params.push(display_name); }
    if (is_admin !== undefined) { sets.push(`is_admin=$${i++}`);  params.push(is_admin); }
    if (!sets.length) return res.status(400).json({ error: 'Tidak ada yang diupdate' });
    params.push(req.params.id);
    const r = await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${i} RETURNING id,username,display_name,is_admin`, params);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  try {
    if (String(req.params.id)===String(req.user.id))
      return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users/:id/data', auth, adminOnly, async (req, res) => {
  try {
    const wallets = await pool.query('SELECT * FROM wallets WHERE user_id=$1 ORDER BY sort_order', [req.params.id]);
    const txs = await pool.query(`
      SELECT t.*, c.name AS category_name, c.type AS category_type,
             sc.name AS sub_category_name, w.label AS wallet_label
      FROM transactions t
      LEFT JOIN categories c ON c.id=t.category_id
      LEFT JOIN sub_categories sc ON sc.id=t.sub_category_id
      JOIN wallets w ON w.id=t.wallet_id
      WHERE w.user_id=$1 ORDER BY t.date DESC LIMIT 500
    `, [req.params.id]);
    const realBalance = await pool.query(
      'SELECT * FROM real_balance_items WHERE user_id=$1 ORDER BY sort_order, id',
      [req.params.id]
    );
    let prefsRow = await pool.query('SELECT * FROM user_preferences WHERE user_id=$1', [req.params.id]);
    const prefs = prefsRow.rows.length ? {
      tabInCats:  JSON.parse(prefsRow.rows[0].tab_in_cats),
      tabOutCats: JSON.parse(prefsRow.rows[0].tab_out_cats),
    } : { tabInCats: [], tabOutCats: [] };
    res.json({ wallets: wallets.rows, transactions: txs.rows, realBalance: realBalance.rows, prefs });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── WALLETS ──────────────────────────────────
app.get('/api/wallets', auth, async (req, res) => {
  try {
    res.json((await pool.query('SELECT * FROM wallets WHERE user_id=$1 ORDER BY sort_order', [req.user.id])).rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/wallets', auth, async (req, res) => {
  try {
    const { name, label, initial_balance } = req.body;
    if (!name||!label) return res.status(400).json({ error: 'Nama dan label wajib' });
    const cnt = await pool.query('SELECT COUNT(*) FROM wallets WHERE user_id=$1', [req.user.id]);
    const r = await pool.query(
      'INSERT INTO wallets (user_id,name,label,sort_order,initial_balance) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, name, label, parseInt(cnt.rows[0].count), initial_balance||0]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ─── WALLET REORDER ───────────────────────────
app.put('/api/wallets/reorder', auth, async (req, res) => {
  try {
    const { order } = req.body; // array of wallet ids in new order
    for (let i = 0; i < order.length; i++) {
      await pool.query('UPDATE wallets SET sort_order=$1 WHERE id=$2 AND user_id=$3', [i, order[i], req.user.id]);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/wallets/:id', auth, async (req, res) => {
  try {
    const { name, label, initial_balance } = req.body;
    const r = await pool.query(
      'UPDATE wallets SET name=$1,label=$2,initial_balance=$3 WHERE id=$4 AND user_id=$5 RETURNING *',
      [name, label, initial_balance||0, req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/wallets/:id', auth, async (req, res) => {
  try {
    const cnt = await pool.query('SELECT COUNT(*) FROM wallets WHERE user_id=$1', [req.user.id]);
    if (parseInt(cnt.rows[0].count) <= 1)
      return res.status(400).json({ error: 'Minimal harus ada 1 dompet' });
    await pool.query('DELETE FROM wallets WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── CATEGORIES ───────────────────────────────
app.get('/api/categories', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT c.*, COALESCE(json_agg(json_build_object('id',sc.id,'name',sc.name) ORDER BY sc.name) FILTER (WHERE sc.id IS NOT NULL),'[]') AS sub_categories
      FROM categories c LEFT JOIN sub_categories sc ON sc.category_id=c.id
      WHERE c.wallet_id=$1 GROUP BY c.id ORDER BY c.type,c.name
    `, [req.query.wallet_id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/categories', auth, async (req, res) => {
  try {
    const { wallet_id, name, type } = req.body;
    const w = await pool.query('SELECT id FROM wallets WHERE id=$1 AND user_id=$2', [wallet_id, req.user.id]);
    if (!w.rows.length) return res.status(403).json({ error: 'Forbidden' });
    const r = await pool.query('INSERT INTO categories (wallet_id,name,type) VALUES ($1,$2,$3) RETURNING *', [wallet_id,name,type]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/categories/:id', auth, async (req, res) => {
  try {
    const { name, type } = req.body;
    const r = await pool.query(
      'UPDATE categories SET name=$1,type=$2 WHERE id=$3 AND wallet_id IN (SELECT id FROM wallets WHERE user_id=$4) RETURNING *',
      [name,type,req.params.id,req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/categories/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id=$1 AND wallet_id IN (SELECT id FROM wallets WHERE user_id=$2)', [req.params.id,req.user.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SUB CATEGORIES ───────────────────────────
app.post('/api/sub-categories', auth, async (req, res) => {
  try {
    const { category_id, name } = req.body;
    const c = await pool.query('SELECT c.id FROM categories c JOIN wallets w ON w.id=c.wallet_id WHERE c.id=$1 AND w.user_id=$2', [category_id,req.user.id]);
    if (!c.rows.length) return res.status(403).json({ error: 'Forbidden' });
    const r = await pool.query('INSERT INTO sub_categories (category_id,name) VALUES ($1,$2) RETURNING *', [category_id,name]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sub-categories/:id', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const r = await pool.query(
      'UPDATE sub_categories SET name=$1 WHERE id=$2 AND category_id IN (SELECT c.id FROM categories c JOIN wallets w ON w.id=c.wallet_id WHERE w.user_id=$3) RETURNING *',
      [name,req.params.id,req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/sub-categories/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM sub_categories WHERE id=$1 AND category_id IN (SELECT c.id FROM categories c JOIN wallets w ON w.id=c.wallet_id WHERE w.user_id=$2)', [req.params.id,req.user.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── TRANSACTIONS ─────────────────────────────
const txSel = `SELECT t.*, c.name AS category_name, c.type AS category_type, sc.name AS sub_category_name
               FROM transactions t LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN sub_categories sc ON sc.id=t.sub_category_id`;

app.get('/api/transactions', auth, async (req, res) => {
  try {
    const { wallet_id, month, year } = req.query;
    let q = txSel + ' WHERE t.wallet_id=$1 AND t.wallet_id IN (SELECT id FROM wallets WHERE user_id=$2)';
    const p = [wallet_id, req.user.id];
    if (month&&year) { q+=` AND EXTRACT(MONTH FROM t.date)=$3 AND EXTRACT(YEAR FROM t.date)=$4`; p.push(month,year); }
    q += ' ORDER BY t.date DESC, t.id DESC';
    res.json((await pool.query(q,p)).rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transactions/all', auth, async (req, res) => {
  try {
    const { wallet_id, year } = req.query;
    let q = txSel + ` WHERE t.wallet_id IN (SELECT id FROM wallets WHERE user_id=$1 ${wallet_id?'AND id=$2':''})`;
    const p = [req.user.id];
    if (wallet_id) p.push(wallet_id);
    if (year) { p.push(year); q+=` AND EXTRACT(YEAR FROM t.date)=$${p.length}`; }
    q += ' ORDER BY t.date DESC, t.id DESC';
    res.json((await pool.query(q,p)).rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions', auth, async (req, res) => {
  try {
    const { wallet_id, category_id, sub_category_id, type, amount, date, remark } = req.body;
    const w = await pool.query('SELECT id FROM wallets WHERE id=$1 AND user_id=$2', [wallet_id,req.user.id]);
    if (!w.rows.length) return res.status(403).json({ error: 'Forbidden' });
    const r = await pool.query(
      'INSERT INTO transactions (wallet_id,category_id,sub_category_id,type,amount,date,remark) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [wallet_id,category_id,sub_category_id||null,type,amount,date,remark||'']
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/transactions/:id', auth, async (req, res) => {
  try {
    const { category_id, sub_category_id, type, amount, date, remark } = req.body;
    const r = await pool.query(
      `UPDATE transactions SET category_id=$1,sub_category_id=$2,type=$3,amount=$4,date=$5,remark=$6,updated_at=NOW()
       WHERE id=$7 AND wallet_id IN (SELECT id FROM wallets WHERE user_id=$8) RETURNING *`,
      [category_id,sub_category_id||null,type,amount,date,remark||'',req.params.id,req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transactions/:id', auth, async (req, res) => {
  try {
    const tx = await pool.query('SELECT file_path FROM transactions WHERE id=$1',[req.params.id]);
    if (tx.rows[0]?.file_path) {
      const fp = path.join(UPLOAD_DIR, path.basename(tx.rows[0].file_path));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await pool.query('DELETE FROM transactions WHERE id=$1 AND wallet_id IN (SELECT id FROM wallets WHERE user_id=$2)', [req.params.id,req.user.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── FILE UPLOAD ──────────────────────────────
app.post('/api/transactions/:id/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
    const old = await pool.query('SELECT file_path FROM transactions WHERE id=$1',[req.params.id]);
    if (old.rows[0]?.file_path) {
      const fp = path.join(UPLOAD_DIR, path.basename(old.rows[0].file_path));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    const filePath = `/uploads/${req.file.filename}`;
    const r = await pool.query(
      'UPDATE transactions SET file_path=$1,file_name=$2,updated_at=NOW() WHERE id=$3 AND wallet_id IN (SELECT id FROM wallets WHERE user_id=$4) RETURNING *',
      [filePath, req.file.originalname, req.params.id, req.user.id]
    );
    if (!r.rows.length) { fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Not found' }); }
    res.json({ file_path: filePath, file_name: req.file.originalname });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transactions/:id/upload', auth, async (req, res) => {
  try {
    const tx = await pool.query('SELECT file_path FROM transactions WHERE id=$1',[req.params.id]);
    if (tx.rows[0]?.file_path) {
      const fp = path.join(UPLOAD_DIR, path.basename(tx.rows[0].file_path));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await pool.query('UPDATE transactions SET file_path=NULL,file_name=NULL WHERE id=$1',[req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── SEARCH ───────────────────────────────────
app.get('/api/search', auth, async (req, res) => {
  try {
    const { q, wallet_id } = req.query;
    const s = `%${q}%`;
    const p = [req.user.id, s];
    let wf = wallet_id ? `AND t.wallet_id=$3` : '';
    if (wallet_id) p.push(wallet_id);
    const r = await pool.query(
      `${txSel} WHERE t.wallet_id IN (SELECT id FROM wallets WHERE user_id=$1) ${wf}
       AND (c.name ILIKE $2 OR sc.name ILIKE $2 OR t.remark ILIKE $2 OR CAST(t.amount AS TEXT) ILIKE $2)
       ORDER BY t.date DESC LIMIT 100`, p
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── TRANSACTION TEMPLATES ────────────────────
app.get('/api/templates', auth, async (req, res) => {
  try {
    const { wallet_id } = req.query;
    if (!wallet_id) return res.status(400).json({ error: 'wallet_id wajib diisi' });
    
    const w = await pool.query('SELECT id FROM wallets WHERE id=$1 AND user_id=$2', [wallet_id, req.user.id]);
    if (!w.rows.length) return res.status(403).json({ error: 'Forbidden' });

    const r = await pool.query(`
      SELECT t.*, c.name AS category_name, sc.name AS sub_category_name
      FROM transaction_templates t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN sub_categories sc ON sc.id = t.sub_category_id
      WHERE t.wallet_id = $1
      ORDER BY t.usage_count DESC, t.id DESC
    `, [wallet_id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/templates', auth, async (req, res) => {
  try {
    const { wallet_id, category_id, sub_category_id, name, icon, type, amount, remark } = req.body;
    if (!wallet_id || !category_id || !name || !type || !amount) {
      return res.status(400).json({ error: 'Field wajib diisi: wallet_id, category_id, name, type, amount' });
    }
    const w = await pool.query('SELECT id FROM wallets WHERE id=$1 AND user_id=$2', [wallet_id, req.user.id]);
    if (!w.rows.length) return res.status(403).json({ error: 'Forbidden' });

    const r = await pool.query(`
      INSERT INTO transaction_templates (wallet_id, category_id, sub_category_id, name, icon, type, amount, remark)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [wallet_id, category_id, sub_category_id || null, name, icon || '📋', type, amount, remark || '']);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/templates/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, category_id, sub_category_id, type, amount, remark } = req.body;
    
    const check = await pool.query(`
      SELECT t.id FROM transaction_templates t 
      JOIN wallets w ON w.id = t.wallet_id 
      WHERE t.id = $1 AND w.user_id = $2
    `, [id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Template tidak ditemukan' });

    const r = await pool.query(`
      UPDATE transaction_templates 
      SET name = $1, icon = $2, category_id = $3, sub_category_id = $4, type = $5, amount = $6, remark = $7
      WHERE id = $8
      RETURNING *
    `, [name, icon || '📋', category_id, sub_category_id || null, type, amount, remark || '', id]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/templates/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query(`
      SELECT t.id FROM transaction_templates t 
      JOIN wallets w ON w.id = t.wallet_id 
      WHERE t.id = $1 AND w.user_id = $2
    `, [id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Template tidak ditemukan' });

    await pool.query('DELETE FROM transaction_templates WHERE id = $1', [id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/templates/:id/use', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Tanggal wajib diisi' });

    const rTemp = await pool.query(`
      SELECT t.* FROM transaction_templates t 
      JOIN wallets w ON w.id = t.wallet_id 
      WHERE t.id = $1 AND w.user_id = $2
    `, [id, req.user.id]);
    if (!rTemp.rows.length) return res.status(404).json({ error: 'Template tidak ditemukan' });

    const t = rTemp.rows[0];

    const tx = await pool.query(`
      INSERT INTO transactions (wallet_id, category_id, sub_category_id, type, amount, date, remark)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [t.wallet_id, t.category_id, t.sub_category_id, t.type, t.amount, date, t.remark]);

    await pool.query(`
      UPDATE transaction_templates 
      SET usage_count = usage_count + 1, last_used_at = NOW() 
      WHERE id = $1
    `, [id]);

    res.json(tx.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Backend v2 running on port ${PORT}`);
  // Migration: update type constraint for real_balance_items to support tab_in/tab_out
  try {
    await pool.query(`
      ALTER TABLE real_balance_items DROP CONSTRAINT IF EXISTS real_balance_items_type_check;
    `);
    await pool.query(`
      ALTER TABLE real_balance_items ADD CONSTRAINT real_balance_items_type_check
        CHECK (type IN ('asset','debt','tab_in','tab_out'));
    `);
    console.log('Migration: real_balance type constraint updated');
  } catch(e) {
    console.log('Migration note:', e.message);
  }
  // Migration: add pin_hash column if not exists
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255) DEFAULT NULL;`);
    console.log('Migration: pin_hash column ready');
  } catch(e) {
    console.log('Migration note (pin_hash):', e.message);
  }
  // Migration: create transaction_templates table and index if not exists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transaction_templates (
        id              SERIAL PRIMARY KEY,
        wallet_id       INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
        category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        sub_category_id INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL,
        name            VARCHAR(100) NOT NULL,
        icon            VARCHAR(10) DEFAULT '📋',
        type            VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
        amount          NUMERIC(15,2) NOT NULL,
        remark          TEXT DEFAULT '',
        usage_count     INTEGER DEFAULT 0,
        last_used_at    TIMESTAMP DEFAULT NULL,
        sort_order      INTEGER DEFAULT 0,
        created_at      TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_templates_wallet ON transaction_templates(wallet_id);
    `);
    console.log('Migration: transaction_templates table and index ready');
  } catch(e) {
    console.log('Migration note (transaction_templates):', e.message);
  }
});

// ─── PIN LOGIN ────────────────────────────────
// Set atau hapus PIN (perlu token)
app.put('/api/user/pin', auth, async (req, res) => {
  try {
    const { pin } = req.body;
    if (pin === null || pin === '') {
      // Hapus PIN
      await pool.query('UPDATE users SET pin_hash=NULL WHERE id=$1', [req.user.id]);
      return res.json({ success: true, message: 'PIN dihapus' });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN harus 6 digit angka' });
    }
    const hash = await bcrypt.hash(pin, 10);
    await pool.query('UPDATE users SET pin_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true, message: 'PIN berhasil diatur' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Cek apakah user memiliki PIN (tanpa token, pakai username)
app.get('/api/user/has-pin', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Username wajib diisi' });
    const r = await pool.query('SELECT pin_hash FROM users WHERE username=$1', [username.toLowerCase()]);
    if (!r.rows.length) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json({ hasPin: r.rows[0].pin_hash !== null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Login dengan PIN
app.post('/api/login/pin', async (req, res) => {
  try {
    const { username, pin } = req.body;
    if (!username || !pin) return res.status(400).json({ error: 'Username dan PIN wajib diisi' });
    if (!/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'Format PIN tidak valid' });
    const r = await pool.query('SELECT * FROM users WHERE username=$1', [username.toLowerCase()]);
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: 'User tidak ditemukan' });
    if (!u.pin_hash) return res.status(401).json({ error: 'PIN belum diatur. Gunakan username & password.' });
    const match = await bcrypt.compare(pin, u.pin_hash);
    if (!match) return res.status(401).json({ error: 'PIN salah' });
    const token = jwt.sign(
      { id: u.id, username: u.username, displayName: u.display_name, isAdmin: u.is_admin },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ token, displayName: u.display_name, isAdmin: u.is_admin });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── PREFERENCES ──────────────────────────────
app.get('/api/preferences', auth, async (req, res) => {
  try {
    let r = await pool.query('SELECT * FROM user_preferences WHERE user_id=$1', [req.user.id]);
    if (!r.rows.length) {
      r = await pool.query(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *', [req.user.id]
      );
    }
    const p = r.rows[0];
    res.json({
      menuOrder:      JSON.parse(p.menu_order),
      hiddenSections: JSON.parse(p.hidden_sections),
      tabInCats:      JSON.parse(p.tab_in_cats),
      tabOutCats:     JSON.parse(p.tab_out_cats),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/preferences', auth, async (req, res) => {
  try {
    const { menuOrder, hiddenSections, tabInCats, tabOutCats } = req.body;
    await pool.query(
      `INSERT INTO user_preferences (user_id, menu_order, hidden_sections, tab_in_cats, tab_out_cats, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (user_id) DO UPDATE SET menu_order=$2, hidden_sections=$3, tab_in_cats=$4, tab_out_cats=$5, updated_at=NOW()`,
      [req.user.id, JSON.stringify(menuOrder), JSON.stringify(hiddenSections), JSON.stringify(tabInCats), JSON.stringify(tabOutCats)]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ─── REAL BALANCE ─────────────────────────────
app.get('/api/real-balance', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM real_balance_items WHERE user_id=$1 ORDER BY sort_order, id', [req.user.id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/real-balance', auth, async (req, res) => {
  try {
    const { label, amount, type } = req.body;
    const cnt = await pool.query('SELECT COUNT(*) FROM real_balance_items WHERE user_id=$1', [req.user.id]);
    const r = await pool.query(
      'INSERT INTO real_balance_items (user_id,label,amount,type,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, label, amount, type, parseInt(cnt.rows[0].count)]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});


app.put('/api/real-balance/reorder', auth, async (req, res) => {
  try {
    const { order } = req.body;
    for (let i = 0; i < order.length; i++) {
      await pool.query('UPDATE real_balance_items SET sort_order=$1 WHERE id=$2 AND user_id=$3', [i, order[i], req.user.id]);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/real-balance/:id', auth, async (req, res) => {
  try {
    const { label, amount, type } = req.body;
    const r = await pool.query(
      'UPDATE real_balance_items SET label=$1,amount=$2,type=$3 WHERE id=$4 AND user_id=$5 RETURNING *',
      [label, amount, type, req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/real-balance/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM real_balance_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

