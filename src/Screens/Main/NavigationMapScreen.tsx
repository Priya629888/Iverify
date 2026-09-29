import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Dimensions, Platform, PermissionsAndroid, ScrollView, Animated, Linking } from 'react-native';
import { ArrowLeft, MoreVertical, Compass, Phone, CheckCircle, Navigation2, Layers, MapPin, ChevronUp, ChevronDown, List, Clock, Zap } from 'lucide-react-native';
import WebView from 'react-native-webview';
import Geolocation from 'react-native-geolocation-service';
import { useStartTripMutation, useUpdateLocationMutation, useStopTripMutation } from '../../Redux/api/trackingApi';
import { useGetCaseDetailsQuery } from '../../Redux/api';
const _phoneCallMod = require('react-native-phone-call');
const call = _phoneCallMod.default || _phoneCallMod;

const { width, height } = Dimensions.get('window');

export default function NavigationMapScreen({ route, navigation }: any) {
  const { selectedCase, allStops } = route.params || { selectedCase: { address: '123 Fake Street', applicantName: 'John Doe', phoneNumber: '555-1234' }, allStops: [] };

  const { data: caseData } = useGetCaseDetailsQuery(selectedCase?.id, {
    skip: !selectedCase?.id,
  });

  // Stops panel state
  const [stopsOpen, setStopsOpen] = useState(false);
  const stopsAnim = useRef(new Animated.Value(0)).current;

  const toggleStops = () => {
    const toValue = stopsOpen ? 0 : 1;
    Animated.spring(stopsAnim, { toValue, useNativeDriver: false, tension: 60, friction: 10 }).start();
    setStopsOpen(!stopsOpen);
  };

  // Build stops list: current destination is always first, then any additional stops
  const stopsList: Array<{ id: string; address: string; applicantName: string; status: string; lat?: any; lng?: any }> = [
    {
      id: selectedCase.id || '1',
      address: selectedCase.address || 'Current Destination',
      applicantName: selectedCase.applicantName || selectedCase.applicant_name || 'Applicant',
      status: 'current',
      lat: selectedCase.lat || selectedCase.gps_lat || selectedCase.field_report?.gps_lat || selectedCase.latitude,
      lng: selectedCase.lng || selectedCase.gps_lng || selectedCase.field_report?.gps_lng || selectedCase.longitude,
    },
    ...(Array.isArray(allStops) ? allStops.filter((s: any) => s.id !== selectedCase.id) : []),
  ];

  // Haversine distance calculator
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      0.5 - Math.cos(dLat) / 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      (1 - Math.cos(dLon)) / 2;
    const safeA = Math.max(0, Math.min(1, a));
    return R * 2 * Math.asin(Math.sqrt(safeA));
  };

  const [navStarted, setNavStarted] = useState(false);
  const [eta, setEta] = useState(12);
  const [showToast, setShowToast] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [startCoords, setStartCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const webViewRef = useRef<any>(null);

  const extractCoords = (obj: any) => {
    if (!obj) return { lat: NaN, lng: NaN };
    let lat = parseFloat(obj.lat || obj.gps_lat || obj.field_report?.gps_lat || obj.latitude);
    let lng = parseFloat(obj.lng || obj.gps_lng || obj.field_report?.gps_lng || obj.longitude);

    if ((isNaN(lat) || isNaN(lng)) && obj.location_coordinates) {
      try {
        const parsed = typeof obj.location_coordinates === 'string' ? JSON.parse(obj.location_coordinates) : obj.location_coordinates;
        if (parsed && parsed.lat != null) {
          lat = parseFloat(parsed.lat);
          lng = parseFloat(parsed.lng);
        }
      } catch (e) { }
    }

    // Default to Kolkata if completely invalid or zero
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      lat = 22.5726;
      lng = 88.3639;
    }

    // --- CLIENT DEMO OVERRIDE: Shift destinations to West Bengal (Kolkata) ---
    if (!isNaN(lat) && !isNaN(lng)) {
      const numId = parseInt(obj.id) || 1;

      // If outside West Bengal, force into Kolkata with wide spread
      if (lat < 21 || lat > 27 || lng < 85 || lng > 90) {
        lat = 22.5726 + (Math.sin(numId * 10) * 0.04);
        lng = 88.3639 + (Math.cos(numId * 10) * 0.04);
      } else if (Math.abs(lat - 22.5726) < 0.0001 && Math.abs(lng - 88.3639) < 0.0001) {
        // If exact default Kolkata coords, spread them out widely
        lat = lat + (Math.sin(numId * 47) * 0.08);
        lng = lng + (Math.cos(numId * 31) * 0.08);
      } else {
        // Normal tiny jitter to prevent overlapping pins
        lat = lat + (Math.sin(numId * 10) * 0.0002);
        lng = lng + (Math.cos(numId * 10) * 0.0002);
      }
    }

    return { lat, lng };
  };

  const caseCoords = extractCoords(caseData);
  const selectedCoords = extractCoords(selectedCase);

  const destLat = (!isNaN(caseCoords.lat) ? caseCoords.lat : (!isNaN(selectedCoords.lat) ? selectedCoords.lat : 0));
  const destLng = (!isNaN(caseCoords.lng) ? caseCoords.lng : (!isNaN(selectedCoords.lng) ? selectedCoords.lng : 0));

  const fallbackLat = currentCoords?.latitude || 0;
  const fallbackLng = currentCoords?.longitude || 0;
  let dynamicDistance = 4.2;
  let dynamicEta = eta;

  if (currentCoords && destLat !== 0 && destLng !== 0) {
    const calcDist = getDistance(currentCoords.latitude, currentCoords.longitude, destLat, destLng);
    dynamicDistance = calcDist;
    dynamicEta = Math.max(1, Math.round((dynamicDistance / 30) * 60));
  }

  const [startTrip] = useStartTripMutation();
  const [updateLocation] = useUpdateLocationMutation();
  const [stopTrip] = useStopTripMutation();
  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<any>(null);
  const navStartedRef = useRef(false);

  // Smoothly move animated marker and re-center map
  const moveMarker = (latitude: number, longitude: number) => {
    setCurrentCoords({ latitude, longitude });
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.updateLocation(${latitude}, ${longitude}); true;`);
    }
  };

  const centerMap = () => {
    if (currentCoords && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.centerMap(); true;`);
    } else {
      Alert.alert('Location Info', 'Waiting for GPS connection...');
    }
  };

  useEffect(() => {
    navStartedRef.current = navStarted;
  }, [navStarted]);

  useEffect(() => {
    // Fetch initial location to make map center dynamic if no destination is set
    Geolocation.getCurrentPosition(
      (position) => {
        setCurrentCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (webViewRef.current && destLat === 0) {
          webViewRef.current.injectJavaScript(`map.setView([${position.coords.latitude}, ${position.coords.longitude}], 14); true;`);
        }
      },
      (error) => console.log('Location fetch error:', error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
      if (simIntervalRef.current !== null) {
        clearInterval(simIntervalRef.current);
      }
      if (navStartedRef.current) {
        stopTrip().catch(() => { });
      }
    };
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED ||
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleStartNav = async () => {
    try {
      const destUrl = Platform.OS === 'ios'
        ? `maps://app?daddr=${destLat},${destLng}`
        : `google.navigation:q=${destLat},${destLng}`;

      if (navStarted) {
        setRecalculating(true);
        Linking.openURL(destUrl).catch(() => console.log('Could not open map'));
        setTimeout(() => {
          setRecalculating(false);
          if (!currentCoords) setEta(prev => Math.max(8, prev - 2));
          showTempToast();
        }, 1500);
      } else {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          Alert.alert('Permission Denied', 'Location permission is required for navigation.');
          return;
        }
        await startTrip({ case_id: selectedCase.id || 'unknown' }).unwrap();
        setNavStarted(true);
        showTempToast();
        Linking.openURL(destUrl).catch(() => console.log('Could not open map'));
        // ── Real GPS live tracking with AnimatedRegion ──
        watchIdRef.current = Geolocation.watchPosition(
          (position) => {
            try {
              const { latitude, longitude } = position.coords;
              setStartCoords(prev => prev || { latitude, longitude });
              // Smooth animated marker move + re-center map
              moveMarker(latitude, longitude);
              // Send to server (WebSocket-ready via RTK mutation)
              updateLocation({ latitude, longitude }).catch(e =>
                console.log('Update location error:', e)
              );
            } catch (err) {
              console.log('Error inside watchPosition callback:', err);
            }
          },
          (error) => console.log('Geolocation error:', error),
          {
            enableHighAccuracy: true,
            distanceFilter: 10,   // every 10 metres
            interval: 5000,        // every 5 seconds
            fastestInterval: 2000,
          }
        );
      }
    } catch (error) {
      console.log('Failed to start trip or handle navigation:', error);
      Alert.alert('Error', 'An unexpected error occurred while starting navigation. Please try again.');
    }
  };

  const showTempToast = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const validPhoneNumber = [
    caseData?.applicant_phone,
    selectedCase.phoneNumber,
    selectedCase.applicant_phone,
    selectedCase.phone,
    selectedCase.mobile
  ].find(num => num && String(num).trim() !== '' && num !== 'N/A') || null;

  const makePhoneCall = () => {
    /* --- OLD CODE COMMENTED OUT AS REQUESTED ---
    const phoneNumber = selectedCase.phoneNumber || selectedCase.applicant_phone;
    if (!phoneNumber || phoneNumber === 'N/A') {
      Alert.alert('No Number', 'No valid phone number available for this case.');
      return;
    }
    const args = {
      number: String(phoneNumber).replace(/\D/g, ''),
      prompt: false,
      skipCanOpen: true
    };
    call(args).catch(console.error);
    ------------------------------------------- */

    if (!validPhoneNumber) {
      Alert.alert('No Number', 'No valid phone number available for this case.');
      return;
    }
    const args = {
      number: String(validPhoneNumber).replace(/[^\d+]/g, ''),
      prompt: false,
      skipCanOpen: true
    };
    call(args).catch(console.error);
  };

  // Removed getDynamicMarkerStyle as we now use real maps
  // Avatar initials helper
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const completedCount = stopsList.filter(s => s.status === 'completed' || s.status === 'done').length;
  const progressPct = stopsList.length > 0 ? Math.round((completedCount / stopsList.length) * 100) : 0;

  const validStops = stopsList.filter(s => s.lat && s.lng);

  const leafletHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { padding: 0; margin: 0; }
    html, body, #map { height: 100%; width: 100%; }
    .custom-div-icon { background: transparent; border: none; }
    .self-location { width: 48px; height: 48px; background-color: rgba(37, 99, 235, 0.2); border-radius: 24px; display: flex; align-items: center; justify-content: center; }
    .self-badge { width: 20px; height: 20px; background-color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .self-badge-dot { width: 12px; height: 12px; background-color: #2563eb; border-radius: 6px; }
    .pin-wrapper { position: absolute; align-items: center; display: flex; flex-direction: column; transform: translate(-50%, -100%); }
    .pin-bubble { width: 24px; height: 24px; background-color: #003d9b; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); color: white; font-size: 10px; font-weight: bold; font-family: sans-serif; }
    .pin-triangle { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 6px solid #003d9b; margin-top: -1px; }
    .pin-label { margin-top: 2px; font-size: 10px; font-weight: 600; color: #3f3f46; background: rgba(255,255,255,0.8); padding: 0 4px; border-radius: 4px; font-family: sans-serif; text-align: center; white-space: nowrap; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    const stopsData = ${JSON.stringify(validStops)};
    const destMarkers = [];
    const routeCoords = [];
    
    stopsData.forEach((stop, idx) => {
      const lat = parseFloat(stop.lat);
      const lng = parseFloat(stop.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const stopName = (stop.applicantName || 'Stop').split(' ')[0].replace(/'/g, "\\\\'");
      const stopAddr = stop.address ? stop.address.split(',')[0].replace(/'/g, "\\\\'") : '';
      const stopHtml = \`
        <div class="pin-wrapper" onclick="window.ReactNativeWebView.postMessage('\${stop.id}')">
          <div class="pin-bubble">\${idx + 1}</div>
          <div class="pin-triangle"></div>
          <div class="pin-label">\${stopName}<br/><span style="font-size:7px;color:#a1a1aa">\${stopAddr}</span></div>
        </div>
      \`;
      const stopIcon = L.divIcon({ html: stopHtml, className: 'custom-div-icon', iconSize: [0,0], iconAnchor: [0,0] });
      const marker = L.marker([lat, lng], { icon: stopIcon }).addTo(map);
      destMarkers.push(marker);
      routeCoords.push([lat, lng]);
    });

    const selfHtml = \`<div class="self-location"><div class="self-badge"><div class="self-badge-dot"></div></div></div>\`;
    const selfIcon = L.divIcon({ html: selfHtml, className: 'custom-div-icon', iconSize: [0,0], iconAnchor: [24,24] });

    let selfMarker = null;
    let routeLayer = null;
    let currentLat = null;
    let currentLng = null;
    let isFetchingRoute = false;

    if (destMarkers.length > 0) {
      const group = new L.featureGroup(destMarkers);
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
    } else {
      map.setView([${destLat !== 0 ? destLat : fallbackLat}, ${destLng !== 0 ? destLng : fallbackLng}], 14);
    }

    async function fetchAndDrawRoute(coords) {
      if (coords.length < 2 || isFetchingRoute) return;
      isFetchingRoute = true;
      const coordString = coords.map(c => c[1] + ',' + c[0]).join(';');
      const url = 'https://router.project-osrm.org/route/v1/driving/' + coordString + '?overview=full&geometries=geojson';
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const geojson = data.routes[0].geometry;
          if (routeLayer) map.removeLayer(routeLayer);
          routeLayer = L.geoJSON(geojson, {
            style: { color: '#1d4ed8', weight: 5, opacity: 0.8 }
          }).addTo(map);
        }
      } catch (err) {
        console.error('Routing error:', err);
        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.polyline(coords, { color: '#1d4ed8', weight: 4, dashArray: '10, 5' }).addTo(map);
      }
      setTimeout(() => { isFetchingRoute = false; }, 5000); // Prevent fetching more than once per 5 seconds
    }

    let hasTrackedUser = false;

    window.updateLocation = function(lat, lng) {
      currentLat = lat;
      currentLng = lng;
      const fullRoute = [[lat, lng], ...routeCoords];
      
      if(!selfMarker) {
        selfMarker = L.marker([lat, lng], { icon: selfIcon }).addTo(map);
      } else {
        selfMarker.setLatLng([lat, lng]);
      }
      
      fetchAndDrawRoute(fullRoute);
      
      if (!hasTrackedUser) {
        hasTrackedUser = true;
        // First time tracking starts, zoom in closely to the user (street level)
        map.setView([lat, lng], 17);
      } else {
        // Smoothly follow the user's location
        map.panTo([lat, lng]);
      }
    };

    window.centerMap = function() {
      if(currentLat && currentLng) {
        map.setView([currentLat, currentLng], 16);
      }
    };
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>

      {/* ── PREMIUM REAL MAP CANVAS (OpenStreetMap — No API Key) ── */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHTML, baseUrl: '' }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          style={[{ flex: 1, backgroundColor: 'transparent' }]}
          scrollEnabled={false}
          onMessage={(event) => {
            const id = event.nativeEvent.data;
            if (id && Array.isArray(allStops)) {
              const clickedStop = allStops.find((s: any) => s.id === id);
              if (clickedStop) {
                navigation.setParams({ selectedCase: clickedStop, allStops });
              }
            }
          }}
        />

        {/* ── SIDE CONTROLS ── */}
        <View style={styles.sideControls}>
          <TouchableOpacity style={styles.sideBtn} onPress={centerMap}>
            <Compass size={20} color="#1d4ed8" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideBtn} onPress={() => Alert.alert('Layers', 'Switching map layers...')}>
            <Layers size={20} color="#1d4ed8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── GLASSMORPHISM HEADER ── */}
      <View style={styles.header}>
        <SafeAreaView />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <ArrowLeft size={18} color="#1e3a8a" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerLiveRow}>
              {navStarted && <View style={styles.liveDot} />}
              <Text style={styles.headerLabel}>{navStarted ? 'LIVE TRACKING' : 'NAVIGATION'}</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedCase.address ? selectedCase.address.split(',')[0] : 'Route'}
            </Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => Alert.alert('Options', 'More options coming soon')}>
            <MoreVertical size={18} color="#1e3a8a" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── PREMIUM STOPS PANEL (Commented out per user request) ── */}
      {/*
      <View style={styles.stopsPanel}>
        <TouchableOpacity style={styles.stopsPanelHeader} onPress={toggleStops} activeOpacity={0.9}>
          <View style={styles.stopsPanelLeft}>
            <View style={styles.stopsIconBox}>
              <List size={14} color="#fff" />
            </View>
            <View>
              <Text style={styles.stopsPanelTitle}>
                {stopsList.length} Stop{stopsList.length !== 1 ? 's' : ''} on Route
              </Text>
              <Text style={styles.stopsPanelSub}>
                {completedCount} done · {stopsList.length - completedCount} remaining
              </Text>
            </View>
          </View>
          <View style={styles.stopsPanelRight}>
            {navStarted && (
              <View style={styles.liveBadge}>
                <View style={styles.liveBadgeDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            )}
            <View style={styles.chevronBox}>
              {stopsOpen
                ? <ChevronDown size={15} color="#1d4ed8" />
                : <ChevronUp size={15} color="#1d4ed8" />
              }
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: \`\${progressPct}%\` as any }]} />
        </View>

        {stopsOpen && (
          <ScrollView style={styles.stopsScrollView} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {stopsList.map((stop, idx) => {
              const isCurrent = stop.status === 'current';
              const isDone = stop.status === 'completed' || stop.status === 'done';
              const initials = getInitials(stop.applicantName);
              return (
                <View key={stop.id + idx}>
                  <View style={[styles.stopItem, isCurrent && styles.stopItemCurrent]}>
                    <View style={[
                      styles.stopAvatar,
                      isCurrent && styles.stopAvatarCurrent,
                      isDone && styles.stopAvatarDone,
                    ]}>
                      {isDone
                        ? <CheckCircle size={15} color="white" />
                        : <Text style={[styles.stopAvatarText, isCurrent && { color: '#fff' }]}>{initials}</Text>
                      }
                    </View>

                    {idx < stopsList.length - 1 && (
                      <View style={[styles.stopConnector, isDone && styles.stopConnectorDone]} />
                    )}

                    <View style={styles.stopInfo}>
                      <View style={styles.stopTopRow}>
                        <Text style={[styles.stopName, isCurrent && styles.stopNameCurrent]} numberOfLines={1}>
                          {stop.applicantName}
                        </Text>
                        {isCurrent && (
                          <View style={styles.currentTag}>
                            <Text style={styles.currentTagText}>NOW</Text>
                          </View>
                        )}
                        {isDone && (
                          <View style={styles.doneTag}>
                            <Text style={styles.doneTagText}>DONE</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.stopAddrRow}>
                        <MapPin size={10} color={isCurrent ? '#1d4ed8' : '#94a3b8'} />
                        <Text style={[styles.stopAddr, isCurrent && styles.stopAddrCurrent]} numberOfLines={1}>
                          {stop.address}
                        </Text>
                      </View>
                    </View>

                    {!isCurrent && !isDone && (
                      <TouchableOpacity
                        style={styles.stopGoBtn}
                        // Changed from navigation.push to navigation.setParams as requested
                        onPress={() => navigation.setParams({ selectedCase: stop, allStops })}
                      >
                        <Navigation2 size={12} color="white" style={{ marginRight: 4 }} />
                        <Text style={styles.stopGoText}>GO</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>
        )}
      </View>
      */}

      {/* ── PREMIUM BOTTOM CARD ── */}
      <View style={styles.bottomCard}>
        {/* Top info row */}
        <View style={styles.cardTop}>
          {/* ETA block */}
          <View style={styles.etaBlock}>
            <View style={styles.etaIconRow}>
              <Clock size={12} color="#1d4ed8" />
              <Text style={styles.etaLabel}>ETA</Text>
            </View>
            <Text style={styles.etaValue}>{dynamicEta} min</Text>
            <Text style={styles.distValue}>{dynamicDistance.toFixed(1)} km</Text>
          </View>

          {/* Divider */}
          <View style={styles.cardDividerV} />

          {/* Applicant info */}
          <View style={styles.applicantBlock}>
            <Text style={styles.applicantLabel}>DESTINATION</Text>
            <Text style={styles.applicantName} numberOfLines={1}>
              {selectedCase.applicantName || selectedCase.applicant_name || 'Applicant'}
            </Text>
            <Text style={styles.applicantAddr} numberOfLines={1}>
              {selectedCase.address ? selectedCase.address.split(',')[0] : 'Address'}
            </Text>
          </View>

          {/* Avatar */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {getInitials(selectedCase.applicantName || selectedCase.applicant_name || '?')}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.navBtn, navStarted && styles.navBtnRecalc, recalculating && styles.navBtnDisabled]}
            onPress={handleStartNav}
            disabled={recalculating}
          >
            <Zap size={15} color="white" />
            <Text style={styles.navBtnText}>
              {recalculating ? 'Recalculating...' : navStarted ? 'Recalculate Route' : 'Start Navigation'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.callBtn} onPress={makePhoneCall}>
            <Phone size={15} color="#1d4ed8" />
            <Text style={styles.callBtnText} numberOfLines={1}>
              {/* OLD CODE:
              {selectedCase.phoneNumber && selectedCase.phoneNumber !== 'N/A'
                ? selectedCase.phoneNumber
                : selectedCase.applicant_phone && selectedCase.applicant_phone !== 'N/A'
                  ? selectedCase.applicant_phone
                  : 'Call'}
              */}
              {validPhoneNumber ? validPhoneNumber : 'Call'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── GPS TOAST ── */}
      {showToast && (
        <View style={styles.toast}>
          <CheckCircle size={14} color="#22c55e" />
          <Text style={styles.toastText}>
            {navStarted && !recalculating ? '● GPS Connected — Live tracking active' : '↻ Route updated for traffic'}
          </Text>
        </View>
      )}
    </View>
  );
}

const BRAND = '#1d4ed8';
const BRAND_LIGHT = '#eff6ff';
const BRAND_DARK = '#1e3a8a';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef4fb' },

  // ── MAP ──
  mapContainer: { flex: 1, backgroundColor: '#eef4fb' },
  svgContainer: { ...StyleSheet.absoluteFill },

  // ── HEADER ──
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 50,
    paddingTop: Platform.OS === 'android' ? 16 : 0,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(209,221,237,0.6)',
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 40, height: 40,
    backgroundColor: BRAND_LIGHT,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    elevation: 2,
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  headerLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  headerLabel: { fontSize: 8, fontWeight: '800', color: BRAND, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { fontSize: 9, fontWeight: '800', color: BRAND_DARK },

  // ── SELF LOCATION ──
  selfLocation: { alignItems: 'center', justifyContent: 'center' },
  selfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND_DARK,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
    elevation: 4,
  },
  selfBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  selfBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  pulseOuter: {
    width: 44, height: 44,
    backgroundColor: 'rgba(29,78,216,0.12)',
    borderRadius: 22,
    position: 'absolute',
    bottom: -14,
  },
  pulseInner: {
    width: 28, height: 28,
    backgroundColor: 'rgba(29,78,216,0.22)',
    borderRadius: 14,
    position: 'absolute',
    bottom: -6,
  },
  dot: {
    width: 18, height: 18,
    backgroundColor: BRAND,
    borderWidth: 3,
    borderColor: 'white',
    borderRadius: 9,
    elevation: 6,
  },

  // ── DESTINATION ──
  destMarker: { alignItems: 'center' },
  destBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
    elevation: 5,
    maxWidth: 130,
  },
  destBadgeText: { color: 'white', fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },
  destShadow: {
    width: 20,
    height: 6,
    backgroundColor: 'rgba(220,38,38,0.25)',
    borderRadius: 10,
    marginTop: -4,
  },

  // ── SIDE CONTROLS ──
  sideControls: { position: 'absolute', right: 14, bottom: 340, gap: 0 },
  sideBtn: {
    width: 46, height: 46,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e9f7',
  },

  // ── STOPS PANEL ──
  stopsPanel: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 226 : 222,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    elevation: 12,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    maxHeight: 360,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8f0fe',
  },
  stopsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stopsPanelLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stopsIconBox: {
    width: 30, height: 30,
    backgroundColor: BRAND,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopsPanelTitle: { fontSize: 9, fontWeight: '800', color: '#1e293b' },
  stopsPanelSub: { fontSize: 8, color: '#94a3b8', fontWeight: '600', marginTop: 1 },
  stopsPanelRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  liveBadgeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#16a34a' },
  liveBadgeText: { fontSize: 8, fontWeight: '800', color: '#16a34a', letterSpacing: 0.5 },
  chevronBox: {
    width: 28, height: 28,
    backgroundColor: BRAND_LIGHT,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: { height: 3, backgroundColor: '#f1f5f9', marginHorizontal: 14 },
  progressFill: { height: 3, backgroundColor: BRAND, borderRadius: 2 },
  stopsScrollView: { maxHeight: 260 },

  // Stop items
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  stopItemCurrent: { backgroundColor: '#f0f6ff' },
  stopAvatar: {
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
    zIndex: 2,
  },
  stopAvatarCurrent: { backgroundColor: BRAND },
  stopAvatarDone: { backgroundColor: '#22c55e' },
  stopAvatarText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  stopConnector: {
    position: 'absolute',
    left: 28,
    top: 48,
    width: 2,
    height: 22,
    backgroundColor: '#e2e8f0',
    zIndex: 1,
  },
  stopConnectorDone: { backgroundColor: '#22c55e' },
  stopInfo: { flex: 1 },
  stopTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  stopName: { fontSize: 9, fontWeight: '700', color: '#334155', flex: 1 },
  stopNameCurrent: { color: BRAND_DARK, fontWeight: '800' },
  currentTag: {
    backgroundColor: BRAND,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentTagText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  doneTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doneTagText: { fontSize: 8, fontWeight: '900', color: '#16a34a', letterSpacing: 0.5 },
  stopAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stopAddr: { fontSize: 9, color: '#94a3b8', flex: 1 },
  stopAddrCurrent: { color: '#3b82f6', fontWeight: '600' },
  stopGoBtn: {
    width: 34, height: 34,
    borderRadius: 10,
    backgroundColor: BRAND_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginLeft: 8,
    flexShrink: 0,
  },

  // ── BOTTOM CARD ──
  bottomCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 18,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 22,
    elevation: 20,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#e8f0fe',
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  etaBlock: { alignItems: 'center', minWidth: 68 },
  etaIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  etaLabel: { fontSize: 8, fontWeight: '800', color: BRAND, letterSpacing: 0.8, textTransform: 'uppercase' },
  etaValue: { fontSize: 18, fontWeight: '900', color: BRAND_DARK, lineHeight: 28 },
  distValue: { fontSize: 9, fontWeight: '700', color: '#94a3b8', marginTop: 1 },
  cardDividerV: { width: 1, height: 52, backgroundColor: '#e8f0fe' },
  applicantBlock: { flex: 1 },
  applicantLabel: { fontSize: 8, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 2 },
  applicantName: { fontSize: 10, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  applicantAddr: { fontSize: 9, color: '#64748b', fontWeight: '500' },
  avatarCircle: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  avatarInitials: { fontSize: 10, fontWeight: '900', color: '#fff' },

  cardDivider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 16 },

  cardActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    paddingTop: 12,
  },
  navBtn: {
    flex: 1,
    height: 50,
    backgroundColor: BRAND,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
  },
  navBtnRecalc: { backgroundColor: '#0369a1' },
  navBtnDisabled: { opacity: 0.7 },
  navBtnText: { color: 'white', fontWeight: '800', fontSize: 9 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    height: 50,
    backgroundColor: BRAND_LIGHT,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 14,
  },
  callBtnText: { color: BRAND, fontSize: 10, fontWeight: '800', maxWidth: 100 },

  // ── TOAST ──
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    left: 20, right: 20,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 20,
  },
  toastText: { color: 'white', fontSize: 10, fontWeight: '700' },
});
