/* Manajemen pengajuan: filter, tabel, detail, ubah status (setujui/tolak/selesai/batal). */

let LAB_OPTS = '';
let AKSI = { nomor: null, status: null };
// Transisi yang diizinkan server, dipakai untuk menentukan tombol aksi.
const TRANSISI = {
  menunggu: ['disetujui', 'ditolak', 'dibatalkan'],
  disetujui: ['selesai', 'dibatalkan'],
  ditolak: [], dibatalkan: [], selesai: [],
};

async function muatFilterLab() {
  const { data } = await apiAdmin('/api/admin/laboratorium');
  if (!data.success) return;
  const select = document.getElementById('f-lab');
  for (const lab of data.data) {
    const op = document.createElement('option');
    op.value = lab.id; op.textContent = lab.nama;
    select.appendChild(op);
    LAB_OPTS += `<option value="${lab.id}">${esc(lab.nama)}</option>`;
  }
}

async function muatTabel() {
  const wadah = document.getElementById('tabel-pengajuan');
  tampilkanMemuat(wadah);
  const params = new URLSearchParams();
  const q = document.getElementById('f-q').value.trim();
  const status = document.getElementById('f-status').value;
  const lab = document.getElementById('f-lab').value;
  const tanggal = document.getElementById('f-tanggal').value;
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (lab) params.set('laboratorium_id', lab);
  if (tanggal) params.set('tanggal', tanggal);

  const { data } = await apiAdmin(`/api/admin/peminjaman?${params.toString()}`);
  if (!data.success) { tampilkanKosong(wadah, data.pesan || 'Gagal memuat.', '⚠️'); return; }
  if (!data.data.length) { tampilkanKosong(wadah, 'Tidak ada pengajuan yang cocok dengan filter.', '📭'); return; }

  let html = '<div class="bungkus-tabel" style="border:0;border-radius:0;box-shadow:none"><table><thead><tr>' +
    '<th>Nomor</th><th>Pemohon</th><th>Laboratorium</th><th>Jadwal</th><th>Status</th><th>Aksi</th>' +
    '</tr></thead><tbody>';
  for (const p of data.data) {
    html += `<tr>
      <td><strong>${esc(p.nomor_pengajuan)}</strong></td>
      <td>${esc(p.pemohon)}<br><span style="color:var(--abu-500);font-size:.82rem">${esc(p.nim)}</span></td>
      <td>${esc(p.laboratorium)}</td>
      <td>${tanggalIndo(p.tanggal)}<br><span style="color:var(--abu-500);font-size:.82rem">${esc(p.jam_mulai)}–${esc(p.jam_selesai)}</span></td>
      <td>${badgeStatus(p.status, p.label_status)}</td>
      <td><div class="baris-aksi">
        <button class="btn btn-garis btn-kecil" data-detail="${esc(p.nomor_pengajuan)}">Detail</button>
        ${tombolAksi(p)}
      </div></td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  wadah.innerHTML = html;
  pasangAksiTabel();
}

function tombolAksi(p) {
  let html = '';
  for (const t of TRANSISI[p.status] || []) {
    const gaya = t === 'disetujui' ? 'btn-utama' : (t === 'ditolak' ? 'btn-bahaya' : 'btn-garis');
    html += `<button class="${gaya} btn-kecil" data-status="${t}" data-nomor="${esc(p.nomor_pengajuan)}">${LABEL_STATUS[t]}</button>`;
  }
  return html;
}

function pasangAksiTabel() {
  document.querySelectorAll('[data-detail]').forEach((b) =>
    b.addEventListener('click', () => lihatDetail(b.getAttribute('data-detail'))));
  document.querySelectorAll('[data-status][data-nomor]').forEach((b) =>
    b.addEventListener('click', () => bukaAksi(b.getAttribute('data-nomor'), b.getAttribute('data-status'))));
}

async function lihatDetail(nomor) {
  const wadah = document.getElementById('isi-detail');
  tampilkanMemuat(wadah);
  bukaModal('modal-detail');
  const { data } = await apiAdmin(`/api/admin/peminjaman/${encodeURIComponent(nomor)}`);
  if (!data.success) { tampilkanKosong(wadah, data.pesan || 'Gagal memuat detail.', '⚠️'); return; }
  const p = data.data;
  const riwayat = (data.riwayat || []).map((r) => `
    <li>
      <div>${badgeStatus(r.status_baru)}</div>
      <div style="margin-top:3px">${esc(r.keterangan)}</div>
      <div class="waktu">Oleh ${esc(r.diubah_oleh)} · ${esc(r.created_at)}</div>
    </li>`).join('');

  wadah.innerHTML = `
    <p style="margin-top:0">${badgeStatus(p.status, p.label_status)} <strong style="margin-left:8px">${esc(p.nomor_pengajuan)}</strong></p>
    ${p.status === 'ditolak' && p.alasan_penolakan ? `<div class="peringatan" style="background:var(--merah-bg);border-color:#fecaca;color:var(--merah)"><strong>Alasan penolakan:</strong> ${esc(p.alasan_penolakan)}</div>` : ''}
    <dl class="detail-dl-admin">
      <dt>Pemohon</dt><dd>${esc(p.pemohon)} (${esc(p.nim)})</dd>
      <dt>Program Studi</dt><dd>${esc(p.program_studi || '-')}</dd>
      <dt>WhatsApp</dt><dd>${esc(p.whatsapp || '-')}</dd>
      <dt>Laboratorium</dt><dd>${esc(p.laboratorium)}<br><span style="color:var(--abu-500);font-size:.86rem">${esc(p.lokasi || '')}</span></dd>
      <dt>Tanggal</dt><dd>${tanggalIndo(p.tanggal)}</dd>
      <dt>Waktu</dt><dd>${esc(p.jam_mulai)} – ${esc(p.jam_selesai)} WIB</dd>
      <dt>Tujuan</dt><dd>${esc(p.tujuan)}</dd>
      <dt>Jumlah Peserta</dt><dd>${p.jumlah_peserta} orang</dd>
      <dt>Catatan</dt><dd>${esc(p.catatan || '-')}</dd>
      <dt>Diajukan</dt><dd>${esc(p.created_at)}</dd>
      <dt>Diperbarui</dt><dd>${esc(p.updated_at)}</dd>
    </dl>
    <h4 style="margin:18px 0 8px">Riwayat Status</h4>
    ${riwayat ? `<ul class="timeline">${riwayat}</ul>` : '<p style="color:var(--abu-500)">Belum ada riwayat.</p>'}`;
}

function bukaAksi(nomor, status) {
  AKSI = { nomor, status };
  document.getElementById('aksi-judul').textContent = `Ubah status menjadi "${LABEL_STATUS[status]}"?`;
  document.getElementById('aksi-info').textContent = `Pengajuan ${nomor}`;
  const bungkus = document.getElementById('bungkus-alasan');
  const alasan = document.getElementById('input-alasan');
  bungkus.style.display = status === 'ditolak' ? 'block' : 'none';
  alasan.value = '';
  bukaModal('modal-aksi');
}

document.getElementById('btn-simpan-aksi').addEventListener('click', async () => {
  const tombol = document.getElementById('btn-simpan-aksi');
  await denganTombolNonaktif(tombol, async () => {
    const body = { status: AKSI.status };
    if (AKSI.status === 'ditolak') body.alasan = document.getElementById('input-alasan').value.trim();
    const { data } = await apiAdmin(`/api/admin/peminjaman/${encodeURIComponent(AKSI.nomor)}/status`, {
      method: 'PATCH', body: JSON.stringify(body),
    });
    if (data.success) {
      notifikasi(data.pesan, 'success');
      tutupModal('modal-aksi');
      tutupModal('modal-detail');
      await muatTabel();
    } else {
      notifikasi(data.pesan || 'Gagal mengubah status.', 'error');
    }
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await initAdmin('Manajemen Pengajuan Peminjaman');
  if (!admin) return;
  await muatFilterLab();
  await muatTabel();
  ['f-status', 'f-lab', 'f-tanggal'].forEach((id) => document.getElementById(id).addEventListener('change', muatTabel));
  let t;
  document.getElementById('f-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(muatTabel, 350); });
  document.getElementById('btn-reset').addEventListener('click', () => {
    ['f-q', 'f-status', 'f-lab', 'f-tanggal'].forEach((id) => { document.getElementById(id).value = ''; });
    muatTabel();
  });
});
