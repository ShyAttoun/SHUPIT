import { getMerchant } from '@shupit/contracts';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AiWait } from '@/components/AiWait';
import { Chip } from '@/components/Chip';
import { BottomSheet, Button, Text, TextField, useTheme, useToast } from '@/design';
import { useAiConsent } from '@/features/privacy/AiConsent';
import { useTranslation } from '@/i18n';
import { ApiError, apiFetch } from '@/lib/api';
import { pickScreenshot } from '@/lib/imagePicker';
import { useCouponActions, useCoupons } from './hooks';

interface Found {
  code: string;
  description?: string;
  expiresAt?: string;
}

/**
 * Finds coupon codes on a page link or in a screenshot (e.g. an iHerb promo page) and lets the user
 * choose which ones to keep. Codes are only suggestions until the user saves them.
 */
export function CouponImportSheet({
  visible,
  onClose,
  merchantChoices,
  defaultMerchantId,
  defaultUrl,
  productId,
}: {
  visible: boolean;
  onClose: () => void;
  /** Stores offered when the page does not reveal which store the codes belong to. */
  merchantChoices: string[];
  defaultMerchantId?: string | null;
  defaultUrl?: string;
  /** When opened from a saved product, the codes are saved for that product only. */
  productId?: string;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const toast = useToast();
  const consent = useAiConsent();
  const { add } = useCouponActions();
  const existing = useCoupons();
  const [url, setUrl] = useState(defaultUrl ?? '');
  const [found, setFound] = useState<Found[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [merchantId, setMerchantId] = useState<string | null>(defaultMerchantId ?? null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setUrl(defaultUrl ?? '');
      setFound(null);
      setChosen(new Set());
      setMerchantId(defaultMerchantId ?? null);
      setMessage(null);
    }
  }, [visible, defaultUrl, defaultMerchantId]);

  const read = useMutation({
    mutationFn: async (source: { url: string } | 'image') => {
      if (!(await consent.ensure())) return null;
      if (source === 'image') {
        const picked = await pickScreenshot();
        if (!picked) return null;
        return apiFetch<{ coupons: Found[]; merchantId: string | null }>('/api/extract', {
          method: 'POST',
          body: { kind: 'coupons', imageBase64: picked.base64, mediaType: picked.mediaType },
        });
      }
      return apiFetch<{ coupons: Found[]; merchantId: string | null }>('/api/extract', {
        method: 'POST',
        body: { kind: 'coupons', url: source.url },
      });
    },
    onSuccess: (res) => {
      if (!res) return;
      setFound(res.coupons);
      setChosen(new Set(res.coupons.map((c) => c.code)));
      if (res.merchantId) setMerchantId(res.merchantId);
      setMessage(res.coupons.length === 0 ? t('home.coupons.import.none') : null);
    },
    onError: (e) =>
      setMessage(
        e instanceof ApiError && e.code === 'consent_required'
          ? t('orders.import.consentRequired')
          : e instanceof ApiError && e.code === 'quota_exceeded'
            ? t('orders.import.quota')
            : e instanceof ApiError && e.code === 'blocked_by_site'
              ? t('wishlist.add.blockedSite')
              : e instanceof ApiError && (e.code === 'unreadable' || e.code === 'unsafe_url')
              ? t('home.coupons.import.unreadable')
              : t('orders.import.generic'),
      ),
  });

  const target = merchantId ?? null;
  const known = new Set((existing.data ?? []).filter((c) => c.merchantId === target).map((c) => c.code.toUpperCase()));
  const toSave = (found ?? []).filter((c) => chosen.has(c.code) && !known.has(c.code));

  const save = async () => {
    if (!target) return;
    for (const c of toSave) {
      await add.mutateAsync({
        merchantId: target,
        code: c.code,
        description: c.description,
        expiresAt: c.expiresAt,
        ...(productId ? { productId } : {}),
      });
    }
    toast.show(t('home.coupons.import.saved', { count: toSave.length }));
    onClose();
  };

  return (
    <BottomSheet visible={visible} title={t('home.coupons.import.title')} onClose={onClose}>
      {consent.modal}
      {found === null ? (
        <View style={{ gap: spacing.sm }}>
          <Text color="textSecondary">{t('home.coupons.import.body')}</Text>
          <TextField
            label={t('home.coupons.import.link')}
            value={url}
            onChangeText={setUrl}
            placeholder="https://"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Button
            label={t('home.coupons.import.fromLink')}
            disabled={!/^https?:\/\//i.test(url.trim())}
            loading={read.isPending && typeof read.variables === 'object'}
            onPress={() => read.mutate({ url: url.trim() })}
          />
          <Button
            variant="secondary"
            label={t('home.coupons.import.fromShot')}
            loading={read.isPending && read.variables === 'image'}
            onPress={() => read.mutate('image')}
          />
          <AiWait active={read.isPending} />
          {message ? (
            <Text color="textSecondary" accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {found.length === 0 ? (
            <>
              <Text accessibilityLiveRegion="polite">{message}</Text>
              <Button variant="secondary" label={t('common.back')} onPress={() => setFound(null)} />
            </>
          ) : (
            <>
              <Text variant="small" color="textSecondary">
                {t('home.coupons.import.review')}
              </Text>
              {found.map((c) => {
                const on = chosen.has(c.code);
                const dup = known.has(c.code);
                return (
                  <Pressable
                    key={c.code}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on && !dup, disabled: dup }}
                    disabled={dup}
                    onPress={() =>
                      setChosen((s) => {
                        const n = new Set(s);
                        if (n.has(c.code)) n.delete(c.code);
                        else n.add(c.code);
                        return n;
                      })
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: on && !dup ? colors.accent : colors.border,
                      backgroundColor: colors.surface,
                      opacity: dup ? 0.6 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: colors.accent,
                        backgroundColor: on && !dup ? colors.accent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on && !dup ? <Check size={16} color={colors.onAccent} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{c.code}</Text>
                      <Text variant="caption" color="textSecondary">
                        {[dup ? t('home.coupons.import.alreadySaved') : null, c.description, c.expiresAt]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {!merchantId ? (
                <View style={{ gap: spacing.xs }}>
                  <Text variant="label">{t('home.coupons.import.whichStore')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {merchantChoices.map((id) => (
                      <Chip key={id} label={getMerchant(id)?.name ?? id} selected={false} onPress={() => setMerchantId(id)} />
                    ))}
                  </View>
                </View>
              ) : (
                <Text variant="small">
                  {t('home.coupons.import.forStore', { store: getMerchant(merchantId)?.name ?? merchantId })}
                </Text>
              )}
              <Button
                label={t('home.coupons.import.save', { count: toSave.length })}
                disabled={!target || toSave.length === 0}
                loading={add.isPending}
                onPress={() => void save()}
              />
            </>
          )}
        </View>
      )}
    </BottomSheet>
  );
}
