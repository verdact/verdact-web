import type Stripe from 'stripe';
import { describe, it, expect } from 'vitest';
import { buildBillingAddress, extractPiiFromCharge } from './dispute-pii';

// Minimal charge factory — only the fields extractPiiFromCharge reads.
function charge(partial: Partial<Stripe.Charge>): Stripe.Charge {
  return partial as unknown as Stripe.Charge;
}

describe('buildBillingAddress', () => {
  it('returns null for a missing address', () => {
    expect(buildBillingAddress(null)).toBeNull();
    expect(buildBillingAddress(undefined)).toBeNull();
  });

  it('returns null when every field is empty/blank', () => {
    expect(
      buildBillingAddress({
        line1: '',
        line2: null,
        city: '   ',
        state: null,
        postal_code: '',
        country: null,
      } as Stripe.Address),
    ).toBeNull();
  });

  it('builds a payload with the required top-level schema_version', () => {
    const result = buildBillingAddress({
      line1: '1 Market St',
      line2: null,
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94105',
      country: 'US',
    } as Stripe.Address);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      schema_version: 'v1',
      line1: '1 Market St',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94105',
      country: 'US',
    });
  });

  it('trims and nulls blank fields while keeping real ones', () => {
    const result = buildBillingAddress({
      line1: '  10 Downing St  ',
      city: '',
      country: 'GB',
    } as Stripe.Address);
    expect(result).toMatchObject({ schema_version: 'v1', line1: '10 Downing St', city: null, country: 'GB' });
  });
});

describe('extractPiiFromCharge', () => {
  it('returns null when the charge has no usable identity', () => {
    expect(extractPiiFromCharge(charge({ receipt_email: null }))).toBeNull();
    expect(
      extractPiiFromCharge(charge({ billing_details: { name: '  ', email: null, phone: null, address: null } as Stripe.Charge['billing_details'] })),
    ).toBeNull();
  });

  it('extracts name, email, and phone from billing_details', () => {
    const result = extractPiiFromCharge(
      charge({
        billing_details: {
          name: 'Dana Merchant',
          email: 'dana@example.com',
          phone: '+1 415 555 0100',
          address: null,
        } as Stripe.Charge['billing_details'],
        receipt_email: null,
      }),
    );
    expect(result).toEqual({
      customer_name: 'Dana Merchant',
      customer_email: 'dana@example.com',
      customer_phone: '+1 415 555 0100',
      billing_address: null,
    });
  });

  it('falls back to receipt_email when billing email is absent', () => {
    const result = extractPiiFromCharge(
      charge({
        billing_details: { name: null, email: null, phone: null, address: null } as Stripe.Charge['billing_details'],
        receipt_email: 'receipt@example.com',
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.customer_email).toBe('receipt@example.com');
  });

  it('includes the billing address when present', () => {
    const result = extractPiiFromCharge(
      charge({
        billing_details: {
          name: 'Dana Merchant',
          email: null,
          phone: null,
          address: { line1: '1 Market St', country: 'US' } as Stripe.Address,
        } as Stripe.Charge['billing_details'],
        receipt_email: null,
      }),
    );
    expect(result?.billing_address).toMatchObject({ schema_version: 'v1', line1: '1 Market St', country: 'US' });
  });
});
