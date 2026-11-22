/**
 * LHCI `puppeteerScript`: prepares the browser profile before Lighthouse runs.
 *
 * - Every URL: accepts the habeas-data consent and pins the light theme, so the
 *   measured page is the login screen rather than the first-visit consent
 *   dialog (which would become the LCP element).
 * - `/admin*` URLs: installs the seeded admin token cookies from
 *   `/tmp/opencode/admin_token.txt` (or `ADMIN_TOKEN_FILE`). Run those against
 *   the dev server, which talks to the local API.
 *
 * LHCI calls this once per URL with a shared browser instance.
 */
const fs = require('node:fs');

function tokenCookies(url) {
  const file = process.env.ADMIN_TOKEN_FILE ?? '/tmp/opencode/admin_token.txt';
  if (!fs.existsSync(file)) {
    throw new Error(`[lighthouse-seed] missing admin token at ${file}`);
  }
  const token = fs.readFileSync(file, 'utf8').trim();
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  const expires = payload.exp;
  if (!expires || expires * 1000 < Date.now()) {
    throw new Error(`[lighthouse-seed] admin token at ${file} is expired`);
  }
  const cookie = (name, value) => ({
    name,
    value,
    domain: new URL(url).hostname,
    path: '/',
    expires,
    httpOnly: false,
    secure: false,
    sameSite: 'Strict',
  });
  // `rms_token_expiry` is the client-side guard; give it the real JWT expiry.
  return [cookie('rms_access', token), cookie('rms_token_expiry', String(expires * 1000))];
}

module.exports = async (browser, { url }) => {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    if (new URL(url).pathname.startsWith('/admin')) {
      for (const cookie of tokenCookies(url)) await page.setCookie(cookie);
    }

    await page.evaluate(() => {
      localStorage.setItem('habeas_data_accepted', 'true');
      localStorage.setItem('habeas_data_date', new Date().toISOString().slice(0, 10));
      localStorage.setItem('theme', 'light');
    });
  } finally {
    await page.close();
  }
};
