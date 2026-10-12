/** Rute publik: informasi laboratorium, jadwal, pengaturan umum. */
import { Router } from 'express';
import { db, bacaPengaturan } from '../db/database.js';
import { hariIni, kirimError } from '../lib/util.js';
import { LABEL_STATUS } from '../data/config.js';

const router = Router();

/** GET /api/pengaturan — informasi sistem, ketentuan, dan kontak untuk halaman pengguna. */
router.get('/pengaturan', (req, res) => {
  const p = bacaPengaturan();
  res.json({
    success: true,
    sistem: {
      nama: p.sistem_nama || '',
      judul: p.sistem_judul || '',
      tagline: p.sistem_tagline || '',
      deskripsi: p.sistem_deskripsi || '',
      institusi: p.sistem_institusi || '',
    },
    jamLayanan: { mulai: p.jam_mulai || '08:00', selesai: p.jam_selesai || '17:00' },
    ketentuan: {
      prosedur: p.ketentuan_prosedur || '',
      umum: p.ketentuan_umum || '',
      aturan: p.ketentuan_aturan || '',
    },
    kontak: {
      nama: p.kontak_nama || '',
      jabatan: p.kontak_jabatan || '',
      whatsapp: p.kontak_whatsapp || '',
      email: p.kontak_email || '',
      alamat: p.kontak_alamat || '',
      jamLayanan: p.kontak_jam_layanan || '',
    },
  });
});

/** GET /api/laboratorium — daftar laboratorium untuk halaman pengguna. */
router.get('/laboratorium', (req, res) => {
  const labs = db.prepare(`
    SELECT id, nama, lokasi, kapasitas, fasilitas, deskripsi, status_operasional
    FROM laboratorium
    ORDER BY nama
  `).all();
  res.json({ success: true, data: labs });
});

/**
 * GET /api/jadwal?tanggal=YYYY-MM-DD&laboratorium_id=&status=
 * Daftar jadwal peminjaman (hanya menunggu & disetujui) beserta indikator ketersediaan.
 */
router.get('/jadwal', (req, res) => {
  const tanggal = String(req.query.tanggal || '').trim() || hariIni();
  const labId = Number(req.query.laboratorium_id) || null;
  const status = String(req.query.status || '').trim();

  const filterStatus = ['menunggu', 'disetujui'].includes(status) ? status : null;

  let sql = `
    SELECT pj.id, pj.nomor_pengajuan, pj.tanggal, pj.jam_mulai, pj.jam_selesai,
           pj.status, pj.tujuan, pj.jumlah_peserta,
           l.nama AS laboratorium, l.id AS laboratorium_id,
           pm.nama AS pemohon
    FROM peminjaman pj
    JOIN laboratorium l ON l.id = pj.laboratorium_id
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    WHERE pj.tanggal = ? AND pj.status IN ('menunggu','disetujui')
  `;
  const params = [tanggal];
  if (labId) { sql += ' AND pj.laboratorium_id = ?'; params.push(labId); }
  if (filterStatus) { sql += ' AND pj.status = ?'; params.push(filterStatus); }
  sql += ' ORDER BY pj.jam_mulai';

  const jadwal = db.prepare(sql).all(...params).map((b) => ({
    ...b,
    label_status: LABEL_STATUS[b.status] || b.status,
    // Nama pemohon hanya inisial untuk privasi di halaman publik.
    pemohon: inisialNama(b.pemohon),
  }));

  const pemeliharaan = db.prepare(`
    SELECT p.id, p.tanggal_mulai, p.tanggal_selesai, p.keterangan,
           l.nama AS laboratorium, l.id AS laboratorium_id
    FROM pemeliharaan_laboratorium p
    JOIN laboratorium l ON l.id = p.laboratorium_id
    WHERE p.tanggal_mulai <= ? AND p.tanggal_selesai >= ?
    ORDER BY l.nama
  `).all(tanggal, tanggal);

  const hariIniStr = hariIni();
  const labs = db.prepare(`
    SELECT id, nama, kapasitas, status_operasional,
      EXISTS(
        SELECT 1 FROM peminjaman pj
        WHERE pj.laboratorium_id = laboratorium.id AND pj.tanggal = ? AND pj.status = 'disetujui'
      ) AS ada_jadwal_disetujui
    FROM laboratorium
    ORDER BY nama
  `).all(tanggal).map((l) => {
    let ketersediaan = 'tersedia';
    if (l.status_operasional === 'nonaktif') ketersediaan = 'tidak_tersedia';
    else if (l.status_operasional === 'pemeliharaan') ketersediaan = 'pemeliharaan';
    else if (l.ada_jadwal_disetujui) ketersediaan = 'terpakai';
    else if (tanggal < hariIniStr) ketersediaan = 'lewatterakhir';
    return {
      id: l.id,
      nama: l.nama,
      kapasitas: l.kapasitas,
      status_operasional: l.status_operasional,
      ketersediaan,
    };
  });

  res.json({ success: true, tanggal, jadwal, pemeliharaan, laboratorium: labs });
});

/**
 * GET /api/ketersediaan?laboratorium_id&tanggal&jam_mulai&jam_selesai
 * Pemeriksaan cepat bentrokan jadwal untuk formulir pengajuan (bukan pengganti validasi server).
 */
router.get('/ketersediaan', (req, res) => {
  const labId = Number(req.query.laboratorium_id);
  const tanggal = String(req.query.tanggal || '');
  const jamMulai = String(req.query.jam_mulai || '');
  const jamSelesai = String(req.query.jam_selesai || '');
  if (!labId || !tanggal || !jamMulai || !jamSelesai) {
    return kirimError(res, 400, 'Parameter laboratorium_id, tanggal, jam_mulai, dan jam_selesai wajib diisi.');
  }
  const lab = db.prepare('SELECT id, nama, status_operasional FROM laboratorium WHERE id = ?').get(labId);
  if (!lab) return kirimError(res, 404, 'Laboratorium tidak ditemukan.');

  const bentrok = db.prepare(`
    SELECT nomor_pengajuan FROM peminjaman
    WHERE laboratorium_id = ? AND tanggal = ? AND status IN ('menunggu','disetujui')
      AND jam_mulai < ? AND jam_selesai > ?
    LIMIT 1
  `).get(labId, tanggal, jamSelesai, jamMulai);

  res.json({
    success: true,
    tersedia: !bentrok && lab.status_operasional === 'aktif',
    bentrok_dengan: bentrok ? bentrok.nomor_pengajuan : null,
    status_laboratorium: lab.status_operasional,
  });
});

/** inisial nama: "Budi Santoso" -> "B. S." */
function inisialNama(nama) {
  return String(nama || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((kata) => `${kata[0].toUpperCase()}.`)
    .join(' ');
}

export default router;
