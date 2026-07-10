import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const studentPhotoUploadBase = 'https://cleezoclass.com:4000/CRM/public/uploads';

interface AcademicSubject {
  name?: string;
  subject?: string;
  subject_name?: string;
  title?: string;
  label?: string;
  FA?: Array<number | string | null>;
  SA?: Array<number | string | null>;
  tests?: Record<string, { obtained?: number | string | null; max?: number | string | null }>;
}

interface TermRow {
  key: string;
  label: string;
}

interface AttendanceReport {
  presentPercentage: number;
  informedPercentage: number;
  uninformedPercentage: number;
  presentDays: number;
  informedDetails?: Array<{ date?: string }>;
  uninformedDetails?: Array<{ date?: string }>;
  presentDetails?: Array<{ date?: string }>;
}

interface BehaviourReport {
  positivePercentage: number;
  needsImprovementPercentage: number;
  negativePercentage: number;
  comments?: {
    Positive?: string[];
    NeedsToImprovement?: string[];
    Negative?: string[];
  };
}

const fallbackTermRows: TermRow[] = [
  { label: 'FA1', key: 'FA1' },
  { label: 'FA2', key: 'FA2' },
  { label: 'SA1', key: 'SA1' },
  { label: 'FA3', key: 'FA3' },
  { label: 'FA4', key: 'FA4' },
  { label: 'SA2', key: 'SA2' },
];

const buildTermRows = (testTypes: any[]): TermRow[] => {
  if (!Array.isArray(testTypes) || testTypes.length === 0) return fallbackTermRows;
  const rows = testTypes
    .filter((row: any) => row?.key && row?.label)
    .map((row: any) => ({ key: row.key, label: row.label }));
  return rows.length ? rows : fallbackTermRows;
};

const getSubjectName = (subject: AcademicSubject, index: number) =>
  subject.name ||
  subject.subject ||
  subject.subject_name ||
  subject.title ||
  subject.label ||
  `Subject ${index + 1}`;

const getTermMark = (subject: AcademicSubject, rowKey: string) => {
  const testEntry = subject?.tests?.[rowKey];
  if (testEntry?.obtained !== null && testEntry?.obtained !== undefined) {
    return testEntry.obtained;
  }

  const match = String(rowKey || '').toUpperCase().match(/^(FA|SA)(\d+)$/);
  if (!match) return '-';

  const type = match[1];
  const index = Number(match[2]) - 1;
  const legacyMark = type === 'FA' ? subject?.FA?.[index] : subject?.SA?.[index];
  return legacyMark ?? '-';
};

const getTermMax = (subject: AcademicSubject, rowKey: string) => {
  const testEntry = subject?.tests?.[rowKey];
  if (testEntry?.max !== null && testEntry?.max !== undefined) {
    return Number(testEntry.max) || 0;
  }

  const match = String(rowKey || '').toUpperCase().match(/^(FA|SA)(\d+)$/);
  if (!match) return 0;
  return match[1] === 'FA' ? 20 : 80;
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

const computeGrade = (percentage: number) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'D';
};

const formatScore = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0.00');
const escapeHtml = (value: any) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const RNHTMLtoPDFModule = require('react-native-html-to-pdf');
const generatePDF =
  RNHTMLtoPDFModule?.generatePDF ||
  RNHTMLtoPDFModule?.default?.generatePDF ||
  RNHTMLtoPDFModule?.default;

