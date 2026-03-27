import type { Components } from "react-markdown";
import { Link as ChakraLink } from "@chakra-ui/react";

export const storyMarkdownComponents: Components = {
  a: ({ href, children }) => (
    <ChakraLink
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      color="brand.orange"
      textDecoration="underline"
      _hover={{ color: "brand.orangeHover" }}
    >
      {children}
    </ChakraLink>
  ),
};
