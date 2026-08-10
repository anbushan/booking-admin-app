import admin from "firebase-admin";

// Mirrors backend/src/lib/fcm.js — same Firebase project, same service
// account secret (FIREBASE_SERVICE_ACCOUNT_JSON, set on both deploys),
// duplicated here rather than imported because admin is a separate
// Next.js app/deploy with no dependency on the Express backend's code.
// Admin already talks to the same Postgres database directly for every
// other mutation (suspend, refund, etc.), so sending push the same way
// — directly, not by calling the backend's API — matches that pattern.
let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  if (admin.apps.length) {
    initialized = true;
    return;
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set — push is unavailable.");
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
}

export async function sendPush(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
  ensureInitialized();
  return admin.messaging().send({
    token: fcmToken,
    notification: { title, body },
    ...(data ? { data } : {}),
  });
}
