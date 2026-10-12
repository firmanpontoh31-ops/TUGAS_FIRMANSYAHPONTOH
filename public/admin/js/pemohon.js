/* Manajemen data pemohon: daftar terhimpun + pencarian nama/NIM. */

async function muatTabel() {
  const wadah = document.getElementById('tabel-pemohon');
  tampilkanMemuat(wadah);
  const q = document.getElementById('f-q').value.trim();
  const params = q ? `?q=${encodeURIComponent(q)}` : '';

  const { data } = await apiAdmin(`/api/admin/pemohon${params}`);
  if (!data.success) { tampilkanKosong(wadah, data.pesan || 'Gagal memuat.', '⚠️'); return; }
  if (!data.data.length) { tampilkanKosong(wadah, q ? 'Tidak ada pemohon yang cocok.' : 'Belum ada data pemohon.', '👥'); return; }

  let html = '<div class="bungkus-tabel" style="border:0;border-radius:0;box-shadow:none"><table><thead><tr>' +
    '<th>Nama</th><th>NIM / Identitas</th><th>Program Studi</th><th>WhatsApp</th><th>Jumlah Pengajuan</th><th>Pengajuan Terakhir</th>' +
    '</tr></thead><tbody>';
  for (const p of data.data) {
    html += `<tr>
      <td><strong>${esc(p.nama)}</strong></td>
      <td>${esc(p.nim)}</td>
      <td>${esc(p.program_studi || '-')}</td>
      <td>${esc(p.whatsapp || '-')}</td>
      <td>${p.jumlah_pengajuan}</td>
      <td>${esc(p.pengajuan_terakhir || '-')}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  wadah.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await initAdmin('Manajemen Data Pemohon');
  if (!admin) return;
  await muatTabel();
  let t;
  document.getElementById('f-q').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(muatTabel, 350);
  });
});
