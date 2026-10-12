/* Halaman pengajuan: validasi klien, muat lab & jam layanan, kirim formulir. */

let JAM_MULAI_LAYANAN = '08:00';
let JAM_SELESAI_LAYANAN = '17:00';

function tanggalHariIni() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Validasi formulir di sisi klien (pemeriksaan server tetap menjadi acuan). */
function validasiKlien(f) {
  const kesalahan = [];
  if (!f.nama || f.nama.trim().length < 3) kesalahan.push('Nama lengkap minimal 3 karakter.');
  if (!f.nim || !/^[A-Za-z0-9._-]{4,25}$/.test(f.nim.trim())) kesalahan.push('NIM/identitas tidak valid (4–25 karakter: huruf, angka, titik, garis bawah, atau strip).');
  if (!f.program_studi || !f.program_studi.trim()) kesalahan.push('Program studi/kelas wajib diisi.');
  if (!f.whatsapp || !/^\+?[0-9\s-]{9,18}$/.test(f.whatsapp.trim())) kesalahan.push('Nomor WhatsApp tidak valid (9–18 digit).');
  if (!f.laboratorium_id) kesalahan.push('Laboratorium wajib dipilih.');
  if (!f.tanggal) kesalahan.push('Tanggal peminjaman wajib diisi.');
  if (f.tanggal && f.tanggal < tanggalHariIni()) kesalahan.push('Tanggal peminjaman tidak boleh di masa lalu.');
  if (!f.jam_mulai || !f.jam_selesai) kesalahan.push('Waktu mulai dan selesai wajib diisi.');
  if (f.jam_mulai && f.jam_selesai && f.jam_selesai <= f.jam_mulai) kesalahan.push('Waktu selesai harus lebih akhir daripada waktu mulai.');
  if (!f.tujuan || f.tujuan.trim().length < 5) kesalahan.push('Tujuan peminjaman minimal 5 karakter.');
  const jml = Number(f.jumlah_peserta);
  if (!Number.isInteger(jml) || jml < 1) kesalahan.push('Jumlah peserta minimal 1 orang.');
  if (!f.persetujuan_data) kesalahan.push('Persetujuan penggunaan data wajib dicentang.');
  return kesalahan;
}

function tampilkanKesalahan(daftar) {
  const box = document.getElementById('kesalahan');
  if (!daftar || daftar.length === 0) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  box.innerHTML = `<strong>Periksa kembali isian Anda:</strong><ul>${daftar.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function isiPilihanLab() {
  const { data } = await api('/api/laboratorium');
  const select = document.getElementById('laboratorium_id');
  if (!data.success || !Array.isArray(data.data)) return;
  for (const lab of data.data) {
    const op = document.createElement('option');
    op.value = lab.id;
    const nonaktif = lab.status_operasional !== 'aktif';
    op.textContent = nonaktif ? `${lab.nama} (${lab.status_operasional === 'pemeliharaan' ? 'pemeliharaan' : 'tidak aktif'})` : `${lab.nama} — kapasitas ${lab.kapasitas}`;
    op.disabled = nonaktif;
    op.dataset.kapasitas = lab.kapasitas;
    select.appendChild(op);
  }
}

document.addEventListener('sistem:siap', (e) => {
  const jam = e.detail.jamLayanan || {};
  if (jam.mulai) JAM_MULAI_LAYANAN = jam.mulai;
  if (jam.selesai) JAM_SELESAI_LAYANAN = jam.selesai;
  const h = document.getElementById('hint-jam');
  if (h) h.textContent = `Jam layanan laboratorium: ${JAM_MULAI_LAYANAN}–${JAM_SELESAI_LAYANAN}.`;
  const tm = document.getElementById('jam_mulai');
  const ts = document.getElementById('jam_selesai');
  if (tm) tm.min = JAM_MULAI_LAYANAN, tm.max = JAM_SELESAI_LAYANAN;
  if (ts) ts.min = JAM_MULAI_LAYANAN, ts.max = JAM_SELESAI_LAYANAN;
});

document.addEventListener('DOMContentLoaded', () => {
  const tanggal = document.getElementById('tanggal');
  tanggal.value = tanggalHariIni();
  tanggal.min = tanggalHariIni();
  isiPilihanLab();

  // Pembaruan kapasitas saat lab dipilih.
  document.getElementById('laboratorium_id').addEventListener('change', (e) => {
    const op = e.target.selectedOptions[0];
    const kap = op?.dataset?.kapasitas;
    const jml = document.getElementById('jumlah_peserta');
    if (kap) { jml.max = kap; document.getElementById('hint-lab').textContent = `Kapasitas laboratorium terpilih: ${kap} orang.`; }
  });

  document.getElementById('btn-ajukan-lagi').addEventListener('click', () => {
    document.getElementById('form-ajukan').reset();
    document.getElementById('form-ajukan').style.display = '';
    document.getElementById('hasil-sukses').style.display = 'none';
    tanggal.value = tanggalHariIni();
    tampilkanKesalahan([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('form-ajukan').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const f = Object.fromEntries(fd.entries());
    f.persetujuan_data = fd.has('persetujuan_data');
    f.laboratorium_id = Number(f.laboratorium_id);
    f.jumlah_peserta = Number(f.jumlah_peserta);

    const kesalahan = validasiKlien(f);
    if (kesalahan.length) { tampilkanKesalahan(kesalahan); return; }
    tampilkanKesalahan([]);

    const tombol = document.getElementById('btn-kirim');
    await denganTombolNonaktif(tombol, async () => {
      const { status, data } = await api('/api/peminjaman', { method: 'POST', body: JSON.stringify(f) });
      if (!data.success) {
        const detail = Array.isArray(data.detail) ? data.detail : [data.pesan || 'Pengajuan gagal dikirim.'];
        tampilkanKesalahan(detail);
        notifikasi('Pengajuan gagal dikirim.', 'error');
        return;
      }
      document.getElementById('nomor-hasil').textContent = data.nomor_pengajuan;
      ev.target.style.display = 'none';
      document.getElementById('hasil-sukses').style.display = 'block';
      notifikasi('Pengajuan peminjaman berhasil dikirim.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
});
