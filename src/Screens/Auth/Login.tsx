import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, SafeAreaView, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, ArrowRight, QrCode, AlertCircle, X, CheckCircle2, Lock, Phone, Eye, EyeOff } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import normalize from '@/Utils/Helpers/normalize';

const { width } = Dimensions.get('window');

export default function Login() {
  const { login } = useAuth();
  const navigation = useNavigation<any>();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePhoneChange = (val: string) => {
    let cleanVal = val.replace(/\D/g, '');
    if (cleanVal.length > 10) cleanVal = cleanVal.slice(0, 10);
    setPhoneNumber(cleanVal);
    setError('');
  };

  const handleLogin = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const success = await login(cleanPhone, password);
      if (!success) {
        setError('Invalid credentials');
      } else {
        Alert.alert('Success', 'Login successful!');
      }
    } catch (err: any) {
      // Get the exact error message from Axios if the server didn't respond
      const errorMessage = err.response?.data?.message || err.message || 'Failed to authenticate';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRScanSuccess = () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10 || !password) {
      Alert.alert('Validation', 'Please enter both mobile number and password to simulate the scan dynamically.');
      setShowQRScanner(false);
      return;
    }

    setIsLoading(true);
    setTimeout(async () => {
      setIsLoading(false);
      setShowQRScanner(false);
      try {
        const success = await login(cleanPhone, password);
        if (!success) {
          Alert.alert('Error', 'Invalid QR credentials');
        } else {
          Alert.alert('Success', 'Login successful!');
        }
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to login');
      }
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Top Banner Area with dynamic wave graphics */}
          <LinearGradient colors={['rgba(0,61,155,0.1)', '#f8f9fa']} style={styles.topBanner}>
            <View style={styles.logoCluster}>
              <ShieldCheck color="white" size={40} />
            </View>
            <Text style={styles.brandTitle}>Field Verify</Text>
            <Text style={styles.brandSubtitle}>SECURE OPERATIONS PORTAL</Text>

            <View style={styles.waveContainer}>
              <Svg viewBox="0 0 1200 120" width={width} height={40} preserveAspectRatio="none">
                <Path fill="#f8f9fa" d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" />
              </Svg>
            </View>
          </LinearGradient>

          {/* Primary Content Card */}
          <View style={styles.cardContainer}>
            <View style={styles.card}>

              <View style={styles.headerTextContainer}>
                <Text style={styles.h2}>Welcome Back</Text>
                <Text style={styles.p}>Please enter your mobile number and password to sign in.</Text>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <AlertCircle color="#dc2626" size={16} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={[styles.inputGroup, { borderTopLeftRadius: 12, borderTopRightRadius: 12 }]}>
                <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
                <View style={styles.inputInnerContainer}>
                  <Phone color="#a1a1aa" size={18} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    placeholder="Enter 10-digit mobile number"
                    keyboardType="phone-pad"
                    placeholderTextColor="#d4d4d8"
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, { borderBottomWidth: 2, marginBottom: 24 }]}>
                <Text style={styles.inputLabel}>PASSWORD</Text>
                <View style={styles.inputInnerContainer}>
                  <Lock color="#a1a1aa" size={18} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={password}
                    onChangeText={(val) => { setPassword(val); setError(''); }}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#d4d4d8"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    {showPassword ? (
                      <EyeOff color="#a1a1aa" size={20} />
                    ) : (
                      <Eye color="#a1a1aa" size={20} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={styles.btnRow}>
                    <Text style={styles.primaryButtonText}>Sign In</Text>
                    <ArrowRight color="white" size={16} />
                  </View>
                )}
              </TouchableOpacity>

              {/* <View style={styles.actionSegment}>
                <TouchableOpacity onPress={() => setError('Please contact technical support at support@fieldverify.ai or +1 (800) 555-0199')}>
                  <Text style={styles.linkText}>Trouble logging in?</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowQRScanner(true)}>
                  <QrCode color="#71717a" size={18} />
                  <Text style={styles.secondaryButtonText}>Log in with QR</Text>
                </TouchableOpacity>
              </View> */}

            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By signing in, you agree to our{'\n'}
              <Text style={styles.footerLink}>Terms of Service</Text> & <Text style={styles.footerLink}>Privacy Policy</Text>
            </Text>
            <Text style={styles.copyright}>© 2026 LoanVerify Pro. All rights reserved.</Text>
          </View>
        </ScrollView>

      </KeyboardAvoidingView>

      {/* QR Scanner Modal */}
      <Modal visible={showQRScanner} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>QR Portal Scan</Text>
            <TouchableOpacity onPress={() => setShowQRScanner(false)} style={styles.closeBtn}>
              <X color="white" size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.scannerArea}>
            <View style={styles.scannerFrame}>
              <QrCode color="rgba(255,255,255,0.35)" size={120} />
            </View>
            <Text style={styles.scannerText}>
              Scan the QR code displayed on your desktop LoanVerify system to authenticate instantly.
            </Text>
          </View>

          <TouchableOpacity style={styles.simulateQRBtn} onPress={handleQRScanSuccess} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#003d9b" />
            ) : (
              <View style={styles.btnRow}>
                <CheckCircle2 color="#003d9b" size={16} />
                <Text style={styles.simulateQRText}>Simulate QR Found</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  topBanner: {
    height: normalize(250),
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: normalize(24),
    position: 'relative',
  },
  logoCluster: {
    width: normalize(70),
    height: normalize(70),
    backgroundColor: '#003d9b',
    borderRadius: normalize(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(16),
    shadowColor: '#003d9b',
    shadowOffset: { width: 0, height: normalize(8) },
    shadowOpacity: 0.3,
    shadowRadius: normalize(20),
    elevation: 8,
    transform: [{ rotate: '3deg' }]
  },
  brandTitle: {
    fontSize: normalize(18),
    fontWeight: '900',
    color: '#003d9b',
  },
  brandSubtitle: {
    fontSize: normalize(10),
    fontWeight: '600',
    color: 'rgba(0,61,155,0.7)',
    marginTop: normalize(2),
    letterSpacing: normalize(1),
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: normalize(40),
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: normalize(24),
    marginTop: normalize(-20),
    zIndex: 10,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: normalize(24),
    padding: normalize(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(10) },
    shadowOpacity: 0.03,
    shadowRadius: normalize(30),
    elevation: 4,
    borderColor: '#f4f4f5',
    borderWidth: 1,
  },
  headerTextContainer: {
    marginBottom: normalize(20),

  },
  h2: {
    fontSize: normalize(15),
    fontWeight: 'bold',
    color: '#18181b',
  },
  p: {
    fontSize: normalize(11),
    color: '#71717a',
    marginTop: normalize(4),
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: normalize(12),
    borderRadius: normalize(12),
    borderColor: '#fee2e2',
    borderWidth: normalize(1),
    marginBottom: normalize(16),
  },
  errorText: {
    color: '#dc2626',
    fontSize: normalize(12),
    marginLeft: normalize(8),
  },
  inputGroup: {
    backgroundColor: '#fafafa',
    borderBottomWidth: normalize(1),
    borderBottomColor: '#e4e4e7',
    paddingHorizontal: normalize(16),
    paddingTop: normalize(20),
    paddingBottom: normalize(8),
  },
  inputLabel: {
    position: 'absolute',
    left: normalize(16),
    top: normalize(3),
    fontSize: normalize(8),
    fontWeight: 'bold',
    color: '#003d9b',
    letterSpacing: normalize(1),
  },
  inputInnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefixText: {
    color: '#27272a',
    fontWeight: 'bold',
    fontSize: normalize(16),
  },
  verticalDivider: {
    width: normalize(1),
    height: normalize(16),
    backgroundColor: '#d4d4d8',
    marginHorizontal: normalize(8),
  },
  textInput: {
    flex: 1,
    color: '#27272a',
    fontWeight: '600',
    fontSize: normalize(16),
    padding: 0,
  },
  primaryButton: {
    height: normalize(48),
    backgroundColor: '#003d9b',
    borderRadius: normalize(24),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: normalize(2) },
    shadowOpacity: 0.1,
    shadowRadius: normalize(4),
    elevation: 2,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: normalize(8),
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: normalize(14),
  },
  actionSegment: {
    alignItems: 'center',
    marginTop: normalize(16),
  },
  linkText: {
    fontSize: normalize(12),
    fontWeight: 'bold',
    color: '#003d9b',
    textDecorationLine: 'underline',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: normalize(16),
  },
  dividerLine: {
    flex: 1,
    height: normalize(1),
    backgroundColor: '#e4e4e7',
  },
  dividerText: {
    fontSize: normalize(10),
    fontWeight: 'bold',
    color: '#a1a1aa',
    letterSpacing: normalize(1),
    marginHorizontal: normalize(12),
  },
  secondaryButton: {
    height: normalize(48),
    width: '100%',
    borderWidth: normalize(1),
    borderColor: '#e4e4e7',
    borderRadius: normalize(24),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: normalize(10),
  },
  secondaryButtonText: {
    color: '#3f3f46',
    fontWeight: '600',
    fontSize: normalize(14),
  },
  footer: {
    paddingVertical: normalize(24),
    paddingHorizontal: normalize(32),
    backgroundColor: 'rgba(244,244,245,0.5)',
    borderTopWidth: normalize(1),
    borderTopColor: '#f4f4f5',
    alignItems: 'center',
    marginTop: 'auto',
  },
  footerText: {
    textAlign: 'center',
    fontSize: normalize(11),
    color: '#a1a1aa',
    lineHeight: normalize(18),
  },
  footerLink: {
    fontWeight: 'bold',
    color: '#003d9b',
  },
  copyright: {
    marginTop: normalize(8),
    fontSize: normalize(9),
    color: '#d4d4d8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: normalize(32),
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: normalize(40),
  },
  modalTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: normalize(14),
    letterSpacing: normalize(0.5),
  },
  closeBtn: {
    padding: normalize(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: normalize(20),
  },
  scannerArea: {
    alignItems: 'center',
  },
  scannerFrame: {
    width: normalize(256),
    height: normalize(256),
    borderWidth: normalize(2),
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: normalize(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: normalize(12),
    textAlign: 'center',
    marginTop: normalize(24),
    maxWidth: normalize(200),
    lineHeight: normalize(18),
  },
  simulateQRBtn: {
    height: normalize(48),
    backgroundColor: 'white',
    borderRadius: normalize(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(40),
  },
  simulateQRText: {
    color: '#003d9b',
    fontWeight: 'bold',
    fontSize: normalize(14),
  }
});