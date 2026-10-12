/** Rute dashboard admin: ringkasan, CRUD lab, pengajuan, jadwal, pemohon, laporan, pengaturan. */
import { Router } from 'express';
import { db, adaBentrokan, dalamPemeliharaan, catatRiwayat, bacaPengaturan, simpanPengaturan, bersihkanSesiKedaluwarsa } from '../db/database.js';
import {
  kirimError, adalahTanggalValid, adalahWaktuValid, keMenit, hariIni,
  keLike, buatBarisCsv, kirimJson,
} from '../lib/util.js';
import { LABEL_STATUS, STATUS_PEMINJAMAN } from '../data/config.js';

const router = Router();

router.use((req, res, next) => {
  req.admin?.token && bersihkanSesiKedaluwarsa();
  next();
});

/* ============================ RINGKASAN ============================ */

/** GET /api/admin/ringkasan — angka ringkas untuk kartu statistik. */
router.get('/ringkasan', (req, res) => {
  const hitung = (status) => db.prepare('SELECT COUNT(*) AS n FROM peminjaman WHERE status = ?').get(status).n;
  const total = db.prepare('SELECT COUNT(*) AS n FROM peminjaman').get().n;
  const labAktif = db.prepare(`SELECT COUNT(*) AS n FROM laboratorium WHERE status_operasional = 'aktif'`).get().n;

  const terbaru = db.prepare(`
    SELECT pj.nomor_pengajuan, pj.tanggal, pj.jam_mulai, pj.jam_selesai, pj.status, pj.created_at,
           l.nama AS laboratorium, pm.nama AS pemohon
    FROM peminjaman pj
    JOIN laboratorium l ON l.id = pj.laboratorium_id
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    ORDER BY pj.created_at DESC LIMIT 8
  `).all();

  const terdekat = db.prepare(`
    SELECT pj.nomor_pengajuan, pj.tanggal, pj.jam_mulai, pj.jam_selesai, pj.status,
           l.nama AS laboratorium, pm.nama AS pemohon
    FROM peminjaman pj
    JOIN laboratorium l ON l.id = pj.laboratorium_id
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    WHERE pj.status = 'disetujui' AND pj.tanggal >= ?
    ORDER BY pj.tanggal, pj.jam_mulai LIMIT 8
  `).all(hariIni());

  res.json({
    success: true,
    statistik: {
      total,
      menunggu: hitung('menunggu'),
      disetujui: hitung('disetujui'),
      ditolak: hitung('ditolak'),
      dibatalkan: hitung('dibatalkan'),
      selesai: hitung('selesai'),
      laboratorium_aktif: labAktif,
    },
    pengajuan_terbaru: terbaru.map(tandaiLabel),
    jadwal_terdekat: terdekat.map(tandaiLabel),
  });
});

function tandaiLabel(b) {
  return { ...b, label_status: LABEL_STATUS[b.status] || b.status };
}

/* ========================= MANAJEMEN LABORATORIUM ========================= */

/** GET /api/admin/laboratorium — daftar lengkap. */
router.get('/laboratorium', (req, res) => {
  const data = db.prepare('SELECT * FROM laboratorium ORDER BY nama').all();
  res.json({ success: true, data });
});

