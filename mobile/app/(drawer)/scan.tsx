import { useFocusEffect } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureDoneScreen } from "@/components/capture/CaptureDoneScreen";
import { CapturePrepScreen } from "@/components/capture/CapturePrepScreen";
import { FaceScanUploadScreen } from "@/components/capture/FaceScanUploadScreen";
import { FiveAngleCameraStep } from "@/components/FiveAngleCameraStep";
import { OnboardingCaptureReview } from "@/components/onboarding/OnboardingCaptureReview";
import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import {
  buildAutoScanName,
  FACE_SCAN_CAPTURE_STEPS,
  fetchNextScanNumber,
  SCAN_NAME_INPUT_PLACEHOLDER,
  resolveScanName,
} from "@/lib/faceScanCaptures";
import {
  allFaceScanSlotsFilled,
  assignFaceScanSlot,
  emptyFaceScanSlots,
  faceScanSlotsToUris,
  firstEmptyFaceScanSlotIndex,
  type FaceScanSlotUris,
} from "@/lib/faceScanSlotCaptures";
import { normalizeScanImageUri } from "@/lib/normalizeScanImage";
import { getCaptureViewfinderSize } from "@/lib/captureViewfinderSize";
import { appendCaptureCropContext } from "../../src/lib/parseCaptureCropContext";
import { pickSingleFaceScanImage } from "@/lib/pickFaceScanImages";
import {
  addPendingScanJob,
  dismissUnreadReadyScan,
  getPendingScanJobs,
  removePendingScanJob,
  subscribeScanJobNotifications,
} from "@/lib/scanJobNotifications";
import { submitFaceScan, formatFaceScanIdentityError } from "@/lib/submitFaceScan";

const SCAN_STATUS_POLL_MS = 3_000;
const N = FACE_SCAN_CAPTURE_STEPS.length;

type Phase = "intro" | "upload" | "capture" | "review" | "done";

