import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Image, Modal, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { validateVehicle } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { pickImage, uploadToSignedUrl, DOCUMENT_QUALITY } from "../lib/imageUpload";

const SEAT_OPTIONS = [4, 5, 6, 7];

type UploadKind = "PHOTO" | "RC" | "DL";
// Staged, not yet uploaded — same reasoning as AddVehicleScreen: a
// re-pick sits here as a local preview, swappable or removable, until
// Save actually uploads it.
type StagedAsset = { uri: string; mimeType?: string } | null;

const UPLOAD_FIELDS: { kind: UploadKind; label: string; required: boolean; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: "PHOTO", label: "Car photo", required: false, icon: "camera-outline" },
  { kind: "RC", label: "RC book", required: true, icon: "document-text-outline" },
  { kind: "DL", label: "Driving license", required: false, icon: "card-outline" },
];

// Info-icon tooltip text, same wording wherever a driver might ask "how
// long does this take" — VehicleListScreen's own pending tag included.
export const VEHICLE_REVIEW_SLA_MESSAGE =
  "An admin typically reviews and approves a new vehicle within 1 hour. You'll get a notification either way.";

export default function EditVehicleScreen({ route, navigation }: any) {
  useScreenView("EditVehicleScreen");
  const { vehicle } = route.params;
  const [make, setMake] = useState(vehicle.make);
  const [model, setModel] = useState(vehicle.model);
  const [regNumber, setRegNumber] = useState(vehicle.regNumber);
  const [color, setColor] = useState(vehicle.color || "");
  const [seatCapacity, setSeatCapacity] = useState(vehicle.seatCapacity || 4);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // What's already on file, fetched once to render as a thumbnail/
  // checkmark — separate from staged (what's actually changed this
  // session), since only a genuinely re-uploaded document should reset
  // the vehicle back to PENDING (see vehicles.routes.js PUT /:id).
  const [existingUrls, setExistingUrls] = useState<{ photoViewUrl: string | null; rcViewUrl: string | null; dlViewUrl: string | null } | null>(null);
  const [staged, setStaged] = useState<Record<UploadKind, StagedAsset>>({ PHOTO: null, RC: null, DL: null });
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    api.getVehicleViewUrls(vehicle.id).then(setExistingUrls).catch(() => setExistingUrls({ photoViewUrl: null, rcViewUrl: null, dlViewUrl: null }));
  }, [vehicle.id]);

  async function handlePick(kind: UploadKind) {
    // RC/DL are verification documents — an admin needs to actually
    // read them, so they're picked at DOCUMENT_QUALITY instead of the
    // lighter default used for a car photo.
    const picked = await pickImage(kind === "PHOTO" ? undefined : DOCUMENT_QUALITY);
    if (!picked) return;
    setStaged((prev) => ({ ...prev, [kind]: picked }));
  }

  function handleRemove(kind: UploadKind) {
    setStaged((prev) => ({ ...prev, [kind]: null }));
  }

  async function handleSave() {
    const validationErrors = validateVehicle({ make, model, regNumber });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      async function upload(kind: UploadKind) {
        const asset = staged[kind];
        if (!asset) return undefined;
        const { r2Key, uploadUrl } = await api.getVehicleUploadUrl(kind);
        await uploadToSignedUrl(uploadUrl, asset.uri, asset.mimeType);
        return r2Key;
      }
      const [photoR2Key, rcR2Key, dlR2Key] = await Promise.all([upload("PHOTO"), upload("RC"), upload("DL")]);

      await api.updateVehicle(vehicle.id, {
        make, model, regNumber: regNumber.toUpperCase(), color, seatCapacity,
        // Only ever included when something was actually re-uploaded
        // this session — sending the old key back unchanged would
        // needlessly reset an already-APPROVED vehicle to PENDING.
        ...(photoR2Key ? { photoR2Key } : {}),
        ...(rcR2Key ? { rcR2Key } : {}),
        ...(dlR2Key ? { dlR2Key } : {}),
      });
      navigation.goBack();
    } catch (err: any) {
      showAlert("Couldn't save", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const existingUrlKey: Record<UploadKind, "photoViewUrl" | "rcViewUrl" | "dlViewUrl"> = {
    PHOTO: "photoViewUrl", RC: "rcViewUrl", DL: "dlViewUrl",
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Edit vehicle" onBack={() => navigation.goBack()} />

      <KeyboardAvoider>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {vehicle.status === "REJECTED" && (
          <View style={styles.rejectedBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectedTitle}>Not approved</Text>
              <Text style={styles.rejectedReason}>
                {vehicle.rejectionReason || "No reason was given."}
              </Text>
              <Text style={styles.rejectedHint}>Fix the issue and re-upload the document below to resubmit.</Text>
            </View>
          </View>
        )}
        {vehicle.status === "PENDING" && (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text style={styles.pendingText}>Pending review</Text>
            <Pressable
              onPress={() => showAlert("Pending review", VEHICLE_REVIEW_SLA_MESSAGE)}
              hitSlop={8}
            >
              <Ionicons name="information-circle-outline" size={17} color={colors.warning} />
            </Pressable>
          </View>
        )}
        {vehicle.status === "APPROVED" && (
          <View style={styles.approvedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.approvedText}>Approved — ready to use</Text>
          </View>
        )}

        <Text style={styles.label}>Make</Text>
        <TextInput
          style={[styles.input, errors.make && styles.inputError]}
          value={make}
          onChangeText={(v) => { setMake(v); if (errors.make) setErrors((e) => ({ ...e, make: "" })); }}
        />
        <FieldError message={errors.make} />

        <Text style={styles.label}>Model</Text>
        <TextInput
          style={[styles.input, errors.model && styles.inputError]}
          value={model}
          onChangeText={(v) => { setModel(v); if (errors.model) setErrors((e) => ({ ...e, model: "" })); }}
        />
        <FieldError message={errors.model} />

        <Text style={styles.label}>Registration number</Text>
        <TextInput
          style={[styles.input, errors.regNumber && styles.inputError]}
          autoCapitalize="characters"
          value={regNumber}
          onChangeText={(v) => { setRegNumber(v); if (errors.regNumber) setErrors((e) => ({ ...e, regNumber: "" })); }}
        />
        <FieldError message={errors.regNumber} />

        <Text style={styles.label}>Color</Text>
        <TextInput style={styles.input} value={color} onChangeText={setColor} />

        <Text style={styles.label}>Seats</Text>
        <View style={styles.chipRow}>
          {SEAT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              style={[styles.seatChip, seatCapacity === n && styles.seatChipActive]}
              onPress={() => setSeatCapacity(n)}
            >
              <Text style={[styles.seatChipText, seatCapacity === n && styles.seatChipTextActive]}>{n}-seater</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Documents</Text>
        <Text style={styles.docsHint}>
          Tap a document to preview it, or the × on a newly selected one to remove it, before saving.
        </Text>
        {UPLOAD_FIELDS.map((field) => {
          const stagedAsset = staged[field.kind];
          const existingUrl = existingUrls?.[existingUrlKey[field.kind]] ?? null;
          const thumbUri = stagedAsset?.uri || existingUrl;
          const hasAny = !!thumbUri;
          return (
            <View key={field.kind} style={styles.docCard}>
              <Pressable
                onPress={() => thumbUri && setPreviewUri(thumbUri)}
                disabled={!thumbUri}
                style={styles.docThumbWrap}
              >
                {thumbUri ? (
                  <>
                    <Image source={{ uri: thumbUri }} style={styles.photoPreview} />
                    {stagedAsset && (
                      <Pressable style={styles.removeBadge} onPress={() => handleRemove(field.kind)} hitSlop={6}>
                        <Ionicons name="close" size={11} color="#FFFFFF" />
                      </Pressable>
                    )}
                  </>
                ) : (
                  <View style={styles.docIconWrap}>
                    <Ionicons name={field.icon} size={17} color={colors.accentText} />
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1 }}>
                <View style={styles.docLabelRow}>
                  <Text style={styles.docLabel}>{field.label}</Text>
                  <Text style={field.required ? styles.requiredTag : styles.optionalTag}>
                    {field.required ? "Required" : "Optional"}
                  </Text>
                </View>
                {existingUrls === null ? (
                  <Text style={styles.docActionText}>Loading...</Text>
                ) : (
                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <Pressable onPress={() => handlePick(field.kind)} hitSlop={4}>
                      <Text style={styles.docActionText}>{hasAny ? "Replace" : "Select"}</Text>
                    </Pressable>
                    {thumbUri && (
                      <Pressable onPress={() => setPreviewUri(thumbUri)} hitSlop={4}>
                        <Text style={styles.docViewText}>Preview</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
              {hasAny && (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              )}
            </View>
          );
        })}

        <Pressable style={styles.button} onPress={handleSave} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Uploading & saving..." : "Save vehicle"}</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoider>

      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUri(null)}>
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />}
          <Pressable style={styles.previewCloseButton} onPress={() => setPreviewUri(null)} hitSlop={8}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  docsHint: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 16 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing.md, color: colors.textPrimary },
  inputError: { borderColor: colors.danger },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  seatChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  seatChipActive: { backgroundColor: colors.successBg, borderColor: colors.success },
  seatChipText: { ...typography.caption, color: colors.textSecondary },
  seatChipTextActive: { color: colors.success, fontWeight: "700" },
  button: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  buttonText: { ...typography.title, color: "#FFFFFF" },
  pendingBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.warningBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  pendingText: { ...typography.caption, color: colors.warning, fontWeight: "700", flex: 1 },
  approvedBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.successBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  approvedText: { ...typography.caption, color: colors.success, fontWeight: "700" },
  rejectedBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  rejectedTitle: { ...typography.caption, color: colors.danger, fontWeight: "700" },
  rejectedReason: { ...typography.small, color: colors.danger, marginTop: 2, lineHeight: 16 },
  rejectedHint: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  docThumbWrap: { width: 44, height: 44 },
  docIconWrap: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  photoPreview: { width: 44, height: 44, borderRadius: 10 },
  removeBadge: {
    position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surface,
  },
  docLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  docLabel: { ...typography.body, fontWeight: "700" },
  requiredTag: { ...typography.small, color: colors.danger },
  optionalTag: { ...typography.small, color: colors.textMuted },
  docActionText: { ...typography.small, color: colors.accentText, fontWeight: "700", marginTop: 2 },
  docViewText: { ...typography.small, color: colors.textMuted, fontWeight: "700", marginTop: 2 },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "92%", height: "80%" },
  previewCloseButton: {
    position: "absolute", top: spacing.xl, right: spacing.lg, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
});
