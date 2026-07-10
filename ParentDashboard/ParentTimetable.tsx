import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { BarChart } from 'react-native-chart-kit';
import LinearGradient from 'react-native-linear-gradient';

import { createAppStyles } from '../App.styles';
import { RootStackParamList } from '../types';
import { ErrorContext } from '../ErrorContext';
import ParentFooter from './ParentFooter';

const ParentTimetable: React.FC<
  NativeStackScreenProps<RootStackParamList, 'ParentTimetable'>
  & { embedded?: boolean }
> = ({ embedded = false }) => {
  const { height, width } = useWindowDimensions();
  const appStyles = useMemo(
    () => createAppStyles({ phoneWidth: width, phoneHeight: height }),
    [height, width],
  );
  const [studentData, setStudentData] = useState<any>(null);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useContext(ErrorContext);

  useEffect(() => {
    const loadStudent = async () => {
      try {
        const keys = ['studentId', 'name', 'class_name', 'section', 'schoolCode', 'username'];
        const stores = await AsyncStorage.multiGet(keys);
        const data: any = {};
        stores.forEach(([key, value]) => {
          if (value) data[key] = value;
        });
        setStudentData(data);
      } catch (error) {
        console.error('Failed to load student data:', error);
      }
    };

    loadStudent();
  }, []);

useEffect(() => {
    const fetchTT = async () => {
      try {
        if (!studentData?.class_name || !studentData?.section || !studentData?.schoolCode) {
          console.warn('ParentTimetable: Missing student credentials for fetch');
          setLoading(false);
          return;
        }

        const url = `http://162.215.210.38:3010/api/parent-timetable?class_id=${encodeURIComponent(studentData.class_name)}&section_id=${encodeURIComponent(studentData.section)}&schoolCode=${encodeURIComponent(studentData.schoolCode)}`;
        
        console.log('ParentTimetable: Fetching from URL:', url);
        
        const res = await axios.get(url);
        
        // Log the raw response from the API
        console.log('ParentTimetable: API Response data:', res.data);
        
        const data = res.data.timetable || [];

    const dayMap: any = {};
data.forEach((item: any) => {
  dayMap[item.day] = {
    day: item.day,

    // Store interval timings
    morningInterval: item.morningInterval,
    lunchInterval: item.lunchInterval,
    afternoonInterval: item.afternoonInterval,
    eveningInterval: item.eveningInterval,

    periods: item.periods || {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    },
  };
});
        const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const sortedData = Object.values(dayMap).sort(
          (a: any, b: any) => daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day)
        );

        console.log('ParentTimetable: Processed sorted data:', sortedData);
        setTimetable(sortedData);
      } catch (error) {
        // Log detailed error for debugging
        console.error('ParentTimetable: Error fetching timetable:', error);
        showError('Timetable Error', 'Unable to load timetable. Please try again.');
        setTimetable([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTT();
  }, [studentData, showError]);

const getSortedPeriods = (row: any) => {
    const allPeriods: any[] = [];

    // 1. Gather real periods and filter out 00:00:00 dummy entries
    const rawPeriods = [
      ...(row.periods?.morning || []),
      ...(row.periods?.afternoon || []),
      ...(row.periods?.evening || []),
      ...(row.periods?.night || []),
    ];

    rawPeriods.forEach((p: any) => {
      if (p.fromTime !== '00:00:00' || p.toTime !== '00:00:00') {
        allPeriods.push(p);
      }
    });

    // 2. Inject intervals if they exist and are not '00:00:00'
    const intervals = [
      { time: row.morningInterval, label: 'Morning Break' },
      { time: row.lunchInterval, label: 'Lunch Break' },
      { time: row.afternoonInterval, label: 'Afternoon Break' },
      { time: row.eveningInterval, label: 'Evening Break' },
    ];

    intervals.forEach((interval) => {
      if (interval.time && interval.time !== '00:00:00') {
        allPeriods.push({
          subject: interval.label,
          fromTime: interval.time,
          toTime: interval.time, // Represented as a milestone timestamp
          isInterval: true,      // Flag to style it differently if needed
        });
      }
    });

    // 3. Deduplicate (just in case)
    const uniqueMap = new Map();
    allPeriods.forEach((period: any) => {
      const key = `${period.fromTime}-${period.toTime}-${period.subject}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, period);
    });

    // 4. Sort strictly chronologically by start time
    return Array.from(uniqueMap.values()).sort((a: any, b: any) =>
      String(a.fromTime).localeCompare(String(b.fromTime))
    );
  };
  const maxPeriods = Math.max(
    10,
    ...timetable.map((row) => getSortedPeriods(row).length),
  );
  const periodHeaders = timetable.length > 0 ? getSortedPeriods(timetable[0]) : [];
  const rowLabelWidth = 88;
  const periodCellWidth = 110;
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayRow = timetable.find(
    (row) => String(row.day || '').toLowerCase() === todayName.toLowerCase(),
  );
  const todayPeriods = todayRow ? getSortedPeriods(todayRow) : [];
  const nowMinutes = (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })();
  const parseTimeToMinutes = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return Number.MAX_SAFE_INTEGER;
    const [hh = '', mm = ''] = raw.split(':');
    const hours = Number(hh);
    const mins = Number(mm);
    if (Number.isNaN(hours) || Number.isNaN(mins)) return Number.MAX_SAFE_INTEGER;
    return hours * 60 + mins;
  };
  const nextPeriodToday = todayPeriods.find(
    (period) => parseTimeToMinutes(period.fromTime) > nowMinutes,
  );
  const currentDayIndex = dayOrder.findIndex(
    (day) => day.toLowerCase() === todayName.toLowerCase(),
  );
  const upcomingDays = [
    ...dayOrder.slice(currentDayIndex + 1),
    ...dayOrder.slice(0, Math.max(currentDayIndex, 0)),
  ];
  const nextDayRow = upcomingDays
    .map((day) => timetable.find((row) => String(row.day || '').toLowerCase() === day.toLowerCase()))
    .find((row) => row && getSortedPeriods(row).length > 0);
  const nextPeriod = nextPeriodToday || (nextDayRow ? getSortedPeriods(nextDayRow)[0] : null);
  const nextPeriodDay = nextPeriodToday ? todayName : nextDayRow?.day || '';
  const subjectFrequencyMap = new Map<string, number>();
  timetable.forEach((row) => {
    getSortedPeriods(row).forEach((period: any) => {
      const subject = String(period?.subject || '--').trim() || '--';
      subjectFrequencyMap.set(subject, (subjectFrequencyMap.get(subject) || 0) + 1);
    });
  });
  const subjectFrequencyEntries = Array.from(subjectFrequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const timetableGraphLabels = subjectFrequencyEntries.map(([subject]) =>
    subject.length > 10 ? `${subject.slice(0, 10)}…` : subject,
  );
  const timetableGraphData = subjectFrequencyEntries.map(([, count]) => count);

  return (
    <SafeAreaView style={ttStyles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView nestedScrollEnabled contentContainerStyle={ttStyles.scrollContent}>
        <View style={[ttStyles.page, embedded && ttStyles.embeddedPage]}>
          <LinearGradient
            colors={['#0D3F66', '#BFD7FA', '#F6F8FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={ttStyles.academicGradientSection}
          >
            <View style={ttStyles.pageHeader}>
              <View>
                <Text style={ttStyles.pageTitle}>Timetable</Text>
                <Text style={ttStyles.pageSubtitle}>
                  {studentData?.name || '-'} | {studentData?.class_name || '-'} {studentData?.section || ''}
                </Text>
              </View>
            </View>

            <View style={ttStyles.graphSection}>
              <View style={ttStyles.graphSectionInner}>
                <Text style={ttStyles.graphExplain}>
                  This chart shows which subjects appear most often in the timetable.
                </Text>

                <View style={ttStyles.graphLegendRow}>
                  <View style={ttStyles.graphLegendItem}>
                    <View style={[ttStyles.graphLegendDot, { backgroundColor: '#0D3F66' }]} />
                    <Text style={ttStyles.graphLegendText}>Subject frequency</Text>
                  </View>
                </View>

                {timetableGraphData.length === 0 || timetableGraphData.every((value) => value === 0) ? (
                  <View style={ttStyles.graphEmptyPlain}>
                    <Text style={ttStyles.graphEmptyTitlePlain}>No timetable graph yet</Text>
                    <Text style={ttStyles.graphEmptyTextPlain}>
                      Add timetable entries to see the weekly distribution.
                    </Text>
                  </View>
                ) : (
                  <BarChart
                    data={{
                      labels: timetableGraphLabels,
                      datasets: [{ data: timetableGraphData }],
                    }}
                    width={Math.max(width - 48, timetableGraphLabels.length * 64)}
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
                      color: opacity => `rgba(13, 63, 102, ${opacity})`,
                      labelColor: () => '#7A7A80',
                      propsForBackgroundLines: {
                        stroke: '#E9E9EE',
                        strokeDasharray: '',
                      },
                      propsForBarLabels: {
                        fill: '#111',
                      },
                    }}
                    style={ttStyles.graphChartPlain}
                  />
                )}
              </View>
            </View>
          </LinearGradient>

          <View style={ttStyles.summaryRow}>
            <LinearGradient
              colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
              start={{ x: 0.05, y: 0.05 }}
              end={{ x: 0.95, y: 0.95 }}
              style={[appStyles.dashboardGridCard, ttStyles.summaryCardLeft]}
            >
              <View style={ttStyles.summaryGradientTopRightIcon}>
                <MaterialIcons name="calendar-today" size={24} color="#FFFFFF" />
              </View>
              <View style={ttStyles.summaryCardContent}>
                <Text style={[ttStyles.summaryCardLabel, ttStyles.summaryCardLabelLight]}>Today&apos;s Classes</Text>
                <Text style={[ttStyles.summaryCardValue, ttStyles.summaryCardValueLight]}>{todayPeriods.length}</Text>
                <Text style={[ttStyles.summaryCardText, ttStyles.summaryCardTextLight]}>
                  {todayRow ? `${todayRow.day} schedule` : 'No classes today'}
                </Text>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
              start={{ x: 0.05, y: 0.05 }}
              end={{ x: 0.95, y: 0.95 }}
              style={[appStyles.dashboardGridCard, ttStyles.summaryCardRight]}
            >
              <View style={ttStyles.summaryGradientTopRightIcon}>
                <MaterialIcons name="schedule" size={24} color="#FFFFFF" />
              </View>
              <View style={ttStyles.summaryCardContent}>
                <Text style={[ttStyles.summaryCardLabel, ttStyles.summaryCardLabelLight]}>Next Period</Text>
                <Text style={[ttStyles.summaryCardValue, ttStyles.summaryCardValueLight]}>
                  {nextPeriod ? String(nextPeriod.subject || '--') : '--'}
                </Text>
                <Text style={[ttStyles.summaryCardText, ttStyles.summaryCardTextLight]}>
                  {nextPeriod
                    ? `${nextPeriodDay} • ${String(nextPeriod.fromTime || '').slice(0, 5)} - ${String(nextPeriod.toTime || '').slice(0, 5)}`
                    : 'No upcoming period'}
                </Text>
              </View>
            </LinearGradient>
          </View>

          {loading ? (
            <View style={ttStyles.centerState}>
              <ActivityIndicator size="large" color="#5A7488" />
              <Text style={ttStyles.stateText}>Loading timetable...</Text>
            </View>
          ) : timetable.length === 0 ? (
            <View style={ttStyles.centerState}>
              <Text style={ttStyles.stateText}>No timetable available.</Text>
            </View>
          ) : (
            <>
                 

              <View style={ttStyles.tableCard}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View
                      style={[
                        ttStyles.tableOuter,
                        {
                          minWidth: rowLabelWidth + periodCellWidth * maxPeriods,
                        },
                      ]}
                    >
                      <View style={ttStyles.headerRow}>
                        <View style={[ttStyles.cornerCell, { width: rowLabelWidth }]}>
                          <Text style={ttStyles.headerText}>Day</Text>
                        </View>
                        {Array.from({ length: maxPeriods }).map((_, index) => (
                          <View
                            key={`period-header-${index}`}
                            style={[ttStyles.periodHeaderCell, { width: periodCellWidth }]}
                          >
                            <Text style={ttStyles.periodHeaderNumber}>{`Period ${index + 1}`}</Text>
                            <Text style={ttStyles.periodHeaderTime} numberOfLines={2}>
                              {periodHeaders[index]
                                ? `${String(periodHeaders[index].fromTime || '').slice(0, 5)} - ${String(
                                    periodHeaders[index].toTime || ''
                                  ).slice(0, 5)}`
                                : ''}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {timetable.map((dayRow, dayIndex) => {
                        const periods = getSortedPeriods(dayRow);
                        const isLastRow = dayIndex === timetable.length - 1;

                        return (
                          <View key={dayRow.day} style={ttStyles.dataRow}>
                            <View
                              style={[
                                ttStyles.dayCell,
                                {
                                  width: rowLabelWidth,
                                  borderBottomWidth: isLastRow ? 0 : 1,
                                },
                              ]}
                            >
                              <Text style={ttStyles.dayText}>{dayRow.day}</Text>
                            </View>

                         {Array.from({ length: maxPeriods }).map((_, periodIndex) => {
  const period = periods[periodIndex];
  const isLastPeriod = periodIndex === maxPeriods - 1;
  const isInterval = period?.isInterval; // Check for our custom flag

  return (
    <View
      key={`${dayRow.day}-${periodIndex}`}
      style={[
        ttStyles.subjectCell,
        {
          width: periodCellWidth,
          borderBottomWidth: isLastRow ? 0 : 1,
          borderRightWidth: isLastPeriod ? 0 : 1,
          // Highlight intervals with a soft background color
          backgroundColor: isInterval ? '#FFF2CC' : '#FFFFFF', 
        },
      ]}
    >
      <Text 
        numberOfLines={2} 
        style={[
          ttStyles.subjectText, 
          isInterval && { fontWeight: '700', color: '#B26A00' } // Bold styling for breaks
        ]}
      >
        {period ? period.subject : '--'}
      </Text>
    </View>
  );
})}
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </ScrollView>
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <ParentFooter/>
    </SafeAreaView>
  );
};

export default ParentTimetable;

const ttStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F6F7',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 28,
  },
  page: {
    gap: 12,
  },
  embeddedPage: {
    padding: 0,
  },
  pageHeader: {
    paddingHorizontal: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  summaryCardLeft: {
    marginRight: 8,
  },
  summaryCardRight: {
    marginLeft: 8,
  },
  summaryCardContent: {
    flex: 1,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  summaryCardLabel: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: '#191919',
    textAlign: 'right',
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '800',
    color: '#2F2F31',
    textAlign: 'right',
    marginBottom: 6,
  },
  summaryCardText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#60646C',
    textAlign: 'right',
    fontWeight: '600',
  },
  summaryGradientTopRightIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  summaryCardLabelLight: {
    color: '#FFFFFF',
  },
  summaryCardValueLight: {
    color: '#FFFFFF',
  },
  summaryCardTextLight: {
    color: 'rgba(255,255,255,0.84)',
  },
  academicGradientSection: {
    marginTop: 0,
    marginBottom: 12,
    marginHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  graphSection: {
    marginTop: 0,
    marginBottom: 2,
    marginHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  graphSectionInner: {
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  graphExplain: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#444',
    marginBottom: 8,
  },
  graphLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  graphLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  graphLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 6,
  },
  graphLegendText: {
    fontSize: 11.5,
    color: '#333',
    fontWeight: '700',
    flexShrink: 1,
  },
  graphEmptyPlain: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  graphEmptyTitlePlain: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
    textAlign: 'center',
  },
  graphEmptyTextPlain: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#444',
    textAlign: 'center',
  },
  graphChartPlain: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111111',
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  centerState: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    color: '#555',
    fontSize: 14,
  },
  tableOuter: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#fff',
    alignSelf: 'stretch',
  },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E1E4EA',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    gap: 14,
  },
  classInfoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  classInfoBox: {
    flex: 1,
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  classInfoValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  classInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5A7488',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E1E4EA',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#0a3d62',
  },
  cornerCell: {
    minHeight: 62,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F2F2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
    paddingHorizontal: 8,
  },
  periodHeaderCell: {
    minHeight: 62,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F2F2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
    paddingHorizontal: 8,
  },
  dataRow: {
    flexDirection: 'row',
  },
  dayCell: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  dayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A7488',
    textAlign: 'center',
  },
  subjectCell: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F2F2F2',
    textAlign: 'center',
  },
  periodHeaderNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F2F2F2',
    textAlign: 'center',
  },
  periodHeaderTime: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '600',
    color: '#EEF2F7',
    textAlign: 'center',
    lineHeight: 11,
  },
  subjectText: {
    fontSize: 11,
    color: '#111',
    textAlign: 'center',
    lineHeight: 15,
  },
});
