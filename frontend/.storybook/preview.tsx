import type { Preview } from "@storybook/react-vite";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { system } from "../src/theme";
import "../src/styles.css";

const preview: Preview = {
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ChakraProvider value={system}>
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </ChakraProvider>
    ),
  ],
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
    options: {
      storySort: {
        order: ["Foundations", "Components", "Patterns"],
      },
    },
  },
};

export default preview;
