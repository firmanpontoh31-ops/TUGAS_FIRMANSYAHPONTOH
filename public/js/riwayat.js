/* Halaman riwayat: menampilkan pengajuan milik satu NIM + aksi pembatalan. */

let NIM_AKTIF = '';
let TARGET_BATAL = null;

document.getElementById('form-riwayat').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const nim = document.getElementById('nim').value.trim();
  if (!nim) return;
  NIM_AKTIF = nim;
  const tombol = document.getElementById('btn-riwayat');
  await denganTombolNonaktif(tombol, () => muatRiwayat(nim));
});

async function muatRiwayat(nim) {
  const wadah = document.getElementById('hasil-riwayat');
  tampilkanMemuat(wadah);
  const { data } = await api('/api/peminjaman/riwayat', { method: 'POST', body: JSON.stringify({ nim }) });
  if (!data.success) {
    tampilkanKosong(wadah, data.pesan || 'Gagal memuat riwayat.', '⚠️');
    return;
  }
  if (!Array.isArray(data.data) || data.data.length === 0) {
    tampilkanKosong(wadah, 'Tidak ada pengajuan peminjaman untuk NIM ini.', '📭');
    return;
  }

  let html = `<p style="color:var(--abu-500)">Menampilkan ${data.data.length} pengajuan atas nama <strong>${esc(data.pemohon || '')}</strong>.</p>`;
  html += '<div class="bungkus-tabel"><table><thead><tr>' +
    '<th>Nomor</th><th>Tanggal &amp; Jam</th><th>Laboratorium</th><th>Tujuan</th><th>Status</th><th>Aksi</th>' +
    '</tr></thead><tbody>';

  for (const r of data.data) {
    const bisaBatal = r.status === 'menunggu';
    html += `<tr>
      <td><strong>${esc(r.nomor_pengajuan)}</strong></td>
      <td>${tanggalIndo(r.tanggal)}<br><span style="color:var(--abu-500);font-size:.85rem">${esc(r.jam_mulai)}–${esc(r.jam_selesai)}</span></td>
      <td>${esc(r.laboratorium)}</td>
      <td>${esc(r.tujuan)}${r.alasan_penolakan ? `<br><span style="color:var(--merah);font-size:.85rem">Alasan: ${esc(r.alasan_penolakan)}</span>` : ''}</td>
      <td>${badgeStatus(r.status, r.label_status)}</td>
      <td>${bisaBatal ? `<button class="btn btn-bahaya btn-kecil" data-batal="${esc(r.nomor_pengajuan)}">Batalkan</button>` : '<span style="color:var(--abu-500);font-size:.85rem">—</span>'}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  html += '<p class="hint" style="margin-top:10px">Pengajuan yang sudah disetujui hanya dapat dibatalkan sesuai ketentuan pengelola laboratorium. Silakan hubungi kontak pengelola bila perlu pembatalan setelah persetujuan.</p>';
  wadah.innerHTML = html;

  wadah.querySelectorAll('[data-batal]').forEach((t) => {
    t.addEventListener('click', () => {
      TARGET_BATAL = t.getAttribute('data-batal');
      document.getElementById('batal-nomor').textContent = TARGET_BATAL;
      bukaModal('modal-batal');
    });
  });
}

document.getElementById('btn-konfirmasi-batal').addEventListener('click', async () => {
  if (!TARGET_BATAL) return;
  const tombol = document.getElementById('btn-konfirmasi-batal');
  await denganTombolNonaktif(tombol, async () => {
    const { data } = await api('/api/peminjaman/batal', {
      method: 'POST',
      body: JSON.stringify({ nomor_pengajuan: TARGET_BATAL, nim: NIM_AKTIF }),
    });
    tutupModal('modal-batal');
    if (data.success) {
      notifikasi('Pengajuan berhasil dibatalkan.', 'success');
      await muatRiwayat(NIM_AKTIF);
    } else {
      notifikasi(data.pesan || 'Pengajuan gagal dibatalkan.', 'error');
    }
    TARGET_BATAL = null;
  });
});
