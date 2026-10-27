import React from 'react';

import { ScrollView, TVFocusGuideView } from 'react-native';

import { SettingsScreen } from '../../src/app/screens/SettingsScreen';
import { renderInApp, texts } from '../helpers/renderApp';

const mockDetails = jest.fn();
jest.mock('../../src/platform/deviceInfo', () => ({
  getDeviceDetails: () => mockDetails(),
}));

describe('Settings › About', () => {
  it('shows the device model, the OS and the app version', async () => {
    mockDetails.mockReturnValue({
      model: 'Sony BRAVIA 4K VH2',
      system: 'Android 14',
      appVersion: '1.0 (7)',
    });
    const all = texts(await renderInApp(<SettingsScreen onBack={() => {}} />));
    expect(all).toEqual(
      expect.arrayContaining([
        'Version 1.0 (7)',
        'Device',
        'Sony BRAVIA 4K VH2',
        'System',
        'Android 14',
      ]),
    );
  });

  it('labels them in Arabic, keeping the values as the device gives them', async () => {
    mockDetails.mockReturnValue({
      model: 'LG OLED55C2',
      system: 'webOS 7.3.0',
      appVersion: '0.0.1',
    });
    const all = texts(
      await renderInApp(<SettingsScreen onBack={() => {}} />, 'ar'),
    );
    expect(all).toEqual(
      expect.arrayContaining([
        'الإصدار 0.0.1',
        'الجهاز',
        'LG OLED55C2',
        'النظام',
        'webOS 7.3.0',
      ]),
    );
  });

  it('says "unknown" in the UI language for what the device does not tell', async () => {
    mockDetails.mockReturnValue({ model: '', system: '', appVersion: '0.0.1' });
    const en = texts(await renderInApp(<SettingsScreen onBack={() => {}} />));
    expect(en.filter(t => t === 'Unknown')).toHaveLength(2);
    const ar = texts(
      await renderInApp(<SettingsScreen onBack={() => {}} />, 'ar'),
    );
    expect(ar.filter(t => t === 'غير معروف')).toHaveLength(2);
  });
});

describe('Settings layout', () => {
  it('uses the full width between the safe margins, in both languages', async () => {
    mockDetails.mockReturnValue({ model: '', system: '', appVersion: '' });
    for (const language of ['en', 'ar'] as const) {
      const r = await renderInApp(
        <SettingsScreen onBack={() => {}} />,
        language,
      );
      const content = Object.assign(
        {},
        ...[r.root.findByType(ScrollView).props.contentContainerStyle]
          .flat(5)
          .filter(Boolean),
      );
      expect(content.maxWidth).toBeUndefined();
      expect(content.width).toBeUndefined();
      expect(content.paddingLeft).toBe(96);
      expect(content.paddingRight).toBe(96);
    }
  });
});

describe('Settings focus', () => {
  it('keeps left/right inside each row of choices', async () => {
    mockDetails.mockReturnValue({ model: '', system: '', appVersion: '' });
    const r = await renderInApp(<SettingsScreen onBack={() => {}} />);
    const rows = r.root
      .findAll(
        n =>
          n.type === TVFocusGuideView &&
          n.props.trapFocusLeft === true &&
          n.props.trapFocusRight === true,
      )
      .map(row => ({
        autoFocus: row.props.autoFocus,
        ids: [
          ...new Set(
            row
              .findAll(n => typeof n.props.testID === 'string')
              .map(n => n.props.testID as string),
          ),
        ],
      }));
    expect(rows).toEqual([
      {
        autoFocus: false,
        ids: [3000, 5000, 10000, 20000].map(ms => `settings-speed-${ms}`),
      },
      {
        autoFocus: false,
        ids: ['settings-language-en', 'settings-language-ar'],
      },
    ]);
  });
});
