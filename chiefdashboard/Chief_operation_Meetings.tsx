import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  BackHandler,
  Modal,
  Image,
  ImageBackground,
  StyleSheet,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { globalStyles as styles } from '../styles';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ChiefFooterProfile from './ChiefFooterProfile';

import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
/* -------------------- TYPES -------------------- */
type MeetingsNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Meetings'
>;
interface StudentItem {
  id: number;
  name: string;
  class_name: string;
  section: string;
  schoolCode: string;
  user_type: 'student' | 'teacher';
  class_teacher: string | null;
}

interface AttendanceMonth {
  month: string;
  present: number;
  total: number;
}

interface AttendanceResponse {
  monthly: AttendanceMonth[];
}

interface PerformanceItem {
  subject: string;
  FA: string[];
  SA: string[];
  total: string;
  percentage: string;
  overallGrade: string;
  testGrades: Record<string, unknown>;
}

interface EventSummary {
  total_events: number;
  upcoming_events: number;
  conducted_events: number;
  events_pending_approval: number;
}

interface ChatSummary {
  total_chats: number;
  chats_pending_approval: number;
  chats_accepted: number;
}

interface ChatItem {
  id: number;
  sender_name: string;
  message: string;
  status: 'approved' | 'pending';
  created_at: string;
}

/* -------------------- CONSTANTS -------------------- */
const STATIC_SECTIONS = ['A', 'B', 'C'];
const SCREEN_HEIGHT = Dimensions.get('window').height;
const backArrowImage = require('../assets/Arrow.png');
const chiefDashboardPalette = ['#F4EFEB', '#D1C7F9', '#C3BDFB'];
const chiefDashboardAccent = ['#E4D8FF', '#B58BFF', '#7C3AED'];
const meetingGradients = {
  hero: chiefDashboardPalette,
  chatPrimary: chiefDashboardAccent,
  chatSecondary: chiefDashboardPalette,
  eventPrimary: chiefDashboardAccent,
  eventSecondary: chiefDashboardPalette,
};

const formatPct = (value: number): `${number}%` =>
  `${Math.max(0, Math.min(100, Math.round(value)))}%` as `${number}%`;

const progressValue = (value: number, total: number) =>
  total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;

const pickFirstNonEmpty = (...values: any[]) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const parseSelectedMonthYear = (value: string) => {
  const [yearText, monthText] = String(value || '').split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  return { year, monthIndex };
};

