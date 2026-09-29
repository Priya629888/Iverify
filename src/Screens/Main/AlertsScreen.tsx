import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, Alert, Vibration } from 'react-native';
import { Bell, Info, ShieldAlert, Sparkles, CheckCheck, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGetAssignedAssignmentsQuery, mobileApi } from '../../Redux/api/index';
import { store } from '../../Redux/store';
import { useAuth } from '../../contexts/AuthContext';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { notificationApi } from '../../Redux/api/notification';

export default function AlertsScreen() {
  const { user } = useAuth();
  const assigneeId = user?.id || user?.user?.id || user?.data?.id || user?.user_id || '00000000-0000-0000-0000-000000000011';

  const [alerts, setAlerts] = useState<any[]>([]);
  const prevCasesRef = useRef<string[]>([]);

  // Poll assigned cases every 10 seconds
  const { data: casesData } = useGetAssignedAssignmentsQuery({ assignee_id: assigneeId }, { pollingInterval: 10000 });

  useEffect(() => {
    const loadStoredReadStatus = async () => {
      try {
        const stored = await AsyncStorage.getItem('saved_alerts_read_status');
        return stored ? JSON.parse(stored) : {};
      } catch (err) {
        return {};
      }
    };

    const rawCasesArray = Array.isArray(casesData) ? casesData : (casesData?.data || []);
    const casesArray = rawCasesArray.filter((c: any) => {
      const caseStatus = (c.status || '').toLowerCase();
      if (caseStatus === 'completed' || caseStatus === 'submitted') return false;

      const myVerifications = (c.verifications || []).filter((v: any) => v.verifier_id === assigneeId);
      const myPartsCompleted = myVerifications.length > 0 && myVerifications.every((v: any) => v.status === 'completed' || v.status === 'submitted');
      if (myPartsCompleted) return false;

      if (c.assignee_id === assigneeId) return true;
      const isVerifier = myVerifications.length > 0;
      return isVerifier;
    });

    if (casesData) {
      loadStoredReadStatus().then(async (readStatusObj) => {
        const newAlerts = casesArray.map((c: any) => ({
          id: c.id?.toString() || Math.random().toString(),
          title: `${c.case_no}`,
          description: `${c.applicant_name} | ${c.location || 'N/A'}`,
          time: new Date(c.created_at).toLocaleDateString(),
          type: c.priority === 'critical' || c.priority === 'high' ? 'high' : 'low',
          read: readStatusObj[c.id?.toString()] || false
        }));

        try {
          const storedBgAlerts = await AsyncStorage.getItem('saved_alerts');
          if (storedBgAlerts) {
            const bgAlerts = JSON.parse(storedBgAlerts);
            // Merge and avoid duplicates by ID
            const combined = [...bgAlerts, ...newAlerts];
            const uniqueAlerts = combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
            setAlerts(uniqueAlerts);
          } else {
            setAlerts(newAlerts);
          }
        } catch (e) {
          setAlerts(newAlerts);
        }

        // Notify if there are new cases
        const newIds = casesArray.map((c: any) => c.id ? c.id.toString() : '');
        const prevIds = prevCasesRef.current || [];
        const hasNewCases = newIds.some((id: string) => id !== '' && prevIds.indexOf(id) === -1);

        if (hasNewCases && prevIds.length > 0) {
          // Normal pattern: long vibration followed by standard system alert sound
          Vibration.vibrate([0, 500, 200, 500]);
          Alert.alert('New Alert Received', 'You have new cases assigned from dispatch.');
        }
        prevCasesRef.current = newIds;
      });
    }
  }, [casesData]);

  useEffect(() => {
    const requestUserPermission = async () => {
      try {
        const authStatus = await messaging().requestPermission();

        // Ensure notifee also requests permissions
        await notifee.requestPermission();

        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        // Commented out as this is now handled globally in AuthContext
        if (enabled) {
          const token = await messaging().getToken();
          if (token) {
            await notificationApi.registerToken(token);
          }
        }
      } catch (error) {
        console.log('Firebase permission error:', error);
      }
    };

    requestUserPermission();

    const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
      if (remoteMessage.notification) {
        Vibration.vibrate(500);

        // 1. Create channel for Android
        const channelId = await notifee.createChannel({
          id: 'default',
          name: 'Default Channel',
          importance: AndroidImportance.HIGH,
        });

        // 2. Display notification
        await notifee.displayNotification({
          title: remoteMessage.notification.title,
          body: remoteMessage.notification.body,
          android: {
            channelId,
            smallIcon: 'ic_launcher',
            pressAction: {
              id: 'default',
            },
          },
          ios: {
            foregroundPresentationOptions: {
              badge: true,
              sound: true,
              banner: true,
              list: true,
            },
          },
        });

        // Trigger immediate cache invalidation and refetch
        store.dispatch(mobileApi.util.invalidateTags(['Cases', 'Dashboard']));
      } else if (remoteMessage.data) {
        // If data only, just vibrate and invalidate
        Vibration.vibrate(500);
        store.dispatch(mobileApi.util.invalidateTags(['Cases', 'Dashboard']));
      }
    });

    return () => {
      unsubscribeMessage();
    };
  }, []);

  const unreadCount = alerts.filter(a => !a.read).length;

  const saveReadStatus = (updatedAlerts: any[]) => {
    const readStatusObj: any = {};
    updatedAlerts.forEach(a => {
      if (a.read) readStatusObj[a.id] = true;
    });
    AsyncStorage.setItem('saved_alerts_read_status', JSON.stringify(readStatusObj)).catch(e => console.log(e));
  };

  const handleMarkAllRead = () => {
    const updated = alerts.map(a => ({ ...a, read: true }));
    setAlerts(updated);
    saveReadStatus(updated);
  };

  const handleClearAlerts = () => {
    setAlerts([]);
    AsyncStorage.setItem('saved_alerts_read_status', JSON.stringify({})).catch(e => console.log(e));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Application Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Bell size={16} color="white" />
          </View>
          <Text style={styles.headerTitle}>System Alerts {alerts.length > 0 ? `(${alerts.length})` : ''}</Text>
        </View>

        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount} unread</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Bulk Action header links */}
        {alerts.length > 0 && (
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.actionBtn}>
              <CheckCheck size={12} color="#003d9b" />
              <Text style={styles.actionTextBlue}>MARK ALL READ</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleClearAlerts} style={styles.actionBtn}>
              <Trash2 size={12} color="#dc2626" />
              <Text style={styles.actionTextRed}>CLEAR FEED</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Alerts card list */}
        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={40} color="#e4e4e7" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Clear Skies!</Text>
            <Text style={styles.emptyDesc}>No active notifications or critical alerts from dispatch.</Text>
          </View>
        ) : (
          <View style={styles.alertsList}>
            {alerts.map((alert) => {
              let alertIcon = <Info size={16} color="#3b82f6" />;
              let alertBg = { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' };

              if (alert.type === 'high') {
                alertIcon = <ShieldAlert size={16} color="#ef4444" />;
                alertBg = { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' };
              } else if (alert.type === 'low') {
                alertIcon = <Sparkles size={16} color="#22c55e" />;
                alertBg = { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.2)' };
              }

              return (
                <TouchableOpacity
                  key={alert.id}
                  style={[
                    styles.alertCard,
                    alertBg,
                    !alert.read && styles.alertCardUnread
                  ]}
                  onPress={() => {
                    const updated = alerts.map(a => a.id === alert.id ? { ...a, read: true } : a);
                    setAlerts(updated);
                    saveReadStatus(updated);
                  }}
                >
                  {!alert.read && <View style={styles.unreadDot} />}

                  <View style={styles.alertIconCol}>{alertIcon}</View>

                  <View style={styles.alertContent}>
                    <Text style={[styles.alertTitle, !alert.read && styles.alertTitleUnread]}>{alert.title}</Text>
                    <Text style={styles.alertDesc}>{alert.description}</Text>
                    <Text style={styles.alertTime}>{alert.time}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', marginTop: Platform.OS === 'android' ? 10 : 0 },
  header: { height: Platform.OS === 'android' ? 65 : 56, paddingTop: Platform.OS === 'android' ? 15 : 0, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f4f4f5', elevation: 2, zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { width: 32, height: 32, backgroundColor: '#003d9b', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 11, fontWeight: '800', color: '#18181b', letterSpacing: -0.5 },
  unreadBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#fee2e2' },
  unreadBadgeText: { color: '#dc2626', fontSize: 8, fontWeight: '800' },

  scrollContent: { padding: 16, paddingBottom: 100 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionTextBlue: { color: '#003d9b', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  actionTextRed: { color: '#dc2626', fontSize: 8, fontWeight: '800', letterSpacing: 1 },

  emptyState: { backgroundColor: 'white', borderRadius: 16, padding: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f4f4f5', elevation: 1 },
  emptyTitle: { fontSize: 10, fontWeight: 'bold', color: '#27272a' },
  emptyDesc: { fontSize: 10, color: '#a1a1aa', textAlign: 'center', marginTop: 4, maxWidth: 200 },

  alertsList: { gap: 12 },
  alertCard: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, position: 'relative' },
  alertCardUnread: {},
  unreadDot: { position: 'absolute', top: 16, right: 16, width: 8, height: 8, backgroundColor: '#003d9b', borderRadius: 4 },
  alertIconCol: { marginRight: 14, marginTop: 2 },
  alertContent: { flex: 1, paddingRight: 16 },
  alertTitle: { fontSize: 10, fontWeight: '800', color: '#3f3f46', marginBottom: 4 },
  alertTitleUnread: { color: '#18181b', fontWeight: '900' },
  alertDesc: { fontSize: 9, color: '#71717a', fontWeight: '500', lineHeight: 16 },
  alertTime: { fontSize: 8, fontWeight: 'bold', color: '#a1a1aa', marginTop: 6, letterSpacing: 1 }
});
