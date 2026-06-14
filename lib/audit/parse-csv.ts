/**
 * Stripe disputes-export CSV parser for the public audit funnel.
 *
 * SECURITY POSTURE: file contents are fully untrusted. This parser:
 *  - never executes anything from the file,
 *  - hard-caps the number of rows it will read (DoS guard),
 *  - coerces every field defensively and never throws on bad data,
 *  - returns structured results + a list of soft warnings for the UI.
 *
 * A Stripe dispute export typically has columns like:
 *   id, Amount, Currency, Created (UTC), Reason, Status, Disputed Amount, ...
 * We match column headers case-insensitively and tolerate reordering / extra
 * columns. Manual entry uses the same AuditDispute shape (see types.ts).
 */

import type { AuditDispute, DisputeOutcome } from './types';
import { normalizeReasonCode } from './reason-codes';

export const MAX_CSV_ROWS = 2000;
export const MAX_CSV_BYTES = 1_000_000; // 1 MB — generous for a 90-day export

export interface ParseResult {
  disputes: AuditDispute[];
  warnings: string[];
  rowsParsed: number;
  rowsSkipped: number;
}

// ─── Minimal RFC-4180-ish CSV tokenizer (handles quoted fields + commas) ─────
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

function splitRows(text: string): string[] {
  // Normalize newlines; a fully correct parser would track quotes across lines,
  // but Stripe exports keep one record per line. We guard length below.
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand.toLowerCase());
    if (idx !== -1) return idx;
  }
  // Fuzzy contains-match fallback.
  for (let i = 0; i < lower.length; i += 1) {
    if (candidates.some((c) => lower[i].includes(c.toLowerCase()))) return i;
  }
  return -1;
}

function coerceAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  // Stripe amount columns are in major units in the CSV export. Guard absurd values.
  if (n < 0 || n > 10_000_000) return null;
  return n;
}

function coerceDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

function coerceOutcome(rawStatus: string | undefined): DisputeOutcome {
  if (!rawStatus) return 'unknown';
  const v = rawStatus.toLowerCase().trim();
  if (v === 'won' || v.includes('win')) return 'won';
  if (v === 'lost' || v.includes('lose')) return 'lost';
  if (
    v.includes('needs_response') ||
    v.includes('under_review') ||
    v.includes('warning') ||
    v.includes('open') ||
    v.includes('pending')
  ) {
    return 'open';
  }
  return 'unknown';
}

/**
 * Parse a Stripe disputes CSV export. Defensive throughout; never throws.
 */
export function parseStripeDisputesCsv(text: string): ParseResult {
  const warnings: string[] = [];

  if (text.length > MAX_CSV_BYTES) {
    return {
      disputes: [],
      warnings: ['File is too large to read. Trim it to your last 90 days of disputes and try again.'],
      rowsParsed: 0,
      rowsSkipped: 0,
    };
  }

  const rows = splitRows(text).filter((r) => r.trim() !== '');
  if (rows.length < 2) {
    return {
      disputes: [],
      warnings: ['We could not find any dispute rows in that file. Make sure you exported disputes from Stripe.'],
      rowsParsed: 0,
      rowsSkipped: 0,
    };
  }

  const headers = parseCsvLine(rows[0]);
  const idx = {
    id: findHeaderIndex(headers, ['id', 'dispute id', 'dispute_id']),
    amount: findHeaderIndex(headers, ['disputed amount', 'amount', 'charge amount']),
    currency: findHeaderIndex(headers, ['currency', 'converted currency']),
    created: findHeaderIndex(headers, ['created (utc)', 'created', 'created date', 'date']),
    reason: findHeaderIndex(headers, ['reason', 'dispute reason', 'network reason code']),
    status: findHeaderIndex(headers, ['status', 'dispute status', 'outcome']),
  };

  if (idx.reason === -1 && idx.status === -1) {
    warnings.push(
      'We could not find a Reason or Status column. We will still count the rows for your dispute rate, but per-dispute winnability needs those columns or manual entry.',
    );
  }

  const dataRows = rows.slice(1, MAX_CSV_ROWS + 1);
  if (rows.length - 1 > MAX_CSV_ROWS) {
    warnings.push(`Only the first ${MAX_CSV_ROWS} disputes were read.`);
  }

  const disputes: AuditDispute[] = [];
  let rowsSkipped = 0;

  dataRows.forEach((row, i) => {
    const cells = parseCsvLine(row);
    // A valid data row needs at least one recognizable signal.
    const reasonRaw = idx.reason !== -1 ? cells[idx.reason]?.trim() ?? null : null;
    const statusRaw = idx.status !== -1 ? cells[idx.status]?.trim() : undefined;
    const amount = idx.amount !== -1 ? coerceAmount(cells[idx.amount]) : null;

    if (!reasonRaw && !statusRaw && amount === null) {
      rowsSkipped += 1;
      return;
    }

    disputes.push({
      id: `csv-${i}-${Math.random().toString(36).slice(2, 8)}`,
      amount,
      currency: idx.currency !== -1 ? (cells[idx.currency]?.trim()?.toLowerCase() || null) : null,
      reasonCode: normalizeReasonCode(reasonRaw),
      reasonRaw,
      createdAt: idx.created !== -1 ? coerceDate(cells[idx.created]) : null,
      outcome: coerceOutcome(statusRaw),
      // CSV exports do not carry proof flags; default all false (merchant can
      // refine in the result step). Honest: no proof claimed = cautious read.
      proof: { delivery: false, usage: false, comms: false },
      source: 'csv',
    });
  });

  if (disputes.length === 0 && warnings.length === 0) {
    warnings.push('We read the file but could not recognize any dispute rows.');
  }

  return {
    disputes,
    warnings,
    rowsParsed: disputes.length,
    rowsSkipped,
  };
}
