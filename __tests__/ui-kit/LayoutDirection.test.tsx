import React from 'react';
import { I18nManager, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useScreenMargins } from '../../src/ui-kit/layout/DesignCanvas';
import {
  DirectionView,
  LayoutDirectionProvider,
  LTR,
  useHorizontalList,
  useIsRTL,
} from '../../src/ui-kit/layout/LayoutDirection';

type Seen = {
  rtl: boolean;
  list: ReturnType<typeof useHorizontalList>;
  margins: ReturnType<typeof useScreenMargins>;
};

function render(rtl: boolean, insets = { left: 0, right: 0 }) {
  const seen = {} as Seen;
  function Probe() {
    seen.rtl = useIsRTL();
    seen.list = useHorizontalList();
    seen.margins = useScreenMargins();
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 1920, height: 1080 },
          insets: { top: 0, bottom: 0, ...insets },
        }}
      >
        <LayoutDirectionProvider rtl={rtl} language={rtl ? 'ar' : 'en'}>
          <Probe />
          <DirectionView style={{ flex: 2 }}>
            <View testID="inside" />
          </DirectionView>
        </LayoutDirectionProvider>
      </SafeAreaProvider>,
    );
  });
  return { renderer, seen };
}

const flat = (style: unknown) => Object.assign({}, ...[style].flat(3));

describe('LayoutDirectionProvider', () => {
  afterEach(() => {
    (I18nManager as { isRTL: boolean }).isRTL = false;
  });

  it('lays everything out right to left in RTL, and says so', () => {
    const { renderer, seen } = render(true);
    expect(seen.rtl).toBe(true);
    expect(I18nManager.isRTL).toBe(true);
    const views = renderer.root.findAllByType(View);
    // The root view of the provider, then the DirectionView
    expect(flat(views[0].props.style)).toMatchObject({
      flex: 1,
      direction: 'rtl',
    });
    expect(flat(views[1].props.style)).toMatchObject({
      flex: 2,
      direction: 'rtl',
    });
  });

  it('switches back to LTR live, without a restart', () => {
    const { renderer } = render(true);
    act(() => {
      renderer.update(
        <SafeAreaProvider>
          <LayoutDirectionProvider rtl={false} language="en">
            <DirectionView>
              <View />
            </DirectionView>
          </LayoutDirectionProvider>
        </SafeAreaProvider>,
      );
    });
    expect(I18nManager.isRTL).toBe(false);
    const views = renderer.root.findAllByType(View);
    expect(flat(views[0].props.style).direction).toBe('ltr');
  });

  it('remounts horizontal lists when the direction changes', () => {
    expect(render(true).seen.list.key).toBe('rtl');
    expect(render(false).seen.list.key).toBe('ltr');
  });

  it('offers a fixed-LTR style for Latin keys and drawings', () => {
    expect(LTR).toEqual({ direction: 'ltr' });
  });
});

describe('useScreenMargins', () => {
  it('gives start and end as the left and right edges, swapped in RTL', () => {
    const insets = { left: 0, right: 300 };
    const ltr = render(false, insets).seen.margins;
    expect(ltr).toMatchObject({ left: 96, right: 300, start: 96, end: 300 });
    const rtl = render(true, insets).seen.margins;
    expect(rtl).toMatchObject({ left: 96, right: 300, start: 300, end: 96 });
  });
});
