import type { StyleProp, ViewStyle } from 'react-native';

import { useI18n } from '../../hooks/useI18n';
import { TextButton } from './TextButton';

type BackButtonProps = {
  id: string;
  onPress: () => void;
  onFocus?: () => void;
  style?: StyleProp<ViewStyle>;
};

// The remote's back button also works; this is for pointer users
export function BackButton(props: BackButtonProps) {
  const { t } = useI18n();
  return <TextButton {...props} label={t('common.back')} />;
}
