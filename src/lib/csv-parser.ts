/**
 * Dependency-free CSV/TSV parser (RFC 4180 compatible).
 *
 * Handles:
 *  - quoted fields containing commas / semicolons / newlines / escaped quotes ("")
 *  - BOM stripping (Excel exports)
 *  - CRLF and LF line endings
 *  - delimiter auto-detection (comma, semicolon or tab)
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

/** detect the most likely delimiter from a CSV sample (outside quoted sections) */
function detectDelimiter(text: string): string {
  const sample = text.slice(0, 64_000);
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;

  for (const d of candidates) {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < sample.length; i++) {
      const ch = sample[i];
      if (ch === '"') {
        // "" inside quotes is an escaped quote, not a toggle
        if (inQuotes && sample[i + 1] === '"') i++;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && ch === d) {
        count++;
      }
    }
    if (count > bestScore) {
      bestScore = count;
      best = d;
    }
  }
  return best;
}

/** parse one CSV record; returns the fields and the index after the record end */
function parseRecord(
  text: string,
  start: number,
  delimiter: string
): { fields: string[]; end: number } {
  const fields: string[] = [];
  let cur = "";
  let i = start;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (ch === '"') {
      if (cur === "") {
        // opening quote — consume quoted section
        i++;
        while (i < n) {
          const c = text[i];
          if (c === '"') {
            if (text[i + 1] === '"') {
              cur += '"';
              i += 2;
            } else {
              i++; // closing quote
              break;
            }
          } else {
            cur += c;
            i++;
          }
        }
        continue;
      }
      // stray quote inside an unquoted field — keep it literally
      cur += ch;
      i++;
      continue;
    }

    if (ch === delimiter) {
      fields.push(cur.trim());
      cur = "";
      i++;
      continue;
    }

    if (ch === "\r") {
      i++;
      continue;
    }

    if (ch === "\n") {
      fields.push(cur.trim());
      return { fields, end: i + 1 };
    }

    cur += ch;
    i++;
  }

  fields.push(cur.trim());
  return { fields, end: n };
}

/** parse a whole CSV/TSV document into headers + data rows */
export function parseCsv(input: string, maxRows = 5000): ParsedCsv {
  const text = input.replace(/^\uFEFF/, ""); // strip BOM
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];

  let pos = 0;
  while (pos < text.length && rows.length < maxRows) {
    const { fields, end } = parseRecord(text, pos, delimiter);
    pos = end;
    // skip fully-empty rows (trailing newlines etc.)
    if (fields.some((f) => f !== "")) rows.push(fields);
    else continue;
  }

  if (rows.length === 0) return { headers: [], rows: [], delimiter };

  // If the first row has no URL-like cell at all it is a header row;
  // otherwise (plain URL list) we synthesise a header and keep every row.
  const first = rows[0];
  const looksLikeHeader = !first.some((f) => /^https?:\/\//i.test(f) || /[\w-]+\.[a-z]{2,}/i.test(f));

  if (looksLikeHeader) {
    return { headers: first, rows: rows.slice(1, maxRows), delimiter };
  }
  // no header — treat every row as data
  return { headers: [], rows: rows.slice(0, maxRows), delimiter };
}
