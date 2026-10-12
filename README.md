# Sistem Informasi Peminjaman Laboratorium Informatika

**Judul proyek:** *Sistem Informasi Peminjaman Laboratorium Informatika Berbasis Web untuk Digitalisasi Pengelolaan Jadwal, Pengajuan, dan Persetujuan Peminjaman Laboratorium.*

Sistem web untuk mengelola proses peminjaman laboratorium informatika di lingkungan perguruan tinggi: pengajuan peminjaman oleh mahasiswa, pemeriksaan ketersediaan jadwal, persetujuan/penolakan oleh admin, hingga pemantauan status, riwayat, dan laporan.

Dibangun dengan **HTML, CSS, JavaScript** (tanpa framework besar) di sisi klien, **Node.js + Express** di sisi server, dan **SQLite** (modul bawaan `node:sqlite`, tanpa kompilasi native) untuk penyimpanan data.

---

## Cara Menjalankan di Komputer Lokal

### 1. Prasyarat

- **Node.js versi 22.5 atau lebih baru** (modul `node:sqlite` tersedia sejak versi tersebut). Proyek ini diuji pada Node.js v24.
- **npm** (ikut terpasang bersama Node.js).

### 2. Instalasi

```bash
npm install
```

Perintah ini memasang dependensi yang tercatat di `package.json` (hanya `express`).

### 3. Mengatur berkas `.env`

Salin berkas contoh menjadi `.env`, lalu isi nilainya:

**Windows (PowerShell / Git Bash):**

```bash
cp .env.example .env
```

**Kemudian buka `.env` dan isi variabel berikut:**

| Variabel | Keterangan | Contoh |
|---|---|---|
| `PORT` | Port server (opsional, default `3000`) | `3000` |
| `ADMIN_USERNAME` | Nama pengguna admin | `admin` |
| `ADMIN_PASSWORD` | Kata sandi admin (gunakan yang kuat) | `KataSandiKuat123!` |
| `ADMIN_NAMA` | Nama tampilan admin (opsional) | `Administrator Laboratorium` |

> **Penting:**
> - Jangan pernah meng-commit `.env` ke repository (sudah masuk `.gitignore`).
> - Kata sandi disimpan sebagai **hash scrypt** di basis data — tidak pernah disimpan atau dicetak dalam bentuk teks polos.
> - Pada setiap proses server dimulai, akun admin disinkronkan dengan kredensial di `.env`.
> - Bila `ADMIN_USERNAME`/`ADMIN_PASSWORD` tidak diatur, server tetap berjalan tetapi mencetak peringatan dan tidak ada akun admin yang dapat dibuat.

### 4. Menjalankan server

```bash
npm start
```

Atau, untuk pengembangan dengan pemuatan-ulang otomatis:

```bash
npm run dev
```

Setelah berjalan, buka:

