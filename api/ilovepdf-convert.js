const FormData = require('form-data');

export default async function handler(req, res) {
    // Headers CORS per permettere chiamate dal frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Gestisci preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let taskId = null;

    try {
        console.log('🚀 Iniziando conversione Excel→PDF con iLovePDF...');

        // STEP 1: Ricevi il file Excel dal frontend
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const excelBuffer = Buffer.concat(chunks);

        if (excelBuffer.length === 0) {
            throw new Error('File Excel vuoto ricevuto');
        }

        console.log(`📁 File Excel ricevuto: ${excelBuffer.length} bytes`);

        // STEP 2: Start Task - Inizializza sessione iLovePDF
        console.log('📋 Step 1: Inizializzo task iLovePDF...');

        const startResponse = await fetch('https://api.ilovepdf.com/v1/start/officepdf', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.ILOVEPDF_PUBLIC_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!startResponse.ok) {
            throw new Error(`Start task failed: ${startResponse.status} ${startResponse.statusText}`);
        }

        const startData = await startResponse.json();
        taskId = startData.task;

        console.log(`✅ Task creato: ${taskId}`);

        // STEP 3: Upload File - Carica Excel
        console.log('📤 Step 2: Caricando file Excel...');

        const form = new FormData();
        form.append('task', taskId);
        form.append('file', excelBuffer, {
            filename: 'flight-plan.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const uploadResponse = await fetch('https://api.ilovepdf.com/v1/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.ILOVEPDF_PUBLIC_KEY}`,
                ...form.getHeaders()
            },
            body: form
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        const uploadData = await uploadResponse.json();
        const serverFilename = uploadData.server_filename;

        console.log(`✅ File caricato: ${serverFilename}`);

        // STEP 4: Process - Converti Excel→PDF con formato A5
        console.log('🔄 Step 3: Processando conversione Excel→PDF A5...');

        const processResponse = await fetch('https://api.ilovepdf.com/v1/process', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.ILOVEPDF_PUBLIC_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task: taskId,
                tool: 'officepdf',
                files: [{
                    server_filename: serverFilename,
                    filename: 'FlightPlan_A5.pdf'
                }],
                // Opzioni per formato A5
                page_size: 'A5',
                page_orientation: 'portrait',
                margin: 10,
                fit_to_page_width: true
            })
        });

        if (!processResponse.ok) {
            const errorText = await processResponse.text();
            throw new Error(`Process failed: ${processResponse.status} - ${errorText}`);
        }

        const processData = await processResponse.json();

        console.log('✅ Conversione completata');

        // STEP 5: Download - Scarica PDF convertito
        console.log('⬇️ Step 4: Scaricando PDF convertito...');

        const downloadResponse = await fetch(`https://api.ilovepdf.com/v1/download/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.ILOVEPDF_PUBLIC_KEY}`
            }
        });

        if (!downloadResponse.ok) {
            throw new Error(`Download failed: ${downloadResponse.status}`);
        }

        // Leggi il PDF come buffer
        const pdfBuffer = await downloadResponse.arrayBuffer();

        console.log(`✅ PDF scaricato: ${pdfBuffer.byteLength} bytes`);

        // STEP 6: Restituisci PDF al frontend
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="VFR_FlightPlan_A5.pdf"');
        res.setHeader('Content-Length', pdfBuffer.byteLength);

        return res.send(Buffer.from(pdfBuffer));

    } catch (error) {
        console.error('❌ Errore conversione iLovePDF:', error);

        // Cleanup task se necessario
        if (taskId) {
            try {
                await fetch(`https://api.ilovepdf.com/v1/task/${taskId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${process.env.ILOVEPDF_PUBLIC_KEY}`
                    }
                });
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        }

        return res.status(500).json({
            error: 'Conversione PDF fallita',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
