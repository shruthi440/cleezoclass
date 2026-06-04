import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ChiefFooterProfile from './ChiefFooterProfile';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { globalStyles as styles } from '../styles';
import { RootStackParamList } from '../types';

const chiefDashboardPalette = ['#F4EFEB', '#D1C7F9', '#C3BDFB'];
const chiefDashboardAccent = ['#E4D8FF', '#B58BFF', '#7C3AED'];
const chiefDeepPurple = '#4C1D95';
const chiefPurple = '#7C3AED';

/* -------------------- TYPES -------------------- */
type TabType = 'Testperformance' | 'PerformanceGraph';
/* -------------------- TYPES -------------------- */
type StudentItem = {
  id: number;
  name: string;
  class_name: string;
  section: string;
  schoolCode: string;
  user_type: 'student' | 'teacher' | string;
  class_teacher: string | null;
};

type AttendanceMonth = {
  month: string;
  present: number;
  total: number;
};

type AttendanceResponse = {
  monthly: AttendanceMonth[];
};

type PerformanceItem = {
  subject: string;
  FA: string[];
  SA: string[];
  total: string;
  percentage: string;
  overallGrade: string;
  testGrades: Record<string, any>;
  tests?: Record<
    string,
    { obtained?: number | string | null; max?: number | string | null }
  >;
};

type TermRow = {
  key: string;
  label: string;
};

type TrendPoint = {
  key: string;
  label: string;
  value: number | null;
};

const normalizePerformanceItem = (item: any): PerformanceItem => {
  const subject = String(item?.subject || '');
  const tests = item?.tests || {};

  if (Array.isArray(item?.FA) || Array.isArray(item?.SA)) {
    return {
      subject,
      FA: Array.isArray(item?.FA) ? item.FA : [],
      SA: Array.isArray(item?.SA) ? item.SA : [],
      total: String(item?.total || ''),
      percentage: String(item?.percentage || ''),
      overallGrade: String(item?.overallGrade || ''),
      testGrades: item?.testGrades || {},
      tests,
    };
  }

  const parseMarks = (prefix: 'FA' | 'SA') => {
    return Object.keys(tests)
      .filter(key => key.toUpperCase().startsWith(prefix))
      .sort((a, b) => {
        const ai = Number(a.replace(/[^0-9]/g, '')) || 0;
        const bi = Number(b.replace(/[^0-9]/g, '')) || 0;
        return ai - bi;
      })
      .map(key => String(tests[key]?.obtained ?? 0));
  };

  return {
    subject,
    FA: parseMarks('FA'),
    SA: parseMarks('SA'),
    total: String(item?.total || ''),
    percentage: String(item?.percentage || ''),
    overallGrade: String(item?.overallGrade || ''),
    testGrades: item?.testGrades || {},
    tests,
  };
};

const fallbackTermRows: TermRow[] = [
  { label: 'FA1', key: 'FA1' },
  { label: 'FA2', key: 'FA2' },
  { label: 'SA1', key: 'SA1' },
  { label: 'FA3', key: 'FA3' },
  { label: 'FA4', key: 'FA4' },
  { label: 'SA2', key: 'SA2' },
];

const buildTermRows = (testTypes: any[]): TermRow[] => {
  if (!Array.isArray(testTypes) || testTypes.length === 0) {
    return fallbackTermRows;
  }

  return testTypes
    .filter((row: any) => row?.key && row?.label)
    .map((row: any) => ({ key: row.key, label: row.label }));
};

const getTermMark = (subject: PerformanceItem, rowKey: string) => {
  const testEntry = subject?.tests?.[rowKey];
  if (testEntry?.obtained !== null && testEntry?.obtained !== undefined) {
    return testEntry.obtained;
  }

  const match = String(rowKey || '')
    .toUpperCase()
    .match(/^(FA|SA)(\d+)$/);
  if (!match) return '-';

  const type = match[1];
  const index = Number(match[2]) - 1;
  const legacyMark = type === 'FA' ? subject?.FA?.[index] : subject?.SA?.[index];
  return legacyMark ?? '-';
};

const getTermMax = (subject: PerformanceItem, rowKey: string) => {
  const testEntry = subject?.tests?.[rowKey];
  if (testEntry?.max !== null && testEntry?.max !== undefined) {
    return Number(testEntry.max) || 0;
  }

  const match = String(rowKey || '')
    .toUpperCase()
    .match(/^(FA|SA)(\d+)$/);
  if (!match) return 0;

  return match[1] === 'FA' ? 20 : 80;
};

