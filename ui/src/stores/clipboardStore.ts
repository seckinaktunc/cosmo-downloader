import { create } from "zustand";

interface ClipboardStore {
  text: string;
  setText: (text: string) => void;
}

export const useClipboardStore = create<ClipboardStore>((set) => ({
  text: "",
  setText: (text) => set({ text }),
}));
