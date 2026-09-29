import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BASE_URL from '../baseurl';

// In React Native, localhost points to the device itself.
// Use 10.0.2.2 for Android Emulator, or your machine's IP for physical devices.

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  if (!config.url.includes('mobile-login')) {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do NOT intercept if the request was to the login endpoint itself!
    if (error.response && error.response.status === 401 && !originalRequest._retry && !originalRequest.url.includes('mobile-login')) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const credentialsStr = await AsyncStorage.getItem('credentials');
        if (credentialsStr) {
          const { mobile, password } = JSON.parse(credentialsStr);
          const res = await axios.post(`${BASE_URL}/api/auth/mobile-login`, { mobile, password });

          if (res.data && res.data.token) {
            const newToken = res.data.token;
            await AsyncStorage.setItem('token', newToken);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;

            processQueue(null, newToken);
            isRefreshing = false;

            return apiClient(originalRequest);
          }
        }
        throw new Error("Credentials missing or invalid");
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        // Logout user here if auto-login fails completely
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('credentials');
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  login: async (mobile, password) => {
    const res = await apiClient.post('/api/auth/mobile-login', { mobile, password });
    console.log(res.data, "login")
    return res.data;
  },
  getAssignedCases: async () => {
    const res = await apiClient.get('/api/cases', { params: { limit: 100 } });
    return res.data?.data || [];
  },
  getCaseDetails: async (id) => {
    const res = await apiClient.get(`/api/cases/${id}`);
    return res.data?.data;
  },
  submitFieldReport: async (caseId, formData) => {
    const res = await apiClient.post('/api/field-reports', { case_id: caseId, ...formData });
    return res.data;
  }
};
