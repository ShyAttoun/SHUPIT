import { getMerchant } from '@shupit/contracts';
import { Copy, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { MerchantLogo } from '@/components/MerchantLogo';
import { Section } from '@/components/Section';
import { BottomSheet, Button, Text, TextField, useTheme, useToast } from '@/design';
import { CouponImportSheet } from '@/features/coupons/CouponImportSheet';
import { couponsForFavorites, useCouponActions, useCoupons } from '@/features/coupons/hooks';
import { useTranslation } from '@/i18n';

/** Coupons for the stores the user marked. Honest empty state: there is no automatic coupon feed yet. */
export function CouponsSection({ favoriteIds }: { favoriteIds: string[] }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const coupons = useCoupons();
  const { add, remove } = useCouponActions();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [store, setStore] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const toast = useToast();

  if (favoriteIds.length === 0) return null;
  const list = couponsForFavorites(coupons.data ?? [], favoriteIds);

  const copy = async (_id: string, value: string) => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) await navigator.clipboard.writeText(value);
      toast.show(t('home.coupons.copied'));
    } catch {
      // clipboard unavailable: the code stays visible for manual copy
    }
  };

  const save = async () => {
    const merchantId = store ?? favoriteIds[0]!;
    await add.mutateAsync({ merchantId, code, description: note });
    setCode('');
    setNote('');
    setAdding(false);
  };

  return (
    <Section
      tone="coupons"
      title={t('home.coupons.title')}
      action={
        <Button variant="ghost" label={t('home.coupons.add')} onPress={() => setAdding(true)} />
      }
    >
      {list.length === 0 ? (
        <Text color="textSecondary">{t('home.coupons.empty')}</Text>
      ) : null}

      {list.map((c) => {
        const m = getMerchant(c.merchantId);
        return (
          <View
            key={`${c.source}-${c.id}`}
            style={{
              gap: spacing.xs,
              padding: spacing.sm,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            {/* The code gets the full width, so it never wraps letter by letter. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MerchantLogo name={m?.name ?? c.merchantId} domain={m?.domains[0]} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyStrong" selectable style={{ flexShrink: 1 }}>
                  {c.code}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={2}>
                  {[m?.name, c.productId ? t('home.coupons.import.specificProduct') : null, c.description]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Button
                variant="secondary"
                label={t('home.coupons.copy')}
                icon={<Copy size={16} color={colors.text} />}
                style={{ minHeight: 40, paddingHorizontal: spacing.md }}
                onPress={() => void copy(c.id, c.code)}
              />
              {c.source === 'mine' ? (
                <Button
                  variant="ghost"
                  label={t('common.delete')}
                  icon={<Trash2 size={16} color={colors.text} />}
                  style={{ minHeight: 40, paddingHorizontal: spacing.md }}
                  onPress={() => remove.mutate(c.id)}
                />
              ) : null}
            </View>
          </View>
        );
      })}

      <View style={{ alignSelf: 'flex-start' }}>
        <Button variant="ghost" label={t('home.coupons.import.fromImport')} onPress={() => setImporting(true)} />
      </View>
      <CouponImportSheet visible={importing} onClose={() => setImporting(false)} merchantChoices={favoriteIds} />

      <BottomSheet visible={adding} title={t('home.coupons.add')} onClose={() => setAdding(false)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {favoriteIds.map((id) => (
            <Chip
              key={id}
              label={getMerchant(id)?.name ?? id}
              selected={(store ?? favoriteIds[0]) === id}
              onPress={() => setStore(id)}
            />
          ))}
        </View>
        <TextField label={t('home.coupons.code')} value={code} onChangeText={setCode} maxLength={60} autoCapitalize="characters" />
        <TextField label={t('home.coupons.note')} value={note} onChangeText={setNote} maxLength={200} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label={t('common.save')} disabled={!code.trim()} loading={add.isPending} onPress={() => void save()} />
          <Button variant="ghost" label={t('common.cancel')} onPress={() => setAdding(false)} />
        </View>
      </BottomSheet>
    </Section>
  );
}
