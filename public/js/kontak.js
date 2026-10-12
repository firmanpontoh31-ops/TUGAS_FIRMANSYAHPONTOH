/* Halaman kontak: menampilkan data pengelola dan tautan WhatsApp (bila valid). */

function nomorWhatsAppValid(n) {
  // Hanya digit; penanda CONTOH (berisi huruf) tidak dibuat tautan.
  return /^\d{9,15}$/.test(String(n).replace(/\D/g, ''));
}

async function muatKontak() {
  const wadah = document.getElementById('isi-kontak');
  tampilkanMemuat(wadah);
  const { data } = await api('/api/pengaturan');
  if (!data.success) {
    tampilkanKosong(wadah, 'Gagal memuat informasi kontak.', '⚠️');
    return;
  }
  const k = data.kontak || {};
  const baris = [];
  if (k.nama) baris.push(['👤', 'Nama', esc(k.nama)]);
  if (k.jabatan) baris.push(['🏷️', 'Jabatan', esc(k.jabatan)]);
  if (k.email) baris.push(['📧', 'Email', `<a href="mailto:${esc(k.email)}">${esc(k.email)}</a>`]);

  let tombolWa = '';
  if (k.whatsapp) {
    if (nomorWhatsAppValid(k.whatsapp)) {
      const wa = String(k.whatsapp).replace(/\D/g, '');
      tombolWa = `<a class="btn btn-utama" style="margin-top:14px" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">Hubungi via WhatsApp</a>`;
    }
    baris.push(['💬', 'WhatsApp', `${esc(k.whatsapp)}${nomorWhatsAppValid(k.whatsapp) ? '' : ' <span class="label-contoh">CONTOH</span>'}`]);
  }
  if (k.alamat) baris.push(['📍', 'Alamat', esc(k.alamat)]);
  if (k.jamLayanan) baris.push(['🕐', 'Jam Layanan', esc(k.jamLayanan)]);

  if (baris.length === 0) {
    tampilkanKosong(wadah, 'Informasi kontak belum tersedia.', '📇');
    return;
  }

  wadah.innerHTML = baris.map(([ikon, label, nilai]) => `
    <div class="kontak-item">
      <span class="ikon" aria-hidden="true">${ikon}</span>
      <div><strong>${esc(label)}</strong><br>${nilai}</div>
    </div>`).join('') + tombolWa;
}

document.addEventListener('DOMContentLoaded', muatKontak);
