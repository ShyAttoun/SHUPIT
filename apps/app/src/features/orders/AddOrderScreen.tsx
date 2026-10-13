import { merchantCatalog, getMerchant, type ExtractedOrder } from '@shupit/contracts';
import { useRouter } from 'expo-router';
import { ClipboardPaste, Link2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useShareInbox } from '@/lib/shareInbox';
import { Pressable, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, LoadingState, Screen, Text, TextField, useTheme } from '@/design';
import { useFavoriteStores } from '@/features/stores/hooks';
import { useAiConsent } from '@/features/privacy/AiConsent';
import { useAppLanguage, useTranslation } from '@/i18n';
import { ApiError, apiFetch } from '@/lib/api';
import { ImageDropZone } from '@/components/ImageDropZone';
import type { PickedImage } from '@/lib/imagePicker';
import { isHttpUrl } from '@shupit/contracts';
import { useOrderMutations } from './hooks';
import {
  buildOrderInput,
  draftFromExtraction,
  emptyOrderForm,
  unchangedAiFields,
  type AiField,
  type OrderFormErrors,
  type OrderFormValues,
} from './orderForm';

type Step = 'choose' | 'reading' | 'review' | 'error';
type Source = 'screenshot' | 'link' | 'manual';

interface ExtractResponse {
  kind: 'order';
  data: ExtractedOrder;
  merchantId: string | null;
  orders?: { data: ExtractedOrder; merchantId: string | null }[];
}

function errorKey(
  e: unknown,
): 'notOrder' | 'unreadableLink' | 'notConfigured' | 'quota' | 'consentRequired' | 'rateLimited' | 'aiCapacity' | 'generic' {
  if (e instanceof ApiError) {
    if (e.code === 'consent_required') return 'consentRequired';
    if (e.code === 'rate_limited') return 'rateLimited';
    if (e.code === 'ai_capacity') return 'aiCapacity';
    if (e.code === 'not_an_order') return 'notOrder';
    if (e.code === 'unreadable') return 'unreadableLink';
    if (e.code === 'not_configured') return 'notConfigured';
    if (e.code === 'quota_exceeded') return 'quota';
  }
  return 'generic';
}

export function AddOrderScreen() {
  const consent = useAiConsent();
  return (
    <>
      <AddOrderContent ensure={consent.ensure} />
      {consent.modal}
    </>
  );
}

