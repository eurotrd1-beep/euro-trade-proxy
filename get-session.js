'use strict';
/**
 * Run this script ON YOUR LOCAL MACHINE (not on Render).
 * It opens a real Chrome browser, you log in to Pocket Option manually,
 * then it sends your session cookies to the Render proxy automatically.
 *
 * Usage:
 *   node get-session.js
 */

const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');

const PROXY_HOST = 'euro-trade-proxy.onrender.com';
const LOGIN_URL  = 'https://pocketoption.com/en/login';

// Find system Chrome on Windows
function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Chromium\\Application\\chromium.exe',
  ];
  return candidates.find(p => { try { return fs.existsSync(p); } catch(_){return false;} });
}

(async () => {
  const executablePath = findChrome();
  if (!executablePath) { console.error('Chrome not found on this machine'); process.exit(1); }
  console.log('Using Chrome:', executablePath);
  console.log('Opening browser — log in to Pocket Option, then wait...');
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null, executablePath });
  const page    = await browser.newPage();
  await page.goto(LOGIN_URL);

  console.log('\n>>> Log in to Pocket Option in the browser, then come back here and press ENTER <<<\n');
  await new Promise(resolve => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => { rl.close(); resolve(); });
  });
  console.log('Collecting cookies from:', page.url());

  const cookies = await page.cookies();
  console.log(`Got ${cookies.length} cookies — sending to proxy...`);

  const data = JSON.stringify({ cookies });
  const reqOpts = {
    hostname: PROXY_HOST,
    path:     '/api/admin/po-session',
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  };

  await new Promise((resolve, reject) => {
    const req = https.request(reqOpts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { console.log('Proxy response:', body); resolve(); });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  // Print as base64 env var so user can set it on Render (persists through deploys)
  const b64 = Buffer.from(JSON.stringify(cookies)).toString('base64');
  console.log('\n========================================================');
  console.log('IMPORTANT: Copy this value and set it as PO_COOKIES env');
  console.log('var on Render so cookies survive deploys:');
  console.log('========================================================');
  console.log(b64);
  console.log('========================================================\n');
  console.log('Done! Scraper will restart with your session cookies.');
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
