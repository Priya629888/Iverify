
import { useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

export default function TabLayout() {
  useColorScheme();

  return (
    <View style={{ flex: 1 }}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </View>
  );
}
