import { MedixoraPatient } from "@/components/medixora/MedixoraPatient";

export default async function MedixoraPatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  return <MedixoraPatient patientId={patientId} />;
}
