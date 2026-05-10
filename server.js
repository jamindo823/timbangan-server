// ============================================================
//  SERVER - Timbangan Digital
//  Stack: Node.js + Express
//  Deploy: Railway / Render / VPS
//
//  Install: npm install express cors
//  Jalankan: node server.js
// ============================================================

const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // sajikan dashboard.html

// ── State terakhir dari ESP32 ──────────────────────────────
let dataTerakhir = {
  berat_sekarang : 0,
  berat_terkunci : 0,
  total_berat    : 0,
  total_bayar    : 0,
  harga_per_kg   : 0,
  harga_disimpan : false,
  lock_aktif     : false,
  baterai_volt   : 0,
  wifi_rssi      : 0,
  timestamp      : null,
  online         : false
};

// Riwayat penimbangan (simpan di memori, max 100 entri)
let riwayat = [];
let lastTotalBerat = 0;

// ── POST /api/data — terima data dari ESP32 ────────────────
app.post("/api/data", (req, res) => {
  const d = req.body;
  if (!d) return res.status(400).json({ error: "Body kosong" });

  // Deteksi transaksi baru: total_berat bertambah
  if (d.total_berat > lastTotalBerat + 0.01 && d.harga_per_kg > 0) {
    const selisih = parseFloat((d.total_berat - lastTotalBerat).toFixed(2));
    riwayat.push({
      id        : riwayat.length + 1,
      berat     : selisih,
      harga     : d.harga_per_kg,
      subtotal  : Math.round(selisih * d.harga_per_kg),
      waktu     : new Date().toLocaleTimeString("id-ID", {timeZone: "Asia/Jakarta"})
    });
    if (riwayat.length > 100) riwayat.shift(); // buang yang paling lama
  }
  lastTotalBerat = d.total_berat || 0;

  dataTerakhir = {
    ...d,
    timestamp : new Date().toISOString(),
    online    : true
  };

  console.log(`[${new Date().toLocaleTimeString()}] Data masuk:`, JSON.stringify(d));
  res.json({ ok: true });
});

// ── GET /api/data — ambil data terbaru (polling dari browser) ─
app.get("/api/data", (req, res) => {
  // tandai offline jika tidak ada data > 10 detik
  if (dataTerakhir.timestamp) {
    const selisih = Date.now() - new Date(dataTerakhir.timestamp).getTime();
    dataTerakhir.online = selisih < 10000;
  }
  res.json(dataTerakhir);
});

// ── GET /api/riwayat — ambil riwayat transaksi ────────────
app.get("/api/riwayat", (req, res) => {
  res.json(riwayat);
});

// ── DELETE /api/riwayat — hapus riwayat ──────────────────
app.delete("/api/riwayat", (req, res) => {
  riwayat = [];
  lastTotalBerat = 0;
  res.json({ ok: true });
});

// ── Fallback ke dashboard.html ─────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
