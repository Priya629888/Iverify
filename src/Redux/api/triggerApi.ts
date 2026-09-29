import { mobileApi } from './index';

export const triggerApi = mobileApi.injectEndpoints({
  endpoints: (builder) => ({
    getGroupedTriggers: builder.query<any, void>({
      query: () => ({ url: '/api/triggers', method: 'GET' }),
      providesTags: ['Triggers'] as any,
    }),
    getFlatTriggers: builder.query<any, void>({
      query: () => ({ url: '/api/triggers/flat', method: 'GET' }),
      providesTags: ['Triggers'] as any,
    }),
    createTrigger: builder.mutation<any, any>({
      query: (data) => ({ url: '/api/triggers', method: 'POST', data }),
      invalidatesTags: ['Triggers'] as any,
    }),
    updateTrigger: builder.mutation<any, { id: string | number; data: any }>({
      query: ({ id, data }) => ({ url: `/api/triggers/${id}`, method: 'PATCH', data }),
      invalidatesTags: ['Triggers'] as any,
    }),
    deleteTrigger: builder.mutation<any, string | number>({
      query: (id) => ({ url: `/api/triggers/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Triggers'] as any,
    }),
    getTriggerCategories: builder.query<any, void>({
      query: () => ({ url: '/api/triggers/categories', method: 'GET' }),
      providesTags: ['TriggerCategories'] as any,
    }),
    createTriggerCategory: builder.mutation<any, any>({
      query: (data) => ({ url: '/api/triggers/categories', method: 'POST', data }),
      invalidatesTags: ['TriggerCategories'] as any,
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetGroupedTriggersQuery,
  useGetFlatTriggersQuery,
  useCreateTriggerMutation,
  useUpdateTriggerMutation,
  useDeleteTriggerMutation,
  useGetTriggerCategoriesQuery,
  useCreateTriggerCategoryMutation,
} = triggerApi;
