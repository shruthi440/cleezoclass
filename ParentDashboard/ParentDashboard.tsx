import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import LinearGradient from 'react-native-linear-gradient';

import { createAppStyles } from '../App.styles';
import { RootStackParamList } from '../types';
import ParentAcademic from './ParentAcademic';
import ParentAttendance from './ParentAttendance';
import ParentHomework from './ParentHomwork';
import ParentFees from './ParentFees';
import ParentTimetable from './ParentTimetable';
import ParentCalender from './ParentCalender';
import ParentPhotos from './ParentPhotos';
import ParentLiveChatTicket from './ParentLiveChatTicket';
import ParentHomepage from './parentEvents';

const ParentHomeworkView = ParentHomework as unknown as React.ComponentType<any>;
const ParentAcademicView = ParentAcademic as unknown as React.ComponentType<any>;
const ParentFeesView = ParentFees as unknown as React.ComponentType<any>;
const ParentTimetableView = ParentTimetable as unknown as React.ComponentType<any>;
const ParentCalenderView = ParentCalender as unknown as React.ComponentType<any>;
const ParentPhotosView = ParentPhotos as unknown as React.ComponentType<any>;
const ParentLiveChatTicketView = ParentLiveChatTicket as unknown as React.ComponentType<any>;
const ParentHomepageView = ParentHomepage as unknown as React.ComponentType<any>;

type IconKind = 'material' | 'fontawesome';
type ParentModuleRoute =
  | 'AcademicSummary'
  | 'FeesSummary'
  | 'ParentAcademic'
  | 'ParentAttendance'
  | 'ParentFees'
  | 'ParentHomework'
  | 'ParentTimetable'
  | 'ParentCalender'
  | 'ParentPhotos'
  | 'ParentLiveChatTicket'
  | 'ParentHomepage';

type ParentTile = {
  label: string;
  icon: string;
  kind: IconKind;
  route: ParentModuleRoute;
  component: React.ComponentType<any>;
  iconColor: string;
  borderColor: string;
  iconBg: string;
  cardBg: string;
  metaLabel: string;
  metaValue: string;
};

type ParentChild = {
  id: number | string;
  name?: string;
  username?: string;
  father_name?: string;
  phone_no?: string;
  class_name?: string;
  section?: string;
  photoUrl?: string;
  schoolCode?: string;
  aadhar_no?: string;
  address?: string;
  class_teacher?: string;
  gender?: string;
  school_name?: string;
  photo?: string;
};

const logoImage: ImageSourcePropType = require('../assets/Cleezo.png');
const backArrowImage: ImageSourcePropType = require('../assets/Arrow.png');
const studentPhotoUploadBase = 'https://cleezoclass.com:4000/CRM/public/uploads';

const normalizeInstituteLogo = (rawLogo: any) => {
  if (!rawLogo) return '';

  let logo = rawLogo;

  if (typeof logo === 'object' && logo?.type === 'Buffer' && Array.isArray(logo?.data)) {
    try {
      const bytes = new Uint8Array(logo.data);
      const bufferCtor = (globalThis as any).Buffer;
      const bufferBase64 = bufferCtor ? bufferCtor.from(bytes).toString('base64') : '';
      return bufferBase64 ? `data:image/png;base64,${bufferBase64}` : '';
    } catch {
      return '';
    }
  }

  if (typeof logo !== 'string') return '';
  logo = logo.trim();
  if (!logo) return '';
  if (logo.startsWith('data:image')) return logo;
  if (logo.startsWith('http')) return logo;

  if (logo.startsWith('uploads/')) {
    return `https://cleezoclass.com:4000/${logo}`;
  }

  if (logo.startsWith('/uploads/')) {
    return `https://cleezoclass.com:4000${logo}`;
  }

  if (/^[A-Za-z0-9+/=]+$/.test(logo) && logo.length > 100) {
    return `data:image/png;base64,${logo}`;
  }

  return '';
};

const decodeBase64Text = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const atobFn = (globalThis as any).atob;
    if (typeof atobFn === 'function') return atobFn(raw);
  } catch {}
  try {
    const bufferCtor = (globalThis as any).Buffer;
    if (bufferCtor?.from) return bufferCtor.from(raw, 'base64').toString('utf8');
  } catch {}
  return '';
};

const resolveStudentPhotoUri = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const buildUploadUrl = (path: string) => {
    const cleanPath = String(path || '').trim().replace(/^\/+/, '');
    if (!cleanPath) return studentPhotoUploadBase;

    const relativePath = cleanPath
      .replace(/^CRM\/public\/uploads\/?/i, '')
      .replace(/^uploads\/?/i, '')
      .replace(/^\/+/, '');

    return `${studentPhotoUploadBase}/${relativePath}`;
  };

  if (raw.startsWith('data:image')) {
    const base64Part = raw.split(',')[1] || '';
    const decoded = decodeBase64Text(base64Part);
    const decodedPath = String(decoded || '').trim();
    if (decodedPath.includes('CRM/public/uploads') || decodedPath.startsWith('/uploads/') || decodedPath.startsWith('uploads/')) {
      return buildUploadUrl(decodedPath);
    }
    if (decodedPath.startsWith('http://') || decodedPath.startsWith('https://')) return decodedPath;
    return raw;
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.includes('CRM/public/uploads') || raw.startsWith('/uploads/') || raw.startsWith('uploads/')) {
    return buildUploadUrl(raw);
  }
  if (raw.startsWith('L3VwbG9hZHMv') || raw.startsWith('dXBsb2Fkcy8')) {
    const decodedPath = String(decodeBase64Text(raw) || '').trim();
    if (decodedPath.includes('CRM/public/uploads') || decodedPath.startsWith('/uploads/') || decodedPath.startsWith('uploads/')) {
      return buildUploadUrl(decodedPath);
    }
    if (decodedPath.startsWith('http://') || decodedPath.startsWith('https://')) return decodedPath;
  }
  return raw;
};

const resolveRenderablePhotoUri = (value?: string | null) => {
  const uri = resolveStudentPhotoUri(value);
  if (!uri) return '';
  if (uri.startsWith('data:image')) return uri;
  try {
    return encodeURI(uri);
  } catch {
    return uri;
  }
};

const topChips = ['Overview', 'Learning', 'Attendance', 'Support', 'Events'];

