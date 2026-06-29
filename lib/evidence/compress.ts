/**
 * Evidence file compression — images and PDFs only.
 *
 * Runs in the upload route BETWEEN the buffer read and the sha256 hash, so
 * the stored hash always matches the stored (potentially compressed) bytes.
 *
 * Compression targets:
 *   - Images >2MB: sharp resize to max 2048px on the long edge, re-encode at
 *     quality 75. Falls back to original on any failure.
 *   - PDFs: pdf-lib re-save (strips redundant cross-reference data). Falls back
 *     to original on any failure.
 *
 * HONESTY RULES:
 *   - Any failure (sharp not available, corrupt input, timeout) returns the
 *     ORIGINAL bytes — never breaks the upload.
 *   - A 5s timeout is applied to the sharp call (Vercel Hobby: 10s limit).
 *   - The existing 413 limit in the upload route is the final backstop.
 *
 * ⚠️ Vercel-runtime verification required after first deploy:
 *    sharp is a native binary. `next build` passing locally (Windows) does NOT
 *    prove the Vercel linux-x64 runtime works. After deploy, upload a real
 *    >4.5MB image to confirm compression succeeds without a 500 error.
 *    next.config.ts: serverExternalPackages: ['sharp'] is required.
 */

/** Maximum image dimension (px) after resize. */
const MAX_DIMENSION = 2048;

/** JPEG quality for re-encoded images. */
const IMAGE_QUALITY = 75;

/** Images larger than this threshold are worth compressing. */
const IMAGE_COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB

/** Timeout for the sharp call (ms). Vercel Hobby cap = 10s. */
const SHARP_TIMEOUT_MS = 5_000;

type CompressResult = {
  bytes: Buffer;
  compressed: boolean;
};

const UNCOMPRESSED = (bytes: Buffer): CompressResult => ({ bytes, compressed: false });

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

    const outputMime = mime === 'image/png' ? 'image/png' : 'image/jpeg';

    const compressPromise = (async () => {
      let pipeline = sharp(bytes).resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      });

      if (outputMime === 'image/jpeg') {
        pipeline = pipeline.jpeg({ quality: IMAGE_QUALITY });
      } else {
        pipeline = pipeline.png({ compressionLevel: 8 });
      }

      return pipeline.toBuffer();
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('sharp timeout')), SHARP_TIMEOUT_MS),
    );

    const compressed = await Promise.race([compressPromise, timeoutPromise]);

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

    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const compressed = Buffer.from(await doc.save());

    if (compressed.length < bytes.length) {
      return { bytes: compressed, compressed: true };
    }
    return UNCOMPRESSED(bytes);
  } catch {
    // pdf-lib failure (encrypted PDF that ignoreEncryption can't open, etc.) — return original.
    return UNCOMPRESSED(bytes);
  }
}
