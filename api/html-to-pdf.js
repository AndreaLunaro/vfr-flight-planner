// api/html-to-pdf.js - VERSIONE FINALE COMPLETA
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let browser;
  try {
    const { htmlContent } = req.body || {};
    if (!htmlContent) return res.status(400).json({ error: 'HTML content is required' });

    console.log('Starting PDF generation (LANDSCAPE + ETO/ATO/RETO), HTML length:', htmlContent.length);

    const execPath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: execPath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(25000);

    // Configurazione A4 LANDSCAPE ottimizzata
    await page.setViewport({ 
      width: 1123,  // A4 landscape width
      height: 794,  // A4 landscape height
      deviceScaleFactor: 1
    });

    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });

    // Emula media print per CSS @page
    await page.emulateMediaType('print');

    // Aspetta caricamento font
    await page.evaluateHandle('document.fonts.ready');

    console.log('Generating PDF with A4 LANDSCAPE format + ETO/ATO/RETO columns...');

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,           // Orientamento orizzontale
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '8mm',
        right: '8mm', 
        bottom: '8mm',
        left: '8mm'
      },
      displayHeaderFooter: false,
      scale: 1.0
    });

    console.log(`PDF LANDSCAPE with ETO/ATO/RETO generated successfully, size: ${pdf.length} bytes`);

    await page.close();
    await browser.close();
    browser = null;

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="VFR-Flight-Plan-Complete.pdf"');
    res.setHeader('Content-Length', String(pdf.length));
    return res.end(pdf);

  } catch (err) {
    if (browser) { 
      try { await browser.close(); } catch (closeErr) {
        console.error('Error closing browser:', closeErr);
      }
    }
    console.error('PDF Generation Error:', err);
    return res.status(500).json({ 
      error: 'Failed to generate PDF', 
      details: err.message 
    });
  }
}