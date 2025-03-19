import { WebContainer } from "@webcontainer/api";
import { create } from "zustand";

interface AppState {
  count: number;
  increase: () => void;
}

export const useStore = create<AppState>((set) => ({
  count: 0,
  increase: () => set((state) => ({ count: state.count + 1 })),
}));

interface WebContainerState {
  instance: WebContainer | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  teardown: () => void;
}

export const useWebContainerStore = create<WebContainerState>((set, get) => ({
  instance: null,
  isInitialized: false,
  isLoading: false,
  error: null,
  
  initialize: async () => {
    // Don't initialize if already initialized or loading
    if (get().isInitialized || get().isLoading) return;
    
    set({ isLoading: true, error: null });
    
    try {
      const webcontainer = await WebContainer.boot();
      set({ instance: webcontainer, isInitialized: true, isLoading: false });
    } catch (error) {
      console.error('Failed to initialize WebContainer:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Unknown error initializing WebContainer', 
        isLoading: false 
      });
    }
  },
  
  teardown: () => {
    const { instance } = get();
    if (instance) {
      instance.teardown();
      set({ instance: null, isInitialized: false });
    }
  }
}));