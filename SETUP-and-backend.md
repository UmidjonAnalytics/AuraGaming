# Kassa — backend & analyst-friendly Google Sheet

The app syncs across all devices through Google Sheets, and the backend also writes **clean, tidy tabs** you can pivot, chart and build custom reports from — without ever touching the app.

**Login to start:** `admin` / `admin`

---

## How the data is organised

Two kinds of tabs, kept separate on purpose:

- **`_LOG` (hidden)** — the app's own append-only operation log. The app reads and writes only this. It's how PC + phone stay in sync. **Don't edit it by hand.**
- **Analyst tabs (output only)** — the backend fans every operation into these with proper columns. The app never reads them, so you're free to sort, add helper columns to the right, build pivots, or restyle. If you ever want them regenerated, use the menu **Kassa → Tahlil jadvallarini qayta qurish**.

### The clean tabs

**SALES** — one row per product sold (best for pivots)
| Vaqt | Sana | Kassir | Mahsulot | Shtrix-kod | Soni | Narx | Summa | Tolov |
|---|---|---|---|---|---|---|---|---|
timestamp | business day | who sold | product name | barcode | qty | unit price | qty×price | Naqd/Karta

**MONEY** — manual add/withdraw (not sales, not debt)
| Vaqt | Sana | Kassir | Joy | Yonalish | Tolov | Summa | Kategoriya |
|---|---|---|---|---|---|---|---|
timestamp | business day | who | PC/BAR | Kirim/Chiqim | Naqd/Karta | amount | reason (for withdrawals)

**DEBT** — debt given and repaid
| Vaqt | Sana | Kassir | Qarzdor | Turi | Tolov | Summa |
|---|---|---|---|---|---|---|
timestamp | business day | who recorded | debtor name | Berildi/To'landi | Naqd/Karta (payments) | amount

**STOCK** — inventory movements
| Vaqt | Sana | Kassir | Amal | Mahsulot | Shtrix-kod | Ozgarish |
|---|---|---|---|---|---|---|
… | … | … | Kirim (+) / Sotildi (−) / Inventar (counted) | product | barcode | signed qty (Inventar = counted total)

**PRODUCTS** — current catalog (dimension table for joins): `Shtrix-kod, Mahsulot, Narx`
**USERS** — staff (dimension): `Login, Rol` (no passwords in the clean tabs)

### Computing the live balances from the tabs
So your dashboards match the app exactly:
- **Bar cash** = SALES(Summa where Tolov=Naqd) + MONEY(PC? no → BAR: Kirim−Chiqim where Tolov=Naqd)
- **PC cash** = MONEY(PC, Naqd: Kirim−Chiqim) + DEBT(To'landi, Naqd)
- **PC card** = MONEY(PC, Karta: Kirim−Chiqim) + DEBT(To'landi, Karta)
- **Outstanding debt** = DEBT(Berildi) − DEBT(To'landi)
- **Bar revenue** = SALES(Summa)
Tip: a single PivotTable on each tab (rows = Sana or Kassir or Mahsulot, values = sum of Summa) covers most day-to-day questions.

---

## Setup (≈5 minutes, free)

1. **sheets.new** → name it e.g. *Kassa DB*.
2. **Extensions → Apps Script** → delete the sample → paste all of `Code.gs` → Save.
3. **Deploy → New deployment → Web app**, *Execute as:* **Me**, *Who has access:* **Anyone** → **Deploy** → authorize → copy the `…/exec` URL.
4. In `index.html`, set:
   ```js
   SHEETS_API_URL: 'https://script.google.com/macros/s/XXXX/exec',
   ```
5. Host `index.html` (+ `manifest.webmanifest`, `sw.js`, the icons, and `vendor/jspdf.umd.min.js`) on GitHub Pages. Open on PC and phone; both log in and stay in sync.

The clean tabs appear automatically the first time any data is entered. Reload the Sheet after the first sync to see the **Kassa** menu.

`Code.gs` is provided as a separate file in this folder.

---

## Multi-device behaviour (unchanged)
- Actions show instantly, then sync in the background (badge under the title: `Sinxron` / a number / `Oflayn`).
- Offline actions queue on the device and upload when the connection returns.
- Each record has a unique id, so retries never double-count.
- One writer at a time on the server (a lock), so simultaneous PC + phone writes both land.

## Security
Passwords live in `_LOG` (the app needs them to log in) but are **not** copied into the visible USERS tab. The Web App URL is the only gate — treat it as semi-secret. Ask me to add password hashing + a shared club key if you want it hardened before staff use.

## Assumptions
- Debt is a **PC payment method** (Naqd / Karta / Qarz). Bar sells only for cash/card.
- Debt is recorded **without a name by default** (optional; add the name at payback). Unnamed debt shows as `Noma'lum`.
- Business day: anything before **06:00** counts as the previous day (`BUSINESS_DAY_CUTOFF_HOUR`), editable on every date field.
- Product photos are compressed (~260px) so they stay small.

## Camera
Barcode scanning + beep/vibration work on **Chrome/Android over HTTPS**. iOS Safari has no auto-scanner, so there use name search / manual entry.
