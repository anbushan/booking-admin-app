import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import * as DocumentPicker from "expo-document-picker";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import { CarLoader } from "../components/CarLoader";

const DOC_TYPES: { key: "LICENSE" | "RC" | "INSURANCE"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "LICENSE", label: "Driving license", icon: "card-outline" },
  { key: "RC", label: "Vehicle registration (RC)", icon: "document-text-outline" },
  { key: "INSURANCE", label: "Insurance", icon: "shield-checkmark-outline" },
];

export default function DocumentUploadScreen({ navigation }: any) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});

  async function handleUpload(docType: "LICENSE" | "RC" | "INSURANCE") {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const file = picked.assets[0];
    setUploading(docType);
    try {
      const { uploadUrl } = await api.getDocumentUploadUrl(docType);

      // Read the picked file and PUT it directly to the signed R2 URL —
      // bytes never pass through our own API server.
      const fileResponse = await fetch(file.uri);
      const fileBlob = await fileResponse.blob();

      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: fileBlob,
        headers: { "Content-Type": file.mimeType || "application/octet-stream" },
      });
      if (!putResponse.ok) {
        throw new Error("Upload to storage failed. Please try again.");
      }

      setUploaded((prev) => ({ ...prev, [docType]: true }));
      Analytics.documentUploaded(docType);
      showAlert("Uploaded", "Your document was submitted for review.");
    } catch (err: any) {
      showAlert("Upload failed", err.message);
    } finally {
      setUploading(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Verification documents</Text>

      <View style={styles.body}>
        <Text style={styles.subtitle}>
          Upload each document to get verified. Approval usually takes 1-2 business days.
        </Text>

        {DOC_TYPES.map((doc) => (
          <View key={doc.key} style={styles.card}>
            {/* The loading image sits above the attachment it belongs
                to, not squeezed inline next to the label — makes clear
                which document is mid-upload without reading text. */}
            {uploading === doc.key && (
              <View style={styles.uploadingBlock}>
                <CarLoader size="sm" label="Uploading..." />
              </View>
            )}
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={doc.icon} size={17} color={colors.accentText} />
              </View>
              <Text style={styles.rowLabel}>{doc.label}</Text>
              {uploading === doc.key ? null : uploaded[doc.key] ? (
                <View style={styles.pendingTag}>
                  <Ionicons name="time-outline" size={12} color={colors.warning} />
                  <Text style={styles.pendingTagText}>Pending review</Text>
                </View>
              ) : (
                <Pressable style={styles.uploadButton} onPress={() => handleUpload(doc.key)}>
                  <Text style={styles.uploadButtonText}>Upload</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  uploadingBlock: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.xs, backgroundColor: colors.bg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  iconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  rowLabel: { ...typography.body, flex: 1 },
  uploadButton: { backgroundColor: colors.textPrimary, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  uploadButtonText: { color: "#FFFFFF", ...typography.small, fontWeight: "500" },
  pendingTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.warningBg, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  pendingTagText: { ...typography.small, color: colors.warning },
});
