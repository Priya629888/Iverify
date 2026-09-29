declare module 'expo-image';
declare module 'expo-splash-screen';
declare module 'react-native-reanimated';
declare module 'react-native-worklets';
declare module './*.module.css';
declare module '@react-navigation/bottom-tabs';
declare module 'expo-router' {
  export type Href<T = any> = string | { pathname: string; params?: any };
  export const Link: any;
}
declare module 'expo-web-browser';
declare module 'expo-symbols';
declare module 'expo/package.json';
declare module '@/constants/theme' {
  export type ThemeColor = any;
  export const Colors: any;
  export const Fonts: any;
  export const Spacing: any;
  export const BottomTabInset: any;
  export const MaxContentWidth: any;
}
declare var process: any;
