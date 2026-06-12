import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import LinearGradient from 'react-native-linear-gradient';
import notifee, { AndroidImportance } from '@notifee/react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { createAppStyles } from '../App.styles';
import {
  startPersistentAttendanceTracking,
  stopPersistentAttendanceTracking,
} from './AttendanceService';
import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';

type IconKind = 'material' | 'fontawesome';

type DashboardTile = {
  label: string;
  subtitle: string;
  icon: string;
  kind: IconKind;
};

type StatCard = {
  title: string;
  subtitle: string;
  footer: string;
  icon: string;
  kind: IconKind;
  background: string;
};

type AttendanceSnapshot = {
  status: string;
  distance: string;
  lastUpdated: string;
};

const logoImage: ImageSourcePropType = require('../assets/Cleezo.png');
const backArrowImage: ImageSourcePropType = require('../assets/Arrow.png');
const REMINDER_NOTIFICATION_CHANNEL_ID = 'reminders';
const teacherPhotoUploadBase = 'https://cleezoclass.com:4000/CRM/public/uploads';

const decodeHexText = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return raw;

  try {
    const bufferCtor = (globalThis as any).Buffer;
    if (bufferCtor?.from) {
      return bufferCtor.from(hex, 'hex').toString('utf8');
    }
  } catch {}

  return raw;
};

const decodeBase64Text = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const atobFn = (globalThis as any).atob;
    if (typeof atobFn === 'function') {
      return atobFn(raw);
    }
  } catch {}

  try {
    const bufferCtor = (globalThis as any).Buffer;
    if (bufferCtor?.from) {
      return bufferCtor.from(raw, 'base64').toString('utf8');
    }
  } catch {}

  return '';
};

const resolveTeacherPhotoUri = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const decoded = decodeHexText(raw);
  const normalized = String(decoded || raw).trim();
  if (!normalized) return '';
  if (normalized.startsWith('data:image')) {
    const base64Part = normalized.split(',')[1] || '';
    const decodedPath = String(decodeBase64Text(base64Part) || '').trim();
    if (
      decodedPath.includes('CRM/public/uploads') ||
      decodedPath.startsWith('/uploads/') ||
      decodedPath.startsWith('uploads/')
    ) {
      const stripped = decodedPath.replace(/^\/+/, '');
      const relativePath = stripped
        .replace(/^CRM\/public\/uploads\/?/i, '')
        .replace(/^uploads\/?/i, '')
        .replace(/^\/+/, '');
      return `${teacherPhotoUploadBase}/${relativePath}`;
    }

    if (decodedPath.startsWith('http://') || decodedPath.startsWith('https://')) {
      return decodedPath;
    }

    return normalized;
  }
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;

  const stripped = normalized.replace(/^\/+/, '');
  if (stripped.includes('CRM/public/uploads') || stripped.startsWith('uploads/')) {
    const relativePath = stripped
      .replace(/^CRM\/public\/uploads\/?/i, '')
      .replace(/^uploads\/?/i, '')
      .replace(/^\/+/, '');
    return `${teacherPhotoUploadBase}/${relativePath}`;
  }

  return normalized;
};

const dashboardTilesMap: Record<string, DashboardTile[]> = {
  'Daily Routines': [
    { label: 'Attendance', subtitle: 'Mark class presence', icon: 'how-to-reg', kind: 'material' },
    { label: 'Homework', subtitle: 'Assign daily work', icon: 'assignment', kind: 'material' },
    { label: 'Time table', subtitle: 'Check schedule', icon: 'schedule', kind: 'material' },
    { label: 'Topic of day', subtitle: 'Share today topic', icon: 'today', kind: 'material' },
    { label: 'Behaviour', subtitle: 'Track student conduct', icon: 'person', kind: 'material' },
    { label: 'Photo', subtitle: 'Upload media', icon: 'photo-library', kind: 'material' },
    { label: 'Calendar', subtitle: 'Plan events', icon: 'event', kind: 'material' },
    { label: 'Scan', subtitle: 'Scan QR code', icon: 'qr-code-scanner', kind: 'material' },
    { label: 'Salary', subtitle: 'View salary info', icon: 'payments', kind: 'material' },
    { label: 'Leave', subtitle: 'Leave requests', icon: 'event-busy', kind: 'material' },
    { label: 'Messages', subtitle: 'Open conversations', icon: 'chat', kind: 'material' },
    { label: 'Chat Requests', subtitle: 'Manage chat access', icon: 'forum', kind: 'material' },
    { label: 'Announcements', subtitle: 'School updates', icon: 'campaign', kind: 'material' },
    // { label: 'Student Report', icon: 'description', kind: 'material' },
  ],

};

