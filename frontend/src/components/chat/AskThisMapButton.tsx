import { IconButton } from "@chakra-ui/react";
import { ChatCircleDots } from "@phosphor-icons/react";

interface AskThisMapButtonProps {
  onClick: () => void;
}

export function AskThisMapButton({ onClick }: AskThisMapButtonProps) {
  return (
    <IconButton
      aria-label="Ask this map"
      onClick={onClick}
      position="fixed"
      bottom={6}
      right={6}
      zIndex={1100}
      rounded="full"
      size="lg"
      bg="brand.orange"
      color="white"
      shadow="lg"
      _hover={{ bg: "brand.brown" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "brand.border" }}
    >
      <ChatCircleDots size={24} weight="fill" />
    </IconButton>
  );
}
