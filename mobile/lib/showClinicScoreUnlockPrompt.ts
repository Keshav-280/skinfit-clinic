import { Alert } from "react-native";
import type { Router } from "expo-router";

import { CLINIC_SCORE_UNLOCK } from "../../src/lib/clarityGrade";

export function showClinicScoreUnlockPrompt(router: Router) {
  Alert.alert(CLINIC_SCORE_UNLOCK.title, CLINIC_SCORE_UNLOCK.message, [
    { text: "Cancel", style: "cancel" },
    {
      text: CLINIC_SCORE_UNLOCK.actionLabel,
      onPress: () =>
        router.push(CLINIC_SCORE_UNLOCK.mobileSchedulesHref as Parameters<Router["push"]>[0]),
    },
  ]);
}
