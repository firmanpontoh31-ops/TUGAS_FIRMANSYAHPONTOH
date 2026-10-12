/**
 * Lapisan basis data SQLite menggunakan modul bawaan Node.js `node:sqlite`.
 * Tidak memerlukan kompilasi native sehingga aman di Windows.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_AWAL_LABORATORIUM, KETENTUAN_AWAL, KONTAK_AWAL, JAM_LAYANAN, KONFIGURASI_SISTEM } from '../data/config.js';
import { hashPassword } from '../lib/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = __dirname;
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DB_DIR, 'lab.db');

fs.mkdirSync(DB_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/** Skema lengkap basis data. */
function buatSkema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nama          TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sesi_admin (
      token      TEXT PRIMARY KEY,
      admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS laboratorium (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      nama              TEXT NOT NULL,
      lokasi            TEXT NOT NULL DEFAULT '',
      kapasitas         INTEGER NOT NULL DEFAULT 0 CHECK (kapasitas >= 0),
      fasilitas         TEXT NOT NULL DEFAULT '',
      deskripsi         TEXT NOT NULL DEFAULT '',
      status_operasional TEXT NOT NULL DEFAULT 'aktif'
                        CHECK (status_operasional IN ('aktif','nonaktif','pemeliharaan')),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS peminjam (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nama          TEXT NOT NULL,
      nim           TEXT NOT NULL UNIQUE,
      program_studi TEXT NOT NULL DEFAULT '',
      whatsapp      TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS peminjaman (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_pengajuan   TEXT NOT NULL UNIQUE,
      peminjam_id       INTEGER NOT NULL REFERENCES peminjam(id) ON DELETE RESTRICT,
      laboratorium_id   INTEGER NOT NULL REFERENCES laboratorium(id) ON DELETE RESTRICT,
      tanggal           TEXT NOT NULL,
      jam_mulai         TEXT NOT NULL,
      jam_selesai       TEXT NOT NULL,
      tujuan            TEXT NOT NULL,
      jumlah_peserta    INTEGER NOT NULL CHECK (jumlah_peserta > 0),
      catatan           TEXT NOT NULL DEFAULT '',
      status            TEXT NOT NULL DEFAULT 'menunggu'
                        CHECK (status IN ('menunggu','disetujui','ditolak','dibatalkan','selesai')),
      alasan_penolakan  TEXT NOT NULL DEFAULT '',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (jam_selesai > jam_mulai)
    );

    CREATE TABLE IF NOT EXISTS riwayat_status (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      peminjaman_id  INTEGER NOT NULL REFERENCES peminjaman(id) ON DELETE CASCADE,
      status_lama    TEXT NOT NULL,
      status_baru    TEXT NOT NULL,
      keterangan     TEXT NOT NULL DEFAULT '',
      diubah_oleh    TEXT NOT NULL DEFAULT 'sistem',
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pemeliharaan_laboratorium (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      laboratorium_id INTEGER NOT NULL REFERENCES laboratorium(id) ON DELETE CASCADE,
      tanggal_mulai   TEXT NOT NULL,
      tanggal_selesai TEXT NOT NULL,
      keterangan      TEXT NOT NULL DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pengaturan (
      kunci    TEXT PRIMARY KEY,
      nilai    TEXT NOT NULL,
      diubah_pada TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_peminjaman_tanggal      ON peminjaman(tanggal);
    CREATE INDEX IF NOT EXISTS idx_peminjaman_status       ON peminjaman(status);
    CREATE INDEX IF NOT EXISTS idx_peminjaman_lab          ON peminjaman(laboratorium_id, tanggal);
    CREATE INDEX IF NOT EXISTS idx_riwayat_peminjaman      ON riwayat_status(peminjaman_id);
    CREATE INDEX IF NOT EXISTS idx_pemeliharaan_lab        ON pemeliharaan_laboratorium(laboratorium_id);
    CREATE INDEX IF NOT EXISTS idx_sisi_expires            ON sesi_admin(expires_at);
  `);
}

/** Susun entri baru untuk pengaturan awal (ketentuan, kontak, jam layanan, profil). */
function pengaturanAwal() {
  return [
    ['sistem_nama', KONFIGURASI_SISTEM.namaSistem],
    ['sistem_judul', KONFIGURASI_SISTEM.judulProyek],
    ['sistem_tagline', KONFIGURASI_SISTEM.tagline],
    ['sistem_deskripsi', KONFIGURASI_SISTEM.deskripsi],
    ['sistem_institusi', KONFIGURASI_SISTEM.namaInstitusi],
    ['jam_mulai', JAM_LAYANAN.mulai],
    ['jam_selesai', JAM_LAYANAN.selesai],
    ['ketentuan_prosedur', KETENTUAN_AWAL.prosedur],
    ['ketentuan_umum', KETENTUAN_AWAL.ketentuanUmum],
    ['ketentuan_aturan', KETENTUAN_AWAL.aturanPenggunaan],
    ['kontak_nama', KONTAK_AWAL.nama],
    ['kontak_jabatan', KONTAK_AWAL.jabatan],
    ['kontak_whatsapp', KONTAK_AWAL.whatsapp],
    ['kontak_email', KONTAK_AWAL.email],
    ['kontak_alamat', KONTAK_AWAL.alamat],
    ['kontak_jam_layanan', KONTAK_AWAL.jamLayanan],
  ];
}

/** Inisialisasi skema, data awal, dan akun admin dari .env. */
export function initDatabase() {
  buatSkema();

  // Data contoh laboratorium hanya disuntikkan bila tabel masih kosong.
  const jumlahLab = db.prepare('SELECT COUNT(*) AS n FROM laboratorium').get().n;
  if (jumlahLab === 0) {
    const stmt = db.prepare(`
      INSERT INTO laboratorium (nama, lokasi, kapasitas, fasilitas, deskripsi, status_operasional)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const lab of DATA_AWAL_LABORATORIUM) {
      stmt.run(lab.nama, lab.lokasi, lab.kapasitas, lab.fasilitas, lab.deskripsi, lab.status_operasional);
    }
    console.log('[db] Data contoh laboratorium (CONTOH) disuntikkan.');
  }

  // Pengaturan awal hanya diisi bila kunci belum ada.
  const stmtSet = db.prepare(`
    INSERT INTO pengaturan (kunci, nilai) VALUES (?, ?)
    ON CONFLICT(kunci) DO NOTHING
  `);
  for (const [kunci, nilai] of pengaturanAwal()) stmtSet.run(kunci, nilai);

  // Sinkronkan akun admin dengan kredensial pada .env (kata sandi tidak pernah disimpan polos).
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn('[db] ADMIN_USERNAME/ADMIN_PASSWORD belum diatur di .env. Buat salinan .env.example menjadi .env lalu isi nilainya.');
  } else {
    const nama = process.env.ADMIN_NAMA || 'Administrator Laboratorium';
    const ada = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
    if (ada) {
      db.prepare('UPDATE admins SET password_hash = ?, nama = ? WHERE id = ?').run(hashPassword(password), nama, ada.id);
    } else {
      db.prepare('INSERT INTO admins (username, password_hash, nama) VALUES (?, ?, ?)').run(username, hashPassword(password), nama);
    }
  }

  bersihkanSesiKedaluwarsa();
}

export function bersihkanSesiKedaluwarsa() {
  db.prepare(`DELETE FROM sesi_admin WHERE expires_at <= datetime('now')`).run();
}

/** Baca seluruh pengaturan sebagai objek kunci–nilai. */
export function bacaPengaturan() {
  const baris = db.prepare('SELECT kunci, nilai FROM pengaturan').all();
  const hasil = {};
  for (const b of baris) hasil[b.kunci] = b.nilai;
  return hasil;
}

/** Perbarui pengaturan berdasarkan objek kunci–nilai. */
export function simpanPengaturan(obj) {
  const stmt = db.prepare(`
    INSERT INTO pengaturan (kunci, nilai, diubah_pada) VALUES (?, ?, datetime('now'))
    ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada
  `);
  for (const [kunci, nilai] of Object.entries(obj)) stmt.run(kunci, String(nilai));
}

/** Cek apakah ada jadwal peminjaman aktif (disetujui) yang bertabrakan. */
export function adaBentrokan(laboratoriumId, tanggal, jamMulai, jamSelesai, kecualiPeminjamanId = null) {
  const baris = kecualiPeminjamanId
    ? db.prepare(`
        SELECT id, nomor_pengajuan FROM peminjaman
        WHERE laboratorium_id = ? AND tanggal = ?
          AND status = 'disetujui'
          AND id != ?
          AND jam_mulai < ? AND jam_selesai > ?
        LIMIT 1
      `).get(laboratoriumId, tanggal, kecualiPeminjamanId, jamSelesai, jamMulai)
    : db.prepare(`
        SELECT id, nomor_pengajuan FROM peminjaman
        WHERE laboratorium_id = ? AND tanggal = ?
          AND status = 'disetujui'
          AND jam_mulai < ? AND jam_selesai > ?
        LIMIT 1
      `).get(laboratoriumId, tanggal, jamSelesai, jamMulai);
  return baris || null;
}

/** Cek apakah laboratorium berada dalam jadwal pemeliharaan pada tanggal tertentu. */
export function dalamPemeliharaan(laboratoriumId, tanggal) {
  return db.prepare(`
    SELECT id, keterangan FROM pemeliharaan_laboratorium
    WHERE laboratorium_id = ? AND tanggal_mulai <= ? AND tanggal_selesai >= ?
    LIMIT 1
  `).get(laboratoriumId, tanggal, tanggal) || null;
}

/** Catat perubahan status pada tabel riwayat_status. */
export function catatRiwayat(peminjamanId, statusLama, statusBaru, keterangan, diubahOleh) {
  db.prepare(`
    INSERT INTO riwayat_status (peminjaman_id, status_lama, status_baru, keterangan, diubah_oleh)
    VALUES (?, ?, ?, ?, ?)
  `).run(peminjamanId, statusLama, statusBaru, keterangan || '', diubahOleh || 'sistem');
}
