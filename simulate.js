'use strict';
/**
 * simulate.js — proves the flow end-to-end without a real provider.
 * Posts a fake OTP SMS to the local webhook, exactly as Twilio would
 * (form fields From / To / Body), addressed to the Canada demo number.
 *
 * Usage:  npm start        (in one terminal)
 *         node simulate.js (in another)
 */
const http = require('http');
const querystring = require('querystring');

const PORT = process.env.PORT || 3000;

const payload = querystring.stringify({
  From: '+15551234567',
  To: '+12264576134', // Canada demo number (seeded in config.json)
  Body: 'Your verification code is 482913'
});

const req = http.request(
  {
    hostname: 'localhost',
    port: PORT,
    path: '/webhook/sms',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload)
    }
  },
  res => {
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end', () => {
      console.log('Webhook responded: HTTP ' + res.statusCode);
      console.log('Response body: ' + data);
      console.log('');
      console.log('Now open:  http://localhost:' + PORT + '/number/+12264576134');
      console.log('Or check:  http://localhost:' + PORT + '/api/messages/+12264576134');
    });
  }
);

req.on('error', err => {
  console.error('Could not reach the local server: ' + err.message);
  console.error('Is it running? Start it first with: npm start');
  process.exit(1);
});

req.write(payload);
req.end();
