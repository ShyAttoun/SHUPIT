import { WaitProgress } from '@/design';
import { useTranslation } from '@/i18n';

/** The standard wait indicator for AI reads (screenshots, pasted text, pages). */
export function AiWait({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <WaitProgress
      active={active}
      stages={[
        { from: 0, text: t('wait.uploading') },
        { from: 2, text: t('wait.reading') },
        { from: 20, text: t('wait.finishing') },
      ]}
      slowNote={t('wait.slow')}
    />
  );
}
