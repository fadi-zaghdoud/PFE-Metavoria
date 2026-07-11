import { apiRequest } from '../../lib/apiClient';
import type { Notification } from '../../types/ticket';

export const notificationsApi = {
  lister: (token: string) =>
    apiRequest<{ notifications: Notification[]; nonLues: number }>('/notifications', { token }),

  marquerLu: (id: number, token: string) =>
    apiRequest<void>(`/notifications/${id}/lu`, { method: 'PATCH', token }),

  marquerToutLu: (token: string) =>
    apiRequest<void>('/notifications/tout-lu', { method: 'PATCH', token }),
};
