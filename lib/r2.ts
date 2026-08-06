import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME || "carpool-dev-docs";
const VIEW_URL_TTL_SECONDS = 300; // 5 min, never long-lived

export async function getDocumentViewUrl(r2Key: string) {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
  return getSignedUrl(r2, command, { expiresIn: VIEW_URL_TTL_SECONDS });
}
