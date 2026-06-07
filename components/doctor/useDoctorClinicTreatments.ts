"use client";

import { useCallback, useState } from "react";
import type { ClinicTreatment } from "@/src/lib/clinicTreatmentGuides";
import { addDoctorCustomTreatment } from "@/src/lib/doctorCustomTreatments";
import {
  deleteDoctorClinicTreatment,
  readDoctorClinicTreatments,
  readHiddenBuiltInTreatments,
  restoreHiddenBuiltInTreatment,
  type ClinicTreatmentInput,
  updateDoctorClinicTreatment,
} from "@/src/lib/doctorTreatmentCatalog";

export function useDoctorClinicTreatments() {
  const [items, setItems] = useState<ClinicTreatment[]>(() => readDoctorClinicTreatments());
  const [hiddenBuiltIn, setHiddenBuiltIn] = useState<ClinicTreatment[]>(() =>
    readHiddenBuiltInTreatments()
  );

  const refresh = useCallback(() => {
    setItems(readDoctorClinicTreatments());
    setHiddenBuiltIn(readHiddenBuiltInTreatments());
  }, []);

  const add = useCallback(
    (input: ClinicTreatmentInput) => {
      addDoctorCustomTreatment(input);
      refresh();
    },
    [refresh]
  );

  const update = useCallback(
    (id: string, input: ClinicTreatmentInput, isBuiltIn: boolean) => {
      setItems(updateDoctorClinicTreatment(id, input, isBuiltIn));
      setHiddenBuiltIn(readHiddenBuiltInTreatments());
    },
    []
  );

  const remove = useCallback((id: string, isBuiltIn: boolean) => {
    setItems(deleteDoctorClinicTreatment(id, isBuiltIn));
    setHiddenBuiltIn(readHiddenBuiltInTreatments());
  }, []);

  const restore = useCallback((id: string) => {
    restoreHiddenBuiltInTreatment(id);
    refresh();
  }, [refresh]);

  return { items, hiddenBuiltIn, add, update, remove, restore, refresh };
}
