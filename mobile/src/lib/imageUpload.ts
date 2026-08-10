import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// Shared by every "pick a photo and upload it to R2" flow — profile
// photo (EditProfileScreen), car photo/RC/DL (AddVehicleScreen) — same
// permission request + picker call + PUT-to-signed-URL sequence
// DocumentUploadScreen already established for document uploads,
// pulled out so it's not copy-pasted at every new call site.
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
// never through our own API server — same as DocumentUploadScreen.
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
