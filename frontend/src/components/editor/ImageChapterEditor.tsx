import { useRef, useState } from "react";
import {
  Box,
  Button,
  Field,
  Flex,
  Image as ChakraImage,
  Input,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { UploadSimple } from "@phosphor-icons/react";
import type { ChapterType, ImageChapter } from "../../lib/story";
import { uploadImageAsset } from "../../lib/story";
import { ChapterTypePicker } from "../ChapterTypePicker";

interface ImageChapterEditorProps {
  chapter: ImageChapter;
  onChange: (next: ImageChapter) => void;
  onChapterTypeChange: (type: ChapterType) => void;
}

export function ImageChapterEditor({
  chapter,
  onChange,
  onChapterTypeChange,
}: ImageChapterEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadImageAsset(file);
      onChange({
        ...chapter,
        image: {
          asset_id: uploaded.asset_id,
          url: uploaded.url,
          thumbnail_url: uploaded.thumbnail_url,
          alt_text: chapter.image.alt_text,
          width: uploaded.width,
          height: uploaded.height,
        },
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
    }
  }

  const altMissing = !!chapter.image.url && !chapter.image.alt_text.trim();

  return (
    <Flex direction="column" p={3} gap={4}>
      <ChapterTypePicker value="image" onChange={onChapterTypeChange} />

      <Field.Root>
        <Field.Label>Title</Field.Label>
        <Input
          value={chapter.title}
          onChange={(e) => onChange({ ...chapter, title: e.target.value })}
        />
      </Field.Root>

      <Field.Root>
        <Field.Label>Image</Field.Label>
        {chapter.image.thumbnail_url ? (
          <Flex direction="column" gap={2}>
            <ChakraImage
              src={chapter.image.thumbnail_url}
              alt={chapter.image.alt_text || "preview"}
              maxH="160px"
              borderRadius="6px"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              loading={uploading}
            >
              Replace image
            </Button>
          </Flex>
        ) : (
          <Box
            as="button"
            border="1px dashed"
            borderColor="gray.300"
            borderRadius="6px"
            p={6}
            textAlign="center"
            color="gray.500"
            cursor="pointer"
            _hover={{ borderColor: "brand.orange", color: "brand.orange" }}
            onClick={() => fileRef.current?.click()}
          >
            <Flex align="center" justify="center" gap={2}>
              <UploadSimple size={18} />
              <Text>
                {uploading ? "Uploading…" : "Click to upload an image"}
              </Text>
            </Flex>
          </Box>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {uploadError && (
          <Text color="red.600" fontSize="xs" mt={1}>
            {uploadError}
          </Text>
        )}
      </Field.Root>

      <Field.Root invalid={altMissing} required>
        <Field.Label>Alt text</Field.Label>
        <Input
          value={chapter.image.alt_text}
          placeholder="Describe the image…"
          onChange={(e) =>
            onChange({
              ...chapter,
              image: { ...chapter.image, alt_text: e.target.value },
            })
          }
        />
        <Field.HelperText>
          Describe the image for screen readers and when the image fails to
          load. Required.
        </Field.HelperText>
      </Field.Root>

      <Field.Root>
        <Field.Label>Caption (markdown)</Field.Label>
        <Textarea
          rows={6}
          value={chapter.narrative}
          onChange={(e) => onChange({ ...chapter, narrative: e.target.value })}
        />
      </Field.Root>
    </Flex>
  );
}
