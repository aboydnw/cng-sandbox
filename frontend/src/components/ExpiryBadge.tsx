import { Flex, Text } from "@chakra-ui/react";
import { Clock } from "@phosphor-icons/react";

interface ExpiryBadgeProps {
  expiresAt: string;
}

export function ExpiryBadge({ expiresAt }: ExpiryBadgeProps) {
  const daysLeft = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / 86400000
  );
  const isUrgent = daysLeft <= 3;
  const label = daysLeft <= 0 ? "Expires today" : `Expires in ${daysLeft}d`;

  return (
    <Flex
      display="inline-flex"
      align="center"
      gap={1}
      px={2}
      py={0.5}
      borderRadius="full"
      fontSize="11px"
      fontWeight={500}
      bg={isUrgent ? "red.50" : "orange.50"}
      color={isUrgent ? "red.600" : "orange.600"}
    >
      <Clock size={11} />
      <Text>{label}</Text>
    </Flex>
  );
}
