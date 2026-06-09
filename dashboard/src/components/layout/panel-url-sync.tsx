"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useModals, type AppModal } from "@/context/modal-context";

function PanelUrlSyncInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openModal } = useModals();

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (panel === "bot" || panel === "config") {
      openModal(panel as AppModal);
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, openModal, router]);

  return null;
}

export function PanelUrlSync() {
  return (
    <Suspense fallback={null}>
      <PanelUrlSyncInner />
    </Suspense>
  );
}
