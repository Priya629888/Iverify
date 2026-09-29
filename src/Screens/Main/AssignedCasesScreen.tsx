import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, SafeAreaView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Search, Filter, X, Calendar, MapPin, Briefcase, Phone, ChevronRight } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useGetAssignedAssignmentsQuery } from '../../Redux/api';
import { useAuth } from '../../contexts/AuthContext';

export default function AssignedCasesScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'All' | 'In Progress' | 'Completed'>('In Progress');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);

  const onChangeDate = (event: any, selectedDate?: Date) => {
    const currentShow = showDatePicker;
    setShowDatePicker(null);
    if (selectedDate && event.type !== 'dismissed') {
      // Local time adjust to avoid UTC offset shifting the day behind
      const offsetDate = new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000));
      const dStr = offsetDate.toISOString().split('T')[0];
      if (currentShow === 'from') setFromDate(dStr);
      if (currentShow === 'to') setToDate(dStr);
    }
  };

  const { user } = useAuth();

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, fromDate, toDate]);

  const assigneeId = user?.id || user?.user?.id || user?.data?.id || user?.user_id;

  const queryParams: any = {
    search: debouncedSearch,
    page: 1,
    limit: 100,
    assignee_id: assigneeId,
    sort: 'created_at',
    order: 'desc'
  };

  if (filterStatus === 'Completed') {
    queryParams.status = 'completed';
  }

  const { data: casesData, isLoading, isError } = useGetAssignedAssignmentsQuery({ assignee_id: assigneeId }, { skip: !assigneeId });

  const cases = Array.isArray(casesData) ? casesData : (casesData?.data || []);

  // Local Filtering Logic with useMemo
  const filteredCases = useMemo(() => {
    return cases.filter((item: any) => {
      // Strictly filter cases belonging to the current user
      if (item.assignee_id !== assigneeId) {
        const isVerifier = (item.verifications || []).some((v: any) => v.verifier_id === assigneeId);
        if (!isVerifier) return false;
      }

      // Check if the current user has completed all their assigned triggers
      const myVerifications = (item.verifications || []).filter((v: any) => v.verifier_id === assigneeId);

      // If the user has no verifications for this case, they shouldn't see it
      if (myVerifications.length === 0) return false;

      const myPartsCompleted = myVerifications.length > 0 && myVerifications.every((v: any) => v.status === 'completed' || v.status === 'submitted');
      const isCompleted = myPartsCompleted;

      // Apply Status Filter
      if (filterStatus === 'In Progress' && isCompleted) return false;
      if (filterStatus === 'Completed' && !isCompleted) return false;

      // Determine which date to filter on (Completed -> use updated_at, otherwise created_at)
      const dateStringToUse = (isCompleted && (item.updated_at || item.updatedAt))
        ? (item.updated_at || item.updatedAt)
        : (item.created_at || item.createdAt);

      const itemDate = new Date(dateStringToUse);

      // Apply Date Filter (From Date)
      if (fromDate && fromDate.length === 10) {
        const fromD = new Date(fromDate);
        fromD.setHours(0, 0, 0, 0); // Start of day
        if (!isNaN(fromD.getTime()) && itemDate < fromD) return false;
      }

      // Apply Date Filter (To Date)
      if (toDate && toDate.length === 10) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999); // End of day
        if (!isNaN(toD.getTime()) && itemDate > toD) return false;
      }

      return true;
    }).sort((a: any, b: any) => {
      // Sort purely by most recent date (dateB - dateA)
      // Use updated_at for completed cases, created_at otherwise
      const getRelevantDate = (caseItem: any) => {
        const myVerifications = (caseItem.verifications || []).filter((v: any) => v.verifier_id === assigneeId);
        const isCompleted = myVerifications.length > 0 && myVerifications.every((v: any) => v.status === 'completed' || v.status === 'submitted');

        const dateStr = (isCompleted && (caseItem.updated_at || caseItem.updatedAt))
          ? (caseItem.updated_at || caseItem.updatedAt)
          : (caseItem.created_at || caseItem.createdAt);

        return new Date(dateStr).getTime();
      };

      const dateA = getRelevantDate(a);
      const dateB = getRelevantDate(b);

      return dateB - dateA;
    });
  }, [cases, fromDate, toDate, filterStatus, assigneeId]);

  const totalCases = filteredCases.length;
  const totalPages = Math.ceil(totalCases / itemsPerPage) || 1;

  // Client-side slicing
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCases = filteredCases.slice(startIndex, startIndex + itemsPerPage);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Field Verification</Text>
          <Text style={styles.headerSubtitle}>{totalCases} cases assigned to field verifiers</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, { flex: 1, marginBottom: 0 }]}>
            <Search size={18} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by applicant name..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(!showFilters)}>
            {showFilters ? <X size={20} color="#3b82f6" /> : <Filter size={20} color="#3b82f6" />}
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterOptionsRow}>
              {['All', 'In Progress', 'Completed'].map(st => (
                <TouchableOpacity key={st} style={[styles.filterChip, filterStatus === st && styles.filterChipActive]} onPress={() => setFilterStatus(st as any)}>
                  <Text style={[styles.filterChipText, filterStatus === st && styles.filterChipTextActive]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>


            <View style={styles.dateInputsRow}>
              <View style={styles.dateInputWrapper}>
                <Text style={styles.dateLabel}>From:</Text>
                <TouchableOpacity style={styles.dateInputContainer} onPress={() => setShowDatePicker('from')}>
                  <Text style={[styles.dateInputText, !fromDate && { color: '#9ca3af' }]}>
                    {fromDate || 'Select date'}
                  </Text>
                  <Calendar size={16} color="#9ca3af" style={styles.calendarIcon} />
                </TouchableOpacity>
              </View>
              <View style={styles.dateInputWrapper}>
                <Text style={styles.dateLabel}>To:</Text>
                <TouchableOpacity style={styles.dateInputContainer} onPress={() => setShowDatePicker('to')}>
                  <Text style={[styles.dateInputText, !toDate && { color: '#9ca3af' }]}>
                    {toDate || 'Select date'}
                  </Text>
                  <Calendar size={16} color="#9ca3af" style={styles.calendarIcon} />
                </TouchableOpacity>
              </View>
            </View>
            {(fromDate !== '' || toDate !== '') && (
              <TouchableOpacity style={styles.clearDateButton} onPress={() => { setFromDate(''); setToDate(''); }}>
                <X size={14} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={styles.clearDateText}>Clear Dates</Text>
              </TouchableOpacity>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={new Date()}
                mode="date"
                display="default"
                onChange={onChangeDate}
              />
            )}
          </View>
        )}

        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              {filterStatus === 'All' ? 'ALL ASSIGNED CASES' : filterStatus === 'In Progress' ? 'ACTIVE CASES' : 'COMPLETED CASES'} ({totalCases})
            </Text>
          </View>

          {!assigneeId || isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={{ marginTop: 12, color: '#64748b' }}>{!assigneeId ? 'Authenticating...' : 'Loading cases...'}</Text>
            </View>
          ) : isError ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#ef4444' }}>Failed to load cases. Please try again.</Text>
            </View>
          ) : cases.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: '#64748b' }}>No cases assigned yet.</Text>
            </View>
          ) : (
            <>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {paginatedCases.map((item: any, index: number) => {
                  const name = item.applicantName || item.applicant_name || 'Unknown Applicant';
                  const caseIdRaw = item.case_no || item.case_id_display || item.id || 'N/A';
                  const displayCaseId = String(caseIdRaw).startsWith('CAS-') ? caseIdRaw : `CAS-${caseIdRaw}`;
                  const type = (item.verification_type || item.loanType || item.loan_type || 'Verification').replace('_', ' ');
                  const location = item.location || item.form_data?.curr_address || item.form_data?.perm_address || item.form_data?.employer_address || item.city || item.address || 'Unknown Location';
                  const caseStatus = (item.status || '').toLowerCase();
                  const caseStage = (item.stage || '').toLowerCase();
                  const assigneeName = item.assignee_name || user?.name || user?.first_name || 'Field Verifier';
                  const phone = item.applicant_phone || item.form_data?.mobile || item.phoneNumber || item.phone || 'No Phone';

                  // Formatting for the status badge
                  let statusText = 'In Progress';
                  let isCompleted = false;

                  const isReassigned = !!item.is_reassigned || !!item.reassigned;

                  if (caseStatus === 'pending' || caseStage === 'pending') {
                    statusText = 'Pending';
                  }

                  if (isReassigned) {
                    statusText = 'Reassigned';
                  }

                  if (caseStatus === 'completed' || caseStage === 'completed' || caseStatus === 'submitted' || caseStage === 'submitted' || caseStage === 'awaiting review' || caseStatus === 'awaiting review') {
                    statusText = 'Overall Completed';
                  }

                  // Check if the current user has completed all their assigned triggers
                  const myVerifications = (item.verifications || []).filter((v: any) => v.verifier_id === assigneeId);
                  const myPartsCompleted = myVerifications.length > 0 && myVerifications.every((v: any) => v.status === 'completed' || v.status === 'submitted');

                  if (myPartsCompleted) {
                    statusText = 'My Part Done';
                    isCompleted = true;
                  }

                  return (
                    <TouchableOpacity
                      key={item.id || index}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (isCompleted) {
                          navigation.navigate('CaseDetailsScreen', { id: item.id, caseData: item });
                        } else {
                          navigation.navigate('TriggerQuestionsScreen', { caseData: item });
                        }
                      }}
                      style={[
                        styles.card,
                        isCompleted && styles.cardCompleted
                      ]}
                    >
                      <View style={styles.cardTopRow}>
                        <View style={[styles.statusDot, isCompleted ? { backgroundColor: '#10b981' } : { backgroundColor: '#f59e0b' }]} />
                        <Text style={styles.caseIdText}>{displayCaseId}</Text>
                        <View style={{ flex: 1 }} />
                        <View style={[styles.statusBadge, isCompleted ? { backgroundColor: '#ecfdf5' } : isReassigned ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#fffbeb' }]}>
                          <Text style={[styles.statusText, isCompleted ? { color: '#047857' } : isReassigned ? { color: '#ef4444' } : { color: '#b45309' }]}>{statusText}</Text>
                        </View>
                      </View>

                      <Text style={styles.nameText}>{name}</Text>

                      <View style={styles.detailsRow}>
                        <Briefcase size={14} color="#64748b" style={styles.detailIcon} />
                        <Text style={styles.detailsText}>{type}</Text>
                      </View>

                      <View style={styles.detailsRow}>
                        <MapPin size={14} color="#64748b" style={styles.detailIcon} />
                        <Text style={styles.detailsText} numberOfLines={1}>{location}</Text>
                      </View>

                      <View style={styles.cardFooter}>
                        <View style={styles.phoneContainer}>
                          <Phone size={14} color="#3b82f6" style={styles.detailIcon} />
                          <Text style={styles.phoneText}>{phone}</Text>
                        </View>
                        <ChevronRight size={18} color="#cbd5e1" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {totalPages > 1 && (
                <View style={styles.paginationContainer}>
                  <TouchableOpacity
                    style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                    onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <Text style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}>Prev</Text>
                  </TouchableOpacity>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pageNumbersContainer, { flexGrow: 1, justifyContent: 'center' }]}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <TouchableOpacity
                        key={page}
                        style={[styles.pageNumberButton, currentPage === page && styles.pageNumberButtonActive]}
                        onPress={() => setCurrentPage(page)}
                      >
                        <Text style={[styles.pageNumberText, currentPage === page && styles.pageNumberTextActive]}>{page}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
                    onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <Text style={[styles.pageButtonText, currentPage === totalPages && styles.pageButtonTextDisabled]}>Next</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 10,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    marginTop: 20,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 11,
    color: '#0f172a',
  },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  filtersContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  filterLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dateInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateInputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  dateLabel: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 4,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    height: 40,
    paddingHorizontal: 12,
  },
  dateInputText: {
    flex: 1,
    fontSize: 10,
    color: '#0f172a',
  },
  calendarIcon: {
    marginLeft: 8,
  },
  clearDateButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    marginTop: 8,
  },
  clearDateText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardCompleted: {
    borderColor: '#d1fae5',
    backgroundColor: '#f8fafc',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  caseIdText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  nameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    marginRight: 8,
  },
  detailsText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '600',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  pageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  pageButtonDisabled: {
    backgroundColor: '#f8fafc',
    opacity: 0.5,
  },
  pageButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 10,
  },
  pageButtonTextDisabled: {
    color: '#94a3b8',
  },
  pageNumbersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pageNumberButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  pageNumberButtonActive: {
    backgroundColor: '#3b82f6',
  },
  pageNumberText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 10,
  },
  pageNumberTextActive: {
    color: '#ffffff',
  },
});