- **Halaman pengguna:** [http://localhost:3000/](http://localhost:3000/)
- **Dashboard admin:** [http://localhost:3000/admin/login.html](http://localhost:3000/admin/login.html)

Basis data SQLite dibuat otomatis di `db/lab.db` pada pertama kali dijalankan, lengkap dengan skema, data contoh laboratorium (ditandai `[CONTOH]`), dan akun admin.

### 5. Menghentikan server

Tekan `Ctrl + C` di terminal tempat server berjalan.

---

## Struktur Folder

```
sistem-peminjaman-lab/
├── package.json              # Manifest proyek & dependensi
├── server.js                 # Entry point Express: statis, API, penanganan galat
├── .env.example              # Contoh variabel lingkungan (tanpa kredensial asli)
├── .gitignore
├── README.md
│
├── data/
│   └── config.js             # Konfigurasi pusat: data contoh [CONTOH], ketentuan, kontak
│
├── db/
│   ├── database.js           # Koneksi SQLite, skema, seed, helper bentrokan & pengaturan
│   └── lab.db                # Berkas database (dibuat otomatis, diabaikan git)
│
├── lib/
│   ├── env.js                # Loader .env manual tanpa dependensi
│   ├── security.js           # Hash scrypt, token sesi, rate limiter login
│   └── util.js               # Validasi, cookie, format tanggal, ekspor CSV
│
├── middleware/
│   └── authAdmin.js          # Proteksi seluruh endpoint /api/admin
│
├── routes/
│   ├── auth.js               # Login, logout, /me (autentikasi admin)
│   ├── publicApi.js          # Pengaturan, laboratorium, jadwal, ketersediaan (publik)
│   ├── peminjaman.js         # Ajukan, cek status, riwayat, pembatalan (publik)
│   └── admin.js              # Ringkasan, CRUD lab, pengajuan, jadwal, pemohon, laporan, pengaturan
│
├── tests/
│   └── uji-backend.sh        # Uji end-to-end API melalui curl
│
└── public/                   # Aset frontend (disajikan statis)
    ├── index.html            # Beranda
    ├── laboratorium.html     # Informasi laboratorium
    ├── jadwal.html           # Jadwal & ketersediaan
    ├── ajukan.html           # Formulir pengajuan
    ├── cek-status.html       # Pemeriksaan status
    ├── riwayat.html          # Riwayat peminjaman
    ├── ketentuan.html        # Ketentuan peminjaman
    ├── kontak.html           # Kontak pengelola
    ├── css/style.css         # Gaya bersama (biru–putih–abu, responsif)
    ├── js/                   # util.js, site.js + satu berkas JS per halaman
    └── admin/
        ├── login.html        # Login admin
        ├── index.html        # Ringkasan dashboard
        ├── pengajuan.html    # Manajemen pengajuan
        ├── jadwal.html       # Manajemen jadwal
        ├── laboratorium.html # CRUD laboratorium + pemeliharaan
        ├── pemohon.html      # Data pemohon
        ├── laporan.html      # Laporan, rekap, ekspor CSV
        ├── pengaturan.html   # Ketentuan, kontak, jam layanan
        ├── css/admin.css     # Gaya dashboard (sidebar, kartu statistik)
        └── js/               # admin.js + satu berkas JS per halaman
```

---

## Struktur Basis Data

Terdiri dari enam tabel dengan foreign key, indeks, dan pemeriksaan skema (`CHECK`):

| Tabel | Fungsi |
|---|---|
| `admins` | Akun admin dan hash kata sandi (scrypt) |
| `sesi_admin` | Token sesi admin (cookie `httpOnly`, kedaluwarsa otomatis) |
| `laboratorium` | Nama, lokasi, kapasitas, fasilitas, deskripsi, status operasional |
| `peminjam` | Identitas pemohon (NIM unik — dicegah duplikasi) |
| `peminjaman` | Detail pengajuan, jadwal, tujuan, peserta, status, alasan penolakan |
| `riwayat_status` | Catatan perubahan status, waktu, admin yang bertindak, keterangan |
| `pemeliharaan_laboratorium` | Rentang tanggal pemeliharaan yang membuat lab tak tersedia |
| `pengaturan` | Ketentuan, kontak, jam layanan, profil sistem (dapat diubah admin) |

**Alur status peminjaman:** `menunggu` → `disetujui` / `ditolak` / `dibatalkan`; `disetujui` → `selesai` / `dibatalkan`. Transisi tidak sah ditolak oleh server.

---

## Alur Peminjaman

1. Pengguna melihat informasi laboratorium dan memeriksa jadwal ketersediaan.
2. Pengguna mengisi formulir pengajuan; server memvalidasi field, format, kapasitas, jam layanan, dan **bentrokan jadwal**.
3. Pengajuan valid disimpan dengan status **Menunggu Persetujuan** dan nomor pengajuan dikembalikan.
4. Admin masuk ke dashboard, memeriksa detail, lalu menyetujui atau menolak (penolakan wajib beralasan).
5. Persetujuan dilakukan dalam transaksi `BEGIN IMMEDIATE` dengan pemeriksaan bentrokan ulang, sehingga dua pengajuan untuk lab & waktu sama tidak dapat disetujui bersamaan.
6. Pengguna memantau status lewat nomor pengajuan **dan** NIM; riwayat juga diverifikasi dengan NIM (tidak bisa ditebak hanya dengan nomor).
7. Setelah peminjaman terlaksana, admin mengubah status menjadi **Selesai**.
8. Seluruh data menjadi dasar riwayat dan laporan (dapat diekspor ke CSV).

---

## Keamanan

- Seluruh endpoint `/api/admin/*` dilindungi middleware `wajibAdmin` (401 bila tanpa sesi valid).
- Kata sandi disimpan sebagai **hash scrypt + salt**, diverifikasi dengan `timingSafeEqual`.
- Sesi memakai token acak 32 byte dalam cookie `httpOnly` + `SameSite=Lax`, tersimpan di basis data dengan masa berlaku 8 jam.
- **Rate limiter** membatasi 5 percobaan login per IP+nama pengguna dalam 15 menit (menghasilkan `429`).
- Validasi dilakukan di sisi server (bukan hanya JavaScript klien); semua query SQLite memakai **parameterized query**.
- Penolakan wajib beralasan; persetujuan menolak lab nonaktif/dalam pemeliharaan dan jadwal bentrok.
- Pesan galat aman (tanpa membocorkan detail internal/kata sandi); endpoint admin memakai parameterized query.

---

## Data Contoh

Seluruh data laboratorium, kontak, dan ketentuan awal merupakan **contoh** dan ditandai `[CONTOH]` di `data/config.js`. Ganti dengan data resmi sebelum dipakai di produksi. Sistem dapat berjalan tanpa bergantung pada data contoh, dan seluruh konten tersebut dapat diubah melalui **Dashboard Admin → Ketentuan & Info** (langsung tampil di halaman pengguna).

---

## Menjalankan Uji End-to-End

Dengan server berjalan di `http://localhost:3000`:

```bash
bash tests/uji-backend.sh
```

Uji ini mencakup pengajuan valid, validasi field, bentrokan jadwal, login & rate-limit, persetujuan/penolakan, pembatalan, riwayat, data pemohon, laporan + ekspor CSV, CRUD laboratorium, dan perubahan pengaturan. **Catatan:** uji memakai kredensial `admin` / `AdminLab123!`; samakan dengan `.env` Anda atau sesuaikan berkas uji. Karena `db/lab.db` dipakai bersama, jalankan ulang dengan basis data segar bila ingin hasil yang deterministik.

---

## Catatan Teknis

- **Penyimpanan:** SQLite via modul bawaan `node:sqlite` (aman di Windows, tanpa kompilasi native). Bila perlu beralih ke file JSON, ganti only `db/database.js` — lapisan route tidak berubah.
- **Desain:** palet biru–putih–abu dengan aksen warna per status, tipografi sistem, responsif (sidebar menjadi menu laci di layar kecil), komponen kartu statistik, tabel, formulir, modal konfirmasi, notifikasi, indikator status, tampilan kosong, dan indikator pemuatan.
- **Bahasa:** seluruh antarmuka memakai bahasa Indonesia formal dan netral.
- **Git:** repository dipublikasikan di GitHub: <https://github.com/firmanpontoh31-ops/TUGAS_FIRMANSYAHPONTOH>. Berkas `.env`, `node_modules/`, dan basis data lokal (`db/lab.db*`) dikecualikan lewat `.gitignore` sehingga tidak ikut terunggah.
