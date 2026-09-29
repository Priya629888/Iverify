
// import {ImageSourcePropType} from 'react-native';

export const IMAGES: Record<string, any> = {
  Logo: require('../../src/assets/image/Logo.png'),
};

// export const ICONS = {
//   page1: require('../assets/icons/page1.png'),
// };

export const AppFonts = {
  MuktaBold: 'Mukta-Bold',
  MuktaExtraBold: 'Mukta-ExtraBold',
  MuktaLight: 'Mukta-Light',
  MuktaMedium: 'Mukta-Medium',
  MuktaRegular: 'Mukta-Regular',
  MuktaSemiBold: 'Mukta-SemiBold',
} as const;

export const COLORS = {
  primary: '#1565C0',
  black: '#000000',
  white: '#FFFFFF',
  lightpink: '#FFE9E9',
  gray: '#222222',
  litegreen: '#5AA320',
  blue: '#4385F5',
  red: '#E3332D',
  pink: '#FFBEC0',
} as const;  







/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;