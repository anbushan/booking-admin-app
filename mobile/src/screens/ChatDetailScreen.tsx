import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, Linking } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { dialProxyNumber } from "../lib/callHelper";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { useTranslation } from "../lib/i18n/I18nContext";

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
  useScreenView("ChatDetailScreen");
  const { t } = useTranslation();
  // otherName/otherPhoto: ChatListScreen already has both in memory (it
  // needs them to render its own row) and passes them along here so the
  // header can paint the real name/avatar on the very first frame —
  // without this every entry point showed a placeholder title and blank
  // avatar for a beat, then popped to the real ones once
  // getBookingDetail resolved. Entry points that don't have this data
  // yet (HistoryScreen, UpcomingTripsScreen, TripOtpScreen's chat icon)
  // still fall back to the fetch below; only ChatListScreen's own tap
  // gets the flicker-free path today.
  const { bookingId, currentUserId: paramUserId, calleeRole, otherName: paramOtherName, otherPhoto: paramOtherPhoto } = route.params;
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(paramUserId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [calling, setCalling] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [ended, setEnded] = useState(false);
  // Starts false (not "has this loaded yet, ever") rather than tracking
  // per-focus freshness — the footer only needs to avoid rendering a
  // guess on the very first paint; every focus after that already has a
  // real answer to keep showing while the next check runs in the
  // background.
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [otherName, setOtherName] = useState<string | null>(paramOtherName || null);
  const [otherPhoto, setOtherPhoto] = useState<string | null>(paramOtherPhoto || null);
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
          setDetailLoaded(true);
          // Name/photo are set once and then left alone on every later
          // refocus (app foreground, coming back from a shared-location
          // tap, ...) rather than re-set every time this effect reruns.
          // Two reasons: the other party's name/photo can't change
          // mid-conversation, so there's nothing to refresh; and
          // photoViewUrl is a freshly-presigned URL every single call
          // (different signature/expiry query string each time even for
          // the exact same file — see lib/photo.js) — re-setting it on
          // every focus handed Avatar's <Image> a "new" uri each time,
          // which made it reload from scratch and visibly flash even
          // though it was the same photo. Only `ended` needs to be live
          // every focus — that's the one thing that can actually change
          // while this screen sits backgrounded.
          const other = calleeRole === "DRIVER" ? booking.ride?.driver : booking.passenger;
          setOtherName((prev) => prev ?? other?.name ?? null);
          setOtherPhoto((prev) => prev ?? other?.photoViewUrl ?? null);
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
      await dialProxyNumber(proxyNumber);
    } catch (err: any) {
      showError(err.message || t("common.couldntStartCall"));
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
      showError(err.message || t("chatDetail.couldntShareLocation"));
    } finally {
      setSharingLocation(false);
    }
  }

  function openLocation(text: string) {
    const [lat, lng] = text.split(",");
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoider>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Avatar uri={otherPhoto} name={otherName} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{otherName || t("chatDetail.title")}</Text>
          {!!calleeRole && <Text style={styles.subtitle}>{calleeRole === "DRIVER" ? t("chatDetail.yourDriver") : t("chatDetail.yourPassenger")}</Text>}
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
        // A long-running conversation can rack up hundreds of messages —
        // these keep the off-screen render window small instead of the
        // default (10 batches, 21-screen window) trying to keep the
        // whole history warm.
        maxToRenderPerBatch={12}
        windowSize={8}
        initialNumToRender={15}
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
                  <Text style={[styles.locationText, isMine && { color: "#FFFFFF" }]}>{t("chatDetail.sharedLocation")}</Text>
                </View>
                <Text style={[styles.locationHint, isMine && { color: "rgba(255,255,255,0.75)" }]}>{t("chatDetail.tapToOpenMaps")}</Text>
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
      {!detailLoaded ? (
        // ended defaults to false before the first getBookingDetail
        // resolves — rendering off that guess showed the composer, then
        // swapped it for the "conversation ended" banner a beat later on
        // any booking that wasn't actually CONFIRMED. A same-height
        // spacer avoids both the wrong-content flash and a layout jump
        // once the real footer replaces it.
        // 64 = inputRow's own real height (spacing.md padding top+bottom
        // + the 40px send/share buttons) — matched exactly so swapping in
        // the real footer once detailLoaded flips doesn't itself cause a
        // layout jump.
        <View style={[styles.inputRow, { minHeight: 64 }]} />
      ) : ended ? (
        <View style={styles.endedBanner}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={styles.endedBannerText}>{t("chatDetail.conversationEnded")}</Text>
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
            placeholder={t("chatDetail.messagePlaceholder")}
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.xs, paddingRight: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
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
  locationText: { ...typography.caption, color: colors.textPrimary, fontWeight: "700", fontFamily: FONT.bold },
  locationHint: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  inputRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  endedBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  endedBannerText: { ...typography.small, color: colors.textMuted },
  shareButton: { width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: spacing.md, height: 40, color: colors.textPrimary },
  sendButton: { width: 40, height: 40, backgroundColor: colors.textPrimary, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
});
