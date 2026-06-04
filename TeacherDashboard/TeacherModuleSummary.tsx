import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import { createAppStyles } from '../App.styles';
import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';
import TeacherFooter from './TeacherFooter';
import { RootStackParamList } from '../types';
import TeacherSummaryCard from './TeacherSummaryCard';

type SummaryRouteParams = {
  username?: string;
  name?: string;
  moduleLabel?: string;
};

type IconKind = 'material' | 'fontawesome';

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

const logoImage = require('../assets/Cleezo.png');

const moduleLabels = [
  'Attendance',
  'Homework',
  'Time table',
  'Topic of day',
  'Behaviour',
  'Photo',
  'Calendar',
  'Scan',
  'Salary',
  'Leave',
  'Chat',
];

const renderIcon = (kind: IconKind, name: string, color: string, size: number) => {
  if (kind === 'fontawesome') {
    return <FontAwesome name={name} size={size} color={color} />;
  }

  return <MaterialIcons name={name} size={size} color={color} />;
};

const TeacherModuleSummary = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<{ TeacherModuleSummary: SummaryRouteParams }, 'TeacherModuleSummary'>>();
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const styles = createAppStyles({ phoneWidth, phoneHeight });
  const { nextClass, fullTimetable, refreshNextClass } = useNextClass();
  const [selectedModule, setSelectedModule] = useState(route.params?.moduleLabel || 'Attendance');
  const [teacherName, setTeacherName] = useState(route.params?.name || '');
  const [attendanceSnapshot, setAttendanceSnapshot] = useState<AttendanceSnapshot>({
    status: 'Not tracked yet',
    distance: '--',
    lastUpdated: '--',
  });

  useEffect(() => {
    const loadTeacherData = async () => {
      try {
        const storedName = await AsyncStorage.getItem('name');
        const params = route.params ?? {};
        setTeacherName(params.name || storedName || '');
        if (params.moduleLabel) {
          setSelectedModule(params.moduleLabel);
        }
      } catch (error) {
        console.error('Failed to load teacher summary data:', error);
      }
    };

    loadTeacherData();
  }, [route.params]);

  useEffect(() => {
    refreshNextClass();
  }, [refreshNextClass]);

  useEffect(() => {
    let mounted = true;

    const loadAttendanceSnapshot = async () => {
      try {
        const [lastStatus, lastResultRaw, serviceActive, trackingEnabled] = await Promise.all([
          AsyncStorage.getItem('lastAttendanceStatus'),
          AsyncStorage.getItem('attendance_last_result'),
          AsyncStorage.getItem('attendanceServiceActive'),
          AsyncStorage.getItem('attendanceTrackingEnabled'),
        ]);

        if (!mounted) return;

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
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const nextClassReport = useMemo(() => buildTeacherDayPeriods(fullTimetable), [fullTimetable]);

  const summaryCards = useMemo(() => {
    const nextClassTitle = nextClass?.class_id || '--';
    const nextClassSubtitle = nextClass?.subject || 'No class';
    const nextClassFooter = nextClass
      ? `${nextClass.fromTime} - ${nextClass.toTime}`
      : 'No timetable available';
    const dayCount = fullTimetable?.length || 0;
    const periodCount = nextClassReport?.length || 0;

    const card = (
      title: string,
      subtitle: string,
      footer: string,
      icon: string,
      background: string
    ): StatCard => ({
      title,
      subtitle,
      footer,
      icon,
      kind: 'material',
      background,
    });

    const cardsByModule: Record<string, StatCard[]> = {
      Attendance: [
        card(
          'Attendance',
          attendanceSnapshot.status,
          `Distance: ${attendanceSnapshot.distance} | Updated: ${attendanceSnapshot.lastUpdated}`,
          attendanceSnapshot.status === 'Present' ? 'check-circle' : 'event-note',
          '#D7E7CD'
        ),
        card('Next class', nextClassTitle, `${nextClassSubtitle} • ${nextClassFooter}`, 'schedule', '#F0EE96'),
      ],
      Homework: [
        card('Homework', 'Daily tasks', 'Upload and review assigned work', 'assignment', '#D7E7CD'),
        card('Next class', nextClassTitle, `${nextClassSubtitle} • ${nextClassFooter}`, 'schedule', '#F0EE96'),
      ],
      'Time table': [
        card('Time table', nextClassTitle, `${nextClassSubtitle} • ${nextClassFooter}`, 'schedule', '#D7E7CD'),
        card('Planned days', String(dayCount), `Periods visible: ${periodCount}`, 'today', '#F0EE96'),
      ],
      'Topic of day': [
        card('Topic', 'Of the day', 'Open the topic planning view', 'today', '#D7E7CD'),
        card('Next class', nextClassTitle, `${nextClassSubtitle} • ${nextClassFooter}`, 'schedule', '#F0EE96'),
      ],
      Behaviour: [
        card('Behaviour', 'Status', 'Review student behaviour updates', 'person', '#D7E7CD'),
        card('Notes', 'Class observations', 'Track behaviour follow-ups', 'event-note', '#F0EE96'),
      ],
      Photo: [
        card('Media', 'Upload', 'Add images or documents', 'photo-library', '#D7E7CD'),
        card('Queue', 'Review', 'Check recent uploads', 'folder', '#F0EE96'),
      ],
      Calendar: [
        card('Events', 'Upcoming', 'Open school calendar', 'event', '#D7E7CD'),
        card('Next class', nextClassTitle, `${nextClassSubtitle} • ${nextClassFooter}`, 'schedule', '#F0EE96'),
      ],
      Scan: [
        card('Scan', 'Documents', 'Use handwriting scan tools', 'qr-code-scanner', '#D7E7CD'),
        card('Pull', 'Quick action', 'Open scan and pull workflow', 'content-paste-search', '#F0EE96'),
      ],
      Salary: [
        card('Salary', 'Overview', 'Review salary details', 'payments', '#D7E7CD'),
        card('Month', 'Current', 'View current month status', 'calendar-today', '#F0EE96'),
      ],
      Leave: [
        card('Leave', 'Requests', 'Pending approvals and history', 'event-busy', '#D7E7CD'),
        card('Status', 'Review', 'Check current leave updates', 'check-circle', '#F0EE96'),
      ],
      Chat: [
        card('Chat', 'Messages', 'Teacher chat and events', 'chat', '#D7E7CD'),
        card('Updates', 'Recent', 'Track latest replies', 'notifications', '#F0EE96'),
      ],
    };

    return cardsByModule[selectedModule] || cardsByModule.Attendance;
  }, [
    attendanceSnapshot.distance,
    attendanceSnapshot.lastUpdated,
    attendanceSnapshot.status,
    fullTimetable,
    nextClass,
    nextClassReport,
    selectedModule,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F6F7" />
      <View style={[styles.content, { paddingTop: 12 }]}>
        <View style={localStyles.headerRow}>
          <View style={localStyles.headerBrand}>
            <Image source={logoImage} style={localStyles.logo} resizeMode="contain" />
          </View>
          <View style={localStyles.headerTitleBlock}>
            <Text style={localStyles.title}>Module Cards</Text>
            <Text style={localStyles.subtitle}>
              {teacherName ? `${teacherName} • ` : ''}
              {selectedModule}
            </Text>
          </View>
          <Pressable style={localStyles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={localStyles.backBtnText}>Back</Text>
          </Pressable>
        </View>

        <View style={localStyles.chipWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.chipRow}>
            {moduleLabels.map((label) => {
              const active = selectedModule === label;

              return (
                <Pressable
                  key={label}
                  onPress={() => setSelectedModule(label)}
                  style={[
                    localStyles.chip,
                    active ? localStyles.chipActive : localStyles.chipInactive,
                  ]}
                >
                  <Text style={[localStyles.chipText, active && localStyles.chipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={localStyles.previewCard}>
          <View style={localStyles.previewRow}>
            <Text style={localStyles.previewTitle}>{selectedModule}</Text>
            <Text style={localStyles.previewMeta}>{summaryCards.length} cards</Text>
          </View>
          <Text style={localStyles.previewText}>
            These cards update from live attendance and timetable data.
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={localStyles.cardsScroll}
          style={{ maxHeight: Math.max(phoneHeight * 0.5, 320) }}
        >
          <View style={localStyles.cardsRow}>
            {summaryCards.map((card, index) => (
              <TeacherSummaryCard
                key={`${selectedModule}-${card.subtitle}-${index}`}
                style={[
                  localStyles.summaryCard,
                  index === 0 ? localStyles.summaryCardLeft : localStyles.summaryCardRight,
                ]}
              >
                <View style={localStyles.cardText}>
                  <View style={localStyles.statusTitleRow}>
                    <Text style={localStyles.statusNumber} numberOfLines={1} ellipsizeMode="tail">
                      {card.title}
                    </Text>
                    <Text style={localStyles.statusSubtitle} numberOfLines={1} ellipsizeMode="tail">
                      {card.subtitle}
                    </Text>
                  </View>
                  <Text style={localStyles.statusFooter} numberOfLines={2} ellipsizeMode="tail">
                    {card.footer}
                  </Text>
                </View>
                <View style={localStyles.statusIconWrap}>
                  {renderIcon(card.kind, card.icon, '#4C4C4C', 30)}
                </View>
              </TeacherSummaryCard>
            ))}
          </View>
        </ScrollView>
      </View>
      <TeacherFooter />
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  headerBrand: {
    width: 38,
    alignItems: 'flex-start',
  },
  logo: {
    width: 32,
    height: 32,
  },
  headerTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#666',
  },
  backBtn: {
    backgroundColor: '#404040',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  chipWrap: {
    marginBottom: 12,
  },
  chipRow: {
    paddingRight: 6,
    gap: 8,
  },
  chip: {
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#3F3F40',
    borderColor: '#3F3F40',
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8D8DC',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2F2F31',
    textAlign: 'center',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E2E6',
    padding: 14,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#131313',
  },
  previewMeta: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666',
  },
  previewText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: '#5E5E62',
  },
  cardsScroll: {
    paddingBottom: 10,
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 40,
  },
  summaryCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: 'visible',
  },
  summaryCardLeft: {
    marginRight: 4,
  },
  summaryCardRight: {
    marginLeft: 4,
  },
  cardText: {
    flex: 1,
    paddingRight: 8,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  statusNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginRight: 4,
  },
  statusSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#252525',
    lineHeight: 18,
  },
  statusFooter: {
    marginTop: 20,
    fontSize: 12.5,
    fontWeight: '500',
    color: '#2B2B2B',
  },
  statusIconWrap: {
    width: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 2,
  },
});

export default TeacherModuleSummary;
