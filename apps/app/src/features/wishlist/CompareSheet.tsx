import type { SavedProduct } from '@shupit/contracts';
import { ExternalLink } from 'lucide-react-native';
import { View } from 'react-native';
import { BottomSheet, Button, Text, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { openStore } from '@/lib/platform';
import { compareLinks } from './totals';

/**
 * Price comparison by search: opens each item's search on comparison sites. We do not fetch or show
 * other stores' prices ourselves; there is no authorized price source for that.
 */
export function CompareSheet({
  visible,
  title,
  products,
  onClose,
}: {
  visible: boolean;
  title: string;
  products: SavedProduct[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { colors, spacing, radius } = useTheme();
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <Text variant="small" color="textSecondary">
        {t('wishlist.compare.note')}
      </Text>
      {products.slice(0, 30).map((p) => (
        <View
          key={p.id}
          style={{
            gap: spacing.xs,
            padding: spacing.sm,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text variant="bodyStrong" numberOfLines={2}>
            {p.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {compareLinks(p.title, language).map((l) => (
              <Button
                key={l.id}
                variant="secondary"
                label={t(`wishlist.compare.${l.id}`)}
                icon={<ExternalLink size={16} color={colors.text} />}
                style={{ minHeight: 40, paddingHorizontal: spacing.md }}
                onPress={() => void openStore(l.url)}
              />
            ))}
          </View>
        </View>
      ))}
    </BottomSheet>
  );
}
