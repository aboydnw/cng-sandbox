import { Flex, IconButton } from "@chakra-ui/react";
import { TextB, TextItalic, TextH, Link } from "@phosphor-icons/react";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}

function insertMarkdown(
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (v: string) => void,
  prefix: string,
  suffix: string,
  placeholder: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end) || placeholder;
  const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
  onChange(newValue);
  requestAnimationFrame(() => {
    textarea.focus();
    const newStart = start + prefix.length;
    textarea.setSelectionRange(newStart, newStart + selected.length);
  });
}

export function MarkdownToolbar({ textareaRef, value, onChange }: MarkdownToolbarProps) {
  const actions = [
    { icon: <TextB size={16} weight="bold" />, label: "Bold", prefix: "**", suffix: "**", placeholder: "bold text" },
    { icon: <TextItalic size={16} />, label: "Italic", prefix: "*", suffix: "*", placeholder: "italic text" },
    { icon: <TextH size={16} weight="bold" />, label: "Heading", prefix: "## ", suffix: "", placeholder: "Heading" },
    { icon: <Link size={16} />, label: "Link", prefix: "[", suffix: "](url)", placeholder: "link text" },
  ];

  return (
    <Flex gap={0.5} borderBottom="1px solid" borderColor="gray.200" pb={1} mb={1}>
      {actions.map((action) => (
        <IconButton
          key={action.label}
          aria-label={action.label}
          size="xs"
          variant="ghost"
          color="gray.500"
          _hover={{ color: "gray.800", bg: "gray.100" }}
          onClick={() => {
            if (!textareaRef.current) return;
            insertMarkdown(textareaRef.current, value, onChange, action.prefix, action.suffix, action.placeholder);
          }}
        >
          {action.icon}
        </IconButton>
      ))}
    </Flex>
  );
}
