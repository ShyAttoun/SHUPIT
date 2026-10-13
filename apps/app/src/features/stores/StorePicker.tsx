import { merchantCatalog } from '@shupit/contracts';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MerchantLogo } from '@/components/MerchantLogo';
import { SearchField } from '@/components/SearchField';
import { Text, useTheme } from '@/design';
import { useTranslation } from '@/i18n';

/** Searchable multi-select grid of app-icon tiles with the store name underneath. */
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md }}>
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
                  width: '33.333%',
                  minHeight: hitTarget + 40,
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingHorizontal: spacing.xxs,
                }}
              >
                <View
                  style={{
                    borderRadius: radius.lg,
                    padding: 3,
                    borderWidth: 2,
                    borderColor: isSel ? colors.accent : 'transparent',
                  }}
                >
                  <MerchantLogo name={m.name} domain={m.domains[0]} size={64} />
                  {isSel ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: -6,
                        end: -6,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: colors.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={14} color={colors.onAccent} />
                    </View>
                  ) : null}
                </View>
                <Text variant="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
