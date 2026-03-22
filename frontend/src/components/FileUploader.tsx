import { useState, useRef, useCallback } from "react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";

const ALLOWED_EXTENSIONS = [".tif", ".tiff", ".zip", ".geojson", ".json", ".nc", ".h5", ".hdf5"];
const RASTER_EXTENSIONS = [".tif", ".tiff", ".nc", ".h5", ".hdf5"];

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  onFilesSelected: (files: File[]) => void;
  onUrlSubmitted: (url: string) => void;
  disabled?: boolean;
  embedded?: boolean;
}

const extractFilesFromEntry = async (entry: FileSystemEntry): Promise<File[]> => {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file((f) => resolve([f]));
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries: FileSystemEntry[] = await new Promise((resolve) =>
      reader.readEntries((e) => resolve(e)),
    );
    const nested = await Promise.all(entries.map(extractFilesFromEntry));
    return nested.flat();
  }
  return [];
};

function getExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf(".")).toLowerCase();
}

export function FileUploader({
  onFileSelected,
  onFilesSelected,
  onUrlSubmitted,
  disabled,
  embedded,
}: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const ext = getExtension(file.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`Unsupported format: ${ext}`);
        return;
      }
      setError(null);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const items = Array.from(e.dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null);

      if (entries.length > 0) {
        const allFiles = (await Promise.all(entries.map(extractFilesFromEntry))).flat();
        const rasterFiles = allFiles.filter((f) =>
          RASTER_EXTENSIONS.includes(getExtension(f.name)),
        );
        if (rasterFiles.length > 1) {
          setError(null);
          onFilesSelected(rasterFiles);
          return;
        }
        if (allFiles.length > 0) handleFile(allFiles[0]);
        return;
      }

      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, onFilesSelected],
  );

  const handleUrlSubmit = useCallback(() => {
    if (url.trim()) {
      setError(null);
      onUrlSubmitted(url.trim());
    }
  }, [url, onUrlSubmitted]);

  return (
    <Flex direction="column" align="center" py={embedded ? 0 : 16} px={embedded ? 0 : 8}>
      {!embedded && (
        <>
          <Text color="brand.brown" fontSize="22px" fontWeight={700} mb={1}>
            See your data on the web
          </Text>
          <Text color="brand.textSecondary" fontSize="14px" mb={9}>
            Upload a geospatial file and get a shareable map in minutes
          </Text>
        </>
      )}

      <Box
        border="2px dashed"
        borderColor={dragOver ? "brand.orange" : "#ccc"}
        borderRadius="12px"
        p={14}
        textAlign="center"
        w="100%"
        maxW={embedded ? "100%" : "480px"}
        bg={dragOver ? "orange.50" : "brand.bgSubtle"}
        cursor="pointer"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        opacity={disabled ? 0.5 : 1}
        pointerEvents={disabled ? "none" : "auto"}
      >
        <Text fontSize="40px" mb={4} opacity={0.5}>
          🗺
        </Text>
        <Text color="brand.brown" fontSize="16px" fontWeight={600} mb={2}>
          Drop your file here
        </Text>
        <Text color="brand.textSecondary" fontSize="13px" mb={5}>
          GeoTIFF · Shapefile (.zip) · GeoJSON · NetCDF · HDF5
        </Text>
        <Button
          bg="brand.orange"
          color="white"
          size="sm"
          fontWeight={600}
          borderRadius="4px"
          _hover={{ bg: "brand.orangeHover" }}
        >
          Browse files
        </Button>
        <Text color="#aaa" fontSize="12px" mt={4}>
          Up to 15 GB
        </Text>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length === 0) return;
            const rasterFiles = files.filter((f) =>
              RASTER_EXTENSIONS.includes(getExtension(f.name)),
            );
            if (rasterFiles.length > 1) {
              setError(null);
              onFilesSelected(rasterFiles);
            } else {
              handleFile(files[0]);
            }
            e.target.value = "";
          }}
        />
      </Box>

      {error && (
        <Text color="red.500" fontSize="13px" mt={3}>
          {error}
        </Text>
      )}

      <Flex align="center" gap={4} w="100%" maxW={embedded ? "100%" : "480px"} mt={6}>
        <Box flex={1} h="1px" bg="brand.border" />
        <Text color="#aaa" fontSize="12px" textTransform="uppercase" letterSpacing="1px">
          or
        </Text>
        <Box flex={1} h="1px" bg="brand.border" />
      </Flex>

      <Flex gap={2} mt={5} w="100%" maxW={embedded ? "100%" : "480px"}>
        <Input
          flex={1}
          placeholder="Paste an S3, GCS, or HTTP URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
          size="md"
          borderColor="#ddd"
          disabled={disabled}
        />
        <Button
          bg="brand.brown"
          color="white"
          size="md"
          fontWeight={600}
          borderRadius="4px"
          onClick={handleUrlSubmit}
          disabled={disabled || !url.trim()}
        >
          Fetch
        </Button>
      </Flex>
    </Flex>
  );
}
