import { Platform } from 'react-native';

// Dynamically switches between local and live server without changing code!
// IMPORTANT: 
// 1. If using an Emulator, use http://10.0.2.2:8025
// 2. If using a Physical Phone via USB/WiFi, use your PC's WiFi IP (e.g., http://192.168.1.5:8025)
// const LOCAL_IP = 'http://10.0.2.2:8025';
const LIVE_URL = 'https://xcelrt.com:8025';

// const LIVE_URL = 'https://cash.xcelrt.com:8025';

const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return LIVE_URL;
  }
  return LIVE_URL;
};

const BASE_URL = getBaseUrl();
export const IMAGE_BASE_URL = `${BASE_URL}/public`;
export default BASE_URL;
