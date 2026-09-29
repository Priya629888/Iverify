import { configureStore } from '@reduxjs/toolkit';
import { mobileApi } from './api';

export const store = configureStore({
  reducer: {
    [mobileApi.reducerPath]: mobileApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(mobileApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
