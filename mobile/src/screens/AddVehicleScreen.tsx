import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, Image, Modal, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { validateVehicle } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { pickImage, uploadToSignedUrl, DOCUMENT_QUALITY } from "../lib/imageUpload";
import { useTranslation } from "../lib/i18n/I18nContext";

// Two-wheeler and auto are placeholders for now — UI-only, no backend
// field yet. Only "car" is selectable until that's built out.
const VEHICLE_TYPES = [
  { key: "car", labelKey: "vehicle.car", icon: "car-sport-outline" as const },
  { key: "two_wheeler", labelKey: "vehicle.twoWheeler", icon: "bicycle-outline" as const, comingSoon: true },
  { key: "auto", labelKey: "vehicle.auto", icon: "cube-outline" as const, comingSoon: true },
];
const SEAT_OPTIONS = [4, 5, 6, 7];

type UploadKind = "PHOTO" | "RC" | "DL";
// Staged, not yet uploaded — picking a document used to upload it to R2
// immediately, with no way to double-check it was the right file before
// it was already sent. Now it just sits here as a local preview; the
// actual upload only happens once "Save vehicle" is tapped, so there's
// a real chance to review or swap it out first.
type StagedAsset = { uri: string; mimeType?: string } | null;

const UPLOAD_FIELDS: { kind: UploadKind; labelKey: string; required: boolean; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: "PHOTO", labelKey: "vehicle.carPhoto", required: false, icon: "camera-outline" },
  { kind: "RC", labelKey: "vehicle.rcBook", required: true, icon: "document-text-outline" },
  { kind: "DL", labelKey: "vehicle.drivingLicense", required: false, icon: "card-outline" },
];

