"use client";

import { useCallback, useState } from "react";
import type { ModuleId } from "@/lib/dashboard/types";

export function useDashboardModule<TModule extends ModuleId>(defaultModule: TModule, validModules: readonly TModule[]) {
  const [activeModule, setActiveModule] = useState<TModule>(() => {
    if (typeof window === "undefined") {
      return defaultModule;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedModule = params.get("module") as TModule | null;

    if (requestedModule && validModules.includes(requestedModule)) {
      return requestedModule;
    }

    return defaultModule;
  });

  const navigate = useCallback(
    (module: TModule) => {
      setActiveModule(module);
      const url = new URL(window.location.href);
      url.searchParams.set("module", module);
      window.history.replaceState(null, "", url.toString());
    },
    []
  );

  return [activeModule, navigate] as const;
}
