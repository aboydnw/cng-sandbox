import { useState } from "react";
import { Box, Button, Flex, IconButton, Text } from "@chakra-ui/react";
import {
  AirplaneLanding,
  ArrowsClockwise,
  CrosshairSimple,
  DotsSixVertical,
  Eye,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import type { CameraState } from "../../lib/layers/types";
import { interpolateFlyover } from "../../lib/story/flyover/interpolate";
import {
  orbitKeyframes,
  approachKeyframes,
  zoomGapWarnings,
} from "../../lib/story/flyover/generators";
import {
  addKeyframe,
  captureKeyframe,
  moveKeyframe,
  recaptureKeyframe,
  removeKeyframe,
  setKeyframeCaption,
} from "../../lib/story/flyover/keyframes";
import type { FlyoverChapter } from "../../lib/story/types";
import type { CameraPose } from "../../lib/story/flyover/types";

const SECTION_HEADER = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  color: "gray.500",
  fontWeight: 600,
};

export function FlyoverKeyframePanel({
  chapter,
  onChange,
  currentCamera,
  onPreviewPose,
}: {
  chapter: FlyoverChapter;
  onChange: (next: FlyoverChapter) => void;
  currentCamera: CameraState;
  onPreviewPose: (pose: CameraPose, animate?: boolean) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const keyframes = chapter.keyframes;

  const update = (next: typeof keyframes) =>
    onChange({ ...chapter, keyframes: next });

  function handleDrop(target: number) {
    if (dragIndex === null) return;
    update(moveKeyframe(keyframes, dragIndex, target));
    setDragIndex(null);
  }

  function handlePreview(value: number) {
    const pose = interpolateFlyover(keyframes, value / 1000);
    if (pose) onPreviewPose(pose, false);
  }

  return (
    <Box>
      <Text {...SECTION_HEADER} mb={2}>
        Flyover path
      </Text>

      <Button
        w="100%"
        size="sm"
        bg="brand.orange"
        color="white"
        _hover={{ bg: "brand.brown" }}
        mb={3}
        onClick={() =>
          update(addKeyframe(keyframes, captureKeyframe(currentCamera)))
        }
      >
        <CrosshairSimple size={16} weight="bold" />
        Add keyframe from current view
      </Button>

      <Flex gap={2} mb={3}>
        <Button
          flex={1}
          size="xs"
          variant="outline"
          color="brand.brown"
          borderColor="brand.border"
          onClick={() =>
            update([
              ...keyframes,
              ...orbitKeyframes(captureKeyframe(currentCamera)),
            ])
          }
        >
          <ArrowsClockwise size={14} />
          Orbit
        </Button>
        <Button
          flex={1}
          size="xs"
          variant="outline"
          color="brand.brown"
          borderColor="brand.border"
          onClick={() =>
            update([
              ...keyframes,
              ...approachKeyframes(captureKeyframe(currentCamera)),
            ])
          }
        >
          <AirplaneLanding size={14} />
          Approach
        </Button>
      </Flex>

      {keyframes.map((k, i) => (
        <Flex
          key={i}
          align="center"
          gap={1}
          mb={1}
          p={2}
          borderRadius="6px"
          border="1px solid"
          borderColor="brand.border"
          bg="white"
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(i)}
        >
          <Box as="span" color="gray.400" cursor="grab" aria-hidden>
            <DotsSixVertical size={16} />
          </Box>
          <Flex
            align="center"
            justify="center"
            w="20px"
            h="20px"
            borderRadius="full"
            bg="brand.bgSubtle"
            color="brand.brown"
            fontSize="11px"
            fontWeight={700}
            flexShrink={0}
          >
            {i + 1}
          </Flex>
          <Box flex={1} minW={0}>
            <Text fontSize="11px" color="gray.600" mb={1}>
              {`z${k.zoom.toFixed(1)} · ${Math.round(k.pitch)}° pitch · ${Math.round(
                k.bearing
              )}° brg`}
            </Text>
            <input
              aria-label="Keyframe caption"
              value={k.caption ?? ""}
              placeholder="Caption (optional)"
              onChange={(e) =>
                update(setKeyframeCaption(keyframes, i, e.target.value))
              }
              style={{
                width: "100%",
                fontSize: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "4px",
                padding: "2px 6px",
              }}
            />
          </Box>
          <IconButton
            aria-label="Jump to keyframe"
            size="xs"
            variant="ghost"
            color="brand.brown"
            onClick={() =>
              onPreviewPose(
                {
                  center: k.center,
                  zoom: k.zoom,
                  bearing: k.bearing,
                  pitch: k.pitch,
                },
                true
              )
            }
          >
            <Eye size={14} />
          </IconButton>
          <IconButton
            aria-label="Re-capture keyframe"
            size="xs"
            variant="ghost"
            color="brand.brown"
            onClick={() =>
              update(recaptureKeyframe(keyframes, i, currentCamera))
            }
          >
            <ArrowsClockwise size={14} />
          </IconButton>
          <IconButton
            aria-label="Delete keyframe"
            size="xs"
            variant="ghost"
            color="brand.brown"
            onClick={() => update(removeKeyframe(keyframes, i))}
          >
            <Trash size={14} />
          </IconButton>
        </Flex>
      ))}

      {zoomGapWarnings(keyframes).map((i) => (
        <Flex key={i} align="flex-start" gap={1.5} mt={2} color="brand.brown">
          <Box as="span" mt="2px" flexShrink={0}>
            <Warning size={14} />
          </Box>
          <Text fontSize="xs">
            Big zoom jump between keyframes {i + 1}→{i + 2} — tiles may pop in
            during the flight. Consider an in-between keyframe.
          </Text>
        </Flex>
      ))}

      {keyframes.length < 2 && (
        <Text fontSize="xs" color="gray.500" mt={2}>
          Add at least 2 keyframes to fly — until then this renders as a plain
          map chapter.
        </Text>
      )}

      {keyframes.length >= 2 && (
        <Box mt={3}>
          <Text fontSize="xs" color="gray.600" mb={1}>
            Preview
          </Text>
          <input
            type="range"
            aria-label="Preview flyover"
            min={0}
            max={1000}
            step={1}
            defaultValue={0}
            onChange={(e) => handlePreview(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#CF3F02" }}
          />
        </Box>
      )}

      <Box mt={3}>
        <Text fontSize="xs" color="gray.600" mb={1}>
          Scroll length
        </Text>
        <input
          type="number"
          aria-label="Scroll length"
          min={0.5}
          step={0.5}
          value={chapter.scroll_length}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) {
              onChange({ ...chapter, scroll_length: v });
            }
          }}
          style={{
            width: "80px",
            fontSize: "12px",
            border: "1px solid #e2e8f0",
            borderRadius: "4px",
            padding: "2px 6px",
          }}
        />
      </Box>
    </Box>
  );
}
