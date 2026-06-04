import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  BackHandler,
  Image,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Modal,Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { WebView } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { createAppStyles } from '../App.styles';
import { RootStackParamList } from '../types';
const { height } = Dimensions.get('window');
const quickActionGradientColors = ['#D7C5FF', '#A670EE', '#6D2DE1'] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'BusManagerDashboard'>;

type BusRoute = {
  id: number;
  routeName: string;
  origin: string | null;
  destination: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  busStartingTime: string | null;
  driverExperience: string | null;
  createdAt?: string | null;
};

type StudentItem = {
  username: string;
  name: string;
  address: string | null;
  className: string | null;
  section: string | null;
  assignedRouteId: number | null;
  assignedRouteName: string | null;
  isDisabled?: boolean;
};

type SectionKey = 'overview' | 'routes' | 'students';

type DashboardCard = {
  title: string;
  subtitle: string;
  icon: string;
  target: SectionKey;
  accent: string;
};

type BusProfile = {
  username: string;
  name: string;
  designation: string;
  schoolCode: string;
  userType: string;
};

type RouteMapPoint = {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
};

type RouteMapRoute = {
  routeId: number;
  routeName: string;
  point: RouteMapPoint | null;
  routeLabel: string;
  accent: string;
};

const extractAddressContext = (address: string) => {
  const parts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const city = parts.length >= 2 ? parts[parts.length - 2] : '';
  const state = parts.length >= 1 ? parts[parts.length - 1] : '';

  return [city, state].filter(Boolean).join(', ');
};

