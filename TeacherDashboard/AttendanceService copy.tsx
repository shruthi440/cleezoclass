import { PermissionsAndroid, Platform, Alert } from 'react-native';
import Geolocation, {
  GeoPosition,
  GeoError,
} from 'react-native-geolocation-service';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';

/* ===================== CONSTANTS ===================== */

const API_BASE_URL = 'http://162.215.210.38:3010/api';
const DEFAULT_RADIUS = 100; // meters
const DEFAULT_MORNING_START_MINUTES = 9 * 60;
const DEFAULT_MORNING_END_MINUTES = 11 * 60;
const MORNING_LATE_END_MINUTES = 12 * 60;
const MORNING_EARLY_MINUTES = 60;
const MORNING_AFTER_MINUTES = 60;
const DEFAULT_EVENING_START_MINUTES = 16 * 60;
const WINDOW_LENGTH_MINUTES = 2 * 60;

let attendanceServiceInstance: (() => void) | null = null;
let attendanceSchedulerInstance: ReturnType<typeof setInterval> | null = null;
let foregroundCheckInterval: ReturnType<typeof setInterval> | null = null;
let foregroundServiceRegistered = false;
let foregroundServiceRunning = false;

type AttendanceWindow = {
  morningStartMinutes: number;
  morningEndMinutes: number;
  eveningStartMinutes: number;
  eveningEndMinutes: number;
  source: 'default' | 'backend';
  updatedAt: number;
};

let attendanceWindow: AttendanceWindow = {
  morningStartMinutes: DEFAULT_MORNING_START_MINUTES,
  morningEndMinutes: MORNING_LATE_END_MINUTES,
  eveningStartMinutes: DEFAULT_EVENING_START_MINUTES,
  eveningEndMinutes: DEFAULT_EVENING_START_MINUTES + WINDOW_LENGTH_MINUTES,
  source: 'default',
  updatedAt: 0,
};

const FOREGROUND_CHANNEL_ID = 'attendance-tracking-channel';
const FOREGROUND_NOTIFICATION_ID = 'attendance-tracking-service';

/* ===================== TYPES ===================== */

interface SchoolLocation {
  latitude: number;
  longitude: number;
}

interface AttendancePayload {
  username: string;
  schoolCode: string;
  latitude: number;
  longitude: number;
  status: 'present' | 'absent';
  date: string;
  time: string;
  slot: AttendanceSlot;
  accuracy: number;
  timestamp: number;
  locationVerified: boolean;
}

interface AttendanceCallbackData {
  status: string;
  distance?: string;
  marked?: boolean;
  isPresent?: boolean;
  lastUpdated?: string;
  coordinates?: {
    user: string;
    school: string;
  };
  accuracy?: number;
  rawPosition?: GeoPosition;
  locationVerified?: boolean;
  error?: boolean;
  showManualEntry?: boolean;
  errorDetails?: string;
  errorCode?: number;
  radius?: number;
}

type AttendanceSlot = 'morning' | 'evening';

const getTodayKey = () => new Date().toISOString().split('T')[0];

const parseTimeToMinutes = (timeValue?: string | null): number | null => {
  if (!timeValue) return null;
  const raw = String(timeValue).trim();
  if (!raw) return null;

  // Accept "HH:mm", "HH:mm:ss", or datetime strings like "YYYY-MM-DD HH:mm:ss"
  const timePart = raw.includes('T')
    ? raw.split('T')[1]
    : raw.includes(' ')
      ? raw.split(' ')[1]
      : raw;

  const parts = timePart.split(':');
  if (parts.length < 2) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
};

