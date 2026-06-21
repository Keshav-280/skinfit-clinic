import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { FaceScanUploadScreen } from "@/components/capture/FaceScanUploadScreen";
import { FiveAngleCameraStep } from "@/components/FiveAngleCameraStep";
import { OnboardingCaptureReview } from "@/components/onboarding/OnboardingCaptureReview";
import { useAuth } from "@/contexts/AuthContext";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";
import {
  allFaceScanSlotsFilled,
  assignFaceScanSlot,
  emptyFaceScanSlots,
  faceScanSlotsToUris,
  firstEmptyFaceScanSlotIndex,
  type FaceScanSlotUris,
} from "@/lib/faceScanSlotCaptures";
import { normalizeScanImageUri } from "@/lib/normalizeScanImage";
import { pickSingleFaceScanImage } from "@/lib/pickFaceScanImages";
import { addPendingScanJob } from "@/lib/scanJobNotifications";
import { submitFaceScan, formatFaceScanIdentityError } from "@/lib/submitFaceScan";

const N = FACE_SCAN_CAPTURE_STEPS.length;

type Flow = "upload" | "camera" | "review";

export default function OnboardingCaptureScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { token, markBaselineSubmitted } = useAuth();
  const [slots, setSlots] = useState<FaceScanSlotUris>(() => emptyFaceScanSlots());
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<Flow>(mode === "camera" ? "camera" : "upload");
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);

  const uris = faceScanSlotsToUris(slots);
  const isComplete = allFaceScanSlotsFilled(slots);
  const inRetakeFlow = retakeIndex !== null;
  const stepIndex =
    retakeIndex ?? (isComplete ? N - 1 : firstEmptyFaceScanSlotIndex(slots));

  async function pickFromLibraryForCamera() {
    const picked = await pickSingleFaceScanImage();
    if (!picked) return;
    const index = inRetakeFlow && retakeIndex !== null ? retakeIndex : stepIndex;
    const next = assignFaceScanSlot(slots, index, picked);
    setSlots(next);
    setRetakeIndex(null);
    if (allFaceScanSlotsFilled(next)) setFlow("review");
  }

  async function runBaselineScan() {
    if (!token || !isComplete) {
      Alert.alert("Capture", `Need all ${N} angles.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("scanName", "kAI baseline — onboarding");
      for (let i = 0; i < N; i++) {
        const uri = await normalizeScanImageUri(slots[i]!);
        form.append("images", {
          uri,
          name: `face-${FACE_SCAN_CAPTURE_STEPS[i].id}.jpg`,
          type: "image/jpeg",
        } as unknown as Blob);
      }
      const outcome = await submitFaceScan(token, form);
      if (outcome.mode === "error") {
        throw new Error(
          formatFaceScanIdentityError(outcome.message, outcome.identityChecks)
        );
      }
      if (outcome.mode === "queued") {
        await addPendingScanJob(outcome.jobId, "kAI baseline — onboarding");
        await markBaselineSubmitted({ pending: true });
        router.replace("/onboarding/baseline-report?pending=1" as Href);
        return;
      }
      await markBaselineSubmitted({ pending: false });
      router.replace(
        `/onboarding/baseline-report?scanId=${encodeURIComponent(String(outcome.scanId))}&pending=0` as Href
      );
    } catch (e) {
      Alert.alert("Baseline scan", e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (flow === "upload" && !isComplete) {
    return (
      <FaceScanUploadScreen
        slots={slots}
        onSlotsChange={setSlots}
        onContinue={() => setFlow("review")}
        onStartCamera={() => setFlow("camera")}
        onBack={() => router.back()}
        title="Baseline photos"
        showScanHistoryLink={false}
      />
    );
  }

  if ((!isComplete || inRetakeFlow) && flow === "camera") {
    return (
      <FiveAngleCameraStep
        variant="onboarding"
        stepIndex={stepIndex}
        previousCaptureUri={
          inRetakeFlow
            ? (slots[retakeIndex!] ?? slots[retakeIndex! - 1] ?? null)
            : (slots.filter(Boolean).at(-1) ?? null)
        }
        onCaptured={(uri) => {
          const index = inRetakeFlow && retakeIndex !== null ? retakeIndex : stepIndex;
          const next = assignFaceScanSlot(slots, index, uri);
          setSlots(next);
          setRetakeIndex(null);
          if (allFaceScanSlotsFilled(next)) setFlow("review");
        }}
        onPickFromLibrary={() => void pickFromLibraryForCamera()}
        onBack={() => {
          if (inRetakeFlow) {
            setRetakeIndex(null);
            if (isComplete) setFlow("review");
            return;
          }
          const lastFilled = [...slots].reverse().findIndex((s) => s);
          if (lastFilled >= 0) {
            const clearIndex = N - 1 - lastFilled;
            setSlots((s) => {
              const next = [...s];
              next[clearIndex] = null;
              return next;
            });
          } else {
            setFlow("upload");
          }
        }}
        busy={busy}
      />
    );
  }

  return (
    <OnboardingCaptureReview
      uris={uris}
      busy={busy}
      onBack={() => {
        setFlow("upload");
      }}
      onLooksGood={() => void runBaselineScan()}
      onRetakeIndex={(index) => {
        setRetakeIndex(index);
        setFlow("camera");
      }}
    />
  );
}
