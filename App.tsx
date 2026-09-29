/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import StackNav from './src/Navigators/StackNav';
import { AuthProvider } from './src/contexts/AuthContext';

import { Provider } from 'react-redux';
import { store } from './src/Redux/store';
import { setupListeners } from '@reduxjs/toolkit/query';
import React, { useEffect } from 'react';
import { AppState, AppStateStatus, PermissionsAndroid, Platform } from 'react-native';
import { mobileApi } from './src/Redux/api';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { notificationApi } from './src/Redux/api/notification';

setupListeners(store.dispatch);

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    // Create a channel required for Android 8.0+
    async function setupChannel() {
      await notifee.createChannel({
        id: 'high_priority',
        name: 'High Priority Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
    }
    setupChannel();

    // Request Notification permission for Android 13+ and iOS
    async function requestPermissions() {
      try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
        }
        await notifee.requestPermission();
        await messaging().requestPermission();

        console.log('[FCM] About to request token...');
        const token = await messaging().getToken();
        console.log('[FCM] Token response:', token);
        if (token) {
          console.log('[FCM] Initial token retrieved:', token);
        }
      } catch (err) {
        console.log('[FCM] Permission request error:', err);
      }
    }
    requestPermissions();

    // Listen to foreground notifications
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('[FCM] Foreground notification received:', remoteMessage);
      const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'New Assignment';
      const body = remoteMessage.notification?.body || remoteMessage.data?.body || 'You have new work assigned.';

      try {
        await notifee.displayNotification({
          title: title as string,
          body: body as string,
          android: {
            channelId: 'high_priority',
            importance: AndroidImportance.HIGH,
            smallIcon: 'ic_launcher',
            sound: 'default',
            pressAction: {
              id: 'default',
            },
          },
        });
      } catch (e) {
        console.log('[Notifee] Display error:', e);
        // Fallback alert for the user in foreground
        import('react-native').then(({ Alert }) => {
          Alert.alert(title as string, body as string);
        });
      }
    });

    // Listen to token refresh
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async token => {
      try {
        await notificationApi.registerToken(token);
      } catch (error) {
        console.log('Error registering refreshed token', error);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeTokenRefresh();
    };
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AuthProvider>
          <StackNav />
        </AuthProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
