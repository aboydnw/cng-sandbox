import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { X as XIcon, SpinnerGap } from "@phosphor-icons/react";
import { getProduct, type SourceCoopProduct } from "../lib/sourceCoopCatalog";
import { connectSourceCoop } from "../lib/sourceCoopApi";
import { useWorkspace } from "../hooks/useWorkspace";

interface SourceCoopConnectModalProps {
  slug: string | null;
  workspaceId: string;
  onClose: () => void;
}

export function SourceCoopConnectModal({
  slug,
  workspaceId,
  onClose,
}: SourceCoopConnectModalProps) {
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!slug) return null;

  let product: SourceCoopProduct;
  try {
    product = getProduct(slug);
  } catch {
    return null;
  }

  async function handleConfirm() {
    if (!slug) return;
    setError(null);
    setConnecting(true);
    try {
      const { dataset_id } = await connectSourceCoop(slug, workspaceId);
      navigate(workspacePath(`/map/${dataset_id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.500"
        onClick={connecting ? undefined : onClose}
      />

      <Box
        position="relative"
        bg="white"
        borderRadius="12px"
        shadow="xl"
        w="480px"
        maxW="90vw"
        p={6}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="md">Connect this dataset to your workspace?</Heading>
          <button
            type="button"
            onClick={onClose}
            disabled={connecting}
            aria-label="Close"
            style={{
              padding: "4px",
              cursor: connecting ? "not-allowed" : "pointer",
              background: "transparent",
              border: "none",
            }}
          >
            <XIcon size={18} />
          </button>
        </Flex>

        <Flex direction="column" gap={3}>
          <Text fontWeight={700} fontSize="15px">
            {product.name}
          </Text>
          <Text fontSize="13px" color="brand.brown">
            {product.description}
          </Text>
          <Text fontSize="12px" color="brand.textSecondary">
            We&rsquo;ll register this as a reference in your workspace &mdash;
            no files are copied. This can take up to a minute.
          </Text>

          {error && (
            <Text fontSize="13px" color="red.500">
              {error}
            </Text>
          )}

          <Flex justify="flex-end" gap={2} mt={2}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClose}
              disabled={connecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              bg="brand.orange"
              color="white"
              _hover={{ bg: "brand.orangeHover" }}
              onClick={handleConfirm}
              disabled={connecting}
            >
              {connecting ? (
                <Flex align="center" gap={2}>
                  <SpinnerGap
                    size={16}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  <Text as="span">Connecting&hellip;</Text>
                </Flex>
              ) : (
                "Connect"
              )}
            </Button>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}
