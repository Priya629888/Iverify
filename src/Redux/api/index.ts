import { createApi } from '@reduxjs/toolkit/query/react';
import { apiClient } from '../../api';

// Custom base query using existing axios instance (which handles AsyncStorage tokens)
const axiosBaseQuery =
  () =>
    async ({ url, method, data, params }: any) => {
      try {
        const result = await apiClient({ url, method, data, params });
        return { data: result.data?.data || result.data };
      } catch (axiosError: any) {
        let err = axiosError;
        return {
          error: {
            status: err.response?.status,
            data: err.response?.data || err.message,
          },
        };
      }
    };

export const mobileApi = createApi({
  reducerPath: 'mobileApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Attendance', 'AttendanceLive', 'AttendanceToday', 'Cases', 'Dashboard'],
  endpoints: (builder) => ({
    getDashboardStats: builder.query<any, { assignee_id?: string } | void>({
      query: (arg) => {
        let params: any = {};
        if (arg && arg.assignee_id) params.assignee_id = arg.assignee_id;
        return {
          url: '/api/reports/dashboard',
          method: 'GET',
          params: Object.keys(params).length > 0 ? params : undefined
        };
      },
      providesTags: ['Dashboard'],
    }),
    getAssignedCases: builder.query<any, { search?: string, page?: number, limit?: number, assignee_id?: string, status?: string, stage?: string } | string | void>({
      query: (arg) => {
        let params: any = {};
        if (typeof arg === 'string') {
          if (arg) params.search = arg;
        } else if (arg) {
          if (arg.search) params.search = arg.search;
          if (arg.page) params.page = arg.page;
          if (arg.limit) params.limit = arg.limit;
          if (arg.assignee_id) params.assignee_id = arg.assignee_id;
          if (arg.status) params.status = arg.status;
          if (arg.stage) params.stage = arg.stage;
        }
        return {
          url: '/api/cases',
          method: 'GET',
          params: Object.keys(params).length > 0 ? params : undefined
        };
      },
      providesTags: ['Cases'],
    }),
    getCaseDetails: builder.query<any, string | number>({
      query: (id) => ({ url: `/api/cases/${id}`, method: 'GET' }),
    }),
    getAssignedAssignments: builder.query<any, { assignee_id?: string } | void>({
      query: (arg) => {
        let params: any = {};
        if (arg && arg.assignee_id) params.assignee_id = arg.assignee_id;
        return {
          url: '/api/assignments/assigned',
          method: 'GET',
          params: Object.keys(params).length > 0 ? params : undefined
        };
      },
      providesTags: ['Cases'],
    }),
    submitFieldReport: builder.mutation<any, { caseId: string | number; formData: any }>({
      query: ({ caseId, formData }) => ({
        url: '/api/field-reports',
        method: 'POST',
        data: { case_id: caseId, ...formData },
      }),
      async onQueryStarted({ caseId }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          mobileApi.util.updateQueryData('getAssignedCases', undefined, (draft) => {
            const casesArray = Array.isArray(draft) ? draft : (draft?.data || []);
            const caseIndex = casesArray.findIndex((c: any) => c.id == caseId || c.case_id_display == caseId || c.case_no == caseId);
            if (caseIndex !== -1) {
              casesArray[caseIndex].status = 'submitted';
              casesArray[caseIndex].stage = 'Submitted';
            }
          })
        );
        const patchResultSearch = dispatch(
          mobileApi.util.updateQueryData('getAssignedCases', '', (draft) => {
            const casesArray = Array.isArray(draft) ? draft : (draft?.data || []);
            const caseIndex = casesArray.findIndex((c: any) => c.id == caseId || c.case_id_display == caseId || c.case_no == caseId);
            if (caseIndex !== -1) {
              casesArray[caseIndex].status = 'submitted';
              casesArray[caseIndex].stage = 'Submitted';
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          patchResultSearch.undo();
        }
      },
      invalidatesTags: ['Cases', 'Dashboard'],
    }),
    uploadCaseDocument: builder.mutation<any, { caseId: string | number; formData: FormData }>({
      query: ({ caseId, formData }) => ({
        url: `/api/mobile/cases/${caseId}/documents`,
        method: 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }),
    }),
    getLocations: builder.query<any, void>({
      query: () => ({ url: '/api/locations', method: 'GET' }),
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetAssignedCasesQuery,
  useGetCaseDetailsQuery,
  useGetAssignedAssignmentsQuery,
  useSubmitFieldReportMutation,
  useUploadCaseDocumentMutation,
  useGetLocationsQuery
} = mobileApi;
