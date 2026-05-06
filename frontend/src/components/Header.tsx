import { Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import { useOptionalWorkspace } from "../hooks/useWorkspace";

interface HeaderProps {
  children?: ReactNode;
  showWorkspace?: boolean;
}

export function Header({ children, showWorkspace = true }: HeaderProps) {
  const workspace = useOptionalWorkspace();
  const [copied, setCopied] = useState(false);

  const homeHref = workspace ? workspace.workspacePath("/") : "/";
  const dataHref = workspace ? workspace.workspacePath("/data") : null;
  const storiesHref = workspace ? workspace.workspacePath("/stories") : null;
  const aboutHref = workspace ? workspace.workspacePath("/about") : "/about";

  const copyWorkspaceUrl = useCallback(() => {
    if (!workspace) return;
    const url = `${window.location.origin}/w/${workspace.workspaceId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [workspace]);

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={6}
      py={3}
      bg="white"
      borderBottom="1px solid"
      borderColor="brand.border"
    >
      <Flex align="center" gap={6} flexShrink={0}>
        <Link to={homeHref} style={{ textDecoration: "none", flexShrink: 0 }}>
          <Flex align="center" gap={3} flexShrink={0}>
            <img
              src="/logo.svg"
              alt="Development Seed"
              width={32}
              height={32}
            />
            <Text
              as="span"
              color="brand.brown"
              fontWeight={700}
              fontSize="15px"
              whiteSpace="nowrap"
            >
              CNG Sandbox
            </Text>
          </Flex>
        </Link>
        {dataHref && (
          <Link to={dataHref} style={{ textDecoration: "none" }}>
            <Text
              fontSize="sm"
              fontWeight={500}
              color="brand.brown"
              _hover={{ color: "brand.orange" }}
            >
              Data
            </Text>
          </Link>
        )}
        {storiesHref && (
          <Link to={storiesHref} style={{ textDecoration: "none" }}>
            <Text
              fontSize="sm"
              fontWeight={500}
              color="brand.brown"
              _hover={{ color: "brand.orange" }}
            >
              Stories
            </Text>
          </Link>
        )}
        <Link to={aboutHref} style={{ textDecoration: "none" }}>
          <Text
            fontSize="sm"
            fontWeight={500}
            color="gray.600"
            _hover={{ color: "gray.800" }}
          >
            About
          </Text>
        </Link>
      </Flex>
      {showWorkspace && workspace && (
        <Flex
          align="center"
          gap={1}
          px={2}
          py={1}
          borderRadius="md"
          bg="gray.100"
          cursor="pointer"
          onClick={copyWorkspaceUrl}
          title="Click to copy workspace link"
          fontSize="xs"
          color="gray.500"
        >
          <Text>
            {copied ? "Copied!" : `Workspace ${workspace.workspaceId}`}
          </Text>
        </Flex>
      )}
      {children && (
        <Flex
          gap={2}
          align="center"
          flex="1 1 auto"
          minW={0}
          justify="flex-end"
          ml={6}
        >
          {children}
        </Flex>
      )}
    </Flex>
  );
}
