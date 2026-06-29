/**
 * Evidence file compression — images and PDFs only.
 *
 * Runs in the upload route BETWEEN the buffer read and the sha256 hash, so
 * the stored hash always matches the stored (potentially compressed) bytes.
 *
 * Compression targets:
 *   - Images >2MB: sharp resize to max 2048px on the long edge, re-encode in
 *     the SAME format (JPEG→JPEG, PNG→PNG, WebP→WebP) so the stored MIME /
 *     extension / content-type always match the actual bytes.
 *   - PDFs: pdf-lib re-save (strips redundant cross-reference data).
 *
 * HONESTY / SAFETY RULES:
 *   - Any failure (sharp not available, corrupt input, timeout) returns the
 *     ORIGINAL bytes — never breaks the upload.
 *   - A 5s timeout is applied to BOTH the sharp and the pdf-lib calls
 *     (Vercel Hobby: 10s function limit).
 *   - The existing 413 limit in the upload route is the final backstop.
 *
 * ⚠️ Vercel-runtime verification required after first deploy:
 *    sharp is a native binary. `next build` passing locally (Windows) does NOT
 *    prove the Vercel linux-x64 runtime works. After deploy, upload a real
 *    >2MB image and confirm the stored content_size_bytes shrank.
 *    next.config.ts: serverExternalPackages: ['sharp'] is required.
 */

/** Maximum image dimension (px) after resize. */
const MAX_DIMENSION = 2048;

/** JPEG/WebP quality for re-encoded images. */
const IMAGE_QUALITY = 75;

/** Images larger than this threshold are worth compressing. */
const IMAGE_COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB

/** Timeout for the compression call (ms). Vercel Hobby cap = 10s. */
const COMPRESS_TIMEOUT_MS = 5_000;

type CompressResult = {
  bytes: Buffer;
  compressed: boolean;
};

const UNCOMPRESSED = (bytes: Buffer): CompressResult => ({ bytes, compressed: false });

/**
 * Race a promise against a timeout, clearing the timer on settle so a finished
 * compression never leaves a dangling timeout holding the event loop open.
 */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('compression timeout')), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Compress an evidence file buffer if it is a compressible type and large
 * enough to justify compression. Always returns valid bytes — never throws.
 */
export async function compressEvidenceFile(
  bytes: Buffer,
  mime: string,
): Promise<CompressResult> {
  if (isImage(mime) && bytes.length > IMAGE_COMPRESS_THRESHOLD_BYTES) {
    return compressImage(bytes, mime);
  }
  if (mime === 'application/pdf') {
    return compressPdf(bytes);
  }
  return UNCOMPRESSED(bytes);
}

function isImage(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp';
}

async function compressImage(bytes: Buffer, mime: string): Promise<CompressResult> {
  try {
    // Dynamic import so the module fails gracefully if sharp is not available
    // in the current runtime (e.g. a test environment without native binaries).
    const { default: sharp } = await import('sharp');

    const work = (async () => {
      const pipeline = sharp(bytes).resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Re-encode in the SAME format so the stored MIME/extension stay truthful.
      if (mime === 'image/png') {
        return pipeline.png({ compressionLevel: 8 }).toBuffer();
      }
      if (mime === 'image/webp') {
        return pipeline.webp({ quality: IMAGE_QUALITY }).toBuffer();
      }
      return pipeline.jpeg({ quality: IMAGE_QUALITY }).toBuffer();
    })();

    const compressed = await withTimeout(work, COMPRESS_TIMEOUT_MS);

    // Only use the compressed version if it's actually smaller.
    if (compressed.length < bytes.length) {
      return { bytes: compressed, compressed: true };
    }
    return UNCOMPRESSED(bytes);
  } catch {
    // sharp not available, corrupt input, timeout — return original.
    return UNCOMPRESSED(bytes);
  }
}

async function compressPdf(bytes: Buffer): Promise<CompressResult> {
  try {
    const { PDFDocument } = await import('pdf-lib');

    const work = (async () => {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      return Buffer.from(await doc.save());
    })();

    const compressed = await withTimeout(work, COMPRESS_TIMEOUT_MS);

    if (compressed.length < bytes.length) {
      return { bytes: compressed, compressed: true };
    }
    return UNCOMPRESSED(bytes);
  } catch {
    // pdf-lib failure (encrypted PDF, malformed, timeout) — return original.
    return UNCOMPRESSED(bytes);
  }
}
