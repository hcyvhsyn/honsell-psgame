import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-uyğun) — şəkillər burada saxlanır. R2-nin egress-i PULSUZ,
 * ona görə Supabase egress problemini həll edir. DB Supabase-də qalır; yalnız
 * şəkil faylları R2-yə keçir.
 *
 * Lazımi env-lər (qurulmayıbsa upload Supabase-ə fallback edir, heç nə pozulmur):
 *   R2_ACCOUNT_ID            — Cloudflare account id
 *   R2_ACCESS_KEY_ID         — R2 API token access key
 *   R2_SECRET_ACCESS_KEY     — R2 API token secret
 *   R2_BUCKET                — bucket adı (default: honsell-images)
 *   NEXT_PUBLIC_R2_PUBLIC_URL — public servis bazası (məs. https://cdn.honsell.store
 *                               və ya https://pub-xxxx.r2.dev)
 */
const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

export const R2_BUCKET = process.env.R2_BUCKET?.trim() || "honsell-images";
const PUBLIC_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() || "").replace(/\/+$/, "");

/** R2 tam qurulubmu? (presign + public servis üçün hamısı lazımdır) */
export function isR2Configured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && PUBLIC_BASE);
}

let _client: S3Client | null = null;
function r2Client(): S3Client {
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 env (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) qurulmayıb");
  }
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // AWS SDK v3-ün default checksum davranışı presigned URL-ə
      // x-amz-checksum-crc32 / x-amz-sdk-checksum-algorithm əlavə edir; bu da
      // brauzer PUT-unu (R2-də) pozur. Yalnız tələb olunanda hesabla.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return _client;
}

/** Açar üçün public URL (Next image src və DB-də saxlanan dəyər). */
export function r2PublicUrl(key: string): string {
  return `${PUBLIC_BASE}/${key.replace(/^\/+/, "")}`;
}

/**
 * Brauzerin birbaşa PUT edəcəyi presigned URL. ContentType imzalanır — klient
 * PUT-da fayl gövdəsi ilə eyni Content-Type göndərməlidir (fetch File body üçün
 * avtomatik təyin edir). Cache-Control R2 origin-də sonradan/CDN səviyyəsində
 * idarə olunur (imzalamağı sadə saxlamaq üçün burada qoyulmur).
 */
export async function presignR2Upload(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key.replace(/^\/+/, ""),
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(r2Client(), cmd, { expiresIn: 600 });
  return { uploadUrl, publicUrl: r2PublicUrl(key) };
}

/** Server-tərəf birbaşa yükləmə (migrasiya skripti üçün). */
export async function putR2Object(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key.replace(/^\/+/, ""),
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return r2PublicUrl(key);
}
