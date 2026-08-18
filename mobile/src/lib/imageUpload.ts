import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// The "pick a photo and upload it to R2" flow — currently just shared
// chat images (ChatDetailScreen), same permission request + picker call
// + PUT-to-signed-URL sequence document uploads use elsewhere. Profile
// photo (EditProfileScreen) uses pickProfilePhoto below instead — it's
// stored as a data URI directly on the User row, not in R2, so it never
// needs a signed upload URL at all.
//
// quality defaults to 0.7 (fine for a car photo or profile picture —
// mostly aesthetic, a bit of compression doesn't matter), but a
// verification document is a different case: an admin actually needs
// to read fine print on an RC or license, so callers uploading one of
// those should pass DOCUMENT_QUALITY instead — compressing a document
// as hard as a casual photo risks the exact thing being verified
// becoming illegible.
export const DOCUMENT_QUALITY = 0.92;

// A modern phone camera photo is routinely 12MP+ (4000x3000-ish) —
// nothing legible on a document needs anywhere near that many pixels,
// it just means every upload is several MB for no real benefit. Capped
// at whichever dimension is larger so both portrait and landscape
// shots land at roughly the same on-screen size once resized.
const MAX_DIMENSION = 1600;

export async function pickImage(quality = 0.7): Promise<{ uri: string; mimeType?: string } | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Photo library permission is needed to pick an image.");
  }
  // quality: 1 here deliberately — compression happens once, below, via
  // manipulateAsync alongside the resize, instead of double-compressing
  // (once in the picker, again in the manipulator) and needlessly
  // compounding JPEG artifacts.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  // Only ever downscales, never up — a photo that's already smaller
  // than the cap (an older phone, a re-shared image) shouldn't get
  // blown up, which would inflate file size for zero benefit.
  const width = asset.width || 0;
  const height = asset.height || 0;
  const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;
  const actions: ImageManipulator.Action[] = needsResize
    ? [{ resize: width >= height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION } }]
    : [];

  const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: manipulated.uri, mimeType: "image/jpeg" };
}

// Bytes go straight from the client to R2 via the signed PUT URL,
// never through our own API server — same as DocumentUploadScreen. Only
// car photo/RC/DL still use this path; profile photos moved to
// pickProfilePhoto + api.updateProfilePhoto below (stored as a data URI
// in the DB directly, no R2 round trip needed for something this small).
export async function uploadToSignedUrl(uploadUrl: string, uri: string, mimeType?: string) {
  const fileResponse = await fetch(uri);
  const fileBlob = await fileResponse.blob();
  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: fileBlob,
    headers: { "Content-Type": mimeType || "image/jpeg" },
  });
  if (!putResponse.ok) {
    throw new Error("Upload to storage failed. Please try again.");
  }
}

// A profile photo only ever shows as a small circle (avatar), never
// full-screen — 480px and a fairly aggressive compression keeps the
// resulting base64 string in the tens of KB, comfortably under the
// backend's MAX_PHOTO_BASE64_LENGTH cap, while still resolving crisp at
// every size it's actually displayed at in this app.
const PROFILE_PHOTO_MAX_DIMENSION = 480;
const PROFILE_PHOTO_QUALITY = 0.6;

export async function pickProfilePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Photo library permission is needed to pick an image.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  const width = asset.width || 0;
  const height = asset.height || 0;
  const needsResize = width > PROFILE_PHOTO_MAX_DIMENSION || height > PROFILE_PHOTO_MAX_DIMENSION;
  const actions: ImageManipulator.Action[] = needsResize
    ? [{ resize: width >= height ? { width: PROFILE_PHOTO_MAX_DIMENSION } : { height: PROFILE_PHOTO_MAX_DIMENSION } }]
    : [];

  // base64: true skips a separate file-read step — manipulateAsync
  // returns the encoded bytes directly alongside the resized file.
  const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: PROFILE_PHOTO_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!manipulated.base64) throw new Error("Couldn't process that image. Please try another.");

  // manipulateAsync's `base64` field is the raw encoded bytes only, no
  // `data:` prefix — the backend (and every <Image> consumer here) both
  // expect a real data URI, so this is the one place that prefix gets
  // attached rather than reconstructing it at every read site.
  return `data:image/jpeg;base64,${manipulated.base64}`;
}
