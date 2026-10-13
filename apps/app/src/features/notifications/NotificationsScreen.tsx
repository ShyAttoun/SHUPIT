import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { View } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { Button, EmptyState, ErrorState, LoadingState, Screen, Text, useTheme } from '@/design';
import { useAppLanguage, useTranslation } from '@/i18n';
import { formatDateTime } from '@/lib/format';
import { notificationRoute, notificationTitle } from './format';
import { useNotificationActions, useNotifications } from './hooks';

export function NotificationsScreen() {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const list = useNotifications();
  const { markRead } = useNotificationActions();

  if (list.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (list.isError) {
    return (
      <Screen>
        <ErrorState
          title={t('common.somethingWrong')}
          body={t('common.somethingWrongBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void list.refetch()}
        />
      </Screen>
    );
  }

  const items = list.data ?? [];
  const unread = items.filter((n) => !n.readAt);

  if (items.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={<Bell size={32} color={colors.accentText} />}
          title={t('notifications.emptyTitle')}
          body={t('notifications.emptyBody')}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ gap: spacing.md }}>
        {unread.length > 0 ? (
          <Button
            variant="secondary"
            label={t('notifications.markAllRead', { count: unread.length })}
            loading={markRead.isPending}
            onPress={() => markRead.mutate(unread.map((n) => n.id))}
          />
        ) : null}
        {items.map((n) => {
          const route = notificationRoute(n);
          return (
            <ListRow
              key={n.id}
              title={notificationTitle(n, t as never, language)}
              subtitle={formatDateTime(n.createdAt, language)}
              meta={
                !n.readAt ? (
                  <Text variant="caption" color="accentText">
                    {t('notifications.unread')}
                  </Text>
                ) : undefined
              }
              onPress={() => {
                if (!n.readAt) markRead.mutate([n.id]);
                if (route) router.push(route as never);
              }}
            />
          );
        })}
      </View>
    </Screen>
  );
}
