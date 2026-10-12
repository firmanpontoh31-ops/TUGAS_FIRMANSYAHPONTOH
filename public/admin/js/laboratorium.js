/* Manajemen data laboratorium: CRUD + jadwal pemeliharaan. */

const LABEL_LAB = { aktif: 'Aktif', nonaktif: 'Tidak Aktif', pemeliharaan: 'Dalam Pemeliharaan' };
const BADGE_LAB = { aktif: 'tersedia', nonaktif: 'nonaktif', pemeliharaan: 'pemeliharaan' };
let LAB_SUNTING = null; // id lab yang disunting, null = tambah

async function muatTabel() {
  const wadah = document.getElementById('tabel-lab');
  const { data } = await apiAdmin('/api/admin/laboratorium');
  if (!data.success) { tampilkanKosong(wadah, data.pesan || 'Gagal memuat.', '⚠️'); return; }
  if (!data.data.length) { tampilkanKosong(wadah, 'Belum ada data laboratorium.', '🖥️'); return; }

  let html = '<div class="bungkus-tabel" style="border:0;border-radius:0;box-shadow:none"><table><thead><tr>' +
    '<th>Nama</th><th>Lokasi</th><th>Kapasitas</th><th>Fasilitas</th><th>Status</th><th>Aksi</th>' +
    '</tr></thead><tbody>';
  for (const l of data.data) {
    html += `<tr>
      <td><strong>${esc(l.nama)}</strong></td>
      <td>${esc(l.lokasi || '-')}</td>
      <td>${l.kapasitas}</td>
      <td>${esc(l.fasilitas || '-')}</td>
      <td><span class="badge badge-${BADGE_LAB[l.status_operasional] || 'nonaktif'}">${LABEL_LAB[l.status_operasional] || esc(l.status_operasional)}</span></td>
      <td><div class="baris-aksi">
        <button class="btn btn-garis btn-kecil" data-edit="${l.id}">Ubah</button>
        <button class="btn btn-bahaya btn-kecil" data-hapus="${l.id}" data-nama="${esc(l.nama)}">Hapus</button>
      </div></td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  wadah.innerHTML = html;

  wadah.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => bukaForm(Number(b.getAttribute('data-edit')))));
  wadah.querySelectorAll('[data-hapus]').forEach((b) =>
    b.addEventListener('click', () => hapusLab(Number(b.getAttribute('data-hapus')), b.getAttribute('data-nama'))));
}

async function muatPemeliharaan() {
  const wadah = document.getElementById('tabel-pemeliharaan');
  const { data } = await apiAdmin('/api/admin/pemeliharaan');
  if (!data.success) { tampilkanKosong(wadah, 'Gagal memuat.', '⚠️'); return; }
  if (!data.data.length) { tampilkanKosong(wadah, 'Belum ada jadwal pemeliharaan.', '🗓️'); return; }

  let html = '<div class="bungkus-tabel" style="border:0;border-radius:0;box-shadow:none"><table><thead><tr>' +
    '<th>Laboratorium</th><th>Periode</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>';
  for (const p of data.data) {
    html += `<tr>
      <td>${esc(p.laboratorium)}</td>
      <td>${tanggalIndo(p.tanggal_mulai)} – ${tanggalIndo(p.tanggal_selesai)}</td>
      <td>${esc(p.keterangan || '-')}</td>
      <td><button class="btn btn-bahaya btn-kecil" data-hapus-pem="${p.id}">Hapus</button></td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  wadah.innerHTML = html;
  wadah.querySelectorAll('[data-hapus-pem]').forEach((b) =>
    b.addEventListener('click', () => hapusPemeliharaan(Number(b.getAttribute('data-hapus-pem')))));
}

function bukaForm(id = null) {
  LAB_SUNTING = id;
  const f = {
    nama: document.getElementById('lab-nama'), lokasi: document.getElementById('lab-lokasi'),
    kapasitas: document.getElementById('lab-kapasitas'), status: document.getElementById('lab-status'),
    fasilitas: document.getElementById('lab-fasilitas'), deskripsi: document.getElementById('lab-deskripsi'),
  };
  document.getElementById('lab-judul').textContent = id ? 'Ubah Laboratorium' : 'Tambah Laboratorium';
  if (!id) {
    Object.values(f).forEach((el) => { el.value = el.tagName === 'SELECT' ? 'aktif' : ''; });
  } else {
    apiAdmin(`/api/admin/laboratorium`).then(({ data }) => {
      const lab = data.data.find((l) => l.id === id);
      if (!lab) return;
      f.nama.value = lab.nama; f.lokasi.value = lab.lokasi || '';
      f.kapasitas.value = lab.kapasitas; f.status.value = lab.status_operasional;
      f.fasilitas.value = lab.fasilitas || ''; f.deskripsi.value = lab.deskripsi || '';
    });
  }
  bukaModal('modal-lab');
}

document.getElementById('form-lab').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const tombol = document.getElementById('btn-simpan-lab');
  const body = {
    nama: document.getElementById('lab-nama').value.trim(),
    lokasi: document.getElementById('lab-lokasi').value.trim(),
    kapasitas: Number(document.getElementById('lab-kapasitas').value),
    status_operasional: document.getElementById('lab-status').value,
    fasilitas: document.getElementById('lab-fasilitas').value.trim(),
    deskripsi: document.getElementById('lab-deskripsi').value.trim(),
  };
  await denganTombolNonaktif(tombol, async () => {
    const url = LAB_SUNTING ? `/api/admin/laboratorium/${LAB_SUNTING}` : '/api/admin/laboratorium';
    const { data } = await apiAdmin(url, { method: LAB_SUNTING ? 'PUT' : 'POST', body: JSON.stringify(body) });
    if (data.success) {
      notifikasi(data.pesan, 'success');
      tutupModal('modal-lab');
      await muatTabel();
      await isiSelectPemeliharaan();
    } else {
      const detail = Array.isArray(data.detail) ? data.detail.join(' ') : (data.pesan || 'Gagal menyimpan.');
      notifikasi(detail, 'error');
    }
  });
});

