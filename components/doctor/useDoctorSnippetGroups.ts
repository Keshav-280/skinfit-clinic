"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DoctorSnippetGroup } from "@/src/lib/doctorQuickSnippets";
import {
  addDoctorSnippetToGroup,
  readDoctorCustomSnippets,
  removeDoctorSnippetFromGroup,
  resolveDoctorSnippetGroupItems,
  type DoctorCustomSnippetScope,
} from "@/src/lib/doctorCustomSnippets";

export function useDoctorSnippetGroups(
  scope: DoctorCustomSnippetScope,
  groups: DoctorSnippetGroup[]
) {
  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);
  const [groupItems, setGroupItems] = useState<Record<string, string[]>>({});

  const builtInByLabel = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const group of groups) {
      map.set(group.label, group.items);
    }
    return map;
  }, [groups]);

  const refresh = useCallback(() => {
    setSavedPhrases(readDoctorCustomSnippets(scope));
    const next: Record<string, string[]> = {};
    for (const group of groups) {
      next[group.label] = resolveDoctorSnippetGroupItems(scope, group.label, group.items);
    }
    setGroupItems(next);
  }, [scope, groups]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addToGroup = useCallback(
    (groupLabel: string, text: string) => {
      const builtIn = builtInByLabel.get(groupLabel) ?? [];
      const next = addDoctorSnippetToGroup(scope, groupLabel, builtIn, text);
      setGroupItems((prev) => ({ ...prev, [groupLabel]: next }));
    },
    [scope, builtInByLabel]
  );

  const removeFromGroup = useCallback(
    (groupLabel: string, text: string) => {
      const builtIn = builtInByLabel.get(groupLabel) ?? [];
      const next = removeDoctorSnippetFromGroup(scope, groupLabel, builtIn, text);
      setGroupItems((prev) => ({ ...prev, [groupLabel]: next }));
    },
    [scope, builtInByLabel]
  );

  return {
    savedPhrases,
    groupItems,
    addToGroup,
    removeFromGroup,
    refresh,
  };
}
