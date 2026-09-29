import { apiClient } from '../../api/index';

export const notificationApi = {
  registerToken: async (token: string) => {
    try {
      const res = await apiClient.post('/api/mobile/notifications/register-token', { token });
      return res.data;
    } catch (error) {
      console.error('Error registering FCM token:', error);
      throw error;
    }
  },
};
