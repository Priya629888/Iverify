import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SplashScreen = ({ navigation }: any) => {
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveDot((prev) => (prev + 1) % 3);
    }, 666);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <SafeAreaView style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0C447C" />
      <View style={styles.splashContainer}>
        {/* Decorative circles */}
        <View style={[styles.circle, styles.circleTopRight]} />
        <View style={[styles.circle, styles.circleBottomLeft]} />

        {/* Logo */}
        <View style={styles.centerContent}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/image/CAS.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Bottom section */}
        <View style={styles.bottomContainer}>
          <View style={styles.dotsRow}>
            <View style={[styles.dot, activeDot === 0 && styles.dotActive]} />
            <View style={[styles.dot, activeDot === 1 && styles.dotActive]} />
            <View style={[styles.dot, activeDot === 2 && styles.dotActive]} />
          </View>
          <Text style={styles.footerText}>POWERED BY 256-BIT ENCRYPTION</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0C447C',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#0C447C',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circleTopRight: {
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circleBottomLeft: {
    bottom: -80,
    left: -60,
    width: 220,
    height: 220,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 160,
    height: 160,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 56,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
  footerText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
});

export default SplashScreen;