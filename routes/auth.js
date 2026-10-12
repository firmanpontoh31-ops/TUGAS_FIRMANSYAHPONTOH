/** Rute autentikasi admin: login, logout, sesi. */
import { Router } from 'express';
import { db, bersihkanSesiKedaluwarsa } from '../db/database.js';
import { verifyPassword, createSessionToken, LoginRateLimiter } from '../lib/security.js';
import { kirimError, parseCookies } from '../lib/util.js';

const router = Router();
const limiter = new LoginRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

// Bersihkan entri rate limiter kedaluwarsa tiap 5 menit.
setInterval(() => limiter.cleanup(), 5 * 60 * 1000).unref();

const MASA_SESI_DETIK = 8 * 60 * 60; // 8 jam

/**
 * POST /api/auth/login — masuk sebagai admin.
 * Menerapkan pembatas percobaan berdasarkan gabungan IP dan nama pengguna.
 */
router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return kirimError(res, 400, 'Nama pengguna dan kata sandi wajib diisi.');
  }

  const kunci = `${req.ip}|${username.toLowerCase()}`;
  const blokir = limiter.check(kunci);
  if (blokir) {
    res.set('Retry-After', String(blokir.retryAfterSec));
    return kirimError(res, 429, `Terlalu banyak percobaan masuk. Coba lagi dalam ${blokir.retryAfterSec} detik.`);
  }

  const admin = db.prepare('SELECT id, username, password_hash, nama FROM admins WHERE username = ?').get(username);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    limiter.recordFailure(kunci);
    return kirimError(res, 401, 'Nama pengguna atau kata sandi salah.');
  }

  limiter.reset(kunci);
  bersihkanSesiKedaluwarsa();

  const token = createSessionToken();
  db.prepare(`
    INSERT INTO sesi_admin (token, admin_id, expires_at)
    VALUES (?, ?, datetime('now', ?))
  `).run(token, admin.id, `+${MASA_SESI_DETIK} seconds`);

  res.cookie?.('sid_admin', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MASA_SESI_DETIK * 1000,
  });
  // Fallback bila res.cookie tidak tersedia: set header manual.
  if (!res.cookie) {
    res.set('Set-Cookie', `sid_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MASA_SESI_DETIK}`);
  }

  res.json({ success: true, pesan: 'Berhasil masuk.', admin: { username: admin.username, nama: admin.nama } });
});

/** GET /api/auth/me — info admin sesaat (untuk proteksi halaman). */
router.get('/me', (req, res) => {
  const token = parseCookies(req).sid_admin;
  if (!token) return kirimError(res, 401, 'Tidak ada sesi aktif.');
  const baris = db.prepare(`
    SELECT a.username, a.nama FROM sesi_admin s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);
  if (!baris) return kirimError(res, 401, 'Sesi kedaluwarsa.');
  res.json({ success: true, admin: { username: baris.username, nama: baris.nama } });
});

/** POST /api/auth/logout — akhiri sesi. */
router.post('/logout', (req, res) => {
  // Token diambil langsung dari cookie; rute ini tidak melewati middleware wajibAdmin.
  const token = parseCookies(req).sid_admin;
  if (token) db.prepare('DELETE FROM sesi_admin WHERE token = ?').run(token);
  if (res.clearCookie) res.clearCookie('sid_admin', { path: '/' });
  else res.set('Set-Cookie', 'sid_admin=; HttpOnly; Path=/; Max-Age=0');
  res.json({ success: true, pesan: 'Berhasil keluar.' });
});

export default router;
