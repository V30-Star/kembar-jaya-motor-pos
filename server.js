const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = 5002;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'transporter',
  host: '127.0.0.1',
  database: 'notapos_db',
  password: 'Transporter1.',
  port: 5432,
});

// 1. GET /api/nota/presets — Ambil daftar sparepart paling sering dijual dari histori transaksi
app.get('/api/nota/presets', async (req, res) => {
  try {
    const query = `
      SELECT 
        item_name,
        ROUND(AVG(price)) AS avg_price,
        SUM(qty) AS total_sold_qty,
        COUNT(*) as transaction_count
      FROM transaction_items
      GROUP BY item_name
      ORDER BY total_sold_qty DESC, transaction_count DESC
      LIMIT 10;
    `;
    const result = await pool.query(query);
    
    // Fallback jika database masih baru
    let presets = result.rows.map(r => ({
      name: r.item_name,
      price: parseFloat(r.avg_price),
      sold: parseInt(r.total_sold_qty)
    }));

    if (presets.length === 0) {
      presets = [
        { name: 'Oli Mesin MPX2 Matic', price: 55000, sold: 10 },
        { name: 'Oli Mesin Yamalube Matic', price: 58000, sold: 8 },
        { name: 'Oli Gardan Matic', price: 17000, sold: 7 },
        { name: 'Kampas Rem Depan', price: 35000, sold: 6 },
        { name: 'Busi NGK Standard', price: 25000, sold: 5 },
        { name: 'Filter Udara Matic', price: 65000, sold: 4 }
      ];
    }

    res.json({ success: true, data: presets });
  } catch (err) {
    console.error('Error fetch presets:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/nota/history — Ambil riwayat histori transaksi nota
app.get('/api/nota/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const transQuery = `
      SELECT 
        id, 
        no_nota, 
        customer_name, 
        total_qty, 
        grand_total::float, 
        TO_CHAR(created_at, 'DD-MM-YYYY HH24:MI') AS tanggal
      FROM transactions
      ORDER BY created_at DESC
      LIMIT $1;
    `;
    const transRes = await pool.query(transQuery, [parseInt(limit)]);

    const transactions = await Promise.all(transRes.rows.map(async (t) => {
      const itemsRes = await pool.query(
        'SELECT item_name, price::float, qty, subtotal::float FROM transaction_items WHERE transaction_id = $1 ORDER BY id ASC',
        [t.id]
      );
      return {
        ...t,
        items: itemsRes.rows
      };
    }));

    // Quick Stats
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(grand_total), 0)::float AS total_omzet,
        COALESCE(SUM(total_qty), 0)::int AS total_items_sold
      FROM transactions;
    `);

    res.json({
      success: true,
      data: transactions,
      stats: statsQuery.rows[0]
    });
  } catch (err) {
    console.error('Error fetch history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/nota/save — Simpan transaksi nota baru ke PostgreSQL
app.post('/api/nota/save', async (req, res) => {
  const client = await pool.connect();
  try {
    const { customer_name = 'Pelanggan', items = [], grand_total = 0, total_qty = 0 } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Daftar item belanjaan kosong' });
    }

    await client.query('BEGIN');

    const noNota = 'KM-' + Date.now().toString().slice(-6);

    const transInsert = `
      INSERT INTO transactions (no_nota, customer_name, total_qty, grand_total, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING id, no_nota, created_at;
    `;
    const transRes = await client.query(transInsert, [
      noNota,
      customer_name || 'Pelanggan',
      parseInt(total_qty) || items.reduce((a, b) => a + (parseInt(b.qty) || 1), 0),
      parseFloat(grand_total)
    ]);

    const transId = transRes.rows[0].id;

    for (const item of items) {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.qty) || 1;
      const subtotal = price * qty;

      await client.query(`
        INSERT INTO transaction_items (transaction_id, item_name, price, qty, subtotal)
        VALUES ($1, $2, $3, $4, $5);
      `, [transId, item.name, price, qty, subtotal]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Transaksi nota berhasil disimpan ke database!',
      no_nota: noNota,
      transaction_id: transId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error save transaction:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 4. DELETE /api/nota/history/:id — Hapus histori nota
app.delete('/api/nota/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    res.json({ success: true, message: 'Nota berhasil dihapus dari histori' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Nota POS API running on port ${port}`);
});
