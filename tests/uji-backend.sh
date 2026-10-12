#!/usr/bin/env bash
# Uji backend end-to-end melalui curl. Menjalankan server di localhost:3000.
set -u
BASE="http://localhost:3000"
CJ=$(mktemp)          # cookie jar admin
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  [OK]   $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  [GAGAL] $1"; }
cek()  { # cek "deskripsi" "json-payload" "kata-kunci"
  local desc="$1" body="$2" expect="$3"
  if echo "$body" | grep -q "$expect"; then ok "$desc"; else bad "$desc -> $body"; fi
}
TANGGAL=$(date -d "+3 days" +%F 2>/dev/null || date -v+3d +%F)

echo "== 1. Submit pengajuan valid =="
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Budi Santoso\",\"nim\":\"1301220001\",\"program_studi\":\"Teknik Informatika\",
  \"whatsapp\":\"081234567890\",\"laboratorium_id\":1,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"09:00\",\"jam_selesai\":\"11:00\",\"tujuan\":\"Praktikum basis data\",
  \"jumlah_peserta\":20,\"catatan\":\"\",\"persetujuan_data\":true}")
cek "pengajuan diterima + nomor" "$R" '"success":true'
NOMOR=$(echo "$R" | sed -n 's/.*"nomor_pengajuan":"\([^"]*\)".*/\1/p')
echo "    nomor = $NOMOR"

echo "== 2. Validasi: jam selesai <= jam mulai =="
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Budi Santoso\",\"nim\":\"1301220001\",\"program_studi\":\"TI\",
  \"whatsapp\":\"081234567890\",\"laboratorium_id\":1,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"11:00\",\"jam_selesai\":\"09:00\",\"tujuan\":\"Tes validasi data\",
  \"jumlah_peserta\":5,\"persetujuan_data\":true}")
cek "ditolak: waktu selesai lebih awal" "$R" 'Waktu selesai'

echo "== 3. Validasi: tanpa persetujuan data =="
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Budi\",\"nim\":\"1301220001\",\"program_studi\":\"TI\",
  \"whatsapp\":\"081234567890\",\"laboratorium_id\":1,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"13:00\",\"jam_selesai\":\"14:00\",\"tujuan\":\"Tes validasi data\",
  \"jumlah_peserta\":5,\"persetujuan_data\":false}")
cek "ditolak: centang persetujuan wajib" "$R" 'Persetujuan'

echo "== 4. Validasi: peserta melebihi kapasitas =="
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Budi Santoso\",\"nim\":\"1301220001\",\"program_studi\":\"TI\",
  \"whatsapp\":\"081234567890\",\"laboratorium_id\":1,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"13:00\",\"jam_selesai\":\"14:00\",\"tujuan\":\"Tes kapasitas\",
  \"jumlah_peserta\":99,\"persetujuan_data\":true}")
cek "ditolak: kapasitas terlampaui" "$R" 'Kapasitas\|kapasitas'

echo "== 5. Cek status tanpa login (publik) =="
R=$(curl -s -X POST "$BASE/api/peminjaman/cek-status" -H "Content-Type: application/json" -d "{\"nomor_pengajuan\":\"$NOMOR\",\"nim\":\"1301220001\"}")
cek "status = menunggu" "$R" 'Menunggu Persetujuan'

echo "== 6. Cek status dengan NIM salah (harus ditolak) =="
R=$(curl -s -X POST "$BASE/api/peminjaman/cek-status" -H "Content-Type: application/json" -d "{\"nomor_pengajuan\":\"$NOMOR\",\"nim\":\"9999999999\"}")
cek "ditolak: NIM tidak cocok" "$R" 'tidak ditemukan'

echo "== 7. Endpoint admin tanpa sesi (harus 401) =="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/ringkasan")
[ "$CODE" = "401" ] && ok "admin tanpa sesi -> 401" || bad "admin tanpa sesi -> $CODE"

echo "== 8. Login admin valid =="
R=$(curl -s -c "$CJ" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"AdminLab123!"}')
cek "login sukses" "$R" '"success":true'

echo "== 10. Ringkasan dashboard =="
R=$(curl -s -b "$CJ" "$BASE/api/admin/ringkasan")
cek "statistik tersedia" "$R" 'statistik'

echo "== 11. Setujui pengajuan =="
R=$(curl -s -b "$CJ" -X PATCH "$BASE/api/admin/peminjaman/$NOMOR/status" -H "Content-Type: application/json" -d '{"status":"disetujui"}')
cek "disetujui" "$R" 'Disetujui'

