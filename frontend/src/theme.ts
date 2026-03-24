import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: '"Satoshi Variable", sans-serif' },
        heading: { value: '"Satoshi Variable", sans-serif' },
      },
      shadows: {
        sm: { value: "0 1px 3px rgba(0,0,0,0.04)" },
        md: { value: "0 4px 24px rgba(0,0,0,0.06)" },
        lg: { value: "0 8px 40px rgba(0,0,0,0.08)" },
      },
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
