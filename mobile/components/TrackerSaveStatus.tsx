import { StyleSheet, Text, View } from "react-native";

import type { TrackerSaveStatus } from "@/hooks/useDebouncedTrackerAutoSave";

export function TrackerSaveStatusText({ status }: { status: TrackerSaveStatus }) {
  if (status === "idle") return null;

  return (
    <View style={styles.wrap}>
      {status === "saving" ? (
        <Text style={styles.saving}>Saving…</Text>
      ) : status === "saved" ? (
        <Text style={styles.saved}>Saved ✓</Text>
      ) : (
        <Text style={styles.error}>Could not save</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 72, alignItems: "flex-end" },
  saving: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  saved: { fontSize: 12, color: "#16a34a", fontWeight: "600" },
  error: { fontSize: 12, color: "#DC2626", fontWeight: "600" },
});