/** POST /api/admin/laboratorium — tambah laboratorium. */
router.post('/laboratorium', (req, res) => {
  const b = req.body || {};
  const nama = String(b.nama || '').trim();
  const kapasitas = Number(b.kapasitas);
  const status = String(b.status_operasional || 'aktif');
  const kesalahan = [];
  if (nama.length < 3) kesalahan.push('Nama laboratorium minimal 3 karakter.');
  if (!Number.isInteger(kapasitas) || kapasitas < 1) kesalahan.push('Kapasitas harus bilangan bulat minimal 1.');
  if (!['aktif', 'nonaktif', 'pemeliharaan'].includes(status)) kesalahan.push('Status operasional tidak valid.');
  if (kesalahan.length) return kirimError(res, 400, 'Data laboratorium belum valid.', kesalahan);

  const hasil = db.prepare(`
    INSERT INTO laboratorium (nama, lokasi, kapasitas, fasilitas, deskripsi, status_operasional)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nama, String(b.lokasi || '').trim(), kapasitas, String(b.fasilitas || '').trim(), String(b.deskripsi || '').trim(), status);
  kirimJson(res, 201, { success: true, pesan: 'Laboratorium berhasil ditambahkan.', id: Number(hasil.lastInsertRowid) });
});

/** PUT /api/admin/laboratorium/:id — ubah data laboratorium. */
router.put('/laboratorium/:id', (req, res) => {
  const id = Number(req.params.id);
  const lab = db.prepare('SELECT * FROM laboratorium WHERE id = ?').get(id);
  if (!lab) return kirimError(res, 404, 'Laboratorium tidak ditemukan.');

  const b = req.body || {};
  const nama = String(b.nama ?? lab.nama).trim();
  const kapasitas = Number(b.kapasitas ?? lab.kapasitas);
  const status = String(b.status_operasional ?? lab.status_operasional);
  const kesalahan = [];
  if (nama.length < 3) kesalahan.push('Nama laboratorium minimal 3 karakter.');
  if (!Number.isInteger(kapasitas) || kapasitas < 1) kesalahan.push('Kapasitas harus bilangan bulat minimal 1.');
  if (!['aktif', 'nonaktif', 'pemeliharaan'].includes(status)) kesalahan.push('Status operasional tidak valid.');
  if (kesalahan.length) return kirimError(res, 400, 'Data laboratorium belum valid.', kesalahan);

  db.prepare(`
    UPDATE laboratorium
    SET nama = ?, lokasi = ?, kapasitas = ?, fasilitas = ?, deskripsi = ?, status_operasional = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nama, String(b.lokasi ?? lab.lokasi).trim(), kapasitas, String(b.fasilitas ?? lab.fasilitas).trim(), String(b.deskripsi ?? lab.deskripsi).trim(), status, id);
  res.json({ success: true, pesan: 'Data laboratorium berhasil diperbarui.' });
});

/** DELETE /api/admin/laboratorium/:id — hapus (dengan proteksi relasi). */
router.delete('/laboratorium/:id', (req, res) => {
  const id = Number(req.params.id);
  const lab = db.prepare('SELECT * FROM laboratorium WHERE id = ?').get(id);
  if (!lab) return kirimError(res, 404, 'Laboratorium tidak ditemukan.');
  const dipakai = db.prepare('SELECT COUNT(*) AS n FROM peminjaman WHERE laboratorium_id = ?').get(id).n;
  if (dipakai > 0) {
    return kirimError(res, 409, `Laboratorium tidak dapat dihapus karena telah digunakan pada ${dipakai} pengajuan peminjaman.`);
  }
  db.prepare('DELETE FROM laboratorium WHERE id = ?').run(id);
  res.json({ success: true, pesan: 'Laboratorium berhasil dihapus.' });
});

/* ===================== MANAJEMEN PENGAJUAN PEMINJAMAN ===================== */

/** GET /api/admin/peminjaman — daftar dengan pencarian & filter. */
router.get('/peminjaman', (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const labId = Number(req.query.laboratorium_id) || null;
  const tanggal = String(req.query.tanggal || '').trim();

  let sql = `
    SELECT pj.*, l.nama AS laboratorium, pm.nama AS pemohon, pm.nim, pm.program_studi, pm.whatsapp
    FROM peminjaman pj
    JOIN laboratorium l ON l.id = pj.laboratorium_id
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    WHERE 1=1
  `;
  const params = [];
  if (q) { sql += ' AND (pm.nama LIKE ? OR pj.nomor_pengajuan LIKE ? OR pm.nim LIKE ? OR pj.tujuan LIKE ?)'; const l = keLike(q); params.push(l, l, l, l); }
  if (STATUS_PEMINJAMAN.includes(status)) { sql += ' AND pj.status = ?'; params.push(status); }
  if (labId) { sql += ' AND pj.laboratorium_id = ?'; params.push(labId); }
  if (tanggal && adalahTanggalValid(tanggal)) { sql += ' AND pj.tanggal = ?'; params.push(tanggal); }
  sql += ' ORDER BY pj.created_at DESC LIMIT 500';

  res.json({ success: true, data: db.prepare(sql).all(...params).map(tandaiLabel) });
});