const parentTiles: ParentTile[] = [
  {
    label: 'Academic',
    icon: 'school',
    kind: 'material',
    route: 'ParentAcademic',
    component: ParentAcademic,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Summary',
    metaValue: '',
  },
  {
    label: 'Homework',
    icon: 'assignment',
    kind: 'material',
    route: 'ParentHomework',
    component: ParentHomework,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Tasks',
    metaValue: '',
  },
  {
    label: 'Fees',
    icon: 'payments',
    kind: 'material',
    route: 'ParentFees',
    component: ParentFees,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Summary',
    metaValue: '',
  },
  {
    label: 'Attendance',
    icon: 'event-note',
    kind: 'material',
    route: 'ParentAttendance',
    component: ParentAttendance,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Leaves',
    metaValue: '',
  },
  {
    label: 'Timetable',
    icon: 'schedule',
    kind: 'material',
    route: 'ParentTimetable',
    component: ParentTimetable,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Slot',
    metaValue: '',
  },
  {
    label: 'Calendar',
    icon: 'event',
    kind: 'material',
    route: 'ParentCalender',
    component: ParentCalender,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Events',
    metaValue: '',
  },
  {
    label: 'Photos',
    icon: 'photo-library',
    kind: 'material',
    route: 'ParentPhotos',
    component: ParentPhotos,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Gallery',
    metaValue: '',
  },
  {
    label: 'Chat & Tickets',
    icon: 'chat',
    kind: 'material',
    route: 'ParentLiveChatTicket',
    component: ParentLiveChatTicket,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Support',
    metaValue: '',
  },
  {
    label: 'Announcements',
    icon: 'photo-library',
    kind: 'material',
    route: 'ParentHomepage',
    component: ParentHomepage,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Updates',
    metaValue: '',
  },
];

const renderIcon = (kind: IconKind, name: string, color: string, size: number) => {
  if (kind === 'fontawesome') {
    return <FontAwesome name={name} size={size} color={color} />;
  }

  return <MaterialIcons name={name} size={size} color={color} />;
};

const computeAcademicSummary = (performance: any[], testTypes: any[]) => {
  const safePerformance = Array.isArray(performance) ? performance : [];
  const safeTestTypes = Array.isArray(testTypes) ? testTypes : [];

  if (!safePerformance.length) return { grade: '-', percentage: '0.00' };

  const fallbackTermRows = [
    { label: 'FA1', key: 'FA1' },
    { label: 'FA2', key: 'FA2' },
    { label: 'SA1', key: 'SA1' },
    { label: 'FA3', key: 'FA3' },
    { label: 'FA4', key: 'FA4' },
    { label: 'SA2', key: 'SA2' },
  ];

  const termRows = safeTestTypes.length
    ? safeTestTypes
        .filter((row: any) => row?.key && row?.label)
        .map((row: any) => ({ key: row.key, label: row.label }))
    : fallbackTermRows;

  const getLegacyMarkForRow = (subj: any, rowKey: string) => {
    const match = String(rowKey || '').toUpperCase().match(/^(FA|SA)(\d+)$/);
    if (!match) return { mark: '-', max: 0 };

    const type = match[1];
    const index = Number(match[2]) - 1;
    const mark = type === 'FA' ? subj?.FA?.[index] : subj?.SA?.[index];
    const max = type === 'FA' ? 20 : 80;

    return { mark: mark ?? '-', max: mark === null || mark === undefined ? 0 : max };
  };

  const getMarkForRow = (subj: any, row: any) => {
    const testEntry = subj?.tests?.[row?.key];
    if (testEntry?.obtained !== null && testEntry?.obtained !== undefined) {
      return testEntry.obtained;
    }
    return getLegacyMarkForRow(subj, row?.key).mark;
  };

  const getMaxForRow = (subj: any, row: any) => {
    const testEntry = subj?.tests?.[row?.key];
    if (testEntry?.max !== null && testEntry?.max !== undefined) {
      return Number(testEntry.max) || 0;
    }
    return getLegacyMarkForRow(subj, row?.key).max;
  };

  let obtained = 0;
  let total = 0;

  safePerformance.forEach((subj) => {
    termRows.forEach((row) => {
      const mark = getMarkForRow(subj, row);
      const maxMark = getMaxForRow(subj, row);
      const numericMark = Number(mark);

      if (
        mark !== '-' &&
        mark !== null &&
        mark !== undefined &&
        !Number.isNaN(numericMark) &&
        maxMark > 0
      ) {
        obtained += numericMark;
        total += maxMark;
      }
    });
  });

  const percentage = total > 0 ? ((obtained / total) * 100).toFixed(2) : '0.00';
  const pct = Number(percentage);
  let grade = 'D';
  if (pct >= 90) grade = 'A+';
  else if (pct >= 80) grade = 'A';
  else if (pct >= 70) grade = 'B+';
  else if (pct >= 60) grade = 'B';
  else if (pct >= 50) grade = 'C';

  return { grade, percentage };
};

