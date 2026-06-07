"use client";

import { useCallback, useState } from "react";
import {
  addDoctorCustomTreatment,
  readDoctorCustomTreatments,
  removeDoctorCustomTreatment,
} from "@/src/lib/doctorCustomTreatments";
import type { ClinicTreatment } from "@/src/lib/clinicTreatmentGuides";

export function useDoctorCustomTreatments() {
  const [items, setItems] = useState<ClinicTreatment[]>(() => readDoctorCustomTreatments());

  const add = useCallback(
    (input: {
      name: string;
      preCare: string[];
      postCareDos: string[];
      postCareDonts: string[];
    }) => {
      setItems(addDoctorCustomTreatment(input));
    },
    []
  );

  const remove = useCallback((id: string) => {
    setItems(removeDoctorCustomTreatment(id));
  }, []);

  return { items, add, remove };
}
