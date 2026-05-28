-- Enable UUID generation + crypto helpers (sha256, hmac)
create extension if not exists "pgcrypto";

-- Private helper schema. Security-definer helpers must not live in an API-exposed schema.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

-- Utility function: auto-update updated_at on row change
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Processor enum — MVP handles 'stripe' only; future-compatible
create type processor_kind as enum (
  'stripe',
  'shopify_payments',
  'paypal',
  'braintree',
  'adyen',
  'square'
);

-- JSONB schema-version enforcement — every JSONB blob must declare its shape
create or replace function require_jsonb_schema_version(payload jsonb, column_name text)
returns void as $$
begin
  if payload is null then return; end if;
  if not (payload ? 'schema_version') then
    raise exception 'JSONB column % missing required top-level "schema_version" key', column_name;
  end if;
end;
$$ language plpgsql immutable;
