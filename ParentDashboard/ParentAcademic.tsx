import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import LinearGradient from 'react-native-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { createAppStyles } from '../App.styles';
import { ErrorContext } from '../ErrorContext';
import { RootStackParamList } from '../types';
import ParentFooter from './ParentFooter';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentAcademic'>;
type AcademicViewProps = Props & { embedded?: boolean };

interface AcademicSubject {
  name?: string;
  subject?: string;
  subject_name?: string;
  title?: string;
  label?: string;
  FA?: Array<number | string | null>;
  SA?: Array<number | string | null>;
  tests?: Record<
    string,
    { obtained?: number | string | null; max?: number | string | null }
  >;
}

interface TermRow {
  key: string;
  label: string;
}

interface TrendPoint {
  key: string;
  label: string;
  value: number | null;
}

const getSubjectDisplayName = (subject: AcademicSubject, index: number) =>
  subject.name ||
  subject.subject ||
  subject.subject_name ||
  subject.title ||
  subject.label ||
  `Subject ${index + 1}`;

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

const getTermMark = (subject: AcademicSubject, rowKey: string) => {
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

const getTermMax = (subject: AcademicSubject, rowKey: string) => {
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

const buildTrendPoints = (
  performance: AcademicSubject[],
  termRows: TermRow[],
): TrendPoint[] =>
  termRows.map((term) => {
    let obtained = 0;
    let total = 0;

    performance.forEach((subject) => {
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

const getSubjectTrendKey = (subject: AcademicSubject, index: number) =>
  String(
    subject.name ||
      subject.subject ||
      subject.subject_name ||
      subject.title ||
      subject.label ||
      `Subject ${index + 1}`,
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

const computeAcademicSummary = (
  performance: AcademicSubject[],
  testTypes: any[],
) => {
  if (!performance.length) return { grade: '-', percentage: '0.00' };
  const termRows = buildTermRows(testTypes);

  let obtained = 0;
  let total = 0;

  performance.forEach(subj => {
    termRows.forEach(row => {
      const mark = getTermMark(subj, row.key);
      const maxMark = getTermMax(subj, row.key);
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
  performance: AcademicSubject[],
  rowKey: string,
  testTypes: any[],
) => {
  if (!performance.length || !rowKey) return { grade: '-', percentage: '0.00' };
  const termRows = buildTermRows(testTypes);

  const matchedRow = termRows.find((row: any) => row.key === rowKey);
  if (!matchedRow) return { grade: '-', percentage: '0.00' };

  let obtained = 0;
  let total = 0;

  performance.forEach((subj) => {
    const mark = getTermMark(subj, matchedRow.key);
    const maxMark = getTermMax(subj, matchedRow.key);
    const numericMark = Number(mark);
    const numericMax = Number(maxMark);

    if (
      mark !== '-' &&
      mark !== null &&
      mark !== undefined &&
      !Number.isNaN(numericMark) &&
      numericMax > 0
    ) {
      obtained += numericMark;
      total += numericMax;
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

const ParentAcademic: React.FC<AcademicViewProps> = ({
  navigation: _navigation,
  embedded = false,
}) => {
  const { height, width } = useWindowDimensions();
  const appStyles = useMemo(
    () => createAppStyles({ phoneWidth: width, phoneHeight: height }),
    [height, width],
  );
  const [studentData, setStudentData] = useState<Record<string, any> | null>(
    null,
  );
  const [performance, setPerformance] = useState<AcademicSubject[]>([]);
  const [testTypes, setTestTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendSubjectKey, setTrendSubjectKey] = useState('__all__');
  const { showError } = React.useContext(ErrorContext);

  useEffect(() => {
    const loadStudentData = async () => {
      try {
        const keys = [
          'studentId',
          'username',
          'name',
          'class_name',
          'section',
          'schoolCode',
        ];
        const stores = await AsyncStorage.multiGet(keys);
        const data: Record<string, any> = {};
        stores.forEach(([key, value]) => {
          if (value) data[key] = value;
        });
        setStudentData(data);
      } catch {
        showError('Data Error', 'Failed to load student information.');
      }
    };

    loadStudentData();
  }, [showError]);

  useEffect(() => {
    let isMounted = true;

    const fetchPerformance = async () => {
      setLoading(true);
      try {
        if (
          !studentData?.name ||
          !studentData?.class_name ||
          !studentData?.section
        ) {
          setPerformance([]);
          setTestTypes([]);
          return;
        }

        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
        const schoolCode = studentData?.schoolCode || storedSchoolCode || '';

        if (!schoolCode) {
          setPerformance([]);
          setTestTypes([]);
          return;
        }

        const res = await axios.post(
          'https://cleezoclass.com:4000/api/overall/academic-performance',
          {
            name: studentData.name,
            class_name: studentData.class_name,
            section: studentData.section,
            schoolCode,
          },
        );

        if (!isMounted) return;

        if (Array.isArray(res.data)) {
          setPerformance(res.data || []);
          setTestTypes([]);
        } else {
          setPerformance(
            Array.isArray(res.data?.performance) ? res.data.performance : [],
          );
          setTestTypes(
            Array.isArray(res.data?.testTypes) ? res.data.testTypes : [],
          );
        }
      } catch {
        if (isMounted) {
          showError(
            'Academic Performance Error',
            'Unable to load academic data.',
          );
          setPerformance([]);
          setTestTypes([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPerformance();
    return () => {
      isMounted = false;
    };
  }, [
    studentData?.name,
    studentData?.class_name,
    studentData?.section,
    studentData?.schoolCode,
    showError,
  ]);

  const summary = computeAcademicSummary(performance, testTypes);
  const termRowsForSummary = useMemo(() => buildTermRows(testTypes), [testTypes]);
  const previousTestRow = termRowsForSummary[termRowsForSummary.length - 1];
  const previousTestSummary = computeTestSummary(performance, previousTestRow?.key, testTypes);
  const subjectOptions = useMemo(
    () =>
      performance.map((subject, index) => ({
        key: getSubjectTrendKey(subject, index),
        label: getSubjectDisplayName(subject, index),
      })),
    [performance],
  );
  const selectedSubjectRow = useMemo(() => {
    if (trendSubjectKey === '__all__') return null;
    const matchedIndex = performance.findIndex(
      (subject, index) => getSubjectTrendKey(subject, index) === trendSubjectKey,
    );
    return matchedIndex >= 0 ? performance[matchedIndex] : null;
  }, [performance, trendSubjectKey]);
  const chartPoints = buildTrendPoints(
    selectedSubjectRow ? [selectedSubjectRow] : performance,
    termRowsForSummary,
  );
  const chartLabels = chartPoints.map(point => point.label);
  const chartData = chartPoints.map(point => point.value ?? 0);
  const chartWidth = Math.max(width - 48, chartPoints.length * 72);
  const selectedSubjectName = selectedSubjectRow
    ? getSubjectDisplayName(
        selectedSubjectRow,
        performance.findIndex((subject) => subject === selectedSubjectRow),
      )
    : 'All Subjects';

  const getDisplayMark = (subj: AcademicSubject, row: any) => {
    const testEntry = subj?.tests?.[row?.key];
    if (testEntry?.obtained !== null && testEntry?.obtained !== undefined) {
      return testEntry.obtained;
    }

    const match = String(row?.key || '')
      .toUpperCase()
      .match(/^(FA|SA)(\d+)$/);
    if (!match) return '-';
    const type = match[1];
    const index = Number(match[2]) - 1;
    const mark = type === 'FA' ? subj?.FA?.[index] : subj?.SA?.[index];
    return mark ?? '-';
  };

  const selectedSubjectTestRows = useMemo(() => {
    if (!selectedSubjectRow) return [];

    return termRowsForSummary.map((row) => {
      const obtainedRaw = getDisplayMark(selectedSubjectRow, row);
      const obtained = Number(obtainedRaw);
      const max = getTermMax(selectedSubjectRow, row.key);
      const percentage = max > 0 && !Number.isNaN(obtained) ? Math.max(0, Math.min(100, (obtained / max) * 100)) : 0;

      return {
        key: row.key,
        label: row.label,
        obtained: Number.isNaN(obtained) ? obtainedRaw : obtained,
        max,
        percentage,
      };
    });
  }, [selectedSubjectRow, termRowsForSummary]);

  if (loading || !studentData) {
    return (
      <View style={embedded ? styles.embeddedShell : styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111" />
          <Text style={styles.loadingText}>Loading academic data...</Text>
        </View>
      </View>
    );
  }

  const content = (
    <View style={embedded ? styles.embeddedContent : styles.content}>
      <LinearGradient
        colors={['#d2c2eeff', '#BFD7FA', '#F6F8FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.academicGradientSection}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftColumn}>
            <Text style={styles.title}>Academic</Text>
            
          </View>
        </View>

        <View style={styles.academicGraphSection}>
          <View style={styles.trendSelectorWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendSelectorChips}
            >
              <TouchableOpacity
                style={[
                  styles.trendChip,
                  trendSubjectKey === '__all__' && styles.trendChipActive,
                ]}
                onPress={() => setTrendSubjectKey('__all__')}
              >
                <Text
                  style={[
                    styles.trendChipText,
                    trendSubjectKey === '__all__' && styles.trendChipTextActive,
                  ]}
                >
                  All Subjects
                </Text>
              </TouchableOpacity>

              {subjectOptions.map((subject) => (
                <TouchableOpacity
                  key={subject.key}
                  style={[
                    styles.trendChip,
                    trendSubjectKey === subject.key && styles.trendChipActive,
                  ]}
                  onPress={() => setTrendSubjectKey(subject.key)}
                >
                  <Text
                    style={[
                      styles.trendChipText,
                      trendSubjectKey === subject.key && styles.trendChipTextActive,
                    ]}
                  >
                    {subject.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* <View style={styles.trendActiveTitleRow}>
            <Text style={styles.trendActiveTitle}>{activeTrendTitle}</Text>
            {chartPoints.length >= 2 &&
            chartPoints[chartPoints.length - 1].value !== null &&
            chartPoints[0].value !== null ? (
              <Text
                style={[
                  styles.trendOverallDiffValue,
                  (chartPoints[chartPoints.length - 1].value ?? 0) >
                  (chartPoints[0].value ?? 0)
                    ? styles.trendStatDiffUp
                    : (chartPoints[chartPoints.length - 1].value ?? 0) <
                      (chartPoints[0].value ?? 0)
                    ? styles.trendStatDiffDown
                    : styles.trendStatDiffFlat,
                ]}
              >
                {(
                  (chartPoints[chartPoints.length - 1].value ?? 0) -
                  (chartPoints[0].value ?? 0)
                ) > 0
                  ? '+'
                  : ''}
                {Number(
                  (
                    (chartPoints[chartPoints.length - 1].value ?? 0) -
                    (chartPoints[0].value ?? 0)
                  ).toFixed(2),
                )}
                %
              </Text>
            ) : null}
          </View> */}

          <Text style={styles.academicGraphExplain}>
            This line shows the average score in each test. A higher line means better performance.
          </Text>

          {/* <View style={styles.academicLegendRow}>
            <View style={styles.academicLegendItem}>
              <View style={[styles.academicLegendDot, { backgroundColor: '#F36B79' }]} />
              <Text style={styles.academicLegendText}>Average test score</Text>
            </View>
            <View style={styles.academicLegendItem}>
              <View style={[styles.academicLegendDot, { backgroundColor: '#E9E9EE' }]} />
              <Text style={styles.academicLegendText}>Each point is one test</Text>
            </View>
          </View> */}

          {chartPoints.length < 2 ? (
            <View style={styles.academicGraphEmpty}>
              <Text style={styles.academicGraphEmptyTitle}>Not enough test data yet</Text>
              <Text style={styles.academicGraphEmptyText}>
                Add at least two tests to see how performance changes over time.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: chartLabels,
                  datasets: [
                    {
                      data: chartData,
                      color: opacity => `rgba(243, 107, 121, ${opacity})`,
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
                  backgroundColor: '#FFFFFF',
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#FFFFFF',
                  decimalPlaces: 1,
                  color: opacity => `rgba(243, 107, 121, ${opacity})`,
                  fillShadowGradientFrom: 'rgba(243, 107, 121, 0.55)',
                  fillShadowGradientTo: 'rgba(243, 107, 121, 0.08)',
                  fillShadowGradientOpacity: 1,
                  labelColor: () => '#7A7A80',
                  propsForDots: {
                    r: '5',
                    strokeWidth: '2',
                    stroke: '#F36B79',
                  },
                  propsForBackgroundLines: {
                    stroke: '#E9E9EE',
                    strokeDasharray: '',
                  },
                }}
                style={styles.academicChartPlain}
              />
            </ScrollView>
          )}
        </View>
      </LinearGradient>

      <View style={styles.summaryRowTop}>
        <View style={[appStyles.dashboardGridCard1, styles.summaryCardLeft]}>
          <View style={appStyles.dashboardGridCornerAccent} />
          <View style={appStyles.gridIconWrap1}>
            <MaterialIcons name="school" size={44} color="#000000" />
          </View>
          <View style={appStyles.dashboardGridCardContent1}>
            <View style={appStyles.dashboardGridTextBlock}>
              <Text style={appStyles.gridLabel}>Overall</Text>
              <Text style={appStyles.dashboardGridMetaLabel}>{summary.grade}</Text>
              <Text style={appStyles.dashboardGridMetaValue}>{summary.percentage}%</Text>
            </View>
          </View>
        </View>

        <View style={[appStyles.dashboardGridCard1, styles.summaryCardRight]}>
          <View style={appStyles.dashboardGridCornerAccent} />
          <View style={appStyles.gridIconWrap1}>
            <MaterialIcons name="quiz" size={40} color="#000000" />
          </View>
          <View style={appStyles.dashboardGridCardContent1}>
            <View style={appStyles.dashboardGridTextBlock}>
              <Text style={appStyles.gridLabel}>Previous Test</Text>
              <Text style={appStyles.dashboardGridMetaLabel}>{previousTestSummary.grade}</Text>
              <Text style={appStyles.dashboardGridMetaValue}>
                {previousTestRow?.label || 'Last test'}
              </Text>
            </View>
          </View>
        </View>
      </View>



      {performance.length === 0 ? (
        <Text style={styles.emptyText}>No academic data.</Text>
      ) : (
        <View
          style={[
            styles.subjectsPanel,
            embedded && styles.embeddedSubjectsPanel,
          ]}
        >
          <Text style={styles.selectedSubjectHeading}>
            {trendSubjectKey === '__all__' ? 'All Subjects' : selectedSubjectName}
          </Text>
          <Text style={styles.selectedSubjectSubheading}>
            {trendSubjectKey === '__all__'
              ? 'Tap any subject above to see its test-wise performance.'
              : 'Test-wise breakdown for the selected subject.'}
          </Text>

          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.subjectsScroll}
            contentContainerStyle={styles.subjectsScrollContent}
          >
            {trendSubjectKey === '__all__' ? (
              performance.map((subject, index) => (
                <View
                  key={`${subject.name || 'subj'}-${index}`}
                  style={[
                    styles.subjectCard,
                    {
                      backgroundColor: index % 2 === 0 ? '#FFF9FB' : '#F7FBFF',
                      borderLeftColor: ['#EF6574', '#4AC8D8', '#7A3FC5', '#F2D84A'][index % 4],
                    },
                  ]}
                >
                  <Text style={styles.subjectTitle}>
                    {getSubjectDisplayName(subject, index)}
                  </Text>
                  <View style={styles.rowHeader}>
                    {termRowsForSummary.map((row: any) => (
                      <Text key={row.key} style={styles.cellHeader}>
                        {row.label}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.rowData}>
                    {termRowsForSummary.map((row: any) => (
                      <View key={row.key} style={styles.cell}>
                        <Text style={styles.cellText}>
                          {String(getDisplayMark(subject, row))}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : selectedSubjectRow ? (
              <View
                style={[
                  styles.subjectCard,
                  {
                    backgroundColor: '#FFF9FB',
                    borderLeftColor: '#7A3FC5',
                  },
                ]}
              >
              <Text style={styles.subjectTitle}>
                  {selectedSubjectName}
                </Text>
                <Text style={styles.subjectTestGraphCaption}>
                  Each row shows the test type on the left and the score graph on the right.
                </Text>
                <View style={styles.subjectTestList}>
                  {selectedSubjectTestRows.map((item) => {
                    const scoreText = `${String(item.obtained)} / ${item.max}`;
                    return (
                      <View key={item.key} style={styles.subjectTestRow}>
                        <View style={styles.subjectTestInfo}>
                          <Text style={styles.subjectTestLabel} numberOfLines={1}>
                            {item.label}
                          </Text>
                          <Text style={styles.subjectTestScore}>{scoreText}</Text>
                        </View>

                        <View style={styles.subjectTestGraphWrap}>
                          <View style={styles.subjectTestTrack}>
                            <LinearGradient
                              colors={['#a57aef', '#a174eb', '#6826df']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[
                                styles.subjectTestFill,
                                {
                                  width: `${Math.max(item.percentage, 8)}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      )}

      <ParentFooter embedded={embedded} />
    </View>
  );

  return embedded ? (
    <View style={styles.embeddedCard}>{content}</View>
  ) : (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0D3F66" translucent={false} />
      {content}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f6f7' },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerLeftColumn: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  backRow: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#111' },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
    flexShrink: 1,
  },
  backBtn: {
    backgroundColor: '#404040',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },
  academicGradientSection: {
    marginTop: 0,
    marginBottom: 12,
    marginHorizontal: -16,
    paddingTop: 16,
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  academicGraphSection: {
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  academicGraphExplain: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#444',
    marginBottom: 8,
  },
  selectedSubjectHeading: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 2,
  },
  selectedSubjectSubheading: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#6B7280',
    marginBottom: 10,
  },
  academicLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  academicLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  academicLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 6,
  },
  academicLegendText: {
    fontSize: 11.5,
    color: '#333',
    fontWeight: '700',
    flexShrink: 1,
  },
  academicChartPlain: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  academicGraphEmpty: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  academicGraphEmptyTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  academicGraphEmptyText: {
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  embeddedShell: { padding: 0 },
  embeddedHeader: { marginBottom: 12 },
  embeddedTitle: { fontSize: 22, fontWeight: '800', color: '#111' },
  embeddedCard: { marginHorizontal: 0 },
  embeddedContent: { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 18,
    marginBottom: 16,
  },
  summaryLabelPlain: { fontSize: 12, color: '#666', fontWeight: '700' },
  summaryLabel: { fontSize: 12, color: '#666', fontWeight: '700' },
  grade: { fontSize: 40, fontWeight: '800', color: '#111', marginTop: 8 },
  percent: { fontSize: 16, color: '#444', marginTop: 4 },
  gradeCompact: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: '#191919',
    marginTop: 4,
    textAlign: 'center',
  },
  percentCompact: {
    fontSize: 14,
    color: '#444',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '700',
  },
  graphBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111',
  },
  graphBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  graphBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  overallSummaryPlain: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom:10,
  },
  summaryRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  summaryCardLeft: {
    marginRight: 8,
  },
  summaryCardRight: {
    marginLeft: 8,
  },
  subjectsPanel: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fff',
    padding: 12,
    marginBottom: 12,
    flex: 1,
    minHeight: 0,
    marginTop: 0,
    paddingTop: 0,
  },
  embeddedSubjectsPanel: {
    padding: 0,
    flex: 1,
  },
  subjectsScroll: {
    flex: 1,
    minHeight: 0,
  },
  subjectsScrollContent: {
    paddingBottom: 4,
  },
  subjectCard: {
    backgroundColor: '#f6f6f7',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e5e7',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
    borderLeftWidth: 5,
    padding: 14,
    marginBottom: 12,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },
  subjectTestGraphCaption: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  subjectTestLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7A3FC5',
    marginBottom: 4,
  },
  subjectTestScore: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },
  subjectTestList: {
    gap: 10,
  },
  subjectTestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEAF9',
  },
  subjectTestInfo: {
    width: 88,
    flexShrink: 0,
  },
  subjectTestGraphWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  subjectTestTrack: {
    width: '100%',
    height: 14,
    borderRadius: 999,
    backgroundColor: '#ECE8F7',
    overflow: 'hidden',
  },
  subjectTestFill: {
    height: '100%',
    borderRadius: 999,
  },
  rowHeader: { flexDirection: 'row', marginBottom: 8 },
  rowData: { flexDirection: 'row' },
  cellHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#666',
    fontWeight: '700',   
  },
  cell: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 8,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  cellText: { fontSize: 12, fontWeight: '700', color: '#111' },
  cellSubText: { marginTop: 2, fontSize: 10, color: '#6B7280', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#555' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  trendModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  trendModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f3',
  },
  trendModalHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  trendModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  trendModalSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  trendCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  trendCloseBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  trendModalContent: {
    padding: 16,
    gap: 14,
  },
  trendSelectorWrap: {
    gap: 8,
  },
  trendSelectorLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475467',
  },
  trendSelectorChips: {
    gap: 8,
    paddingRight: 8,
  },
  trendChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f2f4f7',
    borderWidth: 1,
    borderColor: '#e4e7ec',
  },
  trendChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  trendChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#344054',
  },
  trendChipTextActive: {
    color: '#fff',
  },
  trendActiveTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  trendActiveTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  trendEmptyState: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  trendEmptyText: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  trendChartWrap: {
    borderRadius: 16,
    backgroundColor: '#fbfbfc',
    borderWidth: 1,
    borderColor: '#eef0f3',
    paddingVertical: 10,
  },
  trendChart: {
    borderRadius: 16,
  },
  trendTransitions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendTransition: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  trendTransitionUp: {
    color: '#16803c',
    backgroundColor: '#f1fcf5',
    borderColor: '#b7ebc6',
  },
  trendTransitionDown: {
    color: '#b42318',
    backgroundColor: '#fff4f6',
    borderColor: '#fdccd3',
  },
  trendTransitionFlat: {
    color: '#475467',
    backgroundColor: '#f8fafc',
    borderColor: '#d0d5dd',
  },
  trendStatDiffUp: {
    color: '#16803c',
  },
  trendStatDiffDown: {
    color: '#b42318',
  },
  trendStatDiffFlat: {
    color: '#667085',
  },
  trendOverallDiffValue: {
    fontSize: 14,
    fontWeight: '800',
  },
});

export default ParentAcademic;
