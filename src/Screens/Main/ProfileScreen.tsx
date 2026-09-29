import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch, Image, SafeAreaView, Alert, Platform, PermissionsAndroid, ActivityIndicator } from 'react-native';
import { Camera, Lock, Mail, Phone, Save, CheckCircle, RotateCw, UserCheck, Key, Eye, EyeOff, LogOut, User } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { launchCamera } from 'react-native-image-picker';
import { useUpdateProfileSettingsMutation, useGetProfileSettingsQuery } from '../../Redux/api/updateApi';
export default function ProfileScreen() {
  const { user, logout } = useAuth();

  // ── All hooks declared at the top in fixed order (Rules of Hooks) ──
  // refetchOnMountOrArgChange: true → screen mount হলে সবসময় fresh data আসবে, আগের user এর cache থাকবে না
  const { data: profileData, isLoading } = useGetProfileSettingsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const [updateProfileSettings] = useUpdateProfileSettingsMutation();

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pushNotif, setPushNotif] = useState(false);
  const [locTrack, setLocTrack] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Effects ──
  React.useEffect(() => {
    if (profileData) {
      //  Debug: log both user (AsyncStorage) and profileData (API) to find LV-0000-X / Field Inspector origin
      console.log(' user object (from AsyncStorage):', JSON.stringify(user, null, 2));
      console.log(' profileData (from API /api/mobile/profile):', JSON.stringify(profileData, null, 2));

      // Phone — covers all common API field name patterns
      const phoneVal =
        profileData.contact?.phone ||
        profileData.contact?.mobile ||
        profileData.phone ||
        profileData.mobile ||
        profileData.phoneNumber ||
        profileData.phone_number ||
        user?.mobile ||
        user?.phoneNumber ||
        '';

      // Email — covers all common API field name patterns
      const emailVal =
        profileData.contact?.email ||
        profileData.email ||
        user?.email ||
        '';

      setPhone(phoneVal);
      setEmail(emailVal);
      setPushNotif(profileData.preferences?.push_notifications ?? false);
      setLocTrack(profileData.preferences?.gps_tracking ?? false);
      setPrefsReady(true);
    }
  }, [profileData]);

  // ── Derived values (computed from API data, not hooks) ──
  // Employee ID — covers all common API field name patterns
  const employeeId =
    profileData?.employee_id ||
    profileData?.employeeId ||
    profileData?.employee_code ||
    profileData?.employeeCode ||
    profileData?.emp_id ||
    profileData?.empId ||
    profileData?.code ||
    user?.employeeCode ||
    user?.employee_id ||
    '';

  // Name
  const displayName =
    profileData?.name ||
    profileData?.full_name ||
    profileData?.fullName ||
    user?.name ||
    '';

  // Role / Designation
  const displayRole =
    profileData?.role ||
    profileData?.designation ||
    profileData?.job_title ||
    profileData?.jobTitle ||
    profileData?.title ||
    user?.title ||
    user?.role ||
    '';

  // Status
  const displayStatus =
    profileData?.status ||
    profileData?.active_status ||
    profileData?.activeStatus ||
    user?.status ||
    '';

  // Avatar
  const avatarUri =
    localAvatar ||
    profileData?.avatar_url ||
    profileData?.avatarUrl ||
    profileData?.profile_image ||
    profileData?.profileImage ||
    profileData?.photo ||
    user?.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=003d9b&color=fff&bold=true&size=128`;

  // ── Handlers ──
  const handleLogout = async () => {
    await logout();
  };

  const takePhoto = async (): Promise<void> => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Camera permission is required');
          return;
        }
      }

      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.5,
      });

      if (!result.didCancel && result.assets && result.assets.length > 0 && result.assets[0].uri) {
        setLocalAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Camera Error', error);
    }
  };

  const handleSaveChanges = async () => {
    if (password && !oldPassword) {
      Alert.alert('Validation', 'Please enter your old password to set a new one.');
      return;
    }
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload: any = {
        push_notifications: pushNotif,
        gps_tracking: locTrack,
      };
      if (password && oldPassword) {
        payload.password = password;
        payload.password_confirmation = password;
        payload.old_password = oldPassword;
        payload.oldPassword = oldPassword;
      }
      const response = await updateProfileSettings(payload).unwrap();

      console.log('Profile update response:', response);
      setPassword('');
      setOldPassword('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error: any) {
      console.log('Profile update error:', error);
      const msg = error?.data?.message || 'Failed to update profile settings.';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading State ──
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBox}>
              <UserCheck size={16} color="white" />
            </View>
            <Text style={styles.headerTitle}>Agent Profile</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <LogOut size={12} color="#dc2626" />
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#003d9b" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Application Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <UserCheck size={16} color="white" />
          </View>
          <Text style={styles.headerTitle}>Agent Profile</Text>
        </View>

        <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          <LogOut size={12} color="#dc2626" />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Header Segment card */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImg}
              />
            </View>
            <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto}>
              <Camera size={15} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            {displayRole ? (
              <Text style={styles.profileTitle}>{displayRole}</Text>
            ) : null}

            <View style={styles.badgesRow}>
              {displayRole ? (
                <View style={styles.seniorBadge}>
                  <Text style={styles.seniorBadgeText}>
                    {displayRole.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {displayStatus ? (
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>
                    {displayStatus.toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Form container */}
        <View style={styles.formContainer}>

          {/* Professional Details (Locked) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>PROFESSIONAL DETAILS</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMPLOYEE ID</Text>
              <View style={styles.inputWrapper}>
                <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                  <User size={16} color="#2563eb" />
                </View>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={employeeId}
                  editable={false}
                  placeholder="—"
                  placeholderTextColor="#a1a1aa"
                />
              </View>
            </View>
          </View>

          {/* Contact Details inputs */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>CONTACT INFORMATION</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PHONE NUMBER</Text>
              <View style={styles.inputWrapper}>
                <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                  <Phone size={16} color="#16a34a" />
                </View>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={phone}
                  keyboardType="phone-pad"
                  editable={false}
                  placeholder="—"
                  placeholderTextColor="#a1a1aa"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <View style={styles.inputWrapper}>
                <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                  <Mail size={16} color="#d97706" />
                </View>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={false}
                  placeholder="—"
                  placeholderTextColor="#a1a1aa"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>OLD PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <View style={[styles.iconBox, { backgroundColor: '#e0e7ff' }]}>
                  <Lock size={16} color="#4f46e5" />
                </View>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  secureTextEntry={!showOldPassword}
                  placeholder="Enter old password"
                  placeholderTextColor="#a1a1aa"
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)} style={{ padding: 10 }}>
                  {showOldPassword ? (
                    <Eye size={16} color="#a1a1aa" />
                  ) : (
                    <EyeOff size={16} color="#a1a1aa" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NEW PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <View style={[styles.iconBox, { backgroundColor: '#e0e7ff' }]}>
                  <Key size={16} color="#4f46e5" />
                </View>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#a1a1aa"
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 10 }}>
                  {showPassword ? (
                    <Eye size={16} color="#a1a1aa" />
                  ) : (
                    <EyeOff size={16} color="#a1a1aa" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Preferences toggles */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>APPLICATION PREFERENCES</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Push Notifications</Text>
              <Switch
                value={pushNotif}
                onValueChange={prefsReady ? setPushNotif : undefined}
                disabled={!prefsReady}
                trackColor={{ false: '#d4d4d8', true: '#003d9b' }}
                thumbColor="#fff"
              />
            </View>

            <View style={[styles.toggleRow, styles.toggleRowNoBorder]}>
              <Text style={styles.toggleLabel}>GPS Location Tracking</Text>
              <Switch
                value={locTrack}
                onValueChange={prefsReady ? setLocTrack : undefined}
                disabled={!prefsReady}
                trackColor={{ false: '#d4d4d8', true: '#003d9b' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Form Action save buttons */}
          <View style={styles.saveSection}>
            <TouchableOpacity
              disabled={isSaving}
              onPress={handleSaveChanges}
              style={[
                styles.saveBtn,
                saveSuccess ? styles.saveBtnSuccess : null
              ]}
            >
              {isSaving ? (
                <>
                  <RotateCw size={15} color="white" />
                  <Text style={styles.saveBtnText}>Saving Changes...</Text>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle size={15} color="white" />
                  <Text style={styles.saveBtnText}>Profile Saved Successfully</Text>
                </>
              ) : (
                <>
                  <Save size={15} color="white" />
                  <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.lastSyncText}>
              {profileData?.last_sync
                ? `Last synchronized: ${new Date(profileData.last_sync).toLocaleString()}`
                : 'Not yet synchronized'}
            </Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', marginTop: Platform.OS === 'android' ? 4 : 0 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 9, color: '#a1a1aa', fontWeight: '600' },
  header: {
    height: Platform.OS === 'android' ? 70 : 60, paddingTop: Platform.OS === 'android' ? 15 : 0, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f4f4f5', elevation: 2, zIndex: 10,

  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { width: 32, height: 32, backgroundColor: '#003d9b', borderRadius: 8, alignItems: 'center', justifyContent: 'center', },
  headerTitle: { fontSize: 11, fontWeight: '800', color: '#18181b', letterSpacing: -0.5 },
  logoutBtn: { backgroundColor: '#fef2f2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutBtnText: { color: '#dc2626', fontSize: 10, fontWeight: 'bold' },

  scrollContent: { padding: 16, paddingBottom: 100 },

  profileHeader: { alignItems: 'center', paddingVertical: 8, marginBottom: 20 },
  avatarWrapper: { position: 'relative' },
  avatarCircle: { width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderColor: 'white', backgroundColor: '#f4f4f5', overflow: 'hidden', elevation: 4 },
  avatarImg: { width: '100%', height: '100%' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, backgroundColor: '#003d9b', borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 5, borderWidth: 2, borderColor: 'white' },

  profileInfo: { alignItems: 'center', marginTop: 14 },
  profileName: { fontSize: 13, fontWeight: '800', color: '#18181b' },
  profileTitle: { fontSize: 10, fontWeight: 'bold', color: '#a1a1aa', letterSpacing: 0.5, marginTop: 4 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  seniorBadge: { backgroundColor: '#dae2ff', paddingHorizontal: 12, paddingVertical: 2, borderRadius: 12 },
  seniorBadgeText: { color: '#0040a2', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 2, borderRadius: 12 },
  activeDot: { width: 6, height: 6, backgroundColor: '#22c55e', borderRadius: 3 },
  activeBadgeText: { color: '#15803d', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },

  formContainer: { gap: 16 },
  sectionCard: { backgroundColor: 'white', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f4f4f5', elevation: 1 },
  sectionTitle: { fontSize: 8, fontWeight: '900', color: '#003d9b', letterSpacing: 1, marginBottom: 12 },

  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 8, fontWeight: 'bold', color: '#a1a1aa', marginBottom: 4, letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, height: 48, paddingHorizontal: 8 },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  input: { flex: 1, height: '100%', fontSize: 10, fontWeight: '600', color: '#27272a' },
  inputDisabled: { color: '#a1a1aa' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f4f4f5' },
  toggleRowNoBorder: { borderBottomWidth: 0 },
  toggleLabel: { fontSize: 10, fontWeight: '600', color: '#3f3f46' },

  saveSection: { marginTop: 8 },
  saveBtn: { height: 48, backgroundColor: '#003d9b', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 4 },
  saveBtnSuccess: { backgroundColor: '#16a34a' },
  saveBtnText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  lastSyncText: { textAlign: 'center', fontSize: 8, fontWeight: 'bold', color: '#a1a1aa', marginTop: 12 }
});
