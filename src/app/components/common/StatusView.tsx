import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  isRateLimited,
  NetworkError,
  TimeoutError,
} from '../../../api/unsplash';
import type { TranslationKey } from '../../../i18n';
import { Focusable } from '../../../ui-kit/focus/Focusable';
import { useRetryOnRecovery } from '../../context/Connectivity';
import type { Translate } from '../../hooks/useI18n';
import { useI18n } from '../../hooks/useI18n';
import { colors, lineHeightFor, radius, spacing } from '../../theme';

export type StatusKind = 'loading' | 'empty' | 'error' | 'offline';

// Plain characters every TV font has
const BADGES: Record<Exclude<StatusKind, 'loading'>, string> = {
  empty: '—',
  error: '!',
  offline: '×',
};

// After this long a spinner also offers Retry, so a stuck request never
// leaves the remote with nothing to focus
const SLOW_LOADING_MS = 8000;

const DEFAULT_COPY: Record<
  StatusKind,
  { title: TranslationKey; message: TranslationKey }
> = {
  loading: {
    title: 'status.loading.title',
    message: 'status.loading.slow',
  },
  empty: {
    title: 'status.empty.title',
    message: 'status.empty.message',
  },
  error: {
    title: 'status.error.title',
    message: 'status.error.message',
  },
  offline: {
    title: 'status.offline.title',
    message: 'status.offline.message',
  },
};

// Maps a failed request to the state to show: no connection reads very
// differently on a TV than "the server said no". `errorTitle` describes what
// failed and is only used for server errors; offline keeps its own title.
export function statusForError(
  error: unknown,
  t: Translate,
  errorTitle?: string,
): { kind: 'error' | 'offline'; title?: string; message?: string } {
  if (error instanceof NetworkError) {
    return { kind: 'offline' };
  }
  if (error instanceof TimeoutError) {
    return { kind: 'error', title: errorTitle, message: t('status.timeout') };
  }
  if (isRateLimited(error)) {
    return {
      kind: 'error',
      title: errorTitle,
      message: t('status.rateLimited'),
    };
  }
  return { kind: 'error', title: errorTitle };
}

type StatusViewProps = {
  kind: StatusKind;
  // Prefix for the focus ids, unique per screen
  id: string;
  title?: string;
  message?: string;
  onRetry: () => void;
  // For states where trying again can't help, e.g. "Back"
  retryLabel?: string;
  // `inline` fits at the end of a list, e.g. when loading the next page fails
  variant?: 'screen' | 'inline';
  // Off when something else on the screen should get initial focus
  preferFocus?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StatusView({
  kind,
  id,
  title,
  message,
  onRetry,
  retryLabel,
  variant = 'screen',
  preferFocus = true,
  style,
}: StatusViewProps) {
  const { t } = useI18n();
  const copy = DEFAULT_COPY[kind];
  const label = retryLabel ?? t('common.retry');
  const inline = variant === 'inline';

  // Restarts whenever we (re-)enter the loading state
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (kind !== 'loading') {
      return;
    }
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_LOADING_MS);
    return () => clearTimeout(timer);
  }, [kind]);

  const retry = () => {
    setSlow(false);
    onRetry();
  };
  // Tries again by itself when the connection is back or the app returns
  useRetryOnRecovery(kind === 'error' || kind === 'offline', retry);

  if (kind === 'loading') {
    return (
      <View style={[inline ? styles.inline : styles.screen, style]}>
        <ActivityIndicator size="large" color={colors.focus} />
        {!inline && title && <Text style={styles.title}>{title}</Text>}
        {/* Laid out from the start and only revealed when loading is slow,
            so the spinner doesn't jump when they appear */}
        <View
          style={[styles.slow, !slow && styles.hidden]}
          importantForAccessibility={slow ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={!slow}
        >
          <Text style={styles.message}>{message ?? t(copy.message)}</Text>
          <RetryButton
            id={`${id}-retry`}
            label={label}
            onPress={retry}
            preferFocus={preferFocus}
            disabled={!slow}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[inline ? styles.inline : styles.screen, style]}>
      {!inline && (
        <View style={[styles.badge, styles[`badge_${kind}`]]}>
          <Text style={styles.badgeText}>{BADGES[kind]}</Text>
        </View>
      )}
      <Text style={inline ? styles.inlineTitle : styles.title}>
        {title ?? t(copy.title)}
      </Text>
      <Text style={styles.message}>{message ?? t(copy.message)}</Text>
      <RetryButton
        id={`${id}-retry`}
        label={label}
        onPress={retry}
        preferFocus={preferFocus}
      />
    </View>
  );
}

type RetryButtonProps = {
  id: string;
  label: string;
  onPress: () => void;
  preferFocus: boolean;
  disabled?: boolean;
};

function RetryButton({
  id,
  label,
  onPress,
  preferFocus,
  disabled = false,
}: RetryButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Focusable
      id={id}
      // Mounted (disabled) before it is needed: it takes focus when it is
      // enabled, as a newly shown button would
      hasTVPreferredFocus={preferFocus && !disabled}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.button, focused && styles.buttonFocused]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  slow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  hidden: {
    opacity: 0,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badge_empty: {
    backgroundColor: colors.surface,
  },
  badge_error: {
    backgroundColor: colors.danger,
  },
  badge_offline: {
    backgroundColor: colors.surfaceFocused,
  },
  badgeText: {
    color: colors.text,
    fontSize: 36,
    lineHeight: lineHeightFor(36),
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: lineHeightFor(28),
    fontWeight: '600',
    textAlign: 'center',
  },
  inlineTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: lineHeightFor(20),
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: 20,
    lineHeight: lineHeightFor(20),
    textAlign: 'center',
    maxWidth: 640,
  },
  button: {
    marginTop: spacing.sm,
    minWidth: 160,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  buttonFocused: {
    borderColor: colors.focus,
    backgroundColor: colors.surfaceFocused,
    transform: [{ scale: 1.05 }],
  },
  buttonText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: lineHeightFor(22),
    fontWeight: '600',
  },
});