const buildAttendanceWindow = (
  loginTime?: string | null,
  logoutTime?: string | null
): AttendanceWindow => {
  const loginMinutes = parseTimeToMinutes(loginTime);
  const logoutMinutes = parseTimeToMinutes(logoutTime);

  const morningStartMinutes =
    loginMinutes !== null ? loginMinutes - MORNING_EARLY_MINUTES : DEFAULT_MORNING_START_MINUTES;
  const morningEndMinutes =
    loginMinutes !== null ? loginMinutes + MORNING_AFTER_MINUTES : MORNING_LATE_END_MINUTES;

  const eveningStartMinutes = logoutMinutes ?? DEFAULT_EVENING_START_MINUTES;

  return {
    morningStartMinutes,
    morningEndMinutes,
    eveningStartMinutes,
    eveningEndMinutes: eveningStartMinutes + WINDOW_LENGTH_MINUTES,
    source: loginMinutes || logoutMinutes ? 'backend' : 'default',
    updatedAt: Date.now(),
  };
};

const getAttendanceWindowCacheKey = (date: string) =>
  `attendance_window_${date}`;

const formatMinutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

const buildTrackingWindowMessage = () => {
  const morningStart = formatMinutesToTime(attendanceWindow.morningStartMinutes);
  const morningEnd = formatMinutesToTime(attendanceWindow.morningEndMinutes);
  const eveningStart = formatMinutesToTime(attendanceWindow.eveningStartMinutes);
  const eveningEnd = formatMinutesToTime(attendanceWindow.eveningEndMinutes);

  return `Monitoring is active during ${morningStart}–${morningEnd} and ${eveningStart}–${eveningEnd}.`;
};

const loadAttendanceWindowFromCache = async (): Promise<AttendanceWindow | null> => {
  try {
    const cacheKey = getAttendanceWindowCacheKey(getTodayKey());
    const cached = await AsyncStorage.getItem(cacheKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed?.loginTime && !parsed?.logoutTime) return null;
    return buildAttendanceWindow(parsed.loginTime, parsed.logoutTime);
  } catch {
    return null;
  }
};

const saveAttendanceWindowToCache = async (
  loginTime?: string | null,
  logoutTime?: string | null
) => {
  const cacheKey = getAttendanceWindowCacheKey(getTodayKey());
  await AsyncStorage.setItem(
    cacheKey,
    JSON.stringify({ loginTime, logoutTime, updatedAt: Date.now() })
  );
};

const refreshAttendanceWindow = async () => {
  try {
    console.log('🔁 Refreshing attendance window...');
    const cachedWindow = await loadAttendanceWindowFromCache();
    if (cachedWindow) {
      attendanceWindow = cachedWindow;
      console.log('🗂️ Loaded attendance window from cache:', attendanceWindow);
    }

    const schoolCode = await AsyncStorage.getItem('schoolCode');
    if (!schoolCode) {
      console.warn('⚠️ Missing schoolCode, cannot fetch attendance window');
      return;
    }

    const response = await axios.get(
      `${API_BASE_URL}/attendance/login-logout-time`,
      { params: { schoolCode }, timeout: 10000 }
    );

    const loginTime = response?.data?.loginTime ?? null;
    const logoutTime = response?.data?.logoutTime ?? null;
    const uploadedDate = response?.data?.uploadedDate ?? null;
    console.log('📥 Attendance window response:', {
      loginTime,
      logoutTime,
      uploadedDate,
    });

    if (loginTime || logoutTime) {
      attendanceWindow = buildAttendanceWindow(loginTime, logoutTime);
      await saveAttendanceWindowToCache(loginTime, logoutTime);
      console.log('✅ Attendance window set from backend:', attendanceWindow);
    } else {
      console.warn('⚠️ Backend returned empty times, using existing window:', attendanceWindow);
    }
  } catch (err) {
    console.warn('⚠️ Failed to refresh attendance window:', (err as any)?.message || err);
  }
};

