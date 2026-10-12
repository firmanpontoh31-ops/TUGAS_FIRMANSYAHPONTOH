/* Pengaturan ketentuan & informasi: muat isi sekarang, simpan perubahan. */

const KOLOM = [
  'sistem_nama', 'sistem_deskripsi', 'sistem_institusi',
  'jam_mulai', 'jam_selesai',
  'ketentuan_prosedur', 'ketentuan_umum', 'ketentuan_aturan',
  'kontak_nama', 'kontak_jabatan', 'kontak_whatsapp', 'kontak_email', 'kontak_alamat', 'kontak_jam_layanan',
];

async function muatPengaturan() {
  const { data } = await apiAdmin('/api/admin/pengaturan');
  if (!data.success) { notifikasi(data.pesan || 'Gagal memuat pengaturan.', 'error'); return; }
  const p = data.data;
  for (const k of KOLOM) {
    const el = document.getElementById(k);
    if (el) el.value = p[k] || '';
  }
  const cek = document.getElementById('boleh_batalkan_disetujui');
  cek.checked = p.boleh_batalkan_disetujui === 'ya';
}

document.getElementById('form-pengaturan').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const body = {};
  for (const k of KOLOM) {
    const el = document.getElementById(k);
    if (el) body[k] = el.value.trim();
  }
  body.boleh_batalkan_disetujui = document.getElementById('boleh_batalkan_disetujui').checked ? 'ya' : 'tidak';

  const tombol = document.getElementById('btn-simpan');
  await denganTombolNonaktif(tombol, async () => {
    const { data } = await apiAdmin('/api/admin/pengaturan', { method: 'PUT', body: JSON.stringify(body) });
    if (data.success) notifikasi(data.pesan, 'success');
    else notifikasi(data.pesan || 'Gagal menyimpan.', 'error');
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await initAdmin('Ketentuan dan Informasi');
  if (!admin) return;
  await muatPengaturan();
});
