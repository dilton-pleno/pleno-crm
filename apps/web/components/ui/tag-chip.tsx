import { X } from "lucide-react";

export interface TagData {
  id: string;
  name: string;
  color: string;
}

/** Pílula colorida de etiqueta. Passe onRemove para exibir o botão de remover. */
export function TagChip({
  tag,
  onRemove,
  size = "sm",
}: {
  tag: TagData;
  onRemove?: () => void;
  size?: "xs" | "sm";
}) {
  const pad = size === "xs" ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium leading-none ${pad}`}
      style={{ backgroundColor: `${tag.color}1a`, color: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70"
          title="Remover etiqueta"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}
