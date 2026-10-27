import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FocusGroup } from '../../ui-kit/focus/FocusGroup';
import { useScreenMargins } from '../../ui-kit/layout/DesignCanvas';

import { LANGUAGE_NAMES, LANGUAGES } from '../../i18n';
import { getDeviceDetails } from '../../platform/deviceInfo';
import { AppBrand } from '../components/common/AppBrand';
import { BackButton } from '../components/common/BackButton';
import { RadioOption } from '../components/common/RadioOption';
import { useI18n } from '../hooks/useI18n';
import { SLIDESHOW_INTERVALS_MS, useSettings } from '../context/Settings';
import { colors, lineHeightFor, radius, spacing } from '../theme';

const DETAIL_LABEL_WIDTH = 160;

type SettingsScreenProps = {
  onBack: () => void;
};

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const margins = useScreenMargins();
  const gutterLeft = margins.left;
  const gutterRight = margins.right;

  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const device = useMemo(getDeviceDetails, []);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: margins.top,
            paddingLeft: gutterLeft,
            paddingRight: gutterRight,
          },
        ]}
      >
        <BackButton id="settings-back" onPress={onBack} />
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: gutterLeft,
            paddingRight: gutterRight,
            paddingBottom: margins.bottom,
          },
        ]}
      >
        <Section title={t('settings.slideshow')}>
          <Text style={styles.label}>{t('settings.speed')}</Text>
          <Text style={styles.hint}>{t('settings.speedHint')}</Text>
          <Options>
            {SLIDESHOW_INTERVALS_MS.map(ms => (
              <RadioOption
                key={ms}
                id={`settings-speed-${ms}`}
                label={t('settings.seconds', { count: ms / 1000 })}
                selected={settings.slideshowIntervalMs === ms}
                // The screen opens on the current choice
                preferFocus={settings.slideshowIntervalMs === ms}
                onPress={() => updateSettings({ slideshowIntervalMs: ms })}
              />
            ))}
          </Options>
        </Section>

        <Section title={t('settings.language')}>
          <Text style={styles.hint}>{t('settings.languageHint')}</Text>
          <Options>
            {LANGUAGES.map(language => (
              <RadioOption
                key={language}
                id={`settings-language-${language}`}
                label={LANGUAGE_NAMES[language]}
                selected={settings.language === language}
                onPress={() => updateSettings({ language })}
              />
            ))}
          </Options>
        </Section>

        <Section title={t('settings.about')}>
          <View style={styles.aboutHeader}>
            <AppBrand />
            <Text style={styles.version}>
              {t('settings.version', { version: device.appVersion })}
            </Text>
          </View>
          <Detail
            label={t('settings.device')}
            value={device.model || t('settings.unknown')}
          />
          <Detail
            label={t('settings.system')}
            value={device.system || t('settings.unknown')}
          />
          <Text style={styles.body}>{t('settings.aboutDescription')}</Text>
          <Text style={styles.body}>{t('settings.photosCredit')}</Text>
          <Text style={styles.body}>{t('settings.controls')}</Text>
        </Section>
      </ScrollView>
    </View>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// One row of choices. Left/right stay in it: on Android, Right from the
// last language jumped diagonally up to a speed
function Options({ children }: { children: ReactNode }) {
  return (
    <FocusGroup
      style={styles.options}
      autoFocus={false}
      trapFocusLeft
      trapFocusRight
    >
      {children}
    </FocusGroup>
  );
}

type DetailProps = {
  label: string;
  value: string;
};

// Labels share one column width, so the values line up in either language
function Detail({ label, value }: DetailProps) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    lineHeight: lineHeightFor(40),
    fontWeight: '700',
  },
  content: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  section: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: lineHeightFor(28),
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 22,
    lineHeight: lineHeightFor(22),
    fontWeight: '600',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: lineHeightFor(18),
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  version: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: lineHeightFor(18),
  },
  detail: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailLabel: {
    width: DETAIL_LABEL_WIDTH,
    color: colors.textMuted,
    fontSize: 20,
    lineHeight: 30,
  },
  detailValue: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    lineHeight: 30,
  },
  body: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 30,
  },
});
