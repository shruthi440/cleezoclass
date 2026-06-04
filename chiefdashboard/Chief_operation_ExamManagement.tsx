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
  StyleSheet,
  Modal,
  FlatList,
  Image,
  ImageBackground,
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
type ExamManagementNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ExamManagement'
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

interface EventSummary {
  total_events: number;
  upcoming_events: number;
  conducted_events: number;
  events_pending_approval: number;
}
interface QPStatus {
  total_qp: number;
  pending_approval: number;
  classes_pending: any[];
}

interface InvigilatorStatus {
  total_invigilators: number;
  pending_classes: string[];
  assignments: any[];
}

interface SeatingStatus {
  total_assignments: number;
  rooms_assigned: any[];
}

interface ScanPullStatus {
  total_scanned: number;
  pending_scan: number;
  report_card_pending: number;
  pending_class_list: any[]; // <-- fix here
}
interface PendingClass {
  class_name: string;
  section?: string;
}
interface ExamData {
  qpStatus: QPStatus;
  invigilatorStatus: InvigilatorStatus;
  seatingStatus: SeatingStatus;
  scanPull: ScanPullStatus;
}
const STATIC_SECTIONS = ['A', 'B', 'C'];
const BASE_URL = 'https://cleezoclass.com:4000/api'; // Centralized URL
const backArrowImage = require('../assets/Arrow.png');
const chiefDashboardPalette = ['#F4EFEB', '#D1C7F9', '#C3BDFB'];
const chiefDashboardAccent = ['#E4D8FF', '#B58BFF', '#7C3AED'];

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

const buildRelativeBars = (values: number[], maxHeight = 58, minHeight = 12) => {
  const safeValues = values.length ? values : [0];
  const maxValue = Math.max(...safeValues, 1);
  return safeValues.map(value => Math.max(minHeight, (value / maxValue) * maxHeight));
};

