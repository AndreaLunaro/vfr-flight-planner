export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log('Starting PDF generation...');

    // Configurazione per ambiente Vercel vs locale
    const isLocal = process.env.NODE_ENV === 'development';
    const isVercel = !!process.env.VERCEL;

    let browser;

    if (isVercel || !isLocal) {
      console.log('Using Vercel configuration...');

      // Import dinamico per evitare problemi di bundling
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      // Configurazione Chromium per Vercel (dal web research)
      const chromeArgs = [
        ...chromium.args,
        '--font-render-hinting=none',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-animations',
        '--disable-background-timer-throttling',
        '--disable-restore-session-state',
        '--disable-web-security',
        '--single-process',
        '--no-zygote',
        '--disable-features=VizDisplayCompositor'
      ];

      browser = await puppeteer.launch({
        args: chromeArgs,
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreHTTPSErrors: true,
        ignoreDefaultArgs: ['--disable-extensions'],
      });

    } else {
      console.log('Using local configuration...');

      // Configurazione per sviluppo locale
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    console.log('Browser launched successfully');

    const page = await browser.newPage();
    console.log('New page created');

    // Imposta timeout più lungo per le operazioni
    page.setDefaultTimeout(45000);

    // Imposta dimensioni pagina per formato A5
    await page.setViewport({ width: 595, height: 842 });

    // Carica il contenuto HTML
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    console.log('HTML content loaded');

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
      preferCSSPageSize: false,
      timeout: 30000
    });

    console.log('PDF generated successfully, size:', pdfBuffer.length);

    await page.close();
    await browser.close();

    // Invia il PDF come response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="flight-plan.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    console.error('Error stack:', error.stack);

    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}