import { Box, Flex, Menu, Portal, Text } from "@chakra-ui/react";
import { Link, NavLink, useNavigate } from "react-router-dom";
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
    <>
      <Box
        asChild
        position="fixed"
        top={2}
        left={2}
        zIndex="modal"
        px={4}
        py={2}
        bg="bg.raised"
        color="fg"
        borderRadius="control"
        boxShadow="md"
        transform="translateY(-160%)"
        _focus={{ transform: "translateY(0)" }}
      >
        <a href="#main-content">Skip to main content</a>
      </Box>
      <Flex
        as="header"
        align="center"
        justify="space-between"
        px={{ base: 3, md: 6 }}
        py={2.5}
        minH="60px"
        bg="bg.raised"
        borderBottom="1px solid"
        borderColor="border"
        gap={{ base: 2, md: 5 }}
      >
        <Flex align="center" gap={{ base: 2, md: 6 }} minW={0}>
          <Link to={homeHref} style={{ textDecoration: "none", flexShrink: 0 }}>
            <Flex align="center" gap={2.5} flexShrink={0}>
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
                display={{ base: "none", sm: "block" }}
              >
                CNG Sandbox
              </Text>
            </Flex>
          </Link>
          <Flex
            as="nav"
            aria-label="Primary navigation"
            align="stretch"
            gap={1}
          >
            {storiesHref && <NavItem to={storiesHref}>Stories</NavItem>}
            {dataHref && <NavItem to={dataHref}>Data</NavItem>}
            <NavItem to={aboutHref}>About</NavItem>
          </Flex>
        </Flex>
        <Flex align="center" gap={2} minW={0}>
          {children && (
            <Flex gap={2} align="center" minW={0} justify="flex-end">
              {children}
            </Flex>
          )}
          {showWorkspace && workspace && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <Flex
                  align="center"
                  gap={1}
                  px={{ base: 2, md: 3 }}
                  py={1.5}
                  borderRadius="control"
                  bg="bg.emphasized"
                  cursor="pointer"
                  fontSize="xs"
                  color="fg.muted"
                  _hover={{ bg: "bg.muted", color: "fg" }}
                  aria-label="Workspace menu"
                >
                  <Text>{copied ? "Copied!" : "Workspace"}</Text>
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
                    <Text px={3} pt={2} pb={1} fontSize="xs" color="fg.subtle">
                      ID:{" "}
                      <Text as="span" fontFamily="mono">
                        {workspace.workspaceId}
                      </Text>
                    </Text>
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
        </Flex>
      </Flex>
    </>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Box
      asChild
      display="inline-flex"
      alignItems="center"
      minH={9}
      px={2.5}
      borderRadius="control"
      color="fg.muted"
      fontSize="sm"
      fontWeight={500}
      textDecoration="none"
      _hover={{ bg: "bg.subtle", color: "fg" }}
      css={{
        '&[aria-current="page"]': {
          color: "brand.brown",
          background: "bg.emphasized",
          boxShadow: "inset 0 -2px 0 token(colors.action.primary)",
          fontWeight: 600,
        },
      }}
    >
      <NavLink to={to}>{children}</NavLink>
    </Box>
  );
}