export default function ScanScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("intro");
  const [slots, setSlots] = useState<FaceScanSlotUris>(() => emptyFaceScanSlots());
  const [scanName, setScanName] = useState("");
  const [busy, setBusy] = useState(false);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [queuedJobId, setQueuedJobId] = useState<string | null>(null);

  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const resetToFreshScan = useCallback(() => {
    setSlots(emptyFaceScanSlots());
    setScanName("");
    setRetakeIndex(null);
    setReportPending(false);
    setQueuedJobId(null);
    setPhase("intro");
  }, []);

  useFocusEffect(
    useCallback(() => {
      const p = phaseRef.current;
      if (p === "capture" || p === "upload" || p === "done") {
        resetToFreshScan();
      }
    }, [resetToFreshScan])
  );

  useEffect(() => {
    if (phase !== "done" || !reportPending || !token) return;
    let cancelled = false;

    const openReport = (scanId: number, jobId?: string | null) => {
      if (cancelled) return;
      void dismissUnreadReadyScan(scanId);
      if (jobId) void removePendingScanJob(jobId);
      resetToFreshScan();
      router.replace(`/(drawer)/history/${scanId}` as Href);
    };

    const checkJob = async (jobId: string): Promise<boolean> => {
      try {
        const data = await apiJson<{
          status?: string;
          scanId?: number | null;
        }>(`/api/scans/status/${encodeURIComponent(jobId)}`, token, {
          method: "GET",
        });
        const status = String(data.status ?? "");
        const scanId =
          typeof data.scanId === "number" && data.scanId > 0
            ? data.scanId
            : null;
        if (status === "completed" && scanId) {
          openReport(scanId, jobId);
          return true;
        }
      } catch {
        /* retry */
      }
      return false;
    };

    const poll = async () => {
      if (cancelled) return;
      if (queuedJobId && (await checkJob(queuedJobId))) return;
      const pending = await getPendingScanJobs();
      for (const job of pending) {
        if (await checkJob(job.jobId)) return;
      }
    };

    void poll();
    const t = setInterval(() => void poll(), SCAN_STATUS_POLL_MS);
    const unsub = subscribeScanJobNotifications(() => void poll());
    return () => {
      cancelled = true;
      clearInterval(t);
      unsub();
    };
  }, [phase, token, router, queuedJobId, reportPending, resetToFreshScan]);

  const uris = faceScanSlotsToUris(slots);
  const stepIndex =
    retakeIndex ?? (allFaceScanSlotsFilled(slots) ? N - 1 : firstEmptyFaceScanSlotIndex(slots));
  const inRetakeFlow = retakeIndex !== null;
  const inCaptureFlow =
    phase === "capture" && (!allFaceScanSlotsFilled(slots) || inRetakeFlow);

  useEffect(() => {
    if (phase !== "review" || !token) return;
    let cancelled = false;
    void (async () => {
      const scanNumber = await fetchNextScanNumber(() =>
        apiJson<{ skinScanHistory?: unknown[] }>("/api/patient/home", token, {
          method: "GET",
        })
      );
      if (!cancelled) {
        setScanName(buildAutoScanName({ scanNumber }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, token]);

  async function pickFromLibraryForCamera() {
    const picked = await pickSingleFaceScanImage();
    if (!picked) return;
    if (inRetakeFlow && retakeIndex !== null) {
      setSlots((s) => assignFaceScanSlot(s, retakeIndex, picked));
      setRetakeIndex(null);
      if (allFaceScanSlotsFilled(assignFaceScanSlot(slots, retakeIndex, picked))) {
        setPhase("review");
      }
      return;
    }
    const index = firstEmptyFaceScanSlotIndex(slots);
    const next = assignFaceScanSlot(slots, index, picked);
    setSlots(next);
    if (allFaceScanSlotsFilled(next)) setPhase("review");
  }

  async function runScan() {
    const name = resolveScanName(scanName);
    if (!token || uris.length !== N) {
      Alert.alert("Face scan", `Add all ${N} photos first.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("scanName", name);
      for (let i = 0; i < N; i++) {
        const uri = await normalizeScanImageUri(slots[i]!);
        form.append("images", {
          uri,
          name: `face-${FACE_SCAN_CAPTURE_STEPS[i].id}.jpg`,
          type: "image/jpeg",
        } as unknown as Blob);
      }
      const viewfinder = getCaptureViewfinderSize(
        insets.top + 8,
        Math.max(insets.bottom, 16)
      );
      appendCaptureCropContext(form, {
        source: "mobile",
        viewfinderW: viewfinder.width,
        viewfinderH: viewfinder.height,
      });

      const outcome = await submitFaceScan(token, form);
      if (outcome.mode === "error") {
        throw new Error(
          formatFaceScanIdentityError(outcome.message, outcome.identityChecks)
        );
      }
      if (outcome.mode === "queued") {
        await addPendingScanJob(outcome.jobId, name);
        setSlots(emptyFaceScanSlots());
        setScanName("");
        setQueuedJobId(outcome.jobId);
        setReportPending(true);
        setPhase("done");
        return;
      }
      setSlots(emptyFaceScanSlots());
      setScanName("");
      setReportPending(false);
      setPhase("done");
    } catch (e) {
      Alert.alert(
        "Scan failed",
        e instanceof Error ? e.message : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (phase === "done") {
    return (
      <CaptureDoneScreen
        mode="scan"
        reportPending={reportPending}
        onPrimary={() => router.push("/(drawer)/history" as Href)}
        onDashboard={() => router.replace("/(drawer)" as Href)}
      />
    );
  }

  if (phase === "upload") {
    return (
      <FaceScanUploadScreen
        slots={slots}
        onSlotsChange={setSlots}
        onContinue={() => setPhase("review")}
        onStartCamera={() => setPhase("capture")}
        onBack={() => setPhase("intro")}
        reserveBottomDock
      />
    );
  }

  if (phase === "review" && allFaceScanSlotsFilled(slots) && !inRetakeFlow) {
    return (
      <OnboardingCaptureReview
        uris={uris}
        busy={busy}
        primaryLabel="Start analysis"
        scanName={scanName}
        onScanNameChange={setScanName}
        scanNamePlaceholder={SCAN_NAME_INPUT_PLACEHOLDER}
        onBack={() => {
          setPhase("upload");
        }}
        onLooksGood={() => void runScan()}
        onRetakeIndex={(index) => {
          setRetakeIndex(index);
          setPhase("capture");
        }}
      />
    );
  }

  if (inCaptureFlow) {
    return (
      <View style={{ flex: 1 }}>
        <FiveAngleCameraStep
          variant="dashboard"
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
            if (allFaceScanSlotsFilled(next)) setPhase("review");
          }}
          onPickFromLibrary={() => void pickFromLibraryForCamera()}
          onBack={() => {
            if (inRetakeFlow) {
              setRetakeIndex(null);
              if (allFaceScanSlotsFilled(slots)) {
                setPhase("review");
              }
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
              setPhase(slots.some(Boolean) ? "upload" : "intro");
            }
          }}
          busy={busy}
        />
      </View>
    );
  }

  return (
    <CapturePrepScreen
      onStart={() => {
        setSlots(emptyFaceScanSlots());
        setPhase("capture");
      }}
      onUploadPhotos={() => {
        setSlots(emptyFaceScanSlots());
        setPhase("upload");
      }}
      onBack={() => router.replace("/(drawer)" as Href)}
      reserveBottomDock
      onViewHistory={() => router.push("/(drawer)/history" as Href)}
    />
  );
}
