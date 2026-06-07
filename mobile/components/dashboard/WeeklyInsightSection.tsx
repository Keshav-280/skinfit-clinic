import { useCallback, useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import WeeklyReportCard from "@/components/profile/WeeklyReportCard";
import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import { getCached, setCached } from "@/lib/apiCache";
import {
  buildWeeklyInsightViewModel,
  SKIN_PROFILE_CACHE_KEY,
  type SkinProfileForWeekly,
  type WeeklyHomeSnapshot,
} from "@/lib/weeklyInsightModel";

type Props = {
  home: WeeklyHomeSnapshot | null;
  style?: StyleProp<ViewStyle>;
  /** Bump when dashboard finishes a home refresh. */
  reloadNonce?: number;
};

export function WeeklyInsightSection({ home, style, reloadNonce = 0 }: Props) {
  const { token } = useAuth();
  const [skinExtra, setSkinExtra] = useState<SkinProfileForWeekly | null>(null);

  const loadSkinProfile = useCallback(async () => {
    if (!token) return;
    const cached = await getCached<SkinProfileForWeekly>(SKIN_PROFILE_CACHE_KEY);
    if (cached) setSkinExtra(cached);
    try {
      const json = await apiJson<SkinProfileForWeekly>(
        "/api/patient/skin-profile",
        token,
        { method: "GET" }
      );
      setSkinExtra(json);
      await setCached(SKIN_PROFILE_CACHE_KEY, json);
    } catch {
      /* keep cached / empty */
    }
  }, [token]);

  useEffect(() => {
    void loadSkinProfile();
  }, [loadSkinProfile, reloadNonce]);

  const model = buildWeeklyInsightViewModel(skinExtra, home);
  if (!model.hasWeeklyContent) return null;

  return (
    <View style={style}>
      <WeeklyReportCard
      locked={model.card.locked}
      nextInsightAt={model.card.nextInsightAt}
      kaiScore={model.card.kaiScore}
      weeklyDelta={model.card.weeklyDelta}
      consistency={model.card.consistency}
      dateRange={model.card.dateRange}
      showTrend={model.card.showTrend}
      observations={model.card.observations}
      dataUsedSummary={model.card.dataUsedSummary}
      priorityActions={model.card.priorityActions}
      observationsUnavailable={model.card.observationsUnavailable}
      actionsUnavailable={model.card.actionsUnavailable}
    />
    </View>
  );
}
