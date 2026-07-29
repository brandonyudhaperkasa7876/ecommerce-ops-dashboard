# ECommerce Operation Monitoring & Controlling

Dashboard terpadu yang menggabungkan tiga sistem operasi e-commerce menjadi **satu aplikasi** dengan tampilan mewah dan seragam (tema *Onyx & Gold*):

1. **Monitoring JUBELIO** — penggabungan JUBELIO × Infinity (LPH/Transfer) × SAP, deteksi kelengkapan SO/TI/TO, duplikat SO, fuzzy‑match, chart & tabel.
2. **Jubelio Sales Database** — merge YTD / Template / MTD dengan **pivot dipertahankan & auto‑refresh**, ringkasan *Diaz* (Unit & Value per Lokasi × Division).
3. **Berita Acara** — editor dokumen resmi + lampiran (gambar/PDF) + arsip + ekspor PDF.

Upload & download **diproses melalui GitHub + Vercel**: ketika **Super Admin** mem‑publish data, seluruh pengguna di semua perangkat otomatis melihat versi yang sama.

---

## 1. Cara kerja singkat

- **Frontend** = satu file statis `index.html` (di‑host di Vercel).
- **Backend** = *Vercel Serverless Functions* di folder `api/` yang membaca/menulis file JSON di **repo GitHub** memakai token rahasia.
- **Token GitHub tidak pernah** dikirim ke browser — hanya tersimpan sebagai *Environment Variable* di Vercel. Ini bagian "aman" yang Anda pilih.
- Sebelum di‑deploy, `index.html` tetap bisa dibuka langsung (double‑click) dan berjalan **mode lokal** (localStorage) untuk uji coba.

---

## 2. Struktur folder repo (WAJIB seperti ini)

Karena file di paket ini bernama datar (flat), susun ulang menjadi struktur berikut sebelum push:

```
ecommerce-ops-dashboard/
├── index.html                ← dashboard (buka file ini)
├── League.png                ← logo brand (auth & kop Berita Acara)
├── League-mark.png           ← logo trapesium "L" untuk menu bar / sidebar
├── package.json
├── vercel.json
├── api/
│   ├── _lib.js
│   ├── health.js
│   ├── auth.js
│   ├── data.js
│   └── berita.js
└── data/
    ├── users.json
    ├── monitoring.json
    ├── sales.json
    └── berita.json
```

### Pemetaan nama file paket → lokasi di repo

| File di paket ini        | Letakkan menjadi        |
|--------------------------|-------------------------|
| `index.html`             | `index.html`            |
| `League.png`             | `League.png` (root, sebelah index.html) |
| `League-mark.png`        | `League-mark.png` (root — logo menu bar) |
| `package.json`           | `package.json`          |
| `vercel.json`            | `vercel.json`           |
| `_lib.js`                | `api/_lib.js`           |
| `health.js`              | `api/health.js`         |
| `auth.js`                | `api/auth.js`           |
| `data.js`                | `api/data.js`           |
| `berita.js`              | `api/berita.js`         |
| `data.users.json`        | `data/users.json`       |
| `data.monitoring.json`   | `data/monitoring.json`  |
| `data.sales.json`        | `data/sales.json`       |
| `data.berita.json`       | `data/berita.json`      |
| `env.example.txt`        | *(referensi saja — jangan di‑push)* |

> Lima file `.js` (`_lib.js, health.js, auth.js, data.js, berita.js`) masuk ke folder **`api/`**.
> Empat file JSON: buang awalan `data.` lalu masuk ke folder **`data/`** (mis. `data.users.json` → `data/users.json`).

---

## 3. Langkah deploy

### Langkah A — Buat repo GitHub
1. Buat repo baru, mis. **`ecommerce-ops-dashboard`** (boleh *Private*).
2. Susun file sesuai struktur di atas, lalu commit & push. (Bisa lewat web GitHub: *Add file → Upload files*, atau `git`.)

### Langkah B — Buat GitHub Personal Access Token
1. GitHub → **Settings → Developer settings → Personal access tokens → Fine‑grained tokens → Generate new token**.
2. **Repository access**: pilih repo tadi.
3. **Permissions → Repository permissions → Contents: Read and write**.
4. Generate, lalu **salin token** (`github_pat_...`). Simpan aman — token hanya tampil sekali.

