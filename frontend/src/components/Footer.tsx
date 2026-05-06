import { Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { GithubLogo } from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";

const GITHUB_URL = "https://github.com/aboydnw/cng-sandbox";
const SECURITY_MAILTO = "mailto:security@developmentseed.org";
const DS_URL = "https://developmentseed.org/";

const linkStyle = {
  color: "var(--chakra-colors-brand-textSecondary)",
  fontSize: "var(--chakra-fontSizes-sm)",
  textDecoration: "none",
};

export function Footer() {
  const { workspacePath } = useWorkspace();
  return (
    <Flex
      as="footer"
      align="center"
      justify="space-between"
      px={6}
      py={4}
      bg="white"
      borderTop="1px solid"
      borderColor="brand.border"
      gap={6}
      flexWrap="wrap"
    >
      <Text fontSize="sm" color="brand.textSecondary">
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
        <Link to={workspacePath("/about")} style={linkStyle}>
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
        <a href={SECURITY_MAILTO} style={linkStyle}>
          Security
        </a>
      </Flex>
    </Flex>
  );
}
