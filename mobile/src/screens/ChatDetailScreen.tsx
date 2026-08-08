import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useToast } from "../components/Toast";
import { BackButton } from "../components/BackButton";
import { SafeAreaView } from "react-native-safe-area-context";

type Message = { id: string; senderId: string; text: string; type?: "TEXT" | "LOCATION"; createdAt: string };

function formatMessageTime(iso: string) {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

export default function ChatDetailScreen({ route, navigation }: any) {
  const { bookingId, currentUserId: paramUserId, calleeRole } = route.params;
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(paramUserId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [calling, setCalling] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [ended, setEnded] = useState(false);
  const [otherName, setOtherName] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const { showError } = useToast();

  useEffect(() => {
    if (!paramUserId) {
      api.getMyProfile().then((p) => setCurrentUserId(p.id)).catch(() => {});
    }
  }, []);

  // Chat is only open while the booking is exactly CONFIRMED (paid,
  // pre-trip) — the same window the backend enforces on send. Checked
  // on every focus, not just mount, since this screen can be left open
  // in the background while the other party pays, the trip starts, or
  // the booking ends elsewhere.
  useFocusEffect(
    useCallback(() => {
      api.getBookingDetail(bookingId)
        .then((booking) => {
          setEnded(booking.status !== "CONFIRMED");
          setOtherName((calleeRole === "DRIVER" ? booking.ride?.driver?.name : booking.passenger?.name) || null);
        })
        .catch(() => {});
      // Opening this conversation is what clears its unread badge
      // elsewhere (History/Upcoming trips) — fire-and-forget, no need to
      // block rendering on it.
      api.markChatRead(bookingId).catch(() => {});
    }, [bookingId])
  );

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
    socketRef.current?.emit("message:send", { bookingId, text, type: "TEXT" });
    setText("");
  }

  async function handleCall() {
    if (!calleeRole) return;
    setCalling(true);
    try {
      const { proxyNumber } = await api.initiateCall(bookingId, calleeRole);
      await Linking.openURL(`tel:${proxyNumber}`);
    } catch (err: any) {
      showError(err.message || "Couldn't start the call");
    } finally {
      setCalling(false);
    }
  }

  async function handleShareLocation() {
    setSharingLocation(true);
    try {
      const { lat, lng } = await api.getCurrentLocation();
      socketRef.current?.emit("message:send", { bookingId, text: `${lat},${lng}`, type: "LOCATION" });
    } catch (err: any) {
      showError(err.message || "Couldn't share your location");
    } finally {
      setSharingLocation(false);
    }
  }

  function openLocation(text: string) {
    const [lat, lng] = text.split(",");
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(otherName || "?").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{otherName || "Chat"}</Text>
          {!!calleeRole && <Text style={styles.subtitle}>{calleeRole === "DRIVER" ? "Your driver" : "Your passenger"}</Text>}
        </View>
        {!!calleeRole && !ended && (
          <Pressable style={styles.callButton} onPress={handleCall} disabled={calling} hitSlop={6}>
            <Ionicons name={calling ? "call" : "call-outline"} size={16} color={colors.success} />
          </Pressable>
        )}
      </View>
      <FlatList
        style={styles.chatBg}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => {
          const isMine = item.senderId === currentUserId;
          if (item.type === "LOCATION") {
            return (
              <Pressable
                style={[styles.bubble, styles.locationBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
                onPress={() => openLocation(item.text)}
              >
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={14} color={isMine ? "#FFFFFF" : colors.accentText} />
                  <Text style={[styles.locationText, isMine && { color: "#FFFFFF" }]}>Shared location</Text>
                </View>
                <Text style={[styles.locationHint, isMine && { color: "rgba(255,255,255,0.75)" }]}>Tap to open in Maps</Text>
                <Text style={[styles.timeText, isMine && { color: "rgba(255,255,255,0.7)" }]}>{formatMessageTime(item.createdAt)}</Text>
              </Pressable>
            );
          }
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, isMine && { color: "#FFFFFF" }]}>{item.text}</Text>
              <Text style={[styles.timeText, isMine && { color: "rgba(255,255,255,0.7)" }]}>{formatMessageTime(item.createdAt)}</Text>
            </View>
          );
        }}
      />
      {ended ? (
        <View style={styles.endedBanner}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={styles.endedBannerText}>This conversation has ended.</Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <Pressable style={styles.shareButton} onPress={handleShareLocation} disabled={sharingLocation}>
            <Ionicons name="location-outline" size={18} color={colors.accentText} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { ...typography.title, fontSize: 13, color: colors.accentText },
  title: { ...typography.title, fontSize: 14 },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  callButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" },
  chatBg: { flex: 1, backgroundColor: "#EAE6DA" },
  bubble: { maxWidth: "78%", padding: spacing.sm, borderRadius: radius.md },
  bubbleMine: { backgroundColor: colors.accent, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { ...typography.caption, color: colors.textPrimary },
  timeText: { ...typography.small, color: colors.textMuted, fontSize: 10, marginTop: 2, alignSelf: "flex-end" },
  locationBubble: { minWidth: 160 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  locationText: { ...typography.caption, color: colors.textPrimary, fontWeight: "500" },
  locationHint: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  inputRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  endedBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  endedBannerText: { ...typography.small, color: colors.textMuted },
  shareButton: { width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: spacing.md, height: 40 },
  sendButton: { width: 40, height: 40, backgroundColor: colors.accent, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
});