const ParentDashboard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedChip, setSelectedChip] = useState<(typeof topChips)[number]>('Overview');
  const [selectedModule, setSelectedModule] = useState<ParentModuleRoute>('ParentAcademic');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [studentProfile, setStudentProfile] = useState<Record<string, any> | null>(null);
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [studentData, setStudentData] = useState<Record<string, any> | null>(null);
  const [teacherProfileCache, setTeacherProfileCache] = useState<Record<string, any> | null>(null);
  const [loginName, setLoginName] = useState('Parent');
  const [schoolLogo, setSchoolLogo] = useState<string>('');
  const [academicSummary, setAcademicSummary] = useState({ grade: '-', percentage: '0.00' });
  const [feeSummary, setFeeSummary] = useState({ paid: '₹ 0.00', due: '₹ 0.00', percent: '0' });
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any>(null);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const parentActionAnimValues = useRef<Animated.Value[]>([]);
  const parentActionImageAnimValues = useRef<Animated.Value[]>([]);
  const parentActionImageLoops = useRef<Animated.CompositeAnimation[]>([]);
  const sectionPositions = useRef<Partial<Record<ParentModuleRoute, number>>>({});
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const styles = createAppStyles({ phoneWidth, phoneHeight });
  const normalizeText = (value: any) =>
    String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizePhone = (value: any) => String(value ?? '').replace(/\D/g, '');
  const normalizeValue = (value: any) => String(value || '').trim().toLowerCase();

  const cacheTeacherProfile = async (profile: Record<string, any> | null) => {
    if (!profile) return;
    try {
      await AsyncStorage.setItem('teacherProfile', JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to cache teacher profile:', error);
    }
  };

  const loadStudentData = async () => {
    try {
      const currentStudentRaw = await AsyncStorage.getItem('currentStudent');
      let currentStudent = null;
      if (currentStudentRaw) {
        try {
          currentStudent = JSON.parse(currentStudentRaw);
        } catch (parseError) {
          console.warn('Failed to parse currentStudent, falling back to stored keys only:', parseError);
        }
      }

      const keys = ['studentId', 'name', 'class_name', 'section', 'schoolCode', 'username', 'parentName'];
      const stores = await AsyncStorage.multiGet(keys);
      const data: Record<string, any> = {};
      stores.forEach(([key, value]) => {
        if (value) data[key] = value;
      });

      const merged = {
        ...(currentStudent || {}),
        ...data,
        photoUrl: resolveRenderablePhotoUri((currentStudent || {})?.photoUrl || data.photoUrl || data.photo || ''),
      };

      if (merged.studentId && !merged.id) merged.id = merged.studentId;
      if (merged.id && !merged.studentId) merged.studentId = merged.id;

      setStudentData(merged);
      setLoginName((current) => {
        if (current !== 'Parent') return current;
        return String(data.parentName || data.name || merged.name || current);
      });
      return merged;
    } catch (error) {
      console.error('Failed to load parent student data:', error);
      return null;
    }
  };

  const loadStudentProfile = async () => {
    try {
      setProfileLoading(true);
      const [username, schoolCode] = await Promise.all([
        AsyncStorage.getItem('username'),
        AsyncStorage.getItem('schoolCode'),
      ]);

      if (!username || !schoolCode) {
        setStudentProfile(null);
        return null;
      }

      const response = await fetch(
        `http://162.215.210.38:3010/api/student/profile?username=${encodeURIComponent(username)}&schoolCode=${encodeURIComponent(schoolCode)}`
      );
      const json = await response.json().catch(() => null);

      if (response.ok && json?.success && json?.student) {
        const nextProfile = {
          ...json.student,
          photoUrl: resolveRenderablePhotoUri(json.student.photoUrl || json.student.photo || ''),
        };
        setStudentProfile(nextProfile);
        await AsyncStorage.setItem('parentProfile', JSON.stringify(nextProfile));
        return nextProfile;
      }

      const fallbackProfile = {
        username,
        schoolCode,
        name: (await AsyncStorage.getItem('name')) || 'Parent',
        photoUrl: resolveRenderablePhotoUri((await AsyncStorage.getItem('photoUrl')) || ''),
      };
      setStudentProfile(fallbackProfile);
      await AsyncStorage.setItem('parentProfile', JSON.stringify(fallbackProfile));
      return fallbackProfile;
    } catch (error) {
      console.error('Failed to load parent profile:', error);
      setStudentProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  const loadChildren = async (profileLike?: Record<string, any> | null) => {
    try {
      setChildrenLoading(true);
      const base = profileLike || {};
      const username = String(base.username || (await AsyncStorage.getItem('username')) || '');
      const schoolCode = String(base.schoolCode || (await AsyncStorage.getItem('schoolCode')) || '');

      if (!username || !schoolCode) {
        setChildren([]);
        return [] as ParentChild[];
      }

      const profileRes = await axios.get('http://162.215.210.38:3010/api/student/profile', {
        params: { username, schoolCode },
      });

      if (!profileRes.data.success || !profileRes.data.student) {
        setChildren([]);
        return [] as ParentChild[];
      }

      const baseStudent = profileRes.data.student;
      const siblingsRes = await axios.post('http://162.215.210.38:3010/api/student/siblings', {
        username,
        schoolCode,
        father_name: baseStudent.father_name,
        phone_no: baseStudent.phone_no,
      });

      if (siblingsRes.data.success && Array.isArray(siblingsRes.data.siblings)) {
        const nextChildren = siblingsRes.data.siblings.map((child: any) => ({
          ...child,
          photoUrl: resolveRenderablePhotoUri(child.photoUrl || child.photo || ''),
        }));
        setChildren(nextChildren);
        return nextChildren;
      }

      setChildren([]);
      return [] as ParentChild[];
    } catch (error) {
      console.error('Failed to load parent children:', error);
      setChildren([]);
      return [] as ParentChild[];
    } finally {
      setChildrenLoading(false);
    }
  };

  const loadSummaries = async (profileLike?: Record<string, any> | null, dataLike?: Record<string, any> | null) => {
    const activeStudent = {
      ...(profileLike || {}),
      ...(dataLike || {}),
    };

    if (
      !activeStudent?.name ||
      !activeStudent?.class_name ||
      !activeStudent?.section ||
      !activeStudent?.schoolCode
    ) {
      return;
    }

    try {
      const studentId =
        activeStudent?.studentId ||
        activeStudent?.id ||
        (await AsyncStorage.getItem('studentId')) ||
        '';

      const [academicRes, feeRes] = await Promise.all([
        axios.post('https://cleezoclass.com:4000/api/overall/academic-performance', {
          name: activeStudent.name,
          class_name: activeStudent.class_name,
          section: activeStudent.section,
          schoolCode: activeStudent.schoolCode,
        }),
        axios.post('https://cleezoclass.com:4000/api/studentFees', {
          studentId,
          schoolCode: activeStudent.schoolCode,
        }),
      ]);

      const academicData = academicRes.data;
      const performance = Array.isArray(academicData)
        ? academicData
        : Array.isArray(academicData?.performance)
        ? academicData.performance
        : Array.isArray(academicData?.data)
        ? academicData.data
        : [];
      const testTypes = Array.isArray(academicData?.testTypes) ? academicData.testTypes : [];
      setAcademicSummary(computeAcademicSummary(performance, testTypes));

      const feeDetails = feeRes.data?.feeDetails || feeRes.data?.feeDetail || {};
      const paidAmount =
        Number(feeDetails.Paid_Amount ?? 0) +
        Number(feeDetails.Admission_paid ?? 0) +
        Number(feeDetails.books_paid ?? 0) +
        Number(feeDetails.uniform_paid ?? 0) +
        Number(feeDetails.bus_paid ?? 0) +
        Number(feeDetails.exam_paid ?? 0) +
        Number(feeDetails.others_paid ?? 0);
      const totalAmount = Number(feeDetails.Final_Amount ?? feeDetails.CompleteFee ?? 0);

      const formatINR = (value: number) =>
        new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2,
        }).format(value);

      setFeeSummary({
        paid: formatINR(paidAmount),
        due: formatINR(totalAmount - paidAmount),
        percent: totalAmount > 0 ? String(Math.max(0, Math.min(100, Math.round((paidAmount / totalAmount) * 100)))) : '0',
      });
    } catch (error) {
      console.error('Failed to load parent summaries:', error);
    }
  };

  const filteredAttendanceLeaves = useMemo(() => {
    const selectedUsername = normalizeValue(studentData?.username || studentProfile?.username);
    const selectedName = normalizeValue(studentData?.name || studentProfile?.name);
    const selectedClass = normalizeValue(studentData?.class_name || studentProfile?.class_name);
    const selectedSection = normalizeValue(studentData?.section || studentProfile?.section);

    return (Array.isArray(leaveData) ? leaveData : []).filter((item: any) => {
      const itemUsername = normalizeValue(item?.username);
      const itemName = normalizeValue(item?.student_name);
      const itemClass = normalizeValue(item?.class_name);
      const itemSection = normalizeValue(item?.section);

      const classSectionMatch = selectedClass && selectedSection
        ? itemClass === selectedClass && itemSection === selectedSection
        : true;

      const identityMatch = selectedName ? itemName === selectedName : false;
      const usernameMatch = selectedUsername ? itemUsername === selectedUsername : false;

      return (identityMatch && classSectionMatch) || (usernameMatch && classSectionMatch);
    });
  }, [leaveData, studentData?.username, studentData?.name, studentData?.class_name, studentData?.section, studentProfile?.username, studentProfile?.name, studentProfile?.class_name, studentProfile?.section]);

  useEffect(() => {
    const leaveCount = filteredAttendanceLeaves.length;
    setAttendanceCount(leaveCount);

    const leaveCountByType: Record<string, number> = {};
    filteredAttendanceLeaves.forEach((item: any) => {
      const key = String(item?.leave_type || 'Leave').trim() || 'Leave';
      leaveCountByType[key] = (leaveCountByType[key] || 0) + 1;
    });

    const labels = Object.keys(leaveCountByType);
    const data = Object.values(leaveCountByType);

    setAttendanceChartData(
      labels.length
        ? {
            labels,
            datasets: [{ data }],
          }
        : null
    );
  }, [filteredAttendanceLeaves]);

  useEffect(() => {
    const fetchAttendanceLeaves = async () => {
      try {
        const schoolCode = String(
          studentData?.schoolCode ||
          studentProfile?.schoolCode ||
          (await AsyncStorage.getItem('schoolCode')) ||
          ''
        ).trim();

        if (!schoolCode) {
          setLeaveData([]);
          return;
        }

        const response = await fetch(
          `http://162.215.210.38:3010/api/api/leave/all?schoolCode=${encodeURIComponent(schoolCode)}`
        );
        const data = await response.json().catch(() => []);
        setLeaveData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load attendance leaves:', error);
        setLeaveData([]);
      }
    };

    void fetchAttendanceLeaves();
  }, [studentData?.schoolCode, studentProfile?.schoolCode]);

  const refreshParentAccount = async () => {
    const data = await loadStudentData();
    const profile = await loadStudentProfile();
    const activeStudent = {
      ...(profile || {}),
      ...(data || {}),
    };

    await Promise.all([loadChildren(activeStudent), loadSummaries(profile, data)]);
  };

  useEffect(() => {
    const loadTeacherProfileCache = async () => {
      try {
        const cachedTeacherProfileRaw = await AsyncStorage.getItem('teacherProfile');
        if (!cachedTeacherProfileRaw) {
          setTeacherProfileCache(null);
          return;
        }

        const cachedTeacherProfile = JSON.parse(cachedTeacherProfileRaw);
        setTeacherProfileCache(cachedTeacherProfile);
      } catch (error) {
        console.error('Failed to load cached teacher profile:', error);
        setTeacherProfileCache(null);
      }
    };

    void loadTeacherProfileCache();
  }, [showProfileModal]);

  useEffect(() => {
    const loadSchoolLogo = async () => {
      try {
        const schoolCode = String(
          studentData?.schoolCode ||
            (await AsyncStorage.getItem('schoolCode')) ||
            ''
        ).trim();

        if (!schoolCode) {
          setSchoolLogo('');
          return;
        }

        const response = await fetch(
          `https://cleezoclass.com:4000/api/institute?dbName=${encodeURIComponent(schoolCode)}`
        );
        const data = await response.json().catch(() => null);
        const normalizedLogo = normalizeInstituteLogo(data?.logo);
        setSchoolLogo(normalizedLogo);
        if (normalizedLogo) {
          await AsyncStorage.setItem('schoolLogo', normalizedLogo);
        }
      } catch (error) {
        console.error('Failed to load school logo:', error);
        const cachedLogo = await AsyncStorage.getItem('schoolLogo');
        setSchoolLogo(cachedLogo || '');
      }
    };

    void loadSchoolLogo();
  }, [studentData?.schoolCode]);

  useEffect(() => {
    void refreshParentAccount();
  }, []);

  const visibleTiles = useMemo(() => {
    switch (selectedChip) {
      case 'Learning':
        return parentTiles.filter(
          (tile) =>
            tile.route === 'ParentAcademic' ||
            tile.route === 'ParentFees' ||
            tile.route === 'ParentAttendance' ||
            tile.route === 'ParentHomework' ||
            tile.route === 'ParentTimetable'
        );
      case 'Attendance':
        return parentTiles.filter((tile) => tile.route === 'ParentAttendance');
      case 'Support':
        return parentTiles.filter((tile) => tile.route === 'ParentLiveChatTicket');
      case 'Events':
        return parentTiles.filter(
          (tile) => tile.route === 'ParentHomepage' || tile.route === 'ParentCalender' || tile.route === 'ParentPhotos'
        );
      default:
        return parentTiles;
    }
  }, [selectedChip]);

  const selectedChipTiles = useMemo(() => {
    const quickOrder: ParentModuleRoute[] = [
      'ParentAcademic',
      'ParentHomework',
      'ParentFees',
      'ParentTimetable',
      'ParentCalender',
      'ParentPhotos',
      'ParentLiveChatTicket',
      'ParentHomepage',
    ];

    return quickOrder
      .map((route) => parentTiles.find((tile) => tile.route === route))
      .filter((tile): tile is ParentTile => {
        if (!tile) return false;

        switch (selectedChip) {
          case 'Learning':
            return (
            tile.route === 'ParentAcademic' ||
            tile.route === 'ParentFees' ||
            tile.route === 'ParentAttendance' ||
            tile.route === 'ParentHomework' ||
            tile.route === 'ParentTimetable'
          );
          case 'Attendance':
            return tile.route === 'ParentAttendance';
          case 'Support':
            return tile.route === 'ParentLiveChatTicket';
          case 'Events':
            return (
              tile.route === 'ParentHomepage' ||
              tile.route === 'ParentCalender' ||
              tile.route === 'ParentPhotos'
            );
          default:
            return true;
        }
      });
  }, [selectedChip]);

  const selectedSummary = useMemo(() => {
    switch (selectedChip) {
      case 'Learning':
        return 'Academic progress, fees, homework and timetable live here.';
      case 'Attendance':
        return 'Attendance leaves and history are shown here.';
      case 'Support':
        return 'Open chat and ticket tools for parent communication.';
      case 'Events':
        return 'See calendar events, photos and school announcements.';
      default:
        return 'Everything a parent needs in one launcher.';
    }
  }, [selectedChip]);

  const dashboardTiles = useMemo(
    () =>
      visibleTiles.map((tile) => {
        if (tile.route === 'ParentAcademic') {
          return {
            ...tile,
            metaLabel: 'Summary',
            metaValue: `${academicSummary.grade} • ${academicSummary.percentage}%`,
          };
        }

        if (tile.route === 'ParentFees') {
          return {
            ...tile,
            metaLabel: 'Summary',
            metaValue: feeSummary.due,
          };
        }

        if (tile.route === 'ParentAttendance') {
          return {
            ...tile,
            metaLabel: 'Leaves',
            metaValue: String(attendanceCount),
          };
        }

        if (tile.route === 'ParentHomework') {
          return {
            ...tile,
            metaLabel: 'Tasks',
            metaValue: 'Open work',
          };
        }

        if (tile.route === 'ParentTimetable') {
          return {
            ...tile,
            metaLabel: 'Slot',
            metaValue: 'Today',
          };
        }

        if (tile.route === 'ParentCalender') {
          return {
            ...tile,
            metaLabel: 'Events',
            metaValue: 'This week',
          };
        }

        if (tile.route === 'ParentPhotos') {
          return {
            ...tile,
            metaLabel: 'Gallery',
            metaValue: 'Latest photos',
          };
        }

        if (tile.route === 'ParentLiveChatTicket') {
          return {
            ...tile,
            metaLabel: 'Support',
            metaValue: 'Chat now',
          };
        }

        return {
          ...tile,
          metaLabel: 'Updates',
          metaValue: 'News',
        };
      }),
    [academicSummary.grade, academicSummary.percentage, attendanceCount, feeSummary.due, visibleTiles]
  );

  const parentActionCards = useMemo(
    () => [
      {
        id: 'fees-due',
        title: 'Fees Due',
        value: feeSummary.due,
        subtitle: 'Review payment summary',
        cta: 'Open Fees',
        image: require('../assets/feesAnimated.png'),
        route: 'ParentFees' as ParentModuleRoute,
        accent: '#FFF',
      },
      {
        id: 'attendance',
        title: 'Attendance',
        value: `${attendanceCount} leaves`,
        subtitle: 'Check attendance history',
        cta: 'Open Attendance',
        image: require('../assets/leaveannimated.png'),
        route: 'ParentAttendance' as ParentModuleRoute,
        accent: '#FFF',
      },
      {
        id: 'homework',
        title: 'Homework',
        value: 'Open work',
        subtitle: 'See assignments and tasks',
        cta: 'Open Homework',
        image: require('../assets/homework animated.png'),
        route: 'ParentHomework' as ParentModuleRoute,
        accent: '#FFF',
      },
    ],
    [attendanceCount, feeSummary.due]
  );

  useEffect(() => {
    if (parentActionAnimValues.current.length !== parentActionCards.length) {
      parentActionAnimValues.current = parentActionCards.map(() => new Animated.Value(0));
    }

    const animations = parentActionAnimValues.current.map((animValue) =>
      Animated.spring(animValue, {
        toValue: 1,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      })
    );

    Animated.stagger(120, animations).start();
  }, [parentActionCards, parentActionAnimValues]);

  useEffect(() => {
    if (parentActionImageAnimValues.current.length !== parentActionCards.length) {
      parentActionImageAnimValues.current = parentActionCards.map(() => new Animated.Value(0));
    }

    parentActionImageLoops.current.forEach((animation) => animation.stop());
    parentActionImageLoops.current = parentActionCards.map((_, index) => {
      const animValue = parentActionImageAnimValues.current[index];
      animValue.setValue(0);

      const sequence = Animated.sequence([
        Animated.delay(index * 140),
        Animated.loop(
          Animated.sequence([
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
        ),
      ]);

      sequence.start();
      return sequence;
    });

    return () => {
      parentActionImageLoops.current.forEach((animation) => animation.stop());
    };
  }, [parentActionCards]);

  const openModule = (route: ParentModuleRoute) => {
    setSelectedModule(route);
    (navigation.navigate as any)(
      route,
      {
        username: studentData?.username || studentProfile?.username || '',
        name: studentData?.name || studentProfile?.name || '',
      }
    );
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleOpenHomePanel = () => {
    setSelectedChip('Overview');
    setSelectedModule('ParentAcademic');
  };

  useEffect(() => {
    setSelectedModule(selectedChipTiles[0]?.route ?? 'ParentHomework');
  }, [selectedChipTiles]);

  const handleAddPress = () => {
    openModule('ParentAcademic');
  };

  const handleTilePress = (route: ParentModuleRoute) => {
    openModule(route);
  };

  const handleOpenChat = () => {
    openModule('ParentLiveChatTicket');
  };

  const handleOpenProfilePanel = () => {
    setShowProfileModal(true);
    void refreshParentAccount();
  };

  const schoolNameDisplay =
    String(
      studentData?.school_name ||
        studentProfile?.school_name ||
        studentData?.schoolCode ||
        studentProfile?.schoolCode ||
        teacherProfileCache?.schoolCode ||
        'School Name'
    ).trim();
  const activeStudentName =
    String(studentData?.name || studentProfile?.name || loginName || 'Student').trim() || 'Student';
  const activeStudentClass =
    String(studentData?.class_name || studentProfile?.class_name || '-').trim() || '-';
  const activeStudentSection =
    String(studentData?.section || studentProfile?.section || '-').trim() || '-';
  const activeStudentPhone = String(
    studentData?.phone_no || studentProfile?.phone_no || studentProfile?.mobile || studentData?.mobile || '-'
  ).trim() || '-';
  const activeStudentFather =
    String(studentData?.father_name || studentProfile?.father_name || '-').trim() || '-';
  const activeStudentId = String(
    studentData?.studentId || studentProfile?.studentId || studentData?.id || studentProfile?.id || '-'
  ).trim() || '-';
  const activeStudentPhoto = resolveRenderablePhotoUri(
    studentData?.photoUrl || studentData?.photo || studentProfile?.photoUrl || studentProfile?.photo || ''
  );
  const activeStudentInitial = activeStudentName.trim().charAt(0).toUpperCase() || 'S';
  const studentProfileRows = [
    { label: 'Student name', value: activeStudentName },
    { label: 'Class', value: `${activeStudentClass} - ${activeStudentSection}` },
    { label: 'Father name', value: activeStudentFather },
    { label: 'Phone', value: activeStudentPhone },
    { label: 'Student ID', value: activeStudentId },
  ];

  const handleSwitchToChild = async (child: ParentChild) => {
    try {
      const existingSchoolCode = await AsyncStorage.getItem('schoolCode');
      const safeSchoolCode = String(child.schoolCode || existingSchoolCode || '');
      const existingUsername = await AsyncStorage.getItem('username');
      const safeUsername = String(child.username || existingUsername || '');
      const existingParentName = await AsyncStorage.getItem('parentName');
      const safeParentName = String(existingParentName || loginName || '');

      await AsyncStorage.multiSet([
        ['studentId', String(child.id || '')],
        ['username', safeUsername],
        ['schoolCode', safeSchoolCode],
        ['parentName', safeParentName],
        ['name', child.name || ''],
        ['class_name', child.class_name || ''],
        ['section', child.section || ''],
        ['photoUrl', resolveRenderablePhotoUri(child.photoUrl || child.photo || '')],
        ['aadhar_no', child.aadhar_no || ''],
        ['address', child.address || ''],
        ['class_teacher', child.class_teacher || ''],
        ['father_name', child.father_name || ''],
        ['gender', child.gender || ''],
        ['phone_no', child.phone_no || ''],
        ['school_name', child.school_name || ''],
        ['userType', 'student'],
      ]);
      await AsyncStorage.setItem('currentStudent', JSON.stringify(child));

      setShowProfileModal(false);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'ParentDashboard' as never,
            params: {
              username: safeUsername,
              name: child.name || '',
            } as never,
          },
        ],
      });
    } catch (error) {
      console.error('Failed to switch child:', error);
      Alert.alert('Error', 'Failed to switch to this student.');
    }
  };

  const canSwitchToTeacherAccount = useMemo(() => {
    const currentName = normalizeText(studentProfile?.father_name || studentData?.father_name);
    const currentPhone = normalizePhone(
      studentProfile?.phone_no || studentData?.phone_no || studentData?.mobile || ''
    );
    const teacherName = normalizeText(teacherProfileCache?.name);
    const teacherPhone = normalizePhone(
      teacherProfileCache?.phoneNo ||
        teacherProfileCache?.phone_no ||
        teacherProfileCache?.mobile_number ||
        ''
    );

    return Boolean(
      teacherProfileCache &&
        normalizeText(teacherProfileCache?.userType) === 'teacher' &&
        currentName &&
        currentPhone &&
        currentName === teacherName &&
        currentPhone === teacherPhone
    );
  }, [studentData?.father_name, studentData?.phone_no, studentData?.mobile, studentProfile, teacherProfileCache]);

  const handleSwitchToTeacherAccount = async () => {
    try {
      if (!teacherProfileCache) {
        Alert.alert('Unavailable', 'Teacher account details were not found on this device.');
        return;
      }

      const username = String(teacherProfileCache.username || '');
      const schoolCode = String(teacherProfileCache.schoolCode || '');
      const name = String(teacherProfileCache.name || '');
      const designation = String(teacherProfileCache.designation || '');

      await AsyncStorage.multiSet([
        ['username', username],
        ['name', name],
        ['schoolCode', schoolCode],
        ['designation', designation],
        ['userType', 'teacher'],
        ['userDetails', JSON.stringify(teacherProfileCache)],
        ['lastScreen', 'TeacherAdmissionDashboard'],
      ]);
      await cacheTeacherProfile(teacherProfileCache);

      setShowProfileModal(false);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'TeacherAdmissionDashboard' as never,
            params: { username, name },
          },
        ],
      });
    } catch (error) {
      console.error('Failed to switch to teacher account:', error);
      Alert.alert('Error', 'Failed to switch to teacher account.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              'username',
              'userType',
              'name',
              'schoolCode',
              'designation',
              'lastScreen',
              'studentId',
              'activeChildId',
              'activeChildName',
              'activeChildClass',
              'activeChildSection',
              'activeRole',
              'activeUserType',
              'currentChildData',
              'fcmToken',
            ]);
          } catch (error) {
            console.error('Failed to clear parent session:', error);
          } finally {
            setShowProfileModal(false);
            navigation.reset({
              index: 0,
              routes: [{ name: 'TeacherLogin' }],
            });
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={"#0a3d62"} />

      <View style={styles.background}>
        <View style={styles.phoneShell}>
          <View style={styles.phoneFrame}>
            <LinearGradient
              pointerEvents="none"
              colors={['#07162F', '#112B57', '#1E3F76']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dashboardTopGradient}
            />
            <View style={styles.toolbar}>
              <View style={styles.toolbarBrand}>
                <Image
                  source={schoolLogo ? { uri: schoolLogo } : logoImage}
                  style={styles.toolbarBrandLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.toolbarCenterAbsolute}>
                <Text style={styles.toolbarBrandName} numberOfLines={1}>
                  {schoolNameDisplay}
                </Text>
              </View>
              <View style={styles.toolbarSpacer} />
              
            </View>

            <View style={styles.dashboardHeroCard}>
              <LinearGradient
                colors={['#0A1D3E', '#163568', '#244B85']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dashboardHeroGradientCard}
              >
                <View style={styles.dashboardHeroExpandedLayout}>
                  <View style={styles.dashboardHeroExpandedLeft}>
                    <Text style={styles.dashboardHeroSchool} numberOfLines={1}>
                      {schoolNameDisplay}
                    </Text>
                    <Text style={styles.dashboardHeroClass} numberOfLines={1}>
                      {activeStudentClass} {activeStudentSection}
                    </Text>
                    <Text style={styles.dashboardHeroName} numberOfLines={2}>
                      {activeStudentName}
                    </Text>
                  </View>
                  <View style={styles.dashboardHeroExpandedRight}>
                    {childrenLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      (() => {
                        const otherChildren = children.filter(
                          (child) =>
                            String(child.id) !==
                            String(studentData?.studentId || studentProfile?.studentId || ''),
                        );

                        return (
                          <ScrollView
                            horizontal
                            nestedScrollEnabled
                            directionalLockEnabled
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.dashboardHeroProfilesRow}
                          >
                            {otherChildren.slice(0, 2).map((child, index) => {
                              const childPhoto = resolveRenderablePhotoUri(child.photoUrl || child.photo || '');
                              const childInitial =
                                (child.name || child.username || `S${index + 1}`).trim().charAt(0).toUpperCase() || 'S';

                              return (
                                <Pressable
                                  key={child.id || index}
                                  onPress={() => handleSwitchToChild(child)}
                                  style={[
                                    styles.dashboardHeroSecondaryProfile,
                                    styles.dashboardHeroProfileItem,
                                  ]}
                                >
                                  <View style={styles.dashboardHeroSecondaryAvatarWrap}>
                                    {childPhoto ? (
                                      <Image
                                        source={{ uri: childPhoto }}
                                        style={styles.dashboardHeroSecondaryAvatar}
                                        resizeMode="cover"
                                      />
                                    ) : (
                                      <Text style={styles.dashboardHeroSecondaryAvatarText}>
                                        {childInitial}
                                      </Text>
                                    )}
                                  </View>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        );
                      })()
                    )}
                  </View>
                </View>
                <View style={styles.dashboardHeroActiveProfileFloat} pointerEvents="none">
                  <View style={styles.dashboardHeroPrimaryProfile}>
                    {activeStudentPhoto ? (
                      <Image
                        source={{ uri: activeStudentPhoto }}
                        style={styles.dashboardHeroPrimaryAvatar}
                        resizeMode="cover"
                        onLoad={() => {
                          console.log('[ParentDashboard] hero photo loaded', {
                            uri: activeStudentPhoto,
                            studentName: activeStudentName,
                          });
                        }}
                        onError={(event) => {
                          console.log('[ParentDashboard] hero photo failed', {
                            uri: activeStudentPhoto,
                            studentName: activeStudentName,
                            error: event?.nativeEvent?.error || null,
                          });
                        }}
                      />
                    ) : (
                      <Text style={styles.dashboardHeroPrimaryAvatarText}>
                        {activeStudentInitial}
                      </Text>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </View>
            <ScrollView
              ref={scrollRef}
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
            >
{/* 
              <View style={[styles.chipStickyHeader, styles.chipRowSection]}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectedChipMapRow}
                >
                  {selectedChipTiles.map((tile, index) => {
                    const active = selectedModule === tile.route;

                    return (
                      <Pressable
                        key={tile.route}
                        onPress={() => openModule(tile.route)}
                        style={[
                          styles.selectedChipMapItem,
                          index !== selectedChipTiles.length - 1 &&
                            styles.selectedChipMapItemSpacing,
                          active ? styles.selectedChipMapItemActive : styles.selectedChipMapItemInactive,
                        ]}
                      >
                        <View style={styles.selectedChipMapIconWrap}>
                          {renderIcon(tile.kind, tile.icon, active ? '#1F1F22' : '#6A6A70', 18)}
                        </View>
                        <Text
                          style={[
                            styles.selectedChipMapText,
                            active
                              ? styles.selectedChipMapTextActive
                              : styles.selectedChipMapTextInactive,
                          ]}
                        >
                          {tile.label}
                        </Text>
                        {active ? <View style={styles.selectedChipMapActiveIndicator} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View> */}

              <View style={styles.parentActionSection}>
                <Text style={styles.parentActionTitle}>Quick Actions</Text>
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
                  {parentActionCards.map((action, index) => {
                    const animValue = parentActionAnimValues.current[index] || new Animated.Value(1);
                    const imageAnimValue =
                      parentActionImageAnimValues.current[index] || new Animated.Value(0);
                    const imageTranslateY = imageAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    });
                    const imageScale = imageAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.06],
                    });
                    const imageRotate = imageAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '-4deg'],
                    });

                    return (
                      <Animated.View
                        key={action.id}
                        style={{
                          opacity: animValue,
                          transform: [
                            {
                              translateY: animValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: [16, 0],
                              }),
                            },
                            {
                              scale: animValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.98, 1],
                              }),
                            },
                          ],
                        }}
                      > 
                        <Pressable
                          onPress={() => openModule(action.route)}
                          style={[
                            styles.parentActionCard,
                            { backgroundColor: action.accent },
                            index !== parentActionCards.length - 1 && styles.parentActionCardSpacing,
                          ]}
                        >
                          <View style={styles.parentActionCardBody}>
                            <View style={styles.parentActionCardTextBlock}>
                              <Text style={styles.parentActionCardLabel}>{action.title}</Text>
                              <Text style={styles.parentActionCardValue} numberOfLines={1}>
                                {action.value}
                              </Text>
                              <Text style={styles.parentActionCardSubtitle} numberOfLines={2}>
                                {action.subtitle}
                              </Text>
                              <View style={styles.parentActionCta}>
                                <Text style={styles.parentActionCtaText}>{action.cta}</Text>
                              </View>
                            </View>
                            <Animated.Image
                              source={action.image}
                              style={[
                                styles.parentActionImage,
                                {
                                  transform: [
                                    { translateY: imageTranslateY },
                                    { scale: imageScale },
                                    { rotate: imageRotate },
                                  ],
                                },
                              ]}
                              resizeMode="contain"
                            />
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={{ marginBottom: 10, paddingHorizontal: 5, paddingVertical: 5 }}>
                <Text style={styles.sectionTitle}>Parent Dashboard</Text>
                <Text style={{ color: '#68686D', fontSize: 13, marginTop: -6, marginBottom: 8 }}>
                  {selectedSummary}
                </Text>
              </View>

              <View style={styles.dashboardGrid}>
                {dashboardTiles.map((tile) => (
                  <Pressable
                    key={tile.route}
                    onPress={() => handleTilePress(tile.route)}
                    style={[
                      styles.dashboardGridCard,
                      selectedModule === tile.route && styles.dashboardGridCardActive,
                    ]}
                  >
                    <View style={styles.dashboardGridCornerAccent} />
                    <View style={styles.gridIconWrap}>
                      {renderIcon(tile.kind, tile.icon, '#000000', 24)}
                    </View>
                    <View style={styles.dashboardGridCardContent}>
                      <View style={styles.dashboardGridTextBlock}>
                        <Text style={styles.gridLabel} numberOfLines={2}>
                          {tile.label}
                        </Text>
                        <Text style={styles.dashboardGridMetaLabel} numberOfLines={1}>
                          {tile.metaLabel}
                        </Text>
                        <Text style={styles.dashboardGridMetaValue} numberOfLines={1}>
                          {tile.metaValue}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>

              {/* <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: Math.max(phoneHeight * 0.24, 180) }}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                <View style={[styles.statusCardsRow, { paddingHorizontal: 5 }]}>
                  <View
                    style={[
                      styles.statusCard,
                      styles.statusCardLeft,
                      { backgroundColor: '#D7E8C9' },
                    ]}
                    onLayout={(event) => {
                      sectionPositions.current.ParentAcademic = event.nativeEvent.layout.y;
                    }}
                  >
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      style={styles.statusCardTextScroll}
                      contentContainerStyle={styles.statusCardTextScrollContent}
                    >
                      <View style={styles.statusTitleRow}>
                        <Text style={styles.statusNumber} numberOfLines={1} ellipsizeMode="tail">
                          Academic
                        </Text>
                        <Text style={styles.statusSubtitle} numberOfLines={1} ellipsizeMode="tail">
                          {academicSummary.grade}
                        </Text>
                      </View>
                      <Text style={styles.statusFooter} numberOfLines={1} ellipsizeMode="tail">
                        {academicSummary.percentage}%
                      </Text>
                      <Pressable
                        onPress={() => openModule('ParentAcademic')}
                        style={styles.statusActionButton}
                      >
                        <Text style={styles.statusActionLink}>Open Academic</Text>
                      </Pressable>
                    </ScrollView>
                    <View style={styles.statusIconWrap}>
                      <MaterialIcons name="school" size={30} color="#000000" />
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusCard,
                      styles.statusCardRight,
                      { backgroundColor: '#F2EE9E' },
                    ]}
                    onLayout={(event) => {
                      sectionPositions.current.ParentFees = event.nativeEvent.layout.y;
                    }}
                  >
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      style={styles.statusCardTextScroll}
                      contentContainerStyle={styles.statusCardTextScrollContent}
                    >
                      <View style={styles.statusTitleRow}>
                        <Text style={styles.statusNumber} numberOfLines={1} ellipsizeMode="tail">
                          Fees
                        </Text>
                        <Text style={styles.statusSubtitle} numberOfLines={1} ellipsizeMode="tail">
                          Summary
                        </Text>
                      </View>
                      <Text style={styles.statusFooter} numberOfLines={1} ellipsizeMode="tail">
                        {feeSummary.due}
                      </Text>
                      <Pressable
                        onPress={() => openModule('ParentFees')}
                        style={styles.statusActionButton}
                      >
                        <Text style={styles.statusActionLink}>Open Fees</Text>
                      </Pressable>
                    </ScrollView>
                    <View style={styles.statusIconWrap}>
                      <MaterialIcons name="payments" size={30} color="#000000" />
                    </View>
                  </View>
                </View>
              </ScrollView> */}

              {/* <View
                onLayout={(event) => {
                  sectionPositions.current.ParentAcademic = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Academic</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Student marks, grades and performance.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentAcademicView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentFees = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Fees</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Fee totals, breakdown and installments.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentFeesView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentHomework = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Homework</Text>
                    </View>
                  </View>
                </View>
                <ParentHomeworkView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentTimetable = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Timetable</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Daily class routine and periods.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentTimetableView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentCalender = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Calendar</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Events, holidays and school timeline.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentCalenderView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentPhotos = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Photos</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Gallery and school media updates.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentPhotosView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentLiveChatTicket = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Chat & Tickets</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Messages and support requests.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentLiveChatTicketView embedded />
              </View> */}

            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.footerNav}>
                <Pressable style={styles.footerNavItem} onPress={handleGoBack}>
                  <Image source={backArrowImage} style={{ width: 22, height: 22 }} resizeMode="contain" />
                  <Text style={styles.footerNavLabel}>Back</Text>
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenHomePanel}>
                  <MaterialIcons name="home" size={22} color="#000000" />
                  <Text style={styles.footerNavLabel}>Home</Text>
                </Pressable>
                <Pressable style={styles.footerAddButton} onPress={handleAddPress}>
                  <MaterialIcons name="add" size={26} color="#FFFFFF" />
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenChat}>
                  <MaterialIcons name="chat-bubble-outline" size={22} color="#000000" />
                  <Text style={styles.footerNavLabelMuted}>Chat</Text>
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenProfilePanel}>
                  <MaterialIcons name="person-outline" size={22} color="#000000" />
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
      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.teacherPopupCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 2 }}
            >
              <View style={styles.teacherHeaderRow}>
                <View style={styles.teacherAvatar}>
                  {resolveRenderablePhotoUri(studentProfile?.photoUrl || studentProfile?.photo || '') ? (
                    <Image
                      source={{ uri: resolveRenderablePhotoUri(studentProfile?.photoUrl || studentProfile?.photo || '') }}
                      style={{ width: '100%', height: '100%', borderRadius: 26 }}
                      resizeMode="cover"
                      onLoad={() => {
                        console.log('[ParentDashboard] profile photo loaded', {
                          uri: resolveRenderablePhotoUri(studentProfile?.photoUrl || studentProfile?.photo || ''),
                          name: studentProfile?.name || null,
                        });
                      }}
                      onError={(event) => {
                        console.log('[ParentDashboard] profile photo failed', {
                          uri: resolveRenderablePhotoUri(studentProfile?.photoUrl || studentProfile?.photo || ''),
                          name: studentProfile?.name || null,
                          error: event?.nativeEvent?.error || null,
                        });
                      }}
                    />
                  ) : (
                    <Text style={styles.teacherAvatarText}>
                      {(studentProfile?.name || studentProfile?.username || 'P')
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.teacherHeaderText}>
                  <Text style={styles.teacherTitle}>Parent Profile</Text>
                  <Text style={styles.teacherSubtitle}>
                    {studentProfile?.name || 'Parent profile'}
                  </Text>
                </View>
              </View>

              {profileLoading ? (
                <ActivityIndicator size="large" color="#000" style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <View style={styles.teacherDetailsList}>
                    <View style={styles.teacherDetailRow}>
                      <Text style={styles.teacherDetailLabel}>Father Name</Text>
                      <Text style={styles.teacherDetailValue}>
                        {studentProfile?.father_name || '-'}
                      </Text>
                    </View>
                  </View>

       

                  <View style={[styles.teacherDetailsList, { marginBottom: 8 }]}>
                    <Text style={styles.teacherTitle}>Switch Student</Text>
                    <Text style={styles.teacherSubtitle}>
                      Tap a student below to switch the active profile.
                    </Text>

                    {childrenLoading ? (
                      <ActivityIndicator size="small" color="#000" style={{ marginVertical: 16 }} />
                    ) : children.length > 0 ? (
                      children.map((child, index) => {
                        const isActive =
                          String(child.id) === String(studentData?.studentId || studentProfile?.studentId || '');

                        return (
                          <Pressable
                            key={child.id || index}
                            onPress={() => handleSwitchToChild(child)}
                            style={[
                              styles.teacherDetailRow,
                              {
                                backgroundColor: isActive ? '#EEF4FF' : '#F7F8FA',
                                borderColor: isActive ? '#B7C9FF' : '#ECEEF3',
                              },
                            ]}
                          >
                            <Text style={styles.teacherDetailLabel}>
                              {child.name || `Student ${index + 1}`}
                            </Text>
                            <Text style={styles.teacherDetailValue}>
                              Class {child.class_name || '-'} - Section {child.section || '-'}
                            </Text>
                            <Text style={[styles.teacherDetailValue, { marginTop: 4, fontSize: 12 }]}>
                              {child.username ? `Username: ${child.username}` : 'Tap to switch'}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={{ color: '#666', fontStyle: 'italic', marginTop: 8 }}>
                        No additional students found for this parent account.
                      </Text>
                    )}
                  </View>

                  {canSwitchToTeacherAccount && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.teacherTitle}>Switch Account</Text>
                      <Text style={styles.teacherSubtitle}>
                        A matching teacher account was found on this device.
                      </Text>
                      <Pressable
                        style={[
                          styles.popupButton,
                          styles.popupButtonPrimary,
                          styles.teacherActionButton,
                          { marginTop: 12 },
                        ]}
                        onPress={handleSwitchToTeacherAccount}
                      >
                        <Text style={styles.popupButtonText}>Switch to Teacher Account</Text>
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.teacherActions}>
                    <Pressable
                      style={[styles.popupButton, styles.popupButtonSecondary, styles.teacherActionButton]}
                      onPress={() => setShowProfileModal(false)}
                    >
                      <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                        Close
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.popupButton, styles.popupButtonPrimary, styles.teacherActionButton]}
                      onPress={handleLogout}
                    >
                      <Text style={styles.popupButtonText}>Logout</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAttendanceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttendanceModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.teacherPopupCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 2 }}
            >
              <View style={styles.teacherHeaderRow}>
                <View style={styles.teacherAvatar}>
                  <MaterialIcons name="event-note" size={28} color="#fff" />
                </View>
                <View style={styles.teacherHeaderText}>
                  <Text style={styles.teacherTitle}>Attendance</Text>
                  <Text style={styles.teacherSubtitle}>
                    Leave summary for {activeStudentName}
                  </Text>
                </View>
              </View>

              {attendanceChartData ? (
                <BarChart
                  data={attendanceChartData}
                  width={Math.max(phoneWidth - 80, 250)}
                  height={220}
                  fromZero
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  withOuterLines
                  segments={4}
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(13, 63, 102, ${opacity})`,
                    labelColor: () => '#111',
                    propsForBackgroundLines: {
                      stroke: '#E9E9EE',
                      strokeDasharray: '',
                    },
                    propsForBarLabels: {
                      fill: '#111',
                    },
                  }}
                  style={{ borderRadius: 14, marginVertical: 8 }}
                />
              ) : (
                <Text style={styles.teacherSubtitle}>
                  No attendance/leave data found for this student.
                </Text>
              )}

              <View style={styles.teacherDetailsList}>
                <View style={styles.teacherDetailRow}>
                  <Text style={styles.teacherDetailLabel}>Leave Records</Text>
                  <Text style={styles.teacherDetailValue}>{attendanceCount}</Text>
                </View>
              </View>

              <View style={styles.teacherActions}>
                <Pressable
                  style={[styles.popupButton, styles.popupButtonSecondary, styles.teacherActionButton]}
                  onPress={() => setShowAttendanceModal(false)}
                >
                  <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                    Close
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ParentDashboard;
