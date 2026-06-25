import { NextResponse } from 'next/server';
import { getMerchant, verifySession } from '@/lib/dal';
import { can } from '@/lib/entitlements/can';
import { createClient } from '@/lib/supabase/server';
import { loadAndBuildPacket, formatReason } from '@/lib/evidence/packet-loader';
import { renderEvidencePacketPdf } from '@/lib/evidence/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const user = await verifySession();
  const membership = await getMerchant();
  if (!membership) {
    return NextResponse.json({ error: 'No merchant account found.' }, { status: 403 });
  }

  // Server-side entitlement gate. The workbench hides the download link via the
  // client PaidGate, but a direct GET would otherwise bypass it. During beta
  // can() returns allowed (VERDACT_BETA_ALL_UNLOCKED); once billing lands this
  // 403s a Free-tier merchant in lockstep with the hidden UI link.
  const downloadGate = await can(user, 'download_packet');
  if (!downloadGate.allowed) {
    return NextResponse.json(
      { error: 'Downloading the evidence packet is available on the paid plan.' },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const loaded = await loadAndBuildPacket(supabase, id, membership.merchant.id);

  if (loaded.status === 'error') {
    return NextResponse.json({ error: 'Could not load this dispute.' }, { status: 500 });
  }
  if (loaded.status !== 'ok' || !loaded.record || !loaded.packet) {
    return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
  }

  const { record, packet } = loaded;
  const pdf = renderEvidencePacketPdf({
    packet,
    title: `Verdact evidence packet: dispute ${record.processor_dispute_id} (${formatReason(record.reason)})`,
  });
  const filename = `verdact-packet-${safeFilename(record.processor_dispute_id)}.pdf`;
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'dispute';
}
