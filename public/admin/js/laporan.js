/* Laporan & rekapitulasi: dihitung dari basis data sesuai periode. */

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function labelBulan(kode) {
  const [y, m] = String(kode).split('-').map(Number);
  return m ? `${NAMA_BULAN[m - 1]} ${y}` : kode;
}

function muatPeriode() {
  const dari = document.getElementById('f-dari').value;
  const sampai = document.getElementById('f-sampai').value;
  const params = new URLSearchParams();
  if (dari) params.set('dari', dari);
  if (sampai) params.set('sampai', sampai);
  return params.toString();
}

async function muatLaporan() {
  const qs = muatPeriode();
  const wadahStatus = document.getElementById('rekap-status');
  const wadahLab = document.getElementById('rekap-lab');
  const wadahBulan = document.getElementById('rekap-bulan');
  const wadahTahun = document.getElementById('rekap-tahun');
  [wadahStatus, wadahLab, wadahBulan, wadahTahun].forEach(tampilkanMemuat);

  const { data } = await apiAdmin(`/api/admin/laporan${qs ? `?${qs}` : ''}`);
  if (!data.success) {
    [wadahStatus, wadahLab, wadahBulan, wadahTahun].forEach((w) => tampilkanKosong(w, data.pesan || 'Gagal memuat laporan.', '⚠️'));
    return;
  }

  // Kartu statistik periode.
  const periodeTeks = data.periode.dari || data.periode.sampai
    ? `${data.periode.dari ? tanggalIndo(data.periode.dari) : 'Awal'} – ${data.periode.sampai ? tanggalIndo(data.periode.sampai) : 'Sekarang'}`
    : 'Seluruh periode';
  document.getElementById('stat-periode').innerHTML =
    `<div class="stat-kartu"><div class="angka">${data.total}</div><div class="label">Total Pengajuan<br><span style="font-weight:400">${esc(periodeTeks)}</span></div></div>` +
    data.per_status.filter((s) => s.jumlah > 0).map((s) =>
      `<div class="stat-kartu stat-${s.status}"><div class="angka">${s.jumlah}</div><div class="label">${esc(s.label)}</div></div>`).join('');

  // Rekap status.
  wadahStatus.innerHTML = data.per_status.map((s) => `
    <div class="ringkas-baris"><span>${esc(s.label)}</span><strong>${s.jumlah}</strong></div>`).join('');

  // Laboratorium (bar).
  if (!data.per_laboratorium.length) tampilkanKosong(wadahLab, 'Belum ada data.', '🖥️');
  else {
    const maks = Math.max(...data.per_laboratorium.map((l) => l.jumlah), 1);
    wadahLab.innerHTML = data.per_laboratorium.map((l) => `
      <div class="bar-laporan">
        <span class="nama" title="${esc(l.laboratorium)}">${esc(l.laboratorium)}</span>
        <span class="batang"><span class="isi" style="width:${Math.round((l.jumlah / maks) * 100)}%"></span></span>
        <span class="nilai">${l.jumlah}</span>
      </div>`).join('');
  }

  // Rekap bulan.
  if (!data.per_bulan.length) tampilkanKosong(wadahBulan, 'Belum ada data.', '📅');
  else wadahBulan.innerHTML = '<table><thead><tr><th>Bulan</th><th>Jumlah Peminjaman</th></tr></thead><tbody>' +
    data.per_bulan.map((b) => `<tr><td>${esc(labelBulan(b.bulan))}</td><td>${b.jumlah}</td></tr>`).join('') + '</tbody></table>';

  // Rekap tahun.
  if (!data.per_tahun.length) tampilkanKosong(wadahTahun, 'Belum ada data.', '📅');
  else wadahTahun.innerHTML = '<table><thead><tr><th>Tahun</th><th>Jumlah Peminjaman</th></tr></thead><tbody>' +
    data.per_tahun.map((t) => `<tr><td>${esc(t.tahun)}</td><td>${t.jumlah}</td></tr>`).join('') + '</tbody></table>';

  // Perbarui tautan ekspor CSV agar mengikuti periode yang sama.
  document.getElementById('btn-csv').href = `/api/admin/laporan/csv${qs ? `?${qs}` : ''}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await initAdmin('Laporan dan Rekapitulasi');
  if (!admin) return;
  await muatLaporan();
  document.getElementById('btn-tampilkan').addEventListener('click', muatLaporan);
  document.getElementById('btn-semua').addEventListener('click', () => {
    document.getElementById('f-dari').value = '';
    document.getElementById('f-sampai').value = '';
    muatLaporan();
  });
});
