import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, RefreshControl, Image, SafeAreaView, Platform } from 'react-native';
import { Search, RotateCw, Navigation, ChevronRight, Timer, User, MapPin, Plus, AlertCircle, Sparkles } from 'lucide-react-native';
import { useGetAssignedAssignmentsQuery } from '../../Redux/api';
import { useAuth } from '../../contexts/AuthContext';
import normalize from '@/Utils/Helpers/normalize';

export default function CasesListScreen({ navigation }: any) {
  const { user } = useAuth();
  const assigneeId = user?.id || user?.user?.id || user?.data?.id || user?.user_id;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'near'>('all');

  // Debounce search to avoid spamming API on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data, isLoading: loading, isFetching: syncing, refetch: onTriggerSync } = useGetAssignedAssignmentsQuery({ assignee_id: assigneeId });

  const cases = useMemo(() => {
    if (!data) return [];
    const rawDataArray = Array.isArray(data) ? data : (data.data || []);

    // Strictly filter cases belonging to the current user
    const dataArray = rawDataArray.filter((c: any) => {
      if (c.assignee_id === assigneeId) return true;
      const isVerifier = (c.verifications || []).some((v: any) => v.verifier_id === assigneeId);
      return isVerifier;
    });

    return dataArray.map((item: any) => ({
      id: item.case_no,
      originalId: item.id,
      applicantName: item.applicant_name,
      bankName: item.bank_name,
      loanType: item.loan_type,
      address: item.address || item.location || item.form_data?.curr_address || item.form_data?.perm_address || item.form_data?.employer_address,
      status: item.status,
      timeLeft: item.time_left ?? item.timeLeft ?? '24h',
      daysRemaining: item.days_remaining ?? item.daysRemaining ?? 1,
      travelStarted: item.travel_started ?? item.travelStarted ?? false,
      lat: item.lat || item.gps_lat || item.latitude || item.form_data?.lat,
      lng: item.lng || item.gps_lng || item.longitude || item.form_data?.lng,
      ...item
    }));
  }, [data]);

  // Dynamically calculate pending stops from the cases list
  const pendingCasesCount = cases.filter((c: any) => c.status === 'pending').length;

  // Dynamically calculate total route distance and next stop distance from real case data
  const totalRouteDistance = useMemo(() => {
    const total = cases.reduce((sum: number, c: any) => {
      const d = parseFloat(c.distance_km);
      return sum + (isNaN(d) ? 0 : d);
    }, 0);
    return total > 0 ? total.toFixed(1) : null;
  }, [cases]);

  const nextStopDistance = useMemo(() => {
    const firstPending = cases.find((c: any) => c.status === 'pending' || c.status === 'in_progress');
    const d = parseFloat(firstPending?.distance_km);
    return !isNaN(d) && d > 0 ? d.toFixed(1) : null;
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter((c: any) => {
      if (activeFilter === 'high') {
        return c.status === 'pending' || c.status === 'flagged' || c.status === 'rescheduled';
      }
      if (activeFilter === 'near') {
        return c.daysRemaining <= 3;
      }
      return true;
    });
  }, [cases, activeFilter]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Application Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>FV</Text>
          </View>
          <Text style={styles.headerTitle}>LoanVerify Pro</Text>
        </View>

        <TouchableOpacity onPress={onTriggerSync} disabled={syncing} style={styles.syncBtn}>
          <RotateCw size={18} color="#003d9b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={onTriggerSync} colors={['#003d9b']} />
        }
      >
        {/* Search Input block */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Search size={18} color="#a1a1aa" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Case ID or Applicant"
              placeholderTextColor="#a1a1aa"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Chips row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
            <TouchableOpacity
              onPress={() => setActiveFilter('all')}
              style={[styles.filterChip, activeFilter === 'all' ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterChipText, activeFilter === 'all' ? styles.filterChipTextActive : null]}>All Cases</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveFilter('high')}
              style={[styles.filterChip, activeFilter === 'high' ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterChipText, activeFilter === 'high' ? styles.filterChipTextActive : null]}>High Priority</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveFilter('near')}
              style={[styles.filterChip, activeFilter === 'near' ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterChipText, activeFilter === 'near' ? styles.filterChipTextActive : null]}>Near Me</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Dynamic Route Overview banner */}
        <View style={styles.routeBanner}>
          <View style={styles.routeBannerImgContainer}>
            <Image
              source={{ uri: cases[0]?.routeImageUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDu1K1OPSZ8kAPHuwesitBwqmyC35bt4LF9bTZNFGCXhlXQbzr1e8GcGtb65lTnrGMunzYdps4cRjn9BM1xJ08iMrf9SyVzWhTisiVmuzujkx6RY_Ztq-OWhIee7MHjZaLsMQN__q420yWxcV0CM43LcIGU9nkZudcECPcSOi4nzDntNoS2rlE4owi2rFF_PqBXxYMG5Ou3qmFzQm6dBOfuGHjXJPiYJyhggU72TlJ0a7amFSqdmqjIuPuRxewKDhlxdNnSxcRkR6Pp' }}
              style={styles.routeBannerImg}
            />
            <View style={styles.routeBannerGradient} />
            <View style={styles.nextStopBadge}>
              <Navigation size={11} color="#1e40af" />
              <Text style={styles.nextStopText}>Next stop: {nextStopDistance ? `${nextStopDistance} km` : 'Calculating...'} away</Text>
            </View>
          </View>

          <View style={styles.routeBannerContent}>
            <View style={styles.routeBannerRow}>
              <View>
                <Text style={styles.routeTitle}>Route Overview</Text>
                <Text style={styles.routeSubtitle}>{pendingCasesCount} Pending stops{totalRouteDistance ? ` • ${totalRouteDistance} km total` : ''}</Text>
              </View>
              <TouchableOpacity style={styles.routeBtn} onPress={() => navigation.navigate('Map', { selectedCase: cases[0] || {}, allStops: cases })}>
                <Text style={styles.routeBtnText}>View optimal route</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Assigned cases list divider */}
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderTitle}>ASSIGNED CASES ({filteredCases.length})</Text>
          {searchQuery ? <Text style={styles.listHeaderMatches}>Found {filteredCases.length} matches</Text> : null}
        </View>

        {filteredCases.length === 0 ? (
          <View style={styles.emptyState}>
            <AlertCircle size={32} color="#d4d4d8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyTitle}>No Cases Found</Text>
            <Text style={styles.emptyDesc}>Try adjusting your filters or search keywords.</Text>
          </View>
        ) : (
          filteredCases.map((c: any) => {
            const isHighPriority = c.status === 'pending' || c.status === 'flagged' || c.status === 'rescheduled';
            let statusStripColor = '#e4e4e7';
            if (c.status === 'verified') statusStripColor = '#22c55e';
            if (c.status === 'pending') statusStripColor = '#f59e0b';
            if (c.status === 'rescheduled') statusStripColor = '#fbbf24';
            if (c.status === 'flagged') statusStripColor = '#ef4444';
            if (c.status === 'assigned') statusStripColor = '#3b82f6';

            return (
              <TouchableOpacity
                key={c.id}
                style={styles.caseCard}
                onPress={() => navigation.navigate('CaseDetailsScreen', { id: c.originalId, caseData: c })}
              >
                <View style={[styles.statusStrip, { backgroundColor: statusStripColor }]} />

                <View style={styles.cardTopRow}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.caseId}>#{c.id}</Text>
                    {isHighPriority && (
                      <View style={styles.priorityBadge}>
                        <AlertCircle size={10} color="#fca5a5" />
                        <Text style={styles.priorityText}>High Priority</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.timeBadge}>
                    <Timer size={14} color="#a1a1aa" />
                    <Text style={styles.timeText}>{c.timeLeft} left</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.avatarCol}>
                    <View style={styles.avatar}>
                      {c.avatarUrl ? (
                        <Image source={{ uri: c.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <User size={15} color="#0040a2" />
                      )}
                    </View>
                    <View style={styles.avatarLine} />
                  </View>

                  <View style={styles.detailsCol}>
                    <Text style={styles.applicantName}>{c.applicantName || 'Unknown Applicant'}</Text>
                    {(c.bankName || c.loanType) ? (
                      <Text style={styles.loanInfo}>{[c.bankName, c.loanType].filter(Boolean).join(' • ')}</Text>
                    ) : (
                      <Text style={styles.loanInfo}>No loan info provided</Text>
                    )}
                  </View>

                  <View style={styles.mapIconCol}>
                    <MapPin size={14} color="#a1a1aa" />
                  </View>

                  <View style={styles.addressCol}>
                    <Text style={[styles.addressText, !c.address && { fontStyle: 'italic', color: '#a1a1aa' }]} numberOfLines={2}>
                      {c.address || 'Location not specified'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.statusPill}>
                    <Navigation size={10} color="#0040a2" />
                    <Text style={styles.statusPillText}>{c.travelStarted ? 'Travel Started' : 'Assigned'}</Text>
                  </View>
                  <View style={styles.detailsBtn}>
                    <Text style={styles.detailsBtnText}>Details</Text>
                    <ChevronRight size={13} color="#003d9b" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => { }}>
        <Plus size={24} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { height: Platform.OS === 'android' ? 95 : 85, paddingTop: Platform.OS === 'android' ? 15 : 0, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f4f4f5', elevation: 2, zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { width: normalize(32), height: normalize(32), backgroundColor: '#003d9b', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: 'white', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { fontSize: 11, fontWeight: '800', color: '#003d9b', letterSpacing: -0.5 },
  syncBtn: { padding: 8 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  searchContainer: { marginBottom: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', height: normalize(48), paddingHorizontal: 16, marginBottom: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: '100%', fontSize: normalize(10), fontWeight: '600', color: '#27272a' },
  filterScroll: { flexDirection: 'row' },
  filterContainer: { paddingRight: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f4f4f5' },
  filterChipActive: { backgroundColor: '#003d9b' },
  filterChipText: { fontSize: normalize(10), fontWeight: 'bold', color: '#52525b' },
  filterChipTextActive: { color: 'white' },

  routeBanner: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#f4f4f5', overflow: 'hidden', marginBottom: 20, elevation: 1 },
  routeBannerImgContainer: { height: normalize(128), width: '100%', position: 'relative' },
  routeBannerImg: { width: '100%', height: '100%', opacity: 0.8 },
  routeBannerGradient: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.2)' },
  nextStopBadge: { position: 'absolute', bottom: normalize(12), left: normalize(12), flexDirection: 'row', alignItems: 'center', gap: normalize(4), backgroundColor: '#dae2ff', paddingHorizontal: normalize(10), paddingVertical: normalize(4), borderRadius: normalize(12) },
  nextStopText: { fontSize: normalize(10), fontWeight: 'bold', color: '#1e40af' },
  routeBannerContent: { padding: normalize(16) },
  routeBannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeTitle: { fontSize: normalize(11), fontWeight: '800', color: '#18181b' },
  routeSubtitle: { fontSize: normalize(10), fontWeight: 'bold', color: '#71717a', marginTop: normalize(2) },
  routeBtn: { backgroundColor: '#003d9b', paddingHorizontal: normalize(10), paddingVertical: normalize(8), borderRadius: normalize(10) },
  routeBtnText: { color: 'white', fontSize: normalize(9), fontWeight: 'bold' },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: normalize(16) },
  listHeaderTitle: { fontSize: normalize(10), fontWeight: '800', color: '#a1a1aa', letterSpacing: normalize(1) },
  listHeaderMatches: { fontSize: normalize(10), fontWeight: '500', color: '#a1a1aa' },

  emptyState: { backgroundColor: 'white', borderRadius: 16, padding: normalize(32), alignItems: 'center', borderWidth: 1, borderColor: '#f4f4f5' },
  emptyTitle: { fontSize: normalize(11), fontWeight: 'bold', color: '#27272a' },
  emptyDesc: { fontSize: normalize(10), color: '#71717a', marginTop: normalize(4) },

  caseCard: { backgroundColor: 'white', borderRadius: 16, padding: normalize(16), paddingLeft: normalize(24), marginBottom: normalize(16), borderWidth: 1, borderColor: '#f4f4f5', elevation: 1, overflow: 'hidden' },
  statusStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: normalize(6) },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: normalize(16) },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: normalize(8), flexWrap: 'wrap' },
  caseId: { fontSize: normalize(11), fontWeight: '800', color: '#18181b' },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: normalize(2), backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2', paddingHorizontal: normalize(8), paddingVertical: normalize(2), borderRadius: normalize(6) },
  priorityText: { fontSize: normalize(9), fontWeight: '800', color: '#dc2626', textTransform: 'uppercase' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: normalize(4) },
  timeText: { fontSize: normalize(10), fontWeight: 'bold', color: '#3f3f46' },

  cardBody: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
  avatarCol: { alignItems: 'center', marginRight: normalize(12), width: normalize(32) },
  avatar: { width: normalize(32), height: normalize(32), borderRadius: normalize(16), backgroundColor: '#dae2ff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarLine: { width: normalize(1), height: normalize(12), backgroundColor: '#e4e4e7', marginTop: normalize(4) },
  detailsCol: { flex: 1, paddingBottom: normalize(6) },
  applicantName: { fontSize: normalize(10), fontWeight: '800', color: '#27272a' },
  loanInfo: { fontSize: normalize(10), fontWeight: 'bold', color: '#71717a', marginTop: normalize(2) },

  mapIconCol: { width: normalize(32), alignItems: 'center', marginRight: normalize(12), paddingTop: normalize(2) },
  addressCol: { flex: 1 },
  addressText: { fontSize: normalize(10), fontWeight: '500', color: '#71717a', lineHeight: normalize(18) },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: normalize(16), paddingTop: normalize(12), borderTopWidth: normalize(1), borderTopColor: '#f4f4f5' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: normalize(4), backgroundColor: 'rgba(218,226,255,0.5)', paddingHorizontal: normalize(10), paddingVertical: normalize(2), borderRadius: normalize(12) },
  statusPillText: { fontSize: normalize(10), fontWeight: 'bold', color: '#0040a2' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: normalize(2) },
  detailsBtnText: { fontSize: normalize(9), fontWeight: 'bold', color: '#003d9b' },

  fab: { position: 'absolute', right: normalize(24), bottom: normalize(24), width: normalize(56), height: normalize(56), borderRadius: normalize(16), backgroundColor: '#003d9b', alignItems: 'center', justifyContent: 'center', elevation: normalize(6) }
});
