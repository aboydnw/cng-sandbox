import { Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { GithubLogo } from "@phosphor-icons/react";
import { useOptionalWorkspace } from "../hooks/useWorkspace";

const GITHUB_URL = "https://github.com/aboydnw/cng-sandbox";
const CONTACT_URL = "https://developmentseed.org/contact/";
const DS_URL = "https://developmentseed.org/";

const linkStyle = {
  color: "var(--chakra-colors-brand-textSecondary)",
  fontSize: "var(--chakra-fontSizes-sm)",
  textDecoration: "none",
};

export function Footer() {
  const workspace = useOptionalWorkspace();
  const aboutHref = workspace ? workspace.workspacePath("/about") : "/about";
  return (
    <Flex
      as="footer"
      mt="auto"
      bg="bg.raised"
      borderTop="1px solid"
      borderColor="border"
    >
      <Flex
        align="center"
        justify="space-between"
        px={{ base: 4, md: 6 }}
        py={4}
        maxW="1200px"
        mx="auto"
        w="100%"
        gap={6}
        flexWrap="wrap"
      >
        <Text fontSize="sm" color="fg.muted">
          Built by{" "}
          <a
            href={DS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--chakra-colors-brand-orange)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Development Seed
          </a>
        </Text>
        <Flex align="center" gap={5}>
          <Link to={aboutHref} style={linkStyle}>
            About
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...linkStyle,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            aria-label="GitHub repository"
          >
            <GithubLogo size={16} weight="duotone" />
            GitHub
          </a>
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Contact Us
          </a>
        </Flex>
      </Flex>
    </Flex>
  );
}
