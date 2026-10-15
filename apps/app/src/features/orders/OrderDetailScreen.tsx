import { merchantByName, type TrackingEvent } from '@shupit/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import {
  CalendarDays,
  Camera,
  Check,
  ClipboardPaste,
  Copy,
  FilePenLine,
  MapPin,
  MoreHorizontal,
  Navigation,
  PackagePlus,
  Pencil,
  RefreshCw,
  Store,
  Trash2,
  Undo2,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { AiWait } from '@/components/AiWait';
import { MerchantLogo } from '@/components/MerchantLogo';
import { ShipmentProgress } from '@/components/ShipmentProgress';
import { StatusBadge } from '@/components/StatusBadge';
import { Thumb } from '@/components/Thumb';
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@/design';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAiConsent } from '@/features/privacy/AiConsent';
import { useShopNow } from '@/features/stores/useShopNow';
import { useAppLanguage, useTranslation } from '@/i18n';
import { ApiError, apiFetch } from '@/lib/api';
import { db } from '@/lib/firebase';
import { formatDate, formatDateTime, formatDateTimeWall, formatPrice } from '@/lib/format';
import { pickScreenshot } from '@/lib/imagePicker';
import { confirmAction } from '@/lib/platform';
import { openWaze } from '@/lib/waze';
import { copyToClipboard } from '@/lib/clipboard';
import { openExternal } from '@/lib/platform';
import { useOrderMutations, useOrders, useShipments, type ShipmentDoc } from './hooks';

type Tr = (key: string, opts?: Record<string, unknown>) => string;

function aiErrorMessage(e: unknown, t: Tr, specific?: Record<string, string>): string {
  if (e instanceof ApiError) {
    if (specific?.[e.code]) return specific[e.code]!;
    if (e.code === 'consent_required') return t('orders.import.consentRequired');
    if (e.code === 'not_configured') return t('orders.import.notConfigured');
    if (e.code === 'quota_exceeded') return t('orders.import.quota');
  }
  return t('orders.import.generic');
}

async function copyText(value: string): Promise<boolean> {
  try {
    return await copyToClipboard(value);
  } catch {
    // clipboard unavailable
  }
  return false;
}

/** Small round icon button with a text label for assistive tech. */
function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const { colors, hitTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: hitTarget,
        height: hitTarget,
        borderRadius: hitTarget / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.accentSoft : 'transparent',
      })}
    >
      {children}
    </Pressable>
  );
}

/** One row of an actions sheet. */
function MenuRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors, spacing, radius, hitTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: hitTarget + 4,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.accentSoft : 'transparent',
      })}
    >
      {icon}
      <Text variant="bodyStrong" color={danger ? 'danger' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

function Timeline({ shipment }: { shipment: ShipmentDoc }) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const [all, setAll] = useState(false);
  const events = useQuery({
    queryKey: ['trackingEvents', user?.uid, shipment.id],
    enabled: !!user,
    queryFn: async (): Promise<(TrackingEvent & { timeIsWallClock?: boolean; source?: string })[]> => {
      const snap = await getDocs(collection(db, 'users', user!.uid, 'shipments', shipment.id, 'trackingEvents'));
      return snap.docs
        .map((d) => d.data() as TrackingEvent & { timeIsWallClock?: boolean; source?: string })
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    },
  });

  if (events.isLoading) return <LoadingState rows={1} />;
  const list = events.data ?? [];
  if (events.isError || list.length === 0) {
    return (
      <Text variant="small" color="textSecondary">
        {t('orders.detail.noEvents')}
      </Text>
    );
  }
  const shown = all ? list : list.slice(0, 3);
  return (
    <View style={{ gap: spacing.xs }}>
      {shown.map((e, i) => {
        const verified = e.source === 'carrier';
        return (
          <View key={e.id} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ alignItems: 'center', width: 14 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  marginTop: 5,
                  backgroundColor: i === 0 ? colors.accent : colors.border,
                  borderWidth: i === 0 ? 0 : 2,
                  borderColor: colors.accent,
                }}
              />
              {i < shown.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.border }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing.sm, gap: 2 }}>
              <Text variant="bodyStrong">{e.description || t(`orders.status.${e.status}`)}</Text>
              <Text variant="caption" color="textSecondary">
                {e.timeIsWallClock ? formatDateTimeWall(e.occurredAt, language) : formatDateTime(e.occurredAt, language)}
                {e.location?.text ? ` · ${e.location.text}` : ''}
              </Text>
              <Text variant="caption" color={verified ? 'success' : 'textSecondary'}>
                {verified ? t('orders.detail.eventVerified') : t('orders.detail.eventPage')}
              </Text>
            </View>
          </View>
        );
      })}
      {list.length > 3 ? (
        <Button
          variant="ghost"
          label={all ? t('orders.detail.showLess') : t('orders.detail.showAll', { count: list.length })}
          onPress={() => setAll((v) => !v)}
        />
      ) : null}
    </View>
  );
}

