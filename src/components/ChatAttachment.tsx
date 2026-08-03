import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { attachmentUrl, type Attachment } from "@/lib/chat";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** Affiche une pièce jointe de conversation via une URL signée. */
export function ChatAttachment({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void attachmentUrl(attachment.path)
      .then((signed) => active && setUrl(signed))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [attachment.path]);

  const isImage = IMAGE_RE.test(attachment.name);

  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={attachment.name}
          loading="lazy"
          className="max-h-56 rounded-lg object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-sm underline-offset-2 hover:underline"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{attachment.name}</span>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
}
