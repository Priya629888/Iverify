import { mobileApi } from './index';
import BASE_URL from '../../baseurl';

export const mapApi = mobileApi.injectEndpoints({
  endpoints: (builder) => ({
    getMapCases: builder.query<any[], void>({
      query: () => ({
        url: `/api/mobile/cases`,
        method: 'GET',
        params: { filter: 'near_me' },
      }),
    }),
    getLocations: builder.query<any, void>({
      query: () => ({
        url: `/api/locations`,
        method: 'GET',
      }),
    }),
  }),
  overrideExisting: true,
});

export const { useGetMapCasesQuery, useGetLocationsQuery } = mapApi;
