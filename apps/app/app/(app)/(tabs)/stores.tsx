import { Store } from 'lucide-react-native';
import { EmptyState, Screen, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

export default function StoresScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen>
      <EmptyState
        icon={<Store size={32} color={colors.accentText} />}
        title={t('stores.emptyTitle')}
        body={t('stores.emptyBody')}
      />
    </Screen>
  );
}
