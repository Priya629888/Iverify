import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import * as LucideIcons from 'lucide-react-native';

const Icon = ({ name, size, color }: any) => {
  const componentName = name.split('-').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const IconComp = (LucideIcons as any)[componentName];
  if (!IconComp) return null;
  return <IconComp size={size} color={color} />;
};
import {
  useGetAttendanceRecordsQuery,
  useGetLiveStatusQuery,
  usePunchAttendanceMutation,
} from '../../Redux/api/attendanceApi';
import { useAuth } from '../../contexts/AuthContext';


// ---------------- Types ----------------
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'OFF DAY' | 'PENDING';

interface AttendanceRecord {
  date: string;
  loginTime: string | null;
  logoutTime: string | null;
  totalHours: string | null;
  breakTime: string | null;
  mode: 'WFO' | 'WFH' | null;
  status: AttendanceStatus;
  isPunchedIn?: boolean;
}

const getLocalDateStr = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------- Status Style Helper ----------------
const getStatusStyle = (status: AttendanceStatus) => {
  switch (status) {
    case 'PRESENT':
      return { bg: '#DCFCE7', text: '#16A34A', dot: '#22C55E' };
    case 'ABSENT':
      return { bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' };
    case 'OFF DAY':
      return { bg: '#FEF3C7', text: '#D97706', dot: '#F59E0B' };
    case 'PENDING':
      return { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
    default:
      return { bg: '#F1F5F9', text: '#64748B', dot: '#94A3B8' };
  }
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const date = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return { day, date, month };
};

const formatTime = (isoString?: string | Date | null) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// ---------------- Attendance Card ----------------
const AttendanceCard: React.FC<{ item: AttendanceRecord }> = ({ item }) => {
  const statusStyle = getStatusStyle(item.status);
  const { day, date, month } = formatDate(item.date);

  return (
    <View style={styles.card}>
      {/* Date Block */}
      <View style={styles.dateBlock}>
        <Text style={styles.dateNumber}>{date}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
        <Text style={styles.dateDay}>{day}</Text>
      </View>

      {/* Vertical Divider */}
      <View style={styles.divider} />

      {/* Details */}
      <View style={styles.detailsBlock}>
        <View style={styles.detailsRow}>
          <View style={styles.timeCol}>
            <Text style={styles.label}>LOGIN</Text>
            <Text style={styles.timeValue}>{item.loginTime ?? '—'}</Text>
          </View>
          <View style={styles.timeCol}>
            <Text style={styles.label}>LOGOUT</Text>
            <Text style={styles.timeValue}>{item.logoutTime ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.metaChip}>
            <Icon name="clock" size={12} color="#6366F1" />
            <Text style={styles.metaText}>{item.totalHours ?? '0.00h'}</Text>
          </View>
          <View style={styles.metaChip}>
            <Icon name="coffee" size={12} color="#F59E0B" />
            <Text style={styles.metaText}>{item.breakTime ?? '0.00h'}</Text>
          </View>
          {item.mode && (
            <View style={styles.metaChip}>
              <Icon name={item.mode === 'WFH' ? 'home' : 'wifi'} size={12} color="#64748B" />
              <Text style={styles.metaText}>{item.mode}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
        <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
        <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
      </View>
    </View>
  );
};

// ---------------- Main Screen ----------------
const AttendanceScreen: React.FC = () => {
  const [mode, setMode] = useState<'WFO' | 'WFH'>('WFH');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const currentMonthNum = selectedDate.getMonth() + 1;
  const currentYearNum = selectedDate.getFullYear();

  // API Data
  const { data: recordsData, isLoading: isRecordsLoading } = useGetAttendanceRecordsQuery({
    month: currentMonthNum,
    year: currentYearNum
  });
  const { data: liveData, isLoading: isLiveLoading } = useGetLiveStatusQuery();
  const [punchAttendance, { isLoading: isPunching }] = usePunchAttendanceMutation();
  const { user } = useAuth();

  const rawData: any[] = Array.isArray(recordsData?.data) ? recordsData.data : (Array.isArray(recordsData) ? recordsData : []);
  const attendanceData: AttendanceRecord[] = rawData.map((d: any) => ({
    date: d.date,
    loginTime: formatTime(d.login_time || d.loginTime),
    logoutTime: formatTime(d.logout_time || d.logoutTime),
    totalHours: typeof (d.total_hours || d.totalHours) === 'number' ? `${Number(d.total_hours || d.totalHours).toFixed(2)}h` : (d.total_hours || d.totalHours || '0.00h'),
    breakTime: (() => {
      if (d.break_time !== undefined || d.breakTime !== undefined) {
        const val = d.break_time !== undefined ? d.break_time : d.breakTime;
        return typeof val === 'number' ? `${val.toFixed(2)}h` : (val || '0.00h');
      }
      if (!d.login_time && !d.loginTime) return '0.00h';

      const login = new Date(d.login_time || d.loginTime);
      const isToday = getLocalDateStr(new Date()) === d.date;
      const isPunchedIn = !!(d.is_punched_in || d.isPunchedIn);
      const logoutTimeStr = d.logout_time || d.logoutTime;

      let spanEnd = new Date();
      if (!isToday && logoutTimeStr) {
        spanEnd = new Date(logoutTimeStr);
      }

      const elapsedHours = (spanEnd.getTime() - login.getTime()) / 3600000;
      let actualWork = Number(d.total_hours || d.totalHours || 0);

      if (isPunchedIn) {
        const lastPunchStr = d.last_punch_in || d.lastPunchIn;
        if (lastPunchStr) {
          actualWork += (new Date().getTime() - new Date(lastPunchStr).getTime()) / 3600000;
        }
      }

      const brk = elapsedHours - actualWork;
      return `${Math.max(0, brk).toFixed(2)}h`;
    })(),
    mode: (d.work_mode || d.mode || 'WFH').toUpperCase() as 'WFO' | 'WFH',
    status: (() => {
      let st = (d.status || '').toUpperCase() as AttendanceStatus;
      if (d.date === getLocalDateStr(new Date()) && st === 'ABSENT' && !d.is_punched_in && !d.isPunchedIn && !d.login_time && !d.loginTime) {
        return 'PENDING';
      }
      return st;
    })(),
    isPunchedIn: !!(d.is_punched_in || d.isPunchedIn),
  }));

  const todayDateStr = getLocalDateStr(new Date());
  const todaysRecord = attendanceData.find(d => d.date && d.date.startsWith(todayDateStr));

  const currentUserLive = Array.isArray(liveData) ? liveData.find((u: any) => u.userId === user?.id) : liveData;
  const isPunchedIn = currentUserLive?.is_punched_in || currentUserLive?.isPunchedIn || todaysRecord?.isPunchedIn || false;

  const today = new Date();
  const currentYear = today.getFullYear();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dynamicMonthLabel = `${monthNames[selectedDate.getMonth()]} ${currentYearNum}`;

  // Check if API explicitly provides statuses
  const explicitAbsents = attendanceData.filter((d) => d.status === 'ABSENT').length;
  const explicitOffs = attendanceData.filter((d) => d.status === 'OFF DAY').length;
  const explicitPresents = attendanceData.filter((d) => d.status.includes('PRESENT')).length;

  let presentCount = explicitPresents;
  let absentCount = explicitAbsents;
  let offCount = explicitOffs;

  // If API only returned punch records (no explicit absents/offs), calculate dynamically
  if (explicitAbsents === 0 && explicitOffs === 0 && attendanceData.length > 0) {
    presentCount = attendanceData.length;

    let sundaysPassed = 0;
    let daysToCount = 0;

    if (selectedDate.getFullYear() === today.getFullYear() && selectedDate.getMonth() === today.getMonth()) {
      daysToCount = today.getDate();
    } else if (selectedDate < today) {
      daysToCount = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    }

    for (let i = 1; i <= daysToCount; i++) {
      const d = new Date(currentYearNum, selectedDate.getMonth(), i);
      if (d.getDay() === 0) sundaysPassed++; // Count Sundays as Off Days
    }

    offCount = sundaysPassed;
    absentCount = Math.max(0, daysToCount - presentCount - offCount);
  }

  const handlePunch = async () => {
    try {
      await punchAttendance({ mode }).unwrap();
    } catch (err) {
      console.log('Error punching in/out', err);
    }
  };

  const filteredRecords = attendanceData.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const { day, date, month } = formatDate(d.date);
    const searchString = `${date} ${month} ${day} ${d.date}`.toLowerCase();
    return searchString.includes(q);
  });

  // Calculate live break time
  let currentBreakTime = todaysRecord?.breakTime || '0.00h';
  if (currentUserLive?.break_time !== undefined || currentUserLive?.breakTime !== undefined) {
    const lb = currentUserLive.break_time !== undefined ? currentUserLive.break_time : currentUserLive.breakTime;
    currentBreakTime = typeof lb === 'number' ? `${Number(lb).toFixed(2)}h` : (lb || '0.00h');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <LinearGradient colors={['#EEF2FF', '#F8FAFC']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Attendance</Text>
            <Text style={styles.headerSubtitle}>Track your monthly records</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Icon name="bell" size={20} color="#334155" />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          >
            <Icon name="chevron-left" size={18} color="#475569" />
          </TouchableOpacity>
          <View style={styles.monthLabelBox}>
            <Icon name="calendar" size={14} color="#6366F1" />
            <Text style={styles.monthLabel}>{dynamicMonthLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          >
            <Icon name="chevron-right" size={18} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Mode + Punch In */}
        <View style={styles.actionRow}>
          <View style={styles.modeSwitcher}>
            {(['WFO', 'WFH'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeOption, mode === m && styles.modeOptionActive]}
                onPress={() => setMode(m)}
                disabled={isPunchedIn}
              >
                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.punchBtn, isPunchedIn && styles.punchBtnActive]}
            onPress={handlePunch}
            disabled={isPunching || isLiveLoading}
          >
            {isPunching ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Icon name={isPunchedIn ? 'log-out' : 'clock'} size={16} color="#FFFFFF" />
                <Text style={styles.punchBtnText}>{isPunchedIn ? 'Punch Out' : 'Punch In'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Live Break Time Display */}

      </LinearGradient>

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
          <Text style={[styles.statNumber, { color: '#16A34A' }]}>{presentCount}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEF2F2' }]}>
          <Text style={[styles.statNumber, { color: '#DC2626' }]}>{absentCount}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FFFBEB' }]}>
          <Text style={[styles.statNumber, { color: '#D97706' }]}>{offCount}</Text>
          <Text style={styles.statLabel}>Off Day</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Icon name="search" size={16} color="#94A3B8" />
        <TextInput
          placeholder="Search by date..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>My Attendance Records</Text>
        {isRecordsLoading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
        ) : filteredRecords.length > 0 ? (
          filteredRecords.map((item, index) => (
            <AttendanceCard key={`${item.date}-${index}`} item={item} />
          ))
        ) : (
          <Text style={{ textAlign: 'center', marginTop: 20, color: '#94A3B8' }}>No records found</Text>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 12,
  },
  monthBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 150,
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 3,
  },
  modeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeOptionActive: {
    backgroundColor: '#6366F1',
  },
  modeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  punchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#16A34A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  punchBtnActive: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
  },
  punchBtnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  breakTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 16,
    alignSelf: 'center',
  },
  breakTimeText: {
    marginLeft: 6,
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 9,
    color: '#0F172A',
  },
  list: {
    flex: 1,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dateBlock: {
    alignItems: 'center',
    width: 44,
  },
  dateNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dateMonth: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6366F1',
    marginTop: -2,
  },
  dateDay: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 12,
  },
  detailsBlock: {
    flex: 1,
    gap: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeCol: {
    gap: 1,
  },
  label: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  timeValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '800',
  },
});

export default AttendanceScreen;
