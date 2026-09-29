import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import Splash from '../Screens/Default/Splash';
import Login from '../Screens/Auth/Login';
import MainTabNav from './MainTabNav';
import CaseDetailsScreen from '../Screens/Main/CaseDetailsScreen';
import ChecklistScreen from '../Screens/Main/ChecklistScreen';
import NavigationMapScreen from '../Screens/Main/NavigationMapScreen';
import AttendanceScreen from '../Screens/Main/AttendanceScreen';
import TriggerQuestionsScreen from '../Screens/Main/TriggerQuestionsScreen';
import MapOverviewScreen from '../Screens/Main/MapOverviewScreen';
import { useAuth } from '../contexts/AuthContext';

const Stack = createNativeStackNavigator();

export default function StackNav() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const isReady = !loading && !showSplash;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isReady ? (
          <Stack.Screen name="Splash" component={Splash} />
        ) : !user ? (
          <Stack.Screen name="Login" component={Login} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabNav} />
            <Stack.Screen name="CaseDetailsScreen" component={CaseDetailsScreen as any} />
            <Stack.Screen name="ChecklistScreen" component={ChecklistScreen as any} />
            <Stack.Screen name="NavigationMapScreen" component={NavigationMapScreen as any} />
            <Stack.Screen name="AttendanceScreen" component={AttendanceScreen as any} />
            <Stack.Screen name="TriggerQuestionsScreen" component={TriggerQuestionsScreen as any} />
            <Stack.Screen name="Map" component={MapOverviewScreen as any} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}