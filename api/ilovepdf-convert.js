// pages/api/convert.js

const { Readable } = require('stream');
const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');

export const config = {
  api: {
    bodyParser: false  // IMPORTANT: riceviamo il body RAW (binario)
  }
};

export default async function handler(req, res) {
  // CORS (se serve)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Leggi raw body come stream
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const excelBuffer = Buffer.concat(chunks);

    console.log('Ricevuto buffer (bytes):', excelBuffer.length);
    if (!excelBuffer || excelBuffer.length === 0) {
      return res.status(400).json({ error: 'Body vuoto: invia il file XLSX come raw binary nel body della POST' });
    }

    const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
    const secretKey = process.env.ILOVEPDF_SECRET_KEY;
    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Missing API keys' });
    }

    // Inizializza iLovePDF
    const instance = new ILovePDFApi(publicKey, secretKey);
    const task = instance.newTask('officepdf');
    await task.start();

    // Converti il Buffer in uno stream (un singolo chunk)
    const stream = Readable.from([excelBuffer]);
    // Crea ILovePDFFile usando lo stream e il file name corretto
    const file = new ILovePDFFile(stream, 'flight-plan.xlsx');
    await task.addFile(file);

    // Processa e scarica
    await task.process();
    const pdfBuffer = await task.download();

    // Rispondi col PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="VFR_FlightPlan.pdf"');
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Errore iLovePDF completo:', error);
    return res.status(500).json({
      error: error?.message || 'Conversion error',
      type: error?.name || 'UnknownError'
    });
  }
}
