import {
  createSystem,
  defaultConfig,
  defineConfig,
  defineRecipe,
} from "@chakra-ui/react";

const interactiveTransition = {
  transitionProperty:
    "background, border-color, color, box-shadow, transform, opacity",
  transitionDuration: "fast",
  transitionTimingFunction: "out",
};

const buttonRecipe = defineRecipe({
  className: "chakra-button",
  base: {
    display: "inline-flex",
    appearance: "none",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    position: "relative",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
    borderWidth: "1px",
    borderColor: "transparent",
    cursor: "pointer",
    flexShrink: "0",
    outline: "0",
    lineHeight: "1.2",
    isolation: "isolate",
    fontWeight: "semibold",
    borderRadius: "control",
    ...interactiveTransition,
    _hover: { transform: "translateY(-1px)" },
    _active: { transform: "translateY(0) scale(0.985)" },
    _focusVisible: {
      outline: "2px solid",
      outlineColor: "focus.ring",
      outlineOffset: "2px",
    },
    _disabled: {
      cursor: "not-allowed",
      opacity: 0.48,
      transform: "none",
    },
    _icon: { flexShrink: "0" },
  },
  variants: {
    size: {
      "2xs": { h: "6", minW: "6", textStyle: "xs", px: "2", gap: "1" },
      xs: { h: "8", minW: "8", textStyle: "xs", px: "2.5", gap: "1" },
      sm: { h: "9", minW: "9", textStyle: "sm", px: "3.5", gap: "2" },
      md: { h: "10", minW: "10", textStyle: "sm", px: "4", gap: "2" },
      lg: { h: "11", minW: "11", textStyle: "md", px: "5", gap: "2.5" },
      xl: { h: "12", minW: "12", textStyle: "md", px: "5", gap: "2.5" },
      "2xl": { h: "16", minW: "16", textStyle: "lg", px: "7", gap: "3" },
    },
    variant: {
      solid: {
        bg: "action.primary",
        color: "action.onPrimary",
        _hover: { bg: "action.primaryHover" },
        _expanded: { bg: "action.primaryHover" },
      },
      subtle: {
        bg: "bg.emphasized",
        color: "fg",
        _hover: { bg: "bg.muted" },
        _expanded: { bg: "bg.muted" },
      },
      surface: {
        bg: "bg.raised",
        color: "fg",
        borderColor: "border",
        shadow: "xs",
        _hover: { bg: "bg.subtle", borderColor: "border.emphasized" },
        _expanded: { bg: "bg.subtle" },
      },
      outline: {
        bg: "bg.raised",
        color: "fg",
        borderColor: "border",
        _hover: { bg: "bg.subtle", borderColor: "border.emphasized" },
        _expanded: { bg: "bg.subtle" },
      },
      ghost: {
        bg: "transparent",
        color: "fg.muted",
        _hover: { bg: "bg.emphasized", color: "fg" },
        _expanded: { bg: "bg.emphasized", color: "fg" },
      },
      plain: {
        color: "action.primary",
        px: "0",
        _hover: { color: "action.primaryHover", transform: "none" },
      },
    },
  },
  defaultVariants: { size: "md", variant: "solid" },
});

