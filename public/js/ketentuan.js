/* Halaman ketentuan: menampilkan prosedur, ketentuan umum, dan aturan penggunaan. */

async function muatKetentuan() {
  const wadah = document.getElementById('isi-ketentuan');
  tampilkanMemuat(wadah);
  const { data } = await api('/api/pengaturan');
  if (!data.success) {
    tampilkanKosong(wadah, 'Gagal memuat ketentuan.', '⚠️');
    return;
  }
  const k = data.ketentuan || {};
  const bagian = [
    ['Prosedur Pengajuan Peminjaman', k.prosedur],
    ['Ketentuan Umum', k.umum],
    ['Aturan Penggunaan Laboratorium', k.aturan],
  ].filter(([, isi]) => isi && isi.trim());

  if (bagian.length === 0) {
    tampilkanKosong(wadah, 'Ketentuan belum tersedia.', '📋');
    return;
  }

  wadah.innerHTML = bagian.map(([judul, isi]) => `
    <div class="bungkus-kartu ketentuan-blok">
      <h3>${esc(judul)}</h3>
      <div class="daftar-info">${esc(isi)}</div>
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded', muatKetentuan);
