import { spawn, execSync } from 'node:child_process';
import process from 'node:process';
import puppeteer from 'puppeteer';

const APP_URL = 'http://127.0.0.1:4300';

function startDevServer() {
  return spawn('npx', ['ng', 'serve', '--host', '127.0.0.1', '--port', '4300'], {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    stdio: 'pipe',
  });
}

function stopDevServer(server) {
  if (!server || server.killed) {
    return;
  }

  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
      return;
    } catch {
      // fallback to regular kill
    }
  }

  server.kill('SIGTERM');
}

async function waitForServer(url, timeoutMs = 180000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Timeout waiting for dev server');
}

async function run() {
  const server = startDevServer();

  server.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.includes('Local:') || text.includes('Application bundle generation complete')) {
      process.stdout.write(text);
    }
  });

  server.stderr.on('data', (chunk) => {
    process.stderr.write(chunk.toString());
  });

  let browser;

  try {
    await waitForServer(APP_URL);

    browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });

    const modalOnLoad = await page.$('.modal-overlay');
    if (!modalOnLoad) {
      throw new Error('Habeas data modal did not appear on initial load');
    }

    await page.evaluate(() => {
      const acceptButton = Array.from(document.querySelectorAll('button')).find((btn) =>
        (btn.textContent || '').includes('Aceptar y Continuar'),
      );
      if (!acceptButton) {
        throw new Error('Accept button not found');
      }
      acceptButton.click();
    });

    await page.waitForFunction(() => !document.querySelector('.modal-overlay'));

    await page.reload({ waitUntil: 'networkidle0' });

    const modalAfterReload = await page.$('.modal-overlay');
    if (!modalAfterReload) {
      throw new Error('Habeas data modal did not reappear after reload');
    }

    await page.evaluate(() => {
      const rejectButton = Array.from(document.querySelectorAll('button')).find((btn) =>
        (btn.textContent || '').includes('Rechazar'),
      );
      if (!rejectButton) {
        throw new Error('Reject button not found');
      }
      rejectButton.click();
    });

    await page.waitForFunction(() => !document.querySelector('.modal-overlay'));

    console.log('E2E habeas data flow passed');
  } finally {
    if (browser) {
      await browser.close();
    }

    stopDevServer(server);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
