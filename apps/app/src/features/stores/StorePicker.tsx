import { merchantCatalog } from '@shupit/contracts';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MerchantLogo } from '@/components/MerchantLogo';
import { SearchField } from '@/components/SearchField';
import { Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

/** Searchable multi-select of merchants. Controlled by `selected`. */
export function StorePicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (merchantId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, hitTarget } = useTheme();
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchantCatalog.filter(
      (m) => !q || m.name.toLowerCase().includes(q) || m.domains.some((d) => d.includes(q)),
    );
  }, [query]);

  return (
    <View style={{ gap: spacing.md }}>
      <SearchField value={query} onChangeText={setQuery} placeholder={t('stores.searchPlaceholder')} />
      {items.length === 0 ? (
        <Text color="textSecondary">{t('stores.noResults')}</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {items.map((m) => {
            const isSel = selected.includes(m.id);
            return (
              <Pressable
                key={m.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSel }}
                accessibilityLabel={m.name}
                onPress={() => onToggle(m.id)}
                style={{
                  width: '47%',
                  flexGrow: 1,
                  minHeight: hitTarget + 28,
                  padding: spacing.sm,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: isSel ? colors.accent : colors.border,
                  backgroundColor: isSel ? colors.accentSoft : colors.background,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <MerchantLogo name={m.name} size={40} />
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {m.name}
                </Text>
                {isSel ? <Check size={18} color={colors.accentText} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
