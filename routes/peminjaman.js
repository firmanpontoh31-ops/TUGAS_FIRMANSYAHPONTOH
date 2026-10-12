/** Rute pengajuan peminjaman dari sisi pengguna. */
import { Router } from 'express';
import { db, adaBentrokan, dalamPemeliharaan, catatRiwayat, bacaPengaturan } from '../db/database.js';
import {
  kirimError, buatNomorPengajuan, adalahTanggalValid, adalahWaktuValid,
  adalahNimValid, adalahWhatsappValid, keMenit, hariIni,
} from '../lib/util.js';
import { LABEL_STATUS } from '../data/config.js';

const router = Router();

/**
 * POST /api/peminjaman — ajukan peminjaman baru.
 * Validasi dilakukan di sisi server; bentrokan dengan peminjaman
 * yang sudah disetujui memblokir pengajuan pada rentang waktu tersebut.
 */
router.post('/', (req, res) => {
  const b = req.body || {};
  const nama = String(b.nama || '').trim();
  const nim = String(b.nim || '').trim();
  const programStudi = String(b.program_studi || '').trim();
  const whatsapp = String(b.whatsapp || '').trim();
  const laboratoriumId = Number(b.laboratorium_id);
  const tanggal = String(b.tanggal || '').trim();
  const jamMulai = String(b.jam_mulai || '').trim();
  const jamSelesai = String(b.jam_selesai || '').trim();
  const tujuan = String(b.tujuan || '').trim();
  const jumlahPeserta = Number(b.jumlah_peserta);
  const catatan = String(b.catatan || '').trim();
  const persetujuanData = b.persetujuan_data === true || b.persetujuan_data === 'true';

  // --- Validasi kolom wajib dan format ---
  const kesalahan = [];
  if (nama.length < 3) kesalahan.push('Nama lengkap pemohon minimal 3 karakter.');
  if (!adalahNimValid(nim)) kesalahan.push('NIM/identitas tidak valid (4–25 karakter: huruf, angka, titik, garis bawah, atau strip).');
  if (!programStudi) kesalahan.push('Program studi/kelas wajib diisi.');
  if (!adalahWhatsappValid(whatsapp)) kesalahan.push('Nomor WhatsApp tidak valid (9–18 digit, boleh diawali +).');
  if (!Number.isInteger(laboratoriumId) || laboratoriumId <= 0) kesalahan.push('Laboratorium wajib dipilih.');
  if (!adalahTanggalValid(tanggal)) kesalahan.push('Tanggal peminjaman tidak valid.');
  if (!adalahWaktuValid(jamMulai) || !adalahWaktuValid(jamSelesai)) kesalahan.push('Format waktu harus HH:MM.');
  if (!tujuan || tujuan.length < 5) kesalahan.push('Tujuan peminjaman wajib diisi (minimal 5 karakter).');
  if (!Number.isInteger(jumlahPeserta) || jumlahPeserta < 1) kesalahan.push('Jumlah peserta minimal 1 orang.');
  if (catatan.length > 500) kesalahan.push('Catatan tambahan maksimal 500 karakter.');
  if (!persetujuanData) kesalahan.push('Persetujuan penggunaan data wajib dicentang.');
  if (kesalahan.length) return kirimError(res, 400, 'Data pengajuan belum valid.', kesalahan);

  if (adalahWaktuValid(jamMulai) && adalahWaktuValid(jamSelesai) && keMenit(jamSelesai) <= keMenit(jamMulai)) {
    return kirimError(res, 400, 'Waktu selesai harus lebih akhir daripada waktu mulai.');
  }

  // --- Hari libur masa lalu ---
  if (tanggal < hariIni()) {
    return kirimError(res, 400, 'Pengajuan untuk tanggal yang sudah lewat tidak dapat diproses.');
  }

  // --- Jam layanan ---
  const pengaturan = bacaPengaturan();
  const jamBuka = pengaturan.jam_mulai || '08:00';
  const jamTutup = pengaturan.jam_selesai || '17:00';
  if (keMenit(jamMulai) < keMenit(jamBuka) || keMenit(jamSelesai) > keMenit(jamTutup)) {
    return kirimError(res, 400, `Peminjaman hanya melayani jam layanan ${jamBuka}–${jamTutup}.`);
  }

  // --- Laboratorium ---
  const lab = db.prepare('SELECT * FROM laboratorium WHERE id = ?').get(laboratoriumId);
  if (!lab) return kirimError(res, 404, 'Laboratorium tidak ditemukan.');
  if (lab.status_operasional !== 'aktif') {
    return kirimError(res, 409, `Laboratorium "${lab.nama}" sedang ${lab.status_operasional === 'pemeliharaan' ? 'dalam pemeliharaan' : 'tidak aktif'} dan tidak dapat dipilih.`);
  }
  if (dalamPemeliharaan(laboratoriumId, tanggal)) {
    return kirimError(res, 409, 'Laboratorium sedang dalam jadwal pemeliharaan pada tanggal tersebut.');
  }
  if (jumlahPeserta > lab.kapasitas) {
    return kirimError(res, 400, `Jumlah peserta melebihi kapasitas ${lab.nama} (${lab.kapasitas} orang).`);
  }

  // --- Bentrokan jadwal (pencegahan di sisi server) ---
  const bentrok = adaBentrokan(laboratoriumId, tanggal, jamMulai, jamSelesai);
  if (bentrok) {
    return kirimError(res, 409, `Jadwal bertabrakan dengan peminjaman yang sudah disetujui (${bentrok.nomor_pengajuan}). Silakan pilih waktu lain.`);
  }

  // --- Simpan pengajuan + identitas pemohon (upsert agar tidak duplikat) ---
  db.prepare(`
    INSERT INTO peminjam (nama, nim, program_studi, whatsapp)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(nim) DO UPDATE SET nama = excluded.nama, program_studi = excluded.program_studi, whatsapp = excluded.whatsapp
  `).run(nama, nim, programStudi, whatsapp);
  const pemohon = db.prepare('SELECT id FROM peminjam WHERE nim = ?').get(nim);

  let nomor = buatNomorPengajuan();
  for (let i = 0; i < 10 && db.prepare('SELECT 1 FROM peminjaman WHERE nomor_pengajuan = ?').get(nomor); i++) {
    nomor = buatNomorPengajuan();
  }

  const hasil = db.prepare(`
    INSERT INTO peminjaman
      (nomor_pengajuan, peminjam_id, laboratorium_id, tanggal, jam_mulai, jam_selesai, tujuan, jumlah_peserta, catatan, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu')
  `).run(nomor, pemohon.id, laboratoriumId, tanggal, jamMulai, jamSelesai, tujuan, jumlahPeserta, catatan);

  catatRiwayat(Number(hasil.lastInsertRowid), 'pengajuan', 'menunggu', 'Pengajuan peminjaman diterima sistem.', 'sistem');

  res.status(201).json({
    success: true,
    pesan: 'Pengajuan peminjaman berhasil dikirim dan menunggu persetujuan admin.',
    nomor_pengajuan: nomor,
    status: 'menunggu',
    label_status: LABEL_STATUS.menunggu,
  });
});

