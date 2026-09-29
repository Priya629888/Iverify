import { mobileApi } from './index';

export const attendanceApi = mobileApi.injectEndpoints({
  endpoints: (builder) => ({
    getAttendanceRecords: builder.query<any, { month?: number; year?: number } | void>({
      query: (params) => {
        let url = `/api/attendance/`;
        if (params && params.month && params.year) {
          url += `?month=${params.month}&year=${params.year}`;
        }
        return {
          url,
          method: 'GET',
        };
      },
      providesTags: ['Attendance'] as any,
    }),
    getLiveStatus: builder.query<any, void>({
      query: () => ({
        url: `/api/attendance/live`,
        method: 'GET',
      }),
      providesTags: ['AttendanceLive'] as any,
    }),
    getTodayStatus: builder.query<any, void>({
      query: () => ({
        url: `/api/attendance/today`,
        method: 'GET',
      }),
      providesTags: ['AttendanceToday'] as any,
    }),
    punchAttendance: builder.mutation<any, { mode: 'WFO' | 'WFH' }>({
      query: (data) => ({
        url: `/api/attendance/punch`,
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Attendance', 'AttendanceLive', 'AttendanceToday'] as any,
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetAttendanceRecordsQuery,
  useGetLiveStatusQuery,
  useGetTodayStatusQuery,
  usePunchAttendanceMutation,
} = attendanceApi;
