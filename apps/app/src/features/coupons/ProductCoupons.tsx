import { getMerchant } from '@shupit/contracts';
import { Copy } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Text, useTheme, useToast } from '@/design';
import { useTranslation } from '@/i18n';
import { CouponImportSheet } from './CouponImportSheet';
import { useCoupons } from './hooks';

/** Saved coupon codes for the product's store, ready to copy, plus a way to find more. */
export function ProductCoupons({ merchantId, productUrl }: { merchantId: string; productUrl?: string }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const toast = useToast();
  const coupons = useCoupons();
  const [finding, setFinding] = useState(false);
  const store = getMerchant(merchantId)?.name ?? merchantId;
  const list = (coupons.data ?? [])
    .filter((c) => c.merchantId === merchantId)
    .filter((c) => !c.expiresAt || Date.parse(c.expiresAt) >= Date.now());

  const copy = async (code: string) => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) await navigator.clipboard.writeText(code);
      toast.show(t('home.coupons.copied'));
    } catch {
      // clipboard unavailable: the code stays visible
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="headline">{t('home.coupons.import.productTitle', { store })}</Text>
      {list.length === 0 ? (
        <Text variant="small" color="textSecondary">
          {t('home.coupons.import.productEmpty')}
        </Text>
      ) : (
        list.map((c) => (
          <View
            key={c.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" selectable>
                {c.code}
              </Text>
              {c.description || c.expiresAt ? (
                <Text variant="caption" color="textSecondary">
                  {[c.description, c.expiresAt].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            <Button
              variant="secondary"
              label={t('home.coupons.copy')}
              icon={<Copy size={16} color={colors.text} />}
              style={{ minHeight: 40 }}
              onPress={() => void copy(c.code)}
            />
          </View>
        ))
      )}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button variant="ghost" label={t('home.coupons.import.productFind')} onPress={() => setFinding(true)} />
      </View>
      <CouponImportSheet
        visible={finding}
        onClose={() => setFinding(false)}
        merchantChoices={[merchantId]}
        defaultMerchantId={merchantId}
        defaultUrl={productUrl}
      />
    </View>
  );
}
