import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { SafeAreaView } from "react-native-safe-area-context";

type Message = { id: string; senderId: string; text: string; createdAt: string };

export default function ChatDetailScreen({ route, navigation }: any) {
  const { bookingId, currentUserId: paramUserId } = route.params;
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(paramUserId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!paramUserId) {
      api.getMyProfile().then((p) => setCurrentUserId(p.id)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    // REST call loads history for whoever wasn't connected when earlier
    // messages were sent; the socket takes over for anything live. This
    // was a raw, unauthenticated fetch() before — the backend route
    // requires auth, so every call silently got back
    // {"error":"Not authenticated."} instead of a message array, which
    // then crashed the very next socket message with "prev is not
    // iterable" when spread as if it were an array. api.getChatMessages
    // goes through the authenticated request() helper instead.
    api
      .getChatMessages(bookingId)
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));

    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;
      socket.emit("join", bookingId);
      socket.on("message:receive", (msg: Message) => {
        setMessages((prev) => (Array.isArray(prev) ? [...prev, msg] : [msg]));
      });
    });

    return () => {
      mounted = false;
      socketRef.current?.off("message:receive");
    };
  }, [bookingId]);

  function handleSend() {
    if (!text.trim()) return;
    socketRef.current?.emit("message:send", { bookingId, text });
    setText("");
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Chat</Text>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.senderId === currentUserId ? styles.bubbleMine : styles.bubbleTheirs,
            ]}
          >
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  bubble: { maxWidth: "75%", padding: spacing.sm, borderRadius: radius.md },
  bubbleMine: { backgroundColor: colors.accent, alignSelf: "flex-end" },
  bubbleTheirs: { backgroundColor: colors.surface, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border },
  bubbleText: { ...typography.caption, color: colors.textPrimary },
  inputRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: spacing.md, height: 40 },
  sendButton: { backgroundColor: colors.textPrimary, paddingHorizontal: spacing.md, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  sendButtonText: { color: "#FFFFFF", ...typography.caption, fontWeight: "500" },
});
