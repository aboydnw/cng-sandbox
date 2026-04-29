import { Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import { useWorkspace } from "../hooks/useWorkspace";

interface HeaderProps {
  children?: ReactNode;
  showWorkspace?: boolean;
}

export function Header({ children, showWorkspace = true }: HeaderProps) {
  const { workspaceId, workspacePath } = useWorkspace();
  const [copied, setCopied] = useState(false);

  const copyWorkspaceUrl = useCallback(() => {
    const url = `${window.location.origin}/w/${workspaceId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [workspaceId]);

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
        <Link
          to={workspacePath("/")}
          style={{ textDecoration: "none", flexShrink: 0 }}
        >
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
        <Link to={workspacePath("/data")} style={{ textDecoration: "none" }}>
          <Text
            fontSize="sm"
            fontWeight={500}
            color="gray.600"
            _hover={{ color: "gray.800" }}
          >
            Data
          </Text>
        </Link>
        <Link to={workspacePath("/stories")} style={{ textDecoration: "none" }}>
          <Text
            fontSize="sm"
            fontWeight={500}
            color="gray.600"
            _hover={{ color: "gray.800" }}
          >
            Stories
          </Text>
        </Link>
        <Link to={workspacePath("/about")} style={{ textDecoration: "none" }}>
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
      {showWorkspace && (
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
          <Text>{copied ? "Copied!" : `Workspace ${workspaceId}`}</Text>
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
