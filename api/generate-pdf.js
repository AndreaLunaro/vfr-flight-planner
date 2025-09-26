export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    // Configurazione per ambiente Vercel vs locale
    const isVercel = !!process.env.VERCEL_ENV;
    let browser;

    if (isVercel) {
      // Configurazione per Vercel con @sparticuz/chromium
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreHTTPSErrors: true,
      });
    } else {
      // Configurazione per sviluppo locale
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.launch({
        headless: true,
      });
    }

    const page = await browser.newPage();

    // Imposta dimensioni pagina per formato A5
    await page.setViewport({ width: 595, height: 842 }); // A5 in pixels

    // Carica il contenuto HTML
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Emula media type screen per mantenere gli stili
    await page.emulateMediaType('screen');

    // Genera PDF con formato A5
    const pdfBuffer = await page.pdf({
      format: 'A5',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      preferCSSPageSize: false
    });

    await browser.close();

    // Invia il PDF come response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="flight-plan.pdf"');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  }
}