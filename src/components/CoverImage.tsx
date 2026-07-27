import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { getCoverUrl } from "@/lib/library";
import { cn } from "@/lib/utils";

export function CoverImage({
  path,
  alt,
  className,
}: {
  path: string | null;
  alt: string;
  className?: string;
}) {
  const { data: url } = useQuery({
    queryKey: ["cover", path],
    queryFn: () => getCoverUrl(path),
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
  });

  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary text-primary/40",
          className,
        )}
        aria-hidden="true"
      >
        <BookOpen className="h-10 w-10" />
      </div>
    );
  }

  return <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}
