import { Flex, Text } from "@chakra-ui/react";
import { ClockCountdown } from "@phosphor-icons/react";
import { daysUntilExpiry, expiryLabel } from "../utils/format";

interface ExpiryBadgeProps {
  expiresAt: string;
}

export function ExpiryBadge({ expiresAt }: ExpiryBadgeProps) {
  const daysLeft = daysUntilExpiry(expiresAt);
  const isUrgent = daysLeft < 3;

  return (
    <Flex
      display="inline-flex"
      align="center"
      gap={1}
      fontSize="xs"
      fontWeight={isUrgent ? 600 : 500}
      color={isUrgent ? "brand.orange" : "brand.textSecondary"}
      title={`Expires on ${new Date(expiresAt).toLocaleDateString()}`}
    >
      <ClockCountdown size={12} />
      <Text>{expiryLabel(daysLeft)}</Text>
    </Flex>
  );
}