const teacherDashboardCardStyles = StyleSheet.create({
  summaryActionCard: {
    backgroundColor: '#FFF',
  },
  cardWrapper: {
    width: '46.6%',
    minHeight: 112,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: 12,
    overflow: 'visible',
  },
  card: {
    width: '100%',
    minHeight: 112,
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
  cornerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 34,
    height: 112,
    overflow: 'hidden',
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 80,
    backgroundColor: 'transparent',
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
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingTop: 44,
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

const renderIcon = (kind: IconKind, name: string, color: string, size: number) => {
  if (kind === 'fontawesome') {
    return <FontAwesome name={name} size={size} color={color} />;
  }

  return <MaterialIcons name={name} size={size} color={color} />;
};

const triggerAttendanceNotification = async (username: string, schoolCode: string) => {
  try {
    const now = new Date();
    if (now.getHours() < 10) return;

    const lastShown = await AsyncStorage.getItem('lastAttendanceNotification');
    const today = now.toDateString();
    if (lastShown === today) return;

    const url = `http://162.215.210.38:3010/api/teacher-attendance-alert?username=${username}&schoolCode=${schoolCode}`;
    const response = await fetch(url);

    if (!response.ok) {
      return;
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!data || !data.alert) return;

    const errors: string[] = [];
    const teacherName = data.teacherName || username;

    if (!data.designation) {
      errors.push(`Teacher subject (designation) missing for ${teacherName}`);
    }

    const teachesFields = [
      'teaches_to_1',
      'teaches_to_2',
      'teaches_to_3',
      'teaches_to_4',
      'teaches_to_5',
      'teaches_to_6',
      'teaches_to_7',
      'teaches_to_8',
      'teaches_to_9',
      'teaches_to_10',
    ];

    const assignedClasses = teachesFields.filter((field) => data[field]);
    if (assignedClasses.length === 0) {
      errors.push(`No classes assigned to ${teacherName}`);
    }

    if (errors.length > 0) {
      await notifee.displayNotification({
        title: `⚠️ Attendance Data Issue for ${teacherName}`,
        body: errors.join(' | '),
        android: {
          channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'attendance' },
        },
      });
      await AsyncStorage.setItem('lastAttendanceNotification', today);
      return;
    }

    await notifee.displayNotification({
      title: '📋 Attendance Reminder',
      body: data.message || 'You have pending attendance tasks.',
      android: {
        channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'attendance' },
      },
    });

    await AsyncStorage.setItem('lastAttendanceNotification', today);
  } catch (error) {
  }
};

const triggerHomeworkNotification = async (username: string, schoolCode: string) => {
  try {
    const now = new Date();
    if (now.getHours() < 18) return;

    const lastShown = await AsyncStorage.getItem('lastHomeworkNotification');
    const today = now.toDateString();
    if (lastShown === today) return;

    const url = `http://162.215.210.38:3010/api/check-homework/${username}?schoolCode=${schoolCode}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'user-type': 'teacher',
      },
    });

    if (!response.ok) {
      return;
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!data?.alert) return;

    await notifee.displayNotification({
      title: '📘 Homework Reminder',
      body: `${data.alert} — School: ${schoolCode}`,
      android: {
        channelId: REMINDER_NOTIFICATION_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'homework' },
      },
    });

    await AsyncStorage.setItem('lastHomeworkNotification', today);
  } catch (error) {
  }
};

type TeacherProfile = {
  username: string;
  name: string;
  designation: string;
  schoolCode: string;
  userType: string;
  phoneNo: string;
  subject: string;
  teacherId: string;
  email: string;
  photoUrl: string;
  photo: string;
  teachesToClasses: string[];
  teaches_to_1?: number | null;
  teaches_to_2?: number | null;
  teaches_to_3?: number | null;
  teaches_to_4?: number | null;
  teaches_to_5?: number | null;
  teaches_to_6?: number | null;
  teaches_to_7?: number | null;
  teaches_to_8?: number | null;
  teaches_to_9?: number | null;
  teaches_to_10?: number | null;
};

type TeacherDashboardParams = {
  username?: string;
  name?: string;
  moduleLabel?: string;
  openProfilePanel?: boolean;
};

type RootStackParamList = {
  TeacherAdmissionDashboard: TeacherDashboardParams | undefined;
  TeacherDashboard: TeacherDashboardParams | undefined;
  TeacherAttendance: TeacherDashboardParams | undefined;
  TeacherBehaviour: TeacherDashboardParams | undefined;
  TeacherTimetable: TeacherDashboardParams | undefined;
  TeacherEventMediaUpload: TeacherDashboardParams | undefined;
  TeacherSalary: TeacherDashboardParams | undefined;
  TeacherCalender: TeacherDashboardParams | undefined;
  TeacherHomework: TeacherDashboardParams | undefined;
  TopicOfDay: TeacherDashboardParams | undefined;
  TeacherLeaveRequest: TeacherDashboardParams | undefined;
  TeacherChatAndEvents: TeacherDashboardParams | undefined;
  TeacherMessage: TeacherDashboardParams | undefined;
  TeacherTickets: TeacherDashboardParams | undefined;
  TeacherDetails: TeacherDashboardParams | undefined;
  TeacherQuestionPaperGeneration: TeacherDashboardParams | undefined;
  TeacherCounselling: TeacherDashboardParams | undefined;
  TeacherAnnouncements: TeacherDashboardParams | undefined;
  ScanPull: undefined;
  ParentDashboard: { username?: string; name?: string } | undefined;
  TeacherLogin: undefined;
};

const TeacherDashboard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<{ TeacherDashboard: TeacherDashboardParams }, 'TeacherDashboard'>>();
  const isScreenFocused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const styles = createAppStyles({ phoneWidth, phoneHeight });
  const summaryImageAnimValues = useRef([new Animated.Value(0), new Animated.Value(0)]);
  const [selectedModule, setSelectedModule] = useState('Attendance');
  const [showTeacherDetails, setShowTeacherDetails] = useState(false);
  const [showAccountSwitchOptions, setShowAccountSwitchOptions] = useState(false);
  const [showNextClassReport, setShowNextClassReport] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState('');
  const [parentProfileCache, setParentProfileCache] = useState<Record<string, any> | null>(null);
  const [attendanceSnapshot, setAttendanceSnapshot] = useState<AttendanceSnapshot>({
    status: 'Not tracked yet',
    distance: '--',
    lastUpdated: '--',
  });
  const [profileReady, setProfileReady] = useState(false);
  const { nextClass, fullTimetable, refreshNextClass } = useNextClass();
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>({
    username: '',
    name: '',
    designation: '',
    schoolCode: '',
    userType: '',
    phoneNo: '',
    subject: '',
    teacherId: '',
    email: '',
    photoUrl: '',
    photo: '',
    teachesToClasses: [],
  });
  const normalizeText = (value: any) =>
    String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizePhone = (value: any) => String(value ?? '').replace(/\D/g, '');
  const extractTeacherClasses = (source: Record<string, any> | undefined | null) => {
    const directClasses = Array.isArray(source?.teachesToClasses)
      ? source.teachesToClasses
      : Array.isArray(source?.teaches_to_classes)
        ? source.teaches_to_classes
        : [];

    const normalizedDirectClasses = directClasses
      .map((value) => String(value ?? '').trim())
      .filter((value) => value !== '' && value !== '0');

    if (normalizedDirectClasses.length > 0) {
      return normalizedDirectClasses;
    }

    const classValues = [
      source?.teaches_to_1,
      source?.teaches_to_2,
      source?.teaches_to_3,
      source?.teaches_to_4,
      source?.teaches_to_5,
      source?.teaches_to_6,
      source?.teaches_to_7,
      source?.teaches_to_8,
      source?.teaches_to_9,
      source?.teaches_to_10,
    ];

    return classValues
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '' && Number(value) !== 0)
      .map((value) => String(value).trim());
  };

  useEffect(() => {
    setProfileReady(false);
    const loadTeacherProfile = async () => {
      try {
        const storedUserDetailsRaw = await AsyncStorage.getItem('userDetails');
        const storedTeacherProfileRaw = await AsyncStorage.getItem('teacherProfile');
        const storedUserDetails = storedUserDetailsRaw ? JSON.parse(storedUserDetailsRaw) : {};
        const storedTeacherProfile = storedTeacherProfileRaw ? JSON.parse(storedTeacherProfileRaw) : {};
        const storedUsername = await AsyncStorage.getItem('username');
        const storedName = await AsyncStorage.getItem('name');
        const storedDesignation = await AsyncStorage.getItem('designation');
        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
        const storedUserType = await AsyncStorage.getItem('userType');
        const params = route.params ?? {};

        const resolvedUsername =
          params.username ||
          storedUserDetails.username ||
          storedUserDetails.user_name ||
          storedTeacherProfile.username ||
          storedUsername ||
          '';
        const resolvedName =
          params.name ||
          storedUserDetails.name ||
          storedUserDetails.teacher_name ||
          storedTeacherProfile.name ||
          storedName ||
          '';
        const resolvedDesignation =
          storedUserDetails.designation ||
          storedTeacherProfile.designation ||
          storedDesignation ||
          storedUserDetails.role ||
          '';
        const resolvedSchoolCode = String(
          storedUserDetails.schoolCode ||
            storedTeacherProfile.schoolCode ||
            storedSchoolCode ||
            '',
        );
        const resolvedUserType = String(
          storedUserDetails.userType ||
            storedTeacherProfile.userType ||
            storedUserType ||
            '',
        );
        const resolvedPhoneNo = String(
          storedUserDetails.phone_no ||
            storedUserDetails.phoneNo ||
            storedUserDetails.mobile_number ||
            storedUserDetails.contact_no ||
            storedTeacherProfile.phoneNo ||
            '',
        );
        const resolvedSubject = String(
          storedUserDetails.subject ||
            storedUserDetails.class_name ||
            storedUserDetails.department ||
            storedTeacherProfile.subject ||
            '',
        );
        const resolvedTeacherId = String(
          storedUserDetails.teacher_id ||
            storedUserDetails.id ||
            storedTeacherProfile.teacherId ||
            '',
        );
        const resolvedEmail = String(
          storedUserDetails.email_id ||
            storedUserDetails.email ||
            storedTeacherProfile.email ||
            '',
        );
        const resolvedPhotoUrl = resolveTeacherPhotoUri(
          storedUserDetails.photoUrl ||
            storedUserDetails.photo ||
            storedTeacherProfile.photoUrl ||
            storedTeacherProfile.photo ||
            '',
        );
        const resolvedTeachesToClasses = extractTeacherClasses({
          ...storedUserDetails,
          ...storedTeacherProfile,
        });

        setTeacherProfile({
          username: resolvedUsername,
          name: resolvedName,
          designation: resolvedDesignation,
          schoolCode: resolvedSchoolCode,
          userType: resolvedUserType,
          phoneNo: resolvedPhoneNo,
          subject: resolvedSubject,
          teacherId: resolvedTeacherId,
          email: resolvedEmail,
          photoUrl: resolvedPhotoUrl,
          photo: String(
            storedUserDetails.photo ||
              storedUserDetails.photoUrl ||
              storedTeacherProfile.photo ||
              storedTeacherProfile.photoUrl ||
              '',
          ),
          teachesToClasses: resolvedTeachesToClasses,
          teaches_to_1: storedTeacherProfile.teaches_to_1 ?? storedUserDetails.teaches_to_1 ?? null,
          teaches_to_2: storedTeacherProfile.teaches_to_2 ?? storedUserDetails.teaches_to_2 ?? null,
          teaches_to_3: storedTeacherProfile.teaches_to_3 ?? storedUserDetails.teaches_to_3 ?? null,
          teaches_to_4: storedTeacherProfile.teaches_to_4 ?? storedUserDetails.teaches_to_4 ?? null,
          teaches_to_5: storedTeacherProfile.teaches_to_5 ?? storedUserDetails.teaches_to_5 ?? null,
          teaches_to_6: storedTeacherProfile.teaches_to_6 ?? storedUserDetails.teaches_to_6 ?? null,
          teaches_to_7: storedTeacherProfile.teaches_to_7 ?? storedUserDetails.teaches_to_7 ?? null,
          teaches_to_8: storedTeacherProfile.teaches_to_8 ?? storedUserDetails.teaches_to_8 ?? null,
          teaches_to_9: storedTeacherProfile.teaches_to_9 ?? storedUserDetails.teaches_to_9 ?? null,
          teaches_to_10: storedTeacherProfile.teaches_to_10 ?? storedUserDetails.teaches_to_10 ?? null,
        });

        const cachedTeacherProfile = {
          username: resolvedUsername,
          name: resolvedName,
          designation: resolvedDesignation,
          schoolCode: resolvedSchoolCode,
          userType: resolvedUserType,
          phoneNo: resolvedPhoneNo,
          subject: resolvedSubject,
          teacherId: resolvedTeacherId,
          email: resolvedEmail,
          photoUrl: resolvedPhotoUrl,
          photo: String(
            storedUserDetails.photo ||
              storedUserDetails.photoUrl ||
              storedTeacherProfile.photo ||
              storedTeacherProfile.photoUrl ||
              '',
          ),
          teachesToClasses: resolvedTeachesToClasses,
          teaches_to_1: storedTeacherProfile.teaches_to_1 ?? storedUserDetails.teaches_to_1 ?? null,
          teaches_to_2: storedTeacherProfile.teaches_to_2 ?? storedUserDetails.teaches_to_2 ?? null,
          teaches_to_3: storedTeacherProfile.teaches_to_3 ?? storedUserDetails.teaches_to_3 ?? null,
          teaches_to_4: storedTeacherProfile.teaches_to_4 ?? storedUserDetails.teaches_to_4 ?? null,
          teaches_to_5: storedTeacherProfile.teaches_to_5 ?? storedUserDetails.teaches_to_5 ?? null,
          teaches_to_6: storedTeacherProfile.teaches_to_6 ?? storedUserDetails.teaches_to_6 ?? null,
          teaches_to_7: storedTeacherProfile.teaches_to_7 ?? storedUserDetails.teaches_to_7 ?? null,
          teaches_to_8: storedTeacherProfile.teaches_to_8 ?? storedUserDetails.teaches_to_8 ?? null,
          teaches_to_9: storedTeacherProfile.teaches_to_9 ?? storedUserDetails.teaches_to_9 ?? null,
          teaches_to_10: storedTeacherProfile.teaches_to_10 ?? storedUserDetails.teaches_to_10 ?? null,
        };

        await AsyncStorage.setItem('teacherProfile', JSON.stringify(cachedTeacherProfile));

        if (resolvedUsername && resolvedSchoolCode) {
          try {
            const profileUrl = 'http://162.215.210.38:3010/api/teacher/profile';
            const profileResponse = await axios.get(profileUrl, {
              params: {
                username: resolvedUsername,
                schoolCode: resolvedSchoolCode,
              },
              timeout: 15000,
            });

            const apiTeacher = profileResponse.data?.teacher || profileResponse.data?.data || {};
            const apiTeachesToClasses = extractTeacherClasses(apiTeacher);
            const apiMergedProfile = {
              username: String(apiTeacher.username || resolvedUsername || ''),
              name: String(apiTeacher.name || resolvedName || ''),
              designation: String(apiTeacher.designation || resolvedDesignation || ''),
              schoolCode: String(apiTeacher.schoolCode || resolvedSchoolCode || ''),
              userType: String(apiTeacher.userType || resolvedUserType || ''),
              phoneNo: String(
                apiTeacher.phone_no ||
                  apiTeacher.phoneNo ||
                  apiTeacher.mobile_number ||
                  apiTeacher.contact_no ||
                  resolvedPhoneNo ||
                  '',
              ),
              subject: String(apiTeacher.subject || resolvedSubject || ''),
              teacherId: String(apiTeacher.teacher_id || apiTeacher.id || resolvedTeacherId || ''),
              email: String(apiTeacher.email_id || apiTeacher.email || resolvedEmail || ''),
              photoUrl: resolveTeacherPhotoUri(
                apiTeacher.photoUrl ||
                  apiTeacher.photo ||
                  apiTeacher.photo_url ||
                  resolvedPhotoUrl ||
                  '',
              ),
              photo: String(apiTeacher.photo || apiTeacher.photoUrl || apiTeacher.photo_url || ''),
              teachesToClasses: apiTeachesToClasses.length ? apiTeachesToClasses : resolvedTeachesToClasses,
              teaches_to_1: apiTeacher.teaches_to_1 ?? storedTeacherProfile.teaches_to_1 ?? null,
              teaches_to_2: apiTeacher.teaches_to_2 ?? storedTeacherProfile.teaches_to_2 ?? null,
              teaches_to_3: apiTeacher.teaches_to_3 ?? storedTeacherProfile.teaches_to_3 ?? null,
              teaches_to_4: apiTeacher.teaches_to_4 ?? storedTeacherProfile.teaches_to_4 ?? null,
              teaches_to_5: apiTeacher.teaches_to_5 ?? storedTeacherProfile.teaches_to_5 ?? null,
              teaches_to_6: apiTeacher.teaches_to_6 ?? storedTeacherProfile.teaches_to_6 ?? null,
              teaches_to_7: apiTeacher.teaches_to_7 ?? storedTeacherProfile.teaches_to_7 ?? null,
              teaches_to_8: apiTeacher.teaches_to_8 ?? storedTeacherProfile.teaches_to_8 ?? null,
              teaches_to_9: apiTeacher.teaches_to_9 ?? storedTeacherProfile.teaches_to_9 ?? null,
              teaches_to_10: apiTeacher.teaches_to_10 ?? storedTeacherProfile.teaches_to_10 ?? null,
            };

            setTeacherProfile((prev) => {
              return { ...prev, ...apiMergedProfile };
            });

            await AsyncStorage.setItem('teacherProfile', JSON.stringify(apiMergedProfile));
          } catch (apiError) {
          }
        }
      } catch (error) {
      } finally {
        setProfileReady(true);
      }
    };

    loadTeacherProfile();
  }, [route.params]);

  useEffect(() => {
    if (route.params?.openProfilePanel) {
      setShowTeacherDetails(true);
      navigation.setParams({
        ...(route.params ?? {}),
        openProfilePanel: false,
      });
    }
  }, [navigation, route.params]);

  useEffect(() => {
    const loadParentProfileCache = async () => {
      try {
        const cachedParentProfileRaw = await AsyncStorage.getItem('parentProfile');
        if (!cachedParentProfileRaw) {
          setParentProfileCache(null);
          return;
        }

        const cachedParentProfile = JSON.parse(cachedParentProfileRaw);
        setParentProfileCache(cachedParentProfile);
      } catch {
        setParentProfileCache(null);
      }
    };

    void loadParentProfileCache();
  }, [showTeacherDetails]);

  useEffect(() => {
    const loadSchoolLogo = async () => {
      try {
        const cachedLogo = await AsyncStorage.getItem('schoolLogo');
        setSchoolLogo(cachedLogo || '');
      } catch {
      }
    };

    loadSchoolLogo();
  }, []);

  useEffect(() => {
    refreshNextClass();
  }, [refreshNextClass]);

  useEffect(() => {
    if (!isScreenFocused) {
      return;
    }

    startPersistentAttendanceTracking().catch((error) => {
    });
  }, [isScreenFocused]);

  useEffect(() => {
    const setupReminderChannel = async () => {
      try {
        await notifee.createChannel({
          id: REMINDER_NOTIFICATION_CHANNEL_ID,
          name: 'Teacher Reminders',
          description: 'Attendance and homework reminders',
          importance: AndroidImportance.HIGH,
          vibration: true,
        });
      } catch {
      }
    };

    setupReminderChannel();
  }, []);

  useEffect(() => {
    const username = teacherProfile.username || route.params?.username || '';
    const schoolCode = teacherProfile.schoolCode || '';

    if (!username || !schoolCode || !isScreenFocused) {
      return;
    }

    triggerAttendanceNotification(username, schoolCode);
    triggerHomeworkNotification(username, schoolCode);
  }, [
    isScreenFocused,
    route.params?.username,
    teacherProfile.schoolCode,
    teacherProfile.username,
  ]);

  useEffect(() => {
    if (!isScreenFocused) {
      return;
    }

    let isMounted = true;

    const loadAttendanceSnapshot = async () => {
      try {
        const [lastStatus, lastResultRaw, serviceActive, trackingEnabled] = await Promise.all([
          AsyncStorage.getItem('lastAttendanceStatus'),
          AsyncStorage.getItem('attendance_last_result'),
          AsyncStorage.getItem('attendanceServiceActive'),
          AsyncStorage.getItem('attendanceTrackingEnabled'),
        ]);

        if (!isMounted) {
          return;
        }

        const parsedResult = lastResultRaw ? JSON.parse(lastResultRaw) : null;
        const normalizedStatus = String(lastStatus || parsedResult?.status || '').toLowerCase();
        const statusLabel =
          normalizedStatus === 'present'
            ? 'Present'
            : normalizedStatus === 'absent'
              ? 'Absent'
              : trackingEnabled === 'true' || serviceActive === 'true'
                ? 'Attendance'
                : 'Attendance not tracked';

        setAttendanceSnapshot({
          status: statusLabel,
          distance: parsedResult?.distance ? String(parsedResult.distance) : '--',
          lastUpdated: parsedResult?.timestamp
            ? new Date(parsedResult.timestamp).toLocaleTimeString()
            : trackingEnabled === 'true' || serviceActive === 'true'
              ? 'Waiting for first check'
              : '--',
        });
      } catch {
      }
    };

    loadAttendanceSnapshot();
    const interval = setInterval(loadAttendanceSnapshot, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isScreenFocused]);

  const switchToCampaigning = async () => {
    try {
      setShowTeacherDetails(false);
      await AsyncStorage.setItem('lastScreen', 'TeacherAdmissionDashboard');
      navigation.replace('TeacherAdmissionDashboard', {
        username: teacherProfile.username || route.params?.username || '',
        name: teacherProfile.name || route.params?.name || '',
      });
    } catch {
    }
  };

  const handleLogout = async () => {
    try {
      setShowTeacherDetails(false);
      await stopPersistentAttendanceTracking();
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
    } catch {
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    }
  };

  const dashboardTiles = dashboardTilesMap['Daily Routines'];
  const nextClassTitle = nextClass?.class_id || '--';
  const nextClassSubtitle = nextClass?.subject || 'No Class';
  const nextClassFooter = nextClass ? `${nextClass.fromTime} - ${nextClass.toTime}` : 'No timetable available';
  const statusCards: StatCard[] = [
    {
      title: nextClassTitle,
      subtitle: nextClassSubtitle,
      footer: nextClassFooter,
      icon: 'schedule',
      kind: 'material',
      background: '#D7E7CD',
    },
    {
      title: attendanceSnapshot.status,
      subtitle: 'Attendance status',
      footer: `Distance: ${attendanceSnapshot.distance} | Updated: ${attendanceSnapshot.lastUpdated}`,
      icon: attendanceSnapshot.status === 'Present' ? 'check-circle' : 'event-note',
      kind: 'material',
      background: '#F0EE96',
    },
  ];
  const nextClassReport = buildTeacherDayPeriods(fullTimetable);
  const sharedParams = {
    username: teacherProfile.username || route.params?.username || '',
    name: teacherProfile.name || route.params?.name || '',
    schoolCode: teacherProfile.schoolCode || '',
  };
  const teacherPhotoUri = resolveTeacherPhotoUri(teacherProfile.photoUrl || teacherProfile.photo);
  const teacherClassesLabel = teacherProfile.teachesToClasses.length
    ? `Teaches ${teacherProfile.teachesToClasses.length} class${teacherProfile.teachesToClasses.length > 1 ? 'es' : ''}`
    : 'No classes assigned';
  const teacherClassChips = teacherProfile.teachesToClasses;
  const teacherClassRows = Math.max(1, Math.ceil(Math.max(teacherClassChips.length, 1) / 3));
  const heroCardHeight = Math.max(190, 150 + (teacherClassRows - 1) * 28);
  const dashboardGridStyle = [
    styles.dashboardGridWrap,
    {
      paddingHorizontal: 6,
      marginBottom: 10,
      justifyContent: 'flex-start' as const,
      alignItems: 'flex-start' as const,
    },
  ];
  const teacherInitial =
    (teacherProfile.name || teacherProfile.username || 'T').trim().charAt(0).toUpperCase() || 'T';
  const navigateToModule = (label: string) => {
    switch (label) {
      case 'Attendance':
        navigation.navigate('TeacherAttendance', sharedParams);
        return;
      case 'Homework':
        navigation.navigate('TeacherHomework', sharedParams);
        return;
      case 'Time table':
        navigation.navigate('TeacherTimetable', sharedParams);
        return;
      case 'Topic of day':
        navigation.navigate('TopicOfDay', sharedParams);
        return;
      case 'Behaviour':
        navigation.navigate('TeacherBehaviour', sharedParams);
        return;
      case 'Photo':
        navigation.navigate('TeacherEventMediaUpload', sharedParams);
        return;
      case 'Calendar':
        navigation.navigate('TeacherCalender', sharedParams);
        return;
      case 'Scan':
        navigation.navigate('ScanPull');
        return;
      case 'Salary':
        navigation.navigate('TeacherSalary', sharedParams);
        return;
      case 'Leave':
        navigation.navigate('TeacherLeaveRequest', sharedParams);
        return;
      case 'Messages':
        navigation.navigate('TeacherMessage', sharedParams);
        return;
      case 'Chat Requests':
        navigation.navigate('TeacherChatAndEvents', sharedParams);
        return;
      case 'Announcements':
        navigation.navigate('TeacherAnnouncements', sharedParams);
        return;
      default:
        Alert.alert('Unavailable', `No page is wired for "${label}" yet.`);
    }
  };

  const handleTilePress = (tile: DashboardTile) => {
    setSelectedModule(tile.label);
    navigateToModule(tile.label);
  };

  const handleOpenHomePanel = () => {
    setSelectedModule('TeacherDashboard');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleAddPress = () => {
    setSelectedModule('TeacherDashboard');
  };

  const handleOpenChat = () => {
    setSelectedModule('Messages');
    navigateToModule('Messages');
  };

  const handleOpenProfilePanel = () => {
    setShowAccountSwitchOptions(false);
    setShowTeacherDetails(true);
  };

  const toggleAccountSwitchOptions = () => {
    setShowAccountSwitchOptions((current) => !current);
  };

  const canSwitchToParentAccount =
    Boolean(parentProfileCache) &&
    normalizeText(teacherProfile.name) === normalizeText(parentProfileCache?.father_name) &&
    normalizePhone(teacherProfile.phoneNo) ===
      normalizePhone(
        parentProfileCache?.phone_no ||
          parentProfileCache?.phoneNo ||
          parentProfileCache?.mobile_number ||
          parentProfileCache?.phone ||
          ''
      );

  const handleSwitchToParentAccount = async () => {
    try {
      if (!parentProfileCache) {
        Alert.alert('Unavailable', 'Parent account details were not found on this device.');
        return;
      }

      const username = String(parentProfileCache.username || '');
      const name = String(parentProfileCache.name || '');
      const schoolCode = String(parentProfileCache.schoolCode || '');

      await AsyncStorage.multiSet([
        ['username', username],
        ['name', name],
        ['schoolCode', schoolCode],
        ['userType', 'student'],
        ['userDetails', JSON.stringify(parentProfileCache)],
        ['currentStudent', JSON.stringify(parentProfileCache)],
        ['lastScreen', 'ParentDashboard'],
      ]);

      setShowTeacherDetails(false);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'ParentDashboard',
            params: { username, name },
          },
        ],
      });
    } catch {
      Alert.alert('Error', 'Failed to switch to parent account.');
    }
  };

  useEffect(() => {
    const createImageLoop = (animValue: Animated.Value, delay: number) => {
      animValue.setValue(0);

      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );

      loop.start();
      return loop;
    };

    const loops = [
      createImageLoop(summaryImageAnimValues.current[0], 0),
      createImageLoop(summaryImageAnimValues.current[1], 140),
    ];

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, []);

  const nextClassImageTranslateY = summaryImageAnimValues.current[0].interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const nextClassImageScale = summaryImageAnimValues.current[0].interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const nextClassImageRotate = summaryImageAnimValues.current[0].interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-5deg'],
  });
  const attendanceImageTranslateY = summaryImageAnimValues.current[1].interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const attendanceImageScale = summaryImageAnimValues.current[1].interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const attendanceImageRotate = summaryImageAnimValues.current[1].interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-4deg'],
  });

  if (!profileReady) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#fff" />
       
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={"#0a3d62"} />

      <View style={styles.background}>
        <View style={styles.phoneShell}>
          <View style={styles.phoneFrame}>
            <LinearGradient
              pointerEvents="none"
                colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
              start={{ x: 0.05, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dashboardTopGradient}
            />
            <View style={styles.toolbar}>
              <View style={styles.toolbarBrandCentered}>
                <Image
                  source={schoolLogo ? { uri: schoolLogo } : logoImage}
                  style={styles.toolbarBrandLogo}
                  resizeMode="contain"
                />
                <Text style={styles.toolbarBrandName1} numberOfLines={1}>
                  {teacherProfile.schoolCode || '--'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.dashboardHeroCard,
                {
                  height: heroCardHeight,
                  marginBottom: 10,
                },
              ]}
            >
              <LinearGradient
                colors={['#6826df', '#a174eb', '#1A2D4A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dashboardHeroGradientCard}
              >
                <View style={styles.dashboardHeroExpandedLayout}>
                  <View style={styles.dashboardHeroExpandedLeft}>
                    <Text style={styles.dashboardHeroName} numberOfLines={2}>
                      {teacherProfile.name || teacherProfile.username || 'Teacher'}
                    </Text>
                    <Text style={styles.dashboardHeroClass} numberOfLines={1}>
                      {teacherProfile.designation || 'Teacher Dashboard'}
                    </Text>
                    <Text style={styles.dashboardHeroTeachingLine} numberOfLines={1}>
                      {teacherClassesLabel}
                    </Text>
                    {teacherClassChips.length > 0 ? (
                      <View style={styles.dashboardHeroClassChips}>
                        {teacherClassChips.map((className) => (
                          <View key={String(className)} style={styles.dashboardHeroClassChip}>
                            <Text style={styles.dashboardHeroClassChipText}>Class {className}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.dashboardHeroTeachingLine} numberOfLines={1}>
                        No classes assigned
                      </Text>
                    )}

                    <View style={styles.dashboardHeroStatsRow}>
                      <View style={styles.dashboardHeroStatItem}>
                        <Text style={styles.dashboardHeroStatLabel}>Next Class</Text>
                        <Text style={styles.dashboardHeroStatValue}>
                          {statusCards[0].title} {statusCards[0].subtitle}
                        </Text>
                      </View>
                      <View style={styles.dashboardHeroStatItem}>
                        <Text style={styles.dashboardHeroStatLabel}>Attendance</Text>
                        <Text style={styles.dashboardHeroStatValue}>
                          {attendanceSnapshot.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.dashboardHeroActiveProfileFloat} pointerEvents="none">
                  <View style={styles.dashboardHeroPrimaryProfile}>
                    {teacherPhotoUri ? (
                      <Image
                        source={{ uri: teacherPhotoUri }}
                        style={styles.dashboardHeroPrimaryAvatar}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.dashboardHeroPrimaryAvatarText}>{teacherInitial}</Text>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.parentActionSection}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToAlignment="start"
                  snapToInterval={phoneWidth - 14}
                  contentContainerStyle={styles.parentActionScroll}
                >
                <Pressable
                  style={[
                    styles.parentActionCard,
                    teacherDashboardCardStyles.summaryActionCard,
                    styles.parentActionCardSpacing,
                  ]}
                  onPress={() => setShowNextClassReport(true)}
                >
                  <View style={styles.parentActionCardBody}>
                    <View style={styles.parentActionCardTextBlock}>
                      <Text style={styles.parentActionCardLabel}>Next Class</Text>
                      <Text style={styles.parentActionCardValue} numberOfLines={1}>
                        {statusCards[0].subtitle}
                      </Text>
                      <Text style={styles.parentActionCardSubtitle} numberOfLines={2}>
                        {statusCards[0].footer}
                      </Text>
                      <View style={styles.parentActionCta}>
                        <Text style={styles.parentActionCtaText}>View Report</Text>
                      </View>
                    </View>
                    <Animated.Image
                      source={require('../assets/timetable.jpg')}
                      style={[
                        styles.parentActionImage,
                        {
                          transform: [
                            { translateY: nextClassImageTranslateY },
                            { scale: nextClassImageScale },
                            { rotate: nextClassImageRotate },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                </Pressable>

                <Pressable
                  style={[
                    styles.parentActionCard,
                    teacherDashboardCardStyles.summaryActionCard,
                  ]}
                  onPress={() => handleTilePress(dashboardTiles.find((tile) => tile.label === 'Attendance') || dashboardTiles[0])}
                >
                  <View style={styles.parentActionCardBody}>
                    <View style={styles.parentActionCardTextBlock}>
                      <Text style={styles.parentActionCardLabel}>Attendance</Text>
                      <Text style={styles.parentActionCardValue} numberOfLines={1}>
                        {statusCards[1].title}
                      </Text>
                      <Text style={styles.parentActionCardSubtitle} numberOfLines={2}>
                        {statusCards[1].footer}
                      </Text>
                      <View style={styles.parentActionCta}>
                        <Text style={styles.parentActionCtaText}>Open Attendance</Text>
                      </View>
                    </View>
                    <Animated.Image
                      source={require('../assets/leaves.png')}
                      style={[
                        styles.parentActionImage,
                        {
                          transform: [
                            { translateY: attendanceImageTranslateY },
                            { scale: attendanceImageScale },
                            { rotate: attendanceImageRotate },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                </Pressable>
                </ScrollView>
              </View>

              <View style={styles.dashboardStickyHeader}>
                <Text style={styles.sectionTitle}>Teacher Dashboard</Text>
                
                <View style={dashboardGridStyle}>
                  {dashboardTiles.map((tile, index) => (
                    <Pressable
                      key={tile.label}
                      style={[
                        teacherDashboardCardStyles.cardWrapper,
                        index % 2 === 0 && { marginRight: 10 },
                        selectedModule === tile.label && teacherDashboardCardStyles.cardActive,
                      ]}
                      onPress={() => handleTilePress(tile)}
                    >
                      <View style={teacherDashboardCardStyles.card}>
                      <View style={styles.dashboardGridCornerAccent1}>
                                           <LinearGradient
                                             colors={['#d2c2eeff', '#a174eb', '#6826df']}
                                             start={{ x: 0, y: 0 }}
                                             end={{ x: 1, y: 1 }}
                                             style={styles.dashboardGridCornerAccentFill}
                                           />
                                         </View>
                        <View style={teacherDashboardCardStyles.iconWrap}>
                          {renderIcon(tile.kind, tile.icon, '#000000', 30)}
                        </View>
                        <View style={teacherDashboardCardStyles.cardContent}>
                          <View style={teacherDashboardCardStyles.textBlock}>
                            <Text style={teacherDashboardCardStyles.label} numberOfLines={2}>
                              {tile.label}
                            </Text>
                            <Text style={teacherDashboardCardStyles.subtitle} numberOfLines={1}>
                              {tile.subtitle}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Modal
                visible={showNextClassReport}
                transparent
                animationType="fade"
                onRequestClose={() => setShowNextClassReport(false)}
              >
                <View style={styles.overlay}>
                  <View style={styles.popupCard}>
                    <Text style={styles.popupTitle}>Next Class Report</Text>
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      style={{ maxHeight: phoneHeight * 0.55 }}
                    >
                      {nextClassReport.length === 0 ? (
                        <Text style={styles.reportRowMeta}>No timetable available</Text>
                      ) : (
                        nextClassReport.map((day) => (
                          <View key={day.day} style={styles.reportRowCard}>
                            <Text style={styles.reportRowTitle}>{day.day}</Text>
                            {day.periods.map((period: any, index: number) => (
                              <Text key={`${day.day}-${index}`} style={styles.reportRowMeta}>
                                {period.fromTime.slice(0, 5)} - {period.toTime.slice(0, 5)} :{' '}
                                {period.subject} ({period.class_id})
                              </Text>
                            ))}
                          </View>
                        ))
                      )}
                    </ScrollView>
                    <View style={styles.popupActions}>
                      <Pressable
                        style={[styles.popupButton, styles.popupButtonSecondary]}
                        onPress={() => setShowNextClassReport(false)}
                      >
                        <Text
                          style={[styles.popupButtonText, styles.popupButtonTextSecondary]}
                        >
                          Close
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Modal>
            </ScrollView>

            {showTeacherDetails && (
              <View style={styles.overlay}>
                <View style={styles.teacherPopupCard}>
                  <View style={styles.teacherHeaderRow}>
                  <View style={styles.teacherAvatar}>
                      {teacherPhotoUri ? (
                        <Image
                          source={{ uri: teacherPhotoUri }}
                          style={styles.teacherAvatarImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.teacherAvatarText}>
                          {(teacherProfile.name || teacherProfile.username || 'T')
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.teacherHeaderText}>
                      <Text style={styles.teacherTitle}>Teacher Details</Text>
                      <Text style={styles.teacherSubtitle}>
                        {teacherProfile.name || 'Teacher profile'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.teacherDetailsList}>
                    {[
                      { label: 'Name', value: teacherProfile.name || '-' },
                      { label: 'Username', value: teacherProfile.username || '-' },
                      { label: 'Designation', value: teacherProfile.designation || '-' },
                      { label: 'Phone', value: teacherProfile.phoneNo || '-' },
                    ].map((item) => (
                      <View key={item.label} style={styles.teacherDetailRow}>
                        <Text style={styles.teacherDetailLabel}>{item.label}</Text>
                        <Text style={styles.teacherDetailValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.teacherActions}>
                    {showAccountSwitchOptions ? (
                      <View style={{ gap: 10, marginTop: 8, width: '100%' }}>
                        <Pressable
                          style={[
                            {
                              width: '100%',
                              minHeight: 44,
                              borderRadius: 12,
                              backgroundColor: '#F1F3F6',
                              borderWidth: 1,
                              borderColor: '#D9DDE5',
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                          ]}
                          onPress={() => setShowAccountSwitchOptions(false)}
                        >
                          <Text
                            style={{
                              color: '#2B2B2B',
                              fontSize: 13.5,
                              fontWeight: '800',
                              textAlign: 'center',
                            }}
                          >
                            Close
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            {
                              width: '100%',
                              minHeight: 48,
                              borderRadius: 12,
                              backgroundColor: '#FFFFFF',
                              borderWidth: 1,
                              borderColor: '#D9DDE5',
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                          ]}
                          onPress={switchToCampaigning}
                        >
                          <Text
                            style={{
                              color: '#1F1F22',
                              fontSize: 14,
                              fontWeight: '800',
                              textAlign: 'center',
                            }}
                          >
                            Campaign 
                          </Text>
                        </Pressable>
                        {canSwitchToParentAccount && (
                          <Pressable
                            style={[
                              {
                                width: '100%',
                                minHeight: 48,
                                borderRadius: 12,
                                backgroundColor: '#FFFFFF',
                                borderWidth: 1,
                                borderColor: '#D9DDE5',
                                alignItems: 'center',
                                justifyContent: 'center',
                              },
                            ]}
                            onPress={handleSwitchToParentAccount}
                          >
                            <Text
                              style={{
                                color: '#1F1F22',
                                fontSize: 14,
                                fontWeight: '800',
                                textAlign: 'center',
                              }}
                            >
                              Parent
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ) : (
                      <>
                        <Pressable
                          style={[styles.popupButton, styles.popupButtonSecondary, styles.teacherActionButton]}
                          onPress={() => setShowTeacherDetails(false)}
                        >
                          <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                            Close
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.popupButton, styles.popupButtonPrimary, styles.teacherActionButton]}
                          onPress={toggleAccountSwitchOptions}
                        >
                          <Text style={styles.popupButtonText}>Switch Account</Text>
                        </Pressable>
                      </>
                    )}
                  </View>

                  <Pressable
                    style={[styles.popupButton, styles.teacherLogoutButton]}
                    onPress={handleLogout}
                  >
                    <Text style={styles.teacherLogoutText}>Logout</Text>
                  </Pressable>
                </View>
              </View>
            )}   

            <View style={styles.footer}>
              <View style={styles.footerNav}>
                <Pressable style={styles.footerNavItem} onPress={handleGoBack}>
                  <Image source={backArrowImage} style={{ width: 22, height: 22 }} resizeMode="contain" />
                  <Text style={styles.footerNavLabel}>Back</Text>
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenHomePanel}>
<Ionicons name="home-outline" size={22} color="#1F1F22" />                  <Text style={styles.footerNavLabel}>Home</Text>
                </Pressable>
                <Pressable style={styles.footerAddButton} onPress={handleAddPress}>
                  <MaterialIcons name="add" size={26} color="#FFFFFF" />
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenChat}>
                  <MaterialIcons name="chat-bubble-outline" size={22} color="#1F1F22" />
                  <Text style={styles.footerNavLabelMuted}>Chat</Text>
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenProfilePanel}>
                  {teacherPhotoUri ? (
                    <Image source={{ uri: teacherPhotoUri }} style={styles.footerProfilePhoto} resizeMode="cover" />
                  ) : (
                    <MaterialIcons name="person-outline" size={22} color="#1F1F22" />
                  )}
                  <Text style={styles.footerNavLabelMuted}>Profile</Text>
                </Pressable>
              </View>
              <View style={styles.footerBrandRow}>
                <Text style={styles.poweredBy}>Powered By</Text>
                <Image source={logoImage} style={styles.logo} resizeMode="contain" />
              </View>
            </View>

          </View>
        </View>
      </View>
    </View>
  );
};

export default TeacherDashboard;
