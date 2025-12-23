export class ExportService {
    static async exportToExcel(flightData) {
        try {
            console.log('Starting Excel export...');
            console.log('Flight data:', flightData);

            console.log('Fetching template...');
            const response = await fetch('TemplateFlightLog.xlsx');
            if (!response.ok) {
                const errorMsg = `Failed to load Excel template: ${response.status}`;
                alert(errorMsg);
                throw new Error(errorMsg);
            }
            console.log('Template fetched successfully');

            console.log('Loading workbook...');
            const arrayBuffer = await response.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            const worksheet = workbook.getWorksheet(1);
            console.log('Workbook loaded successfully');

            if (flightData.flightResults && flightData.flightResults.length > 0) {
                flightData.flightResults.forEach((result, index) => {
                    const row = 11 + index;
                    worksheet.getCell(`A${row}`).value = result.fix.split(',')[0];
                    if (index > 0) {
                        worksheet.getCell(`B${row}`).value = Math.ceil(parseFloat(result.route) || 0);
                        worksheet.getCell(`C${row}`).value = Math.ceil(result.altitude || 0);
                        worksheet.getCell(`D${row}`).value = Math.ceil(result.distance || 0);
                        worksheet.getCell(`E${row}`).value = Math.ceil(parseFloat(result.radial) || 0);
                        worksheet.getCell(`F${row}`).value = Math.ceil(result.flightTime || 0);
                    }
                });

                const totalDistance = flightData.flightResults.reduce((s, r) => s + (r.distance || 0), 0);
                const totalFlightTime = flightData.flightResults.reduce((s, r) => s + (r.flightTime || 0), 0);
                worksheet.getCell('F26').value = Math.round(totalDistance * 10) / 10;
                worksheet.getCell('I26').value = Math.round(totalFlightTime * 10) / 10;
            }

            if (flightData.fuelData) {
                worksheet.getCell('O21').value = flightData.fuelData.tripFuel || 0;
                worksheet.getCell('O23').value = flightData.fuelData.contingencyFuel || 0;
                worksheet.getCell('O24').value = flightData.fuelData.reserveFuel || 0;
            }

            if (flightData.alternateResults && flightData.alternateResults.length > 0) {
                flightData.alternateResults.forEach((result, index) => {
                    const row = 11 + index;
                    worksheet.getCell(`K${row}`).value = result.fix.split(',')[0];
                    if (index > 0) {
                        worksheet.getCell(`L${row}`).value = Math.ceil(parseFloat(result.route) || 0);
                        worksheet.getCell(`M${row}`).value = Math.ceil(result.altitude || 0);
                        worksheet.getCell(`N${row}`).value = Math.ceil(result.distance || 0);
                        worksheet.getCell(`O${row}`).value = Math.ceil(parseFloat(result.radial) || 0);
                        worksheet.getCell(`P${row}`).value = Math.ceil(result.flightTime || 0);
                    }
                });

                if (flightData.alternateFuelData) {
                    worksheet.getCell('O22').value = flightData.alternateFuelData.alternateFuel || 0;
                }
            }

            console.log('Writing buffer...');
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            console.log('Buffer written, blob size:', blob.size);

            console.log('Starting download...');
            this.downloadBlob(blob, 'VFR-Flight-Plan.xlsx');
            alert('Excel file generated successfully! Check your downloads folder.');

        } catch (error) {
            console.error('Excel export error:', error);
            alert(`Export failed: ${error.message}`);
            throw error;
        }
    }

    static downloadBlob(blob, filename) {
        console.log('downloadBlob called with:', filename, 'size:', blob.size);
        const url = URL.createObjectURL(blob);
        console.log('Blob URL created:', url);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        console.log('Clicking download link...');
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Download link cleaned up');
        }, 100);
    }

    /**
     * Esporta il piano di volo in PDF formato A4 landscape (Split Layout)
     * Layout: A4 piegato in due.
     * Sinistra: Main Route
     * Destra: Alternate Route + Fuel
     */
    static async exportToPDF(flightData) {
        try {
            console.log('Starting PDF export (Split View)...');

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = 297;
            const pageHeight = 210;
            const margin = 10;
            const midGutter = 10;

            // Larghezza di ogni sezione (metà pagina meno margini)
            const sectionWidth = (pageWidth - (margin * 2) - midGutter) / 2;

            // Coordinate X di partenza
            const leftSectionX = margin;
            const rightSectionX = margin + sectionWidth + midGutter;

            // --- HEADER DRAWING HELPER ---
            const drawHeader = (xStart, yStart) => {
                let y = yStart;

                pdf.setDrawColor(0, 0, 0);
                pdf.setLineWidth(0.3);
                pdf.setFillColor(255, 255, 255);

                // Righe vuote iniziali (titolo, note, etc custom dell'utente)
                // Usiamo 3 righe da 7mm
                const headerRowHeight = 7;
                for (let i = 0; i < 3; i++) {
                    pdf.rect(xStart, y, sectionWidth, headerRowHeight);
                    y += headerRowHeight;
                }

                y += 2; // Spazietto

                // Info Strip: ATIS INFO | RWY | Wind | QNH
                const infoHeight = 6;
                // Proporzioni larghezza colonne
                const colWs = [
                    sectionWidth * 0.4, // ATIS
                    sectionWidth * 0.15, // RWY
                    sectionWidth * 0.25, // Wind
                    sectionWidth * 0.2  // QNH
                ];

                const labels = ['ATIS INFO', 'RWY:', 'Wind:', 'QNH:'];

                let cx = xStart;
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');

                for (let i = 0; i < 4; i++) {
                    pdf.rect(cx, y, colWs[i], infoHeight);
                    pdf.text(labels[i], cx + 2, y + 4);
                    cx += colWs[i];
                }
                y += infoHeight;

                // 2 Righe vuote compilabili sotto l'header info
                const emptyRowH = 8;
                for (let r = 0; r < 2; r++) {
                    let cx2 = xStart;
                    for (let i = 0; i < 4; i++) {
                        pdf.rect(cx2, y, colWs[i], emptyRowH);
                        cx2 += colWs[i];
                    }
                    y += emptyRowH;
                }

                return y + 5; // Ritorna la Y finale + spazio
            };

            // --- TABLE DRAWING HELPER ---
            const drawRouteTable = (xStart, yStart, results) => {
                const tableHeaders = [['FIX', 'Route', 'ALT.', 'Dist.', 'Radials', 'Ft', 'ETO', 'ATO', 'RETO']];
                const tableBody = [];

                if (results && results.length > 0) {
                    results.forEach((result, index) => {
                        if (index === 0) {
                            tableBody.push([
                                result.fix.split(',')[0],
                                '', '', '', '', '', '', '', ''
                            ]);
                        } else {
                            tableBody.push([
                                result.fix.split(',')[0],
                                Math.ceil(parseFloat(result.route) || 0).toString(),
                                Math.ceil(result.altitude || 0).toString(),
                                Math.ceil(result.distance || 0).toString(),
                                Math.ceil(parseFloat(result.radial) || 0).toString(),
                                Math.ceil(result.flightTime || 0).toString(),
                                '', '', ''
                            ]);
                        }
                    });
                }

                // Add blank rows to fill space to mimic a form
                const minRows = 14;
                if (tableBody.length < minRows) {
                    const rowsToAdd = minRows - tableBody.length;
                    for (let i = 0; i < rowsToAdd; i++) {
                        tableBody.push(['', '', '', '', '', '', '', '', '']);
                    }
                }

                pdf.autoTable({
                    startY: yStart,
                    margin: { left: xStart },
                    tableWidth: sectionWidth,
                    head: tableHeaders,
                    body: tableBody,
                    theme: 'plain',
                    styles: {
                        lineWidth: 0.1,
                        lineColor: [0, 0, 0],
                        fontSize: 8, // Font leggermente più piccolo per stare nella metà pagina
                        cellPadding: 1,
                        textColor: [0, 0, 0],
                        font: 'helvetica',
                        valign: 'middle',
                        halign: 'center'
                    },
                    headStyles: {
                        fillColor: [255, 255, 255],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                        lineWidth: 0.3
                    },
                    columnStyles: {
                        0: { halign: 'left', cellWidth: 25 }, // FIX slightly narrower
                    },
                    didParseCell: function (data) {
                        // Evidenzia colonna Radials (index 4)
                        if ((data.section === 'body' || data.section === 'head') && data.column.index === 4) {
                            data.cell.styles.fillColor = [220, 220, 220];
                        }
                    }
                });

                return pdf.lastAutoTable.finalY;
            };

            // --- DRAW LEFT SECTION (MAIN) ---
            let leftY = 10;
            leftY = drawHeader(leftSectionX, leftY);

            // Main Route Table
            drawRouteTable(leftSectionX, leftY, flightData.flightResults);

            // --- DRAW RIGHT SECTION (ALTERNATE) ---
            let rightY = 10;
            rightY = drawHeader(rightSectionX, rightY);

            // Alternate Route Table
            const altResults = (flightData.alternateResults && flightData.alternateResults.length > 0)
                ? flightData.alternateResults
                : []; // Se vuoto disegnerà righe vuote grazie al minRows

            const finalRightTableY = drawRouteTable(rightSectionX, rightY, altResults);

            // --- FUEL TABLE (BOTTOM RIGHT) ---

            // Fix: usa 'margin' invece di 'rightMargin' che non è definito
            const fuelTableX = pageWidth - 100 - margin; // Allineato a destra, largo 100mm
            const fuelTableWidth = 100;
            const fuelRowHeight = 6;

            // Calcola Y posizione
            const fuelTableHeight = 6 * 45; // Stima
            let fuelY = pageHeight - margin - (6 * 6) - 5; // Height approx 40mm

            // Assicuriamoci che non si sovrapponga alla tabella alternata
            if (finalRightTableY + 5 > fuelY) {
                fuelY = finalRightTableY + 5;
            }

            // Dati Fuel
            const fuelData = flightData.fuelData || {};
            const altFuelData = flightData.alternateFuelData || {};

            // Prepariamo i valori
            const tripFuel = (fuelData.tripFuel || 0);
            const altFuel = (altFuelData.alternateFuel || 0);
            const contFuel = (fuelData.contingencyFuel || 0);
            const resFuel = (fuelData.reserveFuel || 0);
            const fob = 0;
            const extra = 0;

            const fuelRows = [
                { label: 'Trip Fuel:', val: tripFuel },
                { label: 'Alternate Fuel:', val: altFuel },
                { label: 'Contingency Fuel (5% TF or 5lt min):', val: contFuel },
                { label: 'Final Reserve (45\' at 1500 ft):', val: resFuel },
                { label: 'Fuel on Board', val: fob },
                { label: 'Extra Fuel:', val: extra }
            ];

            // Header Fuel Table
            pdf.setLineWidth(0.4);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);

            let curFy = fuelY;
            let curFx = fuelTableX;

            // Disegna Header
            pdf.rect(curFx, curFy, fuelTableWidth, fuelRowHeight); // Bordo esterno header
            // Linee verticali
            pdf.line(curFx + 55, curFy, curFx + 55, curFy + fuelRowHeight);
            pdf.line(curFx + 70, curFy, curFx + 70, curFy + fuelRowHeight);
            pdf.line(curFx + 85, curFy, curFx + 85, curFy + fuelRowHeight);

            pdf.text('Fuel:', curFx + 2, curFy + 4.5);
            pdf.text('Liters', curFx + 55 + 1, curFy + 4.5);
            pdf.text('Kg', curFx + 70 + 3, curFy + 4.5);
            pdf.text('Lbs', curFx + 85 + 2, curFy + 4.5);

            curFy += fuelRowHeight;

            // Rows
            pdf.setFont('helvetica', 'normal');
            const col1W = 55;
            const col2W = 15;
            const col3W = 15;

            fuelRows.forEach(row => {
                pdf.rect(curFx, curFy, fuelTableWidth, fuelRowHeight);
                // Vertical lines
                pdf.line(curFx + col1W, curFy, curFx + col1W, curFy + fuelRowHeight);
                pdf.line(curFx + col1W + col2W, curFy, curFx + col1W + col2W, curFy + fuelRowHeight);
                pdf.line(curFx + col1W + col2W + col3W, curFy, curFx + col1W + col2W + col3W, curFy + fuelRowHeight);

                pdf.text(row.label, curFx + 2, curFy + 4.5);

                if (row.val > 0) {
                    pdf.text(row.val.toFixed(1), curFx + col1W + 4, curFy + 4.5, { align: 'left' });
                }

                // Kg e Lbs vuoti (0) come da template
                pdf.text('0', curFx + col1W + col2W + 7, curFy + 4.5, { align: 'center' });
                pdf.text('0', curFx + col1W + col2W + col3W + 7, curFy + 4.5, { align: 'center' });

                curFy += fuelRowHeight;
            });

            // --- SAVE PDF ---
            pdf.save('VFR-Flight-Plan.pdf');
            console.log('PDF generated successfully!');

        } catch (error) {
            console.error('PDF export error:', error);
            throw error;
        }
    }

    /**
     * Genera l'HTML per il piano di volo con layout simile al template Excel
     */
    static generateFlightPlanHTML(flightData) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('it-IT');
        const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        // Calcoliamo i totali
        const totalDistance = flightData.flightResults
            ? flightData.flightResults.reduce((s, r) => s + (r.distance || 0), 0)
            : 0;
        const totalTime = flightData.flightResults
            ? flightData.flightResults.reduce((s, r) => s + (r.flightTime || 0), 0)
            : 0;

        const totalFuel = flightData.fuelData
            ? (flightData.fuelData.tripFuel || 0) +
            (flightData.fuelData.contingencyFuel || 0) +
            (flightData.fuelData.reserveFuel || 0)
            : 0;

        // Generiamo le righe della tabella principale
        let mainRouteRows = '';
        if (flightData.flightResults && flightData.flightResults.length > 0) {
            mainRouteRows = flightData.flightResults.map((result, index) => {
                if (index === 0) {
                    return `<tr>
                        <td class="fix-cell">${result.fix.split(',')[0]}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>`;
                }
                return `<tr>
                    <td class="fix-cell">${result.fix.split(',')[0]}</td>
                    <td>${Math.ceil(parseFloat(result.route) || 0)}°</td>
                    <td>${Math.ceil(result.altitude || 0)} ft</td>
                    <td>${Math.ceil(result.distance || 0)} NM</td>
                    <td>${Math.ceil(parseFloat(result.radial) || 0)}°</td>
                    <td>${Math.ceil(result.flightTime || 0)} min</td>
                </tr>`;
            }).join('');
        }

        // Generiamo le righe della tabella alternata (se presente)
        let alternateRouteRows = '';
        let alternateSection = '';
        if (flightData.alternateResults && flightData.alternateResults.length > 0) {
            alternateRouteRows = flightData.alternateResults.map((result, index) => {
                if (index === 0) {
                    return `<tr>
                        <td class="fix-cell">${result.fix.split(',')[0]}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>`;
                }
                return `<tr>
                    <td class="fix-cell">${result.fix.split(',')[0]}</td>
                    <td>${Math.ceil(parseFloat(result.route) || 0)}°</td>
                    <td>${Math.ceil(result.altitude || 0)} ft</td>
                    <td>${Math.ceil(result.distance || 0)} NM</td>
                    <td>${Math.ceil(parseFloat(result.radial) || 0)}°</td>
                    <td>${Math.ceil(result.flightTime || 0)} min</td>
                </tr>`;
            }).join('');

            const altFuel = flightData.alternateFuelData ? flightData.alternateFuelData.alternateFuel : 0;

            alternateSection = `
                <div class="alternate-section">
                    <h3>ROTTA ALTERNATA</h3>
                    <table class="flight-table">
                        <thead>
                            <tr>
                                <th>FIX</th>
                                <th>Route</th>
                                <th>Alt [Ft]</th>
                                <th>Dist [NM]</th>
                                <th>Radial</th>
                                <th>Time [min]</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alternateRouteRows}
                        </tbody>
                    </table>
                    <div class="fuel-info">
                        <strong>Carburante Alternato:</strong> ${altFuel.toFixed(1)} L
                    </div>
                </div>
            `;
        }

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background: white;
            padding: 15px;
            width: 1123px;
            height: 794px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 3px solid #1a4d8f;
            padding-bottom: 10px;
        }
        
        .header h1 {
            font-size: 24px;
            color: #1a4d8f;
            margin-bottom: 5px;
        }
        
        .header .subtitle {
            font-size: 12px;
            color: #666;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 11px;
        }
        
        .main-section {
            margin-bottom: 15px;
        }
        
        .main-section h3 {
            font-size: 14px;
            color: #1a4d8f;
            margin-bottom: 8px;
            border-bottom: 2px solid #1a4d8f;
            padding-bottom: 3px;
        }
        
        .flight-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 10px;
        }
        
        .flight-table thead {
            background-color: #1a4d8f;
            color: white;
        }
        
        .flight-table th,
        .flight-table td {
            border: 1px solid #ccc;
            padding: 6px 8px;
            text-align: center;
        }
        
        .flight-table .fix-cell {
            font-weight: bold;
            text-align: left;
        }
        
        .flight-table tbody tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        
        .summary-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .fuel-info {
            background-color: #f0f7ff;
            border: 2px solid #1a4d8f;
            border-radius: 5px;
            padding: 10px;
            font-size: 11px;
        }
        
        .fuel-info div {
            margin-bottom: 5px;
        }
        
        .fuel-info .total {
            font-size: 13px;
            font-weight: bold;
            color: #1a4d8f;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 2px solid #1a4d8f;
        }
        
        .alternate-section {
            margin-top: 15px;
            border-top: 2px solid #ffc107;
            padding-top: 10px;
        }
        
        .alternate-section h3 {
            color: #ff9800;
            border-bottom: 2px solid #ffc107;
        }
        
        .totals-row {
            background-color: #e3f2fd;
            padding: 8px;
            font-size: 12px;
            font-weight: bold;
            display: flex;
            justify-content: space-around;
            border: 2px solid #1a4d8f;
            border-radius: 5px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>VFR FLIGHT PLAN</h1>
        <div class="subtitle">Piano di Volo VFR - ATO 042 Rules</div>
    </div>
    
    <div class="info-row">
        <span><strong>Data:</strong> ${dateStr}</span>
        <span><strong>Ora:</strong> ${timeStr}</span>
    </div>
    
    <div class="main-section">
        <h3>ROTTA PRINCIPALE</h3>
        <table class="flight-table">
            <thead>
                <tr>
                    <th>FIX</th>
                    <th>Route</th>
                    <th>Alt [Ft]</th>
                    <th>Dist [NM]</th>
                    <th>Radial</th>
                    <th>Time [min]</th>
                </tr>
            </thead>
            <tbody>
                ${mainRouteRows}
            </tbody>
        </table>
        
        <div class="totals-row">
            <span>Distanza Totale: ${totalDistance.toFixed(1)} NM</span>
            <span>Tempo Totale: ${totalTime.toFixed(0)} min</span>
        </div>
        
        <div class="fuel-info">
            <div><strong>Trip Fuel:</strong> ${(flightData.fuelData?.tripFuel || 0).toFixed(1)} L</div>
            <div><strong>Contingency Fuel (5%):</strong> ${(flightData.fuelData?.contingencyFuel || 0).toFixed(1)} L</div>
            <div><strong>Reserve Fuel (30 min):</strong> ${(flightData.fuelData?.reserveFuel || 0).toFixed(1)} L</div>
            <div class="total">CARBURANTE TOTALE: ${totalFuel.toFixed(1)} L</div>
        </div>
    </div>
    
    ${alternateSection}
</body>
</html>
        `.trim();
    }
}

