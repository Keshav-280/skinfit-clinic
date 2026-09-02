import { ListPageSkeleton } from "@/components/dashboard/PageSkeletons";

export default function VisitDetailLoading() {
  return <ListPageSkeleton label="Loading visit details" rows={4} />;
}
