import type { ReactNode } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import {
  CheckCircle,
  Info,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";

export type StatePanelTone =
  "neutral" | "info" | "success" | "warning" | "danger";

interface StatePanelProps {
  title: string;
  description?: ReactNode;
  tone?: StatePanelTone;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}

const toneStyles: Record<
  StatePanelTone,
  { bg: string; border: string; color: string; icon: ReactNode }
> = {
  neutral: {
    bg: "bg.subtle",
    border: "border",
    color: "fg.muted",
    icon: <Info size={20} weight="duotone" />,
  },
  info: {
    bg: "status.info.subtle",
    border: "status.info.border",
    color: "status.info.fg",
    icon: <Info size={20} weight="duotone" />,
  },
  success: {
    bg: "status.success.subtle",
    border: "status.success.border",
    color: "status.success.fg",
    icon: <CheckCircle size={20} weight="duotone" />,
  },
  warning: {
    bg: "status.warning.subtle",
    border: "status.warning.border",
    color: "status.warning.fg",
    icon: <Warning size={20} weight="duotone" />,
  },
  danger: {
    bg: "status.danger.subtle",
    border: "status.danger.border",
    color: "status.danger.fg",
    icon: <WarningCircle size={20} weight="duotone" />,
  },
};

export function StatePanel({
  title,
  description,
  tone = "neutral",
  actionLabel,
  onAction,
  action,
  icon,
  compact = false,
}: StatePanelProps) {
  const style = toneStyles[tone];

  return (
    <Flex
      role={tone === "danger" ? "alert" : "status"}
      align="flex-start"
      gap={compact ? 2.5 : 3}
      p={compact ? 3 : 5}
      bg={style.bg}
      border="1px solid"
      borderColor={style.border}
      borderRadius="panel"
      color={style.color}
    >
      <Box flexShrink={0} mt="1px" aria-hidden="true">
        {icon ?? style.icon}
      </Box>
      <Box flex="1" minW={0}>
        <Text textStyle={compact ? "label" : "cardTitle"} color="inherit">
          {title}
        </Text>
        {description && (
          <Text
            mt={1}
            fontSize={compact ? "13px" : "14px"}
            lineHeight="1.55"
            color="inherit"
          >
            {description}
          </Text>
        )}
        {action ? (
          <Box mt={compact ? 2.5 : 3}>{action}</Box>
        ) : actionLabel && onAction ? (
          <Button
            mt={compact ? 2.5 : 3}
            size="sm"
            variant="outline"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : null}
      </Box>
    </Flex>
  );
}
