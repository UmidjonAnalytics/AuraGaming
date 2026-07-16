# Getting the .apk to send to staff

I can't compile the `.apk` inside this chat — that needs the Android SDK, which isn't available here. But there are two easy ways to get a **real, signed APK**, and I've prepared everything for both. Route 1 needs no software installed.

---

## Route 1 — PWABuilder (no tools, ~10 minutes) ✅ recommended

This is a free web tool that turns your hosted app into a signed APK you can send straight to staff.

**Prerequisite:** the app must be online first (needed anyway for the app to run). Host the folder on **GitHub Pages** — upload these files to a repo, then Settings → Pages → branch `main`:
```
index.html   manifest.webmanifest   sw.js
icon-192.png   icon-512.png   icon-maskable-512.png
vendor/jspdf.umd.min.js
```
You'll get a link like `https://YOURNAME.github.io/kassa/`.

Then:
1. Open **https://www.pwabuilder.com**
2. Paste your GitHub Pages URL → **Start**.
3. Click **Package for stores → Android**.
4. Choose **"Signed APK"** (for sending directly) — leave the defaults, package id e.g. `uz.gameclub.kassa`.
5. Download the zip. Inside is **`app-release-signed.apk`** and a `signing.keystore` — **keep the keystore file safe**, you'll need it to release updates.

Send `app-release-signed.apk` to staff (Telegram, USB, etc.). On their phone: open it → allow "install from unknown sources" → installed.

> Because the app is hosted, you can fix bugs by re-uploading `index.html` — installed phones get the update automatically. You only rebuild the APK if you change the icon or app name.

---

## Route 2 — Build the project I prepared (offline, needs Android Studio)

I bundled your app into a ready Capacitor project: **`kassa-android-project.zip`**. Camera permission and the app name are already set, and the web files are already inside.

1. Install **Android Studio** (free).
2. Unzip `kassa-android-project.zip`.
3. Android Studio → **Open** → select the `kassa-apk/android` folder. Let it finish downloading Gradle/SDK the first time.
4. Menu **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
5. When it finishes, click **locate** — that's your APK at
   `android/app/build/outputs/apk/debug/app-debug.apk`.

A **debug** APK installs fine for staff. For a smaller/production one, use **Build → Generate Signed Bundle/APK** and let it create a keystore (save it).

### If you change the web app later (Route 2)
Replace the files in `kassa-apk/www/`, then from the `kassa-apk` folder run `npm install` once, then `npx cap sync`, and rebuild.

---

## Which route for you

You said you just need an APK to send to staff → **Route 1 (PWABuilder)**. No installs, gives you a signed APK, and updates flow to phones automatically because the app is hosted.

The only thing I need from you that I can't do: create the GitHub Pages link (it's tied to your account). Once you have that URL, PWABuilder does the rest. If you paste me the URL after hosting, I'll walk you through the PWABuilder screens.

## Notes
- **Camera/barcode** works in both routes (the WebView is set to grant camera automatically).
- **Reports (PDF)** now work fully offline — jsPDF is bundled locally in `vendor/`, no internet needed.
- **Google Sheets sync** still needs internet (that's the whole point of multi-device). Offline, the app queues actions and uploads when back online.
- **iPhone:** no APK needed — Share → Add to Home Screen. Camera auto-scan isn't supported by iOS Safari, so use name search / manual barcode there.