/**
 * POST /api/peminjaman/cek-status — cek status berdasarkan nomor pengajuan + NIM.
 * Kombinasi keduanya mencegah akses informasi hanya dengan menebak nomor pengajuan.
 */
router.post('/cek-status', (req, res) => {
  const nomor = String(req.body?.nomor_pengajuan || '').trim().toUpperCase();
  const nim = String(req.body?.nim || '').trim();
  if (!nomor || !nim) return kirimError(res, 400, 'Nomor pengajuan dan NIM wajib diisi.');

  const baris = db.prepare(`
    SELECT pj.*, l.nama AS laboratorium_nama, l.lokasi AS laboratorium_lokasi,
           pm.nama AS pemohon_nama, pm.nim AS pemohon_nim, pm.program_studi, pm.whatsapp
    FROM peminjaman pj
    JOIN laboratorium l ON l.id = pj.laboratorium_id
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    WHERE pj.nomor_pengajuan = ? AND pm.nim = ?
  `).get(nomor, nim);

  if (!baris) {
    return kirimError(res, 404, 'Pengajuan tidak ditemukan. Periksa kembali nomor pengajuan dan NIM Anda.');
  }

  const riwayat = db.prepare(`
    SELECT status_lama, status_baru, keterangan, diubah_oleh, created_at
    FROM riwayat_status WHERE peminjaman_id = ? ORDER BY created_at, id
  `).all(baris.id);

  res.json({
    success: true,
    data: {
      nomor_pengajuan: baris.nomor_pengajuan,
      status: baris.status,
      label_status: LABEL_STATUS[baris.status] || baris.status,
      alasan_penolakan: baris.alasan_penolakan || null,
      pemohon: { nama: baris.pemohon_nama, nim: baris.pemohon_nim, program_studi: baris.program_studi },
      laboratorium: baris.laboratorium_nama,
      lokasi: baris.laboratorium_lokasi || '',
      tanggal: baris.tanggal,
      jam_mulai: baris.jam_mulai,
      jam_selesai: baris.jam_selesai,
      tujuan: baris.tujuan,
      jumlah_peserta: baris.jumlah_peserta,
      catatan: baris.catatan,
      diajukan_pada: baris.created_at,
      riwayat,
    },
  });
});

