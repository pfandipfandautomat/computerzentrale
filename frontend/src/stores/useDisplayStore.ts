import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DisplayState {
  // Edge visibility
  showAllEdges: boolean;
  showWireGuardEdges: boolean;
  showRegularEdges: boolean;
  
  // Node display options
  showOfflineNodes: boolean;
  showNodeMetrics: boolean;
  showNodeDetails: boolean;
  
  // Visual options
  showMiniMap: boolean;
  showGrid: boolean;
  showHighlighting: boolean;
  
  // Viewport state
  viewport: { x: number; y: number; zoom: number } | null;
  
  // Actions
  setShowAllEdges: (show: boolean) => void;
  setShowWireGuardEdges: (show: boolean) => void;
  setShowRegularEdges: (show: boolean) => void;
  setShowOfflineNodes: (show: boolean) => void;
  setShowNodeMetrics: (show: boolean) => void;
  setShowNodeDetails: (show: boolean) => void;
  setShowMiniMap: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowHighlighting: (show: boolean) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  resetToDefaults: () => void;
}

const defaultState = {
  showAllEdges: true,
  showWireGuardEdges: true,
  showRegularEdges: true,
  showOfflineNodes: true,
  showNodeMetrics: true,
  showNodeDetails: true,
  showMiniMap: true,
  showGrid: true,
  showHighlighting: true,
  viewport: null,
};

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set) => ({
      ...defaultState,
      
      setShowAllEdges: (show) => set({ showAllEdges: show }),
      setShowWireGuardEdges: (show) => set({ showWireGuardEdges: show }),
      setShowRegularEdges: (show) => set({ showRegularEdges: show }),
      setShowOfflineNodes: (show) => set({ showOfflineNodes: show }),
      setShowNodeMetrics: (show) => set({ showNodeMetrics: show }),
      setShowNodeDetails: (show) => set({ showNodeDetails: show }),
      setShowMiniMap: (show) => set({ showMiniMap: show }),
      setShowGrid: (show) => set({ showGrid: show }),
      setShowHighlighting: (show) => set({ showHighlighting: show }),
      setViewport: (viewport) => set({ viewport }),
      resetToDefaults: () => set(defaultState),
    }),
    {
      name: 'computerzentrale-display-settings',
    }
  )
);
