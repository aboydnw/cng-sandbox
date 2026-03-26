import { useState } from "react";
import { Box, Button, Flex, Heading, Text, Textarea } from "@chakra-ui/react";
import { getRecentLogs } from "../lib/consoleCapture";
import { submitBugReport } from "../lib/bugReport";
import type { BugReportPayload } from "../lib/bugReport";

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
  datasetId?: string;
  storyId?: string;
  jobId?: string;
  datasetIds?: string[];
  errorMessage?: string;
}

export function BugReportModal({
  open,
  onClose,
  datasetId,
  storyId,
  jobId,
  datasetIds,
  errorMessage,
}: BugReportModalProps) {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  if (!open) return null;

  const logs = getRecentLogs();

  const handleSubmit = async () => {
    setStatus("submitting");
    const payload: BugReportPayload = {
      description,
      page_url: window.location.pathname,
      dataset_id: datasetId,
      story_id: storyId,
      job_id: jobId,
      dataset_ids: datasetIds,
      error_message: errorMessage,
      console_logs: logs,
    };
    try {
      const result = await submitBugReport(payload);
      setIssueUrl(result.issue_url);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const handleClose = () => {
    setDescription("");
    setStatus("idle");
    setIssueUrl(null);
    onClose();
  };

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      {/* Backdrop */}
      <Box
        position="absolute"
        inset={0}
        bg="blackAlpha.500"
        onClick={handleClose}
      />

      {/* Modal */}
      <Box
        position="relative"
        bg="white"
        borderRadius="md"
        shadow="lg"
        maxW="480px"
        w="90%"
        p={6}
      >
        {status === "success" ? (
          <Box textAlign="center">
            <Heading size="sm" mb={3}>
              Report submitted
            </Heading>
            <Text fontSize="sm" color="gray.600" mb={4}>
              Thank you for helping us improve.
              {issueUrl && (
                <>
                  {" "}
                  <a
                    href={issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#CF3F02", textDecoration: "underline" }}
                  >
                    View issue
                  </a>
                </>
              )}
            </Text>
            <Button size="sm" onClick={handleClose}>
              Close
            </Button>
          </Box>
        ) : (
          <>
            <Heading size="sm" mb={2}>
              Report a rendering issue
            </Heading>
            <Text fontSize="xs" color="gray.500" mb={4}>
              No personal information is shared. Only the details shown below
              are sent.
            </Text>

            <Textarea
              placeholder="Describe what you're seeing (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="sm"
              mb={4}
              rows={3}
            />

            <Box
              fontSize="xs"
              color="gray.600"
              mb={4}
              p={3}
              bg="gray.50"
              borderRadius="sm"
            >
              <Text fontWeight={600} mb={1}>
                What will be sent:
              </Text>
              {datasetId && <Text>Dataset: {datasetId}</Text>}
              {storyId && <Text>Story: {storyId}</Text>}
              {jobId && <Text>Job: {jobId}</Text>}
              {datasetIds && datasetIds.length > 0 && (
                <Text>Datasets: {datasetIds.join(", ")}</Text>
              )}
              {errorMessage && <Text>Error: {errorMessage}</Text>}
              <Text>Page: {window.location.pathname}</Text>
              <Text>Console logs: {logs.length} entries</Text>
              {logs.length > 0 && (
                <Box mt={2}>
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: "11px" }}>
                      Show console logs
                    </summary>
                    <Box
                      mt={1}
                      maxH="120px"
                      overflowY="auto"
                      fontFamily="mono"
                      fontSize="10px"
                      p={2}
                      bg="gray.100"
                      borderRadius="sm"
                    >
                      {logs.map((log, i) => (
                        <Text
                          key={i}
                          color={
                            log.level === "error" ? "red.600" : "orange.600"
                          }
                        >
                          [{log.level}] {log.message}
                        </Text>
                      ))}
                    </Box>
                  </details>
                </Box>
              )}
            </Box>

            {status === "error" && (
              <Text fontSize="sm" color="red.600" mb={3}>
                Unable to submit report. Please try again later.
              </Text>
            )}

            <Flex gap={2} justify="flex-end">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                bg="brand.orange"
                color="white"
                onClick={handleSubmit}
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Submitting..." : "Submit report"}
              </Button>
            </Flex>
          </>
        )}
      </Box>
    </Box>
  );
}
