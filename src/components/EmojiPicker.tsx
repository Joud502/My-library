import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉",
  "😊","😍","🥰","😘","😗","😜","🤪","🤗","🤩","🥳",
  "🤔","🤨","😐","😴","😢","😭","😤","😡","🥺","😳",
  "👍","👎","👏","🙏","💪","🤝","👋","✌️","🤞","🫶",
  "❤️","🧡","💛","💚","💙","💜","🖤","💔","✨","🔥",
  "📚","📖","📕","📗","📘","📙","🔖","✏️","🎧","🎉",
];

/** Sélecteur d'emoji simple à insérer dans un champ de message. */
export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="icon" variant="ghost" aria-label="Insérer un emoji">
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="grid grid-cols-10 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSelect(emoji)}
              className="rounded p-1 text-lg leading-none transition-colors hover:bg-secondary"
              aria-label={`Emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
