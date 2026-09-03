const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');

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

// 1. GET /api/nota/presets
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

// 2. GET /api/nota/history
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

// 3. POST /api/nota/save
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

// 4. GET /api/nota/export-excel-data — Filter & Generate File Excel
app.get('/api/nota/export-excel-data', async (req, res) => {
  try {
    const {
      filter_mode = 'all', // all, customer, item, price, date
      customer_name,
      item_name,
      min_price,
      max_price,
      start_date,
      end_date
    } = req.query;

    const whereClauses = [];
    const params = [];

    // Filter Pelanggan
    if (customer_name && customer_name.trim() !== '') {
      params.push(`%${customer_name.trim()}%`);
      whereClauses.push(`t.customer_name ILIKE $${params.length}`);
    }

    // Filter Nama Barang
    if (item_name && item_name.trim() !== '') {
      params.push(`%${item_name.trim()}%`);
      whereClauses.push(`ti.item_name ILIKE $${params.length}`);
    }

    // Filter Rentang Harga / Total
    if (min_price && !isNaN(min_price)) {
      params.push(parseFloat(min_price));
      whereClauses.push(`ti.price >= $${params.length}`);
    }
    if (max_price && !isNaN(max_price)) {
      params.push(parseFloat(max_price));
      whereClauses.push(`ti.price <= $${params.length}`);
    }

    // Filter Tanggal
    if (start_date) {
      params.push(start_date);
      whereClauses.push(`t.created_at::date >= $${params.length}`);
    }
    if (end_date) {
      params.push(end_date);
      whereClauses.push(`t.created_at::date <= $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const query = `
      SELECT 
        t.no_nota,
        TO_CHAR(t.created_at, 'DD-MM-YYYY HH24:MI') AS tanggal,
        t.customer_name,
        ti.item_name,
        ti.price::float,
        ti.qty,
        ti.subtotal::float,
        t.grand_total::float AS total_nota
      FROM transactions t
      JOIN transaction_items ti ON ti.transaction_id = t.id
      ${whereSql}
      ORDER BY t.created_at DESC, ti.id ASC;
    `;

    const result = await pool.query(query, params);
    const rows = result.rows;

    // Build Excel Workbook using ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Kembar Jaya Motor POS';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Laporan Penjualan Sparepart', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // Header Title Styling
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'KEMBAR JAYA MOTOR — LAPORAN HISTORI PENJUALAN SPAREPART';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; // Blue-800
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 35;

    // Subtitle Info
    worksheet.mergeCells('A2:H2');
    const subCell = worksheet.getCell('A2');
    const filterInfoText = `Filter: ${filter_mode.toUpperCase()} | Dicetak pada: ${new Date().toLocaleString('id-ID')} | Total Item: ${rows.length} baris`;
    subCell.value = filterInfoText;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 22;

    worksheet.addRow([]); // Blank row

    // Table Headers
    const headers = [
      'No.',
      'No. Nota',
      'Tanggal & Waktu',
      'Nama Pembeli',
      'Nama Sparepart',
      'Harga Satuan (Rp)',
      'Qty',
      'Subtotal (Rp)'
    ];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    let totalOmzet = 0;
    let totalQtyAll = 0;

    rows.forEach((r, idx) => {
      totalOmzet += r.subtotal;
      totalQtyAll += r.qty;

      const row = worksheet.addRow([
        idx + 1,
        r.no_nota,
        r.tanggal,
        r.customer_name,
        r.item_name,
        r.price,
        r.qty,
        r.subtotal
      ]);
      row.height = 22;

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      
      row.getCell(6).numFmt = '#,##0';
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      
      row.getCell(8).numFmt = '#,##0';
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).font = { bold: true };

      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    // Summary Total Footer Row
    const footerRow = worksheet.addRow([
      '',
      '',
      '',
      '',
      'TOTAL KESELURUHAN:',
      '',
      totalQtyAll,
      totalOmzet
    ]);
    footerRow.height = 28;
    worksheet.mergeCells(`A${footerRow.number}:D${footerRow.number}`);
    
    footerRow.getCell(5).font = { bold: true, size: 11, color: { argb: 'FF1E40AF' } };
    footerRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    
    footerRow.getCell(7).font = { bold: true, size: 11 };
    footerRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    
    footerRow.getCell(8).numFmt = '#,##0';
    footerRow.getCell(8).font = { bold: true, size: 12, color: { argb: 'FF15803D' } }; // Green-700
    footerRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    footerRow.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

    // Column widths
    worksheet.getColumn(1).width = 6;   // No
    worksheet.getColumn(2).width = 18;  // No Nota
    worksheet.getColumn(3).width = 20;  // Tanggal
    worksheet.getColumn(4).width = 20;  // Pelanggan
    worksheet.getColumn(5).width = 32;  // Nama Barang
    worksheet.getColumn(6).width = 18;  // Harga
    worksheet.getColumn(7).width = 10;  // Qty
    worksheet.getColumn(8).width = 20;  // Subtotal

    const filename = `Laporan_Sparepart_KembarJaya_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error export excel:', err);
    res.status(500).send('Gagal membuat file excel: ' + err.message);
  }
});

// 5. GET /api/nota/filter-options — Ambil daftar nama pembeli dan sparepart unik untuk dropdown filter
app.get('/api/nota/filter-options', async (req, res) => {
  try {
    const customers = await pool.query(`SELECT DISTINCT customer_name FROM transactions ORDER BY customer_name ASC;`);
    const items = await pool.query(`SELECT DISTINCT item_name FROM transaction_items ORDER BY item_name ASC;`);

    res.json({
      success: true,
      customers: customers.rows.map(r => r.customer_name),
      items: items.rows.map(r => r.item_name)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. DELETE /api/nota/history/:id
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
