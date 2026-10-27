import { useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useRetryOnRecovery } from '../../context/Connectivity';
import { useI18n } from '../../hooks/useI18n';
import { colors, lineHeightFor } from '../../theme';

type PhotoImageProps = {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
  // Too small for words: the placeholder shows only a mark
  compact?: boolean;
};

// A photo that fails leaves a same-sized placeholder, so its card and its
// neighbours keep working; it loads again once the connection is back
export function PhotoImage({
  uri,
  style,
  resizeMode = 'cover',
  compact = false,
}: PhotoImageProps) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useRetryOnRecovery(failed, () => {
    setFailed(false);
    setAttempt(n => n + 1);
  });

  if (failed) {
    return (
      <View style={[style as object, styles.placeholder]}>
        <Text style={compact ? styles.mark : styles.label} numberOfLines={1}>
          {compact ? '!' : t('photo.unavailable')}
        </Text>
      </View>
    );
  }
  return (
    <Image
      key={attempt}
      source={{ uri }}
      resizeMode={resizeMode}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  label: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: lineHeightFor(18),
  },
  mark: {
    color: colors.textMuted,
    fontSize: 24,
    lineHeight: lineHeightFor(24),
    fontWeight: '700',
  },
});
