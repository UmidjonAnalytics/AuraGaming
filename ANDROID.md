# Android ilova — 2 yo'l

You don't need a second codebase. The same `index.html` becomes the Android app.

| | **A. Install as app (PWA)** | **B. Real .apk (Play Store)** |
|---|---|---|
| Setup time | ~2 minutes | ~1 hour, one time |
| Cost | Free | Free (Play Store: $25 one-time, optional) |
| Home-screen icon | Yes | Yes |
| Fullscreen, no browser bar | Yes | Yes |
| Camera / barcode | Yes | Yes |
| Works offline | Yes | Yes |
| Updates | Automatic — you edit the file, staff get it | Automatic (content updates), APK only for icon/name changes |
| Install method | Open link → "Install" | Send APK file or Play Store |

**Start with A.** B only matters if you want it in the Play Store or want to hand staff an installable file.

---

## A. Install on Android (already built — nothing more to do)

1. Host the folder on **GitHub Pages** (HTTPS is required for camera + install).
   Upload these files to the repo root:
   ```
   index.html
   manifest.webmanifest
   sw.js
   icon-192.png
   icon-512.png
   icon-maskable-512.png
   ```
2. On the Android phone, open the `https://…github.io/…` link in **Chrome**.
3. Tap **"Ilovani o'rnatish"** (the button now appears on the login screen and in Sozlamalar), or Chrome menu → **Install app / Add to Home screen**.

Result: a **Kassa** icon on the home screen. It opens fullscreen with no address bar, keeps working when the internet drops, and syncs with the PC through the same Sheet. Long-press the icon for shortcuts straight to **Bar** or **Qarz**.

On the PC, Chrome shows an install icon in the address bar — same app, on the desktop.

---

## B. Turning it into a real .apk

Two options. **Bubblewrap** is by far the easier one and gives a Play-Store-ready app.

### Option B1 — Bubblewrap (recommended)
Wraps your hosted PWA into a native Android package. On your computer (needs Node.js + Java JDK 17):

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://YOURNAME.github.io/kassa/manifest.webmanifest
# answer the prompts (app name: Kassa, package id: uz.yourclub.kassa)
bubblewrap build
```

You get `app-release-signed.apk` — install it on any Android phone, or upload the `.aab` to the Play Console.

> To remove the small browser URL bar at the top, verify ownership with Digital Asset Links: Bubblewrap prints an `assetlinks.json`; put it at `https://YOURNAME.github.io/.well-known/assetlinks.json`. Without it the app still works, just shows a thin address bar for a second.

### Option B2 — Capacitor (bundles the files inside the APK)
Better if you want the app to open with **zero** network on first launch, or to add native features later (native barcode SDK, printer, etc.):

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Kassa uz.yourclub.kassa --web-dir=www
mkdir www && cp index.html manifest.webmanifest sw.js icon-*.png www/
npx cap add android
npx cap sync
npx cap open android      # opens Android Studio → Build → Build APK
```

Requires **Android Studio** installed. Camera permission is already handled by the WebView prompt.

---

## Which one to pick

- Staff use their own phones, you want zero friction → **A (PWA)**. This is what most small tills use.
- You want to hand out an installable file or list it on the Play Store → **B1 (Bubblewrap)**.
- You later want a native barcode scanner or receipt printer → **B2 (Capacitor)**.

Either way, the data, login, roles and Google Sheets sync stay exactly the same — the phone and the PC remain in sync.

## Note on iPhone
iOS can also add it to the home screen (Share → Add to Home Screen), but Safari doesn't yet support the automatic barcode detector — on iPhone, use the **name search (3+ letters)** or type the barcode. Everything else works.