async function hapusLab(id, nama) {
  const yakin = await konfirmasi('Hapus Laboratorium?', `Laboratorium "${nama}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`, 'Ya, Hapus');
  if (!yakin) return;
  const { data } = await apiAdmin(`/api/admin/laboratorium/${id}`, { method: 'DELETE' });
  if (data.success) { notifikasi(data.pesan, 'success'); await muatTabel(); await isiSelectPemeliharaan(); }
  else notifikasi(data.pesan || 'Gagal menghapus.', 'error');
}

async function hapusPemeliharaan(id) {
  const yakin = await konfirmasi('Hapus Pemeliharaan?', 'Jadwal pemeliharaan ini akan dihapus.', 'Ya, Hapus');
  if (!yakin) return;
  const { data } = await apiAdmin(`/api/admin/pemeliharaan/${id}`, { method: 'DELETE' });
  if (data.success) { notifikasi(data.pesan, 'success'); await muatPemeliharaan(); }
  else notifikasi(data.pesan || 'Gagal menghapus.', 'error');
}

async function isiSelectPemeliharaan() {
  const { data } = await apiAdmin('/api/admin/laboratorium');
  const select = document.getElementById('pem-lab');
  select.innerHTML = '<option value="">— Pilih —</option>';
  if (data.success) for (const l of data.data) {
    const op = document.createElement('option');
    op.value = l.id; op.textContent = l.nama;
    select.appendChild(op);
  }
}

document.getElementById('btn-tambah').addEventListener('click', () => bukaForm(null));
document.getElementById('btn-tambah-pemeliharaan').addEventListener('click', () => {
  document.getElementById('form-pemeliharaan').reset();
  bukaModal('modal-pemeliharaan');
});
document.getElementById('form-pemeliharaan').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const body = {
    laboratorium_id: Number(document.getElementById('pem-lab').value),
    tanggal_mulai: document.getElementById('pem-mulai').value,
    tanggal_selesai: document.getElementById('pem-selesai').value,
    keterangan: document.getElementById('pem-keterangan').value.trim(),
  };
  const { data } = await apiAdmin('/api/admin/pemeliharaan', { method: 'POST', body: JSON.stringify(body) });
  if (data.success) { notifikasi(data.pesan, 'success'); tutupModal('modal-pemeliharaan'); await muatPemeliharaan(); }
  else notifikasi(data.pesan || 'Gagal menyimpan.', 'error');
});

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await initAdmin('Manajemen Data Laboratorium');
  if (!admin) return;
  await muatTabel();
  await muatPemeliharaan();
  await isiSelectPemeliharaan();
});
