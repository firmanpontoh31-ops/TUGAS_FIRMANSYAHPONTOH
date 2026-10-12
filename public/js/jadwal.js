/* Halaman jadwal: memuat jadwal per tanggal dan menampilkan ketersediaan lab. */

const LABEL_KETERSEDIAAN = {
  tersedia: ['Tersedia', 'tersedia'],
  terpakai: ['Sudah Dibooking', 'terpakai'],
  pemeliharaan: ['Pemeliharaan', 'pemeliharaan'],
  tidak_tersedia: ['Tidak Tersedia', 'nonaktif'],
  lewatterakhir: ['Tanggal Lampau', 'dibatalkan'],
};

function tanggalHariIni() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function isiFilterLab() {
  const { data } = await api('/api/laboratorium');
  if (!data.success) return;
  const select = document.getElementById('f-lab');
  for (const lab of data.data) {
    const op = document.createElement('option');
    op.value = lab.id;
    op.textContent = lab.nama;
    select.appendChild(op);
  }
}

async function muatJadwal() {
  const tanggal = document.getElementById('f-tanggal').value || tanggalHariIni();
  const labId = document.getElementById('f-lab').value;
  const status = document.getElementById('f-status').value;
  const params = new URLSearchParams({ tanggal });
  if (labId) params.set('laboratorium_id', labId);
  if (status) params.set('status', status);

  const wadah = document.getElementById('daftar-jadwal');
  const wadahLab = document.getElementById('ketersediaan-lab');
  tampilkanMemuat(wadah);
  wadahLab.innerHTML = '<div class="memuat"><div class="spinner"></div>Memuat…</div>';

  const { data } = await api(`/api/jadwal?${params.toString()}`);
  if (!data.success) {
    tampilkanKosong(wadah, data.pesan || 'Gagal memuat jadwal.', '⚠️');
    return;
  }

  // Kartu ketersediaan laboratorium.
  if (!data.laboratorium || data.laboratorium.length === 0) {
    wadahLab.innerHTML = '<div class="kosong"><span class="ikon">🖥️</span>Belum ada laboratorium.</div>';
  } else {
    wadahLab.innerHTML = '';
    for (const lab of data.laboratorium) {
      const [teks, kelas] = LABEL_KETERSEDIAAN[lab.ketersediaan] || [lab.ketersediaan, 'dibatalkan'];
      const kartu = document.createElement('div');
      kartu.className = 'kartu';
      kartu.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <h3 style="margin:0;font-size:1rem">${esc(lab.nama)}</h3>
          <span class="badge badge-${kelas}">${esc(teks)}</span>
        </div>
        <p style="margin:8px 0 0;color:var(--abu-500);font-size:.88rem">Kapasitas ${lab.kapasitas} orang</p>
      `;
      wadahLab.appendChild(kartu);
    }
  }

  // Jadwal peminjaman.
  const jadwal = data.jadwal || [];
  const pemeliharaan = data.pemeliharaan || [];
  if (jadwal.length === 0 && pemeliharaan.length === 0) {
    tampilkanKosong(wadah, `Tidak ada jadwal peminjaman pada ${tanggalIndo(tanggal)}.`, '🗓️');
    return;
  }

  let html = '<div class="bungkus-tabel"><table><thead><tr>' +
    '<th>Jam</th><th>Laboratorium</th><th>Tujuan</th><th>Peserta</th><th>Status</th>' +
    '</tr></thead><tbody>';

  for (const p of pemeliharaan) {
    html += `<tr>
      <td>Pemeliharaan</td>
      <td>${esc(p.laboratorium)}</td>
      <td colspan="2">${esc(p.keterangan || 'Laboratorium dalam pemeliharaan')}</td>
      <td><span class="badge badge-pemeliharaan">Tidak Tersedia</span></td>
    </tr>`;
  }
  for (const j of jadwal) {
    html += `<tr>
      <td>${esc(j.jam_mulai)}–${esc(j.jam_selesai)}</td>
      <td>${esc(j.laboratorium)}</td>
      <td>${esc(j.tujuan)}</td>
      <td>${j.jumlah_peserta}</td>
      <td>${badgeStatus(j.status, j.label_status)}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  wadah.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('f-tanggal');
  inp.value = tanggalHariIni();
  inp.min = tanggalHariIni();
  isiFilterLab().then(muatJadwal);
  document.getElementById('btn-tampilkan').addEventListener('click', muatJadwal);
  ['f-lab', 'f-status'].forEach((id) => document.getElementById(id).addEventListener('change', muatJadwal));
});
