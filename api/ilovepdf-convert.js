// pages/api/convert.js

const fs = require('fs').promises;
const path = require('path');
const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');

export const config = {
  api: {
    bodyParser: false, // Riceviamo body binario raw
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let tmpPath;
  try {
    // Leggi il body come buffer
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const excelBuffer = Buffer.concat(chunks);

    if (!excelBuffer || excelBuffer.length === 0) {
      return res.status(400).json({ error: 'File vuoto o non ricevuto' });
    }

    console.log('Ricevuto Excel:', excelBuffer.length, 'bytes');

    const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
    const secretKey = process.env.ILOVEPDF_SECRET_KEY;
    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Missing API keys' });
    }

    // Scrivi file temporaneo in /tmp
    tmpPath = path.join('/tmp', `flight-plan-${Date.now()}.xlsx`);
    await fs.writeFile(tmpPath, excelBuffer);

    // Inizializza iLovePDF
    const instance = new ILovePDFApi(publicKey, secretKey);
    const task = instance.newTask('officepdf');
    await task.start();

    // Aggiungi file da path
    const file = new ILovePDFFile(tmpPath);
    await task.addFile(file);

    // Processa
    await task.process();

    // Scarica PDF
    const pdfBuffer = await task.download();

    // Cleanup
    await fs.unlink(tmpPath).catch(() => {});

    // Rispondi col PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="VFR_FlightPlan.pdf"');
    return res.send(pdfBuffer);

  } catch (error) {
    if (tmpPath) await fs.unlink(tmpPath).catch(() => {});
    console.error('Errore iLovePDF completo:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({
      error: error.message || 'Conversion error',
      type: error.name || 'Unknown error'
    });
  }
}