export default function AddVehicleScreen({ navigation }: any) {
  useScreenView("AddVehicleScreen");
  const { t } = useTranslation();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [color, setColor] = useState("");
  const [seatCapacity, setSeatCapacity] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [staged, setStaged] = useState<Record<UploadKind, StagedAsset>>({ PHOTO: null, RC: null, DL: null });
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  async function handlePick(kind: UploadKind) {
    // RC/DL are verification documents — an admin needs to actually
    // read them, so they're picked at DOCUMENT_QUALITY instead of the
    // lighter default used for a car photo.
    const picked = await pickImage(kind === "PHOTO" ? undefined : DOCUMENT_QUALITY);
    if (!picked) return;
    setStaged((prev) => ({ ...prev, [kind]: picked }));
    if (errors[kind]) setErrors((e) => ({ ...e, [kind]: "" }));
  }

  function handleRemove(kind: UploadKind) {
    setStaged((prev) => ({ ...prev, [kind]: null }));
  }

  async function handleSubmit() {
    const validationErrors = validateVehicle({ make, model, regNumber }, t);
    if (!staged.RC) {
      validationErrors.RC = t("vehicle.rcRequired");
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      // Uploads happen here, all at once, right before the vehicle is
      // actually created — everything up to this point was just local
      // picks the driver could still swap out or remove.
      async function upload(kind: UploadKind) {
        const asset = staged[kind];
        if (!asset) return undefined;
        const { r2Key, uploadUrl } = await api.getVehicleUploadUrl(kind);
        await uploadToSignedUrl(uploadUrl, asset.uri, asset.mimeType);
        return r2Key;
      }
      const [photoR2Key, rcR2Key, dlR2Key] = await Promise.all([upload("PHOTO"), upload("RC"), upload("DL")]);

      await api.addVehicle({
        make, model, regNumber: regNumber.toUpperCase(), color, seatCapacity,
        rcR2Key: rcR2Key!,
        ...(photoR2Key ? { photoR2Key } : {}),
        ...(dlR2Key ? { dlR2Key } : {}),
      });
      Analytics.vehicleAdded();
      // Not straight to OfferRide — the vehicle sits PENDING until an
      // admin reviews it (can't be used to publish until then), so
      // landing back on the vehicle list where that status actually
      // shows is more honest than implying it's ready to use right now.
      navigation.navigate("VehicleList");
    } catch (err: any) {
      showAlert(t("vehicle.couldntSaveVehicle"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("vehicle.addYourVehicle")} onBack={() => navigation.goBack()} />

      <KeyboardAvoider>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t("vehicle.vehicleType")}</Text>
        <View style={styles.chipRow}>
          {VEHICLE_TYPES.map((vt) => (
            <View key={vt.key} style={[styles.typeChip, vt.key === "car" && styles.typeChipActive, vt.comingSoon && styles.typeChipDisabled]}>
              <Ionicons name={vt.icon} size={16} color={vt.key === "car" ? colors.success : colors.textSecondary} />
              <Text style={[styles.typeChipText, vt.key === "car" && styles.typeChipTextActive]}>{t(vt.labelKey)}</Text>
              {vt.comingSoon && <Text style={styles.comingSoonBadge}>{t("vehicle.comingSoon")}</Text>}
            </View>
          ))}
        </View>

        <Text style={styles.label}>{t("vehicle.make")}</Text>
        <TextInput
          style={[styles.input, errors.make && styles.inputError]}
          placeholder="Maruti"
          value={make}
          onChangeText={(v) => { setMake(v); if (errors.make) setErrors((e) => ({ ...e, make: "" })); }}
        />
        <FieldError message={errors.make} />

        <Text style={styles.label}>{t("vehicle.model")}</Text>
        <TextInput
          style={[styles.input, errors.model && styles.inputError]}
          placeholder="Swift Dzire"
          value={model}
          onChangeText={(v) => { setModel(v); if (errors.model) setErrors((e) => ({ ...e, model: "" })); }}
        />
        <FieldError message={errors.model} />

        <Text style={styles.label}>{t("vehicle.registrationNumber")}</Text>
        <TextInput
          style={[styles.input, errors.regNumber && styles.inputError]}
          placeholder="TN09AB1234"
          autoCapitalize="characters"
          value={regNumber}
          onChangeText={(v) => { setRegNumber(v); if (errors.regNumber) setErrors((e) => ({ ...e, regNumber: "" })); }}
        />
        <FieldError message={errors.regNumber} />

        <Text style={styles.label}>{t("vehicle.colorOptional")}</Text>
        <TextInput style={styles.input} placeholder="White" value={color} onChangeText={setColor} />

        <Text style={styles.label}>{t("vehicle.seats")}</Text>
        <View style={styles.chipRow}>
          {SEAT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              style={[styles.seatChip, seatCapacity === n && styles.typeChipActive]}
              onPress={() => setSeatCapacity(n)}
            >
              <Text style={[styles.typeChipText, seatCapacity === n && styles.typeChipTextActive]}>{t("vehicle.seaterSuffix", { n })}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{t("vehicle.documents")}</Text>
        <Text style={styles.docsHint}>{t("vehicle.docsHintAdd")}</Text>
        {UPLOAD_FIELDS.map((field) => {
          const asset = staged[field.kind];
          return (
            <View key={field.kind} style={[styles.docCard, errors[field.kind] && styles.inputError]}>
              <Pressable
                onPress={() => asset && setPreviewUri(asset.uri)}
                disabled={!asset}
                style={styles.docThumbWrap}
              >
                {asset ? (
                  <>
                    <Image source={{ uri: asset.uri }} style={styles.photoPreview} />
                    <Pressable style={styles.removeBadge} onPress={() => handleRemove(field.kind)} hitSlop={6}>
                      <Ionicons name="close" size={11} color="#FFFFFF" />
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.docIconWrap}>
                    <Ionicons name={field.icon} size={17} color={colors.accentText} />
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1 }}>
                <View style={styles.docLabelRow}>
                  <Text style={styles.docLabel}>{t(field.labelKey)}</Text>
                  <Text style={field.required ? styles.requiredTag : styles.optionalTag}>
                    {field.required ? t("vehicle.required") : t("vehicle.optional")}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <Pressable onPress={() => handlePick(field.kind)} hitSlop={4}>
                    <Text style={styles.docActionText}>{asset ? t("vehicle.replace") : t("vehicle.select")}</Text>
                  </Pressable>
                  {asset && (
                    <Pressable onPress={() => setPreviewUri(asset.uri)} hitSlop={4}>
                      <Text style={styles.docViewText}>{t("vehicle.preview")}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {asset && (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              )}
            </View>
          );
        })}
        <FieldError message={errors.RC} />

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? t("vehicle.uploadingAndSaving") : t("vehicle.saveVehicle")}</Text>
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
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeChip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    gap: 6,
  },
  typeChipActive: { backgroundColor: colors.successBg, borderColor: colors.success },
  typeChipDisabled: { opacity: 0.5 },
  typeChipText: { ...typography.caption, color: colors.textSecondary },
  typeChipTextActive: { color: colors.success, fontWeight: "700" },
  comingSoonBadge: { ...typography.small, color: colors.textMuted, marginTop: 2, fontSize: 10 },
  seatChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
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
  button: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "92%", height: "80%" },
  previewCloseButton: {
    position: "absolute", top: spacing.xl, right: spacing.lg, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
});
