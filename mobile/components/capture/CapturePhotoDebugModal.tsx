import { Ionicons } from "@expo/vector-icons";
import { manipulateAsync } from "expo-image-manipulator";
import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  uri: string;
  label: string;
  onClose: () => void;
  onRetake?: () => void;
  extraLines?: string[];
};

export function CapturePhotoDebugModal({
  visible,
  uri,
  label,
  onClose,
  onRetake,
  extraLines = [],
}: Props) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !uri) return;
    setSize(null);
    setError(null);
    void manipulateAsync(uri, [])
      .then((result) => {
        if (result.width && result.height) {
          setSize({ w: result.width, h: result.height });
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not read image");
      });
  }, [visible, uri]);

  const lines = [
    `Step: ${label}`,
    size
      ? `Size: ${size.w}×${size.h} (${(size.w / size.h).toFixed(2)} aspect)`
      : error
        ? `Size: error — ${error}`
        : "Size: loading…",
    `URI: ${uri.length > 72 ? `${uri.slice(0, 72)}…` : uri}`,
    ...extraLines,
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Capture debug</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close debug">
              <Ionicons name="close" size={22} color="#ecfdf5" />
            </Pressable>
          </View>

          <View style={styles.previewWrap}>
            <Image source={{ uri }} style={styles.preview} resizeMode="contain" />
          </View>

          <ScrollView style={styles.linesScroll} nestedScrollEnabled>
            {lines.map((line) => (
              <Text key={line} style={styles.line}>
                {line}
              </Text>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            {onRetake ? (
              <Pressable
                style={({ pressed }) => [styles.btnOutline, pressed && styles.pressed]}
                onPress={() => {
                  onClose();
                  onRetake();
                }}
              >
                <Text style={styles.btnOutlineText}>Retake this photo</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.btnPrimaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  card: {
    maxHeight: "92%",
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(110,231,183,0.25)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: {
    color: "#6ee7b7",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  previewWrap: {
    height: 280,
    backgroundColor: "#000",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  linesScroll: {
    maxHeight: 160,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  line: {
    color: "#ecfdf5",
    fontSize: 11,
    fontFamily: "Menlo",
    lineHeight: 16,
    marginBottom: 4,
  },
  actions: {
    gap: 8,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  btnPrimary: {
    borderRadius: 10,
    backgroundColor: "#1E1B31",
    paddingVertical: 12,
    alignItems: "center",
  },
  btnOutline: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 12,
    alignItems: "center",
  },
  btnOutlineText: {
    color: "#ecfdf5",
    fontSize: 14,
    fontWeight: "600",
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.88,
  },
});