const getCurrentSlot = (now = new Date()): AttendanceSlot | null => {
  const minutes = now.getHours() * 60 + now.getMinutes();
  // Debug: log once per minute boundary
  if (now.getSeconds() === 0) {
    console.log('🕒 Slot check', {
      time: now.toTimeString().split(' ')[0],
      minutes,
      window: attendanceWindow,
    });
  }
  if (
    minutes >= attendanceWindow.morningStartMinutes &&
    minutes < attendanceWindow.morningEndMinutes
  ) return 'morning';
  if (
    minutes >= attendanceWindow.eveningStartMinutes &&
    minutes < attendanceWindow.eveningEndMinutes
  ) return 'evening';
  return null;
};

const getSlotStorageKey = (slot: AttendanceSlot, date: string) =>
  `attendance_marked_${slot}_${date}`;
const getMorningPresentKey = (date: string) => `attendance_morning_present_${date}`;
const getMorningAbsentNotifiedKey = (date: string) => `attendance_absent_notified_${date}`;
const getEveningSummaryNotifiedKey = (date: string) => `attendance_evening_summary_notified_${date}`;
const getLateArrivalNotifiedKey = (date: string) => `attendance_late_notified_${date}`;

const getCurrentPositionAsync = (): Promise<GeoPosition> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 15000,
    });
  });

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceInMeters = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) => {
  const earthRadius = 6371000;
  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const startLat = toRadians(fromLat);
  const endLat = toRadians(toLat);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(startLat) * Math.cos(endLat) *
    Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const showAttendanceResultNotification = async (
  slot: AttendanceSlot,
  status: string,
  distance?: string
) => {
  const now = new Date();
  const slotLabel = slot === 'morning' ? 'Morning' : 'Evening';
  const cleanStatus = String(status).toLowerCase() === 'present' ? 'Present' : 'Absent';
  const summary = `${slotLabel}: ${cleanStatus} at ${now.toLocaleTimeString()}`;
  const detailed = distance ? `${summary} • Distance: ${distance}` : summary;

  await notifee.displayNotification({
    id: FOREGROUND_NOTIFICATION_ID,
    title: 'Attendance Tracking Active',
    body: detailed,
    android: {
      channelId: FOREGROUND_CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      pressAction: { id: 'default' },
    },
  });

  await notifee.displayNotification({
    id: `attendance-result-${slot}-${now.getTime()}`,
    title: `Attendance ${slotLabel}`,
    body: cleanStatus,
    android: {
      channelId: FOREGROUND_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
};

const showMorningAbsentNotification = async () => {
  await notifee.displayNotification({
    id: `attendance-absent-${Date.now()}`,
    title: 'Attendance Status',
    body: 'You were absent today (not marked present before the scheduled time).',
    android: {
      channelId: FOREGROUND_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
};

const showLateArrivalNotification = async (timeLabel: string) => {
  await notifee.displayNotification({
    id: `attendance-late-${Date.now()}`,
    title: 'Late Arrival',
    body: `You checked in at ${timeLabel}. This is after the scheduled time.`,
    android: {
      channelId: FOREGROUND_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
};

const showEveningSummaryNotification = async (
  entryTime: string,
  exitTime: string,
  workingHours: string
) => {
  await notifee.displayNotification({
    id: `attendance-evening-summary-${Date.now()}`,
    title: 'Attendance Summary',
    body: `Login: ${entryTime} | Logout: ${exitTime} | Hours: ${workingHours}`,
    android: {
      channelId: FOREGROUND_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
  });
};

const isLateMorning = (now = new Date()): boolean => {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= attendanceWindow.morningEndMinutes;
};

const checkAndNotifyMorningAbsence = async () => {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < attendanceWindow.morningEndMinutes) return;

  const today = getTodayKey();
  const morningPresent = await AsyncStorage.getItem(getMorningPresentKey(today));
  const absentNotified = await AsyncStorage.getItem(getMorningAbsentNotifiedKey(today));

  if (morningPresent !== 'true' && absentNotified !== 'true') {
    await showMorningAbsentNotification();
    await AsyncStorage.setItem(getMorningAbsentNotifiedKey(today), 'true');
  }
};

const markAttendanceForSlotIfNeeded = async () => {
  const userType = await AsyncStorage.getItem('userType');
  const username = await AsyncStorage.getItem('username');
  const schoolCode = await AsyncStorage.getItem('schoolCode');

  if (userType !== 'teacher' || !username || !schoolCode) return;

  const slot = getCurrentSlot();
  if (!slot) return;

  const today = getTodayKey();
  const slotKey = getSlotStorageKey(slot, today);
  const alreadyMarked = await AsyncStorage.getItem(slotKey);
  if (alreadyMarked === 'true') return;

  const permissionGranted = await requestLocationPermission();
  if (!permissionGranted) return;

  const position = await getCurrentPositionAsync();
  const { latitude, longitude, accuracy } = position.coords;
  const now = new Date();

  const payload = {
    username,
    schoolCode,
    latitude,
    longitude,
    slot,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    accuracy,
    timestamp: now.getTime(),
    locationVerified: !position.mocked && accuracy <= 100,
  };

  const response = await axios.post(
    `${API_BASE_URL}/teacher-attendancetracking`,
    payload,
    { timeout: 10000 }
  );

  if (response?.data?.status) {
    const status = String(response.data.status);
    const distance = response?.data?.distance ? String(response.data.distance) : '';

    const storageEntries: [string, string][] = [
      [slotKey, 'true'],
      ['lastAttendanceStatus', status],
      ['attendance_last_result', JSON.stringify({
        slot,
        status,
        distance,
        timestamp: now.toISOString(),
      })],
      ['attendance_last_date', now.toDateString()],
    ];

    if (slot === 'morning' && status.toLowerCase() === 'present') {
      storageEntries.push([getMorningPresentKey(today), 'true']);
    }

    await AsyncStorage.multiSet([
      ...storageEntries,
    ]);

    if (
      slot === 'evening' &&
      response?.data?.entryTime &&
      response?.data?.exitTime &&
      response?.data?.workingHours
    ) {
      const summaryNotified = await AsyncStorage.getItem(getEveningSummaryNotifiedKey(today));
      if (summaryNotified !== 'true') {
        await showEveningSummaryNotification(
          String(response.data.entryTime),
          String(response.data.exitTime),
          String(response.data.workingHours)
        );
        await AsyncStorage.setItem(getEveningSummaryNotifiedKey(today), 'true');
      }
    }

    if (!(slot === 'evening' && status.toLowerCase() === 'present')) {
      await showAttendanceResultNotification(slot, status, distance);
      console.log(`✅ Attendance marked for ${slot}:`, status);
    } else {
      console.log(`ℹ️ Evening present suppressed`);
    }

    if (slot === 'morning' && isLateMorning(now)) {
      const lateNotified = await AsyncStorage.getItem(getLateArrivalNotifiedKey(today));
      if (lateNotified !== 'true') {
        await showLateArrivalNotification(now.toLocaleTimeString());
        await AsyncStorage.setItem(getLateArrivalNotifiedKey(today), 'true');
      }
    }
  }
};

const startForegroundCheckingLoop = async () => {
  if (foregroundCheckInterval) clearInterval(foregroundCheckInterval);

  await refreshAttendanceWindow();

  // Run once immediately
  checkAndNotifyMorningAbsence().catch(err =>
    console.error('Morning absence notification check failed:', err?.message || err)
  );
  markAttendanceForSlotIfNeeded().catch(err =>
    console.error('Attendance slot check failed:', err?.message || err)
  );

  foregroundCheckInterval = setInterval(() => {
    refreshAttendanceWindow().catch(err =>
      console.error('Attendance window refresh failed:', err?.message || err)
    );
    checkAndNotifyMorningAbsence().catch(err =>
      console.error('Morning absence notification check failed:', err?.message || err)
    );
    markAttendanceForSlotIfNeeded().catch(err =>
      console.error('Attendance slot check failed:', err?.message || err)
    );
  }, 60 * 1000);
};

export const startPersistentAttendanceTracking = async (): Promise<void> => {
  const userType = await AsyncStorage.getItem('userType');
  if (userType !== 'teacher') return;
  if (foregroundServiceRunning) return;

  await refreshAttendanceWindow();

  // Android 14+ crashes if location foreground service starts without
  // runtime location permission already granted.
  const permissionGranted = await requestLocationPermission();
  if (!permissionGranted) {
    console.warn('⚠️ Persistent attendance tracking not started: location permission denied');
    return;
  }

  await notifee.createChannel({
    id: FOREGROUND_CHANNEL_ID,
    name: 'Attendance Tracking',
    importance: AndroidImportance.HIGH,
  });

  if (!foregroundServiceRegistered) {
    notifee.registerForegroundService(() => {
      return new Promise(() => {
        startForegroundCheckingLoop().catch(err =>
          console.error('Foreground attendance loop start failed:', err)
        );
      });
    });
    foregroundServiceRegistered = true;
  }

  await notifee.displayNotification({
    id: FOREGROUND_NOTIFICATION_ID,
    title: 'Attendance Tracking Active',
    body: buildTrackingWindowMessage(),
    android: {
      channelId: FOREGROUND_CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      pressAction: { id: 'default' },
    },
  });

  foregroundServiceRunning = true;
  await AsyncStorage.setItem('attendanceServiceActive', 'true');
  console.log('✅ Persistent attendance tracking started');
};

export const stopPersistentAttendanceTracking = async (): Promise<void> => {
  if (foregroundCheckInterval) {
    clearInterval(foregroundCheckInterval);
    foregroundCheckInterval = null;
  }

  try {
    await notifee.stopForegroundService();
  } catch {}

  try {
    await notifee.cancelNotification(FOREGROUND_NOTIFICATION_ID);
  } catch {}

  foregroundServiceRunning = false;
  await AsyncStorage.setItem('attendanceServiceActive', 'false');
  console.log('🛑 Persistent attendance tracking stopped');
};

export const resumePersistentAttendanceTrackingIfNeeded = async (): Promise<void> => {
  const userType = await AsyncStorage.getItem('userType');
  const serviceActive = await AsyncStorage.getItem('attendanceServiceActive');

  if (userType !== 'teacher') return;
  if (serviceActive !== 'true') return;

  console.log('🔁 Resuming persistent attendance tracking (boot or restart)');
  await startPersistentAttendanceTracking();
};

/* ===================== SCHEDULER ===================== */

const isWithinTrackingWindow = (now = new Date()): boolean => {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const morningStart = attendanceWindow.morningStartMinutes;
  const morningEnd = attendanceWindow.morningEndMinutes;
  const eveningStart = attendanceWindow.eveningStartMinutes;
  const eveningEnd = attendanceWindow.eveningEndMinutes;

  const within =
    (totalMinutes >= morningStart && totalMinutes < morningEnd) ||
    (totalMinutes >= eveningStart && totalMinutes < eveningEnd)
  ;
  if (now.getSeconds() === 0) {
    console.log('⏱️ Window check', {
      time: now.toTimeString().split(' ')[0],
      totalMinutes,
      morningStart,
      morningEnd,
      eveningStart,
      eveningEnd,
      within,
    });
  }
  return within;
};

const stopAttendanceTrackingInternal = async () => {
  if (attendanceServiceInstance) {
    attendanceServiceInstance();
    attendanceServiceInstance = null;
  }
  await AsyncStorage.setItem('attendanceServiceActive', 'false');
};

const startAttendanceTrackingInternal = async (
  callback?: (data: AttendanceCallbackData) => void
) => {
  if (attendanceServiceInstance) return;
  const stopFn = await startAttendanceService(callback);
  attendanceServiceInstance = stopFn;
  await AsyncStorage.setItem('attendanceServiceActive', 'true');
};

const evaluateAttendanceWindow = async (
  callback?: (data: AttendanceCallbackData) => void
) => {
  const userType = await AsyncStorage.getItem('userType');
  if (userType !== 'teacher') {
    await stopAttendanceTrackingInternal();
    return;
  }

  if (isWithinTrackingWindow()) {
    await startAttendanceTrackingInternal(callback);
  } else {
    await stopAttendanceTrackingInternal();
  }
};

export const startAttendanceWindowScheduler = async (
  callback?: (data: AttendanceCallbackData) => void
): Promise<() => void> => {
  if (attendanceSchedulerInstance) {
    clearInterval(attendanceSchedulerInstance);
    attendanceSchedulerInstance = null;
  }

  await refreshAttendanceWindow();
  await evaluateAttendanceWindow(callback);

  // Recheck every minute to start/stop exactly by time window
  attendanceSchedulerInstance = setInterval(() => {
    evaluateAttendanceWindow(callback).catch(err =>
      console.error('Attendance scheduler error:', err)
    );
  }, 60 * 1000);

  return () => {
    if (attendanceSchedulerInstance) {
      clearInterval(attendanceSchedulerInstance);
      attendanceSchedulerInstance = null;
    }
    stopAttendanceTrackingInternal().catch(err =>
      console.error('Attendance stop error:', err)
    );
  };
};

/* ===================== MAIN FUNCTIONS ===================== */

export const startAttendanceService = async (
  callback?: (data: AttendanceCallbackData) => void,
  selectedRadius: number | null = null
): Promise<() => void> => {
  try {
    await refreshAttendanceWindow();
    const username = await AsyncStorage.getItem('username');
    const schoolCode = await AsyncStorage.getItem('schoolCode');

    if (!username || !schoolCode) {
      throw new Error('School code or username not found');
    }

    const [schoolLocation, radius] = await Promise.all([
      getSchoolCoordinates(schoolCode),
      selectedRadius !== null
        ? Promise.resolve(Number(selectedRadius))
        : getRadius(schoolCode),
    ]);

    const permissionGranted = await requestLocationPermission();
    if (!permissionGranted) {
      throw new Error('Location permission denied');
    }

    if (attendanceServiceInstance) attendanceServiceInstance();

    const stopMonitor = monitorAttendance(
      username,
      schoolCode,
      schoolLocation,
      radius,
      callback
    );

    return () => {
      stopMonitor?.();
      attendanceServiceInstance = null;
    };
  } catch (error: any) {
    console.error('Attendance service error:', error);

    callback?.({
      status: '❌ ' + error.message,
      error: true,
      showManualEntry: true,
    });

    throw error;
  }
};

export const updateAttendanceRadius = async (
  newRadius: number,
  callback?: (data: AttendanceCallbackData) => void
) => {
  const radius = Math.max(Number(newRadius) || DEFAULT_RADIUS, 50);
  return startAttendanceService(callback, radius);
};

/* ===================== API HELPERS ===================== */

const getSchoolCoordinates = async (
  schoolCode: string
): Promise<SchoolLocation> => {
  const response = await axios.post(`${API_BASE_URL}/school-coordinates`, {
    schoolCode,
  });

  if (!response.data?.latitude || !response.data?.longitude) {
    throw new Error('Invalid coordinates from server');
  }

  return {
    latitude: Number(response.data.latitude),
    longitude: Number(response.data.longitude),
  };
};

const getRadius = async (schoolCode: string): Promise<number> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/radiustracking`, {
      schoolCode,
    });

    const radius = Number(response.data?.radius);
    return isNaN(radius) ? DEFAULT_RADIUS : Math.max(radius, 50);
  } catch {
    return DEFAULT_RADIUS;
  }
};

/* ===================== LOCATION MONITOR ===================== */

const monitorAttendance = (
  username: string,
  schoolCode: string,
  schoolLocation: SchoolLocation,
  radius: number,
  callback?: (data: AttendanceCallbackData) => void
): (() => void) => {
  let lastStatus: 'present' | 'absent' | null = null;
  let watchId: number | null = null;

  watchId = Geolocation.watchPosition(
    async (position: GeoPosition) => {
      try {
        const { latitude, longitude, accuracy } = position.coords;
        const currentTime = new Date();
        const distanceMeters = getDistanceInMeters(
          latitude,
          longitude,
          schoolLocation.latitude,
          schoolLocation.longitude
        );
        const statusFromLocation: 'present' | 'absent' =
          distanceMeters <= radius ? 'present' : 'absent';

        const slotNow =
          getCurrentSlot(currentTime) || (currentTime.getHours() < 12 ? 'morning' : 'evening');

        const payload: AttendancePayload = {
          username,
          schoolCode,
          latitude,
          longitude,
          slot: slotNow,
          date: currentTime.toISOString().split('T')[0],
          time: currentTime.toTimeString().split(' ')[0],
          status: statusFromLocation,
          accuracy,
          timestamp: currentTime.getTime(),
          locationVerified: !position.mocked && accuracy <= 100,
        };

        // Send to backend
        const response = await axios.post(
          `${API_BASE_URL}/teacher-attendancetracking`,
          payload,
          { timeout: 5000 }
        );

        const statusFromBackend =
          response.data?.isPresent === true
            ? 'present'
            : response.data?.isPresent === false
              ? 'absent'
              : statusFromLocation;
        const distanceFromBackend = `${Math.round(distanceMeters)}m`;
        const radiusFromBackend = radius;

        if (response.data?.isPresent === undefined) {
          console.warn('⚠️ Attendance response did not include isPresent; using local status');
        }

        // Only show alert if status changed (suppress evening present)
        if (slotNow === 'evening' && statusFromBackend === 'present') {
          callback?.({
            status: '⏳ Monitoring',
            distance: distanceFromBackend,
            radius: radiusFromBackend,
            isPresent: false,
            marked: false,
            lastUpdated: currentTime.toLocaleTimeString(),
            accuracy,
            locationVerified: payload.locationVerified,
            rawPosition: position,
          });
          return;
        }

        if (statusFromBackend === 'present' && lastStatus !== 'present') {
          showAlert('Attendance Alert!', 'Good Morning! Attendance marked PRESENT', 'OK');
          lastStatus = 'present';
        } else if (statusFromBackend === 'absent' && lastStatus !== 'absent') {
          showAlert('Attendance Alert!', 'You are away from school premises. Marked ABSENT', 'OK');
          lastStatus = 'absent';
        }

        callback?.({
          status: statusFromBackend === 'present' ? '✅ Present' : '❌ Absent',
          distance: distanceFromBackend,
          radius: radiusFromBackend,
          isPresent: statusFromBackend === 'present',
          marked: true,
          lastUpdated: currentTime.toLocaleTimeString(),
          accuracy,
          locationVerified: payload.locationVerified,
          rawPosition: position,
        });
      } catch (err: any) {
        callback?.({
          status: '❌ Processing error',
          error: true,
          showManualEntry: true,
          errorDetails: err.message,
        });
      }
    },
    (error: GeoError) => {
      showAlert('Location Error', error.message, 'OK');
      callback?.({
        status: '❌ Location error',
        error: true,
        showManualEntry: true,
        errorCode: error.code,
      });
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10,
    }
  );

  return () => {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
    }
    lastStatus = null;
  };
};
/* ===================== UTILITIES ===================== */

const saveAttendanceLocally = async (data: AttendancePayload) => {
  const existing = (await AsyncStorage.getItem('pendingAttendance')) || '[]';
  const parsed: AttendancePayload[] = JSON.parse(existing);
  parsed.push(data);
  await AsyncStorage.setItem('pendingAttendance', JSON.stringify(parsed));
};

const showAlert = (title: string, message: string, buttonText: string) => {
  Alert.alert(title, message, [{ text: buttonText }], { cancelable: false });
};

export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
