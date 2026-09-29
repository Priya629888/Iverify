import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useGetDashboardStatsQuery, useGetAssignedAssignmentsQuery } from '../../Redux/api';
import {
  Home,
  CheckCircle2,
  FolderOpen,
  ShieldCheck,
  Map,
  Briefcase,
  ChevronRight,
  Clock,
  TrendingUp,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import normalize from '@/Utils/Helpers/normalize';

interface CaseItem {
  id: string | number;
  case_no: string;
  applicant_name: string;
  priority: string;
  location?: string;
  verification_type?: string;
  stage?: string;
  is_reassigned?: boolean;
  [key: string]: any;
}

interface DashboardScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    [key: string]: any;
  };
}

export default function Dashboard({ navigation }: DashboardScreenProps) {
  const { user } = useAuth();

  const assigneeId =
    user?.id || user?.user?.id || user?.data?.id || user?.user_id || '00000000-0000-0000-0000-000000000011';

  const { data: dashboardData, refetch: refetchDashboard } = useGetDashboardStatsQuery({ assignee_id: assigneeId }, { pollingInterval: 10000 });
  const { data: casesData, isFetching: refreshingCases, refetch: refetchCases } = useGetAssignedAssignmentsQuery({ assignee_id: assigneeId }, { pollingInterval: 10000 });

  const rawAssignedCases = Array.isArray(casesData) ? casesData : casesData?.data || [];

  // Strictly filter cases belonging to the current user (either main assignee or reassigned verifier)
  const myCases = rawAssignedCases.filter((c: any) => {
    if (c.assignee_id === assigneeId) return true;
    const isVerifier = (c.verifications || []).some((v: any) => v.verifier_id === assigneeId);
    return isVerifier;
  });

  const assignedCasesArray: CaseItem[] = myCases.map((c: any) => ({
    ...c,
    is_reassigned: !!c.is_reassigned || !!c.reassigned
  }));

  // Merge assigned cases without duplicates
  const allCasesRecord: Record<string | number, CaseItem> = {};
  assignedCasesArray.forEach((c) => { allCasesRecord[c.id] = c; });
  const cases: CaseItem[] = Object.values(allCasesRecord);

  const onRefresh = () => {
    refetchDashboard();
    refetchCases();
  };

  const pendingCases = cases.filter((c: any) => {
    const isOverallPending =
      c.status !== 'completed' && c.stage !== 'Completed' &&
      c.status !== 'submitted' && c.stage !== 'Submitted' &&
      (c.stage || '').toLowerCase() !== 'awaiting review' &&
      (c.status || '').toLowerCase() !== 'awaiting review';
    if (!isOverallPending) return false;
    const myVerifications = (c.verifications || []).filter((v: any) => v.verifier_id === assigneeId);
    if (myVerifications.length > 0) {
      if (myVerifications.every((v: any) => v.status === 'completed' || v.status === 'submitted')) return false;
    }
    return true;
  });

  const localCompletedCount = cases.filter((c: any) => {
    if (c.status === 'completed' || c.stage === 'Completed' || c.status === 'submitted' || c.stage === 'Submitted' ||
      (c.stage || '').toLowerCase() === 'awaiting review' || (c.status || '').toLowerCase() === 'awaiting review') return true;
    const myV = (c.verifications || []).filter((v: any) => v.verifier_id === assigneeId);
    if (myV.length > 0) return myV.every((v: any) => v.status === 'completed' || v.status === 'submitted');
    return false;
  }).length;

  const completedCount = dashboardData?.data?.stats?.completed_today ?? dashboardData?.stats?.completed_today ?? localCompletedCount;
  const totalCount = dashboardData?.data?.stats?.total_assigned ?? dashboardData?.stats?.total_assigned ?? Math.max(cases.length, 1);
  const pendingCount = pendingCases.length;
  const optimalStops = pendingCases.length;
  const agentName = dashboardData?.name || user?.full_name || user?.name || 'Agent';
  const progressPercent = Math.min((completedCount / (totalCount || 1)) * 100, 100);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <LinearGradient colors={['#1e3a8a', '#2563eb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.welcomeBanner}>
        <View style={styles.decCircle1} />
        <View style={styles.decCircle2} />
        <View style={styles.agentBadge}><Text style={styles.agentBadgeText}>AGENT PORTAL</Text></View>
        <Text style={styles.greetingText}>{greeting},</Text>
        <Text style={styles.welcomeTitle}>{agentName}</Text>
        <Text style={styles.welcomeDesc}>
          {pendingCount > 0
            ? `You have ${pendingCount} case${pendingCount > 1 ? 's' : ''} pending for verification.`
            : 'All your cases are up to date. Great work!'}
        </Text>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { flex: 1.2, padding: normalize(16) }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: normalize(8) }}>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { fontSize: normalize(28) }]}>{completedCount}</Text>
              <Text style={[styles.statValueOf, { fontSize: normalize(16) }]}> / {totalCount}</Text>
            </View>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} color="#2563eb" />
            </View>
          </View>
          <View style={[styles.progressBarBg, { height: normalize(6), borderRadius: normalize(3), marginBottom: normalize(8) }]}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%`, borderRadius: normalize(3) }]} />
          </View>
          <Text style={[styles.statSubText, { color: '#64748b', fontWeight: '500' }]}>Completed today</Text>
        </View>

        <View style={[styles.statCard, { flex: 0.9, marginLeft: normalize(10), justifyContent: 'space-between', padding: normalize(16) }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={[styles.statValue, { color: '#d97706', fontSize: normalize(28) }]}>{pendingCount}</Text>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpen size={18} color="#d97706" />
            </View>
          </View>
          <Text style={[styles.statSubText, { color: '#64748b', fontWeight: '500', marginTop: normalize(12) }]}>Cases active</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#2563eb', padding: normalize(16), borderRadius: normalize(16), flex: 1, borderWidth: 0 }]} onPress={() => navigation.navigate('Assigned')} activeOpacity={0.85}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: normalize(16) }}>
            <ShieldCheck size={20} color="white" />
          </View>
          <Text style={[styles.actionTitle, { fontSize: normalize(13) }]}>Start checklist</Text>
          <Text style={[styles.actionSub, { fontSize: normalize(11), color: '#bfdbfe' }]}>View assigned cases</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#ffffff', padding: normalize(16), borderRadius: normalize(16), flex: 1, marginLeft: normalize(12) }]} onPress={() => navigation.navigate('Map')} activeOpacity={0.85}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: normalize(16) }}>
            <Map size={20} color="#16a34a" />
          </View>
          <Text style={[styles.actionTitle, { color: '#1e293b', fontSize: normalize(13) }]}>Route map</Text>
          <Text style={[styles.actionSub, { color: '#64748b', fontSize: normalize(11) }]}>{optimalStops} stop{optimalStops !== 1 ? 's' : ''} overview</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.feedHeader}>
        <View>
          <Text style={styles.feedTitle}>Verification Feed</Text>
          <Text style={styles.feedSub}>Recent assignments</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      </View>
    </View>
  );

  const renderCase = ({ item, index }: { item: CaseItem, index: number }) => {
    const isCompleted =
      item.status === 'completed' || item.stage === 'Completed' ||
      item.status === 'submitted' || item.stage === 'Submitted' ||
      (item.stage || '').toLowerCase() === 'awaiting review';
    const typeLabel = (item.verification_type || '').replace(/_/g, ' ');
    return (
      <TouchableOpacity style={styles.caseCard} onPress={() => navigation.navigate('CaseDetailsScreen', { id: item.id, caseData: item })} activeOpacity={0.8}>
        <View style={[styles.caseIconBox, { backgroundColor: isCompleted ? '#f0fdf4' : '#eff6ff' }]}>
          <Briefcase size={20} color={isCompleted ? '#16a34a' : '#2563eb'} />
        </View>
        <View style={styles.caseInfo}>
          <Text style={styles.caseName} numberOfLines={1}>{item.applicant_name || 'Unknown Applicant'}</Text>
          <Text style={styles.caseSub} numberOfLines={1}>{typeLabel.toUpperCase()} · {item.case_no}</Text>
        </View>
        <View style={styles.caseRight}>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {item.is_reassigned && (
              <View style={[styles.pendingBadge, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                <Text style={[styles.pendingBadgeText, { color: '#ef4444' }]}>Reassigned</Text>
              </View>
            )}
            {isCompleted ? (
              <View style={styles.doneBadge}><Text style={styles.doneBadgeText}>Done</Text></View>
            ) : (
              <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Pending</Text></View>
            )}
          </View>
          <ChevronRight size={14} color="#cbd5e1" style={{ marginTop: normalize(4) }} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <TrendingUp size={36} color="#e2e8f0" />
      <Text style={styles.emptyTitle}>No Active Cases</Text>
      <Text style={styles.emptyDesc}>All assigned cases have been completed.</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={[styles.homeIconBox, { backgroundColor: '#dbeafe' }]}>
            <Home color="#2563eb" size={20} />
          </View>
          <View>
            <Text style={styles.topBarTitle}>Dashboard</Text>
            <Text style={styles.topBarSub}>Overview</Text>
          </View>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      <FlatList
        data={pendingCases}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCase}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshingCases} onRefresh={onRefresh} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: normalize(16),
    paddingTop: Platform.OS === 'android' ? normalize(44) : normalize(12),
    paddingBottom: normalize(12), backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: normalize(10) },
  homeIconBox: { width: normalize(44), height: normalize(44), borderRadius: normalize(12), alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: normalize(15), fontWeight: '700', color: '#0f172a', letterSpacing: -0.3 },
  topBarSub: { fontSize: normalize(10), color: '#94a3b8', fontWeight: '400', marginTop: 1 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', paddingHorizontal: normalize(10), paddingVertical: normalize(5), borderRadius: normalize(20), borderWidth: 1, borderColor: '#bbf7d0', gap: normalize(5) },
  onlineDot: { width: normalize(6), height: normalize(6), backgroundColor: '#22c55e', borderRadius: normalize(3) },
  onlineText: { fontSize: normalize(10), fontWeight: '600', color: '#16a34a' },
  listContent: { paddingBottom: normalize(24) },
  headerContent: { padding: normalize(14), paddingBottom: normalize(4) },
  welcomeBanner: { borderRadius: normalize(18), padding: normalize(20), paddingTop: normalize(18), overflow: 'hidden', marginBottom: normalize(14), elevation: 4, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  decCircle1: { position: 'absolute', width: normalize(160), height: normalize(160), borderRadius: normalize(80), backgroundColor: 'rgba(255,255,255,0.06)', right: normalize(-40), top: normalize(-40) },
  decCircle2: { position: 'absolute', width: normalize(100), height: normalize(100), borderRadius: normalize(50), backgroundColor: 'rgba(255,255,255,0.05)', left: normalize(-20), bottom: normalize(-20) },
  agentBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: normalize(6), paddingHorizontal: normalize(8), paddingVertical: normalize(3), borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: normalize(12) },
  agentBadgeText: { fontSize: normalize(9), fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2 },
  greetingText: { fontSize: normalize(10), color: 'rgba(255,255,255,0.65)', fontWeight: '400' },
  welcomeTitle: { fontSize: normalize(18), fontWeight: '700', color: '#ffffff', letterSpacing: -0.5, marginTop: normalize(2), marginBottom: normalize(6) },
  welcomeDesc: { fontSize: normalize(10), color: 'rgba(255,255,255,0.7)', fontWeight: '400', lineHeight: normalize(18) },
  statsRow: { flexDirection: 'row', marginBottom: normalize(16) },
  statCard: { backgroundColor: '#ffffff', borderRadius: normalize(14), padding: normalize(14), borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  statCardTop: { flexDirection: 'row', alignItems: 'center', gap: normalize(6), marginBottom: normalize(8) },
  statIconBox: { width: normalize(28), height: normalize(28), borderRadius: normalize(8), alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: normalize(10), color: '#94a3b8', fontWeight: '500', flex: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  statValue: { fontSize: normalize(21), fontWeight: '700', color: '#1e3a8a', letterSpacing: -0.5 },
  statValueOf: { fontSize: normalize(11), color: '#94a3b8', fontWeight: '400' },
  statSubText: { fontSize: normalize(10), color: '#94a3b8', fontWeight: '400', marginTop: normalize(2) },
  progressBarBg: { width: '100%', height: normalize(4), backgroundColor: '#f1f5f9', borderRadius: normalize(2), marginTop: normalize(10), overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: normalize(2) },
  sectionLabel: { fontSize: normalize(9), fontWeight: '600', color: '#64748b', letterSpacing: 0.3, marginBottom: normalize(10) },
  quickActionsRow: { flexDirection: 'row', gap: normalize(12), marginBottom: normalize(20) },
  actionCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: normalize(14), padding: normalize(16), borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  actionCardPrimary: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' },
  actionIconCircle: { width: normalize(40), height: normalize(40), borderRadius: normalize(12), alignItems: 'center', justifyContent: 'center', marginBottom: normalize(10) },
  actionTitle: { fontSize: normalize(10), fontWeight: '600', color: '#ffffff', letterSpacing: -0.2 },
  actionSub: { fontSize: normalize(10), color: '#93c5fd', fontWeight: '400', marginTop: normalize(2) },
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: normalize(10), paddingBottom: normalize(10), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  feedTitle: { fontSize: normalize(11), fontWeight: '600', color: '#0f172a' },
  feedSub: { fontSize: normalize(10), color: '#94a3b8', fontWeight: '400', marginTop: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: normalize(4), backgroundColor: '#fff1f2', paddingHorizontal: normalize(8), paddingVertical: normalize(4), borderRadius: normalize(10), borderWidth: 1, borderColor: '#fecdd3' },
  liveDot: { width: normalize(5), height: normalize(5), borderRadius: normalize(3), backgroundColor: '#ef4444' },
  liveBadgeText: { fontSize: normalize(9), fontWeight: '700', color: '#dc2626', letterSpacing: 0.5 },
  caseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', marginHorizontal: normalize(14), marginBottom: normalize(8), borderRadius: normalize(14), padding: normalize(14), borderWidth: 1, borderColor: '#f1f5f9', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  caseIconBox: { width: normalize(40), height: normalize(40), borderRadius: normalize(12), alignItems: 'center', justifyContent: 'center', marginRight: normalize(12) },
  caseIconBoxActive: { backgroundColor: '#eff6ff' },
  caseIconBoxDone: { backgroundColor: '#f0fdf4' },
  caseInfo: { flex: 1 },
  caseName: { fontSize: normalize(10), fontWeight: '600', color: '#1e293b', marginBottom: normalize(3) },
  caseSub: { fontSize: normalize(10), color: '#94a3b8', fontWeight: '400' },
  caseRight: { alignItems: 'flex-end' },
  doneBadge: { backgroundColor: '#f0fdf4', borderRadius: normalize(6), paddingHorizontal: normalize(8), paddingVertical: normalize(3), borderWidth: 1, borderColor: '#bbf7d0' },
  doneBadgeText: { fontSize: normalize(10), fontWeight: '600', color: '#16a34a' },
  pendingBadge: { backgroundColor: '#fefce8', borderRadius: normalize(6), paddingHorizontal: normalize(8), paddingVertical: normalize(3), borderWidth: 1, borderColor: '#fde68a' },
  pendingBadgeText: { fontSize: normalize(10), fontWeight: '600', color: '#d97706' },
  emptyState: { alignItems: 'center', paddingVertical: normalize(40), paddingHorizontal: normalize(24) },
  emptyTitle: { fontSize: normalize(12), fontWeight: '600', color: '#64748b', marginTop: normalize(12) },
  emptyDesc: { fontSize: normalize(10), color: '#94a3b8', fontWeight: '400', marginTop: normalize(4), textAlign: 'center' },
});
