/* Halaman informasi laboratorium: daftar kartu + status operasional. */
const LABEL_LAB = {
  aktif: 'Aktif',
  nonaktif: 'Tidak Aktif',
  pemeliharaan: 'Dalam Pemeliharaan',
};

async function muatLab() {
  const wadah = document.getElementById('daftar-lab');
  tampilkanMemuat(wadah);
  const { data } = await api('/api/laboratorium');
  if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
    tampilkanKosong(wadah, 'Belum ada data laboratorium yang tersedia.', '🖥️');
    return;
  }

  wadah.innerHTML = '<div class="kartu-grid" id="grid-lab"></div>';
  const grid = document.getElementById('grid-lab');

  for (const lab of data.data) {
    const kartu = document.createElement('article');
    kartu.className = 'kartu';
    kartu.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <h3 style="margin-bottom:6px">${esc(lab.nama)}</h3>
        <span class="badge badge-${lab.status_operasional === 'aktif' ? 'tersedia' : (lab.status_operasional === 'pemeliharaan' ? 'pemeliharaan' : 'nonaktif')}">${LABEL_LAB[lab.status_operasional] || esc(lab.status_operasional)}</span>
      </div>
      <p style="color:var(--abu-500);font-size:.9rem;margin-bottom:10px">📍 ${esc(lab.lokasi || 'Lokasi belum diatur')}</p>
      <p style="margin-bottom:8px">${esc(lab.deskripsi || '')}</p>
      <p style="margin-bottom:8px"><strong>Fasilitas:</strong> ${esc(lab.fasilitas || '-')}</p>
      <p style="margin-bottom:0"><strong>Kapasitas:</strong> ${lab.kapasitas} orang</p>
    `;
    grid.appendChild(kartu);
  }
}

document.addEventListener('DOMContentLoaded', muatLab);
