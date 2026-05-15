import { create } from "zustand";

type AppState = {
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  hasCompletedOnboarding: false,
  setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
}));