const getSubjectDisplayName = (subject: PerformanceItem, index: number) =>
  subject.subject || `Subject ${index + 1}`;

const computeAcademicSummary = (
  performance: PerformanceItem[],
  testTypes: any[],
) => {
  if (!performance.length) return { grade: '-', percentage: '0.00' };

  const termRows = buildTermRows(testTypes);
  let obtained = 0;
  let total = 0;

  performance.forEach(subject => {
    termRows.forEach(row => {
      const mark = getTermMark(subject, row.key);
      const maxMark = getTermMax(subject, row.key);
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

const computeTestSummary = (
  performance: PerformanceItem[],
  rowKey: string,
  testTypes: any[],
) => {
  if (!performance.length || !rowKey) return { grade: '-', percentage: '0.00' };
  const termRows = buildTermRows(testTypes);
  const matchedRow = termRows.find(row => row.key === rowKey);
  if (!matchedRow) return { grade: '-', percentage: '0.00' };

  let obtained = 0;
  let total = 0;

  performance.forEach(subject => {
    const mark = getTermMark(subject, matchedRow.key);
    const maxMark = getTermMax(subject, matchedRow.key);
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

const buildTrendPoints = (
  performance: PerformanceItem[],
  termRows: TermRow[],
): TrendPoint[] =>
  termRows.map(term => {
    let obtained = 0;
    let total = 0;

    performance.forEach(subject => {
      const mark = getTermMark(subject, term.key);
      const max = getTermMax(subject, term.key);
      const numericMark = Number(mark);

      if (
        mark !== '-' &&
        mark !== null &&
        mark !== undefined &&
        !Number.isNaN(numericMark) &&
        max > 0
      ) {
        obtained += numericMark;
        total += max;
      }
    });

    return {
      key: term.key,
      label: term.label,
      value: total > 0 ? Number(((obtained / total) * 100).toFixed(2)) : null,
    };
  });

const buildTrendSummary = (points: TrendPoint[]) => {
  const validPoints = points.filter(point => point.value !== null);
  const transitions: Array<{
    from: string;
    to: string;
    diff: number;
    improved: boolean;
    status: string;
  }> = [];

  for (let i = 1; i < validPoints.length; i += 1) {
    const prev = validPoints[i - 1];
    const current = validPoints[i];
    const diff = Number(((current.value ?? 0) - (prev.value ?? 0)).toFixed(2));
    transitions.push({
      from: prev.label,
      to: current.label,
      diff,
      improved: diff > 0,
      status: diff > 0 ? 'Improved' : diff < 0 ? 'Declined' : 'No Change',
    });
  }

  const overallDiff =
    validPoints.length >= 2
      ? Number(
          (
            (validPoints[validPoints.length - 1].value ?? 0) -
            (validPoints[0].value ?? 0)
          ).toFixed(2),
        )
      : null;

  return { validPoints, transitions, overallDiff };
};

/* -------------------- CONSTANTS -------------------- */
const STATIC_SECTIONS = ['A', 'B', 'C'];
const backArrowImage = require('../assets/Arrow.png');

/* -------------------- COMPONENT -------------------- */
const AcademicStudent: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabType>('PerformanceGraph');

  const [schoolCode, setSchoolCode] = useState<string>('');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [trendVisible, setTrendVisible] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [classSections, setClassSections] = useState<
    { class_name: string; section: string }[]
  >([]);

  const [selectedClassSection, setSelectedClassSection] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const [attendanceData, setAttendanceData] =
    useState<AttendanceResponse | null>(null);
  const [averageAttendance, setAverageAttendance] = useState<number>(0);
  const [performance, setPerformance] = useState<PerformanceItem[]>([]);
  const [testTypes, setTestTypes] = useState<any[]>([]);
  const [overallPerformance, setOverallPerformance] = useState<number>(0);
  const [trendSubjectKey, setTrendSubjectKey] = useState<string>('__all__');
  const [classTeacher, setClassTeacher] = useState<string>('');
  const API_BASE = 'https://cleezoclass.com:4000/api';

  const handleBackToChiefDashboard = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return true;
    }

    navigation.navigate('ChiefDashboard');
    return true;
  }, [navigation]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackToChiefDashboard,
    );

    return () => subscription.remove();
  }, [handleBackToChiefDashboard]);

  /* -------------------- LOAD SCHOOL CODE -------------------- */
  useEffect(() => {
    const loadSchoolCode = async () => {
      const code = await AsyncStorage.getItem('schoolCode');
      if (code) setSchoolCode(code);
    };
    loadSchoolCode();
  }, []);

  /* -------------------- FETCH CLASSES -------------------- */
  useEffect(() => {
    if (!schoolCode) return;
    axios.get(`${API_BASE}/admin/sectionFilter?schoolCode=${schoolCode}`);

    axios
      .get(`https://cleezoclass.com:4000/api/classes?schoolCode=${schoolCode}`)
      .then(res => setClasses(Array.isArray(res.data) ? res.data : []))
      .catch(() => setClasses([]));
  }, [schoolCode]);

  /* -------------------- FETCH STUDENTS -------------------- */
  useEffect(() => {
    console.log('🔁 Students fetch effect triggered');

    if (!selectedClass || !selectedSection || !schoolCode) return;

    const url = `https://cleezoclass.com:4000/api/students?schoolCode=${schoolCode}&class=${selectedClass}&section=${selectedSection}`;

    axios
      .get(url)
      .then(res => {
        if (!Array.isArray(res.data)) {
          setStudents([]);
          setClassTeacher('');
          return;
        }

        const filteredStudents = res.data.filter(
          (student: StudentItem) =>
            String(student.class_name) === String(selectedClass) &&
            String(student.section).toUpperCase() ===
              String(selectedSection).toUpperCase() &&
            String(student.schoolCode) === String(schoolCode) &&
            student.user_type === 'student',
        );

        const uniqueMap = new Map<number, StudentItem>();
        filteredStudents.forEach(student => {
          if (!uniqueMap.has(student.id)) uniqueMap.set(student.id, student);
        });

        const sortedStudents = Array.from(uniqueMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        setStudents(sortedStudents);
        setSelectedStudentId(prev => prev || sortedStudents[0]?.id.toString() || '');
        setClassTeacher(sortedStudents[0]?.class_teacher || '');
      })
      .catch(err => {
        console.error('❌ Students API error:', err?.response || err);
        setStudents([]);
      });
  }, [selectedClass, selectedSection, schoolCode]);

  /* -------------------- HANDLE CLASS-SECTION SELECTION -------------------- */
  const handleClassSectionChange = (value: string) => {
    setSelectedClassSection(value);
    if (!value) {
      setSelectedClass('');
      setSelectedSection('');
      setStudents([]);
      return;
    }
    const [cls, section] = value.split('-');
    setSelectedClass(cls.trim());
    setSelectedSection(section.trim());
  };

  /* -------------------- FETCH ATTENDANCE -------------------- */
  useEffect(() => {
    if (!selectedStudentId) return;

    const student = students.find(s => s.id.toString() === selectedStudentId);
    if (!student) return;

    axios
      .post('https://cleezoclass.com:4000/api/report/attendance/monthly', {
        name: student.name,
        class_name: selectedClass,
        section: selectedSection,
        schoolCode,
      })
      .then(res => {
        const data: AttendanceResponse = res.data;
        setAttendanceData(data);
        const lastMonths = data?.monthly?.slice(-6) || [];
        const avg = lastMonths.length
          ? lastMonths.reduce(
              (sum, m) => sum + (m.present / m.total) * 100,
              0,
            ) / lastMonths.length
          : 0;
        setAverageAttendance(Number(avg.toFixed(2)));
      })
      .catch(err =>
        console.error('❌ Attendance API error:', err?.response || err),
      );
  }, [selectedStudentId, students, selectedClass, selectedSection, schoolCode]);

  const getAttendanceGrade = (percentage: number) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const selectedStudent = students.find(
    s => s.id.toString() === selectedStudentId,
  );

  /* -------------------- FETCH PERFORMANCE -------------------- */
  useEffect(() => {
    if (!selectedStudentId) return;
    const student = students.find(s => s.id.toString() === selectedStudentId);
    if (!student) return;

    axios
      .post('https://cleezoclass.com:4000/api/overall/academic-performance', {
        name: student.name,
        class_name: selectedClass,
        section: selectedSection,
        schoolCode,
      })
      .then(res => {
        const raw = res.data;
        const source = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.performance)
          ? raw.performance
          : [];

        const data: PerformanceItem[] = source.map(normalizePerformanceItem);
        setPerformance(Array.isArray(data) ? data : []);
        setTestTypes(Array.isArray(raw?.testTypes) ? raw.testTypes : []);

        if (data.length) {
          const overallPercentages = data.map(item => {
            const faMarks = (item.FA || []).map(x => parseFloat(x) || 0);
            const saMarks = (item.SA || []).map(x => parseFloat(x) || 0);
            const totalObtained = [...faMarks, ...saMarks].reduce(
              (sum, m) => sum + m,
              0,
            );
            const maxMarks = faMarks.length * 20 + saMarks.length * 80;
            return maxMarks ? (totalObtained / maxMarks) * 100 : 0;
          });
          const avgOverall =
            overallPercentages.reduce((sum, p) => sum + p, 0) /
            overallPercentages.length;
          setOverallPerformance(Number(avgOverall.toFixed(2)));
        } else setOverallPerformance(0);
      })
      .catch(err => {
        console.error('❌ Performance API error:', err?.response || err);
        setPerformance([]);
        setOverallPerformance(0);
      });
  }, [selectedStudentId, students, selectedClass, selectedSection, schoolCode]);

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };
  useEffect(() => {
    if (!schoolCode) return;

    console.log('📡 Fetching Class-Sections...');

    axios
      .get(`${API_BASE}/admin/sectionFilter?schoolCode=${schoolCode}`)
      .then(res => {
        console.log('✅ Sections Raw Response:', res.data);

        if (Array.isArray(res.data)) {
          setClassSections(res.data); // ✅ store full response
        } else {
          setClassSections([]);
        }
      })
      .catch(err => {
        console.log('❌ Sections Error:', err?.response || err);
        setClassSections([]);
      });
  }, [schoolCode]);

  useEffect(() => {
    if (selectedClassSection || !classSections.length) return;

    const sortedSections = [...classSections].sort((a, b) => {
      const orderA = getClassOrder(a.class_name);
      const orderB = getClassOrder(b.class_name);

      if (orderA !== orderB) return orderA - orderB;
      return a.section.localeCompare(b.section);
    });

    const firstSection = sortedSections[0];
    if (firstSection) {
      handleClassSectionChange(`${firstSection.class_name} - ${firstSection.section}`);
    }
  }, [classSections, selectedClassSection]);

  const calculatePercentage = (fa: string[], sa: string[]) => {
    const faMarks = fa.map(m => parseFloat(m) || 0);
    const saMarks = sa.map(m => parseFloat(m) || 0);
    const obtained = [...faMarks, ...saMarks].reduce((a, b) => a + b, 0);
    const max = faMarks.length * 20 + saMarks.length * 80;
    return max ? Math.round((obtained / max) * 100) : 0;
  };

  const attendanceGrade = getAttendanceGrade(averageAttendance);
  const performanceGrade = getGrade(overallPerformance);
  const summary = useMemo(
    () => computeAcademicSummary(performance, testTypes),
    [performance, testTypes],
  );
  const termRowsForSummary = useMemo(
    () => buildTermRows(testTypes),
    [testTypes],
  );
  const subjectOptions = useMemo(
    () =>
      performance.map((subject, index) => ({
        key: getSubjectDisplayName(subject, index)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-'),
        label: getSubjectDisplayName(subject, index),
      })),
    [performance],
  );
  const selectedSubjectRow = useMemo(() => {
    if (trendSubjectKey === '__all__') return null;
    const matchedIndex = performance.findIndex(
      (subject, index) =>
        getSubjectDisplayName(subject, index)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
        === trendSubjectKey,
    );
    return matchedIndex >= 0 ? performance[matchedIndex] : null;
  }, [performance, trendSubjectKey]);
  const activeTrend = useMemo(() => {
    const sourceRows = selectedSubjectRow ? [selectedSubjectRow] : performance;
    return buildTrendSummary(buildTrendPoints(sourceRows, termRowsForSummary));
  }, [performance, selectedSubjectRow, termRowsForSummary]);
  const chartPoints = activeTrend.validPoints;
  const chartLabels = chartPoints.map(point => point.label);
  const chartData = chartPoints.map(point => point.value ?? 0);
  const chartWidth = Math.max(width - 56, 240);
  const activeTrendTitle = selectedSubjectRow
    ? selectedSubjectRow.subject || 'Selected Subject'
    : 'All Subjects';
  const getClassOrder = (cls: string) => {
    const value = cls.toUpperCase().trim();

    if (value === 'NURSERY') return 0;
    if (value === 'LKG') return 1;
    if (value === 'UKG') return 2;

    // If numeric class (1–12)
    const num = parseInt(value);
    if (!isNaN(num)) return 2 + num;

    return 999; // anything unknown goes last
  };
  const renderReportModal = () => {
    if (!selectedStudent) return null;

    return (
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent1}>
            <ScrollView>
              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setReportModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>

              {/* Student Info */}
              <Text style={styles.modalTitle1}>{selectedStudent.name}</Text>
              <Text style={styles.modalSubtitle}>
                {selectedClass && selectedSection
                  ? `Class ${selectedClass} - Section ${selectedSection}`
                  : 'Class - Section'}
              </Text>

              {/* Class Teacher */}
              <View style={styles.modalCard}>
                <Text style={styles.cardTitle}>Class Teacher</Text>
                <Text style={[styles.bigGradeBlack, { fontSize: 16 }]}>
                  {classTeacher || 'Not Assigned'}
                </Text>
              </View>

              {/* Attendance */}
              <View style={styles.modalCard}>
                <Text style={styles.cardTitle}>Attendance</Text>
                <Text style={styles.bigGradeBlack}>{attendanceGrade}</Text>
                <Text style={styles.percentTextBlack}>
                  {averageAttendance.toFixed(2)}%
                </Text>
              </View>

              {/* Performance */}
              <View style={styles.modalCard}>
                <Text style={styles.cardTitle}>Overall Performance</Text>
                <Text style={styles.bigGradeBlack}>{performanceGrade}</Text>
                <Text style={styles.percentTextBlack}>
                  {overallPerformance.toFixed(2)}%
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };
  /* -------------------- UI -------------------- */
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.headerText}>Academics - Student</Text>
          </View>

          {/* INLINE SELECTORS */}
          <View style={studentStyles.selectorRow}>
            <View style={studentStyles.selectorColumn}>
              <Text style={studentStyles.selectorLabel}>Class - Section</Text>
              <Picker
                selectedValue={selectedClassSection}
                onValueChange={handleClassSectionChange}
                style={studentStyles.selectorPicker}
                itemStyle={{ color: '#111827' }}
                dropdownIconColor="#4C1D95"
              >
                <Picker.Item label="Select Class - Section" value="" />
                {classSections
                  .sort((a, b) => {
                    const orderA = getClassOrder(a.class_name);
                    const orderB = getClassOrder(b.class_name);

                    if (orderA !== orderB) return orderA - orderB;

                    return a.section.localeCompare(b.section);
                  })
                  .map((item, index) => (
                    <Picker.Item
                      key={`${item.class_name}-${item.section}-${index}`}
                      label={`Class ${item.class_name} - Section ${item.section}`}
                      value={`${item.class_name} - ${item.section}`}
                    />
                  ))}
              </Picker>
            </View>

            <View style={studentStyles.selectorColumn}>
              <Text style={studentStyles.selectorLabel}>Student</Text>
              <Picker
                style={studentStyles.selectorPicker}
                itemStyle={{ color: '#111827' }}
                dropdownIconColor="#4C1D95"
                selectedValue={selectedStudentId}
                onValueChange={setSelectedStudentId}
                enabled={students.length > 0}
              >
                <Picker.Item label="Student" value="" />
                {students.map(s => (
                  <Picker.Item
                    key={s.id}
                    label={s.name}
                    value={s.id.toString()}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <LinearGradient
            colors={chiefDashboardPalette}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={studentStyles.heroCard}
          >
            <View style={studentStyles.heroOverlay} />
            <Text style={studentStyles.heroTitle}>Academic Snapshot</Text>
            <Text style={studentStyles.heroSubtitle}>
              Track attendance, overall progress, and test performance in one clean view.
            </Text>
            <View style={studentStyles.heroStatsRow}>
              <View style={studentStyles.heroStatPill}>
                <Text style={studentStyles.heroStatLabel}>Attendance</Text>
                <Text style={studentStyles.heroStatValue}>{attendanceGrade}</Text>
              </View>
              <View style={studentStyles.heroStatPill}>
                <Text style={studentStyles.heroStatLabel}>Overall</Text>
                <Text style={studentStyles.heroStatValue}>{performanceGrade}</Text>
              </View>
              <View style={studentStyles.heroStatPill}>
                <Text style={studentStyles.heroStatLabel}>Teacher</Text>
                <Text style={studentStyles.heroStatValue}>
                  {classTeacher || 'Not set'}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View style={studentStyles.summaryBand}>
            <View style={studentStyles.summaryBandLeft}>
              <Text style={studentStyles.summaryTitle}>Quick Filters</Text>
              <Text style={studentStyles.summaryText}>
                Pick the class and student, then switch between test and graph views.
              </Text>
            </View>
            <View style={studentStyles.summaryBandRight}>
              <TouchableOpacity
                onPress={() => setActiveTab('Testperformance')}
                style={studentStyles.summaryButtonDark}
              >
                <Text style={studentStyles.summaryButtonTextDark}>Tests</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('PerformanceGraph')}
                style={studentStyles.summaryButtonLight}
              >
                <Text style={studentStyles.summaryButtonTextLight}>Graph</Text>
              </TouchableOpacity>
            </View>
          </View>
    
          {/* TABS */}
          <View style={styles.syllabusContainer1}>
            <View style={styles.tabRow}>
              <TouchableOpacity
                onPress={() => setActiveTab('Testperformance')}
                style={[
                  styles.tab,
                  activeTab === 'Testperformance' && styles.activeTabBackground,
                ]}
              >
                <Text
                  style={
                    activeTab === 'Testperformance'
                      ? styles.activeTabText
                      : styles.inactiveTabText
                  }
                >
                  Test Performance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('PerformanceGraph')}
                style={[
                  styles.tab,
                  activeTab === 'PerformanceGraph' &&
                    styles.activeTabBackground,
                ]}
              >
                <Text
                  style={
                    activeTab === 'PerformanceGraph'
                      ? styles.activeTabText
                      : styles.inactiveTabText
                  }
                >
                  Performance Graph
                </Text>
              </TouchableOpacity>
            </View>

           
            <View style={styles.syllabusContent}>
              {activeTab === 'Testperformance' ? (
                <>
                  <View style={styles.nameRow}>
                    <Text style={styles.teacherName}>
                      {selectedStudent?.name || 'Student Name'}
                    </Text>

                    <Text style={styles.classText}>
                      {selectedClass && selectedSection
                        ? `Class ${selectedClass} - Section ${selectedSection}`
                        : 'Class - Section'}
                    </Text>
                  </View>
                  <View style={styles.chartFrame}>
                    {/* Y Axis */}

                    {/* Chart */}
                    <View style={styles.chartArea}>
                      {performance.map((item, index) => {
                        const percent = calculatePercentage(item.FA, item.SA);

                        return (
                          <View key={index} style={styles.barPair}>
                            <View
                              style={[
                                styles.bar,
                                styles.runBar,
                                { height: Math.min(percent, 40) }, // 🔥 max height limited to 100
                              ]}
                            />

                            <Text style={styles.barName}>{item.subject}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.box, styles.runBar]} />
                      <Text>Max</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.box, styles.lagBar]} />
                      <Text>Obtain</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setTrendVisible(true)}>
                    <Text style={styles.viewLinkCenter}>View Graph</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={chartStyles.inlineGraphCard}>
                  <View style={chartStyles.activeTrendRow}>
                    <Text style={chartStyles.activeTrendTitle}>
                      {activeTrendTitle}
                    </Text>
                    {activeTrend.overallDiff !== null ? (
                      <Text
                        style={[
                          chartStyles.activeTrendDiff,
                          activeTrend.overallDiff > 0
                            ? chartStyles.diffUp
                            : activeTrend.overallDiff < 0
                            ? chartStyles.diffDown
                            : chartStyles.diffFlat,
                        ]}
                      >
                        {activeTrend.overallDiff > 0 ? '+' : ''}
                        {activeTrend.overallDiff}%
                      </Text>
                    ) : null}
                  </View>

                  <View style={chartStyles.trendSelectorWrap}>
                    <Text style={chartStyles.trendSelectorLabel}>Subject</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={chartStyles.trendSelectorChips}
                    >
                      <TouchableOpacity
                        style={[
                          chartStyles.trendChip,
                          trendSubjectKey === '__all__' &&
                            chartStyles.trendChipActive,
                        ]}
                        onPress={() => setTrendSubjectKey('__all__')}
                      >
                        <Text
                          style={[
                            chartStyles.trendChipText,
                            trendSubjectKey === '__all__' &&
                              chartStyles.trendChipTextActive,
                          ]}
                        >
                          All Subjects
                        </Text>
                      </TouchableOpacity>

                      {subjectOptions.map(subject => (
                        <TouchableOpacity
                          key={subject.key}
                          style={[
                            chartStyles.trendChip,
                            trendSubjectKey === subject.key &&
                              chartStyles.trendChipActive,
                          ]}
                          onPress={() => setTrendSubjectKey(subject.key)}
                        >
                          <Text
                            style={[
                              chartStyles.trendChipText,
                              trendSubjectKey === subject.key &&
                                chartStyles.trendChipTextActive,
                            ]}
                          >
                            {subject.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {chartPoints.length < 2 ? (
                    <View style={chartStyles.emptyState}>
                      <Text style={chartStyles.emptyTitle}>
                        Not enough test data
                      </Text>
                      <Text style={chartStyles.emptyText}>
                        Add at least two test records to display the graph.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={chartStyles.chartWrap}>
                        <LineChart
                          data={{
                            labels: chartLabels,
                            datasets: [
                              {
                                data: chartData,
                                color: opacity =>
                                  `rgba(124, 58, 237, ${opacity})`,
                                strokeWidth: 3,
                              },
                            ],
                          }}
                          width={chartWidth}
                          height={240}
                          yAxisSuffix="%"
                          fromZero
                          withDots
                          withInnerLines={false}
                          withOuterLines
                          segments={4}
                          bezier
                          chartConfig={{
                            backgroundColor: '#F6F3FF',
                            backgroundGradientFrom: '#F6F3FF',
                            backgroundGradientTo: '#F6F3FF',
                            decimalPlaces: 1,
                            color: opacity => `rgba(124, 58, 237, ${opacity})`,
                            labelColor: () => '#667085',
                            propsForDots: {
                              r: '4',
                              strokeWidth: '2',
                              stroke: '#7C3AED',
                            },
                            propsForBackgroundLines: {
                              stroke: '#e5e7eb',
                              strokeDasharray: '',
                            },
                          }}
                          style={chartStyles.trendChart}
                        />
                      </View>

                      <View style={chartStyles.transitionList}>
                        {activeTrend.transitions.map(item => (
                          <Text
                            key={`${item.from}-${item.to}`}
                            style={[
                              chartStyles.transitionItem,
                              item.improved
                                ? chartStyles.transitionUp
                                : item.diff < 0
                                ? chartStyles.transitionDown
                                : chartStyles.transitionFlat,
                            ]}
                          >
                            {item.from} to {item.to}: {item.status} (
                            {item.diff > 0 ? '+' : ''}
                            {item.diff}%)
                          </Text>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>

            <View style={[styles.notchContainer4, { marginTop: '-1%' }]}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine} />
              <View style={styles.rightNotch} />
            </View>

          </View>
        </View>
      </ScrollView>
      {renderReportModal()}
      <Modal
        visible={trendVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTrendVisible(false)}
      >
        <View style={chartStyles.modalOverlay}>
          <View style={chartStyles.trendModal}>
            <View style={chartStyles.trendModalHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={chartStyles.trendModalTitle}>Study Graph</Text>
                <Text style={chartStyles.trendModalSubtitle}>
                  {selectedStudent?.name || 'Student'} {selectedClass && selectedSection ? `| Class ${selectedClass} - Section ${selectedSection}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={chartStyles.closeBtn}
                onPress={() => setTrendVisible(false)}
              >
                <Text style={chartStyles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={chartStyles.trendModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={chartStyles.trendSelectorWrap}>
                <Text style={chartStyles.trendSelectorLabel}>Subject</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={chartStyles.trendSelectorChips}
                >
                  <TouchableOpacity
                    style={[
                      chartStyles.trendChip,
                      trendSubjectKey === '__all__' &&
                        chartStyles.trendChipActive,
                    ]}
                    onPress={() => setTrendSubjectKey('__all__')}
                  >
                    <Text
                      style={[
                        chartStyles.trendChipText,
                        trendSubjectKey === '__all__' &&
                          chartStyles.trendChipTextActive,
                      ]}
                    >
                      All Subjects
                    </Text>
                  </TouchableOpacity>

                  {subjectOptions.map(subject => (
                    <TouchableOpacity
                      key={subject.key}
                      style={[
                        chartStyles.trendChip,
                        trendSubjectKey === subject.key &&
                          chartStyles.trendChipActive,
                      ]}
                      onPress={() => setTrendSubjectKey(subject.key)}
                    >
                      <Text
                        style={[
                          chartStyles.trendChipText,
                          trendSubjectKey === subject.key &&
                            chartStyles.trendChipTextActive,
                        ]}
                      >
                        {subject.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {chartPoints.length < 2 ? (
                <View style={chartStyles.emptyState}>
                  <Text style={chartStyles.emptyTitle}>Not enough test data</Text>
                  <Text style={chartStyles.emptyText}>
                    Add at least two test records to display the graph.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={chartStyles.activeTrendRow}>
                    <Text style={chartStyles.activeTrendTitle}>
                      {activeTrendTitle}
                    </Text>
                    {activeTrend.overallDiff !== null ? (
                      <Text
                        style={[
                          chartStyles.activeTrendDiff,
                          activeTrend.overallDiff > 0
                            ? chartStyles.diffUp
                            : activeTrend.overallDiff < 0
                            ? chartStyles.diffDown
                            : chartStyles.diffFlat,
                        ]}
                      >
                        {activeTrend.overallDiff > 0 ? '+' : ''}
                        {activeTrend.overallDiff}%
                      </Text>
                    ) : null}
                  </View>

                  <View style={chartStyles.chartWrap}>
                    <LineChart
                      data={{
                        labels: chartLabels,
                        datasets: [
                          {
                            data: chartData,
                            color: opacity =>
                              `rgba(124, 58, 237, ${opacity})`,
                            strokeWidth: 3,
                          },
                        ],
                      }}
                      width={chartWidth}
                      height={240}
                      yAxisSuffix="%"
                      fromZero
                      withDots
                      withInnerLines={false}
                      withOuterLines
                      segments={4}
                      bezier
                      chartConfig={{
                        backgroundColor: '#F6F3FF',
                        backgroundGradientFrom: '#F6F3FF',
                        backgroundGradientTo: '#F6F3FF',
                        decimalPlaces: 1,
                        color: opacity => `rgba(124, 58, 237, ${opacity})`,
                        labelColor: () => '#667085',
                        propsForDots: {
                          r: '4',
                          strokeWidth: '2',
                          stroke: '#7C3AED',
                        },
                        propsForBackgroundLines: {
                          stroke: '#e5e7eb',
                          strokeDasharray: '',
                        },
                      }}
                      style={chartStyles.trendChart}
                    />
                  </View>

                  <View style={chartStyles.transitionList}>
                    {buildTrendSummary(
                      buildTrendPoints(
                        selectedSubjectRow ? [selectedSubjectRow] : performance,
                        termRowsForSummary,
                      ),
                    ).transitions.map(item => (
                      <Text
                        key={`${item.from}-${item.to}`}
                        style={[
                          chartStyles.transitionItem,
                          item.improved
                            ? chartStyles.transitionUp
                            : item.diff < 0
                            ? chartStyles.transitionDown
                            : chartStyles.transitionFlat,
                        ]}
                      >
                        {item.from} to {item.to}: {item.status} (
                        {item.diff > 0 ? '+' : ''}
                        {item.diff}%)
                      </Text>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
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

export default AcademicStudent;

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

const chartStyles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  graphBtn: {
    minWidth: 76,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#4C1D95',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    elevation: 2,
  },
  graphBtnDisabled: {
    opacity: 0.45,
  },
  graphBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  trendModal: {
    backgroundColor: '#F6F3FF',
    borderRadius: 24,
    padding: 16,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '88%',
  },
  trendModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trendModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#101828',
  },
  trendModalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#667085',
  },
  closeBtn: {
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeBtnText: {
    color: '#101828',
    fontWeight: '800',
    fontSize: 13,
  },
  trendModalContent: {
    paddingBottom: 12,
  },
  trendSelectorWrap: {
    marginBottom: 16,
  },
  trendSelectorLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 10,
  },
  trendSelectorChips: {
    gap: 10,
    paddingRight: 8,
  },
  trendChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  trendChipActive: {
    backgroundColor: '#4C1D95',
    borderColor: '#4C1D95',
  },
  trendChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#344054',
  },
  trendChipTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101828',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#667085',
    textAlign: 'center',
  },
  activeTrendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeTrendTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101828',
    flex: 1,
    paddingRight: 12,
  },
  activeTrendDiff: {
    fontSize: 14,
    fontWeight: '800',
  },
  diffUp: {
    color: '#12B76A',
  },
  diffDown: {
    color: '#F04438',
  },
  diffFlat: {
    color: '#667085',
  },
  chartWrap: {
    borderRadius: 20,
    backgroundColor: '#F6F3FF',
    overflow: 'visible',
    marginBottom: 14,
    paddingLeft: 0,
    paddingBottom: 8,
  },
  inlineGraphCard: {
    backgroundColor: '#F6F3FF',
    borderRadius: 18,
    padding: 12,
    overflow: 'visible',
  },
  trendChart: {
    borderRadius: 20,
    marginLeft: -10,
  },
  transitionList: {
    gap: 8,
  },
  transitionItem: {
    fontSize: 13,
    fontWeight: '700',
  },
  transitionUp: {
    color: '#12B76A',
  },
  transitionDown: {
    color: '#F04438',
  },
  transitionFlat: {
    color: '#667085',
  },
});

const studentStyles = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#4B4B55',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
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
  selectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  selectorColumn: {
    flex: 1,
  },
  selectorLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    marginLeft: 2,
  },
  selectorPicker: {
    height: 56,
    color: '#111827',
    backgroundColor: 'transparent',
  },
});
