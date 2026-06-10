import { Redirect, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { getOnboardingDashboardSkip } from "@/lib/onboardingDashboardSkip";

export default function Index() {
  const { ready, token, user, refreshUserFromProfile } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [skippedOnboarding, setSkippedOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let alive = true;
    setSyncing(true);
    void (async () => {
      await refreshUserFromProfile(token);
      if (alive) setSyncing(false);
    })();
    return () => {
      alive = false;
    };
  }, [ready, token, refreshUserFromProfile]);

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setSkippedOnboarding(false);
      return;
    }
    void getOnboardingDashboardSkip(user.id).then((v) => {
      if (alive) setSkippedOnboarding(v);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  if (!ready || (token && (syncing || skippedOnboarding == null))) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (token) {
    const canAccess =
      skippedOnboarding ||
      (user?.canAccessDashboard ??
        user?.baselineScanPending ??
        user?.hasBaselineScan ??
        user?.onboardingComplete !== false);
    if (!canAccess) {
      return <Redirect href={"/onboarding/kai-intro" as Href} />;
    }
    return <Redirect href="/(drawer)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
