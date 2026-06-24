import { describe, expect, it } from 'vitest';
import { renderEvidencePacketPdf } from './pdf';
import type { EvidencePacket } from './packet';

describe('renderEvidencePacketPdf', () => {
  it('creates a valid PDF document with packet content', () => {
    const packet: EvidencePacket = {
      fields: [
        {
          key: 'product_description',
          label: 'Product description',
          value: 'Implementation service',
          source: 'Business profile',
          present: true,
        },
      ],
      exhibits: [],
      limits: {
        totalBytes: 0,
        totalLabel: '0 B',
        maxBytes: 4_500_000,
        withinSizeLimit: true,
        fileCount: 0,
      },
      readiness: {
        percent: 100,
        checks: [{ key: 'product_description', label: 'Product description set', done: true }],
        missing: [],
        missingKeys: [],
      },
      filingBlocked: false,
    };

    const pdf = renderEvidencePacketPdf({
      packet,
      title: 'Verdact evidence packet: dispute du_test',
      generatedAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    const text = new TextDecoder().decode(pdf);

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Verdact evidence packet: dispute du_test');
    expect(text).toContain('xref');
    expect(text).toContain('%%EOF');
  });
});
