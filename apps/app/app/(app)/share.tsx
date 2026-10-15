import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, LoadingState, Screen, Text, useTheme, useToast } from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOrders, useShipments } from '@/features/orders/hooks';
import { useAiConsent } from '@/features/privacy/AiConsent';
import { ApiError, apiFetch } from '@/lib/api';
import { useTranslation } from '@/i18n';
import { fileToPicked } from '@/lib/imageFile';
import type { PickedImage } from '@/lib/imagePicker';
import { useIncomingShare } from '@/lib/incomingShare';
import { firstUrl, useShareInbox } from '@/lib/shareInbox';

interface Received {
  title?: string;
  text?: string;
  url?: string;
  image?: PickedImage;
}

/** Reads what the PWA share target stored in the Cache API (Android/desktop Chrome). */
async function readSharedFromCache(): Promise<Received> {
  if (Platform.OS !== 'web' || typeof caches === 'undefined') return {};
  const cache = await caches.open('shupit-share-v1');
  const metaRes = await cache.match('/__shared/meta');
  if (!metaRes) return {};
  const meta = (await metaRes.json()) as { title?: string; text?: string; url?: string; hasImage?: boolean };
  let image: PickedImage | undefined;
  if (meta.hasImage) {
    const img = await cache.match('/__shared/image');
    if (img) {
      try {
        image = await fileToPicked(await img.blob());
      } catch {
        image = undefined;
      }
    }
  }
  await cache.delete('/__shared/meta');
  await cache.delete('/__shared/image');
  return { title: meta.title, text: meta.text, url: meta.url, image };
}

/** Sends a shared message to a chosen open shipment as pickup details (e.g. a pickup-point SMS). */
function PickupFromShared({ text }: { text: string }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const consent = useAiConsent();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orders = useOrders();
  const shipments = useShipments();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = new Map((orders.data ?? []).map((o) => [o.id, o.merchantName]));
  const candidates = (shipments.data ?? []).filter((s) => s.status !== 'delivered' && s.status !== 'returned');

  const send = useMutation({
    mutationFn: async (shipmentId: string) => {
      if (!(await consent.ensure())) return null;
      return apiFetch(`/api/shipments-pickup?id=${encodeURIComponent(shipmentId)}`, {
        method: 'POST',
        body: { kind: 'order', text: text.trim().slice(0, 2000) },
      });
    },
    onSuccess: async (res) => {
      if (!res) return;
      await qc.invalidateQueries({ queryKey: ['shipments', user?.uid] });
      toast.show(t('orders.receive.pickupSaved'));
      router.replace('/orders');
    },
    onError: (e) =>
      setError(
        e instanceof ApiError && e.code === 'no_pickup'
          ? t('orders.receive.noPickup')
          : e instanceof ApiError && e.code === 'consent_required'
            ? t('orders.import.consentRequired')
            : t('orders.import.generic'),
      ),
  });

  return (
    <View style={{ gap: spacing.sm }}>
      {consent.modal}
      <Button variant="secondary" label={t('share.pickupFromMessage')} onPress={() => setOpen((v) => !v)} />
      {open ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="label">{t('share.pickWhich')}</Text>
          {candidates.length === 0 ? <Text color="textSecondary">{t('share.noOpenShipments')}</Text> : null}
          {candidates.map((s) => (
            <Button
              key={s.id}
              variant="secondary"
              loading={send.isPending && send.variables === s.id}
              label={t('share.shipmentOption', {
                store: names.get(s.orderId) ?? '—',
                ref: [s.carrier, s.trackingNumber].filter(Boolean).join(' ') || t(`orders.status.${s.status}`),
              })}
              onPress={() => send.mutate(s.id)}
            />
          ))}
          {error ? (
            <Text color="danger" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function ShareScreen() {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; title?: string; text?: string; url?: string }>();
  const setInbox = useShareInbox((s) => s.set);
  const [received, setReceived] = useState<Received | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let r: Received = {};
      if (params.from === 'target') r = await readSharedFromCache().catch(() => ({}));
      // Native share sheet: the content was parked by useNativeShare.
      if (params.from === 'native') r = useIncomingShare.getState().take() ?? {};
      // GET-style share (query params) and manual deep links.
      r = {
        title: r.title ?? params.title,
        text: r.text ?? params.text,
        url: r.url ?? params.url,
        image: r.image,
      };
      if (!cancelled) setReceived(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.from, params.title, params.text, params.url]);

  if (!received) {
    return (
      <Screen>
        <LoadingState rows={2} />
      </Screen>
    );
  }

  const link = firstUrl(received.url, received.text, received.title);
  const hasText = !!(received.text && received.text.trim().length >= 20);
  const hasAnything = !!(link || hasText || received.image);
  const sharedText = (received.text ?? '').trim();

  const toProduct = (extra: { url?: string; image?: PickedImage }) => {
    setInbox(extra);
    router.replace('/product/add');
  };
  const toOrder = (extra: { url?: string; text?: string; image?: PickedImage }) => {
    setInbox(extra);
    router.replace('/order/add');
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <Text variant="title" accessibilityRole="header">
          {t('share.title')}
        </Text>

        {!hasAnything ? (
          <Text color="textSecondary">{t('share.nothing')}</Text>
        ) : (
          <View
            style={{
              gap: spacing.xs,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {link ? (
              <Text numberOfLines={3} variant="small">
                {link}
              </Text>
            ) : null}
            {received.text && !link ? (
              <Text numberOfLines={5} variant="small">
                {received.text}
              </Text>
            ) : null}
            {received.image ? <Text variant="small">{t('share.imageReceived')}</Text> : null}
          </View>
        )}

        {link ? (
          <View style={{ gap: spacing.sm }}>
            <Button label={t('share.saveToWishlist')} onPress={() => toProduct({ url: link })} />
            <Button variant="secondary" label={t('share.addOrderFromLink')} onPress={() => toOrder({ url: link })} />
          </View>
        ) : null}

        {hasText && !link ? (
          <Button label={t('share.readAsOrder')} onPress={() => toOrder({ text: received.text })} />
        ) : null}
        {hasText && link ? (
          <Button variant="ghost" label={t('share.readAsOrder')} onPress={() => toOrder({ text: received.text })} />
        ) : null}

        {sharedText.length >= 10 ? <PickupFromShared text={sharedText} /> : null}

        {received.image ? (
          <View style={{ gap: spacing.sm }}>
            <Button label={t('share.addOrderFromImage')} onPress={() => toOrder({ image: received.image })} />
            <Button
              variant="secondary"
              label={t('share.saveProductFromImage')}
              onPress={() => toProduct({ image: received.image })}
            />
          </View>
        ) : null}

        <Button variant="ghost" label={t('common.cancel')} onPress={() => router.replace('/')} />
        <Text variant="caption" color="textSecondary">
          {t('share.privacy')}
        </Text>
      </View>
    </Screen>
  );
}
