import { inngest } from '../client';
import {
  CURRENT_KEY_VERSION,
  reEncryptToken,
  tryDecryptToken,
} from '../../crypto';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Connection tables that store encrypted token envelopes.
// Each entry describes where to find and update encrypted columns.
// ---------------------------------------------------------------------------

interface TokenColumn {
  table: string;
  idColumn: string;
  envelopeColumn: string;
  versionColumn: string;
  /** Optional second envelope on the same row (e.g., refresh_token). */
  secondEnvelopeColumn?: string;
}

const TOKEN_TABLES: TokenColumn[] = [
  {
    table: 'slack_connections',
    idColumn: 'id',
    envelopeColumn: 'access_token_encrypted',
    versionColumn: 'token_key_version',
  },
  {
    table: 'gmail_connections',
    idColumn: 'id',
    envelopeColumn: 'access_token_encrypted',
    versionColumn: 'token_key_version',
    secondEnvelopeColumn: 'refresh_token_encrypted',
  },
];

// ---------------------------------------------------------------------------
// Inngest function: rotate-token-keys
// ---------------------------------------------------------------------------

/**
 * Background job that re-encrypts OAuth token envelopes from older key
 * versions to {@link CURRENT_KEY_VERSION}.
 *
 * Trigger manually via Inngest dashboard or schedule as a cron job
 * after updating CURRENT_KEY_VERSION and deploying the new key.
 *
 * Safety:
 *  - Processes rows in batches of 50 to avoid long-running transactions.
 *  - If a single row fails to decrypt (corrupted or wrong key), the row is
 *    marked as `status = 'revoked'` and skipped — it does NOT block the batch.
 *  - Uses the Supabase service role client (bypasses RLS).
 */
export const rotateTokenKeys = inngest.createFunction(
  {
    id: 'rotate-token-keys',
    name: 'Rotate Token Encryption Keys',
    retries: 3,
    concurrency: [{ limit: 1 }], // Only one rotation job at a time
  },
  { event: 'verdact/token-keys.rotate' },
  async ({ step, logger }) => {
    // Service-role client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase service role credentials are not configured.');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const summary = {
      rotated: 0,
      skipped: 0,
      failed: 0,
      tables: {} as Record<string, { rotated: number; failed: number }>,
    };

    for (const tokenDef of TOKEN_TABLES) {
      const tableStats = { rotated: 0, failed: 0 };

      await step.run(`rotate-${tokenDef.table}`, async () => {
        const BATCH_SIZE = 50;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          // Fetch rows still on an old key version
          const { data: rows, error } = await supabase
            .from(tokenDef.table)
            .select(`${tokenDef.idColumn}, ${tokenDef.envelopeColumn}, ${tokenDef.versionColumn}${tokenDef.secondEnvelopeColumn ? `, ${tokenDef.secondEnvelopeColumn}` : ''}`)
            .neq(tokenDef.versionColumn, CURRENT_KEY_VERSION)
            .eq('status', 'connected')
            .range(offset, offset + BATCH_SIZE - 1);

          if (error) {
            logger.error(`Failed to query ${tokenDef.table}`, { error });
            throw error;
          }

          if (!rows || rows.length === 0) {
            hasMore = false;
            break;
          }

          for (const row of rows as Record<string, any>[]) {
            const rowId = row[tokenDef.idColumn];
            const oldVersion = row[tokenDef.versionColumn] as string;
            const envelope = row[tokenDef.envelopeColumn] as string;

            // Attempt primary token re-encryption
            const primaryResult = tryDecryptToken(envelope, oldVersion);
            if (!primaryResult.ok) {
              logger.warn(`Cannot decrypt ${tokenDef.table}.${rowId} (${primaryResult.errorCode}), marking revoked.`);
              await supabase
                .from(tokenDef.table)
                .update({ status: 'revoked', updated_at: new Date().toISOString() })
                .eq(tokenDef.idColumn, rowId);
              tableStats.failed++;
              continue;
            }

            const newPrimary = reEncryptToken(envelope, oldVersion);
            if (!newPrimary) {
              // Already current — shouldn't happen given the query filter, but be safe
              continue;
            }

            const updatePayload: Record<string, string> = {
              [tokenDef.envelopeColumn]: newPrimary.encryptedText,
              [tokenDef.versionColumn]: newPrimary.keyVersion,
              updated_at: new Date().toISOString(),
            };

            // Handle second envelope column (e.g., Gmail refresh_token)
            if (tokenDef.secondEnvelopeColumn) {
              const secondEnvelope = row[tokenDef.secondEnvelopeColumn] as string | null;
              if (secondEnvelope) {
                const secondResult = reEncryptToken(secondEnvelope, oldVersion);
                if (secondResult) {
                  updatePayload[tokenDef.secondEnvelopeColumn] = secondResult.encryptedText;
                }
              }
            }

            const { error: updateError } = await supabase
              .from(tokenDef.table)
              .update(updatePayload)
              .eq(tokenDef.idColumn, rowId);

            if (updateError) {
              logger.error(`Failed to update ${tokenDef.table}.${rowId}`, { updateError });
              tableStats.failed++;
            } else {
              tableStats.rotated++;
            }
          }

          offset += BATCH_SIZE;
          if (rows.length < BATCH_SIZE) {
            hasMore = false;
          }
        }

        return tableStats;
      });

      summary.rotated += tableStats.rotated;
      summary.failed += tableStats.failed;
      summary.tables[tokenDef.table] = tableStats;
    }

    logger.info('Token key rotation complete.', summary);
    return summary;
  }
);