/** GET /api/admin/peminjaman/:nomor — detail + riwayat status. */
router.get('/peminjaman/:nomor', (req, res) => {
  const baris = db.prepare(`
    SELECT pj.*, l.nama AS laboratorium, l.lokasi AS laboratorium_lokasi,
           pm.nama AS pemohon, pm.nim, pm.program_studi, pm.whatsapp
    FROM peminjaman pj
    JOIN laboratorium l ON l.id = pj.laboratorium_id
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    WHERE pj.nomor_pengajuan = ?
  `).get(String(req.params.nomor).toUpperCase());
  if (!baris) return kirimError(res, 404, 'Pengajuan tidak ditemukan.');

  const riwayat = db.prepare(`
    SELECT status_lama, status_baru, keterangan, diubah_oleh, created_at
    FROM riwayat_status WHERE peminjaman_id = ? ORDER BY created_at, id
  `).all(baris.id);
  res.json({ success: true, data: tandaiLabel(baris), riwayat });
});

/** Transisi status yang sah. */
const TRANSISI = {
  menunggu: ['disetujui', 'ditolak', 'dibatalkan'],
  disetujui: ['selesai', 'dibatalkan'],
  ditolak: [],
  dibatalkan: [],
  selesai: [],
};

/**
 * PATCH /api/admin/peminjaman/:nomor/status — ubah status pengajuan.
 * Persetujuan dilakukan dalam transaksi IMMEDIATE agar dua pengajuan
 * untuk jadwal yang sama tidak dapat disetujui bersamaan.
 */
router.patch('/peminjaman/:nomor/status', (req, res) => {
  const nomor = String(req.params.nomor).toUpperCase();
  const statusBaru = String(req.body?.status || '').trim();
  const alasan = String(req.body?.alasan || '').trim();

  if (!STATUS_PEMINJAMAN.includes(statusBaru)) {
    return kirimError(res, 400, 'Status tujuan tidak dikenal.');
  }

  try {
    db.exec('BEGIN IMMEDIATE');
    const baris = db.prepare('SELECT * FROM peminjaman WHERE nomor_pengajuan = ?').get(nomor);
    if (!baris) { db.exec('ROLLBACK'); return kirimError(res, 404, 'Pengajuan tidak ditemukan.'); }
    if (baris.status === statusBaru) { db.exec('ROLLBACK'); return kirimError(res, 409, `Pengajuan sudah berstatus "${LABEL_STATUS[statusBaru]}".`); }
    if (!TRANSISI[baris.status]?.includes(statusBaru)) {
      db.exec('ROLLBACK');
      return kirimError(res, 409, `Perubahan status dari "${LABEL_STATUS[baris.status]}" ke "${LABEL_STATUS[statusBaru]}" tidak diizinkan.`);
    }
    if (statusBaru === 'ditolak' && alasan.length < 3) {
      db.exec('ROLLBACK');
      return kirimError(res, 400, 'Admin wajib memberikan alasan penolakan.');
    }

    if (statusBaru === 'disetujui') {
      const lab = db.prepare('SELECT * FROM laboratorium WHERE id = ?').get(baris.laboratorium_id);
      if (lab.status_operasional !== 'aktif') {
        db.exec('ROLLBACK');
        return kirimError(res, 409, 'Laboratorium tidak berstatus aktif; persetujuan dibatalkan.');
      }
      if (dalamPemeliharaan(baris.laboratorium_id, baris.tanggal)) {
        db.exec('ROLLBACK');
        return kirimError(res, 409, 'Laboratorium dalam jadwal pemeliharaan pada tanggal tersebut; persetujuan dibatalkan.');
      }
      const bentrok = adaBentrokan(baris.laboratorium_id, baris.tanggal, baris.jam_mulai, baris.jam_selesai, baris.id);
      if (bentrok) {
        db.exec('ROLLBACK');
        return kirimError(res, 409, `Tidak dapat menyetujui: bertabrakan dengan peminjaman disetujui lain (${bentrok.nomor_pengajuan}).`);
      }
    }

    db.prepare(`
      UPDATE peminjaman SET status = ?, alasan_penolakan = ?, updated_at = datetime('now') WHERE id = ?
    `).run(statusBaru, statusBaru === 'ditolak' ? alasan : '', baris.id);
    catatRiwayat(baris.id, baris.status, statusBaru, alasan || `Status diubah menjadi ${LABEL_STATUS[statusBaru]}.`, req.admin.username);
    db.exec('COMMIT');
    res.json({ success: true, pesan: `Status pengajuan berhasil diubah menjadi "${LABEL_STATUS[statusBaru]}".` });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* diabaikan */ }
    console.error('[admin] Gagal mengubah status:', err.message);
    return kirimError(res, 500, 'Terjadi kesalahan saat mengubah status pengajuan.');
  }
});

