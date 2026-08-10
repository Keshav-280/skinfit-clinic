"use client";

import type { ReactNode } from "react";

export function ConditionalField({
  condition,
  children,
}: {
  condition: boolean;
  children: ReactNode;
}) {
  if (!condition) return null;
  return <>{children}</>;
}
