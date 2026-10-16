import { promises as fs } from 'fs';
import { PDFParse } from 'pdf-parse';
import { FileType } from './parse.types';

export interface ExtractedText {
  text: string;
  pages: string[];
}

/** TXT/CSV: read as UTF-8 (BOM stripped). PDF: pdf-parse v2 class API. */
export async function extractText(
  filePath: string,
  fileType: FileType,
): Promise<ExtractedText> {
  const buffer = await fs.readFile(filePath);
  if (fileType !== 'pdf') {
    // txt, csv, ofx, qfx are text formats
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    return { text, pages: [text] };
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    // pageJoiner '' drops the default "-- N of M --" separators between pages.
    const result = await parser.getText({ pageJoiner: '' });
    const pages = result.pages.map((p) => p.text);
    return { text: result.text, pages: pages.length ? pages : [result.text] };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