/* ==================== MANAJEMEN JADWAL & PEMELIHARAAN ==================== */

/** GET /api/admin/jadwal?tanggal= — seluruh jadwal pada satu tanggal (termasuk batal & selesai). */
router.get('/jadwal', (req, res) => {
  const tanggal = String(req.query.tanggal || '').trim() || hariIni();
  const data = db.prepare(`
    SELECT pj.id, pj.nomor_pengajuan, pj.tanggal, pj.jam_mulai, pj.jam_selesai, pj.status, pj.tujuan, pj.jumlah_peserta,
           l.nama AS laboratorium, l.id AS laboratorium_id, pm.nama AS pemohon, pm.nim
    FROM peminjaman pj
    JOIN laboratorium l ON l.id = pj.laboratorium_id
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    WHERE pj.tanggal = ?
    ORDER BY l.nama, pj.jam_mulai
  `).all(tanggal).map(tandaiLabel);
  const pemeliharaan = db.prepare(`
    SELECT p.*, l.nama AS laboratorium
    FROM pemeliharaan_laboratorium p JOIN laboratorium l ON l.id = p.laboratorium_id
    WHERE p.tanggal_mulai <= ? AND p.tanggal_selesai >= ?
    ORDER BY l.nama
  `).all(tanggal, tanggal);
  const labs = db.prepare('SELECT id, nama, status_operasional, kapasitas FROM laboratorium ORDER BY nama').all();
  res.json({ success: true, tanggal, data, pemeliharaan, laboratorium: labs });
});

/** GET /api/admin/pemeliharaan — daftar jadwal pemeliharaan. */
router.get('/pemeliharaan', (req, res) => {
  const data = db.prepare(`
    SELECT p.*, l.nama AS laboratorium
    FROM pemeliharaan_laboratorium p JOIN laboratorium l ON l.id = p.laboratorium_id
    ORDER BY p.tanggal_mulai DESC
  `).all();
  res.json({ success: true, data });
});

/** POST /api/admin/pemeliharaan — tambah jadwal pemeliharaan. */
router.post('/pemeliharaan', (req, res) => {
  const labId = Number(req.body?.laboratorium_id);
  const tanggalMulai = String(req.body?.tanggal_mulai || '');
  const tanggalSelesai = String(req.body?.tanggal_selesai || '');
  const keterangan = String(req.body?.keterangan || '').trim();
  if (!db.prepare('SELECT 1 FROM laboratorium WHERE id = ?').get(labId)) {
    return kirimError(res, 404, 'Laboratorium tidak ditemukan.');
  }
  if (!adalahTanggalValid(tanggalMulai) || !adahkanTanggal(tanggalSelesai) || tanggalSelesai < tanggalMulai) {
    return kirimError(res, 400, 'Tanggal pemeliharaan tidak valid (rentang harus sesuai dan format YYYY-MM-DD).');
  }
  db.prepare(`
    INSERT INTO pemeliharaan_laboratorium (laboratorium_id, tanggal_mulai, tanggal_selesai, keterangan)
    VALUES (?, ?, ?, ?)
  `).run(labId, tanggalMulai, tanggalSelesai, keterangan);
  kirimJson(res, 201, { success: true, pesan: 'Jadwal pemeliharaan berhasil ditambahkan.' });
});

