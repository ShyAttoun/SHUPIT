import { Home } from 'lucide-react-native';
import { EmptyState, Screen, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen>
      <EmptyState
        icon={<Home size={32} color={colors.accentText} />}
        title={t('home.emptyTitle')}
        body={t('home.emptyBody')}
      />
    </Screen>
  );
}
