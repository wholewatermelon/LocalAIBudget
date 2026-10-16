const ollama = require('ollama').default;
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'localaibudget',
    password: process.env.DB_PASSWORD,
    port: 5432,
};

async function categorizeTransaction(description) {
    const prompt = `You are a financial assistant. Categorize the following transaction description into one of these categories: Housing, Food, Transport, Entertainment, Utilities, Income, Shopping, or Other. Return ONLY the category name.
    Transaction: "${description}"`;

    const response = await ollama.generate({
        model: 'gemma4',
        prompt: prompt,
        think: false,
    });

    return response.response.trim();
}

async function processStatements() {
    const client = new Client(dbConfig);
    await client.connect();

    try {
        // 1. Setup Accounts in DB
        const accounts = [
            { name: 'Main Checking', type: 'Bank' },
            { name: 'Travel Rewards Card', type: 'Credit Card' }
        ];

        for (const acc of accounts) {
            await client.query(
                'INSERT INTO accounts (account_name, account_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [acc.name, acc.type]
            );
        }

        // 2. Scan .txt files
        const baseDir = path.join('data', 'statements');
        const months = fs.readdirSync(baseDir);

        for (const month of months) {
            const monthDir = path.join(baseDir, month);
            if (!fs.statSync(monthDir).isDirectory()) continue;

            const files = fs.readdirSync(monthDir).filter(f => f.endsWith('.txt'));
            for (const file of files) {
                const filePath = path.join(monthDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    const [date, ...descAndAmount] = line.split(' ');
                    const amount = descAndAmount.pop();
                    const description = descAndAmount.join(' ');

                    console.log(`Processing: ${description}...`);
                    const categoryName = await categorizeTransaction(description);
                    console.log(` -> Category: ${categoryName}`);

                    // Ensure category exists
                    await client.query(
                        'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name',
                        [categoryName]
                    );
                    const catRes = await client.query('SELECT id FROM categories WHERE name = $1', [categoryName]);
                    const categoryId = catRes.rows[0].id;

                    // Get account ID
                    const accRes = await client.query('SELECT id FROM accounts WHERE account_name = $1', [file.split('_')[0].replace('_', ' ')]);
                    const accountId = accRes.rows[0]?.id || 1;

                    // Insert transaction
                    await client.query(
                        'INSERT INTO transactions (account_id, category_id, transaction_date, description, amount, raw_text) VALUES ($1, $2, $3, $4, $5, $6)',
                        [accountId, categoryId, date, description, parseFloat(amount), line]
                    );
                }
            }
        }
        console.log('All transactions processed and stored in PostgreSQL!');
    } catch (err) {
        console.error('Error during processing:', err);
    } finally {
        await client.end();
    }
}

processStatements();