/**
 * POST /api/peminjaman/riwayat — daftar pengajuan milik satu NIM.
 * Memerlukan NIM sehingga riwayat tidak dapat diakses hanya dengan menebak nomor.
 */
router.post('/riwayat', (req, res) => {
  const nim = String(req.body?.nim || '').trim();
  if (!adalahNimValid(nim)) return kirimError(res, 400, 'NIM tidak valid.');

  const pemohon = db.prepare('SELECT id, nama FROM peminjam WHERE nim = ?').get(nim);
  if (!pemohon) {
    return res.json({ success: true, data: [], pesan: 'Tidak ada pengajuan untuk NIM tersebut.' });
  }

  const baris = db.prepare(`
    SELECT pj.nomor_pengajuan, pj.tanggal, pj.jam_mulai, pj.jam_selesai, pj.status,
           pj.tujuan, pj.jumlah_peserta, pj.created_at, pj.alasan_penolakan,
           l.nama AS laboratorium
    FROM peminjaman pj
    JOIN laboratorium l ON l.id = pj.laboratorium_id
    WHERE pj.peminjam_id = ?
    ORDER BY pj.created_at DESC
  `).all(pemohon.id);

  res.json({
    success: true,
    pemohon: pemohon.nama,
    data: baris.map((x) => ({ ...x, label_status: LABEL_STATUS[x.status] || x.status })),
  });
});

/**
 * POST /api/peminjaman/batal — batalkan pengajuan milik sendiri.
 * Pengajuan "menunggu" selalu bisa dibatalkan pemohon.
 * Pengajuan "disetujui" hanya bisa dibatalkan bila ketentuan admin mengizinkan.
 */
router.post('/batal', (req, res) => {
  const nomor = String(req.body?.nomor_pengajuan || '').trim().toUpperCase();
  const nim = String(req.body?.nim || '').trim();
  if (!nomor || !nim) return kirimError(res, 400, 'Nomor pengajuan dan NIM wajib diisi.');

  const baris = db.prepare(`
    SELECT pj.*, pm.nim FROM peminjaman pj
    JOIN peminjam pm ON pm.id = pj.peminjam_id
    WHERE pj.nomor_pengajuan = ?
  `).get(nomor);
  if (!baris || baris.nim !== nim) {
    return kirimError(res, 404, 'Pengajuan tidak ditemukan atau bukan milik Anda.');
  }
  if (baris.status === 'dibatalkan') return kirimError(res, 409, 'Pengajuan sudah dibatalkan sebelumnya.');
  if (baris.status === 'selesai') return kirimError(res, 409, 'Pengajuan yang sudah selesai tidak dapat dibatalkan.');
  if (baris.status === 'ditolak') return kirimError(res, 409, 'Pengajuan yang ditolak tidak dapat dibatalkan.');

  if (baris.status === 'disetujui') {
    const pengaturan = bacaPengaturan();
    if (pengaturan.boleh_batalkan_disetujui !== 'ya') {
      return kirimError(res, 403, 'Pengajuan yang sudah disetujui hanya dapat dibatalkan sesuai ketentuan admin. Silakan hubungi pengelola laboratorium.');
    }
  }

  db.prepare(`
    UPDATE peminjaman SET status = 'dibatalkan', updated_at = datetime('now') WHERE id = ?
  `).run(baris.id);
  catatRiwayat(baris.id, baris.status, 'dibatalkan', 'Dibatalkan oleh pemohon melalui halaman riwayat.', `pemohon:${nim}`);

  res.json({ success: true, pesan: 'Pengajuan berhasil dibatalkan.' });
});

export default router;
