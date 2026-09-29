import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Modal, Animated, Image, Platform, RefreshControl } from 'react-native';
import { useGetCaseDetailsQuery } from '../../Redux/api';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, RotateCw, Phone, Navigation, Coins, Check, Sparkles, PhoneCall, MapPin } from 'lucide-react-native';

import normalize from '@/Utils/Helpers/normalize';
const _phoneCallMod = require('react-native-phone-call');
const call = _phoneCallMod.default || _phoneCallMod;

interface CaseData {
  applicant_name?: string;
  case_no?: string;
  verification_type?: string;
  location?: string;
  [key: string]: any;
}

interface CaseDetailScreenProps {
  route: {
    params: {
      id: string | number;
      caseData?: any;
    };
  };
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: any) => void;
    [key: string]: any;
  };
}

export default function CaseDetailScreen({ route, navigation }: CaseDetailScreenProps) {
  const { id, caseData: initialData } = route.params;

  const { data: fetchedData, isLoading, isFetching, refetch: loadCase } = useGetCaseDetailsQuery(id);
  const { user } = useAuth();

  // Use fetchedData if available, fallback to initialData from route params if loading
  const caseData = fetchedData || initialData || null;
  const loading = isLoading && !initialData;

  const assigneeId = user?.id || user?.user?.id || user?.data?.id || user?.user_id;
  const myVerifications = (caseData?.verifications || []).filter((v: any) => v.verifier_id === assigneeId);
  const myPartsCompleted = myVerifications.length > 0 && myVerifications.every((v: any) => v.status === 'completed' || v.status === 'submitted');


  useFocusEffect(
    useCallback(() => {
      loadCase();
    }, [loadCase])
  );

  const [showCallModal, setShowCallModal] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const callAnim = useRef(new Animated.Value(1)).current;

  const makePhoneCall = () => {
    const phoneNumber = caseData?.applicant_phone || selectedCase.phoneNumber;
    if (!phoneNumber || phoneNumber === 'N/A') {
      Alert.alert('No Number', 'No valid phone number available for this applicant.');
      return;
    }
    const args = {
      number: phoneNumber.replace(/\D/g, ''),
      prompt: false,
      skipCanOpen: true
    };
    call(args).catch(console.error);
  };

  const handleSimulateCall = () => {
    setIsCalling(true);

    Animated.loop(
      Animated.sequence([
        Animated.timing(callAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(callAnim, { toValue: 1, duration: 500, useNativeDriver: true })
      ])
    ).start();

    setTimeout(() => {
      setIsCalling(false);
      setShowCallModal(false);
      callAnim.stopAnimation();
      Alert.alert('Call Ended', `Call simulation ended with ${caseData?.applicant_name || 'Applicant'}`);
    }, 4000);
  };

  // Calculate days remaining dynamically
  let calculatedDays = 0;
  if (caseData?.tat_due) {
    const due = new Date(caseData.tat_due);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const applicantName = caseData?.applicant_name || caseData?.form_data?.first_name || 'N/A';
  const phoneNumber = caseData?.applicant_phone || caseData?.form_data?.mobile || 'N/A';
  const loanAmount = caseData?.loan_amount || caseData?.form_data?.loan_amount;

  const selectedCase = {
    applicantName: applicantName,
    applicationID: caseData?.case_no || id,
    loanType: (caseData?.loan_type || caseData?.form_data?.loan_type || (caseData?.verification_type || '').replace('_', ' ')).toUpperCase() || 'N/A',
    amountRequested: loanAmount ? `₹${Number(loanAmount).toLocaleString('en-IN')}` : 'Not Specified',
    stage: (caseData?.status || 'Pending').replace('_', ' ').toUpperCase(),
    assignedDate: caseData?.created_at ? new Date(caseData.created_at).toLocaleDateString() : 'N/A',
    dueDate: caseData?.tat_due ? new Date(caseData.tat_due).toLocaleDateString() : 'N/A',
    daysRemaining: calculatedDays,
    timeline: (caseData?.timeline && caseData.timeline.length > 0) ? caseData.timeline.map((t: any) => ({
      title: t.action || 'Status Update',
      time: t.created_at ? new Date(t.created_at).toLocaleDateString() : 'Now',
      description: t.actor_name ? `By ${t.actor_name}` : 'By System',
      status: 'completed'
    })) : [
      { title: 'No History', time: '-', description: 'No actions recorded yet.', status: 'completed' }
    ],
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(applicantName)}&background=0D8ABC&color=fff`,
    phoneNumber: phoneNumber
  };

  if (loading && !caseData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#003d9b" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#52525b" size={20} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Case Details</Text>
        </View>
        <TouchableOpacity onPress={loadCase} style={styles.refreshBtn}>
          <RotateCw color="#003d9b" size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={loadCase} colors={['#003d9b']} />
        }
      >

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAccentBar} />
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: selectedCase.avatarUrl }} style={styles.avatar} />
              <View style={styles.sparkleBadge}>
                <Sparkles size={10} color="#003d9b" />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{selectedCase.applicantName}</Text>
              <View style={styles.pendingBadge}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingText}>PENDING VERIFICATION</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowCallModal(true)}>
              <Phone size={14} color="#003d9b" />
              <Text style={styles.quickActionText}>Call Applicant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Home', {
              selectedCase: {
                ...caseData,
                id: String(id),
                applicantName: selectedCase.applicantName,
                address: caseData?.location || 'Unknown',
                phoneNumber: selectedCase.phoneNumber,
                lat: caseData?.lat,
                lng: caseData?.lng,
              }
            })}>
              <Navigation size={14} color="#2563eb" />
              <Text style={styles.quickActionText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bento Grid */}
        <View style={styles.bentoGrid}>
          {/* Location Details */}
          <View style={[styles.bentoCard, styles.bentoFull]}>
            <View style={styles.bentoHeader}>
              <MapPin size={14} color="#003d9b" />
              <Text style={styles.bentoTitle}>LOCATION DETAILS</Text>
            </View>
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Address</Text>
              <Text style={[styles.ledgerValueBold, { flex: 1, textAlign: 'right', marginLeft: 16 }]}>
                {caseData?.location || caseData?.form_data?.curr_address || caseData?.form_data?.perm_address || caseData?.form_data?.employer_address || 'Not Provided'}
              </Text>
            </View>
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Pincode</Text>
              <Text style={styles.ledgerValueBold}>
                {caseData?.pin_code || caseData?.pincode || caseData?.pin || caseData?.zip_code || caseData?.zipCode || caseData?.postal_code || caseData?.postalCode || caseData?.form_data?.curr_pincode || caseData?.form_data?.perm_pincode || caseData?.form_data?.employer_pincode || 'N/A'}
              </Text>
            </View>
            <View style={[styles.ledgerRow, styles.ledgerRowLast]}>
              {/* <Text style={styles.ledgerLabel}>Coordinates</Text>
              <Text style={styles.ledgerValueBold}>
                {caseData?.lat && caseData?.lng ? `${parseFloat(caseData.lat).toFixed(5)}, ${parseFloat(caseData.lng).toFixed(5)}` : 'Not Available'}
              </Text> */}
            </View>
          </View>

          {/* Loan Ledger Details */}
          <View style={[styles.bentoCard, styles.bentoFull]}>
            <View style={styles.bentoHeader}>
              <Coins size={14} color="#003d9b" />
              <Text style={styles.bentoTitle}>LOAN LEDGER DETAILS</Text>
            </View>
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Application ID</Text>
              <Text style={styles.ledgerValueBold}>{selectedCase.applicationID}</Text>
            </View>
            <View style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>Loan Product</Text>
              <Text style={styles.ledgerValueBold}>{selectedCase.loanType}</Text>
            </View>
            <View style={[styles.ledgerRow, styles.ledgerRowLast]}>
              <Text style={styles.ledgerLabel}>Amount Requested</Text>
              <Text style={styles.ledgerValueHighlight}>{selectedCase.amountRequested}</Text>
            </View>
          </View>

          <View style={styles.bentoHalfRow}>
            {/* Stage */}
            <View style={[styles.bentoCard, styles.bentoHalf, styles.bgLightGray]}>
              <Text style={styles.bentoLabelSmall}>STAGE</Text>
              <Text style={styles.bentoValueBigDark}>{(selectedCase.stage === 'COMPLETED' || selectedCase.stage === 'Submitted' || caseData?.status === 'submitted' || (selectedCase.stage || '').toLowerCase() === 'awaiting review' || (caseData?.status || '').toLowerCase() === 'awaiting review') ? 'COMPLETED' : (selectedCase.stage || 'ASSIGNED').toUpperCase()}</Text>
              <View style={styles.bentoFooterBorder}>
                <Text style={styles.bentoLabelTiny}>ASSIGNED</Text>
                <Text style={styles.bentoValueTiny}>{selectedCase.assignedDate}</Text>
              </View>
            </View>

            {/* Due Date */}
            <View style={[styles.bentoCard, styles.bentoHalf, styles.bgBlue]}>
              <Text style={styles.bentoLabelSmallLight}>DUE DATE</Text>
              <Text style={styles.bentoValueBigLight}>{selectedCase.dueDate}</Text>
              <View style={styles.bentoFooterBorderLight}>
                <Text style={styles.bentoValueTinyLight}>{selectedCase.daysRemaining} days remaining</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>CASE HISTORY TIMELINE</Text>
          <View style={styles.timelineList}>
            {selectedCase.timeline.map((step: any, idx: number) => (
              <View key={idx} style={styles.timelineStep}>
                {idx < selectedCase.timeline.length - 1 && <View style={styles.timelineLine} />}
                <View style={styles.timelineIconContainer}>
                  {step.status === 'completed' ? (
                    <View style={styles.timelineIconCompleted}>
                      <Check size={10} color="white" />
                    </View>
                  ) : step.status === 'active' ? (
                    <View style={styles.timelineIconActive}>
                      <View style={styles.timelineIconActiveInner} />
                    </View>
                  ) : (
                    <View style={styles.timelineIconPending} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeaderRow}>
                    <Text style={[styles.timelineStepTitle, step.status === 'active' && styles.textBlue]}>{step.title}</Text>
                    <Text style={styles.timelineTime}>{step.time}</Text>
                  </View>
                  <Text style={styles.timelineDesc}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Fixed Bar */}
      <View style={styles.bottomBar}>
        {/*
          // User request: "mark is done compete korlo sei list o dekte pabe ar 2nd time navigation kore TriggerQuestionsScreen page jete parbe na"
          // We disable/redirect instead of navigating to TriggerQuestionsScreen
        */}
        <TouchableOpacity
          style={[styles.startBtn, (selectedCase.stage === 'COMPLETED' || selectedCase.stage === 'Submitted' || caseData?.status === 'submitted' || (selectedCase.stage || '').toLowerCase() === 'awaiting review' || (caseData?.status || '').toLowerCase() === 'awaiting review' || myPartsCompleted) && { backgroundColor: '#002868' }]}
          onPress={() => {
            const isCompleted = selectedCase.stage === 'COMPLETED' || selectedCase.stage === 'Submitted' || caseData?.status === 'submitted' || (selectedCase.stage || '').toLowerCase() === 'awaiting review' || (caseData?.status || '').toLowerCase() === 'awaiting review' || myPartsCompleted;

            if (isCompleted) {
              // navigation.navigate('TriggerQuestionsScreen', { id, caseData }); // Commented out 2nd time navigation
              navigation.navigate('MainTabs', { screen: 'Home' });
            } else {
              navigation.navigate('TriggerQuestionsScreen', { id, caseData });
            }
          }}
        >
          <Text style={styles.startBtnText}>
            {(selectedCase.stage === 'COMPLETED' || selectedCase.stage === 'Submitted' || caseData?.status === 'submitted' || (selectedCase.stage || '').toLowerCase() === 'awaiting review' || (caseData?.status || '').toLowerCase() === 'awaiting review' || myPartsCompleted) ? 'Submitted / Done' : 'Start Checklist Audit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Call Modal */}
      <Modal visible={showCallModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.callModalContainer}>
            <Animated.View style={[styles.callIconWrapper, {
              transform: [{ scale: callAnim }]
            }]}>
              <PhoneCall size={32} color="#003d9b" />
            </Animated.View>
            <Text style={styles.outboundText}>OUTBOUND DIALING</Text>
            <Text style={styles.callName}>{selectedCase.applicantName}</Text>
            <Text style={styles.callNumber}>{selectedCase.phoneNumber}</Text>

            {isCalling ? (
              <Text style={styles.simulatingText}>Connecting...</Text>
            ) : (
              <Text style={styles.simulatingText}>Simulating outgoing connection to check applicant details...</Text>
            )}

            <View style={styles.callActions}>
              <TouchableOpacity style={styles.cancelCallBtn} onPress={() => setShowCallModal(false)}>
                <Text style={styles.cancelCallText} numberOfLines={1} adjustsFontSizeToFit>Cancel Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.triggerCallBtn} onPress={makePhoneCall} disabled={isCalling}>
                <PhoneCall size={14} color="white" />
                <Text style={styles.triggerCallText} numberOfLines={1} adjustsFontSizeToFit> Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    height: Platform.OS === 'android' ? normalize(85) : normalize(75), paddingTop: Platform.OS === 'android' ? normalize(15) : 0, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: normalize(16),
    borderBottomWidth: 1, borderBottomColor: '#f4f4f5', elevation: 2, zIndex: 10
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: normalize(6) },
  headerTitle: { fontSize: 11, fontWeight: '800', color: '#18181b', letterSpacing: -0.5 },
  refreshBtn: { padding: normalize(6) },
  scrollContent: { padding: normalize(16), paddingBottom: normalize(100) },

  profileCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#f4f4f5', elevation: 1, overflow: 'hidden'
  },
  profileAccentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: normalize(4.5), backgroundColor: '#fbbf24' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: normalize(16) },
  avatarContainer: { position: 'relative' },
  avatar: { width: normalize(64), height: normalize(64), borderRadius: normalize(32), borderWidth: normalize(2), borderColor: '#dae2ff' },
  sparkleBadge: { position: 'absolute', bottom: normalize(-4), right: normalize(-4), backgroundColor: 'white', padding: normalize(4), borderRadius: normalize(12), elevation: 2 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 11, fontWeight: '900', color: '#18181b', marginBottom: 4 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fef3c7', paddingHorizontal: normalize(8), paddingVertical: normalize(4), borderRadius: normalize(12), alignSelf: 'flex-start', gap: normalize(6) },
  pendingDot: { width: normalize(6), height: normalize(6), borderRadius: normalize(3), backgroundColor: '#f59e0b' },
  pendingText: { fontSize: normalize(9), fontWeight: 'bold', color: '#92400e', letterSpacing: normalize(0.5) },

  quickActions: { flexDirection: 'row', gap: normalize(12), marginTop: normalize(20) },
  quickActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: normalize(8), paddingVertical: normalize(12), borderRadius: normalize(12), borderWidth: 1, borderColor: '#e4e4e7' },
  quickActionText: { fontSize: normalize(10), fontWeight: 'bold', color: '#3f3f46' },

  bentoGrid: { marginBottom: normalize(16) },
  bentoCard: { backgroundColor: 'white', borderRadius: normalize(16), padding: normalize(20), borderWidth: 1, borderColor: '#f4f4f5', elevation: 1 },
  bentoFull: { marginBottom: normalize(16) },
  bentoHeader: { flexDirection: 'row', alignItems: 'center', gap: normalize(6), paddingBottom: normalize(8), borderBottomWidth: 1, borderBottomColor: '#f4f4f5', marginBottom: normalize(10) },
  bentoTitle: { fontSize: normalize(10), fontWeight: 'bold', color: '#003d9b', letterSpacing: normalize(1) },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: normalize(4) },
  ledgerRowLast: { paddingTop: normalize(8), marginTop: normalize(4), borderTopWidth: 1, borderTopColor: '#f4f4f5' },
  ledgerLabel: { fontSize: normalize(10), fontWeight: '600', color: '#71717a' },
  ledgerValueBold: { fontSize: normalize(10), fontWeight: 'bold', color: '#27272a' },
  ledgerValueHighlight: { fontSize: normalize(11), fontWeight: '900', color: '#003d9b' },

  bentoHalfRow: { flexDirection: 'row', gap: normalize(16) },
  bentoHalf: { flex: 1, justifyContent: 'space-between', padding: normalize(16) },
  bgLightGray: { backgroundColor: '#f4f4f5', borderColor: '#e4e4e7' },
  bgBlue: { backgroundColor: '#003d9b', borderColor: '#003d9b' },
  bentoLabelSmall: { fontSize: normalize(9), fontWeight: '900', color: '#71717a', letterSpacing: normalize(1) },
  bentoValueBigDark: { fontSize: normalize(10), fontWeight: '900', color: '#18181b', marginTop: normalize(8) },
  bentoFooterBorder: { marginTop: normalize(16), paddingTop: normalize(12), borderTopWidth: 1, borderTopColor: '#e4e4e7' },
  bentoLabelTiny: { fontSize: normalize(8), fontWeight: 'bold', color: '#a1a1aa', letterSpacing: normalize(1) },
  bentoValueTiny: { fontSize: normalize(10), fontWeight: 'bold', color: '#52525b', marginTop: normalize(2) },

  bentoLabelSmallLight: { fontSize: normalize(9), fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: normalize(1) },
  bentoValueBigLight: { fontSize: normalize(14), fontWeight: '900', color: 'white', marginTop: normalize(4) },
  bentoFooterBorderLight: { marginTop: normalize(16), paddingTop: normalize(12), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  bentoValueTinyLight: { fontSize: normalize(10), fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' },

  timelineCard: { backgroundColor: 'white', borderRadius: normalize(16), padding: normalize(20), borderWidth: normalize(1), borderColor: '#f4f4f5', elevation: normalize(1) },
  timelineTitle: { fontSize: normalize(10), fontWeight: 'bold', color: '#003d9b', letterSpacing: normalize(1), marginBottom: normalize(24) },
  timelineList: { paddingLeft: normalize(4) },
  timelineStep: { flexDirection: 'row', gap: normalize(16), marginBottom: normalize(24), position: 'relative' },
  timelineLine: { position: 'absolute', left: normalize(9), top: normalize(24), bottom: normalize(-24), width: normalize(1.5), backgroundColor: '#e4e4e7' },
  timelineIconContainer: { width: normalize(20), alignItems: 'center' },
  timelineIconCompleted: { width: normalize(20), height: normalize(20), borderRadius: normalize(10), backgroundColor: '#003d9b', alignItems: 'center', justifyContent: 'center' },
  timelineIconActive: { width: normalize(20), height: normalize(20), borderRadius: normalize(10), backgroundColor: 'white', borderWidth: normalize(2), borderColor: '#003d9b', alignItems: 'center', justifyContent: 'center' },
  timelineIconActiveInner: { width: normalize(6), height: normalize(6), borderRadius: normalize(3), backgroundColor: '#003d9b' },
  timelineIconPending: { width: normalize(20), height: normalize(20), borderRadius: normalize(10), backgroundColor: '#f4f4f5', borderWidth: normalize(1), borderColor: '#d4d4d8' },
  timelineContent: { flex: 1, paddingBottom: normalize(4) },
  timelineHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: normalize(4) },
  timelineStepTitle: { fontSize: normalize(10), fontWeight: 'bold', color: '#27272a' },
  textBlue: { color: '#003d9b' },
  timelineTime: { fontSize: normalize(10), fontWeight: '600', color: '#a1a1aa' },
  timelineDesc: { fontSize: normalize(10), fontWeight: '500', color: '#71717a', marginTop: normalize(4), lineHeight: normalize(18) },

  bottomBar: { position: 'absolute', bottom: 9, left: 0, right: 0, padding: normalize(16), paddingBottom: Platform.OS === 'ios' ? normalize(34) : normalize(24), backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: normalize(1), borderTopColor: '#f4f4f5', elevation: normalize(10), zIndex: 10 },
  startBtn: { backgroundColor: '#003d9b', height: normalize(48), borderRadius: normalize(12), alignItems: 'center', justifyContent: 'center', elevation: normalize(4), bottom: Platform.OS === 'ios' ? normalize(10) : 15 },
  startBtnText: { color: 'white', fontSize: normalize(11), fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: normalize(24) },
  callModalContainer: { backgroundColor: 'white', borderRadius: normalize(20), padding: normalize(16), alignItems: 'center', width: '100%' },
  callIconWrapper: { width: normalize(64), height: normalize(64), borderRadius: normalize(32), backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: normalize(24) },
  outboundText: { fontSize: normalize(10), fontWeight: '900', color: '#003d9b', letterSpacing: normalize(1) },
  callName: { fontSize: normalize(14), fontWeight: '900', color: '#18181b', marginTop: normalize(4) },
  callNumber: { fontSize: normalize(10), fontWeight: '600', color: '#a1a1aa', marginTop: normalize(2) },
  simulatingText: { fontSize: normalize(10), fontWeight: '600', color: '#71717a', textAlign: 'center', marginTop: normalize(20), marginBottom: normalize(24) },
  callActions: { flexDirection: 'row', gap: normalize(8), width: '100%' },
  cancelCallBtn: { flex: 1, paddingVertical: normalize(12), paddingHorizontal: normalize(4), borderRadius: normalize(12), borderWidth: normalize(1), borderColor: '#e4e4e7', alignItems: 'center', justifyContent: 'center' },
  cancelCallText: { fontSize: normalize(9), fontWeight: 'bold', color: '#3f3f46' },
  triggerCallBtn: { flex: 1, flexDirection: 'row', gap: normalize(4), paddingVertical: normalize(12), paddingHorizontal: normalize(4), borderRadius: normalize(12), backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', elevation: normalize(2) },
  triggerCallText: { fontSize: normalize(9), fontWeight: 'bold', color: 'white', flexShrink: 1 }
});