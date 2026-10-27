import React from 'react';
import { View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

// The web build of the platform module, as webpack would pick it
jest.mock('../../src/platform/layoutDirection', () => {
  (globalThis as { document?: unknown }).document = {
    documentElement: { lang: '', dir: '' },
  };
  return jest.requireActual('../../src/platform/layoutDirection.web');
});

import {
  DirectionView,
  LayoutDirectionProvider,
} from '../../src/ui-kit/layout/LayoutDirection';

describe('DirectionView on web', () => {
  it('gives the view `dir`, so start/end margins land on the right side', () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      r = ReactTestRenderer.create(
        <LayoutDirectionProvider rtl language="ar">
          <DirectionView>
            <View />
          </DirectionView>
        </LayoutDirectionProvider>,
      );
    });
    const views = r.root.findAllByType(View);
    expect(views[0].props.dir).toBe('rtl');
    expect(views[1].props.dir).toBe('rtl');
    expect(Object.assign({}, ...[views[0].props.style].flat(3))).toMatchObject({
      writingDirection: 'rtl',
    });
  });
});
