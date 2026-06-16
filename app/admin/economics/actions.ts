'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePlatformAdmin, logPlatformAdminEvent } from '@/lib/admin/platform-admin';
import { createServiceClient } from '@/lib/supabase/server';
import { financialsInputSchema, updateFinancials } from '@/lib/admin/financials';

const ECONOMICS_PATH = '/admin/economics';
const FIELD_KEYS = Object.keys(financialsInputSchema.shape);

export async function updateFinancialsAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();

  // Only forward fields the form actually submitted. Blank numeric fields stay
  // unchanged; `payingCustomersOverride` is always forwarded so a blank clears it.
  const raw: Record<string, string> = {};
  for (const key of FIELD_KEYS) {
    const value = formData.get(key);
    if (typeof value !== 'string') continue;
    if (key === 'payingCustomersOverride') {
      raw[key] = value;
    } else if (value.trim() !== '') {
      raw[key] = value;
    }
  }

  const parsed = financialsInputSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`${ECONOMICS_PATH}?error=invalid`);
  }

  const service = createServiceClient();
  try {
    await updateFinancials(parsed.data, admin.userId, service);
  } catch (error) {
    console.error('[admin] update financials failed:', error instanceof Error ? error.message : error);
    redirect(`${ECONOMICS_PATH}?error=save-failed`);
  }

  await logPlatformAdminEvent({
    service,
    admin,
    action: 'platform_financials_updated',
    targetType: 'platform_financials',
    targetId: 'singleton',
    metadata: { fields: Object.keys(parsed.data) },
  });

  revalidatePath(ECONOMICS_PATH);
  redirect(`${ECONOMICS_PATH}?notice=saved`);
}

// ── Save a named scenario ────────────────────────────────────────────────────
//
// The cockpit posts the current tunable inputs as a JSON blob plus a name + kind.
// We validate the name/kind and re-validate the inputs through the same schema
// that governs the real financials, then persist a row in
// `platform_financial_scenarios`. If that table is absent (migration unapplied),
// the insert errors and we redirect with a graceful error notice — nothing else
// in the cockpit breaks.

const SCENARIO_KINDS = ['base', 'upside', 'risk', 'custom'] as const;

const scenarioMetaSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(SCENARIO_KINDS),
  notes: z
    .string()
    .trim()
    .max(400)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function saveScenarioAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();

  const meta = scenarioMetaSchema.safeParse({
    name: formData.get('name'),
    kind: formData.get('kind'),
    notes: formData.get('notes'),
  });
  if (!meta.success) {
    redirect(`${ECONOMICS_PATH}?error=scenario-invalid`);
  }

  // Inputs arrive as a JSON string built client-side from the live cockpit state.
  const inputsRaw = formData.get('inputs');
  let parsedInputs: unknown;
  try {
    parsedInputs = typeof inputsRaw === 'string' ? JSON.parse(inputsRaw) : {};
  } catch {
    redirect(`${ECONOMICS_PATH}?error=scenario-invalid`);
  }

  const inputsCheck = financialsInputSchema.safeParse(parsedInputs);
  if (!inputsCheck.success) {
    redirect(`${ECONOMICS_PATH}?error=scenario-invalid`);
  }

  const service = createServiceClient();
  const { error } = await service.from('platform_financial_scenarios').insert({
    name: meta.data.name,
    kind: meta.data.kind,
    inputs: inputsCheck.data,
    notes: meta.data.notes,
    is_pinned: false,
    created_by: admin.userId,
  });

  if (error) {
    // Table likely absent (unapplied migration) — degrade with a clear notice.
    console.error('[admin] save scenario failed:', error.message);
    redirect(`${ECONOMICS_PATH}?error=scenario-failed`);
  }

  await logPlatformAdminEvent({
    service,
    admin,
    action: 'platform_scenario_saved',
    targetType: 'platform_financial_scenario',
    targetId: meta.data.name,
    metadata: { kind: meta.data.kind },
  });

  revalidatePath(ECONOMICS_PATH);
  redirect(`${ECONOMICS_PATH}?notice=scenario-saved`);
}
