# 🏍️ Kembar Jaya Motor - Kasir Khusus Sparepart & Nota Thermal 58mm

Aplikasi web kasir dan pembuat nota belanja suku cadang motor yang cepat, ringan, dengan tema visual cerah (*light theme*), dan terintegrasi penuh ke database PostgreSQL untuk riwayat transaksi.

---

## 🌟 Fitur Utama
1. **Khusus Toko Sparepart & Suku Cadang Motor**:
   - Menghapus referensi jasa/servis, fokus penuh pada penjualan suku cadang (Oli, Busi, Kampas Rem, Aki, Filter Udara, dll).
   - Tampilan visual cerah (*clean light theme*) yang kontras dan mudah dibaca di bawah pencahayaan bengkel/toko.

2. **Preset Cepat Sparepart (Dinamis dari Histori DB)**:
   - Tombol shortcut sparepart otomatis membaca daftar **sparepart yang paling sering dibeli/terlaris** dari database PostgreSQL (`notapos_db`).
   - Sekali klik langsung memasukkan nama barang dan harga rata-ratanya ke nota.

3. **Database Histori Transaksi (PostgreSQL)**:
   - Setiap kali tombol cetak ditekan, data transaksi (No Nota, Pelanggan, Tanggal, Rincian Barang, Grand Total) otomatis tersimpan ke tabel `transactions` & `transaction_items`.
   - Menu **📜 Histori** di bagian atas untuk melihat seluruh riwayat nota, total omzet, dan tombol **🖨️ Cetak Ulang**.

4. **Pencetakan Presisi Thermal 58mm (Dual Copy)**:
   - CSS `@media print` presisi (margin nol, lebar efektif 48-50mm, font monospace tajam).
   - Salinan 1: `[ UNTUK PEMBELI ]`
   - Garis Robekan: `✂ - - - - - - - - - - - - ✂`
   - Salinan 2: `[ ARSIP TOKO ]`

5. **Konektivitas Dual Mode**:
   - **Direct Web Bluetooth ESC/POS** (Printer OKAY 58D, RPP02N, dll).
   - **Universal Browser Print** (`window.print()`).

---

## 🚀 Live Demo & Akses Aplikasi
- **URL Live Server:** [http://160.19.166.53/nota](http://160.19.166.53/nota)

---

## 🛠️ Cara Penggunaan:
1. Buka [http://160.19.166.53/nota](http://160.19.166.53/nota).
2. Klik tombol preset sparepart terlaris atau ketik nama suku cadang secara manual.
3. Klik **"🖨️ Cetak Nota & Simpan Database"** untuk mencetak struk thermal dan menyimpan riwayat transaksi secara otomatis.
4. Klik **"📜 Histori"** di header untuk mengecek arsip nota sebelumnya.
