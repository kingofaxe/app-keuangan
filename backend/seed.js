require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'db',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'catatan',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seed() {
  try {
    console.log('🔧 Menjalankan schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);

    // ─── USER 1: RENDI ────────────────────────
    console.log('👤 Membuat user: rendi');
    const hash1 = await bcrypt.hash('Enteraja29*', 10);
    const u1 = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, is_admin)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET password_hash=$2, display_name=$3, is_admin=$4
       RETURNING id`,
      ['rendi', hash1, 'Rendi', true]
    );
    const userId1 = u1.rows[0].id;

    // Wallet Rendi
    await pool.query('DELETE FROM wallets WHERE user_id=$1', [userId1]);
    const w1a = await pool.query(
      `INSERT INTO wallets (user_id, name, label, sort_order) VALUES ($1,'pribadi','👤 Pribadi',0) RETURNING id`,
      [userId1]
    );
    const w1b = await pool.query(
      `INSERT INTO wallets (user_id, name, label, sort_order) VALUES ($1,'hamster','🐹 Hamster',1) RETURNING id`,
      [userId1]
    );

    // Kategori Pribadi Rendi
    const cats1 = [
      { name: 'Gaji', type: 'income', subs: ['Gaji Pokok', 'Bonus'] },
      { name: 'Tabungan', type: 'income', subs: ['Tabungan In'] },
      { name: 'Makan', type: 'expense', subs: ['Makan Siang', 'Makan Malam', 'Sarapan'] },
      { name: 'Transport', type: 'expense', subs: ['Bensin', 'Parkir', 'Toll'] },
      { name: 'Tabungan Keluar', type: 'expense', subs: ['Tabungan Out'] },
      { name: 'Lainnya', type: 'expense', subs: ['Belanja', 'Hiburan'] },
    ];
    for (const cat of cats1) {
      const c = await pool.query(
        'INSERT INTO categories (wallet_id, name, type) VALUES ($1,$2,$3) RETURNING id',
        [w1a.rows[0].id, cat.name, cat.type]
      );
      for (const sub of cat.subs) {
        await pool.query('INSERT INTO sub_categories (category_id, name) VALUES ($1,$2)', [c.rows[0].id, sub]);
      }
    }

    // Kategori Hamster Rendi
    const cats2 = [
      { name: 'Pemasukan Hamster', type: 'income', subs: ['Hamster In', 'Penjualan'] },
      { name: 'Tabungan', type: 'income', subs: ['Tabungan In'] },
      { name: 'Operasional', type: 'expense', subs: ['Pakan', 'Kandang', 'Obat'] },
      { name: 'Tabungan Keluar', type: 'expense', subs: ['Tabungan Out'] },
    ];
    for (const cat of cats2) {
      const c = await pool.query(
        'INSERT INTO categories (wallet_id, name, type) VALUES ($1,$2,$3) RETURNING id',
        [w1b.rows[0].id, cat.name, cat.type]
      );
      for (const sub of cat.subs) {
        await pool.query('INSERT INTO sub_categories (category_id, name) VALUES ($1,$2)', [c.rows[0].id, sub]);
      }
    }

    // ─── USER 2: AYAH ─────────────────────────
    console.log('👤 Membuat user: ayah');
    const hash2 = await bcrypt.hash('passwordAyah123', 10);
    const u2 = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, is_admin)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET password_hash=$2, display_name=$3, is_admin=$4
       RETURNING id`,
      ['ayah', hash2, 'Ayah', false]
    );
    const userId2 = u2.rows[0].id;

    // Wallet Ayah
    await pool.query('DELETE FROM wallets WHERE user_id=$1', [userId2]);
    const w2a = await pool.query(
      `INSERT INTO wallets (user_id, name, label, sort_order) VALUES ($1,'bunda','👩 Bunda',0) RETURNING id`,
      [userId2]
    );
    const w2b = await pool.query(
      `INSERT INTO wallets (user_id, name, label, sort_order) VALUES ($1,'ayah','👨 Ayah',1) RETURNING id`,
      [userId2]
    );

    // Kategori Bunda
    const cats3 = [
      { name: 'Gaji', type: 'income', subs: ['Gaji Pokok'] },
      { name: 'Tabungan', type: 'income', subs: ['Tabungan In'] },
      { name: 'Rumah Tangga', type: 'expense', subs: ['Belanja Dapur', 'Listrik', 'Air'] },
      { name: 'Tabungan Keluar', type: 'expense', subs: ['Tabungan Out'] },
    ];
    for (const cat of cats3) {
      const c = await pool.query(
        'INSERT INTO categories (wallet_id, name, type) VALUES ($1,$2,$3) RETURNING id',
        [w2a.rows[0].id, cat.name, cat.type]
      );
      for (const sub of cat.subs) {
        await pool.query('INSERT INTO sub_categories (category_id, name) VALUES ($1,$2)', [c.rows[0].id, sub]);
      }
    }

    // Kategori Ayah
    const cats4 = [
      { name: 'Gaji', type: 'income', subs: ['Gaji Pokok', 'Lembur'] },
      { name: 'Tabungan', type: 'income', subs: ['Tabungan In'] },
      { name: 'Transport', type: 'expense', subs: ['Bensin', 'Parkir'] },
      { name: 'Tabungan Keluar', type: 'expense', subs: ['Tabungan Out'] },
    ];
    for (const cat of cats4) {
      const c = await pool.query(
        'INSERT INTO categories (wallet_id, name, type) VALUES ($1,$2,$3) RETURNING id',
        [w2b.rows[0].id, cat.name, cat.type]
      );
      for (const sub of cat.subs) {
        await pool.query('INSERT INTO sub_categories (category_id, name) VALUES ($1,$2)', [c.rows[0].id, sub]);
      }
    }

    console.log('✅ Seed selesai!');
    console.log('');
    console.log('User yang dibuat:');
    console.log('  username: rendi    | password: Enteraja29*');
    console.log('  username: ayah     | password: passwordAyah123');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

seed();