function AddOrderContent({ ensure }: { ensure: () => Promise<boolean> }) {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { colors, spacing, radius, hitTarget } = useTheme();
  const router = useRouter();
  const favorites = useFavoriteStores();
  const { createOrder } = useOrderMutations();

  const defaultCurrency = language === 'he' ? 'ILS' : 'USD';
  const [step, setStep] = useState<Step>('choose');
  const [source, setSource] = useState<Source>('manual');
  const [linkOpen, setLinkOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pastedError, setPastedError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [values, setValues] = useState<OrderFormValues>(emptyOrderForm(defaultCurrency));
  const [initial, setInitial] = useState<OrderFormValues | null>(null);
  const [aiFields, setAiFields] = useState<AiField[]>([]);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [moreOrders, setMoreOrders] = useState(0);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [failKey, setFailKey] = useState<ReturnType<typeof errorKey>>('generic');
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const set = <K extends keyof OrderFormValues>(k: K, v: OrderFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const applyExtraction = (res: ExtractResponse, from: Source) => {
    const merchant = getMerchant(res.merchantId ?? undefined);
    const draft = draftFromExtraction(res.data, merchant ? { id: merchant.id, name: merchant.name } : null, defaultCurrency);
    setValues(draft.values);
    setInitial(draft.values);
    setAiFields(draft.aiFields);
    setLowConfidence(res.data.confidence !== 'high');
    setMoreOrders(Math.max(0, (res.orders?.length ?? 1) - 1));
    setSource(from);
    setStep('review');
  };

  const fromScreenshot = async (picked: PickedImage) => {
    if (!(await ensure())) return;
    setStep('reading');
    try {
      const res = await apiFetch<ExtractResponse>('/api/extract', {
        method: 'POST',
        body: { kind: 'order', imageBase64: picked.base64, mediaType: picked.mediaType },
      });
      applyExtraction(res, 'screenshot');
    } catch (e) {
      setFailKey(errorKey(e));
      setStep('error');
    }
  };

  const fromText = async (override?: string) => {
    const text = (override ?? pasted).trim();
    if (text.length < 20) {
      setPastedError(t('orders.import.textTooShort'));
      return;
    }
    setPastedError(null);
    if (!(await ensure())) return;
    setStep('reading');
    try {
      const res = await apiFetch<ExtractResponse>('/api/extract', {
        method: 'POST',
        body: { kind: 'order', text },
      });
      applyExtraction(res, 'link');
    } catch (e) {
      setFailKey(errorKey(e));
      setStep('error');
    }
  };

  const fromLink = async (override?: string) => {
    const url = (override ?? link).trim();
    if (!isHttpUrl(url)) {
      setLinkError(t('wishlist.add.invalidUrl'));
      return;
    }
    setLinkError(null);
    if (!(await ensure())) return;
    setStep('reading');
    try {
      const res = await apiFetch<ExtractResponse>('/api/extract', {
        method: 'POST',
        body: { kind: 'order', url },
      });
      applyExtraction(res, 'link');
    } catch (e) {
      setFailKey(errorKey(e));
      setStep('error');
    }
  };

  // Content shared into the app (PWA share target / share screen).
  const takeInbox = useShareInbox((s) => s.take);
  useEffect(() => {
    const shared = takeInbox();
    if (!shared) return;
    if (shared.image) void fromScreenshot(shared.image);
    else if (shared.url) {
      setLink(shared.url);
      void fromLink(shared.url);
    } else if (shared.text) {
      setPasted(shared.text);
      void fromText(shared.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manual = () => {
    setValues(emptyOrderForm(defaultCurrency));
    setInitial(null);
    setAiFields([]);
    setLowConfidence(false);
    setSource('manual');
    setStep('review');
  };

  const submit = async () => {
    setSaveFailed(false);
    setDuplicateId(null);
    const r = buildOrderInput(values);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    const kept = initial ? unchangedAiFields(initial, values, aiFields) : [];
    try {
      const res = await createOrder.mutateAsync({
        ...r.input,
        importSource: source === 'manual' ? 'manual' : source,
        ...(kept.length ? { aiFields: kept } : {}),
      });
      router.replace(`/order/${res.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'duplicate') {
        setDuplicateId((e.body as { existingId?: string } | undefined)?.existingId ?? null);
      } else {
        setSaveFailed(true);
      }
    }
  };

  const errText = (key?: string) =>
    key === 'required'
      ? t('common.required')
      : key === 'invalidDate'
        ? t('orders.form.invalidDate')
        : key === 'invalidTotal'
          ? t('orders.form.invalidTotal')
          : key
            ? t('common.saveFailed')
            : undefined;

  const bigOption = (opts: {
    icon: React.ReactNode;
    title: string;
    hint: string;
    onPress: () => void;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={opts.title}
      onPress={opts.onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        minHeight: hitTarget + 32,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.md,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {opts.icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{opts.title}</Text>
        <Text variant="small" color="textSecondary">
          {opts.hint}
        </Text>
      </View>
    </Pressable>
  );

  if (step === 'reading') {
    return (
      <Screen>
        <View style={{ gap: spacing.md, paddingTop: spacing.xl }}>
          <Text variant="headline" accessibilityLiveRegion="polite">
            {t('orders.import.reading')}
          </Text>
          <LoadingState rows={3} />
        </View>
      </Screen>
    );
  }

  if (step === 'error') {
    return (
      <Screen scroll>
        <View style={{ gap: spacing.md, paddingTop: spacing.lg }}>
          <Text variant="title" accessibilityRole="header">
            {t('orders.import.failedTitle')}
          </Text>
          <Text color="textSecondary" accessibilityLiveRegion="polite">
            {t(`orders.import.${failKey}`)}
          </Text>
          <Button label={t('orders.import.tryAgain')} onPress={() => setStep('choose')} />
          <Button variant="ghost" label={t('orders.import.enterManually')} onPress={manual} />
        </View>
      </Screen>
    );
  }

  if (step === 'choose') {
    return (
      <Screen scroll>
        <View style={{ gap: spacing.md }}>
          <Text variant="title" accessibilityRole="header">
            {t('orders.import.chooseTitle')}
          </Text>
          <ImageDropZone
            label={t('orders.import.dropLabel')}
            hint={t('orders.import.dropHint')}
            onImage={(img) => void fromScreenshot(img)}
            onError={() => {
              setFailKey('generic');
              setStep('error');
            }}
          />
          {bigOption({
            icon: <Link2 size={26} color={colors.accentText} />,
            title: t('orders.import.link'),
            hint: t('orders.import.linkHint'),
            onPress: () => setLinkOpen((o) => !o),
          })}

          {bigOption({
            icon: <ClipboardPaste size={26} color={colors.accentText} />,
            title: t('orders.import.pasteText'),
            hint: t('orders.import.pasteTextHint'),
            onPress: () => setTextOpen((o) => !o),
          })}

          {textOpen ? (
            <View style={{ gap: spacing.sm }}>
              <TextField
                label={t('orders.import.pasteText')}
                value={pasted}
                onChangeText={setPasted}
                placeholder={t('orders.import.textPlaceholder')}
                multiline
                numberOfLines={6}
                style={{ minHeight: 140, textAlignVertical: 'top', paddingTop: spacing.sm }}
                error={pastedError ?? undefined}
              />
              <Button label={t('orders.import.readText')} onPress={() => void fromText()} />
            </View>
          ) : null}

          {linkOpen ? (
            <View style={{ gap: spacing.sm }}>
              <TextField
                label={t('orders.import.link')}
                value={link}
                onChangeText={setLink}
                placeholder={t('orders.import.linkPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                error={linkError ?? undefined}
                onSubmitEditing={() => void fromLink()}
              />
              <Button label={t('orders.import.readLink')} onPress={() => void fromLink()} />
            </View>
          ) : null}

          <Text variant="caption" color="textSecondary">
            {t('orders.import.privacy')}
          </Text>
          <Button variant="ghost" label={t('orders.import.enterManually')} onPress={manual} />
        </View>
      </Screen>
    );
  }

  // review
  const favoriteIds = (favorites.data ?? []).map((f) => f.merchantId);
  const ordered = [
    ...merchantCatalog.filter((m) => favoriteIds.includes(m.id)),
    ...merchantCatalog.filter((m) => !favoriteIds.includes(m.id)),
  ];

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="title" accessibilityRole="header">
            {t('orders.form.title')}
          </Text>
          {source !== 'manual' ? (
            <Text color="textSecondary" variant="small">
              {t('orders.import.reviewHint')}
            </Text>
          ) : null}
          {moreOrders > 0 ? (
            <Text color="warning" variant="small" accessibilityLiveRegion="polite">
              {t('orders.import.moreOrders', { count: moreOrders })}
            </Text>
          ) : null}
          {lowConfidence ? (
            <Text color="warning" variant="small" accessibilityLiveRegion="polite">
              {t('orders.import.lowConfidence')}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color="textSecondary">
            {t('orders.form.store')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {ordered.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                selected={values.merchantId === m.id}
                onPress={() => setValues((s) => ({ ...s, merchantId: m.id, merchantName: m.name }))}
              />
            ))}
            <Chip
              label={t('orders.form.storeOther')}
              selected={values.merchantId === null}
              onPress={() => setValues((s) => ({ ...s, merchantId: null }))}
            />
          </View>
          {values.merchantId === null ? (
            <TextField
              label={t('orders.form.storeName')}
              value={values.merchantName}
              onChangeText={(v) => set('merchantName', v)}
              maxLength={120}
              error={errText(errors.merchantName)}
            />
          ) : null}
        </View>

        <TextField
          label={`${t('orders.form.orderNumber')} (${t('common.optional')})`}
          value={values.orderNumber}
          onChangeText={(v) => set('orderNumber', v)}
          autoCapitalize="none"
          maxLength={80}
        />
        <TextField
          label={`${t('orders.form.purchaseDate')} (${t('orders.form.dateHint')})`}
          value={values.purchaseDate}
          onChangeText={(v) => set('purchaseDate', v)}
          placeholder={t('orders.form.dateHint')}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          error={errText(errors.purchaseDate)}
        />

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 2 }}>
            <TextField
              label={`${t('orders.form.total')} (${t('common.optional')})`}
              value={values.total}
              onChangeText={(v) => set('total', v)}
              keyboardType="decimal-pad"
              error={errText(errors.total)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('orders.form.currency')}
              value={values.currency}
              onChangeText={(v) => set('currency', v.toUpperCase().slice(0, 3))}
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="headline">{t('orders.form.items')}</Text>
          {values.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 3 }}>
                <TextField
                  label={`${t('orders.form.itemTitle')} ${i + 1}`}
                  value={it.title}
                  onChangeText={(v) =>
                    set('items', values.items.map((x, j) => (j === i ? { ...x, title: v } : x)))
                  }
                  maxLength={200}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('orders.form.quantity')}
                  value={it.quantity}
                  onChangeText={(v) =>
                    set('items', values.items.map((x, j) => (j === i ? { ...x, quantity: v.replace(/\D/g, '') } : x)))
                  }
                  keyboardType="number-pad"
                />
              </View>
              {values.items.length > 1 ? (
                <Button
                  variant="ghost"
                  label="✕"
                  accessibilityLabel={t('orders.form.removeItem')}
                  onPress={() => set('items', values.items.filter((_, j) => j !== i))}
                  style={{ paddingHorizontal: spacing.sm }}
                />
              ) : null}
            </View>
          ))}
          {errors.items ? <Text color="danger">{t('common.saveFailed')}</Text> : null}
          {values.items.length < 20 ? (
            <Button
              variant="secondary"
              label={t('orders.form.addItem')}
              onPress={() => set('items', [...values.items, { title: '', quantity: '1' }])}
            />
          ) : null}
        </View>

        {values.status ? (
          <View style={{ gap: 4 }}>
            <Text variant="label" color="textSecondary">
              {t('orders.import.statusRead')}
            </Text>
            <StatusBadge status={values.status} />
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text variant="headline">{t('orders.form.tracking')}</Text>
          <TextField
            label={`${t('orders.form.carrier')} (${t('common.optional')})`}
            value={values.carrier}
            onChangeText={(v) => set('carrier', v)}
            maxLength={60}
          />
          <TextField
            label={`${t('orders.form.trackingNumber')} (${t('common.optional')})`}
            value={values.trackingNumber}
            onChangeText={(v) => set('trackingNumber', v)}
            autoCapitalize="characters"
            maxLength={60}
          />
          <TextField
            label={`${t('orders.form.eta')} (${t('orders.form.dateHint')})`}
            value={values.eta}
            onChangeText={(v) => set('eta', v)}
            placeholder={t('orders.form.dateHint')}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            error={errText(errors.eta)}
          />
        </View>

        {duplicateId ? (
          <View style={{ gap: spacing.xs }}>
            <Text color="warning" accessibilityLiveRegion="polite">
              {t('orders.form.duplicate')}
            </Text>
            <Button
              variant="secondary"
              label={t('orders.form.viewExisting')}
              onPress={() => router.replace(`/order/${duplicateId}`)}
            />
          </View>
        ) : null}
        {saveFailed ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('common.saveFailed')}
          </Text>
        ) : null}

        <Button label={t('orders.form.saveOrder')} loading={createOrder.isPending} onPress={() => void submit()} />
        <Button variant="ghost" label={t('common.back')} onPress={() => setStep('choose')} />
      </View>
    </Screen>
  );
}
