import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Modal, Alert, Platform, PermissionsAndroid } from 'react-native';
import { useSubmitFieldReportMutation } from '../../Redux/api';
import { useUploadCaseDocumentMutation } from '../../Redux/api/updateApi';
import Geolocation from 'react-native-geolocation-service';
import { launchCamera } from 'react-native-image-picker';
import { ArrowLeft, Lightbulb, CheckCircle, Circle, Eye, Camera, Edit3, Send, ShieldCheck, Sparkles, Check } from 'lucide-react-native';

export default function ChecklistScreen({ route, navigation }: any) {
  const { id, caseData } = route.params;

  // Generate tasks dynamically based on verification_type (Kept for fallback if needed, but not used by default anymore to ensure dynamic loading)
  const generateTasksForType = (type: string): any[] => {
    switch ((type || '').toLowerCase()) {
      case 'employment':
        return [
          { id: 't1', type: 'employment', name: 'Employer Office Visit', status: 'pending', verifiedDate: '' },
          { id: 't2', type: 'hr', name: 'HR Department Confirmation', status: 'pending', verifiedDate: '' },
          { id: 't3', type: 'salary', name: 'Salary Slip Verification', status: 'pending', verifiedDate: '' },
          { id: 't4', type: 'aadhaar', name: 'Aadhaar Card Verification', status: 'pending', verifiedDate: '' },
        ];
      case 'residence':
        return [
          { id: 't1', type: 'residence', name: 'Physical Residence Inspection', status: 'pending', verifiedDate: '' },
          { id: 't2', type: 'aadhaar', name: 'Aadhaar Card Verification', status: 'pending', verifiedDate: '' },
          { id: 't3', type: 'pan', name: 'PAN Card Verification', status: 'pending', verifiedDate: '' },
        ];
      case 'education':
        return [
          { id: 't1', type: 'education', name: 'Institution Visit & Confirmation', status: 'pending', verifiedDate: '' },
          { id: 't2', type: 'pan', name: 'Certificate / Degree Verification', status: 'pending', verifiedDate: '' },
          { id: 't3', type: 'aadhaar', name: 'Aadhaar Card Verification', status: 'pending', verifiedDate: '' },
        ];
      case 'kyc':
        return [
          { id: 't1', type: 'aadhaar', name: 'Aadhaar Card Verification', status: 'pending', verifiedDate: '' },
          { id: 't2', type: 'pan', name: 'PAN Card Verification', status: 'pending', verifiedDate: '' },
          { id: 't3', type: 'residence', name: 'Address Proof Check', status: 'pending', verifiedDate: '' },
        ];
      case 'salary':
        return [
          { id: 't1', type: 'salary', name: 'Salary Slip Verification', status: 'pending', verifiedDate: '' },
          { id: 't2', type: 'employment', name: 'Employment Letter Check', status: 'pending', verifiedDate: '' },
          { id: 't3', type: 'aadhaar', name: 'Aadhaar Card Verification', status: 'pending', verifiedDate: '' },
        ];
      case 'identity':
        return [
          { id: 't1', type: 'aadhaar', name: 'Aadhaar Card Verification', status: 'pending', verifiedDate: '' },
          { id: 't2', type: 'pan', name: 'PAN Card Verification', status: 'pending', verifiedDate: '' },
        ];
      case 'reference':
        return [
          { id: 't1', type: 'residence', name: 'Reference Person Visit', status: 'pending', verifiedDate: '' },
          { id: 't2', type: 'aadhaar', name: 'Aadhaar Card Verification', status: 'pending', verifiedDate: '' },
        ];
      default:
        // Generic fallback — shows at least aadhaar + pan if type unknown
        return [
          { id: 't1', type: 'residence', name: 'On-Site Inspection', status: 'pending', verifiedDate: '' },
          { id: 't2', type: 'aadhaar', name: 'Aadhaar Card Verification', status: 'pending', verifiedDate: '' },
          { id: 't3', type: 'pan', name: 'PAN Card Verification', status: 'pending', verifiedDate: '' },
        ];
    }
  };

  // Priority: checklist_config (from DB) > caseData.tasks > fallback
  const initialTasks = (() => {
    let config = caseData?.checklist_config;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { console.log('Error parsing checklist_config', e); }
    }
    if (Array.isArray(config) && config.length > 0) {
      return config;
    }

    let t = caseData?.tasks;
    if (typeof t === 'string') {
      try { t = JSON.parse(t); } catch (e) { console.log('Error parsing tasks', e); }
    }
    if (Array.isArray(t) && t.length > 0) {
      return t;
    }
    // Returning fallback so the screen is not blank if API data is missing
    return generateTasksForType(caseData?.verification_type);
  })();

  const [tasks, setTasks] = useState(initialTasks);


  const [activeTaskModal, setActiveTaskModal] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  const [submitFieldReport, { isLoading: submitting }] = useSubmitFieldReportMutation();
  const [uploadCaseDocument] = useUploadCaseDocumentMutation();

  const verifiedCount = tasks.filter((t: any) => t.status === 'verified').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  const captureLocation = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission denied', 'Permission to access location was denied');
        return;
      }
    } else {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      if (auth !== 'granted') {
        Alert.alert('Permission denied', 'Permission to access location was denied');
        return;
      }
    }

    Geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords);
        Alert.alert("Success", "GPS Location Captured successfully.");
      },
      (_error) => {
        Alert.alert('Error', 'Failed to get location');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const takePhoto = async (): Promise<any> => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission denied', 'Camera permission is required');
        return Promise.reject('Camera permission is required');
      }
    }

    const result = await launchCamera({
      mediaType: 'photo',
      /* --- OLD CODE COMMENTED OUT AS REQUESTED ---
      quality: 0.5,
      ------------------------------------------- */
      quality: 0.5,
      maxWidth: 800,
      maxHeight: 800,
    });

    if (!result.didCancel && result.assets && result.assets.length > 0 && result.assets[0].uri) {
      const asset = result.assets[0];
      setPhotos([...photos, asset.uri as string]);

      return Promise.resolve(asset as any);
    }
    return Promise.reject("Cancelled");
  };

  const triggerSmartScan = async (task: any) => {
    try {
      const asset = await takePhoto();
      setIsScanning(true);
      setExtractedData(null);

      const fileData = {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `scan_${Date.now()}.jpg`
      };

      try {
        // Upload the document directly to the case endpoint via API
        const response = await uploadCaseDocument({ id, fileData, doc_type: task.title || task.name || 'Scan' }).unwrap();
        const apiData = response?.data || response;

        setIsScanning(false);

        // Populate dynamically from API response (no hardcoded demo data)
        if (task.type === 'aadhaar') {
          setExtractedData({
            name: apiData?.applicant_name || apiData?.name || 'Verified via API',
            uid: apiData?.uid || apiData?.document_number || 'Uploaded Successfully',
            status: 'Document Uploaded'
          });
        } else if (task.type === 'pan') {
          setExtractedData({
            name: apiData?.applicant_name || apiData?.name || 'Verified via API',
            pan: apiData?.pan || apiData?.document_number || 'Uploaded Successfully',
            status: 'Document Uploaded'
          });
        } else {
          setExtractedData({
            name: apiData?.applicant_name || apiData?.name || 'Verified via API',
            status: 'Document Uploaded'
          });
        }
      } catch (err: any) {
        setIsScanning(false);
        console.log('Smart Scan Error:', err);
        const errMsg = err?.data?.message || err?.data || err?.message || 'Failed to upload document to API.';
        Alert.alert('Scan Failed', typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));
      }
    } catch {
      setIsScanning(false);
    }
  };

  const handleApproveScan = (task: any) => {
    const updatedTasks = tasks.map((t: any) => {
      if (t.id === task.id) {
        return { ...t, status: 'verified', verifiedDate: 'Just now' };
      }
      return t;
    });
    setTasks(updatedTasks);
    setActiveTaskModal(null);
    setExtractedData(null);
  };

  const handleSubmitChecklist = async (isFinalSubmit = false) => {
    if (progressPercent < 100) return;

    try {
      await submitFieldReport({
        caseId: id,
        formData: {
          gps_lat: location ? location.latitude : 0,
          gps_lng: location ? location.longitude : 0,
          status: 'submitted',
          remarks: `Verification completed. ${verifiedCount} of ${totalCount} tasks verified.`,
          checklist_results: {
            verified: progressPercent === 100,
            coords: location,
            tasks: tasks,
            completedAt: new Date().toISOString(),
            ...(route.params?.triggerAnswers || {})
          }
        }
      }).unwrap();

      if (isFinalSubmit || route.params?.triggerAnswers) {
        Alert.alert(
          'Success',
          'Verification report submitted successfully.',
          [
            { text: 'OK', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) }
          ]
        );
      } else {
        Alert.alert('Success', 'Case report submitted successfully! Proceeding to trigger questions.', [
          { text: 'OK', onPress: () => navigation.navigate('TriggerQuestionsScreen', { id, caseData }) }
        ]);
      }
    } catch {
      Alert.alert('Error', 'Failed to submit report');
    }
  };

    useEffect(() => {
      const processSubmission = async () => {
        if (route.params?.triggerUploads) {
          const uploads = route.params.triggerUploads;
          for (const [title, assets] of Object.entries(uploads)) {
            if (Array.isArray(assets)) {
              for (const asset of assets) {
                if (asset && (asset as any).uri) {
                  try {
                    await uploadCaseDocument({
                      id,
                      fileData: { 
                        uri: (asset as any).uri, 
                        type: (asset as any).type || 'image/jpeg', 
                        name: (asset as any).fileName || 'trigger_upload.jpg' 
                      },
                      doc_type: title
                    }).unwrap();
                  } catch (e) {
                    console.log('Error uploading trigger document:', e);
                  }
                }
              }
            }
          }
        }
        handleSubmitChecklist(true);
      };

      if (route.params?.triggerAnswers) {
        processSubmission();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params?.triggerAnswers]);


  // const profileTasks = tasks.filter((t: any) => t.type === 'residence' || t.type === 'business' || t.type === 'employment' || t.type === 'hr');
  // const documentTasks = tasks.filter((t: any) => t.type === 'aadhaar' || t.type === 'pan' || t.type === 'salary');

  const documentTasks = tasks.filter((t: any) => {
    const type = (t.type || '').toLowerCase();
    return type === 'aadhaar' || type === 'pan' || type === 'salary' || type === 'document';
  });

  const profileTasks = tasks.filter((t: any) => {
    return !documentTasks.includes(t);
  });

  const renderTaskModal = () => {
    if (!activeTaskModal) return null;

    return (
      <Modal visible={!!activeTaskModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.modalSubtitle}>CHECKLIST TASK</Text>
                <Text style={styles.modalTitle}>{activeTaskModal.name}</Text>
              </View>
              <TouchableOpacity onPress={() => { setActiveTaskModal(null); setExtractedData(null); }} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {(activeTaskModal.type === 'residence' || activeTaskModal.type === 'employment') ? (
                <View style={styles.modalBody}>
                  <Text style={styles.modalDesc}>On-site physical inspection checklist. Capture GPS to verify location matches land records.</Text>

                  <View style={styles.checklistBox}>
                    <TouchableOpacity style={styles.checkboxRow} onPress={captureLocation}>
                      <View style={[styles.checkbox, location && styles.checkboxChecked]}>
                        {location && <Check color="white" size={14} />}
                      </View>
                      <Text style={styles.checkboxLabel}>Capture GPS Geo-tag ({location ? 'Captured' : 'Pending'})</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.verifyBtn, !location && styles.verifyBtnDisabled]}
                    disabled={!location}
                    onPress={() => {
                      const updatedTasks = tasks.map((t: any) => {
                        if (t.id === activeTaskModal.id) return { ...t, status: 'verified', verifiedDate: 'Just now' };
                        return t;
                      });
                      setTasks(updatedTasks);
                      setActiveTaskModal(null);
                    }}
                  >
                    <Text style={styles.verifyBtnText}>Verify Inspection Complete</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.modalBody}>
                  <Text style={styles.modalDesc}>Use camera scanner to capture document. Our smart extractor auto-scans metadata instantly.</Text>

                  <View style={styles.scanActionRow}>
                    <TouchableOpacity style={styles.scanBtn} onPress={() => triggerSmartScan(activeTaskModal)} disabled={isScanning}>
                      <Camera size={24} color="#003d9b" />
                      <Text style={styles.scanBtnText}>DEVICE SCANNER</Text>
                    </TouchableOpacity>
                  </View>

                  {isScanning && (
                    <View style={styles.scanningBox}>
                      <ActivityIndicator size="small" color="#003d9b" style={{ marginBottom: 8 }} />
                      <Text style={styles.scanningText}>EXTRACTING CREDENTIALS VIA SMART AI...</Text>
                    </View>
                  )}

                  {extractedData && (
                    <View style={styles.extractedBox}>
                      <View style={styles.extractedHeader}>
                        <Sparkles size={14} color="#16a34a" />
                        <Text style={styles.extractedTitle}>Extracted Metadata successfully</Text>
                      </View>
                      <View style={styles.extractedRow}>
                        <Text style={styles.extractedLabel}>Cardholder Name:</Text>
                        <Text style={styles.extractedValue}>{extractedData.name}</Text>
                      </View>
                      {extractedData.uid && (
                        <View style={styles.extractedRow}>
                          <Text style={styles.extractedLabel}>Aadhaar UID:</Text>
                          <Text style={styles.extractedValue}>{extractedData.uid}</Text>
                        </View>
                      )}
                      {extractedData.pan && (
                        <View style={styles.extractedRow}>
                          <Text style={styles.extractedLabel}>PAN Account:</Text>
                          <Text style={styles.extractedValue}>{extractedData.pan}</Text>
                        </View>
                      )}
                      <View style={[styles.extractedRow, styles.extractedRowLast]}>
                        <Text style={styles.extractedLabel}>Validation:</Text>
                        <Text style={styles.extractedStatus}>{extractedData.status}</Text>
                      </View>

                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveScan(activeTaskModal)}>
                        <Text style={styles.approveBtnText}>Approve & AutoFill Check</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#52525b" size={20} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Audit Checklist</Text>
        </View>
        <View style={styles.caseBadge}>
          <Text style={styles.caseBadgeText}>#{caseData?.case_no || id}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressSubtitle}>AUDIT PROGRESS</Text>
              <Text style={styles.progressTitle}>{progressPercent}% Complete</Text>
            </View>
            <View style={styles.progressCountBadge}>
              <Text style={styles.progressCountText}>{verifiedCount} of {totalCount} completed</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Tip */}
        <View style={styles.tipCard}>
          <Lightbulb size={20} color="#f59e0b" style={styles.tipIcon} />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Lighting & Clarity Warning</Text>
            <Text style={styles.tipDesc}>Ensure you are in a well-lit environment. Avoid deep shadows or glare on cards to prevent automatic scanner rejections.</Text>
          </View>
        </View>

        {/* Profile Group */}
        <View style={styles.taskGroup}>
          <View style={styles.groupHeader}>
            <ShieldCheck size={16} color="#003d9b" />
            <Text style={styles.groupTitle}>PROFILE VERIFICATION</Text>
          </View>
          {profileTasks.map((task: any, index: number) => {
            const isDone = task.status === 'verified';
            return (
              <TouchableOpacity key={task.id || `profile-${index}`} style={styles.taskItem} onPress={() => setActiveTaskModal(task)}>
                <View style={styles.taskItemLeft}>
                  {isDone ? <CheckCircle size={20} color="#003d9b" /> : <Circle size={20} color="#d4d4d8" />}
                  <View style={styles.taskItemInfo}>
                    <Text style={styles.taskItemName}>{task.name}</Text>
                    <Text style={styles.taskItemDesc}>{isDone ? `Verified on ${task.verifiedDate}` : 'Requires on-site inspection'}</Text>
                  </View>
                </View>
                <Eye size={16} color="#a1a1aa" />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Document Group */}
        <View style={styles.taskGroup}>
          <View style={styles.groupHeader}>
            <Edit3 size={15} color="#003d9b" />
            <Text style={styles.groupTitle}>DOCUMENT VERIFICATION</Text>
          </View>
          {documentTasks.map((task: any, index: number) => {
            const isDone = task.status === 'verified';
            return (
              <TouchableOpacity key={task.id || `doc-${index}`} style={styles.taskItem} onPress={() => setActiveTaskModal(task)}>
                <View style={styles.taskItemLeft}>
                  {isDone ? <CheckCircle size={20} color="#003d9b" /> : <Circle size={20} color="#ef4444" />}
                  <View style={styles.taskItemInfo}>
                    <Text style={styles.taskItemName}>{task.name}</Text>
                    {isDone ? (
                      <Text style={styles.taskItemDesc}>Autofill Complete</Text>
                    ) : (
                      <View style={styles.reqBadge}>
                        <Text style={styles.reqBadgeText}>REQUIRED</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.actionPill}>
                  <Text style={styles.actionPillText}>{isDone ? 'Edit' : 'Scan'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitMainBtn, progressPercent < 100 && styles.submitMainBtnDisabled]}
          disabled={progressPercent < 100 || submitting}
          onPress={() => handleSubmitChecklist(false)}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={[styles.submitMainBtnText, progressPercent < 100 && styles.submitMainBtnTextDisabled]}>Submit Verification Report</Text>
              <Send size={15} color={progressPercent < 100 ? "#a1a1aa" : "white"} />
            </>
          )}
        </TouchableOpacity>
        {progressPercent < 100 && (
          <Text style={styles.footerWarning}>Verify all checklist items above to enable submission.</Text>
        )}
      </View>

      {renderTaskModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { height: Platform.OS === 'android' ? 65 : 56, paddingTop: Platform.OS === 'android' ? 15 : 0, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f4f4f5', elevation: 2, zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 11, fontWeight: '800', color: '#18181b', letterSpacing: -0.5 },
  caseBadge: { backgroundColor: '#dae2ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  caseBadgeText: { color: '#0040a2', fontSize: 8, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 100 },

  progressCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#f4f4f5', elevation: 1 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  progressSubtitle: { fontSize: 8, fontWeight: '800', color: '#a1a1aa', letterSpacing: 1 },
  progressTitle: { fontSize: 14, fontWeight: '900', color: '#18181b', marginTop: 4 },
  progressCountBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  progressCountText: { fontSize: 10, fontWeight: 'bold', color: '#003d9b' },
  progressBarBg: { height: 10, backgroundColor: '#f4f4f5', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#003d9b', borderRadius: 5 },

  tipCard: { backgroundColor: '#fffbeb', padding: 16, borderRadius: 16, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#fef3c7', marginBottom: 20 },
  tipIcon: { marginTop: 2 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 10, fontWeight: '800', color: '#92400e', marginBottom: 4 },
  tipDesc: { fontSize: 10, color: '#b45309', lineHeight: 18 },

  taskGroup: { marginBottom: 20 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 4 },
  groupTitle: { fontSize: 8, fontWeight: '800', color: '#a1a1aa', letterSpacing: 1 },
  taskItem: { backgroundColor: 'white', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderWidth: 1, borderColor: '#f4f4f5', elevation: 1 },
  taskItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  taskItemInfo: { justifyContent: 'center', flex: 1 },
  taskItemName: { fontSize: 10, fontWeight: '800', color: '#18181b', marginBottom: 2 },
  taskItemDesc: { fontSize: 8, fontWeight: 'bold', color: '#71717a' },
  reqBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  reqBadgeText: { fontSize: 8, fontWeight: '800', color: '#dc2626', letterSpacing: 0.5 },
  actionPill: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  actionPillText: { fontSize: 8, fontWeight: 'bold', color: '#003d9b' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: '#f4f4f5', elevation: 10 },
  submitMainBtn: { flexDirection: 'row', gap: 8, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#003d9b', elevation: 4, bottom: Platform.OS === 'ios' ? 10 : 15 },
  submitMainBtnDisabled: { backgroundColor: '#e4e4e7', elevation: 0 },
  submitMainBtnText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  submitMainBtnTextDisabled: { color: '#a1a1aa' },
  footerWarning: { textAlign: 'center', fontSize: 8, fontWeight: 'bold', color: '#a1a1aa', marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalSubtitle: { fontSize: 8, fontWeight: '800', color: '#003d9b', letterSpacing: 1, marginBottom: 2 },
  modalTitle: { fontSize: 11, fontWeight: '800', color: '#18181b' },
  closeBtn: { backgroundColor: '#f4f4f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  closeBtnText: { fontSize: 10, fontWeight: 'bold', color: '#71717a' },
  modalScroll: { paddingBottom: 20 },
  modalBody: { paddingBottom: 20 },
  modalDesc: { fontSize: 10, color: '#71717a', lineHeight: 18, marginBottom: 16 },

  checklistBox: { backgroundColor: '#f4f4f5', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e4e4e7', marginBottom: 16 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d4d4d8', backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#003d9b', borderColor: '#003d9b' },
  checkboxLabel: { fontSize: 10, fontWeight: '600', color: '#3f3f46', flex: 1 },
  verifyBtn: { height: 44, backgroundColor: '#003d9b', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verifyBtnDisabled: { backgroundColor: '#a1a1aa' },
  verifyBtnText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  scanActionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  scanBtn: { flex: 1, height: 96, backgroundColor: '#eff6ff', borderRadius: 16, borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center', justifyContent: 'center', gap: 6 },
  scanBtnText: { fontSize: 8, fontWeight: 'bold', color: '#003d9b', letterSpacing: 1 },

  scanningBox: { backgroundColor: '#eff6ff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  scanningText: { fontSize: 8, fontWeight: 'bold', color: '#003d9b', letterSpacing: 1, textAlign: 'center' },

  extractedBox: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#dcfce7', marginTop: 16 },
  extractedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  extractedTitle: { fontSize: 10, fontWeight: 'bold', color: '#166534' },
  extractedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  extractedRowLast: { paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: '#bbf7d0', marginBottom: 16 },
  extractedLabel: { fontSize: 10, color: '#a1a1aa' },
  extractedValue: { fontSize: 10, fontWeight: 'bold', color: '#27272a' },
  extractedStatus: { fontSize: 10, fontWeight: '900', color: '#15803d' },
  approveBtn: { height: 40, backgroundColor: '#16a34a', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  approveBtnText: { color: 'white', fontSize: 10, fontWeight: 'bold' }
});
