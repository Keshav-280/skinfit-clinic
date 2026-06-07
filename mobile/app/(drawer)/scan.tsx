import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";

import { CaptureDoneScreen } from "@/components/capture/CaptureDoneScreen";
import { CapturePrepScreen } from "@/components/capture/CapturePrepScreen";
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
import { normalizeScanImageUri } from "@/lib/normalizeScanImage";
import {
  addPendingScanJob,
  dismissUnreadReadyScan,
  getPendingScanJobs,
  removePendingScanJob,
  subscribeScanJobNotifications,
} from "@/lib/scanJobNotifications";
import { submitFaceScan } from "@/lib/submitFaceScan";

const SCAN_STATUS_POLL_MS = 3_000;
const N = FACE_SCAN_CAPTURE_STEPS.length;

type Phase = "intro" | "capture" | "review" | "done";

export default function ScanScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [uris, setUris] = useState<string[]>([]);
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
    setUris([]);
    setScanName("");
    setRetakeIndex(null);
    setReportPending(false);
    setQueuedJobId(null);
    setPhase("intro");
  }, []);

  useFocusEffect(
    useCallback(() => {
      const p = phaseRef.current;
      if (p === "capture" || p === "done") {
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

  const stepIndex = retakeIndex ?? uris.length;
  const inRetakeFlow = retakeIndex !== null;
  const inCaptureFlow =
    (phase === "capture" && uris.length < N) || inRetakeFlow;

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

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo library access to choose an image.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.88,
      allowsMultipleSelection: false,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const picked = res.assets[0].uri;
    if (inRetakeFlow && retakeIndex !== null) {
      setUris((u) => {
        const next = [...u];
        next[retakeIndex] = picked;
        return next;
      });
      setRetakeIndex(null);
      return;
    }
    const newUris = [...uris, picked];
    setUris(newUris);
    if (newUris.length >= N) setPhase("review");
  }

  async function runScan() {
    const name = resolveScanName(scanName);
    if (!token || uris.length !== N) {
      Alert.alert("Face scan", `Capture all ${N} angles first.`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("scanName", name);
      for (let i = 0; i < N; i++) {
        const uri = await normalizeScanImageUri(uris[i]);
        form.append("images", {
          uri,
          name: `face-${FACE_SCAN_CAPTURE_STEPS[i].id}.jpg`,
          type: "image/jpeg",
        } as unknown as Blob);
      }

      const outcome = await submitFaceScan(token, form);
      if (outcome.mode === "error") {
        throw new Error(outcome.message);
      }
      if (outcome.mode === "queued") {
        await addPendingScanJob(outcome.jobId, name);
        setUris([]);
        setScanName("");
        setQueuedJobId(outcome.jobId);
        setReportPending(true);
        setPhase("done");
        return;
      }
      setUris([]);
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

  if (phase === "review" && uris.length >= N && !inRetakeFlow) {
    return (
      <OnboardingCaptureReview
        uris={uris}
        busy={busy}
        primaryLabel="Start analysis"
        scanName={scanName}
        onScanNameChange={setScanName}
        scanNamePlaceholder={SCAN_NAME_INPUT_PLACEHOLDER}
        onBack={() => {
          setUris((u) => u.slice(0, -1));
          setPhase("capture");
        }}
        onLooksGood={() => void runScan()}
        onRetakeIndex={setRetakeIndex}
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
              ? (uris[retakeIndex!] ?? uris[retakeIndex! - 1] ?? null)
              : (uris[uris.length - 1] ?? null)
          }
          onCaptured={(uri) => {
            if (inRetakeFlow && retakeIndex !== null) {
              setUris((u) => {
                const next = [...u];
                next[retakeIndex] = uri;
                return next;
              });
              setRetakeIndex(null);
              return;
            }
            const newUris = [...uris, uri];
            setUris(newUris);
            if (newUris.length >= N) setPhase("review");
          }}
          onPickFromLibrary={() => void pickFromLibrary()}
          onBack={() => {
            if (inRetakeFlow) {
              setRetakeIndex(null);
              return;
            }
            if (uris.length > 0) {
              setUris((u) => u.slice(0, -1));
            } else {
              setPhase("intro");
            }
          }}
          busy={busy}
        />
      </View>
    );
  }

  return (
    <CapturePrepScreen
      onStart={() => setPhase("capture")}
      onBack={() => router.replace("/(drawer)" as Href)}
      reserveBottomDock
      onViewHistory={() => router.push("/(drawer)/history" as Href)}
    />
  );
}
