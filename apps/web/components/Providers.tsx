"use client";

// Client providers wrapper — keeps app/layout.tsx a server component
// while giving the whole dashboard access to client-side stores.
// The Omni store nests inside the dataset store: Omni action
// handlers write cosmos additions through the dataset store's
// setOmniAdditions (see lib/dataset.tsx and lib/omni.tsx).
// Creator: David Charles Bourassa · Quantum Concepts LLC, Santa Fe, New Mexico.
import type { ReactNode } from "react";
import { DatasetProvider } from "@/lib/dataset";
import { OmniProvider } from "@/lib/omni";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <DatasetProvider>
      <OmniProvider>{children}</OmniProvider>
    </DatasetProvider>
  );
}
