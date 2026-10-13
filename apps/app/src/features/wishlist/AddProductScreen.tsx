import {
  getMerchant,
  isHttpUrl,
  merchantForUrl,
  parsePriceNumber,
  toMinor,
  fromMinor,
  type ProductDraft,
} from '@shupit/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Button, Screen, Text, TextField, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { apiFetch } from '@/lib/api';
import { findDuplicate, useCollections, useSavedProducts, useWishlistMutations } from './hooks';

interface PreviewResponse {
  draft: ProductDraft;
  urlKey: string | null;
  unreadable?: boolean;
}

export function AddProductScreen() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { spacing } = useTheme();
  const router = useRouter();
  const products = useSavedProducts();
  const collections = useCollections();
  const { addProduct } = useWishlistMutations();

  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState(language === 'he' ? 'ILS' : 'USD');
  const [note, setNote] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [fromPage, setFromPage] = useState({ title: false, price: false, image: false });
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; price?: string }>({});
  const [canonicalUrl, setCanonicalUrl] = useState<string | undefined>();

  const typedUrl = url.trim();
  const dup = findDuplicate(products.data ?? [], canonicalUrl ?? (isHttpUrl(typedUrl) ? typedUrl : undefined));
  const merchant = getMerchant(merchantForUrl(canonicalUrl ?? typedUrl)?.id);

  const fetchDetails = async () => {
    if (!isHttpUrl(typedUrl)) {
      setUrlError(t('wishlist.add.invalidUrl'));
      return;
    }
    setUrlError(null);
    setNotice(null);
    setFetching(true);
    try {
      const res = await apiFetch<PreviewResponse>('/api/products-preview', {
        method: 'POST',
        body: { url: typedUrl },
      });
      const d = res.draft;
      setCanonicalUrl(d.canonicalUrl);
      setTitle(d.title ?? '');
      setImageUrl(d.imageUrl);
      if (d.price) {
        setPrice(String(fromMinor(d.price)));
        setCurrency(d.price.currency);
      }
      setFromPage({ title: !!d.title, price: !!d.price, image: !!d.imageUrl });
      setNotice(res.unreadable ? t('wishlist.add.unreadable') : d.missing.length ? t('wishlist.add.partial') : null);
      setShowForm(true);
    } catch {
      setCanonicalUrl(typedUrl);
      setNotice(t('wishlist.add.unreadable'));
      setShowForm(true);
    } finally {
      setFetching(false);
    }
  };

  const save = async () => {
    const errors: { title?: string; price?: string } = {};
    if (!title.trim()) errors.title = t('common.required');
    let savedPrice: { amountMinor: number; currency: string } | undefined;
    if (price.trim()) {
      const n = parsePriceNumber(price);
      const cur = currency.trim().toUpperCase();
      if (n === null || !/^[A-Z]{3}$/.test(cur)) errors.price = t('wishlist.add.invalidPrice');
      else savedPrice = { amountMinor: toMinor(n, cur), currency: cur };
    }
    setFieldErrors(errors);
    if (errors.title || errors.price) return;
    if (dup) return;

    const product = await addProduct.mutateAsync({
      title,
      productUrl: canonicalUrl ?? (isHttpUrl(typedUrl) ? typedUrl : undefined),
      merchantId: merchant?.id,
      imageUrl,
      savedPrice,
      priceFromPage: fromPage.price && !!savedPrice,
      titleFromPage: fromPage.title,
      imageFromPage: fromPage.image,
      note,
      collectionIds: collectionId ? [collectionId] : [],
    });
    router.replace(`/product/${product.id}`);
  };

  return (
    <Screen scroll>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <TextField
            label={t('wishlist.add.pasteUrl')}
            value={url}
            onChangeText={(v) => {
              setUrl(v);
              setCanonicalUrl(undefined);
            }}
            placeholder={t('wishlist.add.urlPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={urlError ?? undefined}
          />
          <Button
            label={fetching ? t('wishlist.add.fetching') : t('wishlist.add.fetchDetails')}
            loading={fetching}
            onPress={() => void fetchDetails()}
          />
          {!showForm ? (
            <Button variant="ghost" label={t('wishlist.add.orManual')} onPress={() => setShowForm(true)} />
          ) : null}
        </View>

        {dup ? (
          <View style={{ gap: spacing.xs }}>
            <Text color="warning" accessibilityLiveRegion="polite">
              {t('wishlist.add.duplicate')}
            </Text>
            <Button
              variant="secondary"
              label={t('wishlist.add.viewExisting')}
              onPress={() => router.replace(`/product/${dup.id}`)}
            />
          </View>
        ) : null}

        {showForm ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="headline" accessibilityRole="header">
              {t('wishlist.add.confirmTitle')}
            </Text>
            {notice ? (
              <Text color="textSecondary" variant="small" accessibilityLiveRegion="polite">
                {notice}
              </Text>
            ) : fromPage.title || fromPage.price ? (
              <Text color="textSecondary" variant="small">
                {t('wishlist.add.fromPage')}
              </Text>
            ) : null}
            {merchant ? (
              <Text variant="small" color="textSecondary">
                {t('wishlist.add.store')}: {merchant.name}
              </Text>
            ) : null}

            <TextField
              label={t('wishlist.add.productName')}
              value={title}
              onChangeText={setTitle}
              maxLength={300}
              error={fieldErrors.title}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 2 }}>
                <TextField
                  label={`${t('wishlist.add.price')} (${t('common.optional')})`}
                  value={price}
                  onChangeText={(v) => {
                    setPrice(v);
                    setFromPage((f) => ({ ...f, price: false }));
                  }}
                  keyboardType="decimal-pad"
                  error={fieldErrors.price}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('wishlist.add.currency')}
                  value={currency}
                  onChangeText={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
            </View>
            <TextField
              label={`${t('wishlist.add.note')} (${t('common.optional')})`}
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
            />

            {(collections.data ?? []).length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="label" color="textSecondary">
                  {t('wishlist.add.collection')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  <Chip
                    label={t('wishlist.add.noCollection')}
                    selected={collectionId === null}
                    onPress={() => setCollectionId(null)}
                  />
                  {(collections.data ?? []).map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={collectionId === c.id}
                      onPress={() => setCollectionId(c.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {addProduct.isError ? <Text color="danger">{t('common.saveFailed')}</Text> : null}
            <Button
              label={t('wishlist.add.saveProduct')}
              disabled={!!dup}
              loading={addProduct.isPending}
              onPress={() => void save()}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
