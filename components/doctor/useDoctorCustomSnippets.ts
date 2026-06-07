"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoctorCustomSnippet,
  readDoctorCustomSnippets,
  removeDoctorCustomSnippet,
  type DoctorCustomSnippetScope,
} from "@/src/lib/doctorCustomSnippets";

export function useDoctorCustomSnippets(scope: DoctorCustomSnippetScope) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    setItems(readDoctorCustomSnippets(scope));
  }, [scope]);

  const add = useCallback(
    (text: string) => {
      setItems(addDoctorCustomSnippet(scope, text));
    },
    [scope]
  );

  const remove = useCallback(
    (text: string) => {
      setItems(removeDoctorCustomSnippet(scope, text));
    },
    [scope]
  );

  return { items, add, remove };
}
