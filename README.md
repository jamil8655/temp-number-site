# Temp Number Site

A small, self-contained temporary-SMS-number website — the same idea as
quackr.io / receive-smss.com. Visitors pick a country, choose a temporary
phone number, and read incoming SMS in a public inbox page that refreshes
itself every 5 seconds.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:3000 (set the `PORT` environment variable to use a
different port).

- `/` — countries that have numbers
- `/country/CA` — numbers for a country
- `/number/+12264576134` — public inbox for one number
- `/api/messages/+12264576134` — the same messages as JSON
- `/admin` — admin panel (see below)

Two demo numbers are preloaded so the site works out of the box:
`+12264576134` (Canada) and `+14155550132` (United States). They are demo
entries only — no real SMS will arrive on them until you connect a real
provider number (below).

## Try the flow without a provider

With the server running, in a second terminal:

```bash
node simulate.js
```

This posts a fake OTP SMS ("Your verification code is 482913") to the local
webhook, addressed to the Canada demo number. Open the number's inbox page
(or the JSON API) and you will see it — exactly what happens when a real
provider delivers a real SMS.

## Admin panel

Open `/admin`. The password comes from the `ADMIN_PASSWORD` variable in the
`.env` file (default: `admin123` — **change it** before putting the site
anywhere public).

In the admin panel you can:

- Set the provider name, **Account SID** and **Auth Token**. They are stored
  in `config.json`, never in code — switching provider accounts is done
  entirely from this page.
- Add and remove phone numbers (number, country code, country name).

## Connect a real provider (Twilio)

1. Sign up at twilio.com and verify your account.
2. In the Twilio Console, get a phone number with SMS capability
   (Phone Numbers → Buy a number).
3. Open that number's settings and set its **Messaging webhook**
   ("A message comes in") to:

   ```
   https://YOUR-DOMAIN/webhook/sms
   ```

   with method **HTTP POST**. Twilio will then POST form fields
   `From`, `To` and `Body` to this site for every incoming SMS, and the
   message appears in that number's public inbox within seconds.
   (The webhook also accepts JSON `{ "from": "...", "to": "...", "body": "..." }`,
   which other providers and test scripts can use.)
4. In this site's `/admin` page, enter your Twilio **Account SID** and
   **Auth Token**, and add the number you bought (with its country code and
   country name). Done — no code changes needed.

## Honest note about free-trial provider accounts

Free trials are fine for testing the webhook, but they have real limits:

- A Twilio **trial number generally cannot receive SMS from arbitrary
  senders** — on a trial account, messaging is restricted (for example to
  numbers you have verified), so OTPs sent by random websites usually will
  not arrive until the account is upgraded and the number is fully active.
- Trial credit is small, and each number also costs a small monthly rental
  once you are on a paid account.
- Providers actively detect and **may block or ban repeated free-trial
  signups** by the same person, so trial accounts are not a sustainable way
  to run this site — a single paid account with rented numbers is.

Also note: inboxes on this site are **public by design** (that is the whole
point of a temp-number site). Never use these numbers for banking or
important accounts, and make sure your visitors understand that too.

## Tech

- Node.js + Express, no build step (`npm start`).
- Messages are stored in SQLite via `better-sqlite3` when available, with an
  automatic fallback to a JSON file store (`data/messages.json`) — either
  way the app behaves the same.
- Site configuration (provider + numbers) lives in `config.json` and is
  managed from `/admin`.
