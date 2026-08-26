import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { EarthStoriesCta } from "../EarthStoriesCta";

it("links safely to the Earth Stories repository", () => {
  render(
    <ChakraProvider value={system}>
      <EarthStoriesCta />
    </ChakraProvider>
  );

  expect(
    screen.getByText("Build a story with Earth Stories")
  ).toBeInTheDocument();
  expect(
    screen.getByText(/maps, text, charts, images, and video/i)
  ).toBeInTheDocument();
  const link = screen.getByRole("link", {
    name: /explore earth stories on github/i,
  });
  expect(link).toHaveAttribute(
    "href",
    "https://github.com/aboydnw/earth-stories"
  );
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
