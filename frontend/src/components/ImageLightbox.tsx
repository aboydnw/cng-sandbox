import { useEffect } from "react";
import { Box, IconButton, Portal } from "@chakra-ui/react";
import { X } from "@phosphor-icons/react";

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <Portal>
      <Box
        data-testid="image-lightbox-backdrop"
        position="fixed"
        inset={0}
        bg="blackAlpha.800"
        zIndex={1000}
        display="flex"
        alignItems="center"
        justifyContent="center"
        onClick={onClose}
      >
        <IconButton
          aria-label="Close"
          variant="ghost"
          color="white"
          position="absolute"
          top={4}
          right={4}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          _hover={{ bg: "brand.bgSubtle", color: "brand.orange" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "brand.border",
          }}
        >
          <X size={24} />
        </IconButton>
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxHeight: "90vh",
            maxWidth: "90vw",
            objectFit: "contain",
          }}
        />
      </Box>
    </Portal>
  );
}
