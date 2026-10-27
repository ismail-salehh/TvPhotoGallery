import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Focusable } from '../../../ui-kit/focus/Focusable';
import { colors, lineHeightFor, radius, spacing } from '../../theme';

export type RadioOptionProps = {
  id: string;
  label: string;
  selected: boolean;
  preferFocus?: boolean;
  onPress: () => void;
};

// One choice of a setting. Selected and focused look different, because on
// a TV the user moves focus across the choices before picking one.
export function RadioOption({
  id,
  label,
  selected,
  preferFocus,
  onPress,
}: RadioOptionProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Focusable
      id={id}
      hasTVPreferredFocus={preferFocus}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.option,
        selected && styles.optionSelected,
        focused && styles.optionFocused,
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {label}
      </Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 160,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.background,
  },
  // Chosen: radio dot, bold text and a neutral fill. Focus alone is blue.
  optionSelected: {
    backgroundColor: colors.surfaceSelected,
  },
  optionFocused: {
    borderColor: colors.focus,
    backgroundColor: colors.surfaceFocused,
    transform: [{ scale: 1.05 }],
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.focus,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.focus,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: lineHeightFor(22),
  },
  optionTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
});