/** DELETE /api/admin/pemeliharaan/:id */
router.delete('/pemeliharaan/:id', (req, res) => {
  const hasil = db.prepare('DELETE FROM pemeliharaan_laboratorium WHERE id = ?').run(Number(req.params.id));
  if (hasil.changes === 0) return kirimError(res, 404, 'Jadwal pemeliharaan tidak ditemukan.');
  res.json({ success: true, pesan: 'Jadwal pemeliharaan dihapus.' });
});

function adahkanTanggal(t) { return adalahTanggalValid(t); }

/* ======================== MANAJEMEN DATA PEMOHON ======================== */

/** GET /api/admin/pemohon?q= — data pemohon terhimpun dari pengajuan. */
router.get('/pemohon', (req, res) => {
  const q = String(req.query.q || '').trim();
  let sql = `
    SELECT pm.id, pm.nama, pm.nim, pm.program_studi, pm.whatsapp, pm.created_at,
           COUNT(pj.id) AS jumlah_pengajuan,
           MAX(pj.created_at) AS pengajuan_terakhir
    FROM peminjam pm
    LEFT JOIN peminjaman pj ON pj.peminjam_id = pm.id
  `;
  const params = [];
  if (q) { sql += ' WHERE pm.nama LIKE ? OR pm.nim LIKE ?'; const l = keLike(q); params.push(l, l); }
  sql += ' GROUP BY pm.id ORDER BY pm.nama';
  res.json({ success: true, data: db.prepare(sql).all(...params) });
});

/* ========================= LAPORAN & REKAPITULASI ========================= */

/** Bangun filter periode untuk laporan. */
function filterPeriode(req) {
  const dari = String(req.query.dari || '').trim();
  const sampai = String(req.query.sampai || '').trim();
  let sql = ' WHERE 1=1';
  const params = [];
  if (dari && adalahTanggalValid(dari)) { sql += ' AND pj.tanggal >= ?'; params.push(dari); }
  if (sampai && adalahTanggalValid(sampai)) { sql += ' AND pj.tanggal <= ?'; params.push(sampai); }
  return { sql, params, dari, sampai };
}

/** GET /api/admin/laporan?dari=&sampai= — rekap berdasarkan data tersimpan. */
router.get('/laporan', (req, res) => {
  const { sql, params, dari, sampai } = filterPeriode(req);

  const perStatus = db.prepare(`
    SELECT pj.status, COUNT(*) AS jumlah FROM peminjaman pj${sql} GROUP BY pj.status
  `).all(...params);
  const total = perStatus.reduce((a, b) => a + b.jumlah, 0);

  const perLab = db.prepare(`
    SELECT l.nama AS laboratorium, COUNT(*) AS jumlah
    FROM peminjaman pj JOIN laboratorium l ON l.id = pj.laboratorium_id${sql}
    GROUP BY l.id ORDER BY jumlah DESC, l.nama
  `).all(...params);

  const perBulan = db.prepare(`
    SELECT substr(pj.tanggal, 1, 7) AS bulan, COUNT(*) AS jumlah
    FROM peminjaman pj${sql} GROUP BY bulan ORDER BY bulan DESC LIMIT 24
  `).all(...params);

  const perTahun = db.prepare(`
    SELECT substr(pj.tanggal, 1, 4) AS tahun, COUNT(*) AS jumlah
    FROM peminjaman pj${sql} GROUP BY tahun ORDER BY tahun DESC LIMIT 10
  `).all(...params);

  res.json({
    success: true,
    periode: { dari: dari || null, sampai: sampai || null },
    total,
    per_status: STATUS_PEMINJAMAN.map((s) => ({
      status: s,
      label: LABEL_STATUS[s],
      jumlah: perStatus.find((x) => x.status === s)?.jumlah || 0,
    })),
    per_laboratorium: perLab,
    per_bulan: perBulan,
    per_tahun: perTahun,
  });
});

