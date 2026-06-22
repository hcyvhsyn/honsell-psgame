/**
 * R2 bucket-ə CORS siyasəti qoyur ki, brauzerdən presigned PUT (admin şəkil
 * yükləmə) CORS xətası vermədən işləsin.
 *
 * İSTİFADƏ: npx tsx scripts/set-r2-cors.ts
 * (R2 env-ləri .env-də olmalıdır.)
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const ORIGINS = [
  "https://honsell.store",
  "https://www.honsell.store",
  "http://localhost:3000",
  "http://localhost:3003",
];

async function main() {
  const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = await import("@aws-sdk/client-s3");
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim() || "honsell-images";
  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error("✗ R2 env qurulmayıb.");
    process.exit(1);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ORIGINS,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`✓ CORS qoyuldu: ${bucket}`);

  const got = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log(JSON.stringify(got.CORSRules, null, 2));
}

main().catch((e) => {
  console.error("CORS xəta:", e?.name, e?.message);
  process.exit(1);
});
