import { SpinnerGap } from "@phosphor-icons/react";

interface BrandSpinnerProps {
  size?: number;
  label?: string;
  className?: string;
  decorative?: boolean;
}

export function BrandSpinner({
  size = 16,
  label = "Loading",
  className,
  decorative = false,
}: BrandSpinnerProps) {
  return (
    <SpinnerGap
      size={size}
      color="var(--chakra-colors-brand-orange)"
      className={className}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "status"}
      style={{
        animation: "spin 1s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
