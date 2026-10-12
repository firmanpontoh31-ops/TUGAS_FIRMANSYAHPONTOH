/**
 * Berkas konfigurasi pusat sistem.
 * Semua data contoh di bawah ini ditandai [CONTOH] dan HANYA untuk demonstrasi.
 * Ganti dengan data resmi (atau ubah melalui Dashboard Admin) sebelum dipakai produksi.
 */

export const KONFIGURASI_SISTEM = {
  namaSistem: 'Sistem Informasi Peminjaman Laboratorium Informatika',
  judulProyek:
    'Sistem Informasi Peminjaman Laboratorium Informatika Berbasis Web untuk Digitalisasi Pengelolaan Jadwal, Pengajuan, dan Persetujuan Peminjaman Laboratorium',
  tagline: 'Layanan digital pengajuan, penjadwalan, dan persetujuan peminjaman laboratorium.',
  deskripsi:
    'Sistem ini memfasilitasi mahasiswa dan sivitas akademika untuk mengajukan peminjaman laboratorium informatika secara daring, memeriksa ketersediaan jadwal, serta memantau status pengajuan hingga selesai.',
  namaInstitusi: '[CONTOH] Nama Institusi Perguruan Tinggi',
};

/**
 * Data awal laboratorium. Seluruh entri di bawah ini adalah [CONTOH].
 * Disuntikkan ke basis data hanya jika tabel laboratorium masih kosong.
 */
export const DATA_AWAL_LABORATORIUM = [
  {
    nama: '[CONTOH] Laboratorium Informatika 1',
    lokasi: '[CONTOH] Gedung Teknologi Informasi, Lantai 2, Ruang 201',
    kapasitas: 32,
    fasilitas: '[CONTOH] 32 PC, proyektor, papan tulis, jaringan LAN',
    deskripsi:
      '[CONTOH] Laboratorium untuk kegiatan praktikum pemrograman dasar dan basis data.',
    status_operasional: 'aktif',
  },
  {
    nama: '[CONTOH] Laboratorium Informatika 2',
    lokasi: '[CONTOH] Gedung Teknologi Informasi, Lantai 2, Ruang 203',
    kapasitas: 30,
    fasilitas: '[CONTOH] 30 PC, proyektor, koneksi internet, whiteboard',
    deskripsi:
      '[CONTOH] Laboratorium untuk kegiatan praktikum jaringan komputer dan sistem operasi.',
    status_operasional: 'aktif',
  },
  {
    nama: '[CONTOH] Laboratorium Multimedia',
    lokasi: '[CONTOH] Gedung Teknologi Informasi, Lantai 3, Ruang 305',
    kapasitas: 24,
    fasilitas: '[CONTOH] 24 PC grafis, kamera DSLR, lighting, green screen',
    deskripsi:
      '[CONTOH] Laboratorium untuk kegiatan praktikum desain, pemrograman web, dan multimedia.',
    status_operasional: 'aktif',
  },
];

/** Jam layanan peminjaman laboratorium (bisa diubah lewat pengaturan). */
export const JAM_LAYANAN = { mulai: '08:00', selesai: '17:00' };

/** Ketentuan peminjaman awal. Semua teks bersifat [CONTOH] dan dapat diubah admin. */
export const KETENTUAN_AWAL = {
  prosedur:
    '1. Periksa informasi dan ketersediaan laboratorium pada halaman Jadwal.\n' +
    '2. Isi formulir Pengajuan Peminjaman dengan data yang benar.\n' +
    '3. Simpan nomor pengajuan yang muncul setelah pengiriman.\n' +
    '4. Periksa status pengajuan melalui halaman Cek Status menggunakan nomor pengajuan dan NIM.\n' +
    '5. Pengajuan yang disetujui dapat digunakan sesuai tanggal dan waktu yang diajukan.',
  ketentuanUmum:
    '1. Pengguna wajib mengisi formulir dengan data yang benar dan dapat dipertanggungjawabkan.\n' +
    '2. Pengajuan akan diproses oleh admin laboratorium dalam jam layanan.\n' +
    '3. Pengajuan belum dianggap disetujui sebelum status berubah menjadi "Disetujui".\n' +
    '4. Admin dapat menolak pengajuan dengan alasan yang dicantumkan pada halaman status.',
  aturanPenggunaan:
    '1. Peminjaman dilakukan sesuai tanggal dan waktu yang disetujui; keterlambatan mengurangi durasi penggunaan.\n' +
    '2. Jumlah peserta tidak boleh melebihi kapasitas ruangan laboratorium.\n' +
    '3. Pemohon bertanggung jawab atas kebersihan, kerapian, dan kerusakan fasilitas selama masa pemakaian.\n' +
    '4. Dilarang memindahkan, membongkar, atau menginstal perangkat lunak tanpa izin pengelola.\n' +
    '5. Laboratorium harus dikembalikan dalam kondisi seperti semula setelah kegiatan selesai.',
};

/** Kontak pengelola. Semua data di bawah ini adalah [CONTOH], bukan kontak resmi. */
export const KONTAK_AWAL = {
  nama: '[CONTOH] Nama Pengelola Laboratorium',
  jabatan: '[CONTOH] Koordinator Laboratorium Informatika',
  whatsapp: '[CONTOH] 6281234567890',
  email: '[CONTOH] lab.informatika@contoh.ac.id',
  alamat: '[CONTOH] Gedung Teknologi Informasi, Kampus Perguruan Tinggi Contoh',
  jamLayanan: '[CONTOH] Senin–Jumat, 08.00–17.00 WIB',
};

export const STATUS_PEMINJAMAN = ['menunggu', 'disetujui', 'ditolak', 'dibatalkan', 'selesai'];

export const LABEL_STATUS = {
  menunggu: 'Menunggu Persetujuan',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
  selesai: 'Selesai',
};
