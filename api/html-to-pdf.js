// api/html-to-pdf.js
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let browser;
  try {
    const { htmlContent } = req.body || {};
    if (!htmlContent) return res.status(400).json({ error: 'HTML content is required' });

    const execPath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: execPath,
      headless: chromium.headless,
      defaultViewport: { width: 1240, height: 1754 },
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.emulateMediaType('screen');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await page.close();
    await browser.close();
    browser = null;

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="flight-plan.pdf"');
    res.setHeader('Content-Length', String(pdf.length));
    return res.end(pdf);
  } catch (err) {
    if (browser) { try { await browser.close(); } catch {} }
    console.error('PDF Generation Error:', err);
    return res.status(500).json({ error: 'Failed to generate PDF', details: err.message });
  }
}
