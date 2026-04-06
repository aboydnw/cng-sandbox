import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Box, Flex, Text } from "@chakra-ui/react";
import { CaretDown } from "@phosphor-icons/react";
import { COLORMAPS, colormapGradient } from "../lib/maptool/colormaps";
import { transition } from "../lib/interactionStyles";

interface ColormapDropdownProps {
  value: string;
  onChange: (colormap: string) => void;
}

export function ColormapDropdown({ value, onChange }: ColormapDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const normalizedValue = value.toLowerCase();
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 280;
    const wouldGoOffScreenBelow =
      rect.bottom + 4 + dropdownHeight > window.innerHeight;
    if (wouldGoOffScreenBelow) {
      setDropdownStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 1000,
      });
    } else {
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 1000,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <Box ref={containerRef}>
      <Flex
        as="button"
        role="button"
        onClick={() => setIsOpen((o) => !o)}
        align="center"
        gap={2}
        w="100%"
        px={3}
        py={2}
        bg="white"
        border="1px solid"
        borderColor={isOpen ? "brand.orange" : "brand.border"}
        borderRadius="md"
        cursor="pointer"
        style={{ transition: transition() }}
      >
        <Box
          w="48px"
          h="10px"
          borderRadius="2px"
          bg={colormapGradient(normalizedValue)}
          flexShrink={0}
        />
        <Text fontSize="sm" fontWeight={500} flex={1} textAlign="left">
          {normalizedValue}
        </Text>
        <CaretDown
          size={14}
          style={{
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </Flex>

      {isOpen &&
        createPortal(
          <Box
            ref={dropdownRef}
            style={dropdownStyle}
            bg="white"
            border="1px solid"
            borderColor="brand.border"
            borderRadius="md"
            maxH="280px"
            overflowY="auto"
            py={1}
            boxShadow="lg"
          >
            {Object.keys(COLORMAPS).map((name) => (
              <Flex
                key={name}
                as="button"
                onClick={() => {
                  onChange(name);
                  setIsOpen(false);
                }}
                align="center"
                gap={2}
                w="100%"
                px={3}
                py={1.5}
                bg={normalizedValue === name ? "brand.bgSubtle" : "transparent"}
                _hover={{ bg: "brand.bgSubtle" }}
                cursor="pointer"
              >
                <Box
                  w="48px"
                  h="10px"
                  borderRadius="2px"
                  bg={colormapGradient(name)}
                  flexShrink={0}
                />
                <Text fontSize="sm">{name}</Text>
              </Flex>
            ))}
          </Box>,
          document.body
        )}
    </Box>
  );
}
