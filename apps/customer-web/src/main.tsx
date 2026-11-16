import React from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "../../../packages/ui/src/core";
import { Storefront } from "../../../packages/ui/src/storefront";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <Storefront />
    </Providers>
  </React.StrictMode>,
);
