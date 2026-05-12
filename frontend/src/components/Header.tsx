import { Flex, Menu, Portal, Text } from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useState, useCallback, useEffect } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import {
  useOptionalWorkspace,
  WORKSPACE_STORAGE_KEY,
} from "../hooks/useWorkspace";

interface HeaderProps {
  children?: ReactNode;
  showWorkspace?: boolean;
}

export function Header({ children, showWorkspace = true }: HeaderProps) {
  const workspace = useOptionalWorkspace();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setIsPrimary(
      localStorage.getItem(WORKSPACE_STORAGE_KEY) === workspace.workspaceId
    );
  }, [workspace]);

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

  const makePrimary = useCallback(() => {
    if (!workspace) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.workspaceId);
    setIsPrimary(true);
  }, [workspace]);

  const changeWorkspaces = useCallback(() => {
    navigate("/?switch=1");
  }, [navigate]);

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
      <Flex align="center" gap={4} ml="auto" mr={3}>
        <a
          href="https://github.com/aboydnw/cng-sandbox"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          <Text
            fontSize="sm"
            fontWeight={500}
            color="gray.600"
            _hover={{ color: "gray.800" }}
          >
            GitHub
          </Text>
        </a>
        <a
          href="mailto:info@developmentseed.org"
          style={{ textDecoration: "none" }}
        >
          <Text
            fontSize="sm"
            fontWeight={500}
            color="gray.600"
            _hover={{ color: "gray.800" }}
          >
            Contact
          </Text>
        </a>
      </Flex>
      {showWorkspace && workspace && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Flex
              align="center"
              gap={1}
              px={2}
              py={1}
              borderRadius="md"
              bg="gray.100"
              cursor="pointer"
              fontSize="xs"
              color="gray.500"
              _hover={{ bg: "gray.200" }}
              aria-label="Workspace menu"
            >
              <Text>
                {copied ? "Copied!" : `Workspace ${workspace.workspaceId}`}
              </Text>
              <CaretDown size={10} />
            </Flex>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content
                bg="white"
                border="1px solid"
                borderColor="brand.border"
                borderRadius="8px"
                boxShadow="md"
                py={1}
                minW="220px"
                fontSize="sm"
              >
                <Menu.Item
                  value="copy-link"
                  onClick={copyWorkspaceUrl}
                  px={3}
                  py={2}
                  cursor="pointer"
                  _hover={{ bg: "brand.bgSubtle" }}
                >
                  Copy workspace link
                </Menu.Item>
                {!isPrimary && (
                  <Menu.Item
                    value="make-primary"
                    onClick={makePrimary}
                    px={3}
                    py={2}
                    cursor="pointer"
                    _hover={{ bg: "brand.bgSubtle" }}
                  >
                    Make this my primary workspace
                  </Menu.Item>
                )}
                {isPrimary && (
                  <Menu.Item
                    value="is-primary"
                    disabled
                    px={3}
                    py={2}
                    color="gray.500"
                  >
                    <Flex align="center" gap={2}>
                      <Check size={14} weight="bold" />
                      <Text>Primary workspace</Text>
                    </Flex>
                  </Menu.Item>
                )}
                <Menu.Separator borderColor="brand.border" my={1} />
                <Menu.Item
                  value="change-workspace"
                  onClick={changeWorkspaces}
                  px={3}
                  py={2}
                  cursor="pointer"
                  _hover={{ bg: "brand.bgSubtle" }}
                >
                  Change workspaces
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
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
