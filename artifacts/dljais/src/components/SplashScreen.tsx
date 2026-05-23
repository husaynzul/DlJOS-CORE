import { useEffect, useState } from "react";

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    // Fade in → hold → fade out
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 2000);
    const t3 = setTimeout(() => onDone(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1a1a1a]"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "in" ? "opacity 0.6s ease" : phase === "out" ? "opacity 0.65s ease" : "none",
      }}
    >
      {/* Logo */}
      <div
        style={{
          transform: phase === "in" ? "scale(0.88)" : "scale(1)",
          opacity: phase === "in" ? 0 : 1,
          transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease",
        }}
        className="flex flex-col items-center gap-6"
      >
        <img
          src="/dljais-logo.jpg"
          alt="DlJiS"
          className="w-28 h-28 object-contain"
          style={{ filter: "drop-shadow(0 0 32px rgba(255,255,255,0.08))" }}
        />

        {/* App name */}
        <div className="text-center">
          <p className="text-white text-[22px] font-semibold tracking-tight">DlJiS</p>
          <p className="text-white/45 text-[13px] tracking-widest uppercase mt-1 font-light">AI Action OS</p>
        </div>

        {/* Pulse dots */}
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/30"
              style={{
                animation: phase === "hold" ? `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` : "none",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          50%       { opacity: 0.9;  transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
