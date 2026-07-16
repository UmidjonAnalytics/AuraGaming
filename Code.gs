/*  KASSA backend — v2 (analyst-friendly)
    -----------------------------------------------------------------
    • The APP talks only to the hidden "_LOG" tab (append-only op log).
      That keeps multi-device sync safe. Don't edit _LOG by hand.
    • Every operation is ALSO fanned out into clean, human-readable
      tabs with proper columns — SALES / MONEY / DEBT / STOCK /
      PRODUCTS / USERS — for pivots, charts and custom reports.
      These tabs are OUTPUT ONLY: the app never reads them, so you can
      restyle, add columns to the right, or build dashboards freely.
    • Menu "Kassa → Tahlil jadvallarini qayta qurish" rebuilds all the
      clean tabs from _LOG at any time (e.g. after you restructure).
    ----------------------------------------------------------------- */

const LOG   = '_LOG';
const CHUNK = 45000;
const PAY_COLS = 8;

// Clean tabs + their header rows (Uzbek, analyst-friendly)
const TABS = {
  SALES:    ['Vaqt','Sana','Kassir','Mahsulot','Shtrix-kod','Soni','Narx','Summa','Tolov'],
  MONEY:    ['Vaqt','Sana','Kassir','Joy','Yonalish','Tolov','Summa','Kategoriya'],
  DEBT:     ['Vaqt','Sana','Kassir','Qarzdor','Turi','Tolov','Summa'],
  STOCK:    ['Vaqt','Sana','Kassir','Amal','Mahsulot','Shtrix-kod','Ozgarish'],
  PRODUCTS: ['Shtrix-kod','Mahsulot','Narx'],
  USERS:    ['Login','Rol']
};

/* ---------------- APP endpoint (unchanged contract) ---------------- */
function doPost(e){
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try{
    const body = JSON.parse(e.postData.contents);
    const s = logSheet_();
    const last = s.getLastRow();

    const seen = {};
    if (last > 1) s.getRange(2,2,last-1,1).getValues().forEach(r => seen[r[0]] = true);

    const incoming = body.ops || [];
    const rows = [];
    const fresh = [];
    let seq = last > 1 ? Number(s.getRange(last,1).getValue()) : 0;

    incoming.forEach(op => {
      if (seen[op.uid]) return;
      seq++;
      const payload = JSON.stringify(op.p || {});
      const row = [seq, op.uid, op.ts, op.user, op.type];
      for (let i=0;i<PAY_COLS;i++) row.push(payload.substr(i*CHUNK, CHUNK));
      rows.push(row);
      fresh.push({seq:seq, uid:op.uid, ts:op.ts, user:op.user, type:op.type, p:(op.p||{})});
    });
    if (rows.length) s.getRange(s.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);

    if (fresh.length) fanout_(fresh);   // -> clean analyst tabs

    return json_({ ok:true, ops: readSince_(s, Number(body.since)||0) });
  }catch(err){
    return json_({ ok:false, error:String(err) });
  }finally{ lock.releaseLock(); }
}

function doGet(e){
  const since = e && e.parameter ? Number(e.parameter.since)||0 : 0;
  return json_({ ok:true, ops: readSince_(logSheet_(), since) });
}

/* ---------------- _LOG helpers ---------------- */
function logSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(LOG);
  if (!s){
    s = ss.insertSheet(LOG);
    s.appendRow(['seq','uid','ts','user','type','payload']);
    s.hideSheet();
  }
  return s;
}
function readSince_(s, since){
  const last = s.getLastRow();
  if (last < 2) return [];
  const vals = s.getRange(2,1,last-1,5+PAY_COLS).getValues();
  const out = [];
  vals.forEach(r => {
    const seq = Number(r[0]); if (!seq || seq <= since) return;
    let payload=''; for (let i=0;i<PAY_COLS;i++) payload += (r[5+i]||'');
    let p={}; try{ p=JSON.parse(payload||'{}'); }catch(e){ p={}; }
    out.push({seq:seq, uid:r[1], ts:r[2], user:r[3], type:r[4], p:p});
  });
  return out;
}

