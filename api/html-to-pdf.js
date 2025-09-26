export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;

  try {
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log('PDF API called, HTML length:', htmlContent.length);

    // Import Puppeteer with timeout
    const puppeteer = (await import('puppeteer')).default;

    console.log('Puppeteer imported, launching browser...');

    // Launch browser with extended args for Vercel
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--single-process',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection'
      ],
      timeout: 15000 // 15 second timeout for launch
    });

    console.log('Browser launched successfully');

    const page = await browser.newPage();

    // Set page timeout
    page.setDefaultTimeout(20000);

    // Set viewport smaller to reduce memory
    await page.setViewport({ width: 800, height: 600 });

    console.log('Loading HTML content...');

    // Load HTML with shorter timeout and simpler wait condition
    await page.setContent(htmlContent, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    console.log('HTML loaded, generating PDF...');

    // Generate PDF with smaller format to reduce memory
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      timeout: 15000
    });

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    await page.close();
    await browser.close();
    browser = null;

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="flight-plan.pdf"');
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF Generation Error Details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Cleanup browser if still open
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }

    return res.status(500).json({ 
      error: 'PDF generation failed',
      details: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString()
    });
  }
}
