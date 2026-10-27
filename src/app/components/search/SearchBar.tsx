import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Focusable } from '../../../ui-kit/focus/Focusable';
import { LTR } from '../../../ui-kit/layout/LayoutDirection';
import { useI18n } from '../../hooks/useI18n';
import { colors, lineHeightFor, radius, spacing } from '../../theme';

type SearchBarProps = {
  // TV text entry happens on the Search screen, so on Home this is a button
  onPress?: () => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
};

export function SearchBar({ onPress, placeholder, style }: SearchBarProps) {
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);

  return (
    <Focusable
      id="home-search-bar"
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.bar, focused && styles.barFocused, style]}
    >
      {/* A drawing: its parts keep their places in RTL */}
      <View style={[styles.icon, LTR]}>
        <View style={styles.iconLens} />
        <View style={styles.iconHandle} />
      </View>
      <Text style={styles.placeholder} numberOfLines={1}>
        {placeholder ?? t('home.searchPlaceholder')}
      </Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  barFocused: {
    borderColor: colors.focus,
    backgroundColor: colors.surfaceFocused,
  },
  icon: {
    width: 24,
    height: 24,
  },
  iconLens: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.textMuted,
  },
  iconHandle: {
    position: 'absolute',
    right: 1,
    bottom: 3,
    width: 9,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    transform: [{ rotate: '45deg' }],
  },
  placeholder: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 22,
    lineHeight: lineHeightFor(22),
  },
});
