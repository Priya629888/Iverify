import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Compass, Map, Bell, CircleUser, CalendarCheck, ClipboardCheck } from 'lucide-react-native';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useGetAssignedAssignmentsQuery } from '../Redux/api';

import Dashboard from '../Screens/Main/Dashboard';
import CasesListScreen from '../Screens/Main/CasesListScreen';
import MapOverviewScreen from '../Screens/Main/MapOverviewScreen';
import AlertsScreen from '../Screens/Main/AlertsScreen';
import ProfileScreen from '../Screens/Main/ProfileScreen';
import AttendanceScreen from '../Screens/Main/AttendanceScreen';
import AssignedCasesScreen from '../Screens/Main/AssignedCasesScreen';
const Tab = createBottomTabNavigator();

export default function MainTabNav() {
  const { user } = useAuth();
  const assigneeId = user?.id || user?.user?.id || user?.data?.id || user?.user_id || '00000000-0000-0000-0000-000000000011';

  const { data: casesData } = useGetAssignedAssignmentsQuery({ assignee_id: assigneeId }, { pollingInterval: 10000 });
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    const calculateUnread = async () => {
      try {
        const storedReadStatus = await AsyncStorage.getItem('saved_alerts_read_status');
        const readStatusObj = storedReadStatus ? JSON.parse(storedReadStatus) : {};

        const storedBgAlerts = await AsyncStorage.getItem('saved_alerts');
        const alerts = storedBgAlerts ? JSON.parse(storedBgAlerts) : [];

        const rawCasesArray = Array.isArray(casesData) ? casesData : (casesData?.data || []);
        const casesArray = rawCasesArray.filter((c: any) => {
          const caseStatus = (c.status || '').toLowerCase();
          if (caseStatus === 'completed' || caseStatus === 'submitted') return false;
          const myVerifications = (c.verifications || []).filter((v: any) => v.verifier_id === assigneeId);
          const myPartsCompleted = myVerifications.length > 0 && myVerifications.every((v: any) => v.status === 'completed' || v.status === 'submitted');
          if (myPartsCompleted) return false;
          if (c.assignee_id === assigneeId) return true;
          return myVerifications.length > 0;
        });

        const newAlerts = casesArray.map((c: any) => ({
          id: c.id?.toString() || Math.random().toString(),
          read: readStatusObj[c.id?.toString()] || false
        }));

        const combined = [...alerts, ...newAlerts];
        const uniqueAlerts = combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

        const unread = uniqueAlerts.filter((a: any) => !a.read).length;
        setUnreadCount(unread);
      } catch (err) {
        console.log(err);
      }
    };

    calculateUnread();
    const interval = setInterval(calculateUnread, 2000);
    return () => clearInterval(interval);
  }, [casesData, assigneeId]);

  return (
    <Tab.Navigator
      screenOptions={({ route }: any) => ({
        headerShown: false,
        tabBarIcon: ({ color, size, focused }: any) => {
          let Icon;
          switch (route.name) {
            case 'Home': Icon = Home; break;
            case 'Attendance': Icon = CalendarCheck; break;
            case 'Assigned': Icon = ClipboardCheck; break;
            case 'Alerts': Icon = Bell; break;
            case 'Profile': Icon = CircleUser; break;
            case 'Cases': Icon = Compass; break;
            default: Icon = Home;
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Icon
                size={focused ? 24 : 22}
                color={focused ? '#003d9b' : '#a1a1aa'}
                strokeWidth={focused ? 2.5 : 2}
              />
              {/* Red dot for Alerts with number */}
              {route.name === 'Alerts' && unreadCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -6,
                  right: -10,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#ef4444',
                  borderWidth: 1.5,
                  borderColor: 'white',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 2
                }}>
                  <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          );
        },
        tabBarActiveTintColor: '#003d9b',
        tabBarInactiveTintColor: '#a1a1aa',
        tabBarStyle: { height: 107, paddingBottom: 10, paddingTop: 10, elevation: 20, borderTopColor: '#f4f4f5', backgroundColor: 'white' },
        tabBarLabelStyle: { fontSize: 10, fontWeight: 'bold', marginTop: 4 }
      })}
    >
      <Tab.Screen name="Home" component={Dashboard} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ tabBarLabel: 'Attendance' }} />
      <Tab.Screen name="Assigned" component={AssignedCasesScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />

      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
