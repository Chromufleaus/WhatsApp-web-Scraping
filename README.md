# WhatsApp JSON + Image Exporter v0.2.0

v0.9.2 memfokuskan perbaikan pada alur Community dan keamanan queue ekspor. Scanner selalu memulai dari Chats, memindai All + Groups, lalu berpindah ke Communities. Daftar nama Community dikumpulkan terlebih dahulu sebagai snapshot; setelah itu Community dibuka satu per satu berdasarkan snapshot tersebut. Cara ini menghindari row virtual yang berubah saat panel detail dibuka/ditutup.

## Perubahan utama

- Traversal Community tidak lagi membuka Community sambil men-scroll index. Index dipindai dulu, lalu nama Community diproses satu per satu.
- Subgroup Community dipisahkan berdasarkan status membership UI. Bagian `Groups you're in` / padanan Indonesia dianggap aktif. Bagian `Groups you can join`, `Other groups`, serta row yang menawarkan `Join group` atau `Request to join` dilewati.
- Announcements/Pengumuman tetap dilewati.
- Subgroup yang lolos scan tetapi ketika dibuka ternyata menampilkan Join/Request akan dicatat `skipped` dan queue ekspor tetap lanjut ke chat berikutnya.
- Setelah kegagalan satu chat, ekstensi melakukan recovery ke Chats/All sebelum melanjutkan queue.
- Header subgroup Community sekarang dikonfirmasi memakai nama subgroup, bukan nama Community.
- Search, multi-chat, dynamic scroll, `reply_to.sequence`, ekspor gambar readable, dan path media di JSON tetap dipertahankan.

## Alur scan

1. Paksa buka **Chats**.
2. Scan **All**.
3. Scan **Groups** + verification pass.
4. Buka **Communities**.
5. Scan index Communities sampai bawah dan simpan snapshot nama Community.
6. Untuk setiap nama Community:
   - buka index Communities,
   - cari Community berdasarkan nama,
   - buka detail,
   - scan dari atas ke bawah,
   - simpan hanya subgroup aktif/yang sudah diikuti,
   - skip Announcements dan subgroup yang masih bisa di-Join/Request,
   - kembali ke index.
7. Rekonsiliasi hasil Community authoritative dengan hasil All/Groups.
8. Kembali ke Chats/All.

## Instalasi

1. Ekstrak ZIP.
2. Buka `chrome://extensions` atau `edge://extensions`.
3. Aktifkan Developer mode.
4. Klik **Load unpacked**.
5. Pilih folder `whatsapp-json-exporter-v0.9.2`.
6. Reload WhatsApp Web dengan `Ctrl+Shift+R`.
7. Klik **Pindai** dan jangan berinteraksi dengan sidebar selama scan.

## Catatan

WhatsApp Web memakai DOM virtual dan bukan API publik. Label membership dapat berbeda antar bahasa/rollout. v0.9.2 mengenali label English/Indonesia umum dan juga mengecek aksi Join/Request sebagai guard tambahan. Jika UI WhatsApp mengubah istilah lagi, scanner mungkin perlu pembaruan.
