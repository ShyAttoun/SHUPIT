import { Package } from 'lucide-react-native';
import { EmptyState, Screen, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

export default function OrdersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen>
      <EmptyState
        icon={<Package size={32} color={colors.accentText} />}
        title={t('orders.emptyTitle')}
        body={t('orders.emptyBody')}
      />
    </Screen>
  );
}
