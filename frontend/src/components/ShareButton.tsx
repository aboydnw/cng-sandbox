import { useState, useCallback } from "react";
import { Button } from "@chakra-ui/react";
import { Check, LinkSimple } from "@phosphor-icons/react";

const STYLE = `
.share-roller {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  height: 1.2em;
  overflow: hidden;
  width: 80px;
}
.share-roller span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1), opacity 250ms cubic-bezier(0.32, 0.72, 0, 1);
  white-space: nowrap;
}
.share-roller .share-label { transform: translateY(0); opacity: 1; }
.share-roller .copied-label { position: absolute; inset: 0; transform: translateY(120%); opacity: 0; }
.share-roller[data-copied="true"] .share-label { transform: translateY(-120%); opacity: 0; }
.share-roller[data-copied="true"] .copied-label { transform: translateY(0); opacity: 1; }
`;

function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <>
      <style>{STYLE}</style>
      <Button
        bg="brand.orange"
        color="white"
        size="sm"
        fontWeight={600}
        borderRadius="4px"
        _hover={{ bg: "brand.orangeHover" }}
        onClick={handleCopy}
        px={4}
      >
        <span className="share-roller" data-copied={copied}>
          <span className="share-label"><LinkSimple size={14} weight="bold" /> Share</span>
          <span className="copied-label"><Check size={14} weight="bold" /> Copied</span>
        </span>
      </Button>
    </>
  );
}