const buildRouteMapHtml = (
  schoolPoint: RouteMapPoint | null,
  routes: RouteMapRoute[]
) => {
  const payload = {
    schoolPoint,
    routes,
  };

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body, #map {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #F5F8FB;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .leaflet-container {
        background: #F5F8FB;
      }
      .popup-title {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .popup-subtitle {
        font-size: 11px;
        color: #555;
      }
      .bus-marker {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #FFFFFF;
        border: 2px solid #1C1C1C;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);
        font-size: 18px;
        line-height: 1;
      }
      .route-dot {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: #FFFFFF;
        border: 4px solid var(--route-color, #3C7BF4);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      }
      .school-dot {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: #1C1C1C;
        border: 3px solid #FFFFFF;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
      }
    </style>
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function () {
        const data = ${JSON.stringify(payload)};
        const map = L.map('map', { zoomControl: true, attributionControl: true });
        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        const bounds = [];
        const colors = ['#E05A47', '#3C7BF4', '#2E8B57', '#9B59B6', '#D68910', '#117A65', '#34495E', '#C0392B'];
        const routeCount = Math.max(data.routes.length, 1);
        const baseLat = data.schoolPoint ? data.schoolPoint.latitude : 17.385; // Hyderabad fallback
        const baseLng = data.schoolPoint ? data.schoolPoint.longitude : 78.4867;
        const radiusStep = 0.02;

        const school = data.schoolPoint || {
          latitude: baseLat,
          longitude: baseLng,
          title: 'Institute',
          description: 'Institute',
        };

        L.circleMarker([school.latitude, school.longitude], {
          radius: 13,
          color: '#FFFFFF',
          weight: 4,
          fillColor: '#1C1C1C',
          fillOpacity: 1,
        }).addTo(map);
        L.marker([school.latitude, school.longitude], {
          icon: L.divIcon({
            className: '',
            html: '<div class="school-dot"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(map).bindPopup(
          '<div class="popup-title">Institute</div><div class="popup-subtitle">' +
            (school.title || school.description || 'School') +
            '</div>'
        );
        bounds.push([school.latitude, school.longitude]);

        data.routes.forEach(function (route, index) {
          const color = route.accent || colors[index % colors.length];
          const angle = (index / routeCount) * Math.PI * 2;
          const syntheticPoint = {
            latitude: baseLat + Math.sin(angle) * radiusStep * (1 + index * 0.2),
            longitude: baseLng + Math.cos(angle) * radiusStep * (1 + index * 0.2),
          };
          const point = route.point || syntheticPoint;
          const routeName = route.routeName || ('Route ' + (index + 1));
          const routeMeta = route.routeLabel || 'Route stop';

          L.circleMarker([point.latitude, point.longitude], {
            radius: 14,
            color: color,
            weight: 4,
            fillColor: '#FFFFFF',
            fillOpacity: 1,
          }).addTo(map);
          const marker = L.marker([point.latitude, point.longitude], {
            icon: L.divIcon({
              className: '',
              html: '<div class="bus-marker">🚌</div>',
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            }),
          }).addTo(map);
          marker.bindPopup(
            '<div class="popup-title">' +
              routeName +
              '</div><div class="popup-subtitle">' +
              routeMeta +
              '</div>'
          );
          L.polyline(
            [
              [school.latitude, school.longitude],
              [point.latitude, point.longitude],
            ],
            {
              color: '#1C1C1C',
              weight: 12,
              opacity: 0.96,
              lineCap: 'round',
              lineJoin: 'round',
            }
          ).addTo(map);
          L.polyline(
            [
              [school.latitude, school.longitude],
              [point.latitude, point.longitude],
            ],
            {
              color: color,
              weight: 7,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            }
          ).addTo(map);
          bounds.push([point.latitude, point.longitude]);
        });

        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [28, 28] });
        } else {
          map.setView([baseLat, baseLng], 13);
        }
      })();
    </script>
  </body>
</html>`;
};

const API_BASE = 'http://162.215.210.38:3010/api';
const logoImage = require('../assets/Cleezo.png');
const DEBUG_BUS_MANAGER = true;

const dashboardCards: DashboardCard[] = [
  {
    title: 'Activate Driver',
    subtitle: 'Enable the current driver',
    icon: 'person-add-outline',
    target: 'routes',
    accent: '#EDF3E8',
  },
  {
    title: 'Assign Route',
    subtitle: 'Create or choose a route',
    icon: 'bus-outline',
    target: 'routes',
    accent: '#EEF2F8',
  },
  {
    title: 'Assign Driver',
    subtitle: 'Attach driver details',
    icon: 'id-card-outline',
    target: 'routes',
    accent: '#F2EEE9',
  },
  {
    title: 'Students',
    subtitle: 'Assign and unassign',
    icon: 'people-outline',
    target: 'students',
    accent: '#F3EEF8',
  },
  {
    title: 'Bus Starting Time',
    subtitle: 'Set route departure time',
    icon: 'time-outline',
    target: 'routes',
    accent: '#ECF5F7',
  },
  {
    title: 'Expense',
    subtitle: 'Record bus expenses',
    icon: 'card-outline',
    target: 'routes',
    accent: '#F7F2E7',
  },
];

const parentDashboardCardStyles = StyleSheet.create({
  cardWrapper: {
    width: 182,
    minHeight: 128,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginRight: 10,
    marginBottom: 12,
    overflow: 'visible',
  },
  card: {
    width: '100%',
    minHeight: 128,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#D8DDE6',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  cardActive: {
    borderColor: '#B59BF4',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  cardContent: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    paddingTop: 0,
    height: 158,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 14,
    textAlign: 'right',
    fontWeight: '800',
    color: '#222222',
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 0,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'right',
    color: '#6C6C74',
    fontWeight: '600',
    marginTop: 4,
    paddingHorizontal: 4,
  },
});

const normalizeText = (value: string | null | undefined) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getRouteTokens = (value: string | null | undefined) =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3);

const isSameAddress = (first: string | null | undefined, second: string | null | undefined) => {
  const firstNormalized = normalizeText(first);
  const secondNormalized = normalizeText(second);

  return Boolean(firstNormalized && secondNormalized && firstNormalized === secondNormalized);
};

const addressMatchesRoute = (address: string | null | undefined, route: BusRoute | null) => {
  if (!route) return false;

  const normalizedAddress = normalizeText(address);
  if (!normalizedAddress) {
    return false;
  }

  const origin = normalizeText(route.origin);
  const destination = normalizeText(route.destination);

  if (origin && normalizedAddress.includes(origin)) {
    return true;
  }
  if (destination && normalizedAddress.includes(destination)) {
    return true;
  }

  const routeTokens = new Set([...getRouteTokens(route.origin), ...getRouteTokens(route.destination)]);
  const tokenMatch = Array.from(routeTokens).some((token) => normalizedAddress.includes(token));

  return tokenMatch;
};

const StudentSwipeCard: React.FC<{
  student: StudentItem;
  routeName: string;
  onAssign: () => void;
  onDelete: () => void;
  onDisable: () => void | Promise<void>;
  disabled: boolean;
}> = ({ student, routeName, onAssign, onDelete, onDisable, disabled }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const disableTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const clearDisableTimer = useCallback(() => {
    if (disableTimer.current) {
      clearTimeout(disableTimer.current);
      disableTimer.current = null;
    }
  }, []);

  const triggerDisable = useCallback(() => {
    if (longPressTriggered.current) return;
    longPressTriggered.current = true;
    onDisable();
  }, [onDisable]);

  const handlePanMove = useMemo(
    () =>
      Animated.event([null, { dx: pan.x }], {
        useNativeDriver: false,
      }),
    [pan]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 12,
        onPanResponderGrant: () => {
          longPressTriggered.current = false;
          clearDisableTimer();
          disableTimer.current = setTimeout(() => {
            triggerDisable();
          }, 350);
        },
        onPanResponderMove: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8) {
            clearDisableTimer();
          }
          handlePanMove(_, gestureState);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
          clearDisableTimer();
          disableTimer.current = null;

          if (longPressTriggered.current) {
            pan.setValue({ x: 0, y: 0 });
            return;
          }

          if (gestureState.dx > 90) {
            Animated.spring(pan, {
              toValue: { x: 140, y: 0 },
              useNativeDriver: false,
            }).start(() => {
              onAssign();
              pan.setValue({ x: 0, y: 0 });
            });
            return;
          }

          if (gestureState.dx < -90) {
            Animated.spring(pan, {
              toValue: { x: -140, y: 0 },
              useNativeDriver: false,
            }).start(() => {
              onDelete();
              pan.setValue({ x: 0, y: 0 });
            });
            return;
          }

          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
        onPanResponderTerminate: () => {
          clearDisableTimer();
          disableTimer.current = null;
          pan.setValue({ x: 0, y: 0 });
        },
      }),
    [clearDisableTimer, handlePanMove, onAssign, onDelete, pan, triggerDisable]
  );

  return (
    <Animated.View
      style={[
        localStyles.studentCard,
        disabled && localStyles.studentCardDisabled,
        {
          transform: [
            { translateX: pan.x },
            { translateY: 0 },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={localStyles.studentCardTop}>
        <View style={localStyles.studentTextBlock}>
          <Text style={localStyles.studentName}>{student.name}</Text>
          <Text style={localStyles.studentClass}>
            {[student.className, student.section].filter(Boolean).join(' - ') || 'No class info'}
          </Text>
          {student.address ? <Text style={localStyles.studentAddress}>{student.address}</Text> : null}
        </View>
        <View style={localStyles.routeBadge}>
          <Text style={localStyles.routeBadgeText}>{routeName || 'No route'}</Text>
        </View>
      </View>
      <Text style={localStyles.studentHint}>Swipe right to assign, swipe left to unassign</Text>
    </Animated.View>
  );
};

const BusManagerDashboard: React.FC<Props> = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const shellStyles = useMemo(() => createAppStyles({ phoneWidth, phoneHeight }), [phoneHeight, phoneWidth]);
  const stackFormCards = phoneWidth < 380;

  const [schoolCode, setSchoolCode] = useState('');
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [busStartingTime, setBusStartingTime] = useState('');
  const [driverExperience, setDriverExperience] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
  const [newOrigin, setNewOrigin] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDisabledStudents, setShowDisabledStudents] = useState(false);
  const [showEligibleStudentsPage, setShowEligibleStudentsPage] = useState(false);
  const [showFooterNav] = useState(true);
  const [schoolAddress, setSchoolAddress] = useState('');
  const [routeMapLoading, setRouteMapLoading] = useState(false);
  const [routeMapError, setRouteMapError] = useState<string | null>(null);
  const [routeMapSchoolPoint, setRouteMapSchoolPoint] = useState<RouteMapPoint | null>(null);
  const [routeMapRoutes, setRouteMapRoutes] = useState<RouteMapRoute[]>([]);
  const [profile, setProfile] = useState<BusProfile>({
    username: '',
    name: '',
    designation: '',
    schoolCode: '',
    userType: '',
  });

  const scrollRef = useRef<ScrollView | null>(null);
  const sectionOffsets = useRef<Record<SectionKey, number>>({
    overview: 0,
    routes: 0,
    students: 0,
  });

  const selectedRoute = routes.find((route) => route.id === selectedRouteId) || routes[0] || null;
  const assignedStudentsCount = students.filter((student) => student.assignedRouteId).length;
  const driverCount = routes.filter((route) => route.driverName).length;
  const dashboardCardColumns = useMemo(
    () => [dashboardCards.slice(0, 2), dashboardCards.slice(2, 4), dashboardCards.slice(4, 6)],
    []
  );
  const eligibleStudents = useMemo(
    () => students.filter((student) => addressMatchesRoute(student.address, selectedRoute)),
    [selectedRoute, students]
  );
  const [disabledStudentUsernames, setDisabledStudentUsernames] = useState<string[]>([]);
  const disabledStudentUsernameSet = useMemo(
    () => new Set(disabledStudentUsernames),
    [disabledStudentUsernames]
  );
  const visibleEligibleStudents = useMemo(
    () => eligibleStudents.filter((student) => !disabledStudentUsernameSet.has(student.username)),
    [disabledStudentUsernameSet, eligibleStudents]
  );
  const disabledEligibleStudents = useMemo(
    () => eligibleStudents.filter((student) => disabledStudentUsernameSet.has(student.username)),
    [disabledStudentUsernameSet, eligibleStudents]
  );
  const allDisabledStudents = useMemo(
    () => students.filter((student) => disabledStudentUsernameSet.has(student.username)),
    [disabledStudentUsernameSet, students]
  );
  const routeMapHtml = useMemo(
    () => buildRouteMapHtml(routeMapSchoolPoint, routeMapRoutes),
    [routeMapRoutes, routeMapSchoolPoint]
  );
  const automaticDestination = schoolAddress.trim();

  useEffect(() => {
    if (!automaticDestination) return;
    setNewDestination(automaticDestination);
  }, [automaticDestination]);

  useEffect(() => {
    if (!DEBUG_BUS_MANAGER) return;

    console.log('[BusManagerDashboard] [map] selected route snapshot', {
      selectedRouteId,
      selectedRoute: selectedRoute
        ? {
            id: selectedRoute.id,
            routeName: selectedRoute.routeName,
            origin: selectedRoute.origin,
            destination: selectedRoute.destination,
            vehicleNumber: selectedRoute.vehicleNumber,
            driverName: selectedRoute.driverName,
            busStartingTime: selectedRoute.busStartingTime,
            driverExperience: selectedRoute.driverExperience,
          }
        : null,
      routeCount: routes.length,
      driverCount,
      routeDrivers: routes.map((route) => ({
        id: route.id,
        routeName: route.routeName,
        driverName: route.driverName,
        origin: route.origin,
        destination: route.destination,
      })),
    });
  }, [driverCount, routes, selectedRoute, selectedRouteId]);

  const loadProfile = useCallback(async () => {
    try {
      const [storedUsername, storedName, storedDesignation, storedSchoolCode, storedUserType, storedDetailsRaw] =
        await Promise.all([
          AsyncStorage.getItem('username'),
          AsyncStorage.getItem('name'),
          AsyncStorage.getItem('designation'),
          AsyncStorage.getItem('schoolCode'),
          AsyncStorage.getItem('userType'),
          AsyncStorage.getItem('userDetails'),
        ]);

      const storedDetails = storedDetailsRaw ? JSON.parse(storedDetailsRaw) : {};
      const nextProfile: BusProfile = {
        username: String(storedDetails.username || storedDetails.user_name || storedUsername || ''),
        name: String(storedDetails.name || storedDetails.teacher_name || storedName || ''),
        designation: String(storedDetails.designation || storedDesignation || ''),
        schoolCode: String(storedDetails.schoolCode || storedSchoolCode || ''),
        userType: String(storedDetails.userType || storedUserType || ''),
      };

      setProfile(nextProfile);
    } catch (error) {
    }
  }, []);

  const handleOpenProfilePanel = useCallback(async () => {
    await loadProfile();
    setShowProfile(true);
  }, [loadProfile]);

  const handleLogout = useCallback(async () => {
    try {
      setShowProfile(false);
      await AsyncStorage.multiRemove([
        'userType',
        'username',
        'name',
        'schoolCode',
        'designation',
        'lastScreen',
        'userDetails',
        'fcmToken',
      ]);

      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    } catch (error) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    }
  }, [navigation]);

  const loadSchoolLocation = useCallback(async (normalizedSchoolCode: string) => {
    try {
      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] loading school address', {
          schoolCode: normalizedSchoolCode,
        });
      }
      const addressResponse = await axios.post(`${API_BASE}/school-address`, {
        schoolCode: normalizedSchoolCode,
      });
      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] school address loaded', {
          schoolCode: normalizedSchoolCode,
          instituteAddress: String(addressResponse.data?.institute_address || '').trim(),
        });
      }
      setSchoolAddress(String(addressResponse.data?.institute_address || '').trim());
    } catch (error) {
      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] school address unavailable', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      setSchoolAddress('');
    }
  }, []);

  const geocodeAddress = useCallback(async (address: string) => {
    let cityHint = '';
    let query = String(address || '').trim();

    if (!query) {
      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] geocode skipped: empty address');
      }
      return null;
    }

    if (schoolAddress) {
      cityHint = extractAddressContext(schoolAddress);
      if (cityHint) {
        query = `${query}, ${cityHint}`;
      }
    }

    const trimmedAddress = String(address || '').trim();
    if (DEBUG_BUS_MANAGER) {
      console.log('[BusManagerDashboard] [map] geocode request', {
        address: trimmedAddress,
        biasedQuery: query,
        cityHint: cityHint || null,
      });
    }
    try {
      const response = await axios.post(`${API_BASE}/bus-manager/geocode`, {
        address: query,
      });

      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] geocode response', {
          address: trimmedAddress,
          latitude: response.data?.latitude,
          longitude: response.data?.longitude,
          formattedAddress: response.data?.formattedAddress,
        });
      }

      return {
        latitude: Number(response.data?.latitude),
        longitude: Number(response.data?.longitude),
        title: String(response.data?.formattedAddress || trimmedAddress),
        description: trimmedAddress,
      } as RouteMapPoint;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) {
        if (DEBUG_BUS_MANAGER) {
          console.warn('[BusManagerDashboard] [map] geocode not found', {
            address: trimmedAddress,
            biasedQuery: query,
            cityHint: cityHint || null,
          });
        }
        return null;
      }
      if (DEBUG_BUS_MANAGER) {
        console.warn('[BusManagerDashboard] [map] geocode failed, using fallback point', {
          address: trimmedAddress,
          biasedQuery: query,
          cityHint: cityHint || null,
          message: error instanceof Error ? error.message : String(error),
          status: status || null,
        });
      }
      return null;
    }
  }, [schoolAddress]);

  const loadSchoolCoordinates = useCallback(async (normalizedSchoolCode: string) => {
    if (DEBUG_BUS_MANAGER) {
      console.log('[BusManagerDashboard] [map] loading school coordinates', {
        schoolCode: normalizedSchoolCode,
      });
    }
    const response = await axios.post(`${API_BASE}/bus-manager/school-coordinates`, {
      schoolCode: normalizedSchoolCode,
    });

    if (DEBUG_BUS_MANAGER) {
      console.log('[BusManagerDashboard] [map] school coordinates response', {
        schoolCode: normalizedSchoolCode,
        latitude: response.data?.latitude,
        longitude: response.data?.longitude,
        title: response.data?.title,
      });
    }

    return {
      latitude: Number(response.data?.latitude),
      longitude: Number(response.data?.longitude),
      title: String(response.data?.title || 'Institute'),
      description: String(response.data?.description || ''),
    } as RouteMapPoint;
  }, []);

  const scrollToSection = useCallback((section: SectionKey) => {
    if (section === 'overview') {
      setShowEligibleStudentsPage(false);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (section === 'students') {
      setShowEligibleStudentsPage(true);
      return;
    }
    requestAnimationFrame(() => {
      const targetY = sectionOffsets.current[section];
      if (typeof targetY === 'number') {
        scrollRef.current?.scrollTo({
          y: Math.max(0, targetY - 12),
          animated: true,
        });
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRouteMapPoints = async () => {
      setRouteMapLoading(true);
      setRouteMapError(null);

      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] loading route overview', {
          schoolCode,
          schoolAddress,
          routeCount: routes.length,
          selectedRouteId,
        });
      }

      try {
        const nextSchoolPoint = schoolCode
          ? await loadSchoolCoordinates(schoolCode).catch((error) => {
              if (DEBUG_BUS_MANAGER) {
                console.warn('[BusManagerDashboard] [map] school coordinates failed, using fallback center', {
                  schoolCode,
                  message: error instanceof Error ? error.message : String(error),
                });
              }
              return null;
            })
          : null;
        const cityHint = extractAddressContext(schoolAddress);
        const mapBias = cityHint ? `${cityHint}` : '';
        const routePalette = ['#E05A47', '#3C7BF4', '#2E8B57', '#9B59B6', '#D68910', '#117A65', '#34495E', '#C0392B'];
        const nextRoutes = await Promise.all(
          routes.map(async (route, index) => {
            const preferredAddress = String(
              isSameAddress(route.destination, schoolAddress) ? route.origin || '' : route.destination || route.origin || ''
            ).trim();
            const routeLabel = route.origin && route.destination
              ? `${route.origin} → ${route.destination}`
              : route.destination || route.origin || 'No address';

            if (DEBUG_BUS_MANAGER) {
              console.log('[BusManagerDashboard] [map] route candidate', {
                routeId: route.id,
                routeName: route.routeName,
                preferredAddress,
                routeLabel,
              });
            }

            const lookupAddress = mapBias ? `${preferredAddress}, ${mapBias}` : preferredAddress;
            const point = preferredAddress ? await geocodeAddress(lookupAddress) : null;
            if (DEBUG_BUS_MANAGER) {
              console.log('[BusManagerDashboard] [map] route geocoded', {
                routeId: route.id,
                routeName: route.routeName,
                latitude: point?.latitude || null,
                longitude: point?.longitude || null,
                usedFallbackPoint: !point,
              });
            }
            return {
              routeId: route.id,
              routeName: route.routeName,
              point,
              routeLabel,
              accent: routePalette[index % routePalette.length],
            } as RouteMapRoute;
          })
        );

        if (cancelled) return;

        setRouteMapSchoolPoint(nextSchoolPoint);
        setRouteMapRoutes(nextRoutes);
        setRouteMapError(null);

        console.log('[BusManagerDashboard] route overview map ready', {
          schoolPoint: nextSchoolPoint ? { latitude: nextSchoolPoint.latitude, longitude: nextSchoolPoint.longitude } : null,
          routePoints: nextRoutes.map((route) => ({
            routeId: route.routeId,
            routeName: route.routeName,
            latitude: route.point?.latitude,
            longitude: route.point?.longitude,
            usedFallbackPoint: !route.point,
          })),
          cityHint,
          routeMapHtmlLength: routeMapHtml.length,
        });
      } catch (error) {
        if (cancelled) return;
        console.error('[BusManagerDashboard] route map load error:', error);
        setRouteMapSchoolPoint(null);
        setRouteMapRoutes(
          routes.map((route, index) => ({
            routeId: route.id,
            routeName: route.routeName,
            point: null,
            routeLabel:
              route.origin && route.destination
                ? `${route.origin} → ${route.destination}`
                : route.destination || route.origin || 'No address',
            accent: ['#E05A47', '#3C7BF4', '#2E8B57', '#9B59B6', '#D68910', '#117A65', '#34495E', '#C0392B'][index % 8],
          }))
        );
        setRouteMapError(null);
      }

      setRouteMapLoading(false);
    };

    void loadRouteMapPoints().catch((error) => {
      if (cancelled) return;
      console.error('[BusManagerDashboard] loadRouteMapPoints error:', error);
      setRouteMapSchoolPoint(null);
      setRouteMapRoutes(
        routes.map((route, index) => ({
          routeId: route.id,
          routeName: route.routeName,
          point: null,
          routeLabel:
            route.origin && route.destination
              ? `${route.origin} → ${route.destination}`
              : route.destination || route.origin || 'No address',
          accent: ['#E05A47', '#3C7BF4', '#2E8B57', '#9B59B6', '#D68910', '#117A65', '#34495E', '#C0392B'][index % 8],
        }))
      );
      setRouteMapError(null);
      setRouteMapLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [geocodeAddress, loadSchoolCoordinates, routes, schoolAddress, schoolCode]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
      const normalizedSchoolCode = String(storedSchoolCode || '').trim();
      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] dashboard bootstrap start', {
          storedSchoolCode,
          normalizedSchoolCode,
        });
      }
      if (!normalizedSchoolCode) {
        Alert.alert('School code missing', 'Please log in again so we can load your school data.');
        return;
      }

      setSchoolCode(normalizedSchoolCode);
      await loadSchoolLocation(normalizedSchoolCode);

      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] fetching bootstrap', {
          url: `${API_BASE}/bus-manager/bootstrap`,
          schoolCode: normalizedSchoolCode,
        });
      }

      const response = await axios.get(`${API_BASE}/bus-manager/bootstrap`, {
        params: { schoolCode: normalizedSchoolCode },
      });

      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] bootstrap response keys', Object.keys(response.data || {}));
        console.log('[BusManagerDashboard] [map] bootstrap response data', response.data);
      }

      const nextRoutes = Array.isArray(response.data?.data?.routes) ? response.data.data.routes : [];
      const nextStudents = Array.isArray(response.data?.data?.students) ? response.data.data.students : [];

      if (DEBUG_BUS_MANAGER) {
        console.log('[BusManagerDashboard] [map] dashboard bootstrap loaded', {
          routeCount: nextRoutes.length,
          studentCount: nextStudents.length,
          routeNames: nextRoutes.slice(0, 10).map((route: any) => String(route.route_name || '')),
          routeSamples: nextRoutes.slice(0, 5).map((route: any) => ({
            id: route.id,
            route_name: route.route_name,
            driver_name: route.driver_name,
            origin: route.origin,
            destination: route.destination,
            vehicle_number: route.vehicle_number,
            bus_starting_time: route.bus_starting_time,
          })),
          studentSamples: nextStudents.slice(0, 5).map((student: any) => ({
            username: student.username,
            name: student.name,
            route_id: student.route_id,
            route_name: student.route_name,
            class_name: student.class_name,
            section: student.section,
            is_disabled: student.is_disabled,
          })),
        });
      }

      setRoutes(
        nextRoutes.map((route: any) => ({
          id: Number(route.id),
          routeName: String(route.route_name || ''),
          origin: route.origin || null,
          destination: route.destination || null,
          vehicleNumber: route.vehicle_number || null,
          driverName: route.driver_name || null,
          busStartingTime: route.bus_starting_time || null,
          driverExperience: route.driver_experience || null,
          createdAt: route.created_at || null,
        }))
      );

      setStudents(
        nextStudents.map((student: any) => ({
          username: String(student.username || ''),
          name: String(student.name || ''),
          address: student.address || null,
          className: student.class_name || null,
          section: student.section || null,
          assignedRouteId: student.route_id ? Number(student.route_id) : null,
          assignedRouteName: student.route_name || null,
          isDisabled: Boolean(Number(student.is_disabled || 0)),
        }))
      );

      setDisabledStudentUsernames(
        nextStudents
          .filter((student: any) => Boolean(Number(student.is_disabled || 0)))
          .map((student: any) => String(student.username || ''))
          .filter(Boolean)
      );

      setSelectedRouteId((current) => {
        if (current && nextRoutes.some((route: any) => Number(route.id) === current)) {
          return current;
        }
        return nextRoutes[0] ? Number(nextRoutes[0].id) : null;
      });
    } catch (error: any) {
      if (DEBUG_BUS_MANAGER) {
        console.error('[BusManagerDashboard] [map] dashboard bootstrap failed', {
          status: error?.response?.status,
          message: error?.response?.data?.message || error?.message || String(error),
          responseData: error?.response?.data,
        });
      }
      Alert.alert(
        'Load failed',
        error?.response?.data?.message || 'Unable to load bus manager data from the server.'
      );
    } finally {
      setLoading(false);
    }
  }, [loadSchoolLocation]);

  const updateStudentDisabledState = useCallback(
    async (username: string, disabled: boolean) => {
      if (saving) return;

      try {
        setSaving(true);
        await axios.put(`${API_BASE}/bus-manager/students/${encodeURIComponent(username)}/disable`, {
          schoolCode,
          disabled,
        });
        await loadDashboard();
      } catch (error: any) {
        Alert.alert(
          disabled ? 'Disable failed' : 'Enable failed',
          error?.response?.data?.message || 'Unable to update the student status.'
        );
      } finally {
        setSaving(false);
      }
    },
    [loadDashboard, schoolCode, saving]
  );

  const toggleDisableStudent = useCallback(
    async (username: string) => {
      const isCurrentlyDisabled = disabledStudentUsernameSet.has(username);
      await updateStudentDisabledState(username, !isCurrentlyDisabled);
    },
    [disabledStudentUsernameSet, updateStudentDisabledState]
  );

  const handleEnableStudent = useCallback(
    async (username: string) => {
      await updateStudentDisabledState(username, false);
    },
    [updateStudentDisabledState]
  );

  const handleAssignVehicle = useCallback(async () => {
    if (!selectedRoute) return;
    if (saving) return;
    if (!vehicleNumber.trim()) {
      Alert.alert('Vehicle number required', 'Please enter a bus vehicle number first.');
      return;
    }

    try {
      setSaving(true);
      await axios.put(`${API_BASE}/bus-manager/routes/${selectedRoute.id}`, {
        schoolCode,
        vehicleNumber: vehicleNumber.trim(),
        vehicle_number: vehicleNumber.trim(),
      });
      setVehicleNumber('');
      await loadDashboard();
      Alert.alert('Success', 'Vehicle number saved successfully.');
    } catch (error: any) {
      Alert.alert(
        'Update failed',
        error?.response?.data?.message || 'Unable to save the vehicle number.'
      );
    } finally {
      setSaving(false);
    }
  }, [loadDashboard, schoolCode, selectedRoute, saving, vehicleNumber]);

  const handleSaveBusStartingTime = useCallback(async () => {
    if (!selectedRoute) return;
    if (saving) return;
    if (!busStartingTime.trim()) {
      Alert.alert('Starting time required', 'Please enter a bus starting time first.');
      return;
    }

    try {
      setSaving(true);
      await axios.put(`${API_BASE}/bus-manager/routes/${selectedRoute.id}`, {
        schoolCode,
        busStartingTime: busStartingTime.trim(),
        bus_starting_time: busStartingTime.trim(),
      });
      setBusStartingTime('');
      await loadDashboard();
      Alert.alert('Success', 'Bus starting time saved successfully.');
    } catch (error: any) {
      Alert.alert(
        'Update failed',
        error?.response?.data?.message || 'Unable to save the bus starting time.'
      );
    } finally {
      setSaving(false);
    }
  }, [busStartingTime, loadDashboard, schoolCode, selectedRoute, saving]);

  const handleAssignDriver = useCallback(async () => {
    if (!selectedRoute) return;
    if (saving) return;
    if (!driverName.trim()) {
      Alert.alert('Driver name required', 'Please enter a driver name first.');
      return;
    }

    try {
      setSaving(true);
      await axios.put(`${API_BASE}/bus-manager/routes/${selectedRoute.id}`, {
        schoolCode,
        driverName: driverName.trim(),
        driver_name: driverName.trim(),
        driverExperience: driverExperience.trim() || null,
        driver_experience: driverExperience.trim() || null,
      });
      setDriverName('');
      setDriverExperience('');
      await loadDashboard();
      Alert.alert('Success', 'Driver saved successfully.');
    } catch (error: any) {
      Alert.alert(
        'Update failed',
        error?.response?.data?.message || 'Unable to save the driver name.'
      );
    } finally {
      setSaving(false);
    }
  }, [driverExperience, driverName, loadDashboard, schoolCode, selectedRoute, saving]);

  const handleAddRoute = useCallback(async () => {
    if (saving) return;
    const routeDestination = automaticDestination || newDestination.trim();
    if (!newRouteName.trim() || !newOrigin.trim() || !routeDestination) {
      Alert.alert('Route details missing', 'Please fill route name, origin, and destination.');
      return;
    }

    try {
      setSaving(true);
      await axios.post(`${API_BASE}/bus-manager/routes`, {
        schoolCode,
        routeName: newRouteName.trim(),
        route_name: newRouteName.trim(),
        origin: newOrigin.trim(),
        destination: routeDestination,
      });
      setNewRouteName('');
      setNewOrigin('');
      setNewDestination(automaticDestination);
      await loadDashboard();
      Alert.alert('Success', 'Route created successfully.');
    } catch (error: any) {
      Alert.alert(
        'Create failed',
        error?.response?.data?.message || 'Unable to create the route.'
      );
    } finally {
      setSaving(false);
    }
  }, [automaticDestination, loadDashboard, newDestination, newOrigin, newRouteName, schoolCode, saving]);

  const handleAssignStudent = useCallback(
    async (username: string) => {
      if (!selectedRoute) {
        Alert.alert('Select a route', 'Please select a bus route before assigning students.');
        return;
      }
      if (saving) return;

      try {
        setSaving(true);
        await axios.post(`${API_BASE}/bus-manager/students/${encodeURIComponent(username)}/assign`, {
          schoolCode,
          routeId: selectedRoute.id,
        });
        await loadDashboard();
        Alert.alert('Success', 'Student assigned successfully.');
      } catch (error: any) {
        Alert.alert(
          'Assign failed',
          error?.response?.data?.message || 'Unable to assign the student to this route.'
        );
      } finally {
        setSaving(false);
      }
    },
    [loadDashboard, schoolCode, selectedRoute, saving]
  );

  const handleDeleteStudent = useCallback(
    (username: string) => {
      Alert.alert('Unassign student?', 'This will remove the student from the selected route.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
            onPress: async () => {
              if (saving) {
                return;
              }
              try {
                setSaving(true);
                await axios.delete(`${API_BASE}/bus-manager/students/${encodeURIComponent(username)}/assign`, {
                  params: { schoolCode },
                });
                await loadDashboard();
                Alert.alert('Success', 'Student unassigned successfully.');
              } catch (error: any) {
                Alert.alert(
                  'Unassign failed',
                  error?.response?.data?.message || 'Unable to unassign the student.'
                );
            } finally {
              setSaving(false);
            }
          },
        },
      ]);
    },
    [loadDashboard, saving, schoolCode]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showDisabledStudents) {
        setShowDisabledStudents(false);
        return true;
      }

      if (showEligibleStudentsPage) {
        setShowEligibleStudentsPage(false);
        return true;
      }

      return false;
    });

    return () => backSubscription.remove();
  }, [showDisabledStudents, showEligibleStudentsPage]);

  const disabledStudentsModal = (
    <Modal
      visible={showDisabledStudents}
      transparent
      animationType="slide"
      onRequestClose={() => setShowDisabledStudents(false)}
    >
      <View style={localStyles.disabledModalOverlay}>
        <View style={localStyles.disabledModalCard}>
          <View style={localStyles.disabledModalHeader}>
            <Text style={localStyles.disabledModalTitle}>Disabled Students</Text>
            <Pressable onPress={() => setShowDisabledStudents(false)} style={localStyles.disabledModalClose}>
              <Ionicons name="close" size={18} color="#1C1C1C" />
            </Pressable>
          </View>
          <Text style={localStyles.disabledModalSubtitle}>
            Tap a student to move them back to the eligible list.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {allDisabledStudents.length === 0 ? (
              <View style={localStyles.cardPanel}>
                <Text style={localStyles.emptyText}>No disabled students yet.</Text>
              </View>
            ) : (
              allDisabledStudents.map((student) => (
                <Pressable
                  key={student.username}
                  style={localStyles.disabledStudentRow}
                  onPress={() => {
                    void handleEnableStudent(student.username);
                  }}
                >
                  <View style={localStyles.disabledStudentTextWrap}>
                    <Text style={localStyles.disabledStudentName}>{student.name}</Text>
                    <Text style={localStyles.disabledStudentAddress} numberOfLines={2}>
                      {student.address || 'No address'}
                    </Text>
                  </View>
                  <Text style={localStyles.disabledStudentAction}>Enable</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (showEligibleStudentsPage) {
    return (
      <SafeAreaView style={[shellStyles.screen, localStyles.safeArea]}>
        <StatusBar barStyle="dark-content" />
        <View style={shellStyles.background}>
          <View style={shellStyles.phoneShell}>
            <View style={shellStyles.phoneFrame}>
              <LinearGradient
                pointerEvents="none"
                colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={shellStyles.dashboardTopGradient}
              />
              <View style={shellStyles.toolbar}>
                <Pressable
                  style={localStyles.toolbarButton}
                  onPress={() => setShowEligibleStudentsPage(false)}
                >
                  <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                </Pressable>
                <View style={localStyles.toolbarTitleWrap}>
                  <Text style={localStyles.toolbarTitleText} numberOfLines={1}>
                    Eligible Students
                  </Text>
                </View>
                <View style={localStyles.toolbarInlineSpacer} />
                <View style={localStyles.toolbarButtonPlaceholder} />
              </View>

              <ScrollView
                style={shellStyles.scrollArea}
                contentContainerStyle={localStyles.studentPageContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={localStyles.studentPageHeader}>
                  <View style={localStyles.studentPageIcon}>
                    <Ionicons name="people-outline" size={22} color="#1C1C1C" />
                  </View>
                  <View style={localStyles.studentPageHeaderText}>
                    <Text style={localStyles.studentPageTitle}>Eligible students</Text>
                    <Text style={localStyles.studentPageSubtitle}>
                      {selectedRoute
                        ? `${selectedRoute.routeName} has ${visibleEligibleStudents.length} active eligible students.`
                        : 'Select a route from the dashboard to view eligible students.'}
                    </Text>
                  </View>
                </View>

                <View style={localStyles.studentPageRouteCard}>
                  <Text style={localStyles.cardPanelTitle}>Selected route</Text>
                  {selectedRoute ? (
                    <>
                      <Text style={localStyles.summaryTitle}>{selectedRoute.routeName}</Text>
                      <Text style={localStyles.summaryLine}>
                        {(selectedRoute.origin || 'Unknown') + ' to ' + (selectedRoute.destination || 'Unknown')}
                      </Text>
                      <View style={localStyles.studentPageStatsRow}>
                        <View style={localStyles.studentPageStat}>
                          <Text style={localStyles.studentPageStatValue}>{visibleEligibleStudents.length}</Text>
                          <Text style={localStyles.studentPageStatLabel}>Active</Text>
                        </View>
                        <View style={localStyles.studentPageStat}>
                          <Text style={localStyles.studentPageStatValue}>{disabledEligibleStudents.length}</Text>
                          <Text style={localStyles.studentPageStatLabel}>Disabled</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <Text style={localStyles.emptyText}>No route selected yet.</Text>
                  )}
                </View>

                <View style={localStyles.sectionHeaderRow}>
                  <Text style={localStyles.sectionTitle}>Students</Text>
                  <TouchableOpacity
                    style={[
                      localStyles.disabledStudentsButton,
                      allDisabledStudents.length === 0 && localStyles.disabledStudentsButtonDisabled,
                    ]}
                    onPress={() => setShowDisabledStudents(true)}
                    disabled={allDisabledStudents.length === 0}
                  >
                    <Text style={localStyles.disabledStudentsButtonText}>
                      Disabled ({allDisabledStudents.length})
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={localStyles.sectionSubtitle}>
                  Swipe right to assign students to the selected route, or swipe left to unassign them.
                </Text>

                {selectedRoute && visibleEligibleStudents.length === 0 ? (
                  <View style={localStyles.cardPanel}>
                    <Text style={localStyles.emptyText}>
                      {eligibleStudents.length === 0
                        ? 'No students matched this route address yet. Try another route or update student addresses.'
                        : 'All eligible students are disabled right now. Enable one to show it here.'}
                    </Text>
                  </View>
                ) : !selectedRoute ? (
                  <View style={localStyles.cardPanel}>
                    <Text style={localStyles.emptyText}>Select a route to view eligible students.</Text>
                  </View>
                ) : (
                  visibleEligibleStudents.map((student) => {
                    const assignedRoute = routes.find((route) => String(route.id) === String(student.assignedRouteId));
                    return (
                      <StudentSwipeCard
                        key={student.username}
                        student={student}
                        routeName={student.assignedRouteName || assignedRoute?.routeName || 'Unassigned'}
                        onAssign={() => handleAssignStudent(student.username)}
                        onDelete={() => handleDeleteStudent(student.username)}
                        onDisable={() => {
                          void toggleDisableStudent(student.username);
                        }}
                        disabled={disabledStudentUsernameSet.has(student.username)}
                      />
                    );
                  })
                )}

                <View style={localStyles.footerSpacer} />
              </ScrollView>

              {disabledStudentsModal}
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[shellStyles.screen, localStyles.safeArea]}>
      <StatusBar barStyle="dark-content" />
      <View style={shellStyles.background}>
        <View style={shellStyles.phoneShell}>
          <View style={shellStyles.phoneFrame}>
            <LinearGradient
              pointerEvents="none"
              colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={shellStyles.dashboardTopGradient}
            />
            <View style={shellStyles.toolbar}>
              <View style={shellStyles.toolbarBrand}>
                <Image source={logoImage} style={shellStyles.toolbarBrandLogo} resizeMode="contain" />
              </View>
              <View style={localStyles.toolbarTitleWrap}>
                <Text style={localStyles.toolbarTitleText} numberOfLines={1}>
                  Bus Manager Dashboard
                </Text>
              
              </View>
              <View style={localStyles.toolbarInlineSpacer} />  
             
            </View>

            <ScrollView
              ref={scrollRef}
              style={shellStyles.scrollArea}
              contentContainerStyle={localStyles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={localStyles.sectionAnchor}
                onLayout={(event) => {
                  sectionOffsets.current.overview = event.nativeEvent.layout.y;
                }}
              />

              <View style={localStyles.heroCard}>
                <View style={localStyles.heroTopRow}>
                  <View style={localStyles.heroBadge}>
                    <Ionicons name="bus-outline" size={22} color="#1C1C1C" />
                  </View>
                  <View style={localStyles.heroTextWrap}>
                    <Text style={localStyles.heroTitle}>Bus Manager</Text>
                    <Text style={localStyles.heroSubtitle}>
                      Manage routes, drivers, vehicles, and students from one place.
                    </Text>
                  </View>
                </View>

               

               
              </View>
   <LinearGradient
                colors={['#6826df', '#a174eb', '#1A2D4A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={localStyles.routeMapBoard}
              >
                <View style={localStyles.routeMapHeader}>
                  <View style={localStyles.routeMapHeaderLeft}>
                    <View style={localStyles.routeMapSchoolPin}>
                      <Ionicons name="map-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={localStyles.routeMapHeaderTitle}>Route overview</Text>
                      <Text style={localStyles.routeMapHeaderSubtitle}>
                        {schoolAddress
                          ? `All routes shown from the institute address to each route endpoint`
                          : 'Institute address will appear here when available'}
                      </Text>
                    </View>
                  </View>
                  <View style={localStyles.routeMapLegend}>
                    <View style={localStyles.routeMapLegendItem}>
                      <Ionicons name="business" size={12} color="#FFFFFF" />
                      <Text style={localStyles.routeMapLegendText}>Institute</Text>
                    </View>
                    <View style={localStyles.routeMapLegendItem}>
                      <Ionicons name="ellipse" size={12} color="#F4E9FF" />
                      <Text style={localStyles.routeMapLegendText}>Route stops</Text>
                    </View>
                  </View>
                </View>

                {routeMapLoading ? (
                  <View style={localStyles.mapFallback}>
                    <Text style={localStyles.mapFallbackText}>Loading route overview...</Text>
                  </View>
                ) : routeMapSchoolPoint || routeMapRoutes.length > 0 ? (
                  <WebView
                    key={`bus-map-${schoolAddress}-${routeMapRoutes.length}`}
                    originWhitelist={['*']}
                    source={{ html: routeMapHtml }}
                    style={localStyles.routeMapCanvas}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                    renderLoading={() => (
                      <View style={localStyles.mapFallback}>
                        <Text style={localStyles.mapFallbackText}>Loading route overview...</Text>
                      </View>
                    )}
                  />
                ) : (
                  <View style={localStyles.mapFallback}>
                    <Text style={localStyles.mapFallbackText}>
                      {routeMapError || 'The route overview will appear here once institute and route addresses are geocoded.'}
                    </Text>
                  </View>
                )}
              </LinearGradient>

               <View style={localStyles.summaryPillsRow}>
                  <View style={localStyles.summaryPill}>
                    <Text style={localStyles.summaryPillValue}>{routes.length}</Text>
                    <Text style={localStyles.summaryPillLabel}>Routes</Text>
                  </View>
                  <View style={localStyles.summaryPill}>
                    <Text style={localStyles.summaryPillValue}>{driverCount}</Text>
                    <Text style={localStyles.summaryPillLabel}>Drivers</Text>
                  </View>
                  <View style={localStyles.summaryPill}>
                    <Text style={localStyles.summaryPillValue}>{assignedStudentsCount}</Text>
                    <Text style={localStyles.summaryPillLabel}>Assigned</Text>
                  </View>
                </View>
              <View
                style={localStyles.sectionBlock}
                onLayout={(event) => {
                  sectionOffsets.current.routes = event.nativeEvent.layout.y;
                }}
              >
                <Text style={localStyles.sectionTitle}>Select Route</Text>
                <Text style={localStyles.sectionSubtitle}>
                  Tap one route to work on it. The active route is highlighted below.
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.routeStrip}>
                  {routes.map((route) => {
                    const active = route.id === selectedRouteId;
                    const routeStudents = students.filter((student) => addressMatchesRoute(student.address, route));
                    const assignedCount = routeStudents.length;
                    const activeCount = routeStudents.filter((student) => !disabledStudentUsernameSet.has(student.username)).length;
                    const disabledCount = routeStudents.filter((student) => disabledStudentUsernameSet.has(student.username)).length;
                    return (
                      <Pressable
                        key={route.id}
                        style={[
                          parentDashboardCardStyles.cardWrapper,
                          active && parentDashboardCardStyles.cardActive,
                        ]}
                        onPress={() => setSelectedRouteId(route.id)}
                      >
                        <View style={[parentDashboardCardStyles.card, active && parentDashboardCardStyles.cardActive]}>
                          <View style={shellStyles.dashboardGridCornerAccent}>
                            <LinearGradient
                              colors={['#d2c2eeff', '#a174eb', '#6826df']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={shellStyles.dashboardGridCornerAccentFill}
                            />
                          </View>
                          <View style={parentDashboardCardStyles.iconWrap}>
                            <Ionicons name="bus-outline" size={30} color="#000000" />
                          </View>
                          <View style={parentDashboardCardStyles.cardContent}>
                            <View style={parentDashboardCardStyles.textBlock}>
                              <Text style={parentDashboardCardStyles.label} numberOfLines={2}>
                                {route.routeName}
                              </Text>
                              <Text style={parentDashboardCardStyles.subtitle} numberOfLines={2}>
                                {(route.origin || 'Unknown') + ' to ' + (route.destination || 'Unknown')}
                              </Text>
                              <View style={localStyles.routeCardFooter}>
                              
                                <Text style={localStyles.routeCardFooterText} numberOfLines={1}>
                                  {activeCount} active
                                </Text>
                                <Text style={localStyles.routeCardFooterText} numberOfLines={1}>
                                  {disabledCount} disabled
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={localStyles.cardPanel}>
                  <Text style={localStyles.cardPanelTitle}>Selected route</Text>
                  {selectedRoute ? (
                    <View style={localStyles.summaryCard}>
                      <Text style={localStyles.summaryTitle}>{selectedRoute.routeName}</Text>
                      <Text style={localStyles.summaryLine}>
                        Vehicle: {selectedRoute.vehicleNumber || 'Not assigned'}
                      </Text>
                      <Text style={localStyles.summaryLine}>
                        Driver: {selectedRoute.driverName || 'Not assigned'}
                      </Text>
                      <Text style={localStyles.summaryLine}>
                        Bus starting time: {selectedRoute.busStartingTime || 'Not assigned'}
                      </Text>
                      <Text style={localStyles.summaryLine}>
                        Experience: {selectedRoute.driverExperience || 'Not assigned'}
                      </Text>
                      <TouchableOpacity
                        style={localStyles.eligibleStudentsButton}
                        onPress={() => setShowEligibleStudentsPage(true)}
                      >
                        <Ionicons name="people-outline" size={17} color="#FFFFFF" />
                        <Text style={localStyles.eligibleStudentsButtonText}>
                          View eligible students
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={localStyles.emptyText}>No route selected yet.</Text>
                  )}
                </View>
              </View>

              {/* <View style={localStyles.routeMapBoard}>
                <View style={localStyles.routeMapHeader}>
                  <View style={localStyles.routeMapHeaderLeft}>
                    <View style={localStyles.routeMapSchoolPin}>
                      <Ionicons name="map-outline" size={18} color="#1C1C1C" />
                    </View>
                    <View>
                      <Text style={localStyles.routeMapHeaderTitle}>Route overview</Text>
                      <Text style={localStyles.routeMapHeaderSubtitle}>
                        {schoolAddress
                          ? `All routes shown from the institute address to each route endpoint`
                          : 'Institute address will appear here when available'}
                      </Text>
                    </View>
                  </View>
                  <View style={localStyles.routeMapLegend}>
                    <View style={localStyles.routeMapLegendItem}>
                      <Ionicons name="business" size={12} color="#3F3F40" />
                      <Text style={localStyles.routeMapLegendText}>Institute</Text>
                    </View>
                    <View style={localStyles.routeMapLegendItem}>
                      <Ionicons name="ellipse" size={12} color="#3C7BF4" />
                      <Text style={localStyles.routeMapLegendText}>Route stops</Text>
                    </View>
                  </View>
                </View>

                {routeMapLoading ? (
                  <View style={localStyles.mapFallback}>
                    <Text style={localStyles.mapFallbackText}>Loading route overview...</Text>
                  </View>
                ) : routeMapSchoolPoint || routeMapRoutes.length > 0 ? (
                  <WebView
                    key={`bus-map-${schoolAddress}-${routeMapRoutes.length}`}
                    originWhitelist={['*']}
                    source={{ html: routeMapHtml }}
                    style={localStyles.routeMapCanvas}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                    renderLoading={() => (
                      <View style={localStyles.mapFallback}>
                        <Text style={localStyles.mapFallbackText}>Loading route overview...</Text>
                      </View>
                    )}
                  />
                ) : (
                  <View style={localStyles.mapFallback}>
                    <Text style={localStyles.mapFallbackText}>
                      {routeMapError || 'The route overview will appear here once institute and route addresses are geocoded.'}
                    </Text>
                  </View>
                )}
              </View> */}

              <View style={localStyles.quickActionsSection}>
                <View style={localStyles.sectionTitleRow}>
                  <Ionicons name="grid-outline" size={18} color="#1C1C1C" />
                  <Text style={localStyles.sectionTitle}>Quick Actions</Text>
                </View>
                <View style={localStyles.quickActionsGrid}>
                  {dashboardCardColumns.map((column, columnIndex) => (
                    <View key={`bus-quick-actions-column-${columnIndex}`} style={localStyles.quickActionsColumn}>
                      {column.map((card) => (
                        <Pressable
                          key={card.title}
                          style={localStyles.quickActionCard}
                          onPress={() => scrollToSection(card.target)}
                        >
                          <LinearGradient
                            colors={[...quickActionGradientColors]}
                            start={{ x: 0.05, y: 0.05 }}
                            end={{ x: 0.95, y: 0.95 }}
                            style={localStyles.quickActionGradient}
                          >
                            <View style={localStyles.quickActionIconWrap}>
                              <Ionicons name={card.icon as any} size={22} color="#FFFFFF" />
                            </View>
                            <Text style={localStyles.quickActionTitle}>{card.title}</Text>
                            <Text style={localStyles.quickActionSubtitle}>{card.subtitle}</Text>
                          </LinearGradient>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              </View>

              {loading ? (
                <View style={localStyles.infoCard}>
                  <Text style={localStyles.infoText}>Loading bus manager data...</Text>
                </View>
              ) : null}

                <View style={[localStyles.formGrid, stackFormCards && localStyles.formGridStacked]}>
                  <View style={[localStyles.cardPanelHalf, stackFormCards && localStyles.cardPanelFull]}>
                    <Text style={localStyles.cardPanelTitle}>Vehicle</Text>
                    <TextInput
                      value={vehicleNumber}
                      onChangeText={setVehicleNumber}
                      placeholder="TN 01 AB 1234"
                      placeholderTextColor="#8C97A4"
                      style={localStyles.input}
                      editable={!saving}
                    />
                  <TouchableOpacity
                    style={[localStyles.primaryButton, saving && localStyles.buttonDisabled]}
                    onPress={handleAssignVehicle}
                    disabled={saving}
                  >
                    <Text style={localStyles.primaryButtonText}>Save Vehicle</Text>
                  </TouchableOpacity>
                </View>

                <View style={[localStyles.cardPanelHalf, stackFormCards && localStyles.cardPanelFull]}>
                  <Text style={localStyles.cardPanelTitle}>Driver</Text>
                  <TextInput
                    value={driverName}
                    onChangeText={setDriverName}
                    placeholder="Driver name"
                    placeholderTextColor="#8C97A4"
                    style={localStyles.input}
                    editable={!saving}
                  />
                  <TextInput
                    value={driverExperience}
                    onChangeText={setDriverExperience}
                    placeholder="Experience (e.g. 5 years)"
                    placeholderTextColor="#8C97A4"
                    style={localStyles.input}
                    editable={!saving}
                  />
                  <TouchableOpacity
                    style={[localStyles.primaryButton, saving && localStyles.buttonDisabled]}
                    onPress={handleAssignDriver}
                    disabled={saving}
                  >
                    <Text style={localStyles.primaryButtonText}>Save Driver</Text>
                  </TouchableOpacity>
                </View>
              </View>

                <View style={localStyles.cardPanel}>
                  <Text style={localStyles.cardPanelTitle}>Starting time</Text>
                  <TextInput
                    value={busStartingTime}
                    onChangeText={setBusStartingTime}
                    placeholder="07:30 AM"
                    placeholderTextColor="#8C97A4"
                    style={localStyles.input}
                    editable={!saving}
                  />
                  <TouchableOpacity
                    style={[localStyles.secondaryButton, saving && localStyles.buttonDisabled]}
                    onPress={handleSaveBusStartingTime}
                    disabled={saving}
                  >
                    <Text style={localStyles.secondaryButtonText}>Save Time</Text>
                  </TouchableOpacity>
                </View>

                <View style={localStyles.cardPanel}>
                  <Text style={localStyles.cardPanelTitle}>New route</Text>
                  <TextInput
                    value={newRouteName}
                    onChangeText={setNewRouteName}
                    placeholder="Route name"
                    placeholderTextColor="#8C97A4"
                    style={localStyles.input}
                    editable={!saving}
                  />
                  <View style={localStyles.rowInputs}>
                    <TextInput
                      value={newOrigin}
                      onChangeText={setNewOrigin}
                      placeholder="Origin"
                      placeholderTextColor="#8C97A4"
                      style={[localStyles.input, localStyles.halfInput]}
                      editable={!saving}
                    />
                    <TextInput
                      value={newDestination}
                      onChangeText={setNewDestination}
                      placeholder={automaticDestination ? 'Institute address' : 'Destination'}
                      placeholderTextColor="#8C97A4"
                      style={[localStyles.input, localStyles.halfInput]}
                      editable={!saving && !automaticDestination}
                    />
                  </View>
                  <TouchableOpacity
                    style={[localStyles.secondaryButton, saving && localStyles.buttonDisabled]}
                    onPress={handleAddRoute}
                    disabled={saving}
                  >
                    <Text style={localStyles.secondaryButtonText}>Add Route</Text>
                  </TouchableOpacity>
                </View>

              {disabledStudentsModal}

              <View style={localStyles.footerSpacer} />
            </ScrollView>

            {showProfile ? (
              <Modal
                visible={showProfile}
                transparent
                animationType="fade"
                onRequestClose={() => setShowProfile(false)}
              >
                <View style={shellStyles.overlay}>
                  <View style={shellStyles.teacherPopupCard}>
                    <View style={shellStyles.teacherHeaderRow}>
                      <View style={shellStyles.teacherAvatar}>
                        <Text style={shellStyles.teacherAvatarText}>
                          {(profile.name || profile.username || 'B').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={shellStyles.teacherHeaderText}>
                        <Text style={shellStyles.teacherTitle}>Bus Manager Profile</Text>
                        <Text style={shellStyles.teacherSubtitle}>
                          {profile.name || 'Bus manager account details'}
                        </Text>
                      </View>
                    </View>

                    <View style={shellStyles.teacherDetailsList}>
                      <View style={shellStyles.teacherDetailRow}>
                        <Text style={shellStyles.teacherDetailLabel}>Username</Text>
                        <Text style={shellStyles.teacherDetailValue}>{profile.username || 'Not available'}</Text>
                      </View>
                      <View style={shellStyles.teacherDetailRow}>
                        <Text style={shellStyles.teacherDetailLabel}>Designation</Text>
                        <Text style={shellStyles.teacherDetailValue}>{profile.designation || 'Bus Manager'}</Text>
                      </View>
                      <View style={shellStyles.teacherDetailRow}>
                        <Text style={shellStyles.teacherDetailLabel}>School Code</Text>
                        <Text style={shellStyles.teacherDetailValue}>{profile.schoolCode || 'Not available'}</Text>
                      </View>
                      <View style={shellStyles.teacherDetailRow}>
                        <Text style={shellStyles.teacherDetailLabel}>User Type</Text>
                        <Text style={shellStyles.teacherDetailValue}>{profile.userType || 'management'}</Text>
                      </View>
                    </View>

                    <View style={shellStyles.teacherActions}>
                      <TouchableOpacity
                        style={[
                          shellStyles.popupButton,
                          shellStyles.popupButtonSecondary,
                          shellStyles.teacherActionButton,
                        ]}
                        onPress={() => setShowProfile(false)}
                      >
                        <Text style={[shellStyles.popupButtonText, shellStyles.popupButtonTextSecondary]}>
                          Close
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          shellStyles.popupButton,
                          shellStyles.popupButtonPrimary,
                          shellStyles.teacherActionButton,
                        ]}
                        onPress={() => {
                          setShowProfile(false);
                          scrollToSection('overview');
                        }}
                      >
                        <Text style={shellStyles.popupButtonText}>Home</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[shellStyles.popupButton, shellStyles.teacherLogoutButton]}
                      onPress={handleLogout}
                    >
                      <Text style={shellStyles.teacherLogoutText}>Logout</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            ) : null}

            <View style={shellStyles.footer}>
              {showFooterNav ? (
                <View style={shellStyles.footerNav}>
                  <Pressable style={shellStyles.footerNavItem} onPress={() => scrollToSection('overview')}>
                    <Ionicons name="home-outline" size={22} color="#1F1F22" />
                    <Text style={shellStyles.footerNavLabel}>Home</Text>
                  </Pressable>
                  <Pressable style={shellStyles.footerNavItem} onPress={() => scrollToSection('routes')}>
                    <Ionicons name="git-branch-outline" size={22} color="#1F1F22" />
                    <Text style={shellStyles.footerNavLabel}>Routes</Text>
                  </Pressable>
                  <Pressable style={shellStyles.footerAddButton} onPress={() => scrollToSection('students')}>
                    <Ionicons name="add" size={26} color="#FFFFFF" />
                  </Pressable>
                  <Pressable style={shellStyles.footerNavItem} onPress={() => scrollToSection('students')}>
                    <Ionicons name="people-outline" size={22} color="#C2C2C7" />
                    <Text style={shellStyles.footerNavLabelMuted}>Students</Text>
                  </Pressable>
                  <Pressable style={shellStyles.footerNavItem} onPress={handleOpenProfilePanel}>
                    <Ionicons name="person-outline" size={22} color="#C2C2C7" />
                    <Text style={shellStyles.footerNavLabelMuted}>Profile</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={shellStyles.footerBrandRow}>
                <Text style={shellStyles.poweredBy}>Powered By</Text>
                <Image source={logoImage} style={shellStyles.logo} resizeMode="contain" />
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0E0E0F',
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 128,
  },
  toolbarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#343436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarButtonPlaceholder: {
    width: 38,
    height: 38,
  },
  toolbarTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  toolbarTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  toolbarInlineSpacer: {
    width: 1,
  },
  sectionAnchor: {
    height: 1,
  },
  heroCard: {
    borderRadius: 18,
    backgroundColor: 'transaparent',
    padding: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(63,63,64,0.08)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  heroBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'transaparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E4EA',
  },
  heroBadgeImage: {
    width: 28,
    height: 28,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#131313',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#5E5E62',
  },
  summaryPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4EA',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  summaryPillValue: {
    color: '#131313',
    fontSize: 22,
    fontWeight: '900',
  },
  summaryPillLabel: {
    color: '#5B5B60',
    marginTop: 4,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  heroMetaCard: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4EA',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  heroMetaText: {
    flex: 1,
    color: '#5E5E62',
    fontSize: 12,
    lineHeight: 17,
  },
  quickActionsSection: {
    marginBottom: 14,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionsColumn: {
    flex: 1,
    gap: 8,
  },
  quickActionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    height: 124,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  quickActionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11.5,
    lineHeight: 15,
  },
  mapCaption: {
    marginTop: 8,
    fontSize: 11.5,
    color: '#5E5E62',
    lineHeight: 16,
  },
  routeMapBoard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    padding: 12,
    height:height*0.6,
    overflow: 'hidden',
  },
  routeMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  routeMapHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeMapSchoolPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMapHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
    marginBottom: 2,
  },
  routeMapHeaderSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
    lineHeight: 15,
    maxWidth: 210,
  },
  routeMapLegend: {
    alignItems: 'flex-end',
    gap: 6,
  },
  routeMapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeMapLegendText: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 10.5,
    fontWeight: '700',
  },
  routeMapCanvas: {
    position: 'relative',
    marginTop: 4,
    height: 440,
    borderRadius: 18,
    backgroundColor: '#F5F8FB',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    overflow: 'hidden',
  },
  routeMapGridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(63, 63, 64, 0.08)',
  },
  routeMapGridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(63, 63, 64, 0.08)',
  },
  routeMapGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(237, 243, 232, 0.85)',
    top: 60,
    left: '50%',
    marginLeft: -75,
  },
  routeMapCenter: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 140,
    marginLeft: -70,
    marginTop: -54,
    alignItems: 'center',
  },
  routeMapCenterPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF3E8',
    borderWidth: 1,
    borderColor: '#DDE8D5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  routeMapPinBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D8DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMapPinBubbleActive: {
    backgroundColor: '#3F3F40',
    borderColor: '#3F3F40',
  },
  routeMapPinBubbleText: {
    position: 'absolute',
    bottom: 3,
    right: 6,
    color: '#6A6A70',
    fontSize: 9,
    fontWeight: '800',
  },
  routeMapPinBubbleTextActive: {
    color: '#FFFFFF',
  },
  mapFallback: {
    height: 440,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F8FB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
  },
  mapFallbackText: {
    color: '#5E5E62',
    fontWeight: '700',
  },
  routeMapCenterTitle: {
    color: '#131313',
    fontSize: 12.5,
    fontWeight: '900',
    marginBottom: 2,
  },
  routeMapCenterSubtitle: {
    color: '#5E5E62',
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: 'center',
  },
  routeMapPin: {
    position: 'absolute',
    width: 136,
    minHeight: 86,
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4EA',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  routeMapPinActive: {
    backgroundColor: '#3F3F40',
    borderColor: '#3F3F40',
  },
  routeMapPinLeft: {
    alignItems: 'flex-start',
  },
  routeMapPinRight: {
    alignItems: 'flex-start',
  },
  routeMapPinHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  routeMapPinTitle: {
    color: '#131313',
    fontSize: 12.5,
    fontWeight: '900',
    flexShrink: 1,
  },
  routeMapPinTitleActive: {
    color: '#FFFFFF',
  },
  routeMapPinMeta: {
    color: '#5E5E62',
    fontSize: 10.5,
    lineHeight: 14,
  },
  routeMapPinMetaActive: {
    color: '#EDEDED',
  },
  heroRouteStrip: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  heroRouteCard: {
    width: 178,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D8DC',
    padding: 12,
    marginRight: 8,
  },
  heroRouteCardActive: {
    backgroundColor: '#3F3F40',
    borderColor: '#3F3F40',
  },
  heroRouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  heroRouteTitle: {
    color: '#131313',
    fontSize: 13,
    fontWeight: '900',
    flexShrink: 1,
  },
  heroRouteTitleActive: {
    color: '#FFFFFF',
  },
  heroRouteMeta: {
    color: '#5E5E62',
    fontSize: 11.5,
    lineHeight: 16,
    minHeight: 34,
  },
  heroRouteMetaActive: {
    color: '#EDEDED',
  },
  heroRouteCount: {
    marginTop: 10,
    color: '#6A6A70',
    fontSize: 10.5,
    fontWeight: '800',
  },
  heroRouteCountActive: {
    color: '#EDEDED',
  },
  infoCard: {
    borderRadius: 16,
    backgroundColor: '#F6F6F7',
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E1E4EA',
  },
  infoText: {
    color: '#5E5E62',
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4EA',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  statCardLeft: {
    backgroundColor: '#EDF3E8',
  },
  statCardRight: {
    backgroundColor: '#EEF2F8',
  },
  statValue: {
    color: '#1C1C1C',
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: '#5B5B60',
    marginTop: 4,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#131313',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#5E5E62',
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  disabledStudentsButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8D8DC',
    backgroundColor: '#F1F3F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disabledStudentsButtonDisabled: {
    opacity: 0.45,
  },
  disabledStudentsButtonText: {
    color: '#2B2B2B',
    fontSize: 11.5,
    fontWeight: '900',
  },
  routeStrip: {
    paddingRight: 4,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  routeCardFooter: {
    width: '100%',
    marginTop: 8,
    alignItems: 'flex-end',
  },
  routeCardFooterText: {
    color: '#6C6C74',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'right',
    paddingHorizontal: 4,
  },
  cardPanel: {
    borderRadius: 18,
    backgroundColor: '#F6F6F7',
    padding: 14,
    marginBottom: 12,
  },
  cardPanelHalf: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#F6F6F7',
    padding: 14,
  },
  cardPanelTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#131313',
    marginBottom: 10,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E1E4EA',
  },
  summaryTitle: {
    color: '#131313',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
  },
  summaryLine: {
    color: '#5B5B60',
    marginTop: 4,
  },
  eligibleStudentsButton: {
    marginTop: 14,
    backgroundColor: '#3F3F40',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  eligibleStudentsButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  studentPageContent: {
    paddingHorizontal: 4,
    paddingBottom: 18,
  },
  studentPageHeader: {
    borderRadius: 18,
    backgroundColor: '#F6F6F7',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  studentPageIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentPageHeaderText: {
    flex: 1,
  },
  studentPageTitle: {
    color: '#131313',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  studentPageSubtitle: {
    color: '#5E5E62',
    fontSize: 12,
    lineHeight: 17,
  },
  studentPageRouteCard: {
    borderRadius: 18,
    backgroundColor: '#F6F6F7',
    padding: 14,
    marginBottom: 12,
  },
  studentPageStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  studentPageStat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4EA',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  studentPageStatValue: {
    color: '#131313',
    fontSize: 20,
    fontWeight: '900',
  },
  studentPageStatLabel: {
    color: '#5B5B60',
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emptyText: {
    color: '#5B5B60',
  },
  formGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  formGridStacked: {
    flexDirection: 'column',
  },
  cardPanelFull: {
    flex: 0,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#131313',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#D8D8DC',
    marginBottom: 10,
  },
  halfInput: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#3F3F40',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12.5,
  },
  secondaryButton: {
    backgroundColor: '#F1F3F6',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8D8DC',
  },
  secondaryButtonText: {
    color: '#2B2B2B',
    fontWeight: '900',
    fontSize: 12.5,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E1E4EA',
  },
  studentCardDisabled: {
    opacity: 0.72,
  },
  disabledModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  disabledModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '72%',
  },
  disabledModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  disabledModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#131313',
  },
  disabledModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F6',
  },
  disabledModalSubtitle: {
    color: '#5E5E62',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  disabledStudentRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E4EA',
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FAFAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  disabledStudentTextWrap: {
    flex: 1,
  },
  disabledStudentName: {
    color: '#131313',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledStudentAddress: {
    color: '#5E5E62',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 4,
  },
  disabledStudentAction: {
    color: '#3F3F40',
    fontSize: 12,
    fontWeight: '900',
  },
  studentCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  studentTextBlock: {
    flex: 1,
  },
  studentName: {
    color: '#131313',
    fontSize: 15,
    fontWeight: '900',
  },
  studentClass: {
    color: '#5B5B60',
    marginTop: 4,
  },
  studentAddress: {
    color: '#7B7B80',
    marginTop: 6,
    fontSize: 11.5,
    lineHeight: 16,
  },
  routeBadge: {
    backgroundColor: '#F1F3F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D8D8DC',
  },
  routeBadgeText: {
    color: '#2B2B2B',
    fontSize: 11,
    fontWeight: '800',
  },
  studentHint: {
    color: '#6A6A70',
    marginTop: 10,
    fontSize: 11.5,
  },
  footerSpacer: {
    height: 120,
  },
});

export default BusManagerDashboard;
