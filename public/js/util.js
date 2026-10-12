/* Utilitas bersama halaman pengguna: fetch API, notifikasi, modal, format. */

/** Panggil API dan kembalikan hasil terurai. */
async function api(url, opsi = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opsi.headers || {}) },
    ...opsi,
  });
  let data = {};
  try { data = await res.json(); } catch { data = { success: false, pesan: 'Respons server tidak terbaca.' }; }
  return { status: res.status, data };
}

function esc(teks) {
  const div = document.createElement('div');
  div.textContent = teks ?? '';
  return div.innerHTML;
}

/** Tampilkan notifikasi sementara di pojok kanan bawah. */
function notifikasi(pesan, jenis = 'info') {
  let area = document.getElementById('notifikasi-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'notifikasi-area';
    document.body.appendChild(area);
  }
  const el = document.createElement('div');
  el.className = `notifikasi ${jenis}`;
  el.setAttribute('role', 'status');
  el.textContent = pesan;
  area.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/** Buka & tutup modal sederhana. */
function bukaModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('terbuka');
}
function tutupModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('terbuka');
}
// Klik latar menutup modal; tombol [data-tutup] juga menutup.
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-latar')) e.target.classList.remove('terbuka');
  const tombol = e.target.closest('[data-tutup]');
  if (tombol) tutupModal(tombol.getAttribute('data-tutup'));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-latar.terbuka').forEach((m) => m.classList.remove('terbuka'));
  }
});

/** Format tanggal YYYY-MM-DD menjadi "12 Oktober 2026". */
function tanggalIndo(tanggal) {
  if (!tanggal) return '-';
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const [y, m, d] = tanggal.split('-').map(Number);
  if (!y || !m || !d) return tanggal;
  return `${d} ${bulan[m - 1]} ${y}`;
}

/** Lencana status HTML. */
function badgeStatus(status, label) {
  return `<span class="badge badge-${esc(status)}">${esc(label || status)}</span>`;
}

/** Indikator pemuatan. */
function tampilkanMemuat(el) {
  el.innerHTML = '<div class="memuat"><div class="spinner"></div>Memuat data…</div>';
}
/** Tampilan kosong. */
function tampilkanKosong(el, pesan, ikon = '📭') {
  el.innerHTML = `<div class="kosong"><span class="ikon">${ikon}</span>${esc(pesan)}</div>`;
}

/** Nonaktifkan tombol sementara agar tidak diklik ganda. */
async function denganTombolNonaktif(tombol, fn) {
  const teksAsli = tombol.textContent;
  tombol.disabled = true;
  tombol.textContent = 'Memproses…';
  try {
    return await fn();
  } finally {
    tombol.disabled = false;
    tombol.textContent = teksAsli;
  }
}

/* Navigasi mobile */
const tombolNav = document.querySelector('.nav-toggle');
if (tombolNav) {
  tombolNav.addEventListener('click', () => {
    const nav = document.querySelector('.site-nav');
    const buka = nav.classList.toggle('terbuka');
    tombolNav.setAttribute('aria-expanded', String(buka));
  });
}
