import type { SavedProduct } from '@shupit/contracts';
import { Pressable, View } from 'react-native';
import { Thumb } from '@/components/Thumb';
import { Button, Text, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { formatPrice } from '@/lib/format';

/** One saved product inside its brand group, with the call to action to go to the store. */
export function ProductCard({
  product,
  onOpen,
  onShop,
  shopping,
}: {
  product: SavedProduct;
  onOpen: () => void;
  onShop?: () => void;
  shopping?: boolean;
}) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { colors, spacing, radius, hitTarget } = useTheme();
  const price = formatPrice(product.savedPrice, language);

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.sm,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={product.title}
        onPress={onOpen}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: hitTarget + 24,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Thumb imageUrl={product.imageUrl} fallbackName={product.title} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {product.title}
          </Text>
          {price ? (
            <Text variant="small" color="textSecondary">
              {price}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {onShop ? (
        <Button
          variant="secondary"
          label={t('wishlist.takeMeToStore')}
          loading={shopping}
          onPress={onShop}
          style={{ minHeight: hitTarget }}
        />
      ) : null}
    </View>
  );
}