/** GET /api/admin/laporan/csv — ekspor data peminjaman ke CSV. */
router.get('/laporan/csv', (req, res) => {
  const { sql, params, dari, sampai } = filterPeriode(req);
  const baris = db.prepare(`
    SELECT pj.nomor_pengajuan, pm.nama AS pemohon, pm.nim, pm.program_studi, pm.whatsapp,
           l.nama AS laboratorium, pj.tanggal, pj.jam_mulai, pj.jam_selesai,
           pj.jumlah_peserta, pj.tujuan, pj.status, pj.alasan_penolakan, pj.created_at
    FROM peminjaman pj
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    JOIN laboratorium l ON l.id = pj.laboratorium_id${sql}
    ORDER BY pj.tanggal DESC, pj.jam_mulai
  `).all(...params);

  const kolom = ['nomor_pengajuan', 'pemohon', 'nim', 'program_studi', 'whatsapp', 'laboratorium', 'tanggal', 'jam_mulai', 'jam_selesai', 'jumlah_peserta', 'tujuan', 'status', 'alasan_penolakan', 'created_at'];
  const csv = buatBarisCsv(kolom, baris);
  const namaFile = `laporan-peminjaman-${dari || 'semua'}-${sampai || 'semua'}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);
  res.send(`\uFEFF${csv}`); // BOM agar Excel membaca UTF-8
});

/* ===================== MANAJEMEN KETENTUAN & INFORMASI ===================== */

const KUNCI_IZIN_BATAL = 'boleh_batalkan_disetujui';

/** GET /api/admin/pengaturan */
router.get('/pengaturan', (req, res) => {
  const p = bacaPengaturan();
  res.json({
    success: true,
    data: {
      ...p,
      [KUNCI_IZIN_BATAL]: p[KUNCI_IZIN_BATAL] || 'tidak',
    },
  });
});

/** PUT /api/admin/pengaturan — perbarui ketentuan, kontak, dan informasi yang tampil di halaman pengguna. */
router.put('/pengaturan', (req, res) => {
  const izinDiizinkan = ['ya', 'tidak'];
  const b = req.body || {};
  const yangBolehDiubah = [
    'sistem_nama', 'sistem_tagline', 'sistem_deskripsi', 'sistem_institusi',
    'jam_mulai', 'jam_selesai',
    'ketentuan_prosedur', 'ketentuan_umum', 'ketentuan_aturan',
    'kontak_nama', 'kontak_jabatan', 'kontak_whatsapp', 'kontak_email', 'kontak_alamat', 'kontak_jam_layanan',
  ];
  const update = {};
  for (const kunci of yangBolehDiubah) {
    if (b[kunci] !== undefined) update[kunci] = String(b[kunci]).trim();
  }
  if (update.jam_mulai !== undefined && !adalahWaktuValid(update.jam_mulai)) {
    return kirimError(res, 400, 'Jam layanan mulai tidak valid.');
  }
  if (update.jam_selesai !== undefined && !adalahWaktuValid(update.jam_selesai)) {
    return kirimError(res, 400, 'Jam layanan selesai tidak valid.');
  }
  if (update.jam_mulai && update.jam_selesai && keMenit(update.jam_selesai) <= keMenit(update.jam_mulai)) {
    return kirimError(res, 400, 'Jam layanan selesai harus lebih akhir daripada jam mulai.');
  }
  if (b[KUNCI_IZIN_BATAL] !== undefined) {
    const nilai = String(b[KUNCI_IZIN_BATAL]);
    if (!izinDiizinkan.includes(nilai)) return kirimError(res, 400, 'Nilai izin pembatalan tidak valid.');
    update[KUNCI_IZIN_BATAL] = nilai;
  }
  if (Object.keys(update).length === 0) return kirimError(res, 400, 'Tidak ada data yang dikirim untuk diperbarui.');

  simpanPengaturan(update);
  res.json({ success: true, pesan: 'Pengaturan berhasil disimpan dan langsung berlaku di halaman pengguna.' });
});

export default router;
