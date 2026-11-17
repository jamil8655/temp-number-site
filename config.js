'use strict';
/**
 * Site configuration: provider credentials + the list of phone numbers.
 * Stored in config.json so everything can be changed from the /admin page
 * without touching code. Seeded with two clearly-demo numbers.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  provider: {
    name: 'Twilio',
    accountSid: '',
    authToken: ''
  },
  numbers: [
    { number: '+12264576134', countryCode: 'CA', countryName: 'Canada' },
    { number: '+14155550132', countryCode: 'US', countryName: 'United States' }
  ]
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    // Merge with defaults so missing keys never crash the app.
    return {
      provider: Object.assign({}, DEFAULT_CONFIG.provider, parsed.provider || {}),
      numbers: Array.isArray(parsed.numbers) ? parsed.numbers : DEFAULT_CONFIG.numbers.slice()
    };
  } catch (e) {
    saveConfig(DEFAULT_CONFIG);
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

module.exports = { loadConfig, saveConfig, CONFIG_PATH };
