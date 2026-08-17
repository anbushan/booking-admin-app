import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "./r2.js";
import { getCachedSignedUrl } from "./signedUrlCache.js";

// Pulled out of users.routes.js so every route that shows a driver/
// passenger (rides search, booking confirm, chat, trip screens) can
// resolve the same short-lived signed view URL from a stored
// photoR2Key, instead of each route reimplementing (or forgetting to
// implement) it — the private-bucket signing is presigner-only, no
// network round trip, so this is cheap to call per row.
const VIEW_URL_TTL_SECONDS = 300; // 5 min — matches documents.routes.js/users.routes.js

export async function photoViewUrl(photoR2Key) {
  if (!photoR2Key) return null;
  return getCachedSignedUrl(photoR2Key, () => {
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: photoR2Key });
    return getSignedUrl(r2, command, { expiresIn: VIEW_URL_TTL_SECONDS });
  });
}

// Resolves a Map<userId, photoViewUrl> for a batch of {id, photoR2Key}
// rows in parallel — the common shape for a list endpoint (search
// results, booking lists) that needs to attach a photo URL per row.
export async function photoViewUrlsByUser(usersWithR2Key) {
  const entries = await Promise.all(
    usersWithR2Key.map(async (u) => [u.id, await photoViewUrl(u.photoR2Key)])
  );
  return new Map(entries);
}
