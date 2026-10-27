import type { StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../../hooks/useI18n';
import { colors, lineHeightFor, spacing } from '../../theme';

const APP_ICON = require('../../../../assets/brand/app-icon.png');

type AppBrandProps = {
  style?: StyleProp<ViewStyle>;
};

export function AppBrand({ style }: AppBrandProps) {
  const { t } = useI18n();
  return (
    <View style={[styles.container, style]}>
      {/* Same artwork as the launcher icon (assets/brand/app-icon.svg) */}
      <Image source={APP_ICON} style={styles.icon} />
      <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
        {t('app.name')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // The PNG has its corners rounded already
  icon: {
    width: 48,
    height: 48,
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 24,
    lineHeight: lineHeightFor(24),
    fontWeight: '600',
  },
});
