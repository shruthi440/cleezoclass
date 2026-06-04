import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Pressable,
  TouchableOpacity,
  View,
  useWindowDimensions,Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import LinearGradient from 'react-native-linear-gradient';

import { createAppStyles } from '../App.styles';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BusDriverDashboard'>;
const { height } = Dimensions.get('window');

type BusRoute = {
  id: number;
  routeName: string;
  origin: string | null;
  destination: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  busStartingTime: string | null;
  driverExperience: string | null;
};

type BusStudent = {
  username: string;
  name: string;
  address: string | null;
  className: string | null;
  section: string | null;
  assignedRouteId: number | null;
  assignedRouteName: string | null;
  isDisabled?: boolean;
};

type BusProfile = {
  username: string;
  name: string;
  schoolCode: string;
  designation: string;
  userType: string;
  busNumber: string;
};

type BusDriverProfile = {
  name: string | null;
  phoneNumber: string | null;
  busNumber: string | null;
  aadharNumber: string | null;
  helperName: string | null;
  helperAadharNumber: string | null;
  status: string | null;
  routeName: string | null;
};

type RouteMapPoint = {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
};

const API_BASE = 'http://162.215.210.38:3010/api';
const DEBUG_BUS_DRIVER = true;
const driverStatsGradientColors = ['#D7C5FF', '#A670EE', '#6D2DE1'] as const;

const normalizeKey = (value: any) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const matchesName = (left: any, right: any) => {
  const a = normalizeKey(left);
  const b = normalizeKey(right);
  return Boolean(a && b && a === b);
};

const addressMatchesRoute = (address: string | null | undefined, route: BusRoute | null) => {
  if (!route) return false;

  const normalizedAddress = normalizeKey(address);
  if (!normalizedAddress) return false;

  const origin = normalizeKey(route.origin);
  const destination = normalizeKey(route.destination);

  if (origin && normalizedAddress.includes(origin)) return true;
  if (destination && normalizedAddress.includes(destination)) return true;

  return [origin, destination].some((token) => Boolean(token) && normalizedAddress.includes(token));
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

const hashAddress = (value: string) => {
  let hash = 0;
  const input = String(value || '').trim().toLowerCase();
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 100000;
  }
  return hash;
};

