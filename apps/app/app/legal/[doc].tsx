import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { EmptyState, Screen, Text, useTheme } from '@/design';
import { useAppLanguage } from '@/i18n';
import { legalDocs, type LegalDocId } from '@/legal/content';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { language } = useAppLanguage();
  const { spacing, colors, radius } = useTheme();
  const entry = legalDocs[doc as LegalDocId]?.[language === 'he' ? 'he' : 'en'];

  if (!entry) {
    return (
      <Screen>
        <EmptyState title="404" />
      </Screen>
    );
  }

  return (
    <Screen scroll topInset>
      <Stack.Screen options={{ headerShown: true, title: entry.title }} />
      <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="title" accessibilityRole="header">
            {entry.title}
          </Text>
          <Text variant="small" color="textSecondary">
            {entry.updated}
          </Text>
          <View
            style={{
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="small" color="warning">
              {entry.draft}
            </Text>
          </View>
        </View>
        {entry.sections.map((s) => (
          <View key={s.heading} style={{ gap: spacing.xs }}>
            <Text variant="headline" accessibilityRole="header">
              {s.heading}
            </Text>
            {s.body.map((p, i) => (
              <Text key={i} color="text">
                {p}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}