const extractItemDate = (item: Record<string, any>) => {
  const rawDate = pickFirstNonEmpty(
    item?.record_date,
    item?.payment_date,
    item?.created_at,
    item?.updated_at,
    item?.date,
    item?.event_date,
    item?.start_date,
    item?.scheduled_at,
    item?.scheduledAt,
  );

  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const matchesSelectedMonth = (date: Date, selection: { year: number; monthIndex: number }) =>
  date.getFullYear() === selection.year && date.getMonth() === selection.monthIndex;

const filterItemsBySelectedMonth = (items: any[], selectedMonthYear: string) => {
  const selection = parseSelectedMonthYear(selectedMonthYear);
  if (!selection) return items;

  return items.filter(item => {
    const parsedDate = extractItemDate(item || {});
    if (!parsedDate) return true;
    return matchesSelectedMonth(parsedDate, selection);
  });
};

const buildMonthlyBuckets = (items: any[], selectedMonthYear: string, bucketCount = 5) => {
  const selection = parseSelectedMonthYear(selectedMonthYear);
  const buckets = Array.from({ length: bucketCount }, () => 0);

  let matchedDates = 0;
  items.forEach((item, index) => {
    const parsedDate = extractItemDate(item || {});
    if (selection && parsedDate && matchesSelectedMonth(parsedDate, selection)) {
      const bucketIndex = Math.min(bucketCount - 1, Math.floor((parsedDate.getDate() - 1) / 7));
      buckets[bucketIndex] += 1;
      matchedDates += 1;
      return;
    }

    if (!selection && parsedDate) {
      const bucketIndex = Math.min(bucketCount - 1, Math.floor((parsedDate.getDate() - 1) / 7));
      buckets[bucketIndex] += 1;
      matchedDates += 1;
      return;
    }

    if (!parsedDate) {
      buckets[index % bucketCount] += 1;
    }
  });

  if (matchedDates === 0 && items.length) {
    items.forEach((_, index) => {
      buckets[index % bucketCount] += 1;
    });
  }

  return buckets;
};

const buildRelativeBarHeights = (values: number[], maxHeight = 56, minHeight = 12) => {
  const safeValues = values.length ? values : [0];
  const maxValue = Math.max(...safeValues, 1);
  return safeValues.map(value => Math.max(minHeight, (value / maxValue) * maxHeight));
};

/* -------------------- COMPONENT -------------------- */
const Meetings: React.FC = () => {
  const navigation = useNavigation<MeetingsNavigationProp>();
  const route = useRoute<any>();

  /* ---------- STATE ---------- */
  const [schoolCode, setSchoolCode] = useState<string>('');

  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [teachers, setTeachers] = useState<StudentItem[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportType, setReportType] = useState<
    'meetings' | 'events' | 'chats' | null
  >(null);
  const openReportModal = (type: 'meetings' | 'events' | 'chats') => {
    setReportType(type);

    // Set the data depending on type
    switch (type) {
      case 'meetings':
        setReportData({ total: 6 }); // You can fetch real data if needed
        break;
      case 'events':
        setReportData(eventSummary);
        break;
      case 'chats':
        setReportData(chatSummary);
        break;
    }

    setShowReportModal(true);
  };

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [completedEvents, setCompletedEvents] = useState<any[]>([]);
  const [loadingCompletedEvents, setLoadingCompletedEvents] =
    useState<boolean>(false);

  const [chatSummary, setChatSummary] = useState<ChatSummary>({
    total_chats: 0,
    chats_pending_approval: 0,
    chats_accepted: 0,
  });

  const [eventSummary, setEventSummary] = useState<EventSummary>({
    total_events: 0,
    upcoming_events: 0,
    conducted_events: 0,
    events_pending_approval: 0,
  });

  const [overallPerformance] = useState<number>(0);
  const [classTeacher, setClassTeacher] = useState<string>('');

  const [selectedClassSection, setSelectedClassSection] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  /* ---------- REFS (RN SAFE) ---------- */
  const genericPopupContentRef = useRef<View | null>(null);
  const upcomingEventsContentRef = useRef<View | null>(null);
  const completedEventsContentRef = useRef<View | null>(null);
  /* -------------------- ANDROID BACK BUTTON -------------------- */
  const handleBackToChiefDashboard = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return true;
    }

    navigation.navigate('ChiefDashboard' as never);
    return true;
  }, [navigation]);

  /* -------------------- LOAD SCHOOL CODE -------------------- */
  useEffect(() => {
    const loadSchoolCode = async () => {
      const code = await AsyncStorage.getItem('schoolCode');
      if (code) setSchoolCode(code);
    };
    loadSchoolCode();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackToChiefDashboard,
    );

    return () => subscription.remove();
  }, [handleBackToChiefDashboard]);

  /* -------------------- FETCH CLASSES -------------------- */
  useEffect(() => {
    if (!schoolCode) return;

    axios
      .get<string[]>('https://cleezoclass.com:4000/api/classes', {
        params: { schoolCode },
      })
      .then(res => setClasses(res.data ?? []))
      .catch(() => setClasses([]));
  }, [schoolCode]);

  /* -------------------- FETCH STUDENTS -------------------- */
  useEffect(() => {
    if (!selectedClass || !selectedSection || !schoolCode) return;

    axios
      .get<StudentItem[]>('https://cleezoclass.com:4000/api/students', {
        params: {
          schoolCode,
          class: selectedClass,
          section: selectedSection,
        },
      })
      .then(res => {
        const list =
          res.data
            ?.filter(s => s.user_type === 'student')
            .sort((a, b) => a.name.localeCompare(b.name)) || [];

        setStudents(list);
        setSelectedStudentId('');
        setClassTeacher(list[0]?.class_teacher ?? '');
      })
      .catch(() => setStudents([]));
  }, [selectedClass, selectedSection, schoolCode]);

  /* -------------------- FETCH TEACHERS -------------------- */
  useEffect(() => {
    if (!schoolCode) return;

    axios
      .post<StudentItem[]>('https://cleezoclass.com:4000/api/users', {
        schoolCode,
        user_type: 'teacher',
      })
      .then(res => setTeachers(res.data ?? []))
      .catch(() => setTeachers([]));
  }, [schoolCode]);

  /* -------------------- FETCH EVENTS -------------------- */
  const fetchUpcomingEvents = async () => {
    try {
      const res = await axios.get<any[]>(
        'https://cleezoclass.com:4000/api/api/upcoming-events',
        { params: { schoolCode } },
      );
      setUpcomingEvents(res.data ?? []);
      setEventSummary(prev => ({
        ...prev,
        upcoming_events: res.data?.length ?? 0,
      }));
    } catch {}
  };

  const fetchCompletedEvents = async () => {
    setLoadingCompletedEvents(true);
    try {
      const res = await axios.get<any[]>(
        'https://cleezoclass.com:4000/api/api/completed-events',
        { params: { schoolCode } },
      );
      setCompletedEvents(res.data ?? []);
      setEventSummary(prev => ({
        ...prev,
        conducted_events: res.data?.length ?? 0,
      }));
    } catch {
    } finally {
      setLoadingCompletedEvents(false);
    }
  };

  useEffect(() => {
    if (!schoolCode) return;
    fetchUpcomingEvents();
    fetchCompletedEvents();
  }, [schoolCode]);

  /* -------------------- FETCH CHAT SUMMARY -------------------- */
  useEffect(() => {
    if (!schoolCode) return;

    axios
      .get<ChatSummary>('https://cleezoclass.com:4000/api/api/chat-summary', {
        params: { schoolCode },
      })
      .then(res => setChatSummary(res.data))
      .catch(() => {});
  }, [schoolCode]);

  /* -------------------- CLASS & SECTION HANDLER -------------------- */
  const handleClassSectionChange = (value: string) => {
    setSelectedClassSection(value);

    if (!value) {
      setSelectedClass('');
      setSelectedSection('');
      setStudents([]);
      return;
    }

    const [cls, sec] = value.split('-');
    setSelectedClass(cls.trim());
    setSelectedSection(sec.trim());
  };
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i); // last 5 years

  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const monthYearOptions = YEARS.flatMap(year =>
    MONTHS.map((month, idx) => ({
      label: `${month} ${year}`,
      value: `${year}-${String(idx + 1).padStart(2, '0')}`, // YYYY-MM format
    })),
  );
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('');

  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString(),
  );

  const filteredUpcomingEvents = useMemo(
    () => filterItemsBySelectedMonth(upcomingEvents, selectedMonthYear),
    [upcomingEvents, selectedMonthYear],
  );

  const filteredCompletedEvents = useMemo(
    () => filterItemsBySelectedMonth(completedEvents, selectedMonthYear),
    [completedEvents, selectedMonthYear],
  );

  const chatReplyRate = progressValue(
    chatSummary.chats_accepted,
    chatSummary.total_chats,
  );

  const visibleEventTotal =
    filteredUpcomingEvents.length + filteredCompletedEvents.length;

  const eventCompletionRate = progressValue(
    filteredCompletedEvents.length,
    visibleEventTotal,
  );

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonthYear) return 'All months';
    const option = monthYearOptions.find(item => item.value === selectedMonthYear);
    return option?.label || 'Selected month';
  }, [monthYearOptions, selectedMonthYear]);

  const chatStatusBars = useMemo(
    () =>
      buildRelativeBarHeights(
        [
          chatSummary.chats_pending_approval,
          chatSummary.chats_accepted,
          chatSummary.total_chats,
        ],
        58,
      ),
    [
      chatSummary.chats_pending_approval,
      chatSummary.chats_accepted,
      chatSummary.total_chats,
    ],
  );

  const upcomingEventBars = useMemo(
    () => buildRelativeBarHeights(buildMonthlyBuckets(filteredUpcomingEvents, selectedMonthYear), 58),
    [filteredUpcomingEvents, selectedMonthYear],
  );

  const completedEventBars = useMemo(
    () => buildRelativeBarHeights(buildMonthlyBuckets(filteredCompletedEvents, selectedMonthYear), 58),
    [filteredCompletedEvents, selectedMonthYear],
  );
  /* -------------------- UI -------------------- */
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.headerText}>Overview</Text>
          </View>
         
          <LinearGradient
            colors={meetingGradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={meetingStyles.heroCard}
          >
            <View style={meetingStyles.heroCardOverlay} />
            <View style={meetingStyles.heroHeaderRow}>
              <View style={meetingStyles.heroTextBlock}>
                <Text style={meetingStyles.heroTitle}>Meetings & Live Chats</Text>
                <Text style={meetingStyles.heroSubtitle}>
                  Clean live snapshot of chats, events, and meeting activity.
                </Text>
              </View>
            </View>
            <View style={meetingStyles.heroStatsRow}>
              <View style={meetingStyles.heroStatPill}>
                <Text style={meetingStyles.heroStatLabel}>Chats</Text>
                <Text style={meetingStyles.heroStatValue}>{chatSummary.total_chats}</Text>
              </View>
              <View style={meetingStyles.heroStatPill}>
                <Text style={meetingStyles.heroStatLabel}>Events</Text>
                <Text style={meetingStyles.heroStatValue}>{filteredUpcomingEvents.length}</Text>
              </View>
              <View style={meetingStyles.heroStatPill}>
                <Text style={meetingStyles.heroStatLabel}>Meetings</Text>
                <Text style={meetingStyles.heroStatValue}>{filteredCompletedEvents.length}</Text>
              </View>
            </View>
          
           
          </LinearGradient>
 <View style={meetingStyles.summaryBand}>
            <View style={meetingStyles.summaryBandLeft}>
              <Text style={meetingStyles.summaryTitle}>Quick Actions</Text>
              <Text style={meetingStyles.summaryText}>
                Jump into reports for chats and events without the heavy card stack.
              </Text>
            </View>
            <View style={meetingStyles.summaryBandRight}>
              <TouchableOpacity onPress={() => openReportModal('chats')} style={meetingStyles.summaryButtonDark}>
                <Text style={meetingStyles.summaryButtonTextDark}>Chat Report</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openReportModal('events')} style={meetingStyles.summaryButtonLight}>
                <Text style={meetingStyles.summaryButtonTextLight}>Event Report</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={meetingStyles.metricGrid}>
            <LinearGradient
              colors={meetingGradients.chatPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={meetingStyles.metricCard}
            >
              <Text style={meetingStyles.metricLabelLight}>Chat Requests</Text>
              <Text style={meetingStyles.metricValueLight}>{chatSummary.total_chats}</Text>
              <View style={meetingStyles.metricLine}>
                <View style={[meetingStyles.metricFill, { width: formatPct(chatReplyRate) }]} />
              </View>
              <Text style={meetingStyles.metricCaptionLight}>Need action</Text>
            </LinearGradient>

            <LinearGradient
              colors={meetingGradients.chatSecondary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={meetingStyles.metricCard}
            >
              <Text style={meetingStyles.metricLabelDark}>Chat Informal</Text>
              <Text style={meetingStyles.metricValueDark}>{chatSummary.chats_accepted}</Text>
              <View style={meetingStyles.sparkMiniRow}>
                {chatStatusBars.map((value, index) => (
                  <View
                    key={`chat-mini-${index}`}
                    style={[
                      meetingStyles.sparkMiniBar,
                      { height: value, backgroundColor: index % 2 === 0 ? '#7C3AED' : '#B58BFF' },
                    ]}
                  />
                ))}
              </View>
              <Text style={meetingStyles.metricCaptionDark}>
                {chatSummary.total_chats ? chatReplyRate.toFixed(0) : '0'}% replied
              </Text>
            </LinearGradient>

            <LinearGradient
              colors={meetingGradients.eventPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={meetingStyles.metricCard}
            >
              <Text style={meetingStyles.metricLabelLight}>Conducted Events</Text>
              <Text style={meetingStyles.metricValueLight}>{filteredCompletedEvents.length}</Text>
              <View style={meetingStyles.metricLine}>
                <View style={[meetingStyles.metricFillGreen, { width: formatPct(eventCompletionRate) }]} />
              </View>
              <Text style={meetingStyles.metricCaptionLight}>{selectedMonthLabel}</Text>
            </LinearGradient>

            <LinearGradient
              colors={meetingGradients.eventSecondary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={meetingStyles.metricCard}
            >
              <Text style={meetingStyles.metricLabelDark}>Upcoming Events</Text>
              <Text style={meetingStyles.metricValueDark}>{filteredUpcomingEvents.length}</Text>
              <View style={meetingStyles.sparkMiniRow}>
                {upcomingEventBars.map((value, index) => (
                  <View
                    key={`event-mini-${index}`}
                    style={[
                      meetingStyles.sparkMiniBar,
                      { height: value, backgroundColor: index % 2 === 0 ? '#7C3AED' : '#C3BDFB' },
                    ]}
                  />
                ))}
              </View>
              <Text style={meetingStyles.metricCaptionDark}>{selectedMonthLabel}</Text>
            </LinearGradient>
          </View>

       

        

          <Modal
            visible={showReportModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowReportModal(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
              }}
            >
              <View
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  borderRadius: 20,
                  width: '100%',
                  maxHeight: '80%',
                  borderWidth: 2,
                  borderColor: '#000',
                }}
              >
                <Text
                  style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}
                >
                  {reportType === 'meetings'
                    ? 'Meetings Conducted'
                    : reportType === 'events'
                    ? 'Event Summary'
                    : 'Chat Summary'}
                </Text>

                {reportData && reportType === 'events' && (
                  <>
                    <Text>Total Events: {reportData.total_events}</Text>
                    <Text>Upcoming Events: {reportData.upcoming_events}</Text>
                    <Text>Conducted Events: {reportData.conducted_events}</Text>
                    <Text>
                      Pending Approval: {reportData.events_pending_approval}
                    </Text>
                  </>
                )}

                {reportData && reportType === 'chats' && (
                  <>
                    <Text>Total Chats: {reportData.total_chats}</Text>
                    <Text>
                      Pending Approval: {reportData.chats_pending_approval}
                    </Text>
                    <Text>Accepted: {reportData.chats_accepted}</Text>
                  </>
                )}

                {reportData && reportType === 'meetings' && (
                  <Text>Total Meetings Conducted: {reportData.total}</Text>
                )}

                <TouchableOpacity
                  onPress={() => setShowReportModal(false)}
                  style={{ marginTop: 20, alignSelf: 'flex-end' }}
                >
                  <Text style={{ color: '#0088cc', fontWeight: 'bold' }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
      <View style={footerStyles.fixedFooter}>
        <LinearGradient
          colors={['#FFFFFF', '#FBFBFD', '#F4F1FF']}
          start={{ x: 0.08, y: 0.05 }}
          end={{ x: 0.95, y: 1 }}
          style={footerStyles.footerShell}
        >
          <View style={footerStyles.footerRow}>
            <TouchableOpacity
              style={footerStyles.footerItem}
              onPress={handleBackToChiefDashboard}
            >
              <Image source={backArrowImage} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text style={footerStyles.footerLabel}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={footerStyles.footerItem}
              onPress={() => navigation.navigate('ChiefDashboard' as never)}
            >
              <Ionicons name="home" size={18} color="#111" />
              <Text style={footerStyles.footerLabel}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={footerStyles.footerAddButton}
              onPress={() => navigation.navigate('ChiefDashboard' as never)}
            >
              <Text style={footerStyles.footerAddText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={footerStyles.footerItem}
              onPress={() => navigation.navigate('ChiefDashboard' as never)}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#B0B0B5" />
              <Text style={footerStyles.footerLabelMuted}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={footerStyles.footerItem}
              onPress={() => navigation.navigate('ChiefDashboard' as never)}
            >
              <ChiefFooterProfile />
              <Text style={footerStyles.footerLabelMuted}>Profile</Text>
            </TouchableOpacity>
          </View>
          <View style={footerStyles.footerBrandRow}>
            <Text style={footerStyles.poweredBy}>Powered By</Text>
            <ImageBackground
              source={require('../assets/Cleezo.png')}
              style={footerStyles.logo}
              resizeMode="contain"
            />
          </View>
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
};

export default Meetings;

const meetingStyles = StyleSheet.create({
  heroCard: {
    borderRadius: 28,
    marginTop: 12,
    marginBottom: 14,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  heroTitle: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    color: '#4B4B55',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: '600',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroStatPill: {
    flexGrow: 1,
    minWidth: 92,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroStatLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroStatValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  monthPickerWrap: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingRight: 6,
    height: 50,
  },
  monthPicker: {
    flex: 1,
    color: '#111827',
    height: 50,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  metricCard: {
    width: '48.5%',
    minHeight: 160,
    borderRadius: 22,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: 'hidden',
  },
  metricLabelLight: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metricLabelDark: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metricValueLight: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: -0.6,
  },
  metricValueDark: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: -0.6,
  },
  metricLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.12)',
    overflow: 'hidden',
    marginTop: 12,
  },
  metricFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#7C3AED',
  },
  metricFillGreen: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#B58BFF',
  },
  sparkMiniRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginTop: 10,
    height: 56,
  },
  sparkMiniBar: {
    width: 9,
    borderRadius: 999,
  },
  metricCaptionLight: {
    color: '#4B4B55',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  metricCaptionDark: {
    color: '#4B4B55',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  summaryBand: {
    marginTop: 6,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EAF0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryBandLeft: {
    flex: 1,
  },
  summaryBandRight: {
    gap: 8,
    alignItems: 'flex-end',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
  },
  summaryText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  summaryButtonDark: {
    backgroundColor: '#4C1D95',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  summaryButtonLight: {
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  summaryButtonTextDark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  summaryButtonTextLight: {
    color: '#4C1D95',
    fontSize: 11,
    fontWeight: '800',
  },
  monthChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.26)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});

const footerStyles = StyleSheet.create({
  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  footerShell: {
    borderRadius: 40,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: 'visible',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  footerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  footerLabel: {
    marginTop: 0,
    fontSize: 7,
    color: '#111111',
    fontWeight: '700',
  },
  footerLabelMuted: {
    marginTop: 0,
    fontSize: 7,
    color: '#B0B0B5',
    fontWeight: '700',
  },
  footerAddButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F14A40',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: '#FFF',
    marginTop: -34,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  footerAddText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginTop: -2,
  },
  poweredBy: {
    fontSize: 7.5,
    color: '#8A8A8A',
    fontWeight: '500',
    marginRight: 4,
  },
  logo: {
    width: 42,
    height: 26,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
});
