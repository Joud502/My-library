import { useCallback, useEffect, useRef, useState } from "react";
import { Bomb, Radiation } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Rock = { left: number; size: number; delay: number; rotate: number; drift: number };

function makeRocks(count: number): Rock[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    size: 14 + Math.random() * 46,
    delay: Math.random() * 0.5,
    rotate: Math.random() * 720 - 360,
    drift: Math.random() * 80 - 40,
  }));
}

/** Deux boutons spectaculaires : flash nucléaire (mode clair) et TNT (mode sombre). */
export function ThemeFxButtons({ className }: { className?: string }) {
  const { setTheme } = useTheme();
  const [fx, setFx] = useState<"none" | "nuke" | "tnt">("none");
  const [rocks, setRocks] = useState<Rock[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const run = useCallback(
    (kind: "nuke" | "tnt") => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      if (kind === "tnt") setRocks(makeRocks(22));
      setFx(kind);
      timers.current.push(
        window.setTimeout(() => setTheme(kind === "nuke" ? "light" : "dark"), kind === "nuke" ? 380 : 620),
        window.setTimeout(() => setFx("none"), kind === "nuke" ? 1600 : 2600),
      );
    },
    [setTheme],
  );

  return (
    <>
      <div className={cn("inline-flex items-center gap-1", className)}>
        <button
          type="button"
          aria-label="Flash nucléaire : passer en mode clair"
          title="Flash nucléaire (mode clair)"
          onClick={() => run("nuke")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-amber-500 shadow-card transition-transform hover:scale-110 active:scale-95"
        >
          <Radiation className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="TNT : passer en mode sombre"
          title="TNT (mode sombre)"
          onClick={() => run("tnt")}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-red-500 shadow-card transition-transform hover:scale-110 active:scale-95"
        >
          <Bomb className="h-4 w-4" />
        </button>
      </div>

      {fx !== "none" && (
        <div className="pointer-events-none fixed inset-0 z-[999] overflow-hidden" aria-hidden="true">
          {fx === "nuke" && (
            <>
              <div className="fx-nuke-flash absolute inset-0 bg-white" />
              <div className="fx-nuke-ring absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-amber-200/80" />
            </>
          )}
          {fx === "tnt" && (
            <>
              <div className="fx-tnt-blast absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,229,150,0.95),rgba(255,116,32,0.8)_45%,rgba(0,0,0,0)_70%)]" />
              {rocks.map((rock, i) => (
                <span
                  key={i}
                  className="fx-tnt-rock absolute top-[-15vh] block rounded-[35%] bg-neutral-800 shadow-lg"
                  style={{
                    left: `${rock.left}%`,
                    width: rock.size,
                    height: rock.size * 0.85,
                    animationDelay: `${rock.delay}s`,
                    // @ts-expect-error custom props
                    "--rock-rotate": `${rock.rotate}deg`,
                    "--rock-drift": `${rock.drift}px`,
                  }}
                />
              ))}
              <div className="fx-tnt-dust absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(60,55,50,0.95),rgba(10,10,10,0.98))]" />
            </>
          )}
        </div>
      )}
    </>
  );
}
