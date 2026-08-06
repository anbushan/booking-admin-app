import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { showAlert } from "../lib/alert";
import * as DocumentPicker from "expo-document-picker";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

const DOC_TYPES: { key: "LICENSE" | "RC" | "INSURANCE"; label: string }[] = [
  { key: "LICENSE", label: "Driving license" },
  { key: "RC", label: "Vehicle registration (RC)" },
  { key: "INSURANCE", label: "Insurance" },
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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Verification documents</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.subtitle}>
          Upload each document to get verified. Approval usually takes 1-2 business days.
        </Text>

        {DOC_TYPES.map((doc) => (
          <View key={doc.key} style={styles.row}>
            <Text style={styles.rowLabel}>{doc.label}</Text>
            {uploading === doc.key ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : uploaded[doc.key] ? (
              <Text style={styles.pendingTag}>Pending review</Text>
            ) : (
              <Pressable style={styles.uploadButton} onPress={() => handleUpload(doc.key)}>
                <Text style={styles.uploadButtonText}>Upload</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  body: { padding: spacing.lg },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLabel: typography.body,
  uploadButton: { backgroundColor: colors.textPrimary, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  uploadButtonText: { color: "#FFFFFF", ...typography.small, fontWeight: "500" },
  pendingTag: { ...typography.small, color: colors.warning, backgroundColor: colors.warningBg, padding: 6, borderRadius: 6 },
});
