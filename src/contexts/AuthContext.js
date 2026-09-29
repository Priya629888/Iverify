import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { store } from '../Redux/store';
import { mobileApi } from '../Redux/api';
import messaging from '@react-native-firebase/messaging';
import { notificationApi } from '../Redux/api/notification';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const token = await AsyncStorage.getItem('token');
        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
          
          // Register FCM token on app load
          try {
            const fcmToken = await messaging().getToken();
            if (fcmToken) {
              await notificationApi.registerToken(fcmToken);
            }
          } catch (fcmErr) {
            console.log('FCM Token registration error on load:', fcmErr);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (mobile, password) => {
    const response = await api.login(mobile, password);
    if (response && response.token) {
      await AsyncStorage.setItem('token', response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data));
      await AsyncStorage.setItem('credentials', JSON.stringify({ mobile, password }));
      setUser(response.data);

      // Request permission for Android 13+ after successful login
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
        } catch (err) {
          console.warn(err);
        }
      }

      // Register FCM token on new login
      try {
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
          await notificationApi.registerToken(fcmToken);
        }
      } catch (fcmErr) {
        console.log('FCM Token registration error on login:', fcmErr);
      }

      return true;
    }
    return false;
  };

  const logout = async () => {
    try {
      // 1. AsyncStorage থেকে token + user + credentials মুছে দাও
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('credentials');
      // 2. RTK Query cache reset
      store.dispatch(mobileApi.util.resetApiState());
    } catch (err) {
      console.log('Logout error:', err);
    } finally {
      // 3. local state clear — সবসময় হবে
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
