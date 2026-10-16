const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function extractTransactionsFromPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    
    // The module is an object, and the parser is a class.
    let data;
    try {
        const parser = new pdf.PDFParse();
        data = await parser.parse(dataBuffer);
    } catch (e) {
        throw new Error('PDF Parsing failed: ' + e.message);
    }
    
    const text = data.text;
    
    console.log(`--- Extracting from: ${path.basename(filePath)} ---`);
    console.log(text);
    
    const transactions = [];
    const lines = text.split('\\n');

    lines.forEach(line => {
        const match = line.match(/(\\d{4}-\\d{2}-\\d{2})\\s+(.+?)\\s+(-?\\d+\\.\\d{2})/);
        if (match) {
            transactions.push({
                date: match[1],
                description: match[2].trim(),
                amount: parseFloat(match[3])
            });
        }
    });

    return transactions;
}

async function scanStatements() {
    const baseDir = path.join('data', 'statements');
    if (!fs.existsSync(baseDir)) {
        console.error('Statements directory not found.');
        return;
    }

    const months = fs.readdirSync(baseDir);
    for (const month of months) {
        const monthDir = path.join(baseDir, month);
        if (!fs.statSync(monthDir).isDirectory()) continue;

        const files = fs.readdirSync(monthDir).filter(f => f.endsWith('.pdf'));
        for (const file of files) {
            const filePath = path.join(monthDir, file);
            try {
                const transactions = await extractTransactionsFromPDF(filePath);
                console.log(`Found ${transactions.length} transactions in ${file}`);
                console.table(transactions);
            } catch (e) {
                console.error(`Error processing ${file}:`, e);
            }
        }
    }
}

scanStatements().catch(console.error);