const ParentReports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState<Record<string, any>>({});
  const [performance, setPerformance] = useState<AcademicSubject[]>([]);
  const [testTypes, setTestTypes] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [behaviour, setBehaviour] = useState<BehaviourReport | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadReport = async () => {
      try {
        setLoading(true);
        const stored = await AsyncStorage.multiGet([
          'currentStudent',
          'parentProfile',
          'studentId',
          'username',
          'name',
          'class_name',
          'section',
          'schoolCode',
          'photoUrl',
          'photo',
          'father_name',
          'phone_no',
          'aadhar_no',
          'address',
          'gender',
          'school_name',
        ]);

        const entries = Object.fromEntries(stored);
        let currentStudent: Record<string, any> = {};
        let parentProfile: Record<string, any> = {};
        if (entries.currentStudent) {
          try {
            currentStudent = JSON.parse(entries.currentStudent);
          } catch {}
        }
        if (entries.parentProfile) {
          try {
            parentProfile = JSON.parse(entries.parentProfile);
          } catch {}
        }

        const mergedStudent = {
          ...entries,
          ...parentProfile,
          ...currentStudent,
          name: currentStudent.name || entries.name || '-',
          username: currentStudent.username || entries.username || '-',
          class_name: currentStudent.class_name || entries.class_name || '-',
          section: currentStudent.section || entries.section || '-',
          schoolCode: currentStudent.schoolCode || entries.schoolCode || '',
          father_name: currentStudent.father_name || entries.father_name || '-',
          phone_no: currentStudent.phone_no || entries.phone_no || '-',
          aadhar_no: currentStudent.aadhar_no || entries.aadhar_no || '-',
          address: currentStudent.address || entries.address || '-',
          gender: currentStudent.gender || entries.gender || '-',
          photoUrl: resolveRenderablePhotoUri(
            currentStudent.photoUrl ||
              currentStudent.photo ||
              parentProfile.photoUrl ||
              parentProfile.photo ||
              entries.photoUrl ||
              entries.photo ||
              '',
          ),
        };

        if (!isMounted) return;
        setStudentData(mergedStudent);

        const schoolCode = String(mergedStudent.schoolCode || '').trim();
        const className = String(mergedStudent.class_name || '').trim();
        const section = String(mergedStudent.section || '').trim();
        const username = String(mergedStudent.username || '').trim();

        if ((!mergedStudent.photoUrl || mergedStudent.photoUrl === 'null') && username && schoolCode) {
          try {
            const profileRes = await axios.get('http://162.215.210.38:3010/api/student/profile', {
              params: { username, schoolCode },
            });

            if (profileRes.data?.success && profileRes.data?.student) {
              const profileStudent = profileRes.data.student;
              mergedStudent.photoUrl = resolveRenderablePhotoUri(
                profileStudent.photoUrl || profileStudent.photo || '',
              );
              mergedStudent.photo = profileStudent.photo || '';
              if (isMounted) {
                setStudentData({ ...mergedStudent });
              }
            }
          } catch (profileError) {
            console.error('[ParentReports] profile photo fallback failed', profileError);
          }
        }

        const studentName = String(mergedStudent.name || '').trim();

        if (!schoolCode || !studentName || !className || !section) {
          setPerformance([]);
          setTestTypes([]);
          setAttendance(null);
          setBehaviour(null);
          return;
        }

        const requests = [
          axios.post('https://cleezoclass.com:4000/api/overall/academic-performance', {
            name: studentName,
            class_name: className,
            section,
            schoolCode,
          }),
          axios.get(`http://162.215.210.38:3010/over-all-reports/attendance/${encodeURIComponent(studentName)}`, {
            params: { schoolCode },
          }),
          axios.get(`http://162.215.210.38:3010/over-all-reports/report/${encodeURIComponent(studentName)}`, {
            params: { schoolCode },
          }),
        ];

        const [academicRes, attendanceRes, behaviourRes] = await Promise.all(requests);
        if (!isMounted) return;

        if (Array.isArray(academicRes.data)) {
          setPerformance(academicRes.data || []);
          setTestTypes([]);
        } else {
          setPerformance(Array.isArray(academicRes.data?.performance) ? academicRes.data.performance : []);
          setTestTypes(Array.isArray(academicRes.data?.testTypes) ? academicRes.data.testTypes : []);
        }

        setAttendance(attendanceRes.data || null);
        setBehaviour(behaviourRes.data || null);
      } catch (error) {
        console.error('[ParentReports] loadReport failed', error);
        if (!isMounted) return;
        setPerformance([]);
        setTestTypes([]);
        setAttendance(null);
        setBehaviour(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadReport();
    return () => {
      isMounted = false;
    };
  }, []);

  const termRows = useMemo(() => buildTermRows(testTypes), [testTypes]);

  // --- Attendance Calculation ---
  const attendanceStats = useMemo(() => {
    const informed = attendance?.informedDetails?.length || 0;
    const uninformed = attendance?.uninformedDetails?.length || 0;
    const present = attendance?.presentDays || 0;
    const total = present + informed + uninformed;

    const presentPercentage = total > 0 ? (present / total) * 100 : 0;
    const absentPercentage = total > 0 ? ((informed + uninformed) / total) * 100 : 0;

    return {
      present,
      informed,
      uninformed,
      total,
      presentPercentage,
      absentPercentage,
    };
  }, [attendance]);

  const attendanceRows = useMemo(() => {
    return [
      {
        label: 'Overall',
        totalDays: attendanceStats.total,
        present: attendanceStats.present,
        informed: attendanceStats.informed,
        uninformed: attendanceStats.uninformed,
        percentage: attendanceStats.presentPercentage,
      },
    ];
  }, [attendanceStats]);

  // --- Academic Performance ---
  const academicRows = useMemo(() => {
    return performance.map((subject, index) => {
      const subjectName = getSubjectName(subject, index);
      let totalObtained = 0;
      let totalMax = 0;

      const marks = termRows.map((row) => {
        const raw = getTermMark(subject, row.key);
        const numeric = Number(raw);
        const max = getTermMax(subject, row.key);
        if (raw !== '-' && !Number.isNaN(numeric) && max > 0) {
          totalObtained += numeric;
          totalMax += max;
        }
        return raw;
      });

      const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

      return {
        subjectName,
        marks,
        totalObtained,
        percentage,
        grade: computeGrade(percentage),
      };
    });
  }, [performance, termRows]);

  const academicTotals = useMemo(() => {
    const totalObtained = academicRows.reduce((sum, row) => sum + row.totalObtained, 0);
    const totalMax = performance.reduce((subjectSum, subject) => {
      return (
        subjectSum +
        termRows.reduce((rowSum, row) => rowSum + getTermMax(subject, row.key), 0)
      );
    }, 0);
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    return {
      totalObtained,
      percentage,
      grade: computeGrade(percentage),
    };
  }, [academicRows, performance, termRows]);

  // --- Behaviour ---
  const behaviourRows = useMemo(
    () => [
      { label: 'Positive', value: behaviour?.positivePercentage ?? 0 },
      { label: 'Needs Improvement', value: behaviour?.needsImprovementPercentage ?? 0 },
      { label: 'Negative', value: behaviour?.negativePercentage ?? 0 },
    ],
    [behaviour],
  );

  const behaviourComments = useMemo(() => {
    const positive = behaviour?.comments?.Positive || [];
    const needs = behaviour?.comments?.NeedsToImprovement || [];
    const negative = behaviour?.comments?.Negative || [];
    return [
      ...positive.map((comment) => ({ type: 'Positive', comment })),
      ...needs.map((comment) => ({ type: 'Needs Improvement', comment })),
      ...negative.map((comment) => ({ type: 'Negative', comment })),
    ].slice(0, 8);
  }, [behaviour]);

  // --- Student Details ---
  const studentDetailRows = useMemo(
    () => [
      [
        { label: 'Name', value: studentData.name || '-' },
        { label: 'Class', value: studentData.class_name || '-' },
        { label: 'Section', value: studentData.section || '-' },
        { label: 'Father', value: studentData.father_name || '-' },
      ],
      [
        { label: 'Phone', value: studentData.phone_no || '-' },
        { label: 'Gender', value: studentData.gender || '-' },
        { label: 'Aadhar', value: studentData.aadhar_no || '-' },
        { label: 'Address', value: studentData.address || '-' },
      ],
    ],
    [studentData],
  );

  // --- PDF Generation ---
  const buildReportCardHtml = () => {
    const academicRowsHtml = academicRows
      .map((row) => {
        const marksHtml = row.marks.map((mark) => `<td>${escapeHtml(String(mark))}</td>`).join('');
        return `
          <tr>
            <td>${escapeHtml(row.subjectName)}</td>
            ${marksHtml}
            <td>${escapeHtml(formatScore(row.totalObtained))}</td>
            <td>${escapeHtml(`${formatScore(row.percentage)}%`)}</td>
            <td>${escapeHtml(row.grade)}</td>
          </tr>
        `;
      })
      .join('');

    const detailRowsHtml = studentDetailRows
      .map(
        (row) => `
          <tr>
            ${row
              .map(
                (item) => `
                  <td>${escapeHtml(item.label)}</td>
                  <td>${escapeHtml(item.value)}</td>
                `,
              )
              .join('')}
          </tr>
        `,
      )
      .join('');

    const behaviourRowsHtml = behaviourRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(`${formatScore(Number(row.value))}%`)}</td>
          </tr>
        `,
      )
      .join('');

    const remarkRowsHtml =
      behaviourComments
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.type)}</td>
              <td>${escapeHtml(item.comment || '-')}</td>
            </tr>
          `,
        )
        .join('') || '<tr><td colspan="2">No behaviour remarks available.</td></tr>';

    const attendanceRowHtml = `
      <tr>
        <td>${escapeHtml(attendanceRows[0]?.label || 'Overall')}</td>
        <td>${escapeHtml(attendanceRows[0]?.totalDays || 0)}</td>
        <td>${escapeHtml(attendanceRows[0]?.present || 0)}</td>
        <td>${escapeHtml((attendanceRows[0]?.informed || 0) + (attendanceRows[0]?.uninformed || 0))}</td>
        <td>${escapeHtml(`${formatScore(attendanceRows[0]?.percentage || 0)}%`)}</td>
      </tr>
    `;

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #10233f; margin: 18px; }
            .title { text-align: center; font-size: 22px; font-weight: 800; color: #1f3f73; margin-bottom: 4px; }
            .sub { text-align: center; font-size: 12px; color: #667085; margin-bottom: 16px; }
            .section { background: #eaf1f8; border: 1px solid #9cb9d9; color: #17477f; font-weight: 800; padding: 6px; margin-top: 14px; border-radius: 4px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
            th { background: #315e9f; color: white; padding: 7px 4px; border: 1px solid #7e99bd; }
            td { padding: 7px 4px; border: 1px solid #9fb0c7; text-align: center; }
            .left { text-align: left; }
          </style>
        </head>
        <body>
          <div class="title">${escapeHtml(studentData.school_name || studentData.schoolCode || 'Report Card')}</div>
          <div class="sub">ANNUAL PROGRESS REPORT ${new Date().getFullYear()}</div>

          <div class="section">Student Details</div>
          <table>
            <thead>
              <tr>
                <th>Field</th><th>Value</th>
                <th>Field</th><th>Value</th>
                <th>Field</th><th>Value</th>
                <th>Field</th><th>Value</th>
              </tr>
            </thead>
            <tbody>${detailRowsHtml}</tbody>
          </table>

          <div class="section">Academic Performance</div>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                ${termRows.map((row) => `<th>${escapeHtml(row.label)}</th>`).join('')}
                <th>Marks</th>
                <th>%</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${academicRowsHtml}
              <tr>
                <td>Overall Report</td>
                ${termRows.map(() => '<td>-</td>').join('')}
                <td>${escapeHtml(formatScore(academicTotals.totalObtained))}</td>
                <td>${escapeHtml(`${formatScore(academicTotals.percentage)}%`)}</td>
                <td>${escapeHtml(academicTotals.grade)}</td>
              </tr>
            </tbody>
          </table>

          <div class="section">Attendance Record</div>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Total Days</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>${attendanceRowHtml}</tbody>
          </table>

          <div class="section">Behaviour Record</div>
          <table>
            <thead><tr><th>Area</th><th>Percentage</th></tr></thead>
            <tbody>${behaviourRowsHtml}</tbody>
          </table>

          <div class="section">Remarks</div>
          <table>
            <thead><tr><th>Type</th><th class="left">Comment</th></tr></thead>
            <tbody>${remarkRowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handleDownloadReport = async () => {
    try {
      if (typeof generatePDF !== 'function') {
        Alert.alert('Download unavailable', 'PDF module is not available in this build.');
        return;
      }

      setDownloading(true);
      const safeName =
        String(studentData.name || 'Student')
          .replace(/[^a-z0-9]+/gi, '_')
          .replace(/^_+|_+$/g, '') || 'Student';

      const html = buildReportCardHtml();
      const file = await generatePDF({
        html,
        fileName: `${safeName}_Report_Card`,
        directory: 'Documents',
      });

      Alert.alert('Report downloaded', `PDF saved to: ${file.filePath || 'Documents'}`);
    } catch (error) {
      console.error('Failed to create report card PDF:', error);
      const errorMessage =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message || '')
          : '';
      Alert.alert(
        'Download failed',
        errorMessage ? `Unable to create the report card PDF.\n${errorMessage}` : 'Unable to create the report card PDF.',
      );
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingSafeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#244F8F" />
          <Text style={styles.loadingText}>Loading report card...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="assessment" size={22} color="#244F8F" />
            <View style={styles.cardHeaderTextWrap}>
              <Text style={styles.cardTitle}>Report Card</Text>
              <Text style={styles.cardSubtitle}>Academic marks, attendance, student details and behaviour</Text>
            </View>
            <Pressable
              style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
              onPress={handleDownloadReport}
              disabled={downloading}
            >
              <MaterialIcons name="file-download" size={16} color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>{downloading ? 'Saving' : 'Download'}</Text>
            </Pressable>
          </View>

          {/* --- Student Info Section --- */}
          <View style={styles.topPanel}>
            <View style={styles.studentInfoWrap}>
              <Text style={styles.schoolCode}>{String(studentData.schoolCode || '').toUpperCase() || 'STUDENT'}</Text>
              <Text style={styles.reportHeading}>ANNUAL PROGRESS REPORT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.detailsScrollContent}>
                <View style={styles.detailsTable}>
                  {studentDetailRows.map((row, rowIndex) => (
                    <View key={`detail-row-${rowIndex}`} style={styles.detailsRow}>
                      {row.map((item, itemIndex) => (
                        <React.Fragment key={`${item.label}-${itemIndex}`}>
                          <View style={[styles.detailsLabelCell, itemIndex > 0 && styles.detailsLabelCellSpaced]}>
                            <Text style={styles.detailsLabelText}>{item.label}</Text>
                          </View>
                          <View
                            style={[
                              styles.detailsValueCell,
                              itemIndex > 0 && styles.detailsValueCellJoined,
                              item.label === 'Address' && styles.detailsAddressValueCell,
                            ]}
                          >
                            <Text style={styles.detailsValueText} numberOfLines={1}>
                              {item.value}
                            </Text>
                          </View>
                        </React.Fragment>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.photoWrap}>
              <View style={styles.photoBox}>
                {studentData.photoUrl ? (
                  <Image source={{ uri: studentData.photoUrl }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <View style={styles.photoFallback}>
                    <MaterialIcons name="person" size={28} color="#6B7280" />
                    <Text style={styles.photoFallbackText}>Student</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* --- Academic Performance Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Academic Performance</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, styles.subjectColumn]}>Subject</Text>
                  {termRows.map((row) => (
                    <Text key={row.key} style={styles.tableHeaderCell}>{row.label}</Text>
                  ))}
                  <Text style={styles.tableHeaderCell}>Marks</Text>
                  <Text style={styles.tableHeaderCell}>%</Text>
                  <Text style={styles.tableHeaderCell}>Grade</Text>
                </View>
                {academicRows.map((row) => (
                  <View key={row.subjectName} style={styles.tableBodyRow}>
                    <Text style={[styles.tableBodyCell, styles.subjectColumn]}>{row.subjectName}</Text>
                    {row.marks.map((mark, index) => (
                      <Text key={`${row.subjectName}-${index}`} style={styles.tableBodyCell}>{String(mark)}</Text>
                    ))}
                    <Text style={styles.tableBodyCell}>{formatScore(row.totalObtained)}</Text>
                    <Text style={styles.tableBodyCell}>{formatScore(row.percentage)}%</Text>
                    <Text style={styles.tableBodyCell}>{row.grade}</Text>
                  </View>
                ))}
                <View style={styles.tableFooterRow}>
                  <Text style={[styles.tableFooterCell, styles.subjectColumn]}>Overall Report</Text>
                  {termRows.map((row) => (
                    <Text key={`total-${row.key}`} style={styles.tableFooterCell}>-</Text>
                  ))}
                  <Text style={styles.tableFooterCell}>{formatScore(academicTotals.totalObtained)}</Text>
                  <Text style={styles.tableFooterCell}>{formatScore(academicTotals.percentage)}%</Text>
                  <Text style={styles.tableFooterCell}>{academicTotals.grade}</Text>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* --- Attendance Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendance Record</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.tableHeaderCell}>Month</Text>
                  <Text style={styles.tableHeaderCell}>Total Days</Text>
                  <Text style={styles.tableHeaderCell}>Present</Text>
                  <Text style={styles.tableHeaderCell}>Informed</Text>
                  <Text style={styles.tableHeaderCell}>Uninformed</Text>
                  <Text style={styles.tableHeaderCell}>Percentage</Text>
                </View>
                {attendanceRows.map((row) => (
                  <View key={row.label} style={styles.tableBodyRow}>
                    <Text style={styles.tableBodyCell}>{row.label}</Text>
                    <Text style={styles.tableBodyCell}>{row.totalDays}</Text>
                    <Text style={styles.tableBodyCell}>{row.present}</Text>
                    <Text style={styles.tableBodyCell}>{row.informed}</Text>
                    <Text style={styles.tableBodyCell}>{row.uninformed}</Text>
                    <Text style={styles.tableBodyCell}>{formatScore(row.percentage)}%</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.attendanceSummaryRow}>
              <View style={styles.summaryPill}>
                <Text style={styles.summaryPillText}>
                  Present {formatScore(attendanceStats.presentPercentage)}%
                </Text>
              </View>
              <View style={styles.summaryPill}>
                <Text style={styles.summaryPillText}>
                  Absent {formatScore(attendanceStats.absentPercentage)}%
                </Text>
              </View>
            </View>
          </View>

          {/* --- Behaviour Section --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Behaviour Record</Text>
            <View style={styles.behaviourRow}>
              {behaviourRows.map((item) => (
                <View key={item.label} style={styles.behaviourCard}>
                  <Text style={styles.behaviourLabel}>{item.label}</Text>
                  <Text style={styles.behaviourValue}>{formatScore(Number(item.value))}%</Text>
                </View>
              ))}
            </View>

            <Text style={styles.commentsTitle}>Remarks</Text>
            {behaviourComments.length ? (
              behaviourComments.map((item, index) => (
                <View key={`${item.type}-${index}`} style={styles.commentRow}>
                  <Text style={styles.commentType}>{item.type}</Text>
                  <Text style={styles.commentText}>{item.comment || '-'}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No behaviour remarks available.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles (Unchanged) ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' },
  loadingSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
  contentContainer: { padding: 14, paddingBottom: 28 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#4B5563', fontWeight: '600' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D8E1EE',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardHeaderTextWrap: { marginLeft: 10, flex: 1 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#1F3F73' },
  cardSubtitle: { marginTop: 4, color: '#6B7280', fontSize: 12.5 },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#244F8F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  downloadButtonDisabled: {
    backgroundColor: '#93A9C8',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 6,
  },
  topPanel: {
    borderWidth: 1,
    borderColor: '#AFC4E3',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#FBFDFF',
    marginBottom: 16,
  },
  studentInfoWrap: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  schoolCode: { textAlign: 'center', fontWeight: '900', fontSize: 16, color: '#24508D' },
  reportHeading: { textAlign: 'center', marginTop: 2, marginBottom: 12, color: '#4B6792', fontWeight: '800' },
  detailsScrollContent: { paddingBottom: 4 },
  detailsTable: { minWidth: 700 },
  detailsRow: { flexDirection: 'row', marginBottom: 8 },
  detailsLabelCell: {
    width: 110,
    borderWidth: 1,
    borderColor: '#C7D5EB',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: '#EFF5FC',
  },
  detailsLabelCellSpaced: {
    marginLeft: 8,
  },
  detailsValueCell: {
    width: 120,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: '#C7D5EB',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  detailsValueCellJoined: {
    borderLeftWidth: 0,
  },
  detailsAddressValueCell: {
    width: 180,
  },
  detailsLabelText: { fontSize: 12, color: '#24508D', fontWeight: '800' },
  detailsValueText: { fontSize: 12, color: '#23334F', fontWeight: '600' },
  photoWrap: {
    width: 112,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  photoBox: {
    width: 104,
    height: 132,
    borderWidth: 1,
    borderColor: '#BFD0EA',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  photo: { width: '100%', height: '100%' },
  photoFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoFallbackText: { marginTop: 4, color: '#6B7280', fontSize: 11, fontWeight: '700' },
  section: {
    borderWidth: 1,
    borderColor: '#C9D7EC',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    backgroundColor: '#EDF3FB',
    color: '#24508D',
    fontWeight: '800',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#3E67A4' },
  tableBodyRow: { flexDirection: 'row', backgroundColor: '#FFFFFF' },
  tableFooterRow: { flexDirection: 'row', backgroundColor: '#F4F7FB' },
  tableHeaderCell: {
    width: 86,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderColor: '#6386B7',
  },
  tableBodyCell: {
    width: 86,
    color: '#23334F',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D5E0EE',
  },
  tableFooterCell: {
    width: 86,
    color: '#1E2F4D',
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: '#D5E0EE',
  },
  subjectColumn: { width: 140 },
  attendanceSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 },
  summaryPill: {
    backgroundColor: '#EEF4FB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  summaryPillText: { color: '#23406E', fontWeight: '700', fontSize: 12 },
  behaviourRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'space-between' },
  behaviourCard: {
    width: '31%',
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#D6E2F1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  behaviourLabel: { color: '#4B6792', fontSize: 12, fontWeight: '700' },
  behaviourValue: { marginTop: 6, color: '#1F3F73', fontSize: 20, fontWeight: '900' },
  commentsTitle: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 8,
    color: '#24508D',
    fontWeight: '800',
    fontSize: 14,
  },
  commentRow: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E1E8F2',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  commentType: { color: '#24508D', fontWeight: '800', fontSize: 12, marginBottom: 4 },
  commentText: { color: '#374151', fontSize: 12.5, lineHeight: 18 },
  emptyText: { paddingHorizontal: 12, paddingBottom: 12, color: '#6B7280', fontSize: 12.5 },
});

export default ParentReports;