import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text } from 'react-native';

import { Focusable } from '../../../ui-kit/focus/Focusable';
import { colors, lineHeightFor, radius, spacing } from '../../theme';

type TextButtonProps = {
  id: string;
  label: string;
  onPress: () => void;
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
  // Shown dimmed and skipped by focus, e.g. Slideshow while there are no
  // photos yet; keeps its place so nothing around it moves
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function TextButton({
  id,
  label,
  onPress,
  onFocus,
  hasTVPreferredFocus,
  disabled,
  style,
}: TextButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Focusable
      id={id}
      hasTVPreferredFocus={hasTVPreferredFocus}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      // The focused look always wins over the caller's style
      style={[
        styles.button,
        style,
        focused && styles.buttonFocused,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  buttonFocused: {
    borderColor: colors.focus,
    backgroundColor: colors.surfaceFocused,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  text: {
    color: colors.text,
    fontSize: 20,
    lineHeight: lineHeightFor(20),
  },
});
