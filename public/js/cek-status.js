/* Halaman cek status: menampilkan detail pengajuan + riwayat perubahan status. */

// Peta label status (lencana timeline) — konsisten dengan backend.
const LABEL_STATUS = {
  menunggu: 'Menunggu Persetujuan', disetujui: 'Disetujui', ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan', selesai: 'Selesai', pengajuan: 'Pengajuan Diterima',
};

document.getElementById('form-cek').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const nomor = document.getElementById('nomor_pengajuan').value.trim();
  const nim = document.getElementById('nim').value.trim();
  const wadah = document.getElementById('hasil-cek');

  if (!nomor || !nim) {
    tampilkanKosong(wadah, 'Nomor pengajuan dan NIM wajib diisi.', '⚠️');
    return;
  }

  const tombol = document.getElementById('btn-cek');
  await denganTombolNonaktif(tombol, async () => {
    tampilkanMemuat(wadah);
    const { data } = await api('/api/peminjaman/cek-status', { method: 'POST', body: JSON.stringify({ nomor_pengajuan: nomor, nim }) });
    if (!data.success || !data.data) {
      tampilkanKosong(wadah, data.pesan || 'Pengajuan tidak ditemukan.', '🔍');
      return;
    }
    renderHasil(wadah, data.data);
  });
});

function renderHasil(wadah, d) {
  let alasan = '';
  if (d.status === 'ditolak' && d.alasan_penolakan) {
    alasan = `<div class="peringatan" style="background:var(--merah-bg);border-color:#fecaca;color:var(--merah)">
      <strong>Alasan penolakan:</strong> ${esc(d.alasan_penolakan)}</div>`;
  }

  let riwayat = '';
  if (Array.isArray(d.riwayat) && d.riwayat.length > 0) {
    riwayat = `<h3 style="margin-top:24px">Riwayat Status</h3><ul class="timeline">` +
      d.riwayat.map((r) => `
        <li>
          <div>${badgeStatus(r.status_baru, LABEL_STATUS[r.status_baru] || r.status_baru)}</div>
          <div style="margin-top:4px">${esc(r.keterangan || '')}</div>
          <div class="waktu">Oleh: ${esc(r.diubah_oleh)} · ${esc(r.created_at)}</div>
        </li>`).join('') +
      `</ul>`;
  }

  wadah.innerHTML = `
    <div class="bungkus-kartu">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h2 style="margin:0">Detail Pengajuan</h2>
        ${badgeStatus(d.status, d.label_status)}
      </div>
      <p style="color:var(--abu-500);margin:8px 0 16px">Nomor: <strong>${esc(d.nomor_pengajuan)}</strong></p>
      ${alasan}
      <dl class="detail-dl">
        <dt>Pemohon</dt><dd>${esc(d.pemohon.nama)} (${esc(d.pemohon.nim)})</dd>
        <dt>Program Studi</dt><dd>${esc(d.pemohon.program_studi || '-')}</dd>
        <dt>Laboratorium</dt><dd>${esc(d.laboratorium)}${d.lokasi ? `<br><span style="color:var(--abu-500);font-size:.88rem">${esc(d.lokasi)}</span>` : ''}</dd>
        <dt>Tanggal</dt><dd>${tanggalIndo(d.tanggal)}</dd>
        <dt>Waktu</dt><dd>${esc(d.jam_mulai)} – ${esc(d.jam_selesai)} WIB</dd>
        <dt>Tujuan</dt><dd>${esc(d.tujuan)}</dd>
        <dt>Jumlah Peserta</dt><dd>${d.jumlah_peserta} orang</dd>
        <dt>Catatan</dt><dd>${esc(d.catatan || '-')}</dd>
        <dt>Diajukan pada</dt><dd>${esc(d.diajukan_pada)}</dd>
      </dl>
      ${riwayat}
    </div>`;
}
