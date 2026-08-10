import admin from "firebase-admin";

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set — FCM push is unavailable.");
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
}

export async function sendPush(fcmToken, title, body, data) {
  ensureInitialized();
  return admin.messaging().send({
    token: fcmToken,
    notification: { title, body },
    // FCM data payload values must all be strings — every caller is
    // responsible for that (notify.js already sends bookingId as ""
    // rather than null for this reason).
    ...(data ? { data } : {}),
  });
}
