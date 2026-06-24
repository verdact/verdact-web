import { describe, expect, it } from 'vitest';
import { prepareStripeEvidence } from './submission';
import type { EvidencePacket } from './packet';

function packet(overrides: Partial<EvidencePacket> = {}): EvidencePacket {
  return {
    fields: [
      {
        key: 'product_description',
        label: 'Product description',
        value: 'Implementation service',
        source: 'Business profile',
        present: true,
      },
      {
        key: 'customer_name',
        label: 'Customer name',
        value: '',
        source: 'Dispute record',
        present: false,
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
      checks: [],
      missing: [],
      missingKeys: [],
    },
    filingBlocked: false,
    ...overrides,
  };
}

describe('prepareStripeEvidence', () => {
  it('maps present packet fields and uploaded exhibits to Stripe evidence fields', () => {
    const prepared = prepareStripeEvidence(
      packet({
        exhibits: [
          {
            id: 'file-row-1',
            name: 'Service documentation (PDF)',
            stripeField: 'service_documentation',
            purposeLabel: 'Service documentation',
            sizeBytes: 1000,
            mime: 'application/pdf',
            processorFileId: 'file_stripe_123',
            supabasePath: 'merchant/dispute/file.pdf',
          },
        ],
      }),
    );

    expect(prepared.evidence.product_description).toBe('Implementation service');
    expect(prepared.evidence.customer_name).toBeUndefined();
    expect(prepared.evidence.service_documentation).toBe('file_stripe_123');
    expect(prepared.blockedReasons).toEqual([]);
  });

  it('blocks submission when local exhibits have not been uploaded to Stripe', () => {
    const prepared = prepareStripeEvidence(
      packet({
        exhibits: [
          {
            id: 'file-row-1',
            name: 'Service documentation (PDF)',
            stripeField: 'service_documentation',
            purposeLabel: 'Service documentation',
            sizeBytes: 1000,
            mime: 'application/pdf',
            processorFileId: null,
            supabasePath: 'merchant/dispute/file.pdf',
          },
        ],
      }),
    );

    expect(prepared.missingStripeUploads).toHaveLength(1);
    expect(prepared.blockedReasons).toContain('stripe_file_uploads_missing');
  });

  it('blocks duplicate exhibits for the same Stripe file field', () => {
    const prepared = prepareStripeEvidence(
      packet({
        exhibits: [
          {
            id: 'file-row-1',
            name: 'Service documentation 1',
            stripeField: 'service_documentation',
            purposeLabel: 'Service documentation',
            sizeBytes: 1000,
            mime: 'application/pdf',
            processorFileId: 'file_1',
            supabasePath: null,
          },
          {
            id: 'file-row-2',
            name: 'Service documentation 2',
            stripeField: 'service_documentation',
            purposeLabel: 'Service documentation',
            sizeBytes: 1000,
            mime: 'application/pdf',
            processorFileId: 'file_2',
            supabasePath: null,
          },
        ],
      }),
    );

    expect(prepared.evidence.service_documentation).toBe('file_1');
    expect(prepared.duplicateFieldExhibits).toHaveLength(1);
    expect(prepared.blockedReasons).toContain('multiple_files_for_single_stripe_field');
  });
});
