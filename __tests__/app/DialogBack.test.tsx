import React from 'react';
import { Modal } from 'react-native';
import { act } from 'react-test-renderer';

import { Dialog } from '../../src/app/components/common/Dialog';
import { renderInApp } from '../helpers/renderApp';

let mockIsBack = true;
jest.mock('../../src/platform/backPress', () => ({
  ...jest.requireActual('../../src/platform/backPress'),
  get modalRequestCloseIsBack() {
    return mockIsBack;
  },
}));

describe('Dialog', () => {
  async function requestClose() {
    const onClose = jest.fn();
    const r = await renderInApp(
      <Dialog id="d" visible title="T" onClose={onClose}>
        {null}
      </Dialog>,
    );
    act(() => r.root.findByType(Modal).props.onRequestClose());
    return onClose;
  }

  it('treats the native Modal’s close request as Back: the dialog closes', async () => {
    mockIsBack = true;
    expect(await requestClose()).toHaveBeenCalledTimes(1);
  });

  it('ignores it where the key already went through Back (web)', async () => {
    mockIsBack = false;
    expect(await requestClose()).not.toHaveBeenCalled();
  });

  it('shows its message when it has one', async () => {
    const { texts } = require('../helpers/renderApp');
    const r = await renderInApp(
      <Dialog id="d" visible title="T" message="More words" onClose={() => {}}>
        {null}
      </Dialog>,
    );
    expect(texts(r)).toEqual(expect.arrayContaining(['T', 'More words']));
  });

  it('lays its content out in the app’s direction, being a root of its own', async () => {
    const r = await renderInApp(
      <Dialog id="d" visible title="T" onClose={() => {}}>
        {null}
      </Dialog>,
      'ar',
    );
    const modal = r.root.findByType(Modal);
    const styled = modal.findAll(
      n =>
        typeof n.type === 'string' &&
        [n.props.style].flat(3).some(s => s?.direction === 'rtl'),
    );
    expect(styled.length).toBeGreaterThan(0);
  });
});

describe('Dialog closing', () => {
  it('puts focus back where it was on the screen behind', async () => {
    const focusScreen = require('../../src/ui-kit/focus/FocusScreen');
    const restore = jest.spyOn(focusScreen, 'restoreScreenFocus');
    let setVisible!: (v: boolean) => void;
    function Behind() {
      const [visible, set] = React.useState(true);
      setVisible = set;
      return (
        <focusScreen.FocusScreen screenKey="behind" active>
          <Dialog id="d" visible={visible} title="T" onClose={() => {}}>
            {null}
          </Dialog>
        </focusScreen.FocusScreen>
      );
    }
    await renderInApp(<Behind />);
    expect(restore).not.toHaveBeenCalled();
    act(() => setVisible(false));
    expect(restore).toHaveBeenCalledWith('behind');
    restore.mockRestore();
  });
});
