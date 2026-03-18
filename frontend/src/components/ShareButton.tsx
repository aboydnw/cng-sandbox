import { useState, useCallback } from "react";
import { Button } from "@chakra-ui/react";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <Button
      bg="brand.orange"
      color="white"
      size="sm"
      fontWeight={600}
      borderRadius="4px"
      _hover={{ bg: "brand.orangeHover" }}
      onClick={handleCopy}
    >
      {copied ? "Copied!" : "🔗 Share"}
    </Button>
  );
}
