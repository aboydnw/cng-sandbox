import { useEffect, useState } from "react";
import { Field, Flex, Input, Text, Textarea } from "@chakra-ui/react";
import { Check } from "@phosphor-icons/react";
import type { ChapterType, VideoChapter } from "../../lib/story";
import { parseVideoUrl } from "../../lib/story/video";
import { ChapterTypePicker } from "../ChapterTypePicker";

interface VideoChapterEditorProps {
  chapter: VideoChapter;
  onChange: (next: VideoChapter) => void;
  onChapterTypeChange: (type: ChapterType) => void;
}

export function VideoChapterEditor({
  chapter,
  onChange,
  onChapterTypeChange,
}: VideoChapterEditorProps) {
  const [urlInput, setUrlInput] = useState(chapter.video.original_url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrlInput(chapter.video.original_url);
  }, [chapter.id, chapter.video.original_url]);

  function handleUrlChange(value: string) {
    setUrlInput(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setError(null);
      onChange({
        ...chapter,
        video: { provider: "youtube", video_id: "", original_url: "" },
      });
      return;
    }
    const parsed = parseVideoUrl(trimmed);
    if (!parsed) {
      setError("Paste a YouTube or Vimeo URL.");
      onChange({
        ...chapter,
        video: { provider: chapter.video.provider, video_id: "", original_url: trimmed },
      });
      return;
    }
    setError(null);
    onChange({
      ...chapter,
      video: {
        provider: parsed.provider,
        video_id: parsed.video_id,
        original_url: trimmed,
      },
    });
  }

  const validBadge = chapter.video.video_id ? (
    <Flex align="center" gap={1} fontSize="xs" color="green.600" mt={1}>
      <Check size={12} weight="bold" />
      <Text as="span">{chapter.video.provider}</Text>
    </Flex>
  ) : null;

  return (
    <Flex direction="column" gap={4} p={3}>
      <ChapterTypePicker value="video" onChange={onChapterTypeChange} />
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
