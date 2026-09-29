import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Dimensions, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert, ImageBackground } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Search, Mic, MapPin, Compass, Layers } from 'lucide-react-native';
import { useGetLocationsQuery } from '../../Redux/api/mapApi';
import { useGetAssignedAssignmentsQuery } from '../../Redux/api';
import { useAuth } from '../../contexts/AuthContext';
import WebView from 'react-native-webview';

const { width, height } = Dimensions.get('window');

export default function MapOverviewScreen({ navigation }: any) {
  const { user } = useAuth();
  const rawAssigneeId = user?.id || user?.user?.id || user?.data?.id || user?.user_id;
  const assigneeId = rawAssigneeId?.toString();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite'>('standard');
  const [geocodedCache, setGeocodedCache] = useState<Record<string, { lat: number, lng: number }>>({});

  const { data: casesData, isLoading, isFetching, refetch } = useGetAssignedAssignmentsQuery({ assignee_id: assigneeId }, { skip: !assigneeId });
  const { data: locationsData } = useGetLocationsQuery();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const casesArray = Array.isArray(casesData) ? casesData : ((casesData as any)?.data || []);
  const locationsArray = Array.isArray(locationsData) ? locationsData : ((locationsData as any)?.data || []);

  useEffect(() => {
    const fetchGeocodes = async () => {
      const missingLocs = new Set<string>();

      casesArray.forEach((c: any) => {
        if (!c.lat && !c.gps_lat && !c.location_coordinates && c.location) {
          const locName = c.location.toLowerCase().trim();
          if (!geocodedCache[locName]) missingLocs.add(locName);
        }
      });

      locationsArray.forEach((l: any) => {
        if (l.location_name && !l.lat) {
          const locName = l.location_name.toLowerCase().trim();
          if (!geocodedCache[locName]) missingLocs.add(locName);
        }
      });

      if (missingLocs.size === 0) return;

      const newCache = { ...geocodedCache };
      let updated = false;

      for (const loc of missingLocs) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc + ', West Bengal, India')}`);
          const data = await res.json();
          if (data && data.length > 0) {
            newCache[loc] = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            updated = true;
          }
        } catch (err) {
          console.log("Geocoding failed for", loc);
        }
      }

      if (updated) {
        setGeocodedCache(newCache);
      }
    };

    fetchGeocodes();
  }, [casesArray, locationsArray]);

  const extractCoords = (c: any, index: number = 0) => {
    let lat = parseFloat(c.lat || c.gps_lat || c.field_report?.gps_lat);
    let lng = parseFloat(c.lng || c.gps_lng || c.field_report?.gps_lng);

    if ((isNaN(lat) || isNaN(lng)) && c.location_coordinates) {
      try {
        const parsed = typeof c.location_coordinates === 'string' ? JSON.parse(c.location_coordinates) : c.location_coordinates;
        if (parsed && parsed.lat != null) {
          lat = parseFloat(parsed.lat);
          lng = parseFloat(parsed.lng);
        }
      } catch (e) { }
    }

    if (isNaN(lat) || isNaN(lng)) {
      if (c.location) {
        const locName = c.location.toLowerCase().trim();
        const loc = locationsArray.find((l: any) => l.location_name && l.location_name.toLowerCase().trim() === locName);

        if (loc && loc.lat != null && loc.lng != null) {
          lat = parseFloat(loc.lat);
          lng = parseFloat(loc.lng);
        } else if (geocodedCache[locName]) {
          lat = geocodedCache[locName].lat;
          lng = geocodedCache[locName].lng;
        } else {
          // Absolute fallback if everything fails or is still loading
          if (locName.includes('kolkata')) { lat = 22.5726; lng = 88.3639; }
          else if (locName.includes('saltlake') || locName.includes('salt lake')) { lat = 22.5867; lng = 88.4137; }
          else if (locName.includes('bigannagar') || locName.includes('bidhannagar')) { lat = 22.5867; lng = 88.4137; }
        }
      }
    }

    // FORCE KOLKATA: If coordinates are still NaN or outside West Bengal, force them to Kolkata
    if (isNaN(lat) || isNaN(lng) || lat < 21 || lat > 25 || lng < 86 || lng > 90) {
      lat = 22.5726;
      lng = 88.3639;
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      const numId = parseInt(c.id) || index;
      
      // If this is the forced Kolkata default coordinate, spread them out widely across the city (~8km radius)
      if (Math.abs(lat - 22.5726) < 0.0001 && Math.abs(lng - 88.3639) < 0.0001) {
        lat = lat + (Math.sin(numId * 47) * 0.08);
        lng = lng + (Math.cos(numId * 31) * 0.08);
      } else {
        // Normal tiny jitter for actual same coordinates
        lat = lat + (Math.sin(numId * 10) * 0.0002);
        lng = lng + (Math.cos(numId * 10) * 0.0002);
      }
    }

    return { lat, lng };
  };

  // Old code (commented out as requested by user):
  // const validCases = casesArray.filter((c: any, index: number) => {
  //   const { lat, lng } = extractCoords(c, index);
  //   return !isNaN(lat) && !isNaN(lng);
  // });

  const validCases = casesArray.filter((c: any, index: number) => {
    const isDirectAssignee = c.assignee_id?.toString() === assigneeId;
    const myVerifications = (c.verifications || []).filter((v: any) => v.verifier_id?.toString() === assigneeId);

    // If the user is neither the direct assignee nor a verifier, hide it
    if (!isDirectAssignee && myVerifications.length === 0) {
      return false;
    }

    // Hide completed/submitted cases from map
    const isCompletedByVerifications = myVerifications.length > 0 && myVerifications.every((v: any) => v.status === 'completed' || v.status === 'submitted');
    const statusStr = (c.status || '').toLowerCase();
    const isCaseCompleted = statusStr === 'completed' || statusStr === 'submitted' || statusStr === 'done';

    if (isCompletedByVerifications || isCaseCompleted) {
      return false;
    }

    const { lat, lng } = extractCoords(c, index);
    return !isNaN(lat) && !isNaN(lng);
  });

  const dynamicPins = validCases.map((c: any, index: number) => {
    const { lat, lng } = extractCoords(c, index);

    return {
      id: c.id?.toString(),
      num: index + 1,
      name: c.applicant_name,
      lat: lat,
      lng: lng,
      case_no: c.case_no,
      address: c.location,
      phoneNumber: c.applicant_phone,
      fullData: c
    };
  }).filter((p: any) => !isNaN(p.lat) && !isNaN(p.lng));

  const filteredPins = dynamicPins.filter((p: any) =>
    (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.case_no && p.case_no.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
    .pin-wrapper { position: absolute; align-items: center; display: flex; flex-direction: column; transform: translate(-50%, -100%); cursor: pointer; }
    .pin-bubble { width: 24px; height: 24px; background-color: #003d9b; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); color: white; font-size: 10px; font-weight: 900; font-family: sans-serif; }
    .pin-triangle { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 6px solid #003d9b; margin-top: -1px; }
    .pin-label { margin-top: 2px; font-size: 10px; font-weight: 600; color: #3f3f46; background: rgba(255,255,255,0.8); padding: 0 4px; border-radius: 4px; font-family: sans-serif; text-align: center; white-space: nowrap; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { 
      zoomControl: false, 
      attributionControl: false
    });
    L.tileLayer('${mapLayer === 'standard' ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'}', { maxZoom: 19 }).addTo(map);

    const pins = ${JSON.stringify(filteredPins)};
    const markers = [];

    pins.forEach(pin => {
      const addressText = pin.address ? pin.address.split(',').slice(0, 2).join(',').replace(/'/g, "\\'") : '';
      const iconHtml = \`
        <div class="pin-wrapper" onclick="window.ReactNativeWebView.postMessage('\${pin.id}')">
          <div class="pin-bubble">\${pin.num}</div>
          <div class="pin-triangle"></div>
          <div class="pin-label">\${pin.name ? pin.name.split(' ')[0] : pin.case_no}<br/><span style="font-size:7px;color:#a1a1aa">\${addressText}</span></div>
        </div>
      \`;
      const customIcon = L.divIcon({ html: iconHtml, className: 'custom-div-icon', iconSize: [0, 0], iconAnchor: [0, 0] });
      markers.push(L.marker([pin.lat, pin.lng], { icon: customIcon }).addTo(map));
    });

    if (markers.length > 0) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [50, 50] });
    } else {
      map.setView([22.5726, 88.3639], 12);
    }
  </script>
</body>
</html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        {/* Search and Voice toggler header overlay */}
        <View style={styles.headerOverlay}>
          <View style={styles.searchBox}>
            <Search size={18} color="#a1a1aa" style={styles.iconMargin} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customer or location..."
              placeholderTextColor="#a1a1aa"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity>
              <Mic size={16} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          {/* View Mode Map / List Toggler */}
          <View style={styles.togglerRow}>
            <View style={styles.togglerContainer}>
              <TouchableOpacity
                onPress={() => setViewMode('map')}
                style={[styles.togglerBtn, viewMode === 'map' && styles.togglerBtnActive]}
              >
                <Text style={[styles.togglerBtnText, viewMode === 'map' && styles.togglerBtnTextActive]}>Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode('list')}
                style={[styles.togglerBtn, viewMode === 'list' && styles.togglerBtnActive]}
              >
                <Text style={[styles.togglerBtnText, viewMode === 'list' && styles.togglerBtnTextActive]}>List View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Map Background Canvas */}
        <View style={[styles.mapContainer, { backgroundColor: '#d4d4d8' }]}>
          {viewMode === 'map' && (
            <WebView
              originWhitelist={['*']}
              source={{ html: leafletHTML }}
              style={[styles.mapBg, { width: width, height: 800, backgroundColor: 'transparent' }]}
              scrollEnabled={false}
              onMessage={(event) => {
                const pinId = event.nativeEvent.data;
                const pin = filteredPins.find((p: any) => p.id === pinId);
                if (pin) {
                  const selectedCaseData = {
                    ...pin.fullData,
                    id: pin.id,
                    applicantName: pin.name,
                    address: pin.address,
                    phoneNumber: pin.phoneNumber || 'N/A',
                    lat: pin.lat,
                    lng: pin.lng
                  };
                  const allStops = filteredPins.map((p: any) => ({
                    id: p.id,
                    applicantName: p.name,
                    address: p.address,
                    phoneNumber: p.phoneNumber || 'N/A',
                    lat: p.lat,
                    lng: p.lng,
                    status: p.fullData?.status || 'pending',
                  }));
                  navigation.navigate('NavigationMapScreen', { selectedCase: selectedCaseData, allStops });
                }
              }}
            />
          )}

          {(isLoading || isFetching) && (
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.4)', zIndex: 999 }]}>
              <ActivityIndicator size="large" color="#003d9b" />
            </View>
          )}

          {viewMode === 'list' && !isLoading && (
            <View style={styles.listWrapper}>
              <ScrollView
                contentContainerStyle={styles.listViewContainer}
                showsVerticalScrollIndicator={false}
              >
                {filteredPins.map((pin: any) => (
                  <TouchableOpacity
                    key={pin.id}
                    style={styles.listItem}
                    onPress={() => {
                      const selectedCaseData = {
                        ...pin.fullData,
                        id: pin.id,
                        applicantName: pin.name,
                        address: pin.address,
                        phoneNumber: pin.phoneNumber || 'N/A',
                        lat: pin.lat,
                        lng: pin.lng
                      };
                      // Build allStops for list view too
                      const allStops = filteredPins.map((p: any) => ({
                        id: p.id,
                        applicantName: p.name,
                        address: p.address,
                        phoneNumber: p.phoneNumber || 'N/A',
                        lat: p.lat,
                        lng: p.lng,
                        status: p.fullData?.status || 'pending',
                      }));
                      navigation.navigate('NavigationMapScreen', { selectedCase: selectedCaseData, allStops });
                    }}
                  >
                    <MapPin size={20} color="#003d9b" style={{ marginRight: 12 }} />
                    <View>
                      <Text style={styles.listName}>{pin.name || pin.case_no}</Text>
                      <Text style={styles.listCoords}>{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom Actions */}
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={styles.circleBtn}
              onPress={() => Alert.alert('Compass', 'Centering map to your current GPS location...')}
            >
              <Compass size={20} color="#3f3f46" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.circleBtn}
              onPress={() => setMapLayer(prev => prev === 'standard' ? 'satellite' : 'standard')}
            >
              <Layers size={20} color={mapLayer === 'satellite' ? '#003d9b' : '#3f3f46'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  headerOverlay: { position: 'absolute', top: Platform.OS === 'android' ? 36 : 16, left: 16, right: 16, zIndex: 20, gap: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', height: 48, borderRadius: 12, paddingHorizontal: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: '#e4e4e7' },
  iconMargin: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 10, fontWeight: '600', color: '#27272a', height: '100%' },

  togglerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  togglerContainer: { flexDirection: 'row', backgroundColor: 'rgba(228,228,231,0.9)', borderRadius: 24, padding: 4, elevation: 2 },
  togglerBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  togglerBtnActive: { backgroundColor: '#003d9b', elevation: 1 },
  togglerBtnText: { fontSize: 10, fontWeight: 'bold', color: '#52525b' },
  togglerBtnTextActive: { color: 'white' },

  mapContainer: { flex: 1, minHeight: 700, backgroundColor: '#d4d4d8', position: 'relative', overflow: 'hidden' },
  mapBg: { ...StyleSheet.absoluteFill, opacity: 0.85 },

  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBubble: { width: 24, height: 24, backgroundColor: '#003d9b', borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 4, borderWidth: 2, borderColor: 'white' },
  pinBubbleText: { color: 'white', fontSize: 8, fontWeight: '900' },
  pinTriangle: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#003d9b', marginTop: -1 },
  pinLabel: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 8, fontWeight: '800', color: '#18181b', marginTop: 4, overflow: 'hidden' },

  listWrapper: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.95)' },
  listViewContainer: { paddingTop: 100, paddingHorizontal: 16, paddingBottom: 100, marginTop: 40 },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderRadius: 12, marginBottom: 8, elevation: 1, borderWidth: 1, borderColor: '#f4f4f5' },
  listName: { fontSize: 10, fontWeight: 'bold', color: '#18181b' },
  listCoords: { fontSize: 8, color: '#71717a', marginTop: 2 },

  bottomControls: { position: 'absolute', right: 16, bottom: 20, gap: 12 },
  circleBtn: { width: 48, height: 48, backgroundColor: 'white', borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 4 }
});