### Langkah C — Import ke Vercel
1. Masuk [vercel.com](https://vercel.com) → **Add New → Project** → pilih repo GitHub tadi.
2. Framework Preset: **Other** (biarkan default; sudah diatur di `vercel.json`).
3. Sebelum klik Deploy, buka **Environment Variables** dan isi:

| Name                 | Value                                   |
|----------------------|-----------------------------------------|
| `GITHUB_OWNER`       | username/organisasi GitHub Anda         |
| `GITHUB_REPO`        | nama repo (mis. `ecommerce-ops-dashboard`) |
| `GITHUB_BRANCH`      | `main`                                  |
| `GITHUB_TOKEN`       | token dari Langkah B                     |
| `ADMIN_PIN`          | PIN publish, mis. `10111976`            |
| `SUPER_ADMIN_EMAIL`  | email Super Admin (jadi admin otomatis) |
| `SEED_ADMIN_PASSWORD`| password Super Admin (dibuat otomatis)  |
| `SEED_ADMIN_PIN`     | PIN akun Super Admin (opsional)         |
| `SEED_ADMIN_NAME`    | nama tampilan Super Admin (opsional)    |

> **Akun Super Admin dibuat otomatis** oleh server dari 3 variabel `SUPER_ADMIN_EMAIL` +
> `SEED_ADMIN_PASSWORD` + `SEED_ADMIN_PIN` saat aplikasi pertama diakses. Password/PIN
> hanya tersimpan sebagai Environment Variable di Vercel — **tidak** ada di repo publik.
> Anda tinggal **Masuk** memakai email & password tersebut (tidak perlu Daftar).

4. Klik **Deploy**. Setelah selesai Anda dapat URL, mis. `https://ecommerce-ops-dashboard.vercel.app`.

### Langkah D — Masuk sebagai Super Admin
1. Akun Super Admin sudah **dibuat otomatis** dari Environment Variables. Buka URL Vercel → tab **Masuk** → gunakan:
   - Email: `SUPER_ADMIN_EMAIL` (mis. `brandonyudhaperkasa7876@gmail.com`)
   - Password: `SEED_ADMIN_PASSWORD` (mis. `yd10111976`)
2. Anda langsung berperan **Super Admin**. (Tidak perlu Daftar.)
3. Pengguna lain yang **Daftar** akan berperan **Viewer** (hanya melihat data yang sama).

Selesai. Semua perangkat yang membuka URL tersebut melihat data & tampilan identik.

---

## 4. Cara pakai

- **Super Admin**: buka modul → panel *Update Database* → unggah file Excel → **Proses & Publish ke Cloud**. Masukkan **PIN publish** (`ADMIN_PIN`). Data ter‑commit ke GitHub.
- **Semua pengguna**: cukup buka dashboard → data terbaru otomatis dimuat dari Cloud (tombol **Muat ulang** untuk sinkron manual).
- **Download**: hasil Excel (Monitoring & Sales) dan PDF (Berita Acara) tersedia untuk semua pengguna, bersumber dari versi yang sama di GitHub.

---

## 5. Konfigurasi frontend (opsional)

Di bagian atas `<script>` dalam `index.html` ada blok `window.CONFIG`:

```js
window.CONFIG = {
  API_BASE: "",            // kosongkan bila frontend & API satu domain Vercel
  SUPER_ADMIN_EMAIL: "",   // hanya untuk mode lokal
  ADMIN_PIN: "10111976"    // hanya untuk mode lokal
};
```

Jika frontend di‑host terpisah dari API, isi `API_BASE` dengan URL Vercel (mis. `https://ecommerce-ops-dashboard.vercel.app`).

---

## 6. Catatan & batasan

- **Ukuran unggahan Sales**: workbook di‑publish sebagai base64. Vercel *Hobby* membatasi body request ± 4.5 MB. Untuk file SAP/Template yang besar gunakan plan yang lebih tinggi, atau publish hanya ringkasan. Mode lokal tidak dibatasi.
- **Keamanan token**: jangan pernah menaruh `GITHUB_TOKEN` di `index.html` atau `window.CONFIG`. Token hanya di Environment Variables Vercel.
- **PIN**: `ADMIN_PIN` untuk publish dataset; PIN pribadi pengguna dipakai untuk edit Berita Acara (server juga menerima `ADMIN_PIN`).
- **Data awal**: file di `data/` sengaja kosong; akan terisi otomatis saat publish pertama.

---

## 7. Uji tanpa deploy (mode lokal)

Cukup buka `index.html` di browser. Aplikasi berjalan dengan penyimpanan `localStorage`:
akun & data hanya di perangkat itu (belum tersinkron). Ini untuk mencoba tampilan/alur sebelum deploy. Setelah deploy ke Vercel, mode Cloud otomatis aktif.

---

---

## 8. Perintah git untuk push ke GitHub

Jalankan dari dalam folder proyek yang **sudah disusun** sesuai struktur di Bagian 2
(pastikan `index.html`, `League.png`, folder `api/` dan `data/` sudah ada).

**Pertama kali (repo baru):**

```bash
# 1. inisialisasi
git init
git branch -M main

# 2. abaikan file rahasia / sampah
printf ".env\n.vercel\nnode_modules/\n.DS_Store\n" > .gitignore

# 3. commit semua
git add .
git commit -m "ECommerce Operation Monitoring & Controlling — initial (LEAGUE / PT. Berca Sportindo)"

# 4. hubungkan ke repo GitHub Anda (ganti URL sesuai repo)
git remote add origin https://github.com/<USERNAME>/ecommerce-ops-dashboard.git

# 5. push
git push -u origin main
```

**Update berikutnya (setiap ada perubahan):**

```bash
git add .
git commit -m "update dashboard"
git push
```

> Setelah push, Vercel yang sudah terhubung ke repo akan **otomatis re-deploy**.
> Jangan pernah `git add` file `.env` berisi token asli — sudah dicegah oleh `.gitignore` di atas.

---

*Template ini dibuat dan disiapkan oleh **BYP** kolaborasi dengan **CLAUDE AI** — untuk PT. Berca Sportindo (Brand LEAGUE).*
