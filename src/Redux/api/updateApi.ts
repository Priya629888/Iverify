import { mobileApi } from './index';
import { apiClient } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BASE_URL from '../../baseurl';
import axios from 'axios';

export const updateApi = mobileApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfileSettings: builder.query<any, void>({
      query: () => ({
        url: '/api/mobile/profile',
        method: 'GET',
      }),
    }),
    updateProfileSettings: builder.mutation<any, any>({
      query: (settings) => ({
        url: '/api/mobile/profile/settings',
        method: 'PUT',
        data: settings,
      }),
    }),
    uploadCaseDocument: builder.mutation<any, { id: string | number; fileData: { uri: string; type: string; name: string }, doc_type?: string }>({
      queryFn: async ({ id, fileData, doc_type }, _queryApi, _extraOptions, _baseQuery) => {
        try {
          const formData = new FormData();
          formData.append('file', fileData as any);
          if (doc_type) {
            formData.append('doc_type', doc_type);
          }

          const token = await AsyncStorage.getItem('token');
          const response = await axios.post(`${BASE_URL}/api/mobile/cases/${id}/documents`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
            }
          });

          return { data: response.data };
        } catch (error: any) {
          return {
            error: {
              status: error.response?.status,
              data: error.response?.data || error.message,
            },
          };
        }
      },
    }),
    extractDocument: builder.mutation<any, { uri: string; type: string; name: string }>({
      queryFn: async (fileData, _queryApi, _extraOptions, _baseQuery) => {
        try {
          const formData = new FormData();
          formData.append('file', fileData as any);

          const token = await AsyncStorage.getItem('token');
          const response = await axios.post(`${BASE_URL}/api/ocr/extract`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
            }
          });

          return { data: response.data };
        } catch (error: any) {
          return {
            error: {
              status: error.response?.status,
              data: error.response?.data || error.message,
            },
          };
        }
      },
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetProfileSettingsQuery,
  useUpdateProfileSettingsMutation,
  useUploadCaseDocumentMutation,
  useExtractDocumentMutation,
} = updateApi;
