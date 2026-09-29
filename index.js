/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';

// ==== OLD CODE NOW ACTIVE ====
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
  
  const newTitle = remoteMessage.notification?.title || remoteMessage.data?.title || 'New Notification';
  const newBody = remoteMessage.notification?.body || remoteMessage.data?.body || 'You have a new message from dispatch.';

  const newAlertItem = {
    id: remoteMessage.messageId || Date.now().toString(),
    title: newTitle,
    description: newBody,
    time: 'JUST NOW',
    type: 'high',
    read: false
  };

  try {
    const stored = await AsyncStorage.getItem('saved_alerts');
    const alerts = stored ? JSON.parse(stored) : [];
    alerts.unshift(newAlertItem);
    await AsyncStorage.setItem('saved_alerts', JSON.stringify(alerts));
  } catch (error) {
    console.log('Error saving background alert', error);
  }

  // Display notification in system tray when in background
  try {
    const channelId = await notifee.createChannel({
      id: 'high_priority',
      name: 'High Priority Alerts',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    await notifee.displayNotification({
      title: newTitle,
      body: newBody,
      android: {
        channelId: channelId,
        importance: AndroidImportance.HIGH,
        smallIcon: 'ic_launcher',
        pressAction: {
          id: 'default',
        },
      },
    });
  } catch (error) {
    console.log('Error displaying background notification', error);
  }
});
// =============================================

// Notifee requires a background event handler to be registered early, 
// otherwise the app can crash when closed if a notification action happens
notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('Notifee background event received:', type);
});

AppRegistry.registerComponent(appName, () => App);
