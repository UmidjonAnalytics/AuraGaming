# Kassa — multi-device setup (PC + telefon bir vaqtda)

The app now uses a **shared operation log** instead of saving one big file. Every action — add money, withdraw, sale, debt, price change, stocktake — is appended as a small record to one Google Sheet. Each device sends only its own new records and pulls everyone else's every few seconds.

**Why this matters:** nothing gets overwritten. If the PC records a sale at the same moment the phone records a debt, both are kept. (The old blob approach would have lost one of them.)

**Login to start:** `admin` / `admin`

---

## Setup (about 5 minutes, free)

### Step 1 — Create the Sheet
Go to **sheets.new**, name it e.g. **Kassa DB**.

### Step 2 — Add the script
**Extensions → Apps Script**. Delete the sample code, paste all of `Code.gs` (below), then Save.

### Step 3 — Deploy
1. **Deploy → New deployment → type: Web app**
2. *Execute as:* **Me**
3. *Who has access:* **Anyone**
4. **Deploy** → authorize → **copy the Web app URL** (it ends in `/exec`)

> "Anyone" only means the URL is reachable — the app still requires login. Treat the URL as semi-secret. For a club till this is normal; see *Security* below.

### Step 4 — Point the app at it
Open `index.html`, near the top of the `<script>` find `CONFIG` and paste your URL:

```js
const CONFIG = {
  BUSINESS_DAY_CUTOFF_HOUR: 6,
  LOW_STOCK: 3,
  CURRENCY: "so'm",
  SHEETS_API_URL: 'https://script.google.com/macros/s/XXXX/exec',   // <-- paste here
  POLL_MS: 4000
};
```

### Step 5 — Host it (free)
Upload `index.html` to **GitHub Pages** (repo → Settings → Pages → branch `main`, root). Open the resulting `https://…github.io/…` link on the PC and the phone. Both log in, both see the same data.

HTTPS is required for the camera, which GitHub Pages gives you. Netlify Drop or Cloudflare Pages work the same way.

---

## Code.gs — paste into Apps Script

```javascript
/** Kassa backend — append-only operation log (multi-device safe). */
const SHEET = 'OPS';
const CHUNK = 45000;     // max chars per cell (sheet limit is 50k)
const PAY_COLS = 8;      // payload spread over columns E..L

function sh_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET);
    s.appendRow(['seq', 'uid', 'ts', 'user', 'type', 'payload']);
  }
  return s;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);                      // one writer at a time
  try {
    const body = JSON.parse(e.postData.contents);
    const s = sh_();
    const last = s.getLastRow();

    // existing uids -> ignore duplicates (safe retries)
    const seen = {};
    if (last > 1) {
      s.getRange(2, 2, last - 1, 1).getValues().forEach(function (r) { seen[r[0]] = true; });
    }

    const incoming = body.ops || [];
    const rows = [];
    let seq = last > 1 ? Number(s.getRange(last, 1).getValue()) : 0;

    incoming.forEach(function (op) {
      if (seen[op.uid]) return;              // already stored
      seq++;
      const payload = JSON.stringify(op.p || {});
      const row = [seq, op.uid, op.ts, op.user, op.type];
      for (let i = 0; i < PAY_COLS; i++) row.push(payload.substr(i * CHUNK, CHUNK));
      rows.push(row);
    });
    if (rows.length) {
      s.getRange(s.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return json_({ ok: true, ops: readSince_(s, Number(body.since) || 0) });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const since = e && e.parameter ? Number(e.parameter.since) || 0 : 0;
  return json_({ ok: true, ops: readSince_(sh_(), since) });
}

function readSince_(s, since) {
  const last = s.getLastRow();
  if (last < 2) return [];
  const values = s.getRange(2, 1, last - 1, 5 + PAY_COLS).getValues();
  const out = [];
  values.forEach(function (r) {
    const seq = Number(r[0]);
    if (!seq || seq <= since) return;
    let payload = '';
    for (let i = 0; i < PAY_COLS; i++) payload += (r[5 + i] || '');
    let p = {};
    try { p = JSON.parse(payload || '{}'); } catch (err) { p = {}; }
    out.push({ seq: seq, uid: r[1], ts: r[2], user: r[3], type: r[4], p: p });
  });
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## How the multi-device behaviour works

- **Instant on your screen.** An action shows immediately, then syncs in the background.
- **Badge under the title:** `Sinxron` (synced) · a number (records waiting to send) · `Oflayn` (no connection).
- **Offline is safe.** If the internet drops, actions queue on the device and upload automatically when it returns — nothing is lost.
- **Every 4 seconds** each device pulls what the others did, so the phone sees a PC sale within seconds and vice-versa.
- **Duplicate protection:** each record has a unique id, so a retry can never double-count money.
- **Stock is the one thing to watch:** if two devices sell the last bottle at the same second, both sales are recorded and stock can go to −1. Real-world risk at one bar is low, and the stocktake corrects it. Tell me if you want a hard server-side stock check.

## Security (worth knowing)
Passwords are stored in plain text in the Sheet, and the Web App URL is the only gate. That's typical for a small in-house till, but it means anyone with the URL could read data. If you want, I can add password hashing and a shared club key that devices must send.

## Assumptions I made
- Bar items given on credit **leave the stock immediately**; only the money waits in Qarz until paid.
- Debt repayment has a **Naqd/Karta** toggle (the spec didn't say which method a repayment arrives as).
- If you type only the **total** in the payback popup, it clears PC first, then Bar. Type into the PC/Bar boxes to control the split exactly.
- Business day = anything before **06:00** counts as yesterday (`BUSINESS_DAY_CUTOFF_HOUR`), editable on every date field.
- Photos are compressed to ~260px so they fit in the Sheet. Fine for a normal drinks/snacks catalog.

## Camera note
Barcode scanning uses the browser's built-in detector — works on **Chrome/Android and Chrome on desktop over HTTPS**. iOS Safari doesn't support it yet; there, the **name search (3+ letters)** and **manual barcode entry** are available everywhere a scanner appears, so nothing is blocked.