/* ---------------- fan-out to clean tabs ---------------- */
function fanout_(ops){
  const prod = productMap_();                       // barcode -> {name, price}
  const buckets = { SALES:[], MONEY:[], DEBT:[], STOCK:[] };
  const prodUpserts = [];
  const userUpserts = [];
  const userDeletes = [];
  const M = m => m==='cash' ? 'Naqd' : m==='card' ? 'Karta' : m==='debt' ? 'Qarz' : m;

  ops.forEach(op => {
    const p = op.p || {}, ts = new Date(op.ts), date = p.date || '', user = op.user || '';
    switch(op.type){
      case 'sale':
        (p.items||[]).forEach(it => {
          buckets.SALES.push([ts,date,user,it.name,it.barcode,it.qty,it.price,it.qty*it.price,M(p.method)]);
          buckets.STOCK.push([ts,date,user,'Sotildi',it.name,it.barcode,-it.qty]);
        });
        break;
      case 'money':
        if (p.method==='debt') buckets.DEBT.push([ts,date,user,p.name||"Noma'lum",'Berildi','',p.amount]);
        else buckets.MONEY.push([ts,date,user,p.safe,(p.dir==='in'?'Kirim':'Chiqim'),M(p.method),p.amount,p.reason||'']);
        break;
      case 'debt_pay':
        buckets.DEBT.push([ts,date,user,p.name||"Noma'lum","To'landi",M(p.method),p.amount]);
        break;
      case 'stock_in':
        buckets.STOCK.push([ts,date,user,'Kirim',(prod[p.barcode]||{}).name||'',p.barcode,p.qty]);
        break;
      case 'stock_set':
        (p.counts||[]).forEach(c => buckets.STOCK.push([ts,date,user,'Inventar',(prod[c.barcode]||{}).name||'',c.barcode,c.qty]));
        break;
      case 'prod_new':
        prod[p.barcode] = {name:p.name, price:p.price||0};
        prodUpserts.push([p.barcode, p.name, p.price||0]);
        break;
      case 'price':
        if (prod[p.barcode]) prod[p.barcode].price = p.price; else prod[p.barcode]={name:'',price:p.price};
        prodUpserts.push([p.barcode, prod[p.barcode].name||'', p.price]);
        break;
      case 'user_add': userUpserts.push([p.username, p.role]); break;
      case 'user_del': userDeletes.push(p.username); break;
    }
  });

  appendRows_('SALES', buckets.SALES);
  appendRows_('MONEY', buckets.MONEY);
  appendRows_('DEBT',  buckets.DEBT);
  appendRows_('STOCK', buckets.STOCK);
  upsertProducts_(prodUpserts);
  upsertUsers_(userUpserts, userDeletes);
}

/* ---------------- tab utilities ---------------- */
function tab_(name){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s){
    s = ss.insertSheet(name);
    s.getRange(1,1,1,TABS[name].length).setValues([TABS[name]]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}
function appendRows_(name, rows){
  if (!rows.length) return;
  const s = tab_(name);
  s.getRange(s.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
}
function productMap_(){
  const s = tab_('PRODUCTS'); const last = s.getLastRow(); const map = {};
  if (last>1) s.getRange(2,1,last-1,3).getValues().forEach(r => { if(r[0]!=='') map[r[0]]={name:r[1],price:r[2]}; });
  return map;
}
function upsertProducts_(rows){
  if (!rows.length) return;
  const s = tab_('PRODUCTS'); const last = s.getLastRow();
  const idx = {};
  if (last>1) s.getRange(2,1,last-1,1).getValues().forEach((r,i)=>{ idx[r[0]] = i+2; });
  rows.forEach(r => {
    if (idx[r[0]]) s.getRange(idx[r[0]],1,1,3).setValues([r]);
    else { s.appendRow(r); idx[r[0]] = s.getLastRow(); }
  });
}
function upsertUsers_(rows, deletes){
  const s = tab_('USERS');
  const readIdx = () => { const last=s.getLastRow(); const m={};
    if(last>1) s.getRange(2,1,last-1,1).getValues().forEach((r,i)=>{ m[r[0]]=i+2; }); return m; };
  let idx = readIdx();
  rows.forEach(r => { if (idx[r[0]]) s.getRange(idx[r[0]],1,1,2).setValues([r]); else { s.appendRow(r); idx=readIdx(); } });
  (deletes||[]).forEach(login => { idx = readIdx(); if (idx[login]) s.deleteRow(idx[login]); });
}

/* ---------------- rebuild everything from _LOG ---------------- */
function rebuildAnalyst_(){
  Object.keys(TABS).forEach(name => {
    const s = tab_(name); const last = s.getLastRow();
    if (last > 1) s.getRange(2,1,last-1,s.getLastColumn()).clearContent();
  });
  const ops = readSince_(logSheet_(), 0);
  // process in seq order so product names resolve before stock rows
  ops.sort((a,b)=>a.seq-b.seq);
  fanout_(ops);
  SpreadsheetApp.getActiveSpreadsheet().toast('Tahlil jadvallari qayta qurildi', 'Kassa', 4);
}

function onOpen(){
  SpreadsheetApp.getUi()
    .createMenu('Kassa')
    .addItem('Tahlil jadvallarini qayta qurish', 'rebuildAnalyst_')
    .addToUi();
}

function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