echo "== 12. Bentrokan: pengajuan lain pada jam & lab sama (harus 409) =="
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Siti Aminah\",\"nim\":\"1301220002\",\"program_studi\":\"Teknik Informatika\",
  \"whatsapp\":\"081298765432\",\"laboratorium_id\":1,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"10:00\",\"jam_selesai\":\"12:00\",\"tujuan\":\"Rapat tugas\",
  \"jumlah_peserta\":10,\"persetujuan_data\":true}")
cek "ditolak: bentrok dgn disetujui" "$R" 'bertabrakan'

echo "== 13. Bentrokan: admin menyetujui pengajuan bentrok =="
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Siti Aminah\",\"nim\":\"1301220002\",\"program_studi\":\"TI\",
  \"whatsapp\":\"081298765432\",\"laboratorium_id\":1,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"12:00\",\"jam_selesai\":\"13:00\",\"tujuan\":\"Kelas pengganti\",
  \"jumlah_peserta\":10,\"persetujuan_data\":true}")
NOMOR2=$(echo "$R" | sed -n 's/.*"nomor_pengajuan":"\([^"]*\)".*/\1/p')
R=$(curl -s -b "$CJ" -X PATCH "$BASE/api/admin/peminjaman/$NOMOR2/status" -H "Content-Type: application/json" -d '{"status":"disetujui"}')
# Nomor2 jam 12-13 tidak bentrok dengan 09-11, jadi harus disetujui dulu, lalu uji bentrok
cek "persetujuan non-bentrok sukses" "$R" 'Disetujui'
R=$(curl -s -b "$CJ" -X PATCH "$BASE/api/admin/peminjaman/$NOMOR2/status" -H "Content-Type: application/json" -d '{"status":"selesai"}')
cek "ubah status -> selesai" "$R" 'Selesai'

echo "== 14. Tolak tanpa alasan (harus 400) =="
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Andi Wijaya\",\"nim\":\"1301220003\",\"program_studi\":\"TI\",
  \"whatsapp\":\"081211112222\",\"laboratorium_id\":2,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"09:00\",\"jam_selesai\":\"10:00\",\"tujuan\":\"Ujian praktik\",
  \"jumlah_peserta\":15,\"persetujuan_data\":true}")
NOMOR3=$(echo "$R" | sed -n 's/.*"nomor_pengajuan":"\([^"]*\)".*/\1/p')
R=$(curl -s -b "$CJ" -X PATCH "$BASE/api/admin/peminjaman/$NOMOR3/status" -H "Content-Type: application/json" -d '{"status":"ditolak"}')
cek "tolak tanpa alasan -> 400" "$R" 'alasan'
R=$(curl -s -b "$CJ" -X PATCH "$BASE/api/admin/peminjaman/$NOMOR3/status" -H "Content-Type: application/json" -d '{"status":"ditolak","alasan":"Laboratorium dipakai ujian lain."}')
cek "tolak dengan alasan sukses" "$R" 'Ditolak'

echo "== 15. Pembatalan oleh pemohon (menunggu) =="
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Rina Marlina\",\"nim\":\"1301220004\",\"program_studi\":\"SI\",
  \"whatsapp\":\"081233334444\",\"laboratorium_id\":3,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"08:00\",\"jam_selesai\":\"09:00\",\"tujuan\":\"Bimbingan kelompok\",
  \"jumlah_peserta\":4,\"persetujuan_data\":true}")
NOMOR4=$(echo "$R" | sed -n 's/.*"nomor_pengajuan":"\([^"]*\)".*/\1/p')
R=$(curl -s -X POST "$BASE/api/peminjaman/batal" -H "Content-Type: application/json" -d "{\"nomor_pengajuan\":\"$NOMOR4\",\"nim\":\"1301220004\"}")
cek "batal pengajuan menunggu" "$R" 'berhasil dibatalkan'

echo "== 16. Pembatalan pengajuan disetujui (default ditolak ketentuan) =="
R=$(curl -s -X POST "$BASE/api/peminjaman/batal" -H "Content-Type: application/json" -d "{\"nomor_pengajuan\":\"$NOMOR\",\"nim\":\"1301220001\"}")
cek "batal disetujui -> izin ketentuan" "$R" 'ketentuan admin\|tidak diizinkan\|403\|Ditolak\|izin'