function ShipmentCard({
  order,
  shipment,
  index,
  total,
  archived,
  onReceived,
  receiving,
}: {
  order: { id: string; merchantId?: string; merchantName: string };
  shipment: ShipmentDoc;
  index: number;
  total: number;
  archived: boolean;
  onReceived: () => void;
  receiving: boolean;
}) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const consent = useAiConsent();
  const { colors, spacing, radius, elevation } = useTheme();
  const [menu, setMenu] = useState(false);
  const [pickupSheet, setPickupSheet] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [statusSheet, setStatusSheet] = useState(false);
  const [statusPasting, setStatusPasting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const s = shipment;
  const finished = s.status === 'delivered' || s.status === 'returned';
  const refreshAll = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['shipments', user?.uid] }),
      qc.invalidateQueries({ queryKey: ['trackingEvents', user?.uid, s.id] }),
      qc.invalidateQueries({ queryKey: ['notifications', user?.uid] }),
    ]);

  const refresh = useMutation({
    mutationFn: () =>
      apiFetch<{ outcome: string }>(`/api/shipments-refresh?id=${encodeURIComponent(s.id)}`, { method: 'POST' }),
    onSuccess: async (res) => {
      setMessage(
        res.outcome === 'not_configured'
          ? t('orders.detail.notConfigured')
          : res.outcome === 'too_soon'
            ? t('orders.detail.tooSoon')
            : res.outcome === 'provider_error'
              ? t('orders.detail.refreshFailed')
              : t('orders.detail.refreshed'),
      );
      await refreshAll();
    },
    onError: () => setMessage(t('orders.detail.refreshFailed')),
  });

  // Update the shipment's status from a carrier screenshot or a pasted carrier SMS.
  const statusShot = useMutation({
    mutationFn: async (source: 'image' | 'text') => {
      if (!(await consent.ensure())) return null;
      const url = `/api/shipments-status?id=${encodeURIComponent(s.id)}`;
      if (source === 'text') {
        return apiFetch(url, { method: 'POST', body: { kind: 'order', text: statusMsg.trim() } });
      }
      const picked = await pickScreenshot();
      if (!picked) return null;
      return apiFetch(url, {
        method: 'POST',
        body: { kind: 'order', imageBase64: picked.base64, mediaType: picked.mediaType },
      });
    },
    onSuccess: async (res) => {
      if (!res) return;
      setStatusSheet(false);
      setStatusPasting(false);
      setStatusMsg('');
      setMessage(t('orders.detail.updated'));
      toast.show(t('orders.detail.updated'));
      await refreshAll();
    },
    onError: (e) => setMessage(aiErrorMessage(e, t as Tr, { no_status: t('orders.detail.noStatus') })),
  });

  const pickup = useMutation({
    mutationFn: async (source: 'text' | 'image') => {
      if (!(await consent.ensure())) return null;
      const url = `/api/shipments-pickup?id=${encodeURIComponent(s.id)}`;
      if (source === 'text') return apiFetch(url, { method: 'POST', body: { kind: 'order', text: text.trim() } });
      const picked = await pickScreenshot();
      if (!picked) return null;
      return apiFetch(url, {
        method: 'POST',
        body: { kind: 'order', imageBase64: picked.base64, mediaType: picked.mediaType },
      });
    },
    onSuccess: async (res) => {
      if (!res) return;
      setPickupSheet(false);
      setPasting(false);
      setText('');
      toast.show(t('orders.receive.pickupSaved'));
      await refreshAll();
    },
    onError: (e) => setMessage(aiErrorMessage(e, t as Tr, { no_pickup: t('orders.receive.noPickup') })),
  });

  const hasPickup = !!s.pickup && Object.values(s.pickup).some((v) => v !== undefined && v !== null && v !== '');
  const eta = s.estimatedDeliveryAt
    ? `${s.estimatedDeliveryFrom ? `${formatDate(s.estimatedDeliveryFrom, language)} – ` : ''}${formatDate(s.estimatedDeliveryAt, language)}`
    : null;
  const carrierLine = [s.carrier, s.trackingNumber].filter(Boolean).join(' · ');

  // One primary action that fits the current state; everything else lives in the ⋯ menu.
  const primary: { label: string; onPress: () => void; loading?: boolean } | null = archived
    ? null
    : s.status === 'ready_for_pickup' && !hasPickup
      ? { label: t('orders.detail.addPickup'), onPress: () => setPickupSheet(true) }
      : s.status === 'ready_for_pickup' || s.status === 'delivered'
        ? { label: t('orders.receive.received'), onPress: onReceived, loading: receiving }
        : s.trackingNumber && !finished
          ? { label: t('orders.detail.checkUpdates'), onPress: () => refresh.mutate(), loading: refresh.isPending }
          : !finished
            ? { label: t('orders.detail.updateShipment'), onPress: () => setStatusSheet(true), loading: statusShot.isPending }
            : null;

  const source =
    s.statusSource === 'user' && s.statusAsOf
      ? `${t('orders.detail.sourceSetByYou')} · ${formatDate(s.statusAsOf, language)}`
      : s.statusSource === 'ai_vision' && s.statusAsOf
        ? `${t('orders.detail.sourceShot')} · ${formatDate(s.statusAsOf, language)}`
        : null;

  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        ...elevation(1),
      }}
    >
      {consent.modal}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
            <StatusBadge status={s.status} />
            {total > 1 ? (
              <Text variant="caption" color="textSecondary">
                {t('orders.detail.shipmentN', { n: index + 1 })}
              </Text>
            ) : null}
          </View>
          {carrierLine ? (
            <Text variant="small" color="textSecondary" numberOfLines={1}>
              {carrierLine}
            </Text>
          ) : null}
        </View>
        {s.trackingNumber ? (
          <IconButton
            label={t('orders.detail.copy')}
            onPress={() => void copyText(s.trackingNumber!).then((ok) => ok && toast.show(t('orders.detail.copied')))}
          >
            <Copy size={18} color={colors.textSecondary} />
          </IconButton>
        ) : null}
        <IconButton label={t('orders.detail.shipmentMenu')} onPress={() => setMenu(true)}>
          <MoreHorizontal size={22} color={colors.text} />
        </IconButton>
      </View>

      <ShipmentProgress status={s.status} labels />

      {s.statusText || eta || source ? (
        <View style={{ gap: 2 }}>
          {s.statusText ? <Text variant="small">{s.statusText}</Text> : null}
          {eta ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CalendarDays size={14} color={colors.textSecondary} />
              <Text variant="small">
                {s.estimatedDeliveryFrom ? t('orders.detail.etaWindow') : t('orders.detail.eta')}: {eta}
                {s.estimatedDeliverySource === 'user' ? ` (${t('orders.detail.etaUser')})` : ''}
              </Text>
            </View>
          ) : null}
          {source ? (
            <Text variant="caption" color="textSecondary">
              {source}
            </Text>
          ) : null}
        </View>
      ) : null}

      {hasPickup ? (
        <View
          style={{
            gap: spacing.xs,
            padding: spacing.sm,
            borderRadius: radius.lg,
            backgroundColor: colors.accentSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MapPin size={16} color={colors.accentText} />
            <Text variant="label" color="accentText">
              {t('orders.detail.pickupCardTitle')}
            </Text>
          </View>
          {s.pickup?.name ? <Text variant="bodyStrong">{s.pickup.name}</Text> : null}
          {s.pickup?.address ? <Text variant="small">{s.pickup.address}</Text> : null}
          {s.pickup?.until ? (
            <Text variant="small">
              {t('orders.detail.pickupUntil')}: {formatDate(s.pickup.until, language)}
            </Text>
          ) : null}
          {s.pickup?.instructions ? <Text variant="small">{s.pickup.instructions}</Text> : null}
          {s.pickup?.code ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('orders.detail.collectionCode')}: ${s.pickup.code}. ${t('orders.detail.copy')}`}
              onPress={() => void copyText(s.pickup!.code!).then((ok) => ok && toast.show(t('orders.detail.copied')))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Text variant="small">
                {t('orders.detail.collectionCode')}: <Text variant="bodyStrong">{s.pickup.code}</Text>
              </Text>
              <Copy size={14} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          {s.pickup?.address ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Button
                label={t('orders.detail.waze')}
                icon={<Navigation size={16} color={colors.onAccent} />}
                style={{ minHeight: 40, paddingHorizontal: spacing.md }}
                onPress={() => void openWaze({ address: s.pickup!.address, lat: s.pickup!.lat, lng: s.pickup!.lng })}
              />
              <Button
                variant="secondary"
                label={t('orders.detail.copyAddress')}
                icon={<Copy size={16} color={colors.text} />}
                style={{ minHeight: 40, paddingHorizontal: spacing.md }}
                onPress={() => void copyText(s.pickup!.address!).then((ok) => ok && toast.show(t('orders.detail.copied')))}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {primary ? (
        <Button
          label={primary.label}
          loading={primary.loading}
          onPress={primary.onPress}
          style={{ minHeight: 44 }}
        />
      ) : null}

      <AiWait active={statusShot.isPending || pickup.isPending} />
      {message ? (
        <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}

      <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
        <Text variant="label" color="textSecondary">
          {t('orders.detail.activity')}
        </Text>
        <Timeline shipment={s} />
      </View>

      {/* Shipment actions */}
      <BottomSheet visible={menu} title={t('orders.detail.shipmentMenu')} onClose={() => setMenu(false)}>
        <View style={{ gap: 2 }}>
          <MenuRow
            icon={<FilePenLine size={20} color={colors.text} />}
            label={t('edit.shipment.edit')}
            onPress={() => {
              setMenu(false);
              router.push(`/shipment/${order.id}?id=${s.id}`);
            }}
          />
          {!finished ? (
            <MenuRow
              icon={<Camera size={20} color={colors.text} />}
              label={t('orders.detail.updateShipment')}
              onPress={() => {
                setMenu(false);
                setStatusSheet(true);
              }}
            />
          ) : null}
          {s.trackingNumber && !finished ? (
            <MenuRow
              icon={<RefreshCw size={20} color={colors.text} />}
              label={t('orders.detail.checkUpdates')}
              onPress={() => {
                setMenu(false);
                refresh.mutate();
              }}
            />
          ) : null}
          {!finished ? (
            <MenuRow
              icon={<MapPin size={20} color={colors.text} />}
              label={t('orders.detail.addPickup')}
              onPress={() => {
                setMenu(false);
                setPickupSheet(true);
              }}
            />
          ) : null}
        </View>
      </BottomSheet>

      {/* Update status: a carrier screenshot or a pasted carrier SMS */}
      <BottomSheet
        visible={statusSheet}
        title={t('orders.detail.updateShipment')}
        onClose={() => {
          setStatusSheet(false);
          setStatusPasting(false);
        }}
      >
        <Text color="textSecondary">{t('orders.detail.updateShipmentBody')}</Text>
        <View style={{ gap: 2 }}>
          <MenuRow
            icon={<Camera size={20} color={colors.text} />}
            label={t('orders.detail.uploadShot')}
            onPress={() => statusShot.mutate('image')}
          />
          <MenuRow
            icon={<ClipboardPaste size={20} color={colors.text} />}
            label={t('orders.detail.carrierSms')}
            onPress={() => setStatusPasting((v) => !v)}
          />
          {statusPasting ? (
            <View style={{ gap: spacing.xs, paddingHorizontal: spacing.sm }}>
              <TextField
                label={t('orders.detail.carrierSms')}
                placeholder={t('orders.receive.pastePlaceholder')}
                value={statusMsg}
                onChangeText={setStatusMsg}
                multiline
                maxLength={2000}
              />
              <Button
                label={statusShot.isPending ? t('orders.receive.reading') : t('orders.receive.read')}
                disabled={statusMsg.trim().length < 10}
                loading={statusShot.isPending && statusShot.variables === 'text'}
                onPress={() => statusShot.mutate('text')}
              />
            </View>
          ) : null}
        </View>
        <AiWait active={statusShot.isPending} />
        {message ? (
          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
      </BottomSheet>

      {/* Pickup details: paste SMS, upload a screenshot, or (last resort) type them */}
      <BottomSheet
        visible={pickupSheet}
        title={t('orders.detail.pickupSheet')}
        onClose={() => {
          setPickupSheet(false);
          setPasting(false);
        }}
      >
        <Text color="textSecondary">{t('orders.detail.pickupSheetBody')}</Text>
        <View style={{ gap: 2 }}>
          <MenuRow
            icon={<ClipboardPaste size={20} color={colors.text} />}
            label={t('orders.detail.pasteSms')}
            onPress={() => setPasting((v) => !v)}
          />
          {pasting ? (
            <View style={{ gap: spacing.xs, paddingHorizontal: spacing.sm }}>
              <TextField
                label={t('orders.receive.pasteTitle')}
                placeholder={t('orders.receive.pastePlaceholder')}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
              />
              <Button
                label={pickup.isPending ? t('orders.receive.reading') : t('orders.receive.read')}
                disabled={text.trim().length < 10}
                loading={pickup.isPending && pickup.variables === 'text'}
                onPress={() => pickup.mutate('text')}
              />
            </View>
          ) : null}
          <MenuRow
            icon={<Camera size={20} color={colors.text} />}
            label={t('orders.detail.uploadShot')}
            onPress={() => pickup.mutate('image')}
          />
          <MenuRow
            icon={<Pencil size={20} color={colors.text} />}
            label={t('orders.detail.manualEntry')}
            onPress={() => {
              setPickupSheet(false);
              router.push(`/shipment/${order.id}?id=${s.id}&manual=pickup`);
            }}
          />
        </View>
        <AiWait active={pickup.isPending} />
        {message ? (
          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
      </BottomSheet>
    </View>
  );
}


const ymdNoon = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? `${v.slice(0, 10)}T12:00:00.000Z` : undefined);
const untilIso = (v?: string | null) => {
  const m = v ? /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(v) : null;
  return m ? `${m[1]}T${m[2] ?? '23:59'}:00.000Z` : undefined;
};

interface ExtractedShipment {
  carrier: string | null;
  trackingNumber: string | null;
  status?: string | null;
  statusText?: string | null;
  estimatedDeliveryFrom?: string | null;
  estimatedDelivery: string | null;
  pickup?: {
    name?: string | null;
    address?: string | null;
    until?: string | null;
    instructions?: string | null;
    collectionCode?: string | null;
  } | null;
}

/** Add a shipment from a carrier screenshot or a pasted carrier SMS; manual entry is the last resort. */
function AddShipmentSheet({
  visible,
  order,
  onClose,
}: {
  visible: boolean;
  order: { id: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const consent = useAiConsent();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { colors, spacing } = useTheme();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async (source: 'image' | 'text') => {
      if (!(await consent.ensure())) return null;
      let body: Record<string, unknown>;
      if (source === 'text') body = { kind: 'order', text: text.trim() };
      else {
        const picked = await pickScreenshot();
        if (!picked) return null;
        body = { kind: 'order', imageBase64: picked.base64, mediaType: picked.mediaType };
      }
      const res = await apiFetch<{ orders?: { data: { shipments: ExtractedShipment[] } }[]; data?: { shipments: ExtractedShipment[] } }>(
        '/api/extract',
        { method: 'POST', body },
      );
      const all = (res.orders?.map((o) => o.data) ?? (res.data ? [res.data] : [])).flatMap((d) => d.shipments);
      const sh = all.find((x) => x.carrier || x.trackingNumber || x.status || x.pickup);
      if (!sh) throw new ApiError(422, 'no_shipment');
      const pickup = sh.pickup
        ? {
            ...(sh.pickup.name ? { name: sh.pickup.name } : {}),
            ...(sh.pickup.address ? { address: sh.pickup.address } : {}),
            ...(untilIso(sh.pickup.until) ? { until: untilIso(sh.pickup.until) } : {}),
            ...(sh.pickup.instructions ? { instructions: sh.pickup.instructions } : {}),
            ...(sh.pickup.collectionCode ? { code: sh.pickup.collectionCode } : {}),
          }
        : undefined;
      await apiFetch('/api/shipments', {
        method: 'POST',
        body: {
          orderId: order.id,
          ...(sh.carrier ? { carrier: sh.carrier } : {}),
          ...(sh.trackingNumber ? { trackingNumber: sh.trackingNumber } : {}),
          ...(sh.status ? { status: sh.status } : {}),
          ...(sh.statusText ? { statusText: sh.statusText } : {}),
          ...(ymdNoon(sh.estimatedDelivery) ? { estimatedDeliveryAt: ymdNoon(sh.estimatedDelivery) } : {}),
          ...(ymdNoon(sh.estimatedDeliveryFrom) ? { estimatedDeliveryFrom: ymdNoon(sh.estimatedDeliveryFrom) } : {}),
          ...(pickup && Object.keys(pickup).length ? { pickup } : {}),
        },
      });
      return true;
    },
    onSuccess: async (ok) => {
      if (!ok) return;
      setText('');
      setPasting(false);
      setMessage(null);
      toast.show(t('orders.detail.shipmentAdded'));
      await qc.invalidateQueries({ queryKey: ['shipments', user?.uid] });
      onClose();
    },
    onError: (e) =>
      setMessage(aiErrorMessage(e, t as Tr, { no_shipment: t('orders.detail.noShipmentFound') })),
  });

  return (
    <BottomSheet visible={visible} title={t('edit.shipment.add')} onClose={onClose}>
      {consent.modal}
      <Text color="textSecondary">{t('orders.detail.addShipmentBody')}</Text>
      <View style={{ gap: 2 }}>
        <MenuRow
          icon={<Camera size={20} color={colors.text} />}
          label={t('orders.detail.uploadShot')}
          onPress={() => add.mutate('image')}
        />
        <MenuRow
          icon={<ClipboardPaste size={20} color={colors.text} />}
          label={t('orders.detail.carrierSms')}
          onPress={() => setPasting((v) => !v)}
        />
        {pasting ? (
          <View style={{ gap: spacing.xs, paddingHorizontal: spacing.sm }}>
            <TextField
              label={t('orders.detail.carrierSms')}
              placeholder={t('orders.receive.pastePlaceholder')}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
            />
            <Button
              label={add.isPending ? t('orders.receive.reading') : t('orders.receive.read')}
              disabled={text.trim().length < 10}
              loading={add.isPending && add.variables === 'text'}
              onPress={() => add.mutate('text')}
            />
          </View>
        ) : null}
      </View>
      <AiWait active={add.isPending} />
      {message ? (
        <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      {/* Last resort: the full manual form. */}
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          onClose();
          router.push(`/shipment/${order.id}`);
        }}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text variant="small" color="accentText" style={{ textDecorationLine: 'underline' }}>
          {t('orders.detail.addManually')}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

export function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  const router = useRouter();
  const toast = useToast();
  const orders = useOrders();
  const shipments = useShipments();
  const { deleteOrder, markReceived, restore } = useOrderMutations();
  const { shop, failed: shopFailed } = useShopNow();
  const [menu, setMenu] = useState(false);
  const [addSheet, setAddSheet] = useState(false);
  const [allItems, setAllItems] = useState(false);

  if (orders.isLoading || shipments.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (orders.isError || shipments.isError) {
    return (
      <Screen>
        <ErrorState
          title={t('common.somethingWrong')}
          body={t('common.somethingWrongBody')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void orders.refetch();
            void shipments.refetch();
          }}
        />
      </Screen>
    );
  }
  const order = (orders.data ?? []).find((o) => o.id === id);
  if (!order) {
    return (
      <Screen>
        <EmptyState title={t('orders.detail.notFound')} />
      </Screen>
    );
  }
  const ships = (shipments.data ?? []).filter((s) => s.orderId === order.id);
  const merchant = order.merchantId ? { id: order.merchantId } : merchantByName(order.merchantName);
  const catalog = merchantByName(order.merchantName);
  // The store's own page for this order: the page it was imported from, else the store's "my orders".
  const storeOrderUrl = order.orderUrl ?? catalog?.ordersUrl ?? null;
  const archived = !!order.archivedAt;

  const markAsReceived = () =>
    markReceived.mutate(
      { orderId: order.id, shipments: ships },
      {
        onSuccess: () => {
          toast.show(t('orders.receive.receivedDone'));
          router.replace('/orders');
        },
      },
    );

  const remove = async () => {
    const ok = await confirmAction({
      title: t('orders.detail.deleteTitle'),
      message: t('orders.detail.deleteBody'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    await deleteOrder.mutateAsync(order.id);
    router.replace('/orders');
  };

  const items = order.items;
  const shownItems = allItems ? items : items.slice(0, 3);
  const meta = [
    order.purchasedAt ? formatDate(order.purchasedAt, language) : null,
    formatPrice(order.total, language),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: order.merchantName }} />
      <View style={{ gap: spacing.md }}>
        {/* Compact order header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.xl,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <MerchantLogo name={order.merchantName} domain={catalog?.domains[0]} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" numberOfLines={1} accessibilityRole="header">
              {order.merchantName}
            </Text>
            {order.externalOrderId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('orders.detail.orderNumber')}: ${order.externalOrderId}. ${t('orders.detail.copy')}`}
                onPress={() =>
                  void copyText(order.externalOrderId!).then((ok) => ok && toast.show(t('orders.detail.copied')))
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text variant="small" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {order.externalOrderId}
                </Text>
                <Copy size={14} color={colors.textSecondary} />
              </Pressable>
            ) : null}
            {meta ? (
              <Text variant="small" color="textSecondary">
                {meta}
              </Text>
            ) : null}
          </View>
          <IconButton label={t('orders.detail.orderMenu')} onPress={() => setMenu(true)}>
            <MoreHorizontal size={24} color={colors.text} />
          </IconButton>
        </View>

        {storeOrderUrl ? (
          <Button
            variant="secondary"
            label={t('orders.detail.openOrder', { store: order.merchantName })}
            icon={<Store size={18} color={colors.text} />}
            onPress={() => void openExternal(storeOrderUrl)}
          />
        ) : null}

        {archived ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: colors.accentSoft,
            }}
          >
            <Text variant="small" style={{ flex: 1 }}>
              {t('orders.receive.archivedNote')}
            </Text>
            <Button
              variant="secondary"
              label={t('orders.receive.restore')}
              loading={restore.isPending}
              style={{ minHeight: 40 }}
              onPress={() => restore.mutate(order.id)}
            />
          </View>
        ) : null}

        {shopFailed ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('wishlist.detail.openFailed')}
          </Text>
        ) : null}

        {/* Shipments */}
        {ships.length === 0 ? (
          <View style={{ gap: spacing.xs }}>
            <Text color="textSecondary">{t('orders.detail.noShipments')}</Text>
            <Button
              variant="secondary"
              label={t('edit.shipment.add')}
              onPress={() => router.push(`/shipment/${order.id}`)}
            />
          </View>
        ) : (
          ships.map((s, i) => (
            <ShipmentCard
              key={s.id}
              order={order}
              shipment={s}
              index={i}
              total={ships.length}
              archived={archived}
              onReceived={markAsReceived}
              receiving={markReceived.isPending}
            />
          ))
        )}

        {/* Products: image first, three at a time */}
        {items.length > 0 ? (
          <View
            style={{
              gap: spacing.xs,
              padding: spacing.md,
              borderRadius: radius.xl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="headline">{t('orders.detail.products', { count: items.length })}</Text>
            {shownItems.map((it, i) => {
              const open = it.productUrl
                ? () => void shop({ merchantId: order.merchantId, productUrl: it.productUrl })
                : undefined;
              const row = (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Thumb imageUrl={it.thumbDataUrl ?? it.imageUrl} fallbackName={order.merchantName} size={64} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={2}>{it.title}</Text>
                    <Text variant="caption" color="textSecondary">
                      {`×${it.quantity}`}
                      {it.unitPrice ? ` · ${formatPrice(it.unitPrice, language)}` : ''}
                    </Text>
                    {open ? (
                      <Text variant="caption" color="accentText">
                        {t('orders.detail.openItem')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
              return open ? (
                <Pressable
                  key={`${it.title}-${i}`}
                  accessibilityRole="link"
                  accessibilityLabel={`${t('orders.detail.openItem')}: ${it.title}`}
                  onPress={open}
                >
                  {row}
                </Pressable>
              ) : (
                <View key={`${it.title}-${i}`}>{row}</View>
              );
            })}
            {items.length > 3 ? (
              <Button
                variant="ghost"
                label={allItems ? t('orders.detail.showLess') : t('orders.detail.showAll', { count: items.length })}
                onPress={() => setAllItems((v) => !v)}
              />
            ) : null}
          </View>
        ) : null}

        {deleteOrder.isError ? <Text color="danger">{t('common.saveFailed')}</Text> : null}

        {!archived ? (
          <Button
            label={t('orders.receive.received')}
            loading={markReceived.isPending}
            icon={<Check size={18} color={colors.onAccent} />}
            onPress={markAsReceived}
          />
        ) : null}
      </View>

      <AddShipmentSheet visible={addSheet} order={order} onClose={() => setAddSheet(false)} />

      {/* Order actions */}
      <BottomSheet visible={menu} title={t('orders.detail.orderMenu')} onClose={() => setMenu(false)}>
        <View style={{ gap: 2 }}>
          <MenuRow
            icon={<Pencil size={20} color={colors.text} />}
            label={t('orders.detail.editOrder')}
            onPress={() => {
              setMenu(false);
              router.push(`/order/edit/${order.id}`);
            }}
          />
          <MenuRow
            icon={<PackagePlus size={20} color={colors.text} />}
            label={t('edit.shipment.add')}
            onPress={() => {
              setMenu(false);
              setAddSheet(true);
            }}
          />
          {archived ? (
            <MenuRow
              icon={<Undo2 size={20} color={colors.text} />}
              label={t('orders.receive.restore')}
              onPress={() => {
                setMenu(false);
                restore.mutate(order.id);
              }}
            />
          ) : (
            <MenuRow
              icon={<Check size={20} color={colors.text} />}
              label={t('orders.receive.received')}
              onPress={() => {
                setMenu(false);
                markAsReceived();
              }}
            />
          )}
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs }}>
          <MenuRow
            danger
            icon={<Trash2 size={20} color={colors.danger} />}
            label={t('orders.detail.delete')}
            onPress={() => {
              setMenu(false);
              void remove();
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
