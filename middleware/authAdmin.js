/** Middleware pemeriksaan sesi admin. */
import { db } from '../db/database.js';
import { parseCookies } from '../lib/util.js';

/**
 * Memastikan permintaan membawa sesi admin yang valid.
 * Semua endpoint di bawah /api/admin wajib melewati middleware ini
 * kecuali endpoint login.
 */
export function wajibAdmin(req, res, next) {
  const token = parseCookies(req).sid_admin;
  if (!token) {
    return res.status(401).json({ success: false, pesan: 'Sesi admin tidak ditemukan. Silakan masuk kembali.' });
  }
  const baris = db.prepare(`
    SELECT a.id, a.username, a.nama, s.expires_at
    FROM sesi_admin s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);
  if (!baris) {
    return res.status(401).json({ success: false, pesan: 'Sesi admin kedaluwarsa atau tidak valid. Silakan masuk kembali.' });
  }
  req.admin = { id: baris.id, username: baris.username, nama: baris.nama, token };
  next();
}
