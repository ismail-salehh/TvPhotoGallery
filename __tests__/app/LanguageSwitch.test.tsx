import React from 'react';
import { I18nManager, View } from 'react-native';
import { act } from 'react-test-renderer';

import { useSettings } from '../../src/app/context/Settings';
import { SettingsScreen } from '../../src/app/screens/SettingsScreen';
import { renderInApp, texts } from '../helpers/renderApp';

function pressLabel(r: Awaited<ReturnType<typeof renderInApp>>, label: string) {
  const button = r.root.find(
    n =>
      typeof n.props.onPress === 'function' &&
      texts({ root: n } as never).includes(label),
  );
  act(() => button.props.onPress());
}

// The direction of the outermost view that sets one: the app's root
const rootDirection = (r: Awaited<ReturnType<typeof renderInApp>>) =>
  r.root
    .findAllByType(View)
    .map(v => Object.assign({}, ...[v.props.style].flat(3)).direction)
    .find(Boolean);

describe('changing language in Settings', () => {
  afterEach(() => {
    (I18nManager as { isRTL: boolean }).isRTL = false;
  });

  it('applies at once, without a restart: words, digits and direction', async () => {
    let interval = 0;
    function Probe() {
      interval = useSettings().settings.slideshowIntervalMs;
      return null;
    }
    const r = await renderInApp(
      <>
        <SettingsScreen onBack={() => {}} />
        <Probe />
      </>,
    );
    expect(texts(r)).toContain('Settings');
    expect(texts(r)).toContain('10 seconds');
    expect(rootDirection(r)).toBe('ltr');

    pressLabel(r, 'العربية');
    expect(texts(r)).toContain('الإعدادات');
    expect(texts(r)).toContain('١٠ ثوانٍ');
    expect(rootDirection(r)).toBe('rtl');
    expect(I18nManager.isRTL).toBe(true);

    pressLabel(r, 'English');
    expect(texts(r)).toContain('Settings');
    expect(rootDirection(r)).toBe('ltr');
    expect(I18nManager.isRTL).toBe(false);

    pressLabel(r, '20 seconds');
    expect(interval).toBe(20000);
  });
});
