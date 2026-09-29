import { mobileApi } from './index';
import BASE_URL from '../../baseurl';

export const trackingApi = mobileApi.injectEndpoints({
  endpoints: (builder) => ({
    startTrip: builder.mutation<any, { case_id: string | number }>({
      query: (data) => ({
        url: `/api/mobile/tracking/start`,
        method: 'POST',
        data,
      }),
    }),
    updateLocation: builder.mutation<any, { latitude: number; longitude: number }>({
      query: (data) => ({
        url: `/api/mobile/tracking/update`,
        method: 'POST',
        // data,
        data: { latitude: data.latitude, longitude: data.longitude },
      }),
    }),
    stopTrip: builder.mutation<any, void>({
      query: () => ({
        url: `/api/mobile/tracking/stop`,
        method: 'POST',
      }),
    }),
  }),
  overrideExisting: true,
});

export const {
  useStartTripMutation,
  useUpdateLocationMutation,
  useStopTripMutation,
} = trackingApi;
