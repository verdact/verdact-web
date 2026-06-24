import type { EvidencePacket } from './packet';

type PdfTextStyle = {
  size?: number;
  bold?: boolean;
  gapBefore?: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const BODY_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const AVG_CHAR_WIDTH = 0.52;

export function renderEvidencePacketPdf({
  packet,
  title,
  generatedAt = new Date(),
}: {
  packet: EvidencePacket;
  title: string;
  generatedAt?: Date;
}): Uint8Array {
  const writer = new PdfTextWriter();

  writer.text(title, { size: 15, bold: true });
  writer.text(`Generated ${generatedAt.toISOString()}`, { size: 9 });
  writer.text(
    `Readiness ${packet.readiness.percent}% - ${packet.limits.totalLabel} of ${formatBytes(packet.limits.maxBytes)} attached evidence`,
    { size: 10, gapBefore: 8 },
  );

  writer.text('Stripe evidence fields', { size: 13, bold: true, gapBefore: 16 });
  for (const field of packet.fields) {
    writer.text(`${field.label} (${field.key})`, { size: 10, bold: true, gapBefore: 8 });
    writer.text(field.present ? field.value : '[not provided yet]', { size: 9 });
    writer.text(`Source: ${field.source}`, { size: 8 });
  }

  writer.text('Exhibits', { size: 13, bold: true, gapBefore: 16 });
  if (packet.exhibits.length === 0) {
    writer.text('[no files attached yet]', { size: 9 });
  } else {
    packet.exhibits.forEach((exhibit, index) => {
      const upload = exhibit.processorFileId
        ? `Stripe file: ${exhibit.processorFileId}`
        : 'Stripe file: not uploaded yet';
      writer.text(
        `${index + 1}. ${exhibit.name} -> ${exhibit.stripeField}. ${upload}`,
        { size: 9, gapBefore: index === 0 ? 0 : 4 },
      );
    });
  }

  writer.text('Readiness checks', { size: 13, bold: true, gapBefore: 16 });
  for (const check of packet.readiness.checks) {
    writer.text(`${check.done ? '[x]' : '[ ]'} ${check.label}`, { size: 9 });
  }

  return writer.build();
}

class PdfTextWriter {
  private pages: string[] = [];
  private commands: string[] = [];
  private y = PAGE_HEIGHT - MARGIN_TOP;

  text(raw: string, style: PdfTextStyle = {}) {
    const size = style.size ?? 10;
    const leading = Math.ceil(size * 1.35);
    const gapBefore = style.gapBefore ?? 0;
    this.ensureSpace(gapBefore + leading);
    this.y -= gapBefore;

    const paragraphs = normalizeText(raw).split(/\n{2,}/);
    for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
      const lines = wrapLine(paragraph, size);
      for (const line of lines.length > 0 ? lines : ['']) {
        this.ensureSpace(leading);
        const font = style.bold ? 'F2' : 'F1';
        this.commands.push(`BT /${font} ${size} Tf ${MARGIN_X} ${this.y.toFixed(2)} Td (${escapePdf(line)}) Tj ET`);
        this.y -= leading;
      }
      if (paragraphIndex < paragraphs.length - 1) {
        this.ensureSpace(leading);
        this.y -= Math.ceil(leading / 2);
      }
    }
  }

  build(): Uint8Array {
    this.flushPage();

    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = add('<< /Type /Catalog /Pages 2 0 R >>');
    void catalogId;

    objects.push('__PAGES__');
    const fontRegularId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBoldId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    const pageIds: number[] = [];
    for (const page of this.pages) {
      const contentId = add(`<< /Length ${byteLength(page)} >>\nstream\n${page}\nendstream`);
      const pageId = add(
        [
          '<< /Type /Page',
          '/Parent 2 0 R',
          `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
          `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >>`,
          `/Contents ${contentId} 0 R`,
          '>>',
        ].join(' '),
      );
      pageIds.push(pageId);
    }

    objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    const chunks: string[] = ['%PDF-1.4\n'];
    const offsets: number[] = [0];
    let offset = byteLength(chunks[0]);

    objects.forEach((body, index) => {
      offsets.push(offset);
      const objectText = `${index + 1} 0 obj\n${body}\nendobj\n`;
      chunks.push(objectText);
      offset += byteLength(objectText);
    });

    const xrefOffset = offset;
    chunks.push(`xref\n0 ${objects.length + 1}\n`);
    chunks.push('0000000000 65535 f \n');
    for (let i = 1; i < offsets.length; i++) {
      chunks.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    }
    chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    return new TextEncoder().encode(chunks.join(''));
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN_BOTTOM) {
      this.flushPage();
    }
  }

  private flushPage() {
    if (this.commands.length === 0) return;
    this.pages.push(this.commands.join('\n'));
    this.commands = [];
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }
}

function wrapLine(raw: string, size: number): string[] {
  const text = raw.trim();
  if (!text) return [''];
  const maxChars = Math.max(28, Math.floor(BODY_WIDTH / (size * AVG_CHAR_WIDTH)));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .normalize('NFKD')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}
