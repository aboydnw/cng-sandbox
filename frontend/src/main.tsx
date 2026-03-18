import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CanvasContext } from "@luma.gl/core";
import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter } from "react-router-dom";
import { system } from "./theme";
import App from "./App";
import "./styles.css";

// Workaround for luma.gl v9.2.6 bug
const orig = CanvasContext.prototype.getMaxDrawingBufferSize;
CanvasContext.prototype.getMaxDrawingBufferSize = function () {
  if (!this.device?.limits) return [4096, 4096];
  return orig.call(this);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChakraProvider>
  </StrictMode>,
);
