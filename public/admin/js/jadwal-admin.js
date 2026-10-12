/* Manajemen jadwal admin: tabel jadwal per tanggal + status operasional lab. */

function tanggalHariIni() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let SEMUA_LAB = [];

async function muatFilterLab() {
  const { data } = await apiAdmin('/api/admin/laboratorium');
  if (!data.success) return;
  SEMUA_LAB = data.data;
  const select = document.getElementById('f-lab');
  for (const lab of data.data) {
    const op = document.createElement('option');
    op.value = lab.id; op.textContent = lab.nama;
    select.appendChild(op);
  }
  renderStatusLab();
}

function renderStatusLab() {
  const wadah = document.getElementById('status-lab');
  if (!SEMUA_LAB.length) { tampilkanKosong(wadah, 'Belum ada laboratorium.', '🖥️'); return; }
  const badge = { aktif: 'tersedia', nonaktif: 'nonaktif', pemeliharaan: 'pemeliharaan' };
  const label = { aktif: 'Aktif', nonaktif: 'Tidak Aktif', pemeliharaan: 'Dalam Pemeliharaan' };
  let html = '<div class="bungkus-tabel" style="border:0;border-radius:0;box-shadow:none"><table><thead><tr>' +
    '<th>Laboratorium</th><th>Kapasitas</th><th>Status Operasional</th></tr></thead><tbody>';
  for (const l of SEMUA_LAB) {
    html += `<tr><td>${esc(l.nama)}</td><td>${l.kapasitas}</td>
      <td><span class="badge badge-${badge[l.status_operasional] || 'nonaktif'}">${label[l.status_operasional] || esc(l.status_operasional)}</span></td></tr>`;
  }
  html += '</tbody></table></div>';
  wadah.innerHTML = html;
}

async function muatJadwal() {
  const wadah = document.getElementById('tabel-jadwal');
  tampilkanMemuat(wadah);
  const tanggal = document.getElementById('f-tanggal').value || tanggalHariIni();
  const labId = document.getElementById('f-lab').value;
  const params = new URLSearchParams({ tanggal });
  if (labId) params.set('laboratorium_id', labId);

  const { data } = await apiAdmin(`/api/admin/jadwal?${params.toString()}`);
  if (!data.success) { tampilkanKosong(wadah, data.pesan || 'Gagal memuat.', '⚠️'); return; }

  let baris = data.data || [];
  if (labId) baris = baris.filter((b) => String(b.laboratorium_id) === String(labId));

  if (!baris.length && !(data.pemeliharaan || []).length) {
    tampilkanKosong(wadah, `Tidak ada jadwal pada ${tanggalIndo(tanggal)}.`, '🗓️');
    return;
  }

  let html = '<div class="bungkus-tabel" style="border:0;border-radius:0;box-shadow:none"><table><thead><tr>' +
    '<th>Jam</th><th>Laboratorium</th><th>Pemohon</th><th>Nomor</th><th>Tujuan</th><th>Status</th></tr></thead><tbody>';
  for (const p of data.pemeliharaan || []) {
    if (labId && String(p.laboratorium_id) !== String(labId)) continue;
    html += `<tr><td>Pemeliharaan</td><td>${esc(p.laboratorium)}</td>
      <td colspan="3">${esc(p.keterangan || 'Laboratorium dalam pemeliharaan')}</td>
      <td><span class="badge badge-pemeliharaan">Tidak Tersedia</span></td></tr>`;
  }
  for (const j of baris) {
    html += `<tr>
      <td>${esc(j.jam_mulai)}–${esc(j.jam_selesai)}</td>
      <td>${esc(j.laboratorium)}</td>
      <td>${esc(j.pemohon)}<br><span style="color:var(--abu-500);font-size:.8rem">${esc(j.nim)}</span></td>
      <td>${esc(j.nomor_pengajuan)}</td>
      <td>${esc(j.tujuan)}</td>
      <td>${badgeStatus(j.status, j.label_status)}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  wadah.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await initAdmin('Manajemen Jadwal Laboratorium');
  if (!admin) return;
  const tgl = document.getElementById('f-tanggal');
  tgl.value = tanggalHariIni();
  await muatFilterLab();
  await muatJadwal();
  document.getElementById('btn-tampilkan').addEventListener('click', muatJadwal);
  document.getElementById('f-lab').addEventListener('change', muatJadwal);
  tgl.addEventListener('change', muatJadwal);
});
