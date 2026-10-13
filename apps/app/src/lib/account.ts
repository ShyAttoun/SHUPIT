import { Platform, Share } from 'react-native';
import { apiFetch } from './api';

export interface Consents {
  aiProcessing: boolean;
  terms: boolean;
  policyVersion: string;
}

export const getConsents = () => apiFetch<Consents>('/api/account/consent');

export const setConsents = (body: { aiProcessing?: boolean; terms?: boolean }) =>
  apiFetch<Consents>('/api/account/consent', { method: 'POST', body });

export const deleteAccount = () => apiFetch<{ ok: true }>('/api/account/delete', { method: 'POST' });

/** Fetches the full export and hands it to the user (file download on web, share sheet on native). */
export async function exportMyData(): Promise<void> {
  const data = await apiFetch<unknown>('/api/account/export');
  const json = JSON.stringify(data, null, 2);
  const name = `shupit-export-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: name, message: json });
}
