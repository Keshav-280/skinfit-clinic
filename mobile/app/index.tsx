import { Redirect, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { ready, token, user, refreshUserFromProfile } = useAuth();
  const [syncing, setSyncing] = useState(false);

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

  if (!ready || (token && syncing)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (token) {
    if (user?.onboardingComplete === false) {
      return <Redirect href={"/onboarding" as Href} />;
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
