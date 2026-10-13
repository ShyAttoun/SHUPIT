import { Heart } from 'lucide-react-native';
import { EmptyState, Screen, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

export default function WishlistScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen>
      <EmptyState
        icon={<Heart size={32} color={colors.accentText} />}
        title={t('wishlist.emptyTitle')}
        body={t('wishlist.emptyBody')}
      />
    </Screen>
  );
}
