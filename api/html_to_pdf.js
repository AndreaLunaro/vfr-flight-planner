export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log('Starting PDF generation from HTML...');

    // Detect environment
    const isVercel = process.env.VERCEL_ENV || process.env.VERCEL;
    const isLocal = process.env.NODE_ENV === 'development';

    let browser;

    if (isVercel && !isLocal) {
      console.log('Using Vercel/Production configuration...');

      // Import Vercel-optimized packages
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      // Optimized Chromium args for Vercel
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
      console.log('Using local development configuration...');

      // Local development with full Puppeteer
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    console.log('Browser launched successfully');

    const page = await browser.newPage();
    console.log('New page created');

    // Set longer timeouts for complex operations
    page.setDefaultTimeout(45000);

    // Set viewport for A4 page (can be adjusted)
    await page.setViewport({ width: 1240, height: 1754 }); // A4 at 150 DPI

    console.log('Loading HTML content...');

    // Load HTML content with extended timeout
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    console.log('HTML content loaded successfully');

    // Emulate screen media for better styling
    await page.emulateMediaType('screen');

    // Generate PDF with A4 format
    console.log('Generating PDF...');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '10mm',
        bottom: '15mm',
        left: '10mm'
      },
      preferCSSPageSize: false,
      timeout: 30000
    });

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Clean up
    await page.close();
    await browser.close();

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="flight-plan-excel-replica.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    return res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    console.error('Error stack:', error.stack);

    return res.status(500).json({ 
      error: 'Failed to generate PDF from HTML',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}