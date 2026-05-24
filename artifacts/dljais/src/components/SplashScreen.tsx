import { useEffect, useState } from "react";

interface Props { onDone: () => void }

export function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 80);
    const t2 = setTimeout(() => setPhase("out"), 2400);
    const t3 = setTimeout(() => onDone(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0f0f0f]"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 0.6s cubic-bezier(0.4,0,1,1)" : "none",
        pointerEvents: phase === "out" ? "none" : "all",
      }}
    >
      <div
        className="relative flex flex-col items-center"
        style={{
          transform: phase === "in" ? "scale(0.75) translateY(10px)" : "scale(1) translateY(0)",
          opacity: phase === "in" ? 0 : 1,
          transition: "transform 0.8s cubic-bezier(0.34,1.4,0.64,1), opacity 0.55s ease",
        }}
      >
        {/* Ambient glow behind logo */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 160, height: 160,
            background: "radial-gradient(circle, rgba(230,160,100,0.18) 0%, transparent 70%)",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%) scale(1.6)",
            animation: phase === "hold" ? "dljos-glow 3s ease-in-out infinite" : "none",
          }}
        />

        {/* Logo */}
        <div
          style={{
            animation: phase === "hold" ? "dljos-float 4s ease-in-out infinite" : "none",
          }}
        >
          <img
            src="/dljos-logo.jpg"
            alt="DlJOS"
            style={{
              width: 110, height: 110,
              objectFit: "contain",
              borderRadius: 22,
              filter: "invert(1) brightness(0.92)",
              animation: phase === "hold" ? "dljos-breathe 3s ease-in-out infinite" : "none",
            }}
          />
        </div>

        {/* Name + tagline */}
        <div
          className="text-center mt-6"
          style={{
            opacity: phase === "in" ? 0 : 1,
            transform: phase === "in" ? "translateY(8px)" : "translateY(0)",
            transition: "opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s",
          }}
        >
          <p className="text-white text-[22px] font-semibold tracking-tight">DlJOS</p>
          <p className="text-white/35 text-[11.5px] tracking-[0.22em] uppercase mt-1 font-light">AI Action OS</p>
        </div>

        {/* Pulsing dots */}
        <div
          className="flex gap-1.5 mt-8"
          style={{ opacity: phase === "hold" ? 1 : 0, transition: "opacity 0.4s ease 0.5s" }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20"
              style={{ animation: phase === "hold" ? `dljos-dot 1.5s ease-in-out ${i * 0.2}s infinite` : "none" }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes dljos-glow {
          0%,100% { opacity:0.5; transform:translate(-50%,-50%) scale(1.6); }
          50%      { opacity:1;   transform:translate(-50%,-50%) scale(2.0); }
        }
        @keyframes dljos-float {
          0%,100% { transform:translateY(0px); }
          50%      { transform:translateY(-5px); }
        }
        @keyframes dljos-breathe {
          0%,100% { filter:invert(1) brightness(0.85); }
          50%      { filter:invert(1) brightness(1.05); }
        }
        @keyframes dljos-dot {
          0%,100% { opacity:0.2; transform:scale(0.8); }
          50%      { opacity:0.9; transform:scale(1.25); }
        }
      `}</style>
    </div>
  );
}