const buildRouteMapHtml = (
  schoolPoint: RouteMapPoint | null,
  routePoints: RouteMapPoint[],
  studentPoints: RouteMapPoint[],
) => {
  const payload = { schoolPoint, routePoints, studentPoints };

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
      .popup-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
      .popup-subtitle { font-size: 11px; color: #555; }
      .school-dot, .route-dot {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: #FFFFFF;
        border: 3px solid #1C1C1C;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .route-dot { border-color: var(--route-color, #3C7BF4); }
      .student-dot {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: #E05A47;
        border: 3px solid #FFFFFF;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .student-icon {
        width: 32px;
        height: 32px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(224, 90, 71, 0.12);
        border: 2px solid rgba(224, 90, 71, 0.35);
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
        color: #E05A47;
        font-size: 16px;
        line-height: 1;
      }
      .zoom-controls {
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 10px;
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
      }
      .zoom-btn {
        width: 42px;
        height: 42px;
        border: 0;
        background: #FFFFFF;
        color: #0F172A;
        font-size: 24px;
        font-weight: 800;
        line-height: 42px;
        text-align: center;
        padding: 0;
      }
      .zoom-btn + .zoom-btn {
        border-top: 1px solid #E2E8F0;
      }
    </style>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  </head>
  <body>
    <div id="map"></div>
    <div class="zoom-controls">
      <button id="zoom-in" class="zoom-btn" type="button">+</button>
      <button id="zoom-out" class="zoom-btn" type="button">−</button>
    </div>
    <script>
      (function () {
        const data = ${JSON.stringify(payload)};
        const map = L.map('map', { zoomControl: false, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        const school = data.schoolPoint;
        const routePoints = Array.isArray(data.routePoints) ? data.routePoints : [];
        const studentPoints = Array.isArray(data.studentPoints) ? data.studentPoints : [];
        const localCenter = school || routePoints[0] || {
          latitude: 17.385,
          longitude: 78.4867,
          title: 'Institute',
          description: 'Institute',
        };

        map.setView([localCenter.latitude, localCenter.longitude], 13);
        document.getElementById('zoom-in').addEventListener('click', function () {
          map.zoomIn();
        });
        document.getElementById('zoom-out').addEventListener('click', function () {
          map.zoomOut();
        });

        if (school) {
          const schoolMarker = L.marker([school.latitude, school.longitude], {
          icon: L.divIcon({
              className: '',
              html: '<div class="school-dot"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(map);
          schoolMarker.bindPopup('<div class="popup-title">' + school.title + '</div><div class="popup-subtitle">' + school.description + '</div>');
        }

        const colors = ['#3C7BF4', '#E05A47'];
        routePoints.forEach((point, index) => {
          if (!point) return;
          const color = colors[index % colors.length];
          const marker = L.marker([point.latitude, point.longitude], {
            icon: L.divIcon({
              className: '',
              html: '<div class="route-dot" style="--route-color:' + color + '"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(map);
          marker.bindPopup('<div class="popup-title">' + point.title + '</div><div class="popup-subtitle">' + point.description + '</div>');

          if (school) {
            L.polyline([[school.latitude, school.longitude], [point.latitude, point.longitude]], {
              color,
              weight: 5,
              opacity: 0.9,
            }).addTo(map);
          }
        });

        studentPoints.forEach((point) => {
          if (!point) return;
          const marker = L.marker([point.latitude, point.longitude], {
            icon: L.divIcon({
              className: '',
              html: '<div class="student-icon">👤</div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            }),
          }).addTo(map);
          marker.bindPopup(
            '<div class="popup-title">' + point.title + '</div>' +
              '<div class="popup-subtitle">Student area</div>' +
              '<div class="popup-subtitle">' + point.description + '</div>'
          );
        });

      })();
    </script>
  </body>
</html>`;
};

const buildRouteLabel = (route: BusRoute | null) => {
  if (!route) return 'No assigned route';
  const origin = String(route.origin || '').trim();
  const destination = String(route.destination || '').trim();
  if (origin || destination) {
    return [origin, destination].filter(Boolean).join(' -> ');
  }
  return route.routeName || 'Assigned route';
};

const StatCard: React.FC<{
  label: string;
  value: string;
  icon: string;
}> = ({ label, value, icon }) => (
  <LinearGradient
    colors={[...driverStatsGradientColors]}
    start={{ x: 0.05, y: 0.05 }}
    end={{ x: 0.95, y: 0.95 }}
    style={styles.statCard}
  >
    <View style={styles.statIconWrap}>
      <Ionicons name={icon as any} size={18} color="#FFFFFF" />
    </View>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
  </LinearGradient>
);

const BusDriverDashboard: React.FC<Props> = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const appStyles = createAppStyles({ phoneWidth: width, phoneHeight: height });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<BusProfile>({
    username: '',
    name: '',
    schoolCode: '',
    designation: '',
    userType: '',
    busNumber: '',
  });
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [students, setStudents] = useState<BusStudent[]>([]);
  const [apiActiveRoute, setApiActiveRoute] = useState<BusRoute | null>(null);
  const [driverProfile, setDriverProfile] = useState<BusDriverProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [routeMapLoading, setRouteMapLoading] = useState(false);
  const [routeMapError, setRouteMapError] = useState<string | null>(null);
  const [routeMapSchoolPoint, setRouteMapSchoolPoint] = useState<RouteMapPoint | null>(null);
  const [routeMapPoints, setRouteMapPoints] = useState<RouteMapPoint[]>([]);
  const [studentMapPoints, setStudentMapPoints] = useState<RouteMapPoint[]>([]);

  const quickActions = useMemo(
    () => [
      { label: 'Trip Log', icon: 'book-outline' },
      { label: 'Student List', icon: 'people-outline' },
      { label: 'Route Status', icon: 'map-outline' },
      { label: 'Call Office', icon: 'call-outline' },
    ],
    [],
  );

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        if (DEBUG_BUS_DRIVER) {
          console.log('[BusDriverDashboard] loadDashboard start');
        }
        const [storedUsername, storedName, storedDesignation, storedSchoolCode, storedUserType, storedUserDetailsRaw] =
          await Promise.all([
            AsyncStorage.getItem('username'),
            AsyncStorage.getItem('name'),
            AsyncStorage.getItem('designation'),
            AsyncStorage.getItem('schoolCode'),
            AsyncStorage.getItem('userType'),
            AsyncStorage.getItem('userDetails'),
          ]);

        const storedUserDetails = storedUserDetailsRaw ? JSON.parse(storedUserDetailsRaw) : {};
        if (DEBUG_BUS_DRIVER) {
          console.log('[BusDriverDashboard] stored values', {
            storedUsername,
            storedName,
            storedDesignation,
            storedSchoolCode,
            storedUserType,
            storedUserDetails,
          });
        }
        const resolvedProfile: BusProfile = {
          username: String(storedUserDetails.username || storedUserDetails.user_name || storedUsername || ''),
          name: String(storedUserDetails.name || storedUserDetails.teacher_name || storedName || ''),
          schoolCode: String(storedUserDetails.schoolCode || storedSchoolCode || ''),
          designation: String(storedUserDetails.designation || storedDesignation || ''),
          userType: String(storedUserDetails.userType || storedUserType || ''),
          busNumber: String(
            storedUserDetails.bus_number ||
              storedUserDetails.busNumber ||
              storedUserDetails.vehicle_number ||
              storedUserDetails.vehicleNumber ||
              '',
          ),
        };

        if (!mounted) return;
        setProfile(resolvedProfile);

        if (DEBUG_BUS_DRIVER) {
          console.log('[BusDriverDashboard] resolved profile', resolvedProfile);
        }

        if (!resolvedProfile.schoolCode.trim()) {
          setRoutes([]);
          setStudents([]);
          setError('School code not found. Please log in again.');
          if (DEBUG_BUS_DRIVER) {
            console.warn('[BusDriverDashboard] missing schoolCode, aborting fetch');
          }
          return;
        }

        if (DEBUG_BUS_DRIVER) {
          console.log('[BusDriverDashboard] fetching bootstrap', {
            url: `${API_BASE}/bus-driver/dashboard`,
            schoolCode: resolvedProfile.schoolCode,
            requestParams: {
              schoolCode: resolvedProfile.schoolCode,
              name: resolvedProfile.name,
              username: resolvedProfile.username,
              designation: resolvedProfile.designation,
              busNumber: resolvedProfile.busNumber || null,
            },
          });
        }
        const response = await axios.get(`${API_BASE}/bus-driver/dashboard`, {
          params: {
            schoolCode: resolvedProfile.schoolCode,
            name: resolvedProfile.name,
            username: resolvedProfile.username,
            designation: resolvedProfile.designation,
            busNumber: resolvedProfile.busNumber,
          },
        });

        if (!mounted) return;

        const responseData = response.data;
        const responseText = typeof responseData === 'string' ? responseData.trim() : '';
        let parsedData: any = responseData;

        if (DEBUG_BUS_DRIVER) {
          console.log('[BusDriverDashboard] bootstrap http response', {
            status: response.status,
            statusText: response.statusText,
            responseHeaders: response.headers,
          });
        }

        if (responseText) {
          try {
            parsedData = JSON.parse(responseText);
          } catch {
            parsedData = responseData;
          }
        }

        const nextRoutes = Array.isArray(parsedData)
          ? parsedData
          : Array.isArray(parsedData?.data?.allRoutes)
          ? parsedData.data.allRoutes
          : Array.isArray(parsedData?.data?.routes)
          ? parsedData.data.routes
          : Array.isArray(parsedData?.routes)
          ? parsedData.routes
          : Array.isArray(parsedData?.data)
          ? parsedData.data
          : [];
        const nextStudents = Array.isArray(parsedData?.data?.students)
          ? parsedData.data.students
          : Array.isArray(parsedData?.students)
          ? parsedData.students
          : [];  
        const nextActiveRoute = parsedData?.data?.activeRoute || null;
        const nextDriverProfile = parsedData?.data?.driverProfile || null;

        if (DEBUG_BUS_DRIVER) {
          console.log('[BusDriverDashboard] bootstrap response type', {
            isArray: Array.isArray(responseData),
            typeofResponse: typeof responseData,
            responseTextPreview: responseText ? responseText.slice(0, 200) : '',
          });
          console.log('[BusDriverDashboard] bootstrap response keys', Object.keys(responseData || {}));
          console.log('[BusDriverDashboard] bootstrap response data', responseData);
          console.log('[BusDriverDashboard] parsed bootstrap data', parsedData);
          console.log('[BusDriverDashboard] parsed bootstrap counts', {
            routeCount: nextRoutes.length,
            studentCount: nextStudents.length,
            activeRouteId: nextActiveRoute?.id || null,
            hasDriverProfile: Boolean(nextDriverProfile),
          });
        }

        if (DEBUG_BUS_DRIVER) {
          const responseDataKeys = responseData && typeof responseData === 'object' ? Object.keys(responseData) : [];
          const parsedDataKeys = parsedData && typeof parsedData === 'object' ? Object.keys(parsedData) : [];
          console.log('[BusDriverDashboard] bootstrap counts', {
            routeCount: nextRoutes.length,
            studentCount: nextStudents.length,
            routeSamples: nextRoutes.slice(0, 5).map((route: any) => ({
              id: route.id,
              route_name: route.route_name,
              driver_name: route.driver_name,
              origin: route.origin,
              destination: route.destination,
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
            responseDataKeys,
            parsedDataKeys,
            rawActiveRoute: parsedData?.data?.activeRoute || parsedData?.activeRoute || null,
            rawDriverProfile: parsedData?.data?.driverProfile || parsedData?.driverProfile || null,
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
          })),
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
          })),
        );
        setApiActiveRoute(
          nextActiveRoute
            ? {
                id: Number(nextActiveRoute.id),
                routeName: String(nextActiveRoute.route_name || ''),
                origin: nextActiveRoute.origin || null,
                destination: nextActiveRoute.destination || null,
                vehicleNumber: nextActiveRoute.vehicle_number || null,
                driverName: nextActiveRoute.driver_name || null,
                busStartingTime: nextActiveRoute.bus_starting_time || null,
                driverExperience: nextActiveRoute.driver_experience || null,
              }
            : null,
        );
        setDriverProfile(
          nextDriverProfile
            ? {
                name: nextDriverProfile.name || null,
                phoneNumber: nextDriverProfile.phoneNumber || null,
                busNumber: nextDriverProfile.busNumber || null,
                aadharNumber: nextDriverProfile.aadharNumber || null,
                helperName: nextDriverProfile.helperName || null,
                helperAadharNumber: nextDriverProfile.helperAadharNumber || null,
                status: nextDriverProfile.status || null,
                routeName: nextDriverProfile.routeName || null,
              }
            : null,
        );
      } catch (fetchError: any) {
        if (!mounted) return;
        setRoutes([]);
        setStudents([]);
        setApiActiveRoute(null);
        setDriverProfile(null);
        setError(fetchError?.response?.data?.message || 'Unable to load assigned route data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const matchedRoutes = useMemo(() => {
    const keys = [profile.name, profile.username, profile.designation];
    const matched = routes.filter((route) =>
      keys.some((key) =>
        matchesName(route.driverName, key) ||
        matchesName(route.routeName, key) ||
        matchesName(route.origin, key) ||
        matchesName(route.destination, key),
      ),
    );

    if (DEBUG_BUS_DRIVER) {
      console.log('[BusDriverDashboard] matching routes', {
        driverName: profile.name,
        driverUsername: profile.username,
        keys,
        allRoutes: routes.map((route) => ({
          id: route.id,
          routeName: route.routeName,
          driverName: route.driverName,
          origin: route.origin,
          destination: route.destination,
        })),
        matchedRoutes: matched.map((route) => ({
          id: route.id,
          routeName: route.routeName,
          driverName: route.driverName,
          origin: route.origin,
          destination: route.destination,
        })),
        routeCount: routes.length,
        matchedCount: matched.length,
      });
    }

    return matched;
  }, [profile.designation, profile.name, profile.username, routes]);

  const activeRoute = apiActiveRoute || matchedRoutes[0] || null;

  useEffect(() => {
    let cancelled = false;

    const loadDriverRouteMap = async () => {
      if (!profile.schoolCode.trim() || !activeRoute) {
        setRouteMapSchoolPoint(null);
        setRouteMapPoints([]);
        setStudentMapPoints([]);
        setRouteMapError(null);
        return;
      }

      setRouteMapLoading(true);
      setRouteMapError(null);

      try {
        const schoolResponse = await axios.post(`${API_BASE}/bus-manager/school-coordinates`, {
          schoolCode: profile.schoolCode,
        });

        const schoolPoint: RouteMapPoint = {
          latitude: Number(schoolResponse.data?.latitude),
          longitude: Number(schoolResponse.data?.longitude),
          title: String(schoolResponse.data?.title || 'Institute'),
          description: String(schoolResponse.data?.description || ''),
        };

        const routeAddresses = [activeRoute.origin, activeRoute.destination]
          .map((address, index) => ({
            address: String(address || '').trim(),
            label: index === 0 ? 'Origin' : 'Destination',
          }))
          .filter((item) => Boolean(item.address));

        const geocodeMaybe = async (address: string) => {
          const trimmed = String(address || '').trim();
          if (!trimmed) return null;

          try {
            const response = await axios.post(`${API_BASE}/bus-manager/geocode`, {
              address: trimmed,
            });

            const latitude = Number(response.data?.latitude);
            const longitude = Number(response.data?.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return null;
            }

            return {
              latitude,
              longitude,
              title: trimmed,
              description: trimmed,
            } as RouteMapPoint;
          } catch (error: any) {
            if (DEBUG_BUS_DRIVER) {
              console.warn('[BusDriverDashboard] geocode skipped', {
                address: trimmed,
                message: error?.response?.data?.message || error?.message || String(error),
              });
            }
            return null;
          }
        };

        const buildApproxPoint = (address: string, title: string, description: string, anchor: RouteMapPoint | null) => {
          if (!anchor) return null;

          const seed = hashAddress(address);
          const latOffset = ((seed % 17) - 8) / 900;
          const lngOffset = (((Math.floor(seed / 17) % 17) - 8) / 900);

          return {
            latitude: anchor.latitude + latOffset,
            longitude: anchor.longitude + lngOffset,
            title,
            description: `${description} (approximate area)`,
          } as RouteMapPoint;
        };

        const routePoints = (
          await Promise.all(
            routeAddresses.map(async ({ address, label }) => {
              const point = await geocodeMaybe(address);
              return point
                ? {
                    ...point,
                    title: `${label}: ${address}`,
                    description: `${activeRoute.routeName} • ${address}`,
                  }
                : null;
            }),
          )
        ).filter(Boolean) as RouteMapPoint[];

        const studentAnchor = routePoints[0] || routePoints[1] || schoolPoint;
        const studentPoints = activeAssignedStudents
          .filter((student) => Boolean(String(student.address || '').trim()))
          .slice(0, 10)
          .map((student, index) => {
            const address = String(student.address || '').trim();
            const approxPoint = buildApproxPoint(
              `${student.username}-${address}`,
              student.name || student.username,
              `${student.className || 'Class -'}${student.section ? ` • ${student.section}` : ''}`,
              studentAnchor,
            );

            if (!approxPoint) return null;

            const seed = hashAddress(`${student.username}-${address}`);
            const extraLat = ((index % 3) - 1) / 1700;
            const extraLng = (((Math.floor(seed / 10) % 3) - 1) / 1700);

            return {
              latitude: approxPoint.latitude + extraLat,
              longitude: approxPoint.longitude + extraLng,
              title: student.name || student.username,
              description: `${student.className || 'Class -'}${student.section ? ` • ${student.section}` : ''}`,
            } as RouteMapPoint;
          })
          .filter(Boolean) as RouteMapPoint[];

        if (cancelled) return;

        setRouteMapSchoolPoint(schoolPoint);
        setRouteMapPoints(routePoints);
        setStudentMapPoints(studentPoints);
      } catch (mapError: any) {
        if (cancelled) return;
        if (DEBUG_BUS_DRIVER) {
          console.warn('[BusDriverDashboard] route map load error', {
            message: mapError?.response?.data?.message || mapError?.message || String(mapError),
          });
        }
        setRouteMapSchoolPoint(null);
        setRouteMapPoints([]);
        setStudentMapPoints([]);
        setRouteMapError('Unable to load driver map right now.');
      } finally {
        if (!cancelled) setRouteMapLoading(false);
      }
    };

    void loadDriverRouteMap();

    return () => {
      cancelled = true;
    };
  }, [activeAssignedStudents, activeRoute, profile.schoolCode]);

  const routeMapHtml = useMemo(
    () => buildRouteMapHtml(routeMapSchoolPoint, routeMapPoints, studentMapPoints),
    [routeMapPoints, routeMapSchoolPoint, studentMapPoints],
  );

  const assignedStudents = useMemo(() => {
    if (!activeRoute) return [];

    const apiMatchedStudents = students;
    const fallbackMatchedStudents = students.filter(
      (student) =>
        student.assignedRouteId === activeRoute.id ||
        matchesName(student.assignedRouteName, activeRoute.routeName) ||
        addressMatchesRoute(student.address, activeRoute),
    );
    const matchedStudents = apiMatchedStudents.length > 0 ? apiMatchedStudents : fallbackMatchedStudents;

    if (DEBUG_BUS_DRIVER) {
      console.log('[BusDriverDashboard] matching students', {
        activeRoute: {
          id: activeRoute.id,
          routeName: activeRoute.routeName,
          driverName: activeRoute.driverName,
        },
        matchedStudents: matchedStudents.map((student) => ({
          username: student.username,
          name: student.name,
          assignedRouteId: student.assignedRouteId,
          assignedRouteName: student.assignedRouteName,
          className: student.className,
          section: student.section,
        })),
        studentCount: students.length,
        matchedCount: matchedStudents.length,
        usedApiMatchedStudents: apiMatchedStudents.length > 0,
      });
    }

    return matchedStudents;
  }, [activeRoute, students]);

  const activeAssignedStudents = useMemo(
    () => assignedStudents.filter((student) => !student.isDisabled),
    [assignedStudents],
  );
  const activeAssignedStudentsPreview = activeAssignedStudents.slice(0, 5);
  const routeLabel = buildRouteLabel(activeRoute);
  const vehicleNumber = activeRoute?.vehicleNumber || '--';
  const startTime = activeRoute?.busStartingTime || '--';
  const routeExperience = activeRoute?.driverExperience || 'Not set';
  const driverLabel = profile.name || profile.username || 'Bus Driver';
  const displayDriverProfile: BusDriverProfile = driverProfile || {
    name: activeRoute?.driverName || profile.name || null,
    phoneNumber: null,
    busNumber: activeRoute?.vehicleNumber || null,
    aadharNumber: null,
    helperName: null,
    helperAadharNumber: null,
    status: null,
    routeName: activeRoute?.routeName || null,
  };

  const handleLogout = async () => {
    try {
      setShowProfile(false);
      await AsyncStorage.multiRemove([
        'username',
        'name',
        'designation',
        'schoolCode',
        'userType',
        'userDetails',
        'teacherProfile',
        'currentStudent',
        'photoUrl',
        'photo',
      ]);
    } catch (logoutError) {
      if (DEBUG_BUS_DRIVER) {
        console.warn('[BusDriverDashboard] logout storage clear failed', logoutError);
      }
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'TeacherLogin' }],
    });
  };

  const handleOpenProfilePanel = () => {
    setShowProfile(true);
  };

  const routeCheckpoints = useMemo(
    () => [
      {
        time: startTime,
        task: activeRoute ? `Start from ${activeRoute.origin || 'assigned origin'}` : 'No route assigned',
      },
      {
        time: `${activeAssignedStudents.length} students`,
        task: activeRoute
          ? 'Students matched from the manager assignment'
          : 'Waiting for route assignment',
      },
      {
        time: activeRoute?.destination || '--',
        task: activeRoute ? `End at ${activeRoute.destination || 'assigned destination'}` : 'No destination yet',
      },
    ],
    [activeAssignedStudents.length, activeRoute, startTime],
  );

  const checklistItems = useMemo(
    () => [
      {
        label: activeRoute ? 'Route matched from manager' : 'No assigned route yet',
        done: Boolean(activeRoute),
      },
      {
        label: `${activeAssignedStudents.length} active students`,
        done: activeAssignedStudents.length > 0,
      },
      {
        label: `Start time: ${startTime}`,
        done: Boolean(activeRoute?.busStartingTime),
      },
    ],
    [activeAssignedStudents.length, activeRoute, startTime],
  );

  if (loading) {
    return (
      <SafeAreaView style={appStyles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading driver dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={appStyles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={[appStyles.screen, styles.screenSurface]}>

          <LinearGradient
                      pointerEvents="none"
                      colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.dashboardTopGradient}
                    />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.title}>Welcome, {driverLabel}</Text>
               
              </View>
             
            </View>

          <View style={styles.profileRow}>
           
              <View style={styles.profilePill}>
                <Ionicons name="location-outline" size={14} color="#334155" />
              <Text style={styles.profilePillText}>{routeLabel}</Text>
            </View>
          </View>

      
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color="#B91C1C" />
              <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
             
<LinearGradient
  colors={['#6826df', '#a174eb', '#1A2D4A']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.panel}   // 👈 apply gradient here
>
  <View style={styles.panelHeader}>
    <Text style={styles.panelTitle}>Driver Route Map</Text>
    <Text
      style={[
        styles.panelBadge,
        activeRoute ? styles.panelBadgeSuccess : styles.panelBadgeMuted,
      ]}
    >
      {activeRoute ? 'Live' : 'No route'}
    </Text>
  </View>

  <Text style={styles.panelSubtitle}>
    {activeRoute
      ? 'Your active route is shown with the institute, route stops, and student areas.'
      : 'Select or match a route to view the map.'}
  </Text>

  <View style={styles.routeMapCard}>
    {routeMapLoading ? (
      <View style={styles.routeMapFallback}>
        <Text style={styles.routeMapFallbackText}>Loading driver map...</Text>
      </View>
    ) : routeMapSchoolPoint || routeMapPoints.length > 0 ? (
      <WebView
        key={`driver-map-${profile.schoolCode}-${activeRoute?.id || 'none'}-${routeMapPoints.length}-${studentMapPoints.length}`}
        originWhitelist={['*']}
        source={{ html: routeMapHtml }}
        style={styles.routeMapWebView}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.routeMapFallback}>
            <Text style={styles.routeMapFallbackText}>Loading driver map...</Text>
          </View>
        )}
      />
    ) : (
      <View style={styles.routeMapFallback}>
        <Text style={styles.routeMapFallbackText}>
          {routeMapError || 'The driver map will appear once the route addresses are available.'}
        </Text>
      </View>
    )}
  </View>
</LinearGradient>
          <View style={styles.statsGrid}>
            <StatCard
              label="Routes matched"
              value={String(matchedRoutes.length)}
              icon="map-outline"
            />
            <StatCard
              label="Students assigned"
              value={String(activeAssignedStudents.length)}
              icon="people-outline"
            />
            <StatCard
              label="Vehicle"
              value={vehicleNumber}
              icon="bus-outline"
            />
            <StatCard
              label="Start time"
              value={startTime}
              icon="time-outline"
            />
          </View>

         



          <View style={styles.panel1}>
            <Text style={styles.panelTitle}>Checklist</Text>
            {checklistItems.map((item) => (
              <View key={item.label} style={styles.checklistItem}>
                <Ionicons
                  name={item.done ? 'checkbox-outline' : 'ellipse-outline'}
                  size={18}
                  color={item.done ? '#16A34A' : '#F59E0B'}
                />
                <Text style={styles.checklistText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.panel1}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Assigned Students</Text>
              <Text style={styles.panelBadge}>{activeAssignedStudents.length}</Text>
            </View>
            {activeAssignedStudentsPreview.length > 0 ? (
              activeAssignedStudentsPreview.map((student) => (
                <View key={student.username} style={styles.studentRow}>
                  <View style={styles.studentAvatar}>
                    <Text style={styles.studentAvatarText}>
                      {(student.name || student.username || 'S').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.studentTextBlock}>
                    <Text style={styles.studentName} numberOfLines={1}>
                      {student.name || student.username}
                    </Text>
                    <Text style={styles.studentMeta} numberOfLines={1}>
                      {student.className || 'Class -'} {student.section ? `• ${student.section}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.studentRouteTag} numberOfLines={1}>
                    {student.assignedRouteName || routeLabel}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>
                No students matched this route yet. Check the route assignment in the bus manager.
              </Text>
            )}
            {activeAssignedStudents.length > activeAssignedStudentsPreview.length ? (
              <Text style={styles.moreText}>
                +{activeAssignedStudents.length - activeAssignedStudentsPreview.length} more students
              </Text>
            ) : null}
          </View>

          <View style={styles.panel1}>
            <Text style={styles.panelTitle}>Route Timeline</Text>
            {routeCheckpoints.map((item, index) => (
              <View key={`${item.time}-${index}`} style={styles.agendaRow}>
                <View style={styles.agendaTimeWrap}>
                  <Text style={styles.agendaTime}>{item.time}</Text>
                </View>
                <View style={styles.agendaDotColumn}>
                  <View style={styles.agendaDot} />
                  {index !== routeCheckpoints.length - 1 ? <View style={styles.agendaLine} /> : null}
                </View>
                <Text style={styles.agendaTask}>{item.task}</Text>
              </View>
            ))}
          </View>

          <View style={styles.panel1}>
            <Text style={styles.panelTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity key={action.label} style={styles.actionCard} activeOpacity={0.85}>
                  <View style={styles.actionIconWrap}>
                    <Ionicons name={action.icon as any} size={18} color="#0F172A" />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('BusDashboard')}
            style={styles.managerLink}
          >
            <Ionicons name="briefcase-outline" size={16} color="#0F172A" />
            <Text style={styles.managerLinkText}>Open bus manager view</Text>
          </TouchableOpacity>
        </ScrollView>

        {showProfile ? (
          <View style={styles.profileOverlay} pointerEvents="box-none">
            <View style={styles.profileCard}>
              <View style={styles.profileCardHeader}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {(displayDriverProfile.name || profile.username || 'B').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileHeaderText}>
                  <Text style={styles.profileTitle}>Bus Driver Profile</Text>
                  <Text style={styles.profileSubtitle}>{displayDriverProfile.name || 'Driver account details'}</Text>
                </View>
              </View>

              <View style={styles.profileSummaryRow}>
                <View style={styles.profileSummaryPill}>
                  <Ionicons name="person-outline" size={14} color="#334155" />
                  <Text style={styles.profileSummaryText}>{profile.username || 'driver'}</Text>
                </View>
                <View style={styles.profileSummaryPill}>
                  <Ionicons name="location-outline" size={14} color="#334155" />
                  <Text style={styles.profileSummaryText}>{routeLabel}</Text>
                </View>
              </View>

              <View style={styles.profileDetailsGridExpanded}>
                <View style={styles.profileDetailItemExpanded}>
                  <Text style={styles.profileDetailLabel}>Name</Text>
                  <Text style={styles.profileDetailValue}>{displayDriverProfile.name || driverLabel}</Text>
                </View>
                <View style={styles.profileDetailItemExpanded}>
                  <Text style={styles.profileDetailLabel}>Username</Text>
                  <Text style={styles.profileDetailValue}>{profile.username || '---'}</Text>
                </View>
                <View style={styles.profileDetailItemExpanded}>
                  <Text style={styles.profileDetailLabel}>Phone</Text>
                  <Text style={styles.profileDetailValue}>{displayDriverProfile.phoneNumber || 'Not set'}</Text>
                </View>
                <View style={styles.profileDetailItemExpanded}>
                  <Text style={styles.profileDetailLabel}>Bus No.</Text>
                  <Text style={styles.profileDetailValue}>{displayDriverProfile.busNumber || vehicleNumber}</Text>
                </View>
                <View style={styles.profileDetailItemExpanded}>
                  <Text style={styles.profileDetailLabel}>Helper</Text>
                  <Text style={styles.profileDetailValue}>{displayDriverProfile.helperName || 'Not set'}</Text>
                </View>
                <View style={styles.profileDetailItemExpanded}>
                  <Text style={styles.profileDetailLabel}>Route</Text>
                  <Text style={styles.profileDetailValue}>{displayDriverProfile.routeName || routeLabel}</Text>
                </View>
              </View>

              <View style={styles.profileActions}>
                <TouchableOpacity
                  style={[styles.profileActionButton, styles.profileActionSecondary]}
                  onPress={() => setShowProfile(false)}
                >
                  <Text style={[styles.profileActionText, styles.profileActionTextSecondary]}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.profileActionButton, styles.profileActionPrimary]}
                  onPress={() => {
                    setShowProfile(false);
                    navigation.navigate('BusDriverDashboard');
                  }}
                >
                  <Text style={styles.profileActionText}>Home</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.profileActionButton, styles.profileLogoutButton]} onPress={handleLogout}>
                <Text style={styles.profileLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.footerNav}>
            <Pressable style={styles.footerNavItem} onPress={() => navigation.navigate('BusDriverDashboard')}>
              <Ionicons name="home-outline" size={20} color="#0F172A" />
              <Text style={styles.footerNavLabel}>Home</Text>
            </Pressable>
            <Pressable style={styles.footerNavItem} onPress={() => navigation.navigate('BusDashboard')}>
              <Ionicons name="bus-outline" size={20} color="#0F172A" />
              <Text style={styles.footerNavLabelMuted}>Manager</Text>
            </Pressable>
            <View pointerEvents="none" style={styles.footerCenterCurve}>
              <View style={styles.footerCurveTriangle} />
            </View>
            <Pressable style={styles.footerAddButton} onPress={() => navigation.navigate('BusDriverDashboard')}>
              <Ionicons name="person-circle-outline" size={26} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.footerNavItem} onPress={handleOpenProfilePanel}>
              {displayDriverProfile.name ? (
                <View style={styles.footerProfileBadge}>
                  <Text style={styles.footerProfileInitial}>
                    {displayDriverProfile.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Ionicons name="person-outline" size={20} color="#0F172A" />
              )}
              <Text style={styles.footerNavLabelMuted}>Profile</Text>
            </Pressable>
          </View>

          <View style={styles.footerBrandRow}>
            <Text style={styles.poweredBy}>Powered By</Text>
            <Image source={require('../assets/Cleezo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.homeIndicator} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  screenSurface: {
    backgroundColor: '#F6F7FB',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  hero: {
    backgroundColor: 'transparent',
    borderRadius: 24,
    padding: 18,
    
    shadowOpacity: 0.06,
    shadowRadius: 16,
    
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTextBlock: {
    flex: 1,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#2563EB',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  profilePanel: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
   
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  profilePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  profileBadge: {
    color: '#1D4ED8',
    backgroundColor: '#DBEAFE',
  },
  profileDetailsGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileDetailItem: {
    width: '48%',
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileDetailLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  profileDetailValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  profileCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  profileHeaderText: {
    flex: 1,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  profileSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  profileSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  profileSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  profileSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  profileDetailsGridExpanded: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileDetailItemExpanded: {
    width: '48%',
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  profileActionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  profileActionPrimary: {
    backgroundColor: '#0F172A',
  },
  profileActionSecondary: {
    backgroundColor: '#E2E8F0',
  },
  profileActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileActionTextSecondary: {
    color: '#0F172A',
  },
  profileLogoutButton: {
    marginTop: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  profileLogoutText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#DC2626',
  },
  errorBox: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#991B1B',
    fontWeight: '700',
  },
  statsGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCard: {
    width: '48%',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
  },
 panel: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: height * 0.6, // 70% of screen height
  },
   panel1: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  panelBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  panelBadgeSuccess: {
    color: '#15803D',
    backgroundColor: '#DCFCE7',
  },
  panelBadgeMuted: {
    color: '#475569',
    backgroundColor: '#E2E8F0',
  },
  routeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  routeMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  routeTimeline: {
    marginTop: 14,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563EB',
  },
  timelineLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#CBD5E1',
  },
  timelineDotMuted: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CBD5E1',
  },
  routeMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeMetaLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  routeMetaValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
  },
  panelSubtitle: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#fff',
    fontWeight: '600',
  },
  routeMapCard: {
    height:height * 0.45, // 40% of screen height
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  routeMapWebView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  routeMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
  },
  routeMapFallbackText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  studentTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  studentRouteTag: {
    maxWidth: 120,
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  moreText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  actionCard: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
  },
  agendaTimeWrap: {
    width: 74,
  },
  agendaTime: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '800',
  },
  agendaDotColumn: {
    width: 16,
    alignItems: 'center',
  },
  agendaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    marginTop: 3,
  },
  agendaLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#CBD5E1',
    marginTop: 4,
  },
  agendaTask: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    fontWeight: '600',
    paddingBottom: 2,
  },
  managerLink: {
    marginTop: 16,
    marginBottom: 4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  managerLinkText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    minHeight: 68,
    flexShrink: 0,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 0,
    backgroundColor: '#f6f6f7',
    borderTopWidth: 1,
    borderTopColor: '#ECECF0',
    elevation: 8,
  },
  footerNav: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  footerNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
  },
  footerNavLabel: {
    marginTop: 0,
    fontSize: 7,
    color: '#111111',
    fontWeight: '700',
  },
  footerNavLabelMuted: {
    marginTop: 0,
    fontSize: 7,
    color: '#888888',
    fontWeight: '700',
  },
  footerCenterCurve: {
    position: 'absolute',
    left: '50%',
    top: 0,
    width: 72,
    height: 18,
    marginLeft: -36,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-start',
    pointerEvents: 'none',
  },
  footerCurveTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 36,
    borderRightWidth: 36,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#f6f6f7',
    opacity: 0.95,
  },
  footerAddButton: {
    position: 'absolute',
    left: '50%',
    top: -26,
    marginLeft: -30,
    width: 60,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F04B3A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  footerProfileBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerProfileInitial: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 0,
  },
  poweredBy: {
    fontSize: 11,
    color: '#8A8A8F',
    fontWeight: '600',
  },
  logo: {
    width: 64,
    height: 18,
  },
  homeIndicator: {
    marginTop: 4,
    width: 128,
    height: 6,
    borderRadius: 4,
    backgroundColor: '#1F1F1F',
    opacity: 0.65,
  },
      dashboardTopGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 180,
      zIndex: 0,
    },
});

export default BusDriverDashboard;
