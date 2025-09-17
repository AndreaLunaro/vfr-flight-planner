const ILovePDFApi = require('@ilovepdf/ilovepdf-nodejs');
const ILovePDFFile = require('@ilovepdf/ilovepdf-nodejs/ILovePDFFile');

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Ricevi il file Excel
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const excelBuffer = Buffer.concat(chunks);

        console.log('Excel buffer size:', excelBuffer.length);

        // Verifica API keys
        const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
        const secretKey = process.env.ILOVEPDF_SECRET_KEY;

        if (!publicKey || !secretKey) {
            console.error('Missing API keys');
            return res.status(500).json({ error: 'Missing API keys' });
        }

        // Inizializza iLovePDF
        console.log('Initializing iLovePDF...');
        const instance = new ILovePDFApi(publicKey, secretKey);
        const task = instance.newTask('officepdf');
        await task.start();

        // Aggiungi file
        console.log('Adding Excel file...');
        const file = ILovePDFFile.fromBuffer(excelBuffer, 'flight-plan.xlsx');
        await task.addFile(file);

        // Processa conversione
        console.log('Processing conversion...');
        await task.process({
            page_size: 'A5',
            page_orientation: 'portrait'
        });

        // Scarica PDF
        console.log('Downloading PDF...');
        const pdfBuffer = await task.download();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="VFR_FlightPlan_A5.pdf"');
        return res.send(pdfBuffer);

    } catch (error) {
        console.error('Errore iLovePDF:', error);
        return res.status(500).json({ 
            error: error.message || 'Conversion error',
            details: error.toString()
        });
    }
}
