'use strict';
/**
 * Temp Number Site — a small self-contained temporary-SMS-number website.
 * Public inboxes for virtual numbers; incoming SMS arrive via a
 * Twilio-style webhook (POST /webhook/sms).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { loadConfig, saveConfig } = require('./config');
const { store, backendName } = require('./store');

// ---- tiny .env loader (ADMIN_PASSWORD) ----
(function loadDotEnv() {
  try {
    const lines = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch (e) { /* .env optional */ }
})();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_COOKIE_VALUE = crypto
  .createHash('sha256')
  .update('temp-number-site::' + ADMIN_PASSWORD)
  .digest('hex');

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio posts form fields
app.use(express.json());                          // JSON for testing

// ---- helpers ----
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function flagEmoji(countryCode) {
  const cc = String(countryCode || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🌐';
  return String.fromCodePoint(
    0x1f1e6 + (cc.charCodeAt(0) - 65),
    0x1f1e6 + (cc.charCodeAt(1) - 65)
  );
}

function timeAgo(ts) {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 10) return 'just now';
  if (secs < 60) return secs + ' seconds ago';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hrs / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Temp Number</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background:#f4f8f5; color:#17301f; }
  header { background:#0e7a3d; color:#fff; padding:16px 20px; }
  header .wrap { max-width:960px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; }
  header a { color:#fff; text-decoration:none; font-weight:700; font-size:20px; }
  header nav a { font-size:14px; font-weight:500; opacity:.9; margin-left:14px; }
  main { max-width:960px; margin:0 auto; padding:24px 20px 48px; }
  h1 { font-size:26px; margin:6px 0 8px; }
  h2 { font-size:19px; margin:26px 0 10px; }
  p.sub { color:#4c6653; margin:0 0 18px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:14px; }
  .card { background:#fff; border:1px solid #dcebe1; border-radius:12px; padding:18px; text-decoration:none; color:inherit; display:block; transition:box-shadow .15s; }
  a.card:hover { box-shadow:0 4px 16px rgba(14,122,61,.15); }
  .flag { font-size:34px; }
  .card .name { font-weight:700; font-size:17px; margin-top:6px; }
  .card .count { color:#4c6653; font-size:13px; }
  .numlist { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:14px; }
  .numcard { background:#fff; border:1px solid #dcebe1; border-radius:12px; padding:18px; text-decoration:none; color:inherit; display:block; }
  a.numcard:hover { box-shadow:0 4px 16px rgba(14,122,61,.15); }
  .numcard .num { font-size:19px; font-weight:700; letter-spacing:.3px; }
  .numcard .open { color:#0e7a3d; font-size:13px; font-weight:600; margin-top:4px; }
  .warn { background:#fff7e0; border:1px solid #f0dfa0; border-radius:10px; padding:12px 16px; font-size:14px; margin:14px 0 20px; }
  .msg { background:#fff; border:1px solid #dcebe1; border-radius:12px; padding:14px 16px; margin-bottom:10px; }
  .msg .from { font-weight:700; font-size:14px; }
  .msg .time { color:#7a8d80; font-size:12px; float:right; }
  .msg .body { margin-top:4px; font-size:15px; word-break:break-word; }
  .empty { background:#fff; border:1px dashed #c4d8ca; border-radius:12px; padding:26px; text-align:center; color:#4c6653; }
  .crumb { font-size:13px; color:#4c6653; margin-bottom:6px; }
  .crumb a { color:#0e7a3d; text-decoration:none; }
  form.box { background:#fff; border:1px solid #dcebe1; border-radius:12px; padding:18px; margin-bottom:20px; }
  label { display:block; font-size:13px; font-weight:600; margin:10px 0 4px; }
  input[type=text], input[type=password] { width:100%; padding:10px 12px; border:1px solid #c4d8ca; border-radius:8px; font-size:15px; }
  button, .btn { background:#0e7a3d; color:#fff; border:none; border-radius:8px; padding:10px 18px; font-size:14px; font-weight:600; cursor:pointer; margin-top:14px; }
  button.danger { background:#b3261e; }
  table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #dcebe1; border-radius:12px; overflow:hidden; }
  th, td { text-align:left; padding:10px 12px; border-bottom:1px solid #eef4f0; font-size:14px; }
  th { background:#eef7f1; }
  .ok { background:#e6f4ea; border:1px solid #a8d5b5; border-radius:10px; padding:10px 14px; font-size:14px; margin-bottom:14px; }
  footer { text-align:center; color:#7a8d80; font-size:12px; padding:24px 0 32px; }
  .big-num { font-size:24px; font-weight:800; letter-spacing:.3px; }
</style>
</head>
<body>
<header><div class="wrap"><a href="/">📩 Temp Number</a><nav><a href="/">Countries</a><a href="/admin">Admin</a></nav></div></header>
<main>
${bodyHtml}
</main>
<footer>Temp Number — free temporary phone numbers for receiving SMS online.</footer>
</body>
</html>`;
}

function isAdmin(req) {
  const cookie = req.headers.cookie || '';
  return cookie.split(';').some(part => part.trim() === 'admin_auth=' + ADMIN_COOKIE_VALUE);
}

// ---- public pages ----

// Home: grid of countries that have numbers
app.get('/', (req, res) => {
  const cfg = loadConfig();
  const byCountry = new Map();
  for (const n of cfg.numbers) {
    const key = String(n.countryCode || '').toUpperCase();
    if (!byCountry.has(key)) {
      byCountry.set(key, { code: key, name: n.countryName || key, count: 0 });
    }
    byCountry.get(key).count += 1;
  }
  const cards = [...byCountry.values()].map(c => `
    <a class="card" href="/country/${esc(c.code)}">
      <div class="flag">${flagEmoji(c.code)}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="count">${c.count} number${c.count === 1 ? '' : 's'} available</div>
    </a>`).join('');
  const body = `
    <h1>Temporary Phone Numbers</h1>
    <p class="sub">Pick a country, choose a free temporary number, and read incoming SMS right here — no sign-up, no SIM card.</p>
    ${cards ? `<div class="grid">${cards}</div>` : '<div class="empty">No numbers yet. Add some in the admin panel.</div>'}
    <div class="warn">⚠️ <strong>Messages are public</strong> — anyone can read them. Never use these numbers for banking or important accounts.</div>`;
  res.send(layout('Temporary Phone Numbers', body));
});

// Country page: list of numbers
app.get('/country/:code', (req, res) => {
  const cfg = loadConfig();
  const code = String(req.params.code || '').toUpperCase();
  const numbers = cfg.numbers.filter(n => String(n.countryCode || '').toUpperCase() === code);
  const countryName = numbers.length ? (numbers[0].countryName || code) : code;
  const items = numbers.map(n => `
    <a class="numcard" href="/number/${encodeURIComponent(n.number)}">
      <div class="num">${esc(n.number)}</div>
      <div class="open">Open inbox →</div>
    </a>`).join('');
  const body = `
    <div class="crumb"><a href="/">Home</a> › ${esc(countryName)}</div>
    <h1>${flagEmoji(code)} ${esc(countryName)} Temporary Numbers</h1>
    <p class="sub">${numbers.length} number${numbers.length === 1 ? '' : 's'} available. Click a number to open its public inbox.</p>
    ${items ? `<div class="numlist">${items}</div>` : '<div class="empty">No numbers for this country yet.</div>'}`;
  res.send(layout(countryName + ' Numbers', body));
});

// Number inbox page (auto-refreshes via the JSON API every 5 seconds)
app.get('/number/:num', (req, res) => {
  const num = req.params.num;
  const cfg = loadConfig();
  const entry = cfg.numbers.find(n => n.number === num);
  const countryName = entry ? (entry.countryName || '') : '';
  const body = `
    <div class="crumb"><a href="/">Home</a>${entry ? ` › <a href="/country/${esc(String(entry.countryCode).toUpperCase())}">${esc(countryName)}</a>` : ''}</div>
    <h1>SMS Inbox</h1>
    <div class="big-num">${flagEmoji(entry ? entry.countryCode : '')} ${esc(num)}</div>
    <p class="sub">New messages appear automatically (this page refreshes itself every 5 seconds).</p>
    <div class="warn">⚠️ <strong>Messages are public</strong> — never use for banking or important accounts.</div>
    <div id="messages"><div class="empty">Loading messages…</div></div>
    <script>
      var NUM = ${JSON.stringify(num)};
      function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
      function render(list){
        var box = document.getElementById('messages');
        if(!list.length){ box.innerHTML = '<div class="empty">No messages yet. Send an SMS to this number and it will appear here.</div>'; return; }
        box.innerHTML = list.map(function(m){
          return '<div class="msg"><span class="time">'+esc(m.ago)+'</span><div class="from">From: '+esc(m.from||'unknown')+'</div><div class="body">'+esc(m.body)+'</div></div>';
        }).join('');
      }
      function poll(){
        fetch('/api/messages/' + encodeURIComponent(NUM))
          .then(function(r){ return r.json(); })
          .then(function(d){ render(d.messages || []); })
          .catch(function(){});
      }
      poll();
      setInterval(poll, 5000);
    </script>`;
  res.send(layout('Inbox ' + num, body));
});

// ---- JSON API ----
app.get('/api/messages/:num', (req, res) => {
  const messages = store.getMessages(req.params.num).map(m => ({
    from: m.from,
    body: m.body,
    ts: m.ts,
    ago: timeAgo(m.ts)
  }));
  res.json({ number: req.params.num, messages });
});

// ---- Webhook (Twilio-style) ----
app.post('/webhook/sms', (req, res) => {
  const b = req.body || {};
  const from = b.From || b.from || '';
  const to = b.To || b.to || '';
  const body = b.Body || b.body || '';
  if (to) {
    store.addMessage({ to, from, body });
  }
  res.type('text/xml').send('<Response></Response>');
});

// ---- Admin ----
app.get('/admin', (req, res) => {
  if (!isAdmin(req)) {
    const body = `
      <h1>Admin Login</h1>
      <form class="box" method="POST" action="/admin/login">
        <label for="password">Admin password</label>
        <input type="password" id="password" name="password" required>
        <button type="submit">Log in</button>
      </form>`;
    return res.send(layout('Admin Login', body));
  }
  const cfg = loadConfig();
  const saved = req.query.saved ? '<div class="ok">✅ Saved.</div>' : '';
  const rows = cfg.numbers.map(n => `
    <tr>
      <td>${esc(n.number)}</td>
      <td>${flagEmoji(n.countryCode)} ${esc(n.countryName)} (${esc(String(n.countryCode).toUpperCase())})</td>
      <td>
        <form method="POST" action="/admin/numbers/remove" style="display:inline" onsubmit="return confirm('Remove this number?')">
          <input type="hidden" name="number" value="${esc(n.number)}">
          <button type="submit" class="danger" style="margin-top:0">Remove</button>
        </form>
      </td>
    </tr>`).join('');
  const body = `
    <h1>Admin</h1>
    ${saved}
    <h2>SMS Provider</h2>
    <form class="box" method="POST" action="/admin/provider">
      <label for="pname">Provider name</label>
      <input type="text" id="pname" name="name" value="${esc(cfg.provider.name)}" placeholder="Twilio">
      <label for="sid">Account SID</label>
      <input type="text" id="sid" name="accountSid" value="${esc(cfg.provider.accountSid)}" placeholder="ACxxxxxxxx...">
      <label for="token">Auth Token</label>
      <input type="text" id="token" name="authToken" value="${esc(cfg.provider.authToken)}" placeholder="••••••••">
      <button type="submit">Save provider</button>
      <p class="sub" style="margin-top:10px">Point your provider number's messaging webhook to <strong>https://YOUR-DOMAIN/webhook/sms</strong> (POST). Credentials are stored in config.json — switching accounts never needs a code change.</p>
    </form>
    <h2>Numbers</h2>
    <table>
      <tr><th>Number</th><th>Country</th><th></th></tr>
      ${rows || '<tr><td colspan="3">No numbers yet.</td></tr>'}
    </table>
    <form class="box" method="POST" action="/admin/numbers" style="margin-top:20px">
      <label for="nnum">Phone number (with country code, e.g. +14155550132)</label>
      <input type="text" id="nnum" name="number" required placeholder="+1...">
      <label for="ncc">Country code (e.g. CA, US, GB)</label>
      <input type="text" id="ncc" name="countryCode" required placeholder="CA">
      <label for="ncn">Country name</label>
      <input type="text" id="ncn" name="countryName" required placeholder="Canada">
      <button type="submit">Add number</button>
    </form>
    <form method="POST" action="/admin/logout"><button type="submit">Log out</button></form>`;
  res.send(layout('Admin', body));
});

app.post('/admin/login', (req, res) => {
  if ((req.body.password || '') === ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', 'admin_auth=' + ADMIN_COOKIE_VALUE + '; Path=/; HttpOnly');
    return res.redirect('/admin');
  }
  res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_auth=; Path=/; HttpOnly; Max-Age=0');
  res.redirect('/');
});

app.post('/admin/provider', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/admin');
  const cfg = loadConfig();
  cfg.provider = {
    name: (req.body.name || '').trim(),
    accountSid: (req.body.accountSid || '').trim(),
    authToken: (req.body.authToken || '').trim()
  };
  saveConfig(cfg);
  res.redirect('/admin?saved=1');
});

app.post('/admin/numbers', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/admin');
  const number = (req.body.number || '').trim();
  const countryCode = (req.body.countryCode || '').trim().toUpperCase();
  const countryName = (req.body.countryName || '').trim();
  if (number && countryCode && countryName) {
    const cfg = loadConfig();
    if (!cfg.numbers.some(n => n.number === number)) {
      cfg.numbers.push({ number, countryCode, countryName });
      saveConfig(cfg);
    }
  }
  res.redirect('/admin?saved=1');
});

app.post('/admin/numbers/remove', (req, res) => {
  if (!isAdmin(req)) return res.redirect('/admin');
  const cfg = loadConfig();
  cfg.numbers = cfg.numbers.filter(n => n.number !== (req.body.number || ''));
  saveConfig(cfg);
  res.redirect('/admin?saved=1');
});

// ---- start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Temp Number site listening on http://localhost:' + PORT);
  console.log('Message store backend: ' + backendName);
});
