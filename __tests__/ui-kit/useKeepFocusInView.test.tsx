import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { LayoutDirectionProvider } from '../../src/ui-kit/layout/LayoutDirection';
import { useKeepFocusInView } from '../../src/ui-kit/layout/useKeepFocusInView';

function setup(rtl: boolean, horizontal: boolean | 'default' = true) {
  const scrollToOffset = jest.fn();
  const listRef = { current: { scrollToOffset } };
  let value!: ReturnType<typeof useKeepFocusInView>;
  function Probe() {
    value = useKeepFocusInView(listRef, {
      ...(horizontal === 'default' ? {} : { horizontal }),
      marginStart: 50,
      marginEnd: 60,
    });
    return null;
  }
  act(() => {
    ReactTestRenderer.create(
      <LayoutDirectionProvider rtl={rtl} language={rtl ? 'ar' : 'en'}>
        <Probe />
      </LayoutDirectionProvider>,
    );
  });
  const layout = (width: number, height: number) =>
    value.listProps.onLayout({
      nativeEvent: { layout: { width, height } },
    } as never);
  const scroll = (x: number, y = 0) =>
    value.listProps.onScroll({
      nativeEvent: {
        contentOffset: { x, y },
        contentSize: { width: 5000, height: 5000 },
        layoutMeasurement: { width: 1000, height: 800 },
      },
    } as never);
  return {
    keepInView: (s: number, l: number) => value.keepInView(s, l),
    layout,
    scroll,
    scrollToOffset,
    value,
  };
}

describe('useKeepFocusInView', () => {
  it('does nothing before the list is laid out', () => {
    const { keepInView, scrollToOffset } = setup(false);
    keepInView(3000, 300);
    expect(scrollToOffset).not.toHaveBeenCalled();
  });

  it('scrolls just enough to show the item with its margins', () => {
    const { keepInView, layout, scrollToOffset } = setup(false);
    layout(1000, 800);
    keepInView(400, 300); // already in view
    expect(scrollToOffset).not.toHaveBeenCalled();
    keepInView(2000, 300); // past the end: its end edge lines up
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      offset: 1360,
      animated: false,
    });
    keepInView(1000, 300); // before the start: its start edge lines up
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      offset: 950,
      animated: false,
    });
    keepInView(0, 300); // never before 0
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      offset: 0,
      animated: false,
    });
  });

  it('in RTL, reads the scroll position from the right edge', () => {
    const { keepInView, layout, scroll, scrollToOffset } = setup(true);
    layout(1000, 800);
    // Native RTL reports from the left: 3900 from the left is 100 from the
    // right of 5000 wide content in a 1000 wide view
    scroll(3900);
    keepInView(200, 300);
    expect(scrollToOffset).not.toHaveBeenCalled();
    keepInView(20, 30);
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      offset: 0,
      animated: false,
    });
  });

  it('in LTR, and for vertical lists, reads it as it comes', () => {
    const ltr = setup(false);
    ltr.layout(1000, 800);
    ltr.scroll(3900);
    ltr.keepInView(4000, 300);
    expect(ltr.scrollToOffset).not.toHaveBeenCalled();

    // Vertical is the default
    const vertical = setup(true, 'default');
    vertical.layout(1000, 800);
    vertical.scroll(0, 600);
    vertical.keepInView(700, 300);
    expect(vertical.scrollToOffset).not.toHaveBeenCalled();
  });

  it('turns native and browser focus scrolling off', () => {
    const { value } = setup(false);
    expect(value.listProps).toMatchObject({
      scrollsChildToFocus: false,
      dataSet: { managedScroll: '' },
      scrollEventThrottle: 16,
    });
  });
});
