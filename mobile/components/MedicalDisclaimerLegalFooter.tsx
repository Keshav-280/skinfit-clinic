import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { MEDICAL_DISCLAIMER_SHORT, getWebPortalUrl } from "@/lib/medicalDisclaimer";

const NAVY = "#2C3E6B";
const MUTED = "#6B7280";

export function MedicalDisclaimerLegalFooter() {
  const portalUrl = getWebPortalUrl();

  const openTerms = () => {
    if (!portalUrl) return;
    void Linking.openURL(`${portalUrl}/terms`);
  };

  const openPrivacy = () => {
    if (!portalUrl) return;
    void Linking.openURL(`${portalUrl}/privacy`);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.disclaimer}>{MEDICAL_DISCLAIMER_SHORT}</Text>
      {portalUrl ? (
        <View style={styles.links}>
          <Pressable onPress={openTerms} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.sep}>·</Text>
          <Pressable onPress={openPrivacy} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>Privacy Policy</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(44,62,107,0.12)",
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 17,
    color: MUTED,
    textAlign: "center",
  },
  links: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  link: {
    fontSize: 12,
    fontWeight: "600",
    color: NAVY,
    textDecorationLine: "underline",
  },
  sep: {
    fontSize: 12,
    color: MUTED,
  },
});
