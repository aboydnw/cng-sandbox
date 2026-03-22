import { useState } from "react";
import { Text } from "@chakra-ui/react";
import { BugReportModal } from "./BugReportModal";

interface BugReportLinkProps {
  datasetId?: string;
  storyId?: string;
  datasetIds?: string[];
}

export function BugReportLink({ datasetId, storyId, datasetIds }: BugReportLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Text
        as="button"
        fontSize="xs"
        color="brand.textSecondary"
        cursor="pointer"
        _hover={{ color: "brand.brown" }}
        onClick={() => setOpen(true)}
      >
        This data isn't rendering properly?
      </Text>
      <BugReportModal
        open={open}
        onClose={() => setOpen(false)}
        datasetId={datasetId}
        storyId={storyId}
        datasetIds={datasetIds}
      />
    </>
  );
}
