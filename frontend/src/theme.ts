import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          orange: { value: "#CF3F02" },
          orangeHover: { value: "#b83800" },
          brown: { value: "#443F3F" },
          bgSubtle: { value: "#f5f3f0" },
          border: { value: "#e8e5e0" },
          textSecondary: { value: "#7a7474" },
          success: { value: "#2a7d3f" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
