import {
  Stack,
  Toaster as ChakraToaster,
  ToastCloseTrigger,
  ToastDescription,
  ToastIndicator,
  ToastRoot,
  ToastTitle,
} from "@chakra-ui/react";
import type { CreateToasterReturn } from "@chakra-ui/react";

interface ToasterProps {
  toaster: CreateToasterReturn;
}

export function Toaster({ toaster }: ToasterProps) {
  return (
    <ChakraToaster toaster={toaster}>
      {(toast) => (
        <ToastRoot key={toast.id} width={{ md: "sm" }}>
          <ToastIndicator />
          <Stack gap="1" flex="1" maxWidth="100%">
            {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
            {toast.description && (
              <ToastDescription>{toast.description}</ToastDescription>
            )}
          </Stack>
          <ToastCloseTrigger />
        </ToastRoot>
      )}
    </ChakraToaster>
  );
}
