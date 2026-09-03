# 🏍️ Kembar Jaya Motor - Kasir & Pembuat Nota Thermal 58mm

Aplikasi web kasir dan pembuat nota belanja ultra-sederhana, cepat, dan mobile-friendly yang dioptimalkan khusus untuk printer thermal Bluetooth 58mm (seperti OKAY 58D, MPT-II, RPP02N, dll).

---

## 🌟 Fitur Utama
1. **Alur Input Cepat (Touch-Friendly):**
   - Input nama pembeli (opsional/default "Pelanggan").
   - Baris item dinamis (bisa tambah/hapus item barang kapan saja).
   - Input harga otomatis terformat mata uang Rupiah (`Rp 10.000`).
   - Tombol shortcut preset cepat (Oli, Servis, Kampas Rem, Busi).
   - Perhitungan otomatis Subtotal per item & Grand Total belanjaan.

2. **Pencetakan Presisi Thermal 58mm (Dual Copy):**
   - Desain CSS `@media print` presisi 58mm (lebar printable 48mm, font monospace, tanpa header/footer bawaan browser).
   - **Cetak Ganda Otomatis (2 Salinan dalam 1x print):**
     * **Salinan 1**: `[UNTUK PEMBELI]`
     * Garis putus-putus tanda pemisah robekan (✂)
     * **Salinan 2**: `[ARSIP TOKO]`
   - Tanggal & waktu otomatis format lokal Indonesia (WIB/WITA/WIT).

3. **Konektivitas Fleksibel:**
   - **Direct Web Bluetooth API**: Kirim perintah ESC/POS langsung ke printer thermal tanpa popup dialog print.
   - **Universal Browser Fallback**: Bekerja mulus via `window.print()` di semua browser HP Android, iOS Safari, dan PC.

---

## 🚀 Live Demo & Akses Aplikasi
- **URL Live Server:** [http://160.19.166.53/nota](http://160.19.166.53/nota)

---

## 📂 Struktur Repositori
```text
├── index.html      # Single-page web kasir + CSS Tailwind + ESC/POS JS logic
└── README.md       # Dokumentasi & panduan penggunaan
```

---

## 🛠️ Cara Penggunaan di HP / Laptop:
1. Buka browser dan akses tautan: `http://160.19.166.53/nota`.
2. Isi nama pembeli dan tambahkan item barang/jasa beserta harga dan jumlah (Qty).
3. Klik tombol **"🖨️ Cetak Nota Thermal"**.
4. Pilih printer thermal 58mm Anda pada dialog print, lalu cetak.
5. (Opsional) Klik tombol **"BT Thermal"** di pojok kanan atas untuk menghubungkan langsung via Bluetooth Web API.

---

*Dikembangkan untuk operasional cepat bengkel & toko suku cadang motor.*
