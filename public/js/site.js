/* JS global halaman pengguna: memuat info sistem, mengisi footer, menandai nav aktif. */

/** Tandai tautan navigasi yang sedang aktif berdasarkan berkas halaman saat ini. */
function tandaiNavAktif() {
  const berkas = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach((a) => {
    const target = a.getAttribute('href').split('/').pop();
    if (target === berkas) {
      a.classList.add('aktif');
      a.setAttribute('aria-current', 'page');
    }
  });
}

/** Muat pengaturan sistem lalu isi elemen global (brand, footer, kontak singkat). */
async function muatInfoSistem() {
  try {
    const { data } = await api('/api/pengaturan');
    if (!data.success) return;
    const s = data.sistem || {};
    const k = data.kontak || {};

    document.querySelectorAll('[data-nama-sistem]').forEach((el) => {
      el.textContent = s.nama || 'Sistem Peminjaman Lab';
    });
    document.title = `${document.title} — ${s.nama || 'Sistem Peminjaman Lab'}`;

    const fDesk = document.getElementById('footer-deskripsi');
    if (fDesk) fDesk.textContent = s.deskripsi || s.tagline || '';

    const fKontak = document.getElementById('footer-kontak');
    if (fKontak) {
      const bagian = [];
      if (k.nama) bagian.push(esc(k.nama));
      if (k.email) bagian.push(`<a href="mailto:${esc(k.email)}">${esc(k.email)}</a>`);
      if (k.jamLayanan) bagian.push(esc(k.jamLayanan));
      fKontak.innerHTML = bagian.join('<br>') || 'Informasi kontak belum tersedia.';
    }

    const inst = document.getElementById('footer-institusi');
    if (inst && s.institusi) inst.textContent = s.institusi;

    // Bagikan data ke halaman yang membutuhkannya (mis. jadwal, ajukan).
    window.__PENGATURAN = data;
    document.dispatchEvent(new CustomEvent('sistem:siap', { detail: data }));
  } catch {
    /* abaikan; tampilan statis tetap layak */
  }
}

document.addEventListener('DOMContentLoaded', () => {
  tandaiNavAktif();
  muatInfoSistem();
  const th = document.getElementById('tahun-berjalan');
  if (th) th.textContent = new Date().getFullYear();
});
