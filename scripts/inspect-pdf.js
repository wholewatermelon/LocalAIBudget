#!/usr/bin/env node
/*
 * Print the text pdf-parse (v2) extracts from a PDF — i.e. exactly what the server's PDF parser sees.
 * Usage: node scripts/inspect-pdf.js <file.pdf> [--pages]   (--pages prints a per-page breakdown instead)
 * Cells on the same baseline are joined with "\t"; pages end with "-- N of M --" (pdf-parse defaults).
 */
'use strict';

const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/inspect-pdf.js <file.pdf> [--pages]');
    process.exit(2);
  }
  const parser = new PDFParse({ data: fs.readFileSync(file) });
  try {
    const result = await parser.getText();
    if (process.argv.includes('--pages')) {
      for (const p of result.pages) console.log(`===== page ${p.num} =====\n${p.text}`);
    } else {
      console.log(result.text);
    }
    console.error(`[${result.total} page(s)]`);
  } finally {
    await parser.destroy();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