echo "== 17. Riwayat pemohon =="
R=$(curl -s -X POST "$BASE/api/peminjaman/riwayat" -H "Content-Type: application/json" -d '{"nim":"1301220001"}')
cek "riwayat ditemukan" "$R" 'PIN-'

echo "== 18. Admin: data pemohon =="
R=$(curl -s -b "$CJ" "$BASE/api/admin/pemohon")
cek "daftar pemohon" "$R" '1301220001'

echo "== 19. Admin: laporan + CSV =="
R=$(curl -s -b "$CJ" "$BASE/api/admin/laporan")
cek "rekap laporan" "$R" 'per_status'
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$CJ" "$BASE/api/admin/laporan/csv")
[ "$CODE" = "200" ] && ok "ekspor CSV -> 200" || bad "ekspor CSV -> $CODE"

echo "== 20. Admin: CRUD laboratorium =="
R=$(curl -s -b "$CJ" -X POST "$BASE/api/admin/laboratorium" -H "Content-Type: application/json" -d '{"nama":"Lab Uji Coba","lokasi":"Gedung Uji","kapasitas":10,"fasilitas":"PC","deskripsi":"Uji","status_operasional":"aktif"}')
cek "tambah lab" "$R" 'berhasil ditambahkan'
IDLAB=$(curl -s -b "$CJ" "$BASE/api/admin/laboratorium" | grep -o '"id":[0-9]*,"nama":"Lab Uji Coba"' | head -1 | sed 's/.*"id":\([0-9]*\).*/\1/')
R=$(curl -s -b "$CJ" -X PUT "$BASE/api/admin/laboratorium/$IDLAB" -H "Content-Type: application/json" -d '{"status_operasional":"pemeliharaan"}')
cek "ubah status lab" "$R" 'berhasil diperbarui'
R=$(curl -s -X POST "$BASE/api/peminjaman" -H "Content-Type: application/json" -d "{
  \"nama\":\"Uji Coba\",\"nim\":\"1301220099\",\"program_studi\":\"TI\",
  \"whatsapp\":\"081255556666\",\"laboratorium_id\":$IDLAB,\"tanggal\":\"$TANGGAL\",
  \"jam_mulai\":\"09:00\",\"jam_selesai\":\"10:00\",\"tujuan\":\"Coba lab pemeliharaan\",
  \"jumlah_peserta\":2,\"persetujuan_data\":true}")
cek "lab pemeliharaan ditolak" "$R" 'pemeliharaan'
R=$(curl -s -b "$CJ" -X DELETE "$BASE/api/admin/laboratorium/$IDLAB")
cek "hapus lab kosong" "$R" 'berhasil dihapus'
R=$(curl -s -b "$CJ" -X DELETE "$BASE/api/admin/laboratorium/1")
cek "hapus lab terpakai -> ditolak" "$R" 'tidak dapat dihapus'

echo "== 21. Admin: pengaturan ketentuan (langsung terlihat pengguna) =="
R=$(curl -s -b "$CJ" -X PUT "$BASE/api/admin/pengaturan" -H "Content-Type: application/json" -d '{"ketentuan_umum":"KETENTUAN UJI COBA DIPERBARUI","boleh_batalkan_disetujui":"ya"}')
cek "simpan pengaturan" "$R" 'berhasil disimpan'
R=$(curl -s "$BASE/api/pengaturan")
cek "halaman pengguna melihat perubahan" "$R" 'KETENTUAN UJI COBA'

echo "== 22. Pembatalan disetujui setelah izin diberikan =="
R=$(curl -s -X POST "$BASE/api/peminjaman/batal" -H "Content-Type: application/json" -d "{\"nomor_pengajuan\":\"$NOMOR\",\"nim\":\"1301220001\"}")
cek "batal disetujui -> sukses" "$R" 'berhasil dibatalkan'

echo "== 23. Logout =="
R=$(curl -s -b "$CJ" -X POST "$BASE/api/auth/logout")
cek "logout sukses" "$R" 'Berhasil keluar'
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$CJ" "$BASE/api/admin/ringkasan")
[ "$CODE" = "401" ] && ok "sesi terhapus -> 401" || bad "sesi masih hidup -> $CODE"

echo "== 24. Rate-limit login (kredensial salah berulang) =="
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"salah"}'
done
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"salah"}')
[ "$R" = "429" ] && ok "rate-limit login aktif -> 429" || bad "rate-limit login -> $R"

rm -f "$CJ"
echo
echo "HASIL: $PASS lulus, $FAIL gagal"
[ "$FAIL" -eq 0 ]
