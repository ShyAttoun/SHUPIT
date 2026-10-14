import { merchantCatalog, normalizeProductUrl } from '@shupit/contracts';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { Button, EmptyState, LoadingState, Screen, Text, TextField, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { buildProductPatch, valuesFromProduct, type ProductEditErrors, type ProductEditValues } from './editProduct';
import { useSavedProducts, useWishlistMutations } from './hooks';

export function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { spacing } = useTheme();
  const router = useRouter();
  const products = useSavedProducts();
  const { updateProduct } = useWishlistMutations();
  const fallbackCurrency = language === 'he' ? 'ILS' : 'USD';

  const product = (products.data ?? []).find((p) => p.id === id);
  const [values, setValues] = useState<ProductEditValues | null>(null);
  const [errors, setErrors] = useState<ProductEditErrors>({});
  const [failed, setFailed] = useState(false);
  const [dup, setDup] = useState(false);

  useEffect(() => {
    if (product && !values) setValues(valuesFromProduct(product, fallbackCurrency));
  }, [product, values, fallbackCurrency]);

  if (products.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!product || !values) {
    return (
      <Screen>
        <EmptyState title={t('wishlist.detail.notFound')} />
      </Screen>
    );
  }

  const set = <K extends keyof ProductEditValues>(k: K, v: ProductEditValues[K]) =>
    setValues((s) => (s ? { ...s, [k]: v } : s));
  const errText = (key?: string) =>
    key === 'required'
      ? t('common.required')
      : key === 'invalidPrice'
        ? t('wishlist.add.invalidPrice')
        : key
          ? t('edit.product.invalidUrl')
          : undefined;

  const save = async () => {
    setFailed(false);
    setDup(false);
    const r = buildProductPatch(product, values, fallbackCurrency);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    const newKey = values.productUrl.trim() ? normalizeProductUrl(values.productUrl.trim()) : null;
    if (newKey && (products.data ?? []).some((p) => p.id !== product.id && p.urlKey === newKey)) {
      setDup(true);
      return;
    }
    if (r.value.changed.length === 0) {
      router.replace(`/product/${product.id}`);
      return;
    }
    try {
      await updateProduct.mutateAsync({ id: product.id, patch: r.value.patch });
      router.replace(`/product/${product.id}`);
    } catch {
      setFailed(true);
    }
  };

  const priceChanged = values.price.trim() !== (product.savedPrice ? String(product.savedPrice.amountMinor / 100) : '');

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: t('edit.product.title') }} />
      <View style={{ gap: spacing.md }}>
        <TextField
          label={t('wishlist.add.productName')}
          value={values.title}
          onChangeText={(v) => set('title', v)}
          maxLength={300}
          error={errText(errors.title)}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 2 }}>
            <TextField
              label={`${t('wishlist.add.price')} (${t('common.optional')})`}
              value={values.price}
              onChangeText={(v) => set('price', v)}
              keyboardType="decimal-pad"
              error={errText(errors.price)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('wishlist.add.currency')}
              value={values.currency}
              onChangeText={(v) => set('currency', v.toUpperCase().slice(0, 3))}
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>
        </View>
        {product.priceVerifiedAt && priceChanged ? (
          <Text variant="small" color="warning">
            {t('edit.product.priceEdited')}
          </Text>
        ) : null}
        <TextField
          label={t('edit.product.url')}
          value={values.productUrl}
          onChangeText={(v) => set('productUrl', v)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={errText(errors.productUrl)}
        />
        <TextField
          label={`${t('edit.product.imageUrl')} (${t('common.optional')})`}
          value={values.imageUrl}
          onChangeText={(v) => set('imageUrl', v)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={errText(errors.imageUrl)}
        />
        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color="textSecondary">
            {t('edit.product.store')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Chip
              label={t('edit.product.noStore')}
              selected={values.merchantId === null}
              onPress={() => set('merchantId', null)}
            />
            {merchantCatalog.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                selected={values.merchantId === m.id}
                onPress={() => set('merchantId', m.id)}
              />
            ))}
          </View>
        </View>
        <TextField
          label={`${t('wishlist.add.note')} (${t('common.optional')})`}
          value={values.note}
          onChangeText={(v) => set('note', v)}
          maxLength={500}
          multiline
        />
        {dup ? (
          <Text color="warning" accessibilityLiveRegion="polite">
            {t('edit.product.duplicate')}
          </Text>
        ) : null}
        {failed ? (
          <Text color="danger" accessibilityLiveRegion="polite">
            {t('common.saveFailed')}
          </Text>
        ) : null}
        <Button label={t('common.save')} loading={updateProduct.isPending} onPress={() => void save()} />
      </View>
    </Screen>
  );
}
