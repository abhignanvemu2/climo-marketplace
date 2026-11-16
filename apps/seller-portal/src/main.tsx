import React from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "../../../packages/ui/src/core";
import { Workspace } from "../../../packages/ui/src/workspace";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <Workspace mode="seller" />
    </Providers>
  </React.StrictMode>,
);
