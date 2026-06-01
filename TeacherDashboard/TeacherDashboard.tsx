import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  ActivityIndicator,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import notifee, { AndroidImportance } from '@notifee/react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import { createAppStyles } from '../App.styles';
import {
  startPersistentAttendanceTracking,
  stopPersistentAttendanceTracking,
} from './AttendanceService';
import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';
import TeacherAttendance from './TeacherAttendance';
import TeacherBehaviour from './TeacherBehaviour';
import TeacherTimetable from './TeacherTimetable';
import TeacherEventMediaUpload from './TeacherEventMediaUpload';
import TeacherTickets from './TeacherTickets';
import TeacherSalary from './TeacherSalary';
import TeacherCalender from './TeacherCalender';
import TeacherDetails from './TeacherDetails';
import TeacherHomework from './TeacherHomework';
import TopicOfDay from './TopicOfDay';
import TeacherQuestionPaperGeneration from './TeacherQuestionPaperGeneration';
import HandwritingScanPull from './Scan&Pull';
import TeacherLeaveRequest from './TeacherLeaveRequest';
import TeacherChatAndEvents from './TeacherChatAndEvents';
import TeacherCounselling from './Teacher_Councelling';

type IconKind = 'material' | 'fontawesome';

type DashboardTile = {
  label: string;
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

const heroImage: ImageSourcePropType = require('../assets/dashboard.png');
const logoImage: ImageSourcePropType = require('../assets/Cleezo.png');
const REMINDER_NOTIFICATION_CHANNEL_ID = 'reminders';

const topChips = ['Daily Routines'];

const dashboardTilesMap: Record<string, DashboardTile[]> = {
  'Daily Routines': [
    { label: 'Attendance', icon: 'how-to-reg', kind: 'material' },
    { label: 'Homework', icon: 'assignment', kind: 'material' },
    { label: 'Time table', icon: 'schedule', kind: 'material' },
    { label: 'Topic of day', icon: 'today', kind: 'material' },
    { label: 'Behaviour', icon: 'person', kind: 'material' },
    { label: 'Photo', icon: 'photo-library', kind: 'material' },
    { label: 'Calendar', icon: 'event', kind: 'material' },
    { label: 'Scan', icon: 'qr-code-scanner', kind: 'material' },
    { label: 'Salary', icon: 'payments', kind: 'material' },
    { label: 'Leave', icon: 'event-busy', kind: 'material' },
    { label: 'Chat', icon: 'chat', kind: 'material' },
    // { label: 'Student Report', icon: 'description', kind: 'material' },
  ],

};

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

    const response = await fetch(
      `http://162.215.210.38:3010/api/teacher-attendance-alert?username=${username}&schoolCode=${schoolCode}`
    );

    if (!response.ok) {
      console.error(
        `Attendance notification fetch failed: ${response.status} ${response.statusText}`
      );
      return;
    }

    const data = await response.json();
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
    console.error('Attendance notification error:', error);
  }
};

