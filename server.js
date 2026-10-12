/** Entry point server: Express, statis, API, dan penanganan galat. */
import path from 'node:path';
import express from 'express';
import { loadEnv, ROOT_DIR } from './lib/env.js';
import { initDatabase } from './db/database.js';
import { wajibAdmin } from './middleware/authAdmin.js';
import authRouter from './routes/auth.js';
import publicApiRouter from './routes/publicApi.js';
import peminjamanRouter from './routes/peminjaman.js';
import adminRouter from './routes/admin.js';

// Muat .env sebelum inisialisasi basis data.
loadEnv();
initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Catat permintaan API ringkas (tanpa data sensitif).
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[akses] ${req.method} ${req.path}`);
  }
  next();
});

// API publik.
app.use('/api', publicApiRouter);
app.use('/api/peminjaman', peminjamanRouter);

// Autentikasi admin.
app.use('/api/auth', authRouter);

// Endpoint admin terlindungi sesi.
app.use('/api/admin', wajibAdmin, adminRouter);

// Statis: halaman pengguna dan dashboard admin.
app.use(express.static(path.join(ROOT_DIR, 'public')));

// Rute admin memerlukan sesi; halaman login tersedia tanpa sesi.
app.get('/admin', (req, res) => res.redirect('/admin/login.html'));

// Galat 404 untuk API.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, pesan: 'Endpoint tidak ditemukan.' });
});

// Penanganan galat umum (aman, tanpa membocorkan detail internal).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[galat]', err.message);
  if (res.headersSent) return;
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    pesan: status === 500 ? 'Terjadi kesalahan pada server. Silakan coba lagi.' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Dashboard admin: http://localhost:${PORT}/admin/login.html`);
});
