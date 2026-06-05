import { useState, useEffect } from "react";

const STORAGE_KEY = "dljois-default-model";

const DEFAULT_MODEL = {
  id: "auto",
  label: "Auto",
  desc: "Best for your task",
  color: "text-foreground",
};

export function useDefaultModel() {
  const [defaultModel, setDefaultModelState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_MODEL;
    } catch {
      return DEFAULT_MODEL;
    }
  });

  const setDefaultModel = (model: typeof DEFAULT_MODEL) => {
    setDefaultModelState(model);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
      window.dispatchEvent(new CustomEvent("dljois-model-change", { detail: model }));
    } catch {}
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const model = (e as CustomEvent).detail;
      setDefaultModelState(model);
    };
    window.addEventListener("dljois-model-change", handler);
    return () => window.removeEventListener("dljois-model-change", handler);
  }, []);

  return { defaultModel, setDefaultModel };
}
