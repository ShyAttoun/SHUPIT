import { getMerchant } from '@shupit/contracts';
import { Copy, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { MerchantLogo } from '@/components/MerchantLogo';
import { Section } from '@/components/Section';
import { Button, Text, TextField, useTheme } from '@/design';
import { couponsForFavorites, useCouponActions, useCoupons } from '@/features/coupons/hooks';
import { useTranslation } from '@/i18n';

/** Coupons for the stores the user marked. Honest empty state: there is no automatic coupon feed yet. */
export function CouponsSection({ favoriteIds }: { favoriteIds: string[] }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const coupons = useCoupons();
  const { add, remove } = useCouponActions();
  const [adding, setAdding] = useState(false);
  const [store, setStore] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  if (favoriteIds.length === 0) return null;
  const list = couponsForFavorites(coupons.data ?? [], favoriteIds);

  const copy = async (id: string, value: string) => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
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
      title={t('home.coupons.title')}
      action={
        adding ? undefined : (
          <Button variant="ghost" label={t('home.coupons.add')} onPress={() => setAdding(true)} />
        )
      }
    >
      {list.length === 0 && !adding ? (
        <Text color="textSecondary">{t('home.coupons.empty')}</Text>
      ) : null}

      {list.map((c) => {
        const m = getMerchant(c.merchantId);
        return (
          <View
            key={`${c.source}-${c.id}`}
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
            <MerchantLogo name={m?.name ?? c.merchantId} domain={m?.domains[0]} size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{c.code}</Text>
              <Text variant="caption" color="textSecondary" numberOfLines={2}>
                {[m?.name, c.description].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Button
              variant="secondary"
              label={copied === c.id ? t('home.coupons.copied') : t('home.coupons.copy')}
              icon={<Copy size={16} color={colors.text} />}
              onPress={() => void copy(c.id, c.code)}
            />
            {c.source === 'mine' ? (
              <Button
                variant="ghost"
                label={t('common.delete')}
                icon={<Trash2 size={16} color={colors.text} />}
                onPress={() => remove.mutate(c.id)}
              />
            ) : null}
          </View>
        );
      })}

      {adding ? (
        <View style={{ gap: spacing.sm }}>
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
            <Button
              label={t('common.save')}
              disabled={!code.trim()}
              loading={add.isPending}
              onPress={() => void save()}
            />
            <Button variant="ghost" label={t('common.cancel')} onPress={() => setAdding(false)} />
          </View>
        </View>
      ) : null}
    </Section>
  );
}
