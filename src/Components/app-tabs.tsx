import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'react-native';
import { Home, Compass } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import HomeScreen from '@/app/index';
import ExploreScreen from '@/app/explore';

const Tab = createBottomTabNavigator();

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: any }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.backgroundElement,
          borderTopColor: colors.backgroundElement,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        tabBarIcon: ({ color, size }: { color: string, size: number }) => {
          if (route.name === 'Home') {
            return <Home color={color} size={size} />;
          }
          if (route.name === 'Explore') {
            return <Compass color={color} size={size} />;
          }
          return null;
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
    </Tab.Navigator>
  );
}
