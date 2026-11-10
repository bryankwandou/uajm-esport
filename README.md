# UKM Esport UAJM 2026 - Tournament Platform

Platform bagan turnamen resmi, rundown jadwal pertandingan, dan regulasi kompetisi Mobile Legends: Bang Bang untuk kejuaraan UKM Esport Universitas Atma Jaya Makassar (UAJM) 2026.

## Tautan Resmi

- Domain Produksi Vercel: https://uajm-esport.vercel.app
- Portal Admin: https://uajm-esport.vercel.app/admin
- Repositori GitHub: https://github.com/bryankwandou/uajm-esport
- GitHub Pages: https://bryankwandou.github.io/uajm-esport/
- Bagan Referensi Challonge: https://challonge.com/6ayo1xlk

## Spesifikasi Kompetisi

- Total Tim: 58 Tim Peserta
- Format Turnamen: Single Elimination (Sistem Gugur Tunggal)
- Total Pertandingan: 58 Pertandingan
- Durasi Pelaksanaan: 3 Hari (10 - 12 November 2026)
  - Day 1 (10 Nov 2026): Round 1, Round of 32, Round of 16, Quarterfinals (BO1)
  - Day 2 (11 Nov 2026): Semifinals (BO3)
  - Day 3 (12 Nov 2026): 3rd Place Match (BO3) & Grand Final (BO5)
- Sinkronisasi Data: Firebase Realtime Database dengan fallback penyimpanan lokal

## Fitur Utama

1. Bagan Turnamen Interaktif:
   - Desain minimalis terinspirasi langsung dari struktur pohon Challonge
   - Penyorotan jalur tim secara otomatis saat kursor diarahkan ke nama tim
   - Kontrol pembesaran tampilan bagan (zoom in, zoom out, reset)
   - Kolom pencarian tim untuk penyaringan cepat posisi bagan

2. Rundown Jadwal Komprehensif:
   - Penyaringan per hari pelaksanaan (Day 1, Day 2, Day 3)
   - Pengelompokan babak dan kloter waktu pertandingan
   - Penandaan siaran langsung untuk babak Semifinals dan Finals

3. Direktori 58 Tim:
   - Penomoran seed resmi dari 1 hingga 58
   - Status penempatan awal tim (termasuk 6 tim dengan status BYE)
   - Penyaringan tim aktif, lolos BYE, dan tereliminasi

4. Regulasi Resmi:
   - Buku panduan turnamen lengkap dalam 9 bab
   - Pencarian pasal dan regulasi secara real-time

5. Panel Kontrol Khusus Admin:
   - Akses eksklusif melalui rute `/admin`
   - Pembaruan status pemenang pertandingan secara langsung ke Firebase Realtime Database
   - Tanpa tombol login admin pada antarmuka publik

## Struktur Berkas

```
uajm-esport/
├── admin/
│   ├── index.html
│   └── admin.js
├── admin.html
├── app.js
├── bracket-data.js
├── index.html
├── package.json
├── README.md
├── rules-data.js
├── styles.css
├── teams-data.js
└── vercel.json
```

## Lisensi

Didistribusikan di bawah lisensi MIT untuk UKM Esport UAJM.
