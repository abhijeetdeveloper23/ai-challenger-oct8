import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "./Toast";

interface Props {
  value: string;
  /** Human label used in the toast and screen-reader name, e.g. "Phone". */
  label: string;
}

export function CopyButton({ value, label }: Props) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      notify("Couldn't copy. Select the text and copy it manually.", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-border/60 hover:text-ink"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}
