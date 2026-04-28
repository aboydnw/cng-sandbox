import { useEffect, useState } from "react";
import { Field, Flex, Input, Text, Textarea } from "@chakra-ui/react";
import type { VideoChapter } from "../../lib/story";
import { parseVideoUrl } from "../../lib/story/video";

interface VideoChapterEditorProps {
  chapter: VideoChapter;
  onChange: (next: VideoChapter) => void;
}

export function VideoChapterEditor({
  chapter,
  onChange,
}: VideoChapterEditorProps) {
  const [urlInput, setUrlInput] = useState(chapter.video.original_url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrlInput(chapter.video.original_url);
  }, [chapter.id, chapter.video.original_url]);

  function handleUrlChange(value: string) {
    setUrlInput(value);
    if (!value.trim()) {
      setError(null);
      return;
    }
    const parsed = parseVideoUrl(value.trim());
    if (!parsed) {
      setError("Paste a YouTube or Vimeo URL.");
      return;
    }
    setError(null);
    onChange({
      ...chapter,
      video: {
        provider: parsed.provider,
        video_id: parsed.video_id,
        original_url: value.trim(),
      },
    });
  }

  const validBadge = chapter.video.video_id ? (
    <Text fontSize="xs" color="green.600" mt={1}>
      ✓ {chapter.video.provider}
    </Text>
  ) : null;

  return (
    <Flex direction="column" gap={4} p={3}>
      <Field.Root>
        <Field.Label>Title</Field.Label>
        <Input
          value={chapter.title}
          onChange={(e) => onChange({ ...chapter, title: e.target.value })}
        />
      </Field.Root>

      <Field.Root invalid={!!error}>
        <Field.Label>Video URL</Field.Label>
        <Input
          value={urlInput}
          placeholder="https://youtu.be/… or https://vimeo.com/…"
          onChange={(e) => handleUrlChange(e.target.value)}
        />
        {error ? (
          <Field.ErrorText>{error}</Field.ErrorText>
        ) : (
          validBadge ?? (
            <Field.HelperText>
              Paste a YouTube or Vimeo link.
            </Field.HelperText>
          )
        )}
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
