import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsRTL } from './LayoutDirection';

// Every size in the app is in pixels of a 1920x1080 screen
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

// TVs may crop the edges of the picture (overscan). Text, buttons and the
// focused item stay inside the title-safe area, 5% in from each edge;
// backgrounds and photos may still run to the edge.
export const SAFE_AREA_X = DESIGN_WIDTH * 0.05;
export const SAFE_AREA_Y = DESIGN_HEIGHT * 0.05;

type Canvas = {
  // Size of the canvas in design pixels: 1920x1080 on any 16:9 screen
  width: number;
  height: number;
  // Screen units per design pixel
  scale: number;
};

const CanvasContext = createContext<Canvas>({
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  scale: 1,
});

type DesignCanvasProps = {
  children: ReactNode;
};

// Lays children out on a 1920x1080 canvas scaled to the window: Android TV
// reports ~960x540 units at 720p, 1080p and 4K alike. A window that isn't
// 16:9 gets a canvas of its shape, at least 1920 wide or 1080 tall.
export function DesignCanvas({ children }: DesignCanvasProps) {
  const window = useWindowDimensions();
  const scale = Math.min(
    window.width / DESIGN_WIDTH,
    window.height / DESIGN_HEIGHT,
  );
  const canvas = useMemo(
    () => ({
      width: window.width / scale,
      height: window.height / scale,
      scale,
    }),
    [window.width, window.height, scale],
  );

  return (
    <CanvasContext.Provider value={canvas}>
      <View style={styles.viewport}>
        <View
          style={[
            styles.canvas,
            {
              width: canvas.width,
              height: canvas.height,
              transform: [{ scale }],
            },
          ]}
        >
          {children}
        </View>
      </View>
    </CanvasContext.Provider>
  );
}

// The canvas size, in design pixels. Use it instead of useWindowDimensions.
export function useCanvas() {
  return useContext(CanvasContext);
}

// Distance from each edge of the canvas that content should keep: the
// title-safe area, or more where the device reports a larger safe area.
// `start` and `end` are the left and right edges, swapped in RTL.
export function useScreenMargins() {
  const { scale } = useCanvas();
  const insets = useSafeAreaInsets();
  const rtl = useIsRTL();
  const left = Math.max(insets.left / scale, SAFE_AREA_X);
  const right = Math.max(insets.right / scale, SAFE_AREA_X);
  return {
    top: Math.max(insets.top / scale, SAFE_AREA_Y),
    bottom: Math.max(insets.bottom / scale, SAFE_AREA_Y),
    left,
    right,
    start: rtl ? right : left,
    end: rtl ? left : right,
  };
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'top left',
  },
});
