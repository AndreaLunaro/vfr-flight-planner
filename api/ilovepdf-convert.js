const FormData = require('form-data');

export default async function handler(req, res) {
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');


if (req.method === 'OPTIONS') return res.status(200).end();
if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
}

let taskId = null;

try {
    console.log('🚀 Iniziando conversione Excel→PDF con iLovePDF...');

    // Ricevi il file Excel
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const excelBuffer = Buffer.concat(chunks);

    if (!process.env.ILOVEPDF_PUBLIC_KEY) {
        throw new Error('API Key mancante');
    }

    console.log('🔐 Step 1: Autenticazione...');

    // STEP 1: Authentication
    const authResponse = await fetch('<https://api.ilovepdf.com/v1/auth>', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            public_key: process.env.ILOVEPDF_PUBLIC_KEY
        })
    });

    if (!authResponse.ok) {
        throw new Error(`Auth failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    const token = authData.token;

    console.log('✅ Autenticazione riuscita');

    // STEP 2: Start Task per Office→PDF conversion
    console.log('📋 Step 2: Inizializzazione task...');

    const startResponse = await fetch('<https://api.ilovepdf.com/v1/start/office>', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!startResponse.ok) {
        throw new Error(`Start task failed: ${startResponse.status}`);
    }

    const startData = await startResponse.json();
    taskId = startData.task;
    const serverUrl = startData.server;

    console.log(`✅ Task creato: ${taskId} su server: ${serverUrl}`);

    // STEP 3: Upload Excel file
    console.log('📤 Step 3: Upload file Excel...');

    const form = new FormData();
    form.append('task', taskId);
    form.append('file', excelBuffer, {
        filename: 'flight-plan.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const uploadResponse = await fetch(`${serverUrl}/v1/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            ...form.getHeaders()
        },
        body: form
    });

    if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    console.log('✅ File caricato');

    // STEP 4: Process - Converti con opzioni A5
    console.log('🔄 Step 4: Processing conversione...');

    const processResponse = await fetch(`${serverUrl}/v1/process`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            task: taskId,
            files: uploadData.files,
            // Opzioni per formato A5
            page_size: 'A5',
            page_orientation: 'portrait'
        })
    });

    if (!processResponse.ok) {
        const errorText = await processResponse.text();
        throw new Error(`Process failed: ${processResponse.status} - ${errorText}`);
    }

    console.log('✅ Conversione completata');

    // STEP 5: Download PDF
    console.log('⬇️ Step 5: Download PDF...');

    const downloadResponse = await fetch(`${serverUrl}/v1/download/${taskId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!downloadResponse.ok) {
        throw new Error(`Download failed: ${downloadResponse.status}`);
    }

    const pdfBuffer = await downloadResponse.arrayBuffer();
    console.log(`✅ PDF scaricato: ${pdfBuffer.byteLength} bytes`);

    // Restituisci PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="VFR_FlightPlan_A5.pdf"');
    return res.send(Buffer.from(pdfBuffer));

} catch (error) {
    console.error('❌ Errore conversione:', error);

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
        details: error.message
    });
}


}
