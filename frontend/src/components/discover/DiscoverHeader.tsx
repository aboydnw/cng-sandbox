import { Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../hooks/useWorkspace";

const BORDER = "#e8e6e1";
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#6b6b68";

export function DiscoverHeader() {
  const { workspacePath } = useWorkspace();

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={6}
      py={3}
      bg="white"
      borderBottom="1px solid"
      borderColor={BORDER}
    >
      <Flex align="center" gap={8}>
        <Link
          to={workspacePath("/discover")}
          style={{ textDecoration: "none" }}
        >
          <Flex align="center" gap={2}>
            <Text
              fontSize="18px"
              fontWeight={700}
              color={TEXT}
              letterSpacing="-0.02em"
              fontFamily="Georgia, serif"
            >
              source
              <Text as="span" color="#c44a2a">
                .
              </Text>
              coop
            </Text>
            <Text
              fontSize="11px"
              color={TEXT_MUTED}
              fontFamily="SFMono-Regular, Consolas, monospace"
              ml={2}
              pl={2}
              borderLeft="1px solid"
              borderColor={BORDER}
            >
              × CNG Sandbox
            </Text>
          </Flex>
        </Link>
        <Flex gap={6}>
          <Link
            to={workspacePath("/discover")}
            style={{ textDecoration: "none" }}
          >
            <Text fontSize="14px" color={TEXT} _hover={{ color: "#c44a2a" }}>
              Discover
            </Text>
          </Link>
          <Link to={workspacePath("/")} style={{ textDecoration: "none" }}>
            <Text fontSize="14px" color={TEXT_MUTED} _hover={{ color: TEXT }}>
              Contribute
            </Text>
          </Link>
          <Link
            to={workspacePath("/library")}
            style={{ textDecoration: "none" }}
          >
            <Text fontSize="14px" color={TEXT_MUTED} _hover={{ color: TEXT }}>
              Your workspace
            </Text>
          </Link>
        </Flex>
      </Flex>
      <Text
        fontSize="11px"
        color={TEXT_MUTED}
        fontFamily="SFMono-Regular, Consolas, monospace"
      >
        demo
      </Text>
    </Flex>
  );
}
