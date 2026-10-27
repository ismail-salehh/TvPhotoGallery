import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { modalRequestCloseIsBack } from '../../../platform/backPress';

import {
  FocusScreen,
  restoreScreenFocus,
  useFocusScreenKey,
} from '../../../ui-kit/focus/FocusScreen';
import { DesignCanvas } from '../../../ui-kit/layout/DesignCanvas';
import { DirectionView } from '../../../ui-kit/layout/LayoutDirection';
import { useBackDispatch, useBackHandler } from '../../context/BackHandler';
import { colors, lineHeightFor, radius, spacing } from '../../theme';

type DialogProps = {
  // Unique among the dialogs of the screen that opens it
  id: string;
  visible: boolean;
  title: string;
  message?: string;
  // Back, or a choice that ends the dialog
  onClose: () => void;
  // The choices; give the one to start on hasTVPreferredFocus
  children: ReactNode;
};

// A modal over the current screen: the remote can't reach behind it, Back
// closes it, and focus then returns to the item focused before it opened.
// Web: spatialNavigation.web keeps focus inside it.
export function Dialog({
  id,
  visible,
  title,
  message,
  onClose,
  children,
}: DialogProps) {
  const parentScreenKey = useFocusScreenKey();
  const screenKey = `${parentScreenKey ?? 'app'}/${id}`;

  useBackHandler(() => {
    onClose();
    return true;
  }, visible);
  // A native Modal takes the back button itself and reports it here
  const dispatchBack = useBackDispatch();

  // The screen behind didn't remember anything while the dialog was open,
  // so its memory still points at the item that opened the dialog
  const wasVisible = useRef(visible);
  useEffect(() => {
    const closing = wasVisible.current && !visible;
    wasVisible.current = visible;
    if (closing && parentScreenKey) {
      return restoreScreenFocus(parentScreenKey);
    }
  }, [visible, parentScreenKey]);

  return (
    <Modal
      visible={visible}
      transparent
      // No fade: react-native-web keeps a fading-out modal in the page,
      // still holding focus, so focus couldn't return until it finished
      animationType="none"
      onRequestClose={() => {
        if (modalRequestCloseIsBack) {
          dispatchBack();
        }
      }}
    >
      {/* A native Modal is a window of its own, outside the app's canvas
          and its layout direction */}
      <DesignCanvas>
        <DirectionView style={styles.backdrop}>
          <FocusScreen screenKey={screenKey} active>
            <View style={styles.panel}>
              <Text style={styles.title}>{title}</Text>
              {!!message && <Text style={styles.message}>{message}</Text>}
              <View style={styles.choices}>{children}</View>
            </View>
          </FocusScreen>
        </DirectionView>
      </DesignCanvas>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  panel: {
    minWidth: 560,
    maxWidth: 960,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: lineHeightFor(32),
    fontWeight: '700',
  },
  message: {
    color: colors.textMuted,
    fontSize: 20,
    lineHeight: lineHeightFor(20),
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