const ExamManagement: React.FC = () => {
  const navigation = useNavigation<ExamManagementNavigationProp>();

  /* ---------- STATE ---------- */
  const [schoolCode, setSchoolCode] = useState<string>('');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('');
  const [selectedClassSection, setSelectedClassSection] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  const [classes, setClasses] = useState<string[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [completedEvents, setCompletedEvents] = useState<any[]>([]);
  const [classTeacher, setClassTeacher] = useState<string>('');

  const [examData, setExamData] = useState<ExamData>({
    qpStatus: { total_qp: 0, pending_approval: 0, classes_pending: [] },
    invigilatorStatus: {
      total_invigilators: 0,
      pending_classes: [],
      assignments: [],
    },
    seatingStatus: { total_assignments: 0, rooms_assigned: [] },
    scanPull: {
      total_scanned: 0,
      pending_scan: 0,
      report_card_pending: 0,
      pending_class_list: [],
    },
  });

  const [eventSummary, setEventSummary] = useState<EventSummary>({
    total_events: 0,
    upcoming_events: 0,
    conducted_events: 0,
    events_pending_approval: 0,
  });

  const handleBackToChiefDashboard = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return true;
    }

    navigation.navigate('ChiefDashboard' as never);
    return true;
  }, [navigation]);

  /* -------------------- HELPERS -------------------- */
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);
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
      value: `${year}-${String(idx + 1).padStart(2, '0')}`,
    })),
  );

  /* -------------------- DATA FETCHING -------------------- */

  // 1. Load School Code first
  useEffect(() => {
    const loadInitialData = async () => {
      const code = await AsyncStorage.getItem('schoolCode');
      if (code) setSchoolCode(code);
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackToChiefDashboard,
    );

    return () => subscription.remove();
  }, [handleBackToChiefDashboard]);
  const [loadingExamData, setLoadingExamData] = useState(false);
  const [selectedExamType, setSelectedExamType] = useState('FA1');

  const filteredUpcomingEvents = useMemo(
    () => filterItemsBySelectedMonth(upcomingEvents, selectedMonthYear),
    [upcomingEvents, selectedMonthYear],
  );

  const filteredCompletedEvents = useMemo(
    () => filterItemsBySelectedMonth(completedEvents, selectedMonthYear),
    [completedEvents, selectedMonthYear],
  );

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonthYear) return 'All months';
    const option = monthYearOptions.find(item => item.value === selectedMonthYear);
    return option?.label || 'Selected month';
  }, [monthYearOptions, selectedMonthYear]);

  const qpBars = useMemo(
    () =>
      buildRelativeBars([
        examData.qpStatus.pending_approval,
        examData.qpStatus.total_qp,
        examData.qpStatus.total_qp - examData.qpStatus.pending_approval,
      ]),
    [examData.qpStatus.pending_approval, examData.qpStatus.total_qp],
  );

  const eventBars = useMemo(
    () =>
      buildRelativeBars([
        filteredUpcomingEvents.length,
        filteredCompletedEvents.length,
        eventSummary.total_events,
        eventSummary.events_pending_approval,
        eventSummary.conducted_events,
      ]),
    [
      filteredUpcomingEvents.length,
      filteredCompletedEvents.length,
      eventSummary.total_events,
      eventSummary.events_pending_approval,
      eventSummary.conducted_events,
    ],
  );

  const qpReadyRate = progressValue(
    examData.qpStatus.total_qp - examData.qpStatus.pending_approval,
    examData.qpStatus.total_qp,
  );

  const eventMixRate = progressValue(
    filteredCompletedEvents.length,
    filteredUpcomingEvents.length + filteredCompletedEvents.length,
  );
  // 2. Fetch Exam Data (Depends on schoolCode and MonthYear)
  // --- FETCH EXAM DATA ---
  useEffect(() => {
    const fetchExamData = async () => {
      if (!schoolCode) {
        console.log('⚠️ Fetch skipped: schoolCode is empty');
        return;
      }

      console.log(
        `🚀 FETCH EXAM DATA START | schoolCode: ${schoolCode} | examType: ${selectedExamType}`,
      );
      setLoadingExamData(true);

      try {
        const [qpRes, invigilatorRes, seatingRes, scanRes] = await Promise.all([
          axios.get(`https://cleezoclass.com:4000/api/qp-pending`, {
            params: { schoolCode, examType: selectedExamType },
          }),
          axios.get(`https://cleezoclass.com:4000/api/invigilator-status`, {
            params: { schoolCode, examType: selectedExamType },
          }),
          axios.get(`https://cleezoclass.com:4000/api/seating-status`, {
            params: { schoolCode, examType: selectedExamType },
          }),
          axios.get(`https://cleezoclass.com:4000/api/pending-classes`, {
            params: { schoolCode },
          }),
        ]);

        console.log('--- API RESPONSE LOGS ---');
        console.log('📊 QP Status:', qpRes.data);
        console.log('👨‍🏫 Invigilator Status:', invigilatorRes.data);
        console.log('🪑 Seating Status:', seatingRes.data);
        console.log('📋 Scan/Pull List:', scanRes.data);

        const pendingClasses = Array.isArray(scanRes.data) ? scanRes.data : [];
        const invigilatorData = invigilatorRes.data || {};
        const assignments = Array.isArray(invigilatorData.assignments)
          ? invigilatorData.assignments
          : [];

        setExamData({
          qpStatus: qpRes.data || {
            total_qp: 0,
            pending_approval: 0,
            classes_pending: [],
          },
          invigilatorStatus: {
            total_invigilators: assignments.length,
            pending_classes: Array.isArray(invigilatorData.pending_classes)
              ? invigilatorData.pending_classes
              : [],
            assignments: assignments,
          },
          seatingStatus: seatingRes.data || {
            total_assignments: 0,
            rooms_assigned: [],
          },
          scanPull: {
            total_scanned: 300,
            pending_scan: pendingClasses.length,
            report_card_pending: pendingClasses.length * 16,
            pending_class_list: pendingClasses,
          },
        });

        console.log('✅ EXAM DATA STATE UPDATED', { examData });
      } catch (err: any) {
        console.error('❌ FETCH EXAM DATA ERROR:', err.message);
        if (err.response) console.error('Error Details:', err.response.data);
      } finally {
        setLoadingExamData(false);
        console.log('⏹ FETCH EXAM DATA END');
      }
    };

    fetchExamData();
  }, [schoolCode, selectedExamType]);

  // --- FETCH CLASSES & EVENTS ---
  useEffect(() => {
    if (!schoolCode) {
      console.log('⚠️ Fetch skipped: schoolCode is empty (classes/events)');
      return;
    }

    const fetchData = async () => {
      console.log(
        `🚀 FETCH CLASSES & EVENTS START | schoolCode: ${schoolCode}`,
      );
      try {
        const [clsRes, upcomingRes, completedRes] = await Promise.all([
          axios.get(`${BASE_URL}/classes`, { params: { schoolCode } }),
          axios.get(`${BASE_URL}/upcoming-events`, { params: { schoolCode } }),
          axios.get(`${BASE_URL}/completed-events`, { params: { schoolCode } }),
        ]);

        console.log('--- API RESPONSE LOGS ---');
        console.log('🏫 Classes:', clsRes.data);
        console.log('📅 Upcoming Events:', upcomingRes.data);
        console.log('✅ Completed Events:', completedRes.data);

        setClasses(clsRes.data ?? []);
        setUpcomingEvents(upcomingRes.data ?? []);
        setCompletedEvents(completedRes.data ?? []);
        setEventSummary(prev => ({
          ...prev,
          upcoming_events: upcomingRes.data?.length ?? 0,
          conducted_events: completedRes.data?.length ?? 0,
        }));

        console.log('✅ CLASSES & EVENTS STATE UPDATED', {
          classes: clsRes.data,
          upcomingEvents: upcomingRes.data,
          completedEvents: completedRes.data,
        });
      } catch (err) {
        console.error('❌ FETCH CLASSES & EVENTS ERROR:', err);
      } finally {
        console.log('⏹ FETCH CLASSES & EVENTS END');
      }
    };

    fetchData();
  }, [schoolCode]);
  const [popup, setPopup] = useState({
    isOpen: false,
    title: '',
    content: null as React.ReactNode,
    downloadData: [] as any[],
  });

  // 4. Handle Class/Section Change
  const handleClassSectionChange = (value: string) => {
    setSelectedClassSection(value);
    if (!value) return;
    const [cls, sec] = value.split(' - ');
    setSelectedClass(cls.trim());
    setSelectedSection(sec.trim());
  };
  const handleOpenPopup = (type: string, data: any) => {
    let title = '';
    let content: React.ReactNode = null;
    let downloadData: any[] = [];

    if (type === 'qp_status') {
      title = 'QP Status';

      const pendingClasses = Array.isArray(data.pending_class_list)
        ? data.pending_class_list.filter(Boolean) // remove null/undefined
        : [];

      content = (
        <View>
          <Text style={modalStyles.infoText}>
            Total Classes: {data.total_classes}
          </Text>
          <Text style={modalStyles.infoText}>
            Classes with QP: {data.classes_with_qp}
          </Text>
          <Text style={modalStyles.infoText}>
            Pending Classes: {data.pending_classes}
          </Text>
        </View>
      );
      downloadData = pendingClasses;
    } else if (type === 'invigilator_assignments') {
      title = `Assignments (${data.length})`;
      content = (
        <View style={{ maxHeight: 400 }}>
          <View style={modalStyles.tableHeader}>
            <Text style={[modalStyles.headerCell, { flex: 1 }]}>Cls</Text>
            <Text style={[modalStyles.headerCell, { flex: 3 }]}>Teacher</Text>
            <Text style={[modalStyles.headerCell, { flex: 2 }]}>Date</Text>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={modalStyles.tableRow}>
                <Text style={{ flex: 1 }}>{item.class_name || 'N/A'}</Text>
                <Text style={{ flex: 3 }}>{item.teacher_name || 'N/A'}</Text>
                <Text style={{ flex: 2, fontSize: 10 }}>
                  {item.assigned_date
                    ? new Date(item.assigned_date).toLocaleDateString()
                    : 'N/A'}
                </Text>
              </View>
            )}
          />
        </View>
      );
      downloadData = data;
    } else if (type === 'scan_pull_pending') {
      title = `Pending Scan (${data.pending_scan})`;

      const pendingClasses = Array.isArray(data.pending_class_list)
        ? data.pending_class_list.filter(Boolean)
        : [];

      content = (
        <View>
          <Text style={modalStyles.subHeading}>Pending Classes:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {pendingClasses.length > 0 ? (
              pendingClasses.map((item: any, i: number) => (
                <Text key={i} style={[modalStyles.listItem, { width: '50%' }]}>
                  • {item.class_name || 'N/A'} {item.section || ''}
                </Text>
              ))
            ) : (
              <Text style={modalStyles.listItem}>No classes pending.</Text>
            )}
          </View>
        </View>
      );
      downloadData = pendingClasses;
    } else if (type === 'seating_status') {
      title = `Seating Status (${data.total_assignments})`;

      const rooms = Array.isArray(data.rooms_assigned)
        ? data.rooms_assigned
        : [];

      content = (
        <View>
          <Text style={modalStyles.subHeading}>Assigned Rooms:</Text>
          {rooms.length > 0 ? (
            rooms.map((room: string, i: number) => (
              <Text key={i} style={modalStyles.listItem}>
                • {room}
              </Text>
            ))
          ) : (
            <Text style={modalStyles.listItem}>No rooms assigned yet.</Text>
          )}
        </View>
      );
      downloadData = rooms;
    }
    setPopup({ isOpen: true, title, content, downloadData });
  };

  const handleClosePopup = () =>
    setPopup({ isOpen: false, title: '', content: null, downloadData: [] });
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionHeading}>Exam Management</Text>
          </View>

          <LinearGradient
            colors={chiefDashboardPalette}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={examStyles.heroCard}
          >
            <View style={examStyles.heroOverlay} />
            <Text style={examStyles.heroTitle}>Exam Control Center</Text>
            <Text style={examStyles.heroSubtitle}>
              Clear snapshot of QP, invigilation, seating, and scan progress.
            </Text>
            <View style={examStyles.heroStatsRow}>
              <View style={examStyles.heroStatPill}>
                <Text style={examStyles.heroStatLabel}>QP Pending</Text>
                <Text style={examStyles.heroStatValue}>{examData.qpStatus.pending_approval}</Text>
              </View>
              <View style={examStyles.heroStatPill}>
                <Text style={examStyles.heroStatLabel}>Invigilators</Text>
                <Text style={examStyles.heroStatValue}>{examData.invigilatorStatus.total_invigilators}</Text>
              </View>
              <View style={examStyles.heroStatPill}>
                <Text style={examStyles.heroStatLabel}>Seating</Text>
                <Text style={examStyles.heroStatValue}>{examData.seatingStatus.total_assignments}</Text>
              </View>
            </View>
            <View style={examStyles.heroFilterRow}>
              
              <View style={examStyles.examPickerWrap}>
                <Picker
                  style={examStyles.examPicker}
                  itemStyle={{ color: '#111827' }}
                  dropdownIconColor="#4C1D95"
                  selectedValue={selectedExamType}
                  onValueChange={(itemValue: string) => setSelectedExamType(itemValue)}
                >
                  <Picker.Item label="FA1" value="FA1" />
                  <Picker.Item label="FA2" value="FA2" />
                  <Picker.Item label="SA1" value="SA1" />
                  <Picker.Item label="FA3" value="FA3" />
                  <Picker.Item label="FA4" value="FA4" />
                  <Picker.Item label="SA2" value="SA2" />
                </Picker>
              </View>
            </View>
          </LinearGradient>

          <View style={examStyles.summaryBand}>
            <View style={examStyles.summaryBandLeft}>
              <Text style={examStyles.summaryTitle}>Quick Actions</Text>
              <Text style={examStyles.summaryText}>
                Open the main exam queues without digging through separate card stacks.
              </Text>
            </View>
            <View style={examStyles.summaryBandRight}>
              <TouchableOpacity
                onPress={() => handleOpenPopup('scan_pull_pending', examData.scanPull)}
                style={examStyles.summaryButtonDark}
              >
                <Text style={examStyles.summaryButtonTextDark}>View Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleOpenPopup('qp_status', examData.qpStatus)}
                style={examStyles.summaryButtonLight}
              >
                <Text style={examStyles.summaryButtonTextLight}>QP Report</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={examStyles.metricGrid}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleOpenPopup('scan_pull_pending', examData.scanPull)}
              style={examStyles.metricTouchCard}
            >
              <LinearGradient
                colors={chiefDashboardAccent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={examStyles.metricCardInner}
              >
                <Text style={examStyles.metricLabelLight}>Scan & Pull</Text>
                <Text style={examStyles.metricValueLight}>{examData.scanPull.pending_scan}</Text>
                <View style={examStyles.metricLine}>
                  <View style={[examStyles.metricFill, { width: formatPct(eventMixRate) }]} />
                </View>
                <Text style={examStyles.metricCaptionLight}>Tap to view pending list</Text>
              </LinearGradient>
            </TouchableOpacity>

            <LinearGradient
              colors={chiefDashboardPalette}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={examStyles.metricCard}
            >
              <Text style={examStyles.metricLabelDark}>QP Generation</Text>
              <Text style={examStyles.metricValueDark}>{examData.qpStatus.total_qp}</Text>
              <View style={examStyles.sparkMiniRow}>
                {qpBars.map((value, index) => (
                  <View
                    key={`qp-bar-${index}`}
                    style={[
                      examStyles.sparkMiniBar,
                      { height: value, backgroundColor: index % 2 === 0 ? '#7C3AED' : '#B58BFF' },
                    ]}
                  />
                ))}
              </View>
              <Text style={examStyles.metricCaptionDark}>
                {examData.qpStatus.total_qp ? `${Math.round(qpReadyRate)}% ready` : 'No QP yet'}
              </Text>
            </LinearGradient>

            <LinearGradient
              colors={chiefDashboardAccent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={examStyles.metricCard}
            >
              <Text style={examStyles.metricLabelLight}>Invigilation</Text>
              <Text style={examStyles.metricValueLight}>
                {examData.invigilatorStatus.total_invigilators}
              </Text>
              <View style={examStyles.metricLine}>
                <View
                  style={[
                    examStyles.metricFillSecondary,
                    {
                      width: formatPct(
                        progressValue(
                          examData.invigilatorStatus.total_invigilators,
                          Math.max(
                            examData.invigilatorStatus.total_invigilators + examData.seatingStatus.total_assignments,
                            1,
                          ),
                        ),
                      ),
                    },
                  ]}
                />
              </View>
              <Text style={examStyles.metricCaptionLight}>Assigned teachers</Text>
            </LinearGradient>

            <LinearGradient
              colors={chiefDashboardPalette}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={examStyles.metricCard}
            >
              <Text style={examStyles.metricLabelDark}>Events & Timetable</Text>
              <Text style={examStyles.metricValueDark}>{filteredCompletedEvents.length}</Text>
              <View style={examStyles.sparkMiniRow}>
                {eventBars.map((value, index) => (
                  <View
                    key={`event-bar-${index}`}
                    style={[
                      examStyles.sparkMiniBar,
                      { height: value, backgroundColor: index % 2 === 0 ? '#7C3AED' : '#C3BDFB' },
                    ]}
                  />
                ))}
              </View>
              <Text style={examStyles.metricCaptionDark}>{selectedMonthLabel}</Text>
            </LinearGradient>
          </View>

          <View style={examStyles.extraStrip}>
            <TouchableOpacity
              onPress={() => handleOpenPopup('invigilator_assignments', examData.invigilatorStatus.assignments)}
              style={examStyles.extraChip}
            >
              <Text style={examStyles.extraChipText}>Invigilator List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleOpenPopup('seating_status', examData.seatingStatus)}
              style={examStyles.extraChipSoft}
            >
              <Text style={examStyles.extraChipTextSoft}>Seating List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedClassSection('')}
              style={examStyles.extraChip}
            >
              <Text style={examStyles.extraChipText}>Reset Class Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={popup.isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClosePopup}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalTitle}>{popup.title}</Text>
              <TouchableOpacity onPress={handleClosePopup}>
                <Text style={modalStyles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={modalStyles.modalContent}>{popup.content}</View>

            {popup.downloadData.length > 0 && (
              <TouchableOpacity style={modalStyles.downloadBtn}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  Download Data
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  closeButton: { fontSize: 20, color: '#999', padding: 5 },
  modalContent: { marginBottom: 20 },
  infoText: { fontSize: 15, marginBottom: 8 },
  subHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  listItem: { fontSize: 14, color: '#555', paddingVertical: 2 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
  },
  headerCell: { fontWeight: 'bold', fontSize: 12 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  downloadBtn: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});

export default ExamManagement;

const examStyles = StyleSheet.create({
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
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    color: '#4B4B55',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: '600',
    marginBottom: 14,
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
    backgroundColor: 'rgba(255,255,255,0.7)',
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
  heroFilterRow: {
    marginTop: 12,
    gap: 10,
  },
  monthPickerWrap: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
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
  examPickerWrap: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    paddingHorizontal: 10,
    height: 50,
    justifyContent: 'center',
  },
  examPicker: {
    color: '#111827',
    height: 50,
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
  summaryBandLeft: { flex: 1 },
  summaryBandRight: { gap: 8, alignItems: 'flex-end' },
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
  metricTouchCard: {
    width: '48.5%',
    minHeight: 160,
    borderRadius: 22,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: 'hidden',
  },
  metricCardInner: {
    flex: 1,
    padding: 14,
    borderRadius: 22,
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
  metricFillSecondary: {
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
  extraStrip: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  extraChip: {
    flexGrow: 1,
    minWidth: '31%',
    backgroundColor: '#4C1D95',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  extraChipSoft: {
    flexGrow: 1,
    minWidth: '31%',
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  extraChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  extraChipTextSoft: {
    color: '#4C1D95',
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
