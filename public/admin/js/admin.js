/* Utilitas dashboard admin: proteksi sesi, sidebar, API, modal, notifikasi, tabel. */

/** Panggil API admin; otomatis alihkan ke login bila sesi berakhir (401). */
async function apiAdmin(url, opsi = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opsi.headers || {}) },
    ...opsi,
  });
  let data = {};
  try { data = await res.json(); } catch { data = { success: false, pesan: 'Respons server tidak terbaca.' }; }
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    throw new Error('Sesi berakhir');
  }
  return { status: res.status, data };
}

function esc(teks) {
  const div = document.createElement('div');
  div.textContent = teks ?? '';
  return div.innerHTML;
}

/** Cek sesi admin; bila tidak valid, pindahkan ke halaman login. */
async function pastikanAdmin() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { window.location.href = '/admin/login.html'; return null; }
    const data = await res.json();
    if (!data.success) { window.location.href = '/admin/login.html'; return null; }
    return data.admin;
  } catch {
    window.location.href = '/admin/login.html';
    return null;
  }
}

/** Isi nama admin pada sidebar. */
function tampilkanNamaAdmin(admin) {
  document.querySelectorAll('.nama-admin').forEach((el) => { el.textContent = admin.nama || admin.username; });
}

/** Tandai menu sidebar aktif sesuai berkas halaman. */
function tandaiMenuAktif() {
  const berkas = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar nav a').forEach((a) => {
    const target = a.getAttribute('href').split('/').pop();
    if (target === berkas) { a.classList.toggle('aktif', true); a.setAttribute('aria-current', 'page'); }
  });
}

/** Pasang toggle sidebar mobile + tombol keluar. */
function pasangUmum() {
  const tombolMenu = document.querySelector('.tombol-menu');
  if (tombolMenu) {
    tombolMenu.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('terbuka');
    });
  }
  document.addEventListener('click', (e) => {
    const sb = document.querySelector('.sidebar');
    if (sb && sb.classList.contains('terbuka') && !e.target.closest('.sidebar') && !e.target.closest('.tombol-menu')) {
      sb.classList.remove('terbuka');
    }
  });
  const tombolKeluar = document.getElementById('btn-keluar');
  if (tombolKeluar) {
    tombolKeluar.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      window.location.href = '/admin/login.html';
    });
  }
}

/* Notifikasi toast */
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

/* Modal */
function bukaModal(id) { document.getElementById(id)?.classList.add('terbuka'); }
function tutupModal(id) { document.getElementById(id)?.classList.remove('terbuka'); }
document.addEventListener('click', (e) => {
  if (e.target.classList?.contains('modal-latar')) e.target.classList.remove('terbuka');
  const t = e.target.closest('[data-tutup]');
  if (t) tutupModal(t.getAttribute('data-tutup'));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-latar.terbuka').forEach((m) => m.classList.remove('terbuka'));
});

/** Konfirmasi hapus/aksi berisiko. */
function konfirmasi(judul, pesan, labelYa = 'Ya, Lanjutkan') {
  return new Promise((resolve) => {
    let wadah = document.getElementById('modal-konfirmasi');
    if (!wadah) {
      wadah = document.createElement('div');
      wadah.id = 'modal-konfirmasi';
      wadah.className = 'modal-latar';
      wadah.innerHTML = `<div class="modal modal-kecil">
        <h3 id="konf-judul"></h3><p id="pesan-konf"></p>
        <div class="modal-tombol">
          <button class="btn btn-garis" data-tutup="modal-konfirmasi">Kembali</button>
          <button class="btn btn-bahaya" id="konf-ya"></button>
        </div></div>`;
      document.body.appendChild(wadah);
    }
    wadah.querySelector('#konf-judul').textContent = judul;
    wadah.querySelector('#pesan-konf').textContent = pesan;
    const tombolYa = wadah.querySelector('#konf-ya');
    tombolYa.textContent = labelYa;
    const handler = () => { tombolYa.removeEventListener('click', handler); tutupModal('modal-konfirmasi'); resolve(true); };
    tombolYa.addEventListener('click', handler);
    wadah.addEventListener('click', function batal(e) {
      if (e.target === wadah) { wadah.removeEventListener('click', batal); resolve(false); }
    });
    bukaModal('modal-konfirmasi');
  });
}

/* Format & lencana */
function tanggalIndo(tanggal) {
  if (!tanggal) return '-';
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const [y, m, d] = tanggal.split('-').map(Number);
  if (!y || !m || !d) return tanggal;
  return `${d} ${bulan[m - 1]} ${y}`;
}
const LABEL_STATUS = {
  menunggu: 'Menunggu Persetujuan', disetujui: 'Disetujui', ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan', selesai: 'Selesai',
};
function badgeStatus(status, label) {
  return `<span class="badge badge-${esc(status)}">${esc(label || LABEL_STATUS[status] || status)}</span>`;
}

/* Indikator */
function tampilkanMemuat(el) { el.innerHTML = '<div class="memuat"><div class="spinner"></div>Memuat data…</div>'; }
function tampilkanKosong(el, pesan, ikon = '📭') {
  el.innerHTML = `<div class="kosong"><span class="ikon">${ikon}</span>${esc(pesan)}</div>`;
}
async function denganTombolNonaktif(tombol, fn) {
  const teks = tombol.textContent;
  tombol.disabled = true; tombol.textContent = 'Memproses…';
  try { return await fn(); } finally { tombol.disabled = false; tombol.textContent = teks; }
}

/** Inisialisasi umum setiap halaman admin (kecuali login). */
async function initAdmin(judul) {
  const admin = await pastikanAdmin();
  if (!admin) return null;
  tampilkanNamaAdmin(admin);
  tandaiMenuAktif();
  pasangUmum();
  if (judul) document.getElementById('judul-halaman').textContent = judul;
  document.getElementById('tahun-berjalan').textContent = new Date().getFullYear();
  return admin;
}
