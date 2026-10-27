import { memo, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Focusable } from '../../../ui-kit/focus/Focusable';
import { LTR } from '../../../ui-kit/layout/LayoutDirection';
import { useI18n } from '../../hooks/useI18n';
import { colors, lineHeightFor, radius, spacing } from '../../theme';

// Alphabetical rather than QWERTY: with a D-pad, a predictable order is
// quicker to move around than a layout made for ten fingers
const ROWS = [
  ['a', 'b', 'c', 'd', 'e', 'f'],
  ['g', 'h', 'i', 'j', 'k', 'l'],
  ['m', 'n', 'o', 'p', 'q', 'r'],
  ['s', 't', 'u', 'v', 'w', 'x'],
  ['y', 'z', '1', '2', '3', '4'],
  ['5', '6', '7', '8', '9', '0'],
];

const KEY_SIZE = 56;
const GAP = spacing.xs;
export const KEYBOARD_WIDTH =
  KEY_SIZE * ROWS[0].length + GAP * (ROWS[0].length - 1);

type OnScreenKeyboardProps = {
  onKey: (character: string) => void;
  onSpace: () => void;
  onDelete: () => void;
  onClear: () => void;
  // Takes initial focus when the screen opens
  preferFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

// TVs have no keyboard of their own worth using, so search types with the
// remote: move to a key, press OK
export const OnScreenKeyboard = memo(function OnScreenKeyboardView({
  onKey,
  onSpace,
  onDelete,
  onClear,
  preferFocus = true,
  style,
}: OnScreenKeyboardProps) {
  const { t } = useI18n();
  return (
    // Latin letters keep their order in RTL, as on a physical keyboard
    <View style={[styles.keyboard, LTR, style]}>
      {ROWS.map(row => (
        <View key={row[0]} style={styles.row}>
          {row.map(character => (
            <Key
              key={character}
              id={`key-${character}`}
              label={character}
              onPress={() => onKey(character)}
              hasTVPreferredFocus={preferFocus && character === 'a'}
              style={styles.square}
            />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Key
          id="key-space"
          label={t('search.space')}
          onPress={onSpace}
          style={styles.wide}
        />
        <Key
          id="key-delete"
          label={t('search.delete')}
          onPress={onDelete}
          style={styles.wide}
        />
        <Key
          id="key-clear"
          label={t('search.clear')}
          onPress={onClear}
          style={styles.wide}
        />
      </View>
    </View>
  );
});

type KeyProps = {
  id: string;
  label: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

function Key({ id, label, onPress, hasTVPreferredFocus, style }: KeyProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Focusable
      id={id}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.key, style, focused && styles.keyFocused]}
    >
      <Text style={[styles.label, focused && styles.labelFocused]}>
        {label}
      </Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    width: KEYBOARD_WIDTH,
    gap: GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  key: {
    height: KEY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  square: {
    width: KEY_SIZE,
  },
  // Two keys and the gap between them, so the bottom row lines up
  wide: {
    width: KEY_SIZE * 2 + GAP,
  },
  keyFocused: {
    borderColor: colors.focus,
    backgroundColor: colors.surfaceFocused,
    transform: [{ scale: 1.1 }],
  },
  label: {
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: lineHeightFor(22),
    fontWeight: '600',
  },
  labelFocused: {
    color: colors.text,
  },
});