const inputRecipe = defineRecipe({
  className: "chakra-input",
  base: {
    width: "100%",
    minWidth: "0",
    outline: "0",
    position: "relative",
    appearance: "none",
    textAlign: "start",
    borderRadius: "control",
    height: "var(--input-height)",
    minW: "var(--input-height)",
    color: "fg",
    caretColor: "action.primary",
    ...interactiveTransition,
    _placeholder: { color: "fg.placeholder" },
    _hover: { borderColor: "border.emphasized" },
    _focusVisible: {
      borderColor: "action.primary",
      boxShadow: "0 0 0 3px {colors.focus.subtle}",
    },
    _disabled: {
      cursor: "not-allowed",
      opacity: 0.56,
      bg: "bg.emphasized",
    },
    _invalid: {
      borderColor: "status.danger.border",
      boxShadow: "0 0 0 3px {colors.status.danger.subtle}",
    },
  },
  variants: {
    size: {
      "2xs": { textStyle: "xs", px: "2", "--input-height": "sizes.7" },
      xs: { textStyle: "xs", px: "2", "--input-height": "sizes.8" },
      sm: { textStyle: "sm", px: "2.5", "--input-height": "sizes.9" },
      md: { textStyle: "sm", px: "3", "--input-height": "sizes.10" },
      lg: { textStyle: "md", px: "4", "--input-height": "sizes.11" },
      xl: { textStyle: "md", px: "4.5", "--input-height": "sizes.12" },
      "2xl": { textStyle: "lg", px: "5", "--input-height": "sizes.16" },
    },
    variant: {
      outline: { bg: "bg.raised", borderWidth: "1px", borderColor: "border" },
      subtle: {
        borderWidth: "1px",
        borderColor: "transparent",
        bg: "bg.emphasized",
      },
      flushed: {
        bg: "transparent",
        borderBottomWidth: "1px",
        borderBottomColor: "border",
        borderRadius: "0",
        px: "0",
      },
    },
  },
  defaultVariants: { size: "md", variant: "outline" },
});

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: '"Satoshi Variable", sans-serif' },
        heading: { value: '"Satoshi Variable", sans-serif' },
      },
      fontWeights: {
        regular: { value: 400 },
        medium: { value: 500 },
        semibold: { value: 600 },
        bold: { value: 700 },
      },
      radii: {
        detail: { value: "4px" },
        control: { value: "8px" },
        panel: { value: "12px" },
      },
      shadows: {
        xs: { value: "0 1px 2px rgba(68, 63, 63, 0.05)" },
        sm: { value: "0 2px 8px rgba(68, 63, 63, 0.07)" },
        md: { value: "0 10px 28px rgba(68, 63, 63, 0.1)" },
        lg: { value: "0 18px 48px rgba(68, 63, 63, 0.14)" },
      },
      durations: {
        fast: { value: "180ms" },
        moderate: { value: "240ms" },
        slow: { value: "340ms" },
      },
      easings: { out: { value: "cubic-bezier(0.32, 0.72, 0, 1)" } },
      zIndex: {
        base: { value: 0 },
        sticky: { value: 10 },
        mapControl: { value: 20 },
        overlay: { value: 30 },
        modal: { value: 40 },
        toast: { value: 50 },
      },
      colors: {
        brand: {
          orange: { value: "#CF3F02" },
          orangeHover: { value: "#B83800" },
          brown: { value: "#443F3F" },
          bgSubtle: { value: "#F5F3F0" },
          border: { value: "#E8E5E0" },
          textSecondary: { value: "#716B68" },
          success: { value: "#2A7D3F" },
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          value: "{colors.brand.bgSubtle}",
          subtle: { value: "#FCFBF9" },
          raised: { value: "#FFFFFF" },
          emphasized: { value: "#EFEBE6" },
          muted: { value: "#E5E0DA" },
        },
        fg: {
          value: "{colors.brand.brown}",
          muted: { value: "{colors.brand.textSecondary}" },
          subtle: { value: "#8D8682" },
          placeholder: { value: "#938C88" },
          disabled: { value: "#AAA39F" },
        },
        border: {
          value: "{colors.brand.border}",
          emphasized: { value: "#CBC4BD" },
        },
        action: {
          primary: { value: "{colors.brand.orange}" },
          primaryHover: { value: "{colors.brand.orangeHover}" },
          onPrimary: { value: "#FFFFFF" },
        },
        focus: {
          ring: { value: "rgba(207, 63, 2, 0.72)" },
          subtle: { value: "rgba(207, 63, 2, 0.16)" },
        },
        status: {
          success: {
            fg: { value: "#216832" },
            subtle: { value: "#E7F3E9" },
            border: { value: "#B9D8BF" },
          },
          warning: {
            fg: { value: "#76510C" },
            subtle: { value: "#FBF1D8" },
            border: { value: "#E8D095" },
          },
          danger: {
            fg: { value: "#A0322D" },
            hover: { value: "#852A26" },
            subtle: { value: "#FBE9E7" },
            border: { value: "#E8B8B4" },
          },
          info: {
            fg: { value: "#3E5964" },
            subtle: { value: "#E8F0F2" },
            border: { value: "#BCD0D5" },
          },
        },
        map: {
          scrim: { value: "rgba(38, 34, 32, 0.62)" },
          controlBorder: { value: "rgba(68, 63, 63, 0.16)" },
        },
      },
    },
    textStyles: {
      display: {
        value: {
          fontFamily: "heading",
          fontSize: { base: "42px", md: "56px", lg: "64px" },
          fontWeight: "bold",
          lineHeight: "1.02",
          letterSpacing: "-0.04em",
        },
      },
      pageTitle: {
        value: {
          fontFamily: "heading",
          fontSize: { base: "28px", md: "34px" },
          fontWeight: "bold",
          lineHeight: "1.1",
          letterSpacing: "-0.025em",
        },
      },
      sectionTitle: {
        value: {
          fontFamily: "heading",
          fontSize: { base: "20px", md: "22px" },
          fontWeight: "semibold",
          lineHeight: "1.2",
          letterSpacing: "-0.015em",
        },
      },
      cardTitle: {
        value: {
          fontSize: "16px",
          fontWeight: "semibold",
          lineHeight: "1.3",
          letterSpacing: "-0.01em",
        },
      },
      body: { value: { fontSize: "15px", lineHeight: "1.65" } },
      label: {
        value: { fontSize: "13px", fontWeight: "semibold", lineHeight: "1.3" },
      },
      metadata: {
        value: { fontSize: "12px", fontWeight: "medium", lineHeight: "1.4" },
      },
      dataNumber: {
        value: {
          fontSize: { base: "24px", md: "28px" },
          fontWeight: "bold",
          lineHeight: "1",
          fontVariantNumeric: "tabular-nums",
        },
      },
    },
    recipes: { button: buttonRecipe, input: inputRecipe },
  },
});

export const system = createSystem(defaultConfig, config);
