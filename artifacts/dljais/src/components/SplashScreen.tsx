import { useEffect, useState } from "react";

interface Props { onDone: () => void }

export function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 100);
    const t2 = setTimeout(() => setPhase("out"), 2200);
    const t3 = setTimeout(() => onDone(), 2850);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#141414]"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 0.65s cubic-bezier(0.4,0,1,1)" : "none",
        pointerEvents: phase === "out" ? "none" : "all",
      }}
    >
      {/* Outer glow ring */}
      <div
        className="relative"
        style={{
          transform: phase === "in" ? "scale(0.7)" : "scale(1)",
          opacity: phase === "in" ? 0 : 1,
          transition: "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.5s ease",
        }}
      >
        {/* Animated glow */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(205,110,75,0.35) 0%, transparent 70%)",
            animation: phase === "hold" ? "pulse-glow 2.5s ease-in-out infinite" : "none",
            transform: "scale(1.8)",
          }}
        />

        {/* Logo image */}
        <img
          src="/dljais-logo.jpg"
          alt="DlJiS"
          className="relative z-10 rounded-2xl"
          style={{
            width: 120,
            height: 120,
            objectFit: "contain",
            animation: phase === "hold" ? "logo-float 3s ease-in-out infinite" : "none",
          }}
        />
      </div>

      {/* Text */}
      <div
        className="text-center mt-7"
        style={{
          opacity: phase === "in" ? 0 : 1,
          transform: phase === "in" ? "translateY(12px)" : "translateY(0)",
          transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
        }}
      >
        <p className="text-white text-[24px] font-semibold tracking-tight">DlJiS</p>
        <p className="text-white/40 text-[12.5px] tracking-[0.2em] uppercase mt-1 font-light">AI Action OS</p>
      </div>

      {/* Loading dots */}
      <div
        className="flex gap-2 mt-8"
        style={{ opacity: phase === "hold" ? 1 : 0, transition: "opacity 0.3s ease 0.6s" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-white/25"
            style={{ animation: phase === "hold" ? `pulse-dot 1.4s ease-in-out ${i * 0.22}s infinite` : "none" }}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1.8); }
          50%       { opacity: 1;   transform: scale(2.1); }
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
