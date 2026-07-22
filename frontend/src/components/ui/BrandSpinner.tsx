import { SpinnerGap } from "@phosphor-icons/react";

interface BrandSpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

export function BrandSpinner({
  size = 16,
  label = "Loading",
  className,
}: BrandSpinnerProps) {
  return (
    <SpinnerGap
      size={size}
      color="var(--chakra-colors-brand-orange)"
      className={className}
      aria-label={label}
      role="status"
      style={{
        animation: "spin 1s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
