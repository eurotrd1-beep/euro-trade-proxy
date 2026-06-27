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

const PROXY_HOST = 'euro-trade-proxy.onrender.com';
const LOGIN_URL  = 'https://pocketoption.com/en/login';

(async () => {
  console.log('Opening browser — log in to Pocket Option, then wait...');
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page    = await browser.newPage();
  await page.goto(LOGIN_URL);

  console.log('Waiting for login (up to 3 min)...');
  await page.waitForFunction(
    () => !location.href.includes('/login') && !location.href.includes('/signup'),
    { timeout: 180000 }
  );
  console.log('Logged in at:', page.url());

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
      res.on('end', () => {
        console.log('Proxy response:', body);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  console.log('Done! Scraper will restart with your session cookies.');
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
