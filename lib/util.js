/** Utilitas umum: respons JSON, parsing cookie, validasi, format. */
import crypto from 'node:crypto';

export function kirimJson(res, statusCode, data) {
  res.status(statusCode).json(data);
}

export function kirimError(res, statusCode, pesan, detail) {
  const body = { success: false, pesan };
  if (detail !== undefined) body.detail = detail;
  res.status(statusCode).json(body);
}

/** Parsing header Cookie secara sederhana tanpa dependensi. */
export function parseCookies(req) {
  const header = req.headers.cookie;
  const hasil = {};
  if (!header) return hasil;
  for (const pasangan of header.split(';')) {
    const idx = pasangan.indexOf('=');
    if (idx === -1) continue;
    const kunci = pasangan.slice(0, idx).trim();
    const nilai = pasangan.slice(idx + 1).trim();
    if (kunci) hasil[kunci] = decodeURIComponent(nilai);
  }
  return hasil;
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_WAKTU = /^([01]\d|2[0-3]):[0-5]\d$/;
const POLA_NIM = /^[A-Za-z0-9._-]{4,25}$/;
const POLA_WHATSAPP = /^\+?[0-9\s-]{9,18}$/;

export function adalahTanggalValid(tanggal) {
  const s = String(tanggal || '');
  if (!POLA_TANGGAL.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  // Bandingkan dalam waktu lokal, bukan UTC (toISOString bisa mundur satu hari).
  const p = (n) => String(n).padStart(2, '0');
  const lokal = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return lokal === s;
}

export function adalahWaktuValid(waktu) {
  return POLA_WAKTU.test(String(waktu || ''));
}

export function adalahNimValid(nim) {
  return POLA_NIM.test(String(nim || ''));
}

export function adalahWhatsappValid(nomor) {
  return POLA_WHATSAPP.test(String(nomor || ''));
}

/** Menit sejak awal hari dari string "HH:MM". */
export function keMenit(waktu) {
  const [h, m] = String(waktu).split(':').map(Number);
  return h * 60 + m;
}

/** Tanggal hari ini (YYYY-MM-DD) sesuai zona waktu server. */
export function hariIni() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sekarangIso() {
  return new Date().toISOString();
}

/** Membuat nomor pengajuan unik, contoh: PIN-20261012-7K3A */
export function buatNomorPengajuan() {
  const tgl = hariIni().replaceAll('-', '');
  const acak = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PIN-${tgl}-${acak}`;
}

/** Escape nilai untuk ekspor CSV (quote standar RFC 4180). */
export function csvEscape(nilai) {
  const s = nilai === null || nilai === undefined ? '' : String(nilai);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function buatBarisCsv(kolom, baris) {
  const kepala = kolom.map(csvEscape).join(',');
  const isi = baris.map((b) => kolom.map((k) => csvEscape(b[k])).join(','));
  return [kepala, ...isi].join('\r\n');
}

/** Normalisasi teks pencarian untuk LIKE (hindari karakter khusus). */
export function keLike(q) {
  return `%${String(q || '').trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}