const triggerHomeworkNotification = async (username: string, schoolCode: string) => {
  try {
    const now = new Date();
    if (now.getHours() < 18) return;

    const lastShown = await AsyncStorage.getItem('lastHomeworkNotification');
    const today = now.toDateString();
    if (lastShown === today) return;

    const response = await fetch(
      `http://162.215.210.38:3010/api/check-homework/${username}?schoolCode=${schoolCode}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'user-type': 'teacher',
        },
      }
    );

    if (!response.ok) {
      console.error(
        `Homework notification fetch failed: ${response.status} ${response.statusText}`
      );
      return;
    }

    const data = await response.json();
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
    console.error('Homework notification error:', error);
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
};

type TeacherDashboardParams = {
  username?: string;
  name?: string;
  moduleLabel?: string;
};

type RootStackParamList = {
  TeacherAdmissionDashboard: TeacherDashboardParams | undefined;
  TeacherDashboard: TeacherDashboardParams | undefined;
  TeacherAttendance: TeacherDashboardParams | undefined;
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
  const [selectedChip, setSelectedChip] = useState(topChips[0]);
  const [selectedModule, setSelectedModule] = useState('Attendance');
  const scrollRef = useRef<ScrollView | null>(null);
  const moduleOffsetsRef = useRef<Record<string, number>>({});
  const pendingScrollModuleRef = useRef<string | null>(null);
  const currentModuleRef = useRef('Attendance');
  const moduleHistoryRef = useRef<string[]>(['Attendance']);
  const [snapOffsets, setSnapOffsets] = useState<number[]>([0]);
  const [showTeacherDetails, setShowTeacherDetails] = useState(false);
  const [showAccountSwitchOptions, setShowAccountSwitchOptions] = useState(false);
  const [showNextClassReport, setShowNextClassReport] = useState(false);
  const [showFooterNav, setShowFooterNav] = useState(false);
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
  });
  const normalizeText = (value: any) =>
    String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizePhone = (value: any) => String(value ?? '').replace(/\D/g, '');

  useEffect(() => {
    setProfileReady(false);
    const loadTeacherProfile = async () => {
      try {
        const storedUserDetailsRaw = await AsyncStorage.getItem('userDetails');
        const storedUserDetails = storedUserDetailsRaw ? JSON.parse(storedUserDetailsRaw) : {};
        const storedUsername = await AsyncStorage.getItem('username');
        const storedName = await AsyncStorage.getItem('name');
        const storedDesignation = await AsyncStorage.getItem('designation');
        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
        const storedUserType = await AsyncStorage.getItem('userType');
        const params = route.params ?? {};

        setTeacherProfile({
          username:
            params.username ||
            storedUserDetails.username ||
            storedUserDetails.user_name ||
            storedUsername ||
            '',
          name:
            params.name ||
            storedUserDetails.name ||
            storedUserDetails.teacher_name ||
            storedName ||
            '',
          designation:
            storedUserDetails.designation ||
            storedDesignation ||
            storedUserDetails.role ||
            '',
          schoolCode: String(storedUserDetails.schoolCode || storedSchoolCode || ''),
          userType: String(storedUserDetails.userType || storedUserType || ''),
          phoneNo: String(
            storedUserDetails.phone_no ||
              storedUserDetails.phoneNo ||
              storedUserDetails.mobile_number ||
              storedUserDetails.contact_no ||
              ''
          ),
          subject: String(
            storedUserDetails.subject ||
              storedUserDetails.class_name ||
              storedUserDetails.department ||
              ''
          ),
          teacherId: String(storedUserDetails.teacher_id || storedUserDetails.id || ''),
          email: String(storedUserDetails.email_id || storedUserDetails.email || ''),
        });

        const cachedTeacherProfile = {
          username:
            params.username ||
            storedUserDetails.username ||
            storedUserDetails.user_name ||
            storedUsername ||
            '',
          name:
            params.name ||
            storedUserDetails.name ||
            storedUserDetails.teacher_name ||
            storedName ||
            '',
          designation:
            storedUserDetails.designation ||
            storedDesignation ||
            storedUserDetails.role ||
            '',
          schoolCode: String(storedUserDetails.schoolCode || storedSchoolCode || ''),
          userType: String(storedUserDetails.userType || storedUserType || ''),
          phoneNo: String(
            storedUserDetails.phone_no ||
              storedUserDetails.phoneNo ||
              storedUserDetails.mobile_number ||
              storedUserDetails.contact_no ||
              ''
          ),
          subject: String(
            storedUserDetails.subject ||
              storedUserDetails.class_name ||
              storedUserDetails.department ||
              ''
          ),
          teacherId: String(storedUserDetails.teacher_id || storedUserDetails.id || ''),
          email: String(storedUserDetails.email_id || storedUserDetails.email || ''),
        };

        await AsyncStorage.setItem('teacherProfile', JSON.stringify(cachedTeacherProfile));
      } catch (error) {
        console.error('Failed to load teacher profile:', error);
      } finally {
        setProfileReady(true);
      }
    };

    loadTeacherProfile();
  }, [route.params]);

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
      } catch (error) {
        console.error('Failed to load cached parent profile:', error);
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
      } catch (error) {
        console.error('Failed to load school logo:', error);
      }
    };

    loadSchoolLogo();
  }, []);

  useEffect(() => {
    const visibleLabels = dashboardTilesMap[selectedChip]?.map((tile) => tile.label) || [];
    if (!visibleLabels.includes(selectedModule)) {
      setSelectedModule(visibleLabels[0] || 'Attendance');
      currentModuleRef.current = visibleLabels[0] || 'Attendance';
    }
    moduleHistoryRef.current = [visibleLabels[0] || 'Attendance'];
    pendingScrollModuleRef.current = null;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [selectedChip]);

  useEffect(() => {
    refreshNextClass();
  }, [refreshNextClass]);

  useEffect(() => {
    if (!isScreenFocused) {
      return;
    }

    startPersistentAttendanceTracking().catch((error) => {
      console.error('Failed to start attendance tracking:', error);
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
      } catch (error) {
        console.error('Failed to create reminder notification channel:', error);
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
      } catch (error) {
        console.error('Failed to load attendance snapshot:', error);
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
    } catch (error) {
      console.error('Failed to switch to campaigning dashboard:', error);
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
    } catch (error) {
      console.error('Logout failed:', error);
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    }
  };

  const dashboardTiles = dashboardTilesMap[selectedChip] || dashboardTilesMap['Daily Routines'];
  const selectedChipTiles = dashboardTilesMap[selectedChip] || [];
  const dashboardTileColumns = dashboardTiles.reduce<DashboardTile[][]>((columns, tile, index) => {
    if (index % 2 === 0) {
      columns.push([tile]);
    } else {
      columns[columns.length - 1].push(tile);
    }

    return columns;
  }, []);
  const statusCards: StatCard[] = [
    {
      title: nextClass?.class_id || '--',
      subtitle: nextClass?.subject || 'No Class',
      footer: nextClass ? `${nextClass.fromTime} - ${nextClass.toTime}` : 'No timetable available',
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

  useEffect(() => {
    currentModuleRef.current = selectedModule;
  }, [selectedModule]);

  const recomputeSnapOffsets = () => {
    const nextSnapOffsets = [
      0,
      ...dashboardTilesMap[selectedChip]
        .map((tile) => moduleOffsetsRef.current[tile.label])
        .filter((value): value is number => typeof value === 'number')
        .map((value) => Math.max(0, Math.round(value))),
    ]
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b);

    setSnapOffsets(nextSnapOffsets);
  };

  const getModuleForScrollOffset = (scrollY: number) => {
    const visibleLabels = dashboardTilesMap[selectedChip]?.map((tile) => tile.label) || [];
    if (visibleLabels.length === 0) return selectedModule;

    let activeModule = visibleLabels[0];
    for (const label of visibleLabels) {
      const offset = moduleOffsetsRef.current[label];
      if (typeof offset !== 'number') continue;
      if (scrollY + 24 >= offset) {
        activeModule = label;
      } else {
        break;
      }
    }

    return activeModule;
  };

  const activateModule = (label: string, pushHistory = true) => {
    currentModuleRef.current = label;
    setSelectedModule(label);
    pendingScrollModuleRef.current = label;

    if (pushHistory) {
      const history = moduleHistoryRef.current;
      if (history[history.length - 1] !== label) {
        history.push(label);
      }
    }
  };

  const handleTilePress = (tile: DashboardTile) => {
    activateModule(tile.label, true);

    requestAnimationFrame(() => {
      const offset = moduleOffsetsRef.current[tile.label];
      if (typeof offset === 'number' && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, offset - 12), animated: true });
      }
    });
  };

  const openChip = (chip: string, moduleLabel?: string) => {
    setSelectedChip(chip);
    if (moduleLabel) {
      moduleHistoryRef.current = [moduleLabel];
      currentModuleRef.current = moduleLabel;
      setSelectedModule(moduleLabel);
      pendingScrollModuleRef.current = moduleLabel;
    }
  };

  const handleGoBack = () => {
    const history = moduleHistoryRef.current;
    if (history.length <= 1) {
      return;
    }

    history.pop();
    const previousModule = history[history.length - 1] || 'Attendance';
    currentModuleRef.current = previousModule;
    setSelectedModule(previousModule);
    pendingScrollModuleRef.current = previousModule;

    requestAnimationFrame(() => {
      const offset = moduleOffsetsRef.current[previousModule];
      if (typeof offset === 'number' && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, offset - 12), animated: true });
      }
    });
  };

  const handleOpenHomePanel = () => {
    const homeworkTile = dashboardTiles.find((tile) => tile.label === 'Homework');
    if (homeworkTile) {
      handleTilePress(homeworkTile);
    } else {
      openChip('Daily Routines', 'Homework');
    }
    setShowFooterNav(false);
  };

  const handleAddPress = () => {
    openChip('Daily Routines', 'Attendance');
  };

  const handleOpenChat = () => {
    openChip('Requests', 'Chat');
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
            name: 'ParentDashboard' as never,
            params: { username, name },
          },
        ],
      });
    } catch (error) {
      console.error('Failed to switch to parent account:', error);
      Alert.alert('Error', 'Failed to switch to parent account.');
    }
  };

  if (!profileReady) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#0E0E0F" />
       
      </View>
    );
  }

  const inlineParams = {
    username: teacherProfile.username || route.params?.username || '',
    name: teacherProfile.name || route.params?.name || '',
    schoolCode: teacherProfile.schoolCode || '',
  };

  const renderModuleUi = (label: string) => {
    switch (label) {
      case 'Attendance':
        return React.createElement(TeacherAttendance as any, { route: { params: inlineParams } });
      case 'Behaviour':
        return React.createElement(TeacherBehaviour as any, { route: { params: inlineParams } });
      case 'Time table':
        return React.createElement(TeacherTimetable as any, { inlineParams });
      case 'Photo':
        return React.createElement(TeacherEventMediaUpload as any, { route: { params: inlineParams } });
      // case 'Tickets':
      //   return React.createElement(TeacherTickets as any, { route: { params: inlineParams } });
      case 'Salary':
        return React.createElement(TeacherSalary as any, { route: { params: inlineParams } });
      case 'Calendar':
        return React.createElement(TeacherCalender as any, { inlineParams });
      // case 'Student Report':
      //   return React.createElement(TeacherDetails as any, { route: { params: inlineParams } });
      case 'Topic of day':
        return React.createElement(TopicOfDay as any, { route: { params: inlineParams } });
      case 'Homework':
        return React.createElement(TeacherHomework as any, {
          route: { params: inlineParams },
        });
      // case 'Question Paper':
      //   return React.createElement(TeacherQuestionPaperGeneration as any, {
      //     route: { params: inlineParams },
      //   });
      case 'Scan':
        return React.createElement(HandwritingScanPull as any, {});
      case 'Leave':
        return React.createElement(TeacherLeaveRequest as any, { route: { params: inlineParams } });
      case 'Chat':
        return React.createElement(TeacherChatAndEvents as any, { route: { params: inlineParams } });
      // case 'Test':
      //   return React.createElement(TeacherCounselling as any, { route: { params: inlineParams } });
      default:
        return null;
    }
  };

  const renderModuleSection = (label: string) => (
    <View
      key={label}
      onLayout={(event) => {
        moduleOffsetsRef.current[label] = event.nativeEvent.layout.y;
        recomputeSnapOffsets();
        if (pendingScrollModuleRef.current === label) {
          requestAnimationFrame(() => {
            const offset = moduleOffsetsRef.current[label];
            if (typeof offset === 'number' && scrollRef.current) {
              scrollRef.current.scrollTo({ y: Math.max(0, offset - 12), animated: true });
            }
          });
        }
      }}
      style={styles.modulePanel}
    >
      <View style={styles.moduleHeaderRow}>
        <Text style={styles.moduleTitle}>{label}</Text>
      </View>
      {renderModuleUi(label)}
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0E0E0F" />

      <View style={styles.background}>
        <View style={styles.phoneShell}>
          <View style={styles.phoneFrame}>
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
                  Welcome {teacherProfile.name || teacherProfile.username || 'Teacher'}
                </Text>
              </View>
              <View style={styles.toolbarSpacer} />
             
            </View>

            <View style={styles.chipRowSection}>
              <ScrollView
                horizontal
                nestedScrollEnabled
                directionalLockEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectedChipMapRow}
              >
                {selectedChipTiles.map((tile, index) => {
                  const active = selectedModule === tile.label;

                  return (
                    <Pressable
                      key={tile.label}
                      onPress={() => handleTilePress(tile)}
                      style={[
                        styles.selectedChipMapItem,
                        index !== selectedChipTiles.length - 1 && styles.selectedChipMapItemSpacing,
                        active ? styles.selectedChipMapItemActive : styles.selectedChipMapItemInactive,
                      ]}
                    >
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
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              snapToOffsets={snapOffsets}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              onScroll={(event) => {
                if (event.nativeEvent.contentOffset.y > 8) {
                  setShowFooterNav(true);
                }

                if (!pendingScrollModuleRef.current) {
                  const nextModule = getModuleForScrollOffset(event.nativeEvent.contentOffset.y);
                  if (nextModule && nextModule !== currentModuleRef.current) {
                    currentModuleRef.current = nextModule;
                    setSelectedModule(nextModule);

                    const history = moduleHistoryRef.current;
                    if (history[history.length - 1] !== nextModule) {
                      history.push(nextModule);
                    }
                  }
                }
              }}
              scrollEventThrottle={16}
            >
              <View style={styles.heroCard}>
                <View style={styles.heroGlow} />
                <Image source={heroImage} style={styles.heroImage} resizeMode="contain" />
              </View>

              <View style={styles.dashboardStickyHeader}>
                <Text style={styles.sectionTitle}>Teacher Dashboard</Text>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dashboardGridScroller}
                >
                  {dashboardTileColumns.map((column, columnIndex) => (
                    <View
                      key={`dashboard-column-${columnIndex}`}
                      style={[
                        styles.dashboardGridColumn,
                        columnIndex !== dashboardTileColumns.length - 1 &&
                          styles.dashboardGridColumnSpacing,
                      ]}
                    >
                      {column.map((tile) => (
                        <Pressable
                          key={tile.label}
                          style={[
                            styles.dashboardGridCardThree,
                            selectedModule === tile.label && styles.dashboardGridCardActive,
                          ]}
                          onPress={() => handleTilePress(tile)}
                        >
                          <View style={styles.dashboardTileIconWrap}>
                            {renderIcon(tile.kind, tile.icon, '#7F7F84', 26)}
                          </View>
                          <Text style={styles.dashboardTileLabel}>{tile.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>


              <View style={styles.statusCardsRow}>
                <View
                  style={[
                    styles.statusCard,
                    styles.statusCardLeft,
                    { backgroundColor: statusCards[0].background },
                  ]}
                >
                  <View style={styles.statusCardText}>
                    <View style={styles.statusTitleRow}>
                      <Text style={styles.statusNumber} numberOfLines={1} ellipsizeMode="tail">
                        {statusCards[0].title}
                      </Text>
                      <Text style={styles.statusSubtitle} numberOfLines={1} ellipsizeMode="tail">
                        {statusCards[0].subtitle}
                      </Text>
                    </View>
                    <Text style={styles.statusFooter} numberOfLines={2} ellipsizeMode="tail">
                      {statusCards[0].footer}
                    </Text>
                    <Pressable
                      onPress={() => setShowNextClassReport(true)}
                      style={styles.statusActionButton}
                    >
                      <Text style={styles.statusActionLink}>View Report</Text>
                    </Pressable>
                  </View>

                  <View style={styles.statusIconWrap}>
                    {renderIcon(statusCards[0].kind, statusCards[0].icon, '#4C4C4C', 30)}
                  </View>
                </View>

                <View
                  style={[
                    styles.statusCard,
                    styles.statusCardRight,
                    { backgroundColor: statusCards[1].background },
                  ]}
                >
                  <View style={styles.statusCardText}>
                    <View style={styles.statusTitleRow}>
                      <Text style={styles.statusNumber} numberOfLines={1} ellipsizeMode="tail">
                        {statusCards[1].title}
                      </Text>
                      <Text style={styles.statusSubtitle} numberOfLines={1} ellipsizeMode="tail">
                        {statusCards[1].subtitle}
                      </Text>
                    </View>
                    <Text style={styles.statusFooter} numberOfLines={2} ellipsizeMode="tail">
                      {statusCards[1].footer}
                    </Text>
                  </View>

                  <View style={styles.statusIconWrap}>
                    {renderIcon(statusCards[1].kind, statusCards[1].icon, '#4C4C4C', 30)}
                  </View>
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

              <Text style={styles.sectionTitle}>
                {selectedChip} Content
              </Text>

              {dashboardTiles.map((tile) => renderModuleSection(tile.label))}
            </ScrollView>

            {showTeacherDetails && (
              <View style={styles.overlay}>
                <View style={styles.teacherPopupCard}>
                  <View style={styles.teacherHeaderRow}>
                    <View style={styles.teacherAvatar}>
                      <Text style={styles.teacherAvatarText}>
                        {(teacherProfile.name || teacherProfile.username || 'T')
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
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
              {showFooterNav && (
                <View style={styles.footerNav}>
                  <Pressable style={styles.footerNavItem} onPress={handleGoBack}>
                    <Image source={require('../assets/Arrow.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
                    <Text style={styles.footerNavLabel}>Back</Text>
                  </Pressable>
                  <Pressable style={styles.footerNavItem} onPress={handleOpenHomePanel}>
                    <MaterialIcons name="home" size={22} color="#1F1F22" />
                    <Text style={styles.footerNavLabel}>Home</Text>
                  </Pressable>
                  <Pressable style={styles.footerAddButton} onPress={handleAddPress}>
                    <MaterialIcons name="add" size={26} color="#FFFFFF" />
                  </Pressable>
                  <Pressable style={styles.footerNavItem} onPress={handleOpenChat}>
                    <MaterialIcons name="chat-bubble-outline" size={22} color="#C2C2C7" />
                    <Text style={styles.footerNavLabelMuted}>Chat</Text>
                  </Pressable>
                  <Pressable style={styles.footerNavItem} onPress={handleOpenProfilePanel}>
                    <MaterialIcons name="person-outline" size={22} color="#C2C2C7" />
                    <Text style={styles.footerNavLabelMuted}>Profile</Text>
                  </Pressable>
                </View>
              )}
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
