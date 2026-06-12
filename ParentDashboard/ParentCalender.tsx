import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
  Alert,
  FlatList,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { globalStyles as styles } from '../inner';
import { createAppStyles } from '../App.styles';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { BarChart } from 'react-native-chart-kit';

import axios from 'axios';

import RNFS from 'react-native-fs';
import ParentFooter from './ParentFooter';



const { width } = Dimensions.get('window');

const ADMIN_API_BASE = 'https://cleezoclass.com:4000/api';

type CalendarItem = {
  id?: number;
  title: string;
  date: string;
  time?: string;
  description?: string;
  kind?: 'event' | 'meeting';
  subtitle?: string;
};

const normalizeCalendarDate = (value: any) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeAdminCalendarItems = (items: any[] = []): CalendarItem[] =>
  items
    .map((item) => ({
      id: item?.id,
      title: String(item?.eventName || item?.meetingTitle || item?.title || 'Calendar Item').trim(),
      date: normalizeCalendarDate(item?.eventDate || item?.meetingDate || item?.date),
      time: String(item?.eventTime || item?.meetingTime || '').trim() || undefined,
      description: String(item?.description || item?.agenda || '').trim() || undefined,
      kind: (item?.meetingTitle ? 'meeting' : 'event') as 'event' | 'meeting',
      subtitle: item?.meetingTitle
        ? 'Meeting'
        : item?.eventType
        ? String(item.eventType)
        : 'Event',
    }))
    .filter((item) => item.date);

const formatCalendarTime = (value?: string) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const [hour = '', minute = ''] = raw.split(':');
  if (!hour || !minute) return raw;
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

const formatCalendarDateLabel = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const readAdminCalendarItems = async (response: Response) => {
  if (!response.ok) return [];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload?.data) ? payload.data : [];
};

/* ---------------- CALENDAR SUB-COMPONENT ---------------- */
/* ---------------- CALENDAR SUB-COMPONENT ---------------- */

const CalendarView: React.FC<{ studentData: any; appStyles: any }> = ({ studentData, appStyles }) => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [approvedExtraClasses, setApprovedExtraClasses] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDayItems, setSelectedDayItems] = useState<CalendarItem[]>([]);
  const [selectedDateLabel, setSelectedDateLabel] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    fetchEvents();
  }, [currentYear, currentMonthIndex, studentData?.schoolCode]);

  const fetchEvents = async () => {
    try {
      const schoolCode = String(
        studentData?.schoolCode || (await AsyncStorage.getItem('schoolCode')) || ''
      );
      if (!schoolCode) {
        setEvents([]);
        return;
      }
      const [eventRes, meetingRes] = await Promise.all([
        fetch(
          `${ADMIN_API_BASE}/admin-events?schoolCode=${encodeURIComponent(schoolCode)}&year=${encodeURIComponent(
            String(currentYear)
          )}&month=${encodeURIComponent(String(currentMonthIndex + 1))}`
        ),
        fetch(
          `${ADMIN_API_BASE}/admin-meetings?schoolCode=${encodeURIComponent(schoolCode)}&year=${encodeURIComponent(
            String(currentYear)
          )}&month=${encodeURIComponent(String(currentMonthIndex + 1))}`
        ),
      ]);
      const eventItems = normalizeAdminCalendarItems(await readAdminCalendarItems(eventRes));
      const meetingItems = normalizeAdminCalendarItems(await readAdminCalendarItems(meetingRes));
      setEvents(
        [...eventItems, ...meetingItems].sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date);
          if (dateCompare !== 0) return dateCompare;
          return (a.time || '').localeCompare(b.time || '');
        })
      );
    } 
    catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    }
  };

  const fetchRequests = async () => {
    try {
      const schoolCode = studentData?.schoolCode;
      if (!schoolCode) {
        console.warn('❌ No schoolCode, skipping request fetch');
        return;
      }

      console.log('🌐 Fetching requests for school:', schoolCode);

      const res = await axios.get(
        'http://162.215.210.38:3010/api/admin/requests',
        {
          params: { schoolCode },
        }
      );

      console.log('✅ Requests fetched:', res.data.length);
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('❌ Error fetching requests:', err);
      Alert.alert('Error', 'Failed to fetch requests');
      setRequests([]);
    }
  };

  useEffect(() => {
    if (!studentData?.schoolCode) return;

    fetchRequests(); // initial fetch

    const interval = setInterval(() => {
      console.log('🔁 Auto-refreshing requests');
      fetchRequests();
    }, 15000);

    return () => clearInterval(interval);
  }, [studentData?.schoolCode]);

  useEffect(() => {
    if (!studentData?.class_name) {
      setApprovedExtraClasses([]);
      return;
    }

    const className = String(studentData.class_name).trim().toLowerCase();
    const section = String(studentData.section || '').trim().toLowerCase();

    const filtered = requests.filter((row: any) => {
      const status = String(row?.status || '').toLowerCase();
      const requestClass = String(row?.class || '').trim().toLowerCase();
      if (status !== 'approved') return false;

      if (requestClass === className) return true;
      if (section && requestClass === `${className}-${section}`) return true;
      if (section && requestClass === `${className}/${section}`) return true;
      if (section && requestClass === `${className} ${section}`) return true;
      return false;
    });

    setApprovedExtraClasses(filtered);
  }, [requests, studentData?.class_name, studentData?.section]);

  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const today = new Date();
  const toDateKey = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayKey = toDateKey(today);
  const upcomingEvents = [...events]
    .filter((item: any) => {
      const dateKey = toDateKey(item?.date);
      return !!dateKey && dateKey >= todayKey;
    })
    .sort((a: any, b: any) => toDateKey(a?.date).localeCompare(toDateKey(b?.date)));
  const upcomingExtraClasses = [...approvedExtraClasses]
    .filter((row: any) => {
      const dateKey = toDateKey(row?.request_date);
      return !!dateKey && dateKey >= todayKey;
      })
    .sort((a: any, b: any) => toDateKey(a?.request_date).localeCompare(toDateKey(b?.request_date)));
  const monthKey = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;
  const monthExtraClasses = approvedExtraClasses.filter((row: any) => {
    const dateKey = toDateKey(row?.request_date);
    return !!dateKey && dateKey.startsWith(monthKey);
  });
  const calendarGraphLabels = ['Events', 'Extra classes'];
  const calendarGraphData = [events.length, monthExtraClasses.length];
  const extraClassSummaryItems = upcomingExtraClasses.map((item: any) => ({
    id: item?.id,
    title: `Extra Class: ${item?.class || studentData?.class_name || 'Class'}`,
    date: toDateKey(item?.request_date),
    description: item?.teacher_name ? `Teacher: ${item.teacher_name}` : 'Extra class approved',
    kind: 'event' as const,
    subtitle: 'Approved Extra Class',
  }));
  const days: React.ReactNode[] = [];
  const firstDay = new Date(currentYear, currentMonthIndex, 1).getDay();

  for (let i = 0; i < firstDay; i++) {
    days.push(<View key={`empty-${i}`} style={styles.emptyDay} />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayKey = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = events.filter((e) => e.date === dayKey);

    const extraClass = approvedExtraClasses.find((r: any) => {
      const dt = new Date(r.request_date);
      return (
        dt.getDate() === d &&
        dt.getMonth() === currentMonthIndex &&
        dt.getFullYear() === currentYear
      );
    });

    const isToday =
      today.getDate() === d &&
      today.getMonth() === currentMonthIndex &&
      today.getFullYear() === currentYear;
    const hasEvents = dayEvents.length > 0;

    const dayStyle = [
      styles.day,
      extraClass && styles.approvedDay,
      hasEvents && styles.eventDay,
      isToday && styles.today,
    ].filter(Boolean);

    days.push(
      <TouchableOpacity
        key={`day-${d}`}
        style={dayStyle}
        onPress={() => {
          if (extraClass) {
            setSelectedEvent({
              title: 'Extra Class Approved',
              date: extraClass.request_date,
              details: `Class: ${extraClass.class || studentData?.class_name}`,
            });
            setSelectedDayItems([]);
            setSelectedDateLabel('');
            setModalVisible(true);
            return;
          }

          if (hasEvents) {
            setSelectedDayItems(dayEvents);
            setSelectedDateLabel(formatCalendarDateLabel(dayKey));
            setModalVisible(true);
          }
        }}
      >
        <Text style={isToday ? styles.todayText : styles.dayText}>{d}</Text>
      </TouchableOpacity>
    );
  }

  const goToPrevMonth = () => {
    setCurrentMonthIndex(prev => {
      if (prev === 0) {
        setCurrentYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const goToNextMonth = () => {
    setCurrentMonthIndex(prev => {
      if (prev === 11) {
        setCurrentYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  return (
    <View style={calendarStyles.calendarContent}>
      <LinearGradient
        colors={['#0D3F66', '#BFD7FA', '#F6F8FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={calendarStyles.academicGraphSection}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftColumn}>
            <Text style={styles.title}>Calendar</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {studentData?.name || '-'} {studentData?.class_name || ''}
            </Text>
          </View>
        </View>

        <View style={calendarStyles.academicGraphSectionInner}>
          <Text style={calendarStyles.academicGraphExplain}>
            This chart compares the total events and approved extra classes for the selected month.
          </Text>

    
          <View style={calendarStyles.academicLegendRow}>
            <View style={calendarStyles.academicLegendItem}>
              <View style={[calendarStyles.academicLegendDot, { backgroundColor: '#0D3F66' }]} />
              <Text style={calendarStyles.academicLegendText}>Events</Text>
            </View>
            <View style={calendarStyles.academicLegendItem}>
              <View style={[calendarStyles.academicLegendDot, { backgroundColor: '#F36B79' }]} />
              <Text style={calendarStyles.academicLegendText}>Extra classes</Text>
            </View>
          </View>

          {calendarGraphData.every((value) => value === 0) ? (
            <View style={calendarStyles.academicGraphEmptyPlain}>
              <Text style={calendarStyles.academicGraphEmptyTitlePlain}>Not enough month data yet</Text>
              <Text style={calendarStyles.academicGraphEmptyTextPlain}>
                Add events and extra classes to see the summary chart.
              </Text>
            </View>
          ) : (
            <BarChart
              data={{
                labels: calendarGraphLabels,
                datasets: [{ data: calendarGraphData }],
              }}
              width={Math.max(width - 48, 280)}
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
              }}
              style={calendarStyles.academicChartPlain}
            />
          )}
        </View>
      </LinearGradient>

      <View style={calendarStyles.summaryRow}>
        <LinearGradient
          colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
          start={{ x: 0.05, y: 0.05 }}
          end={{ x: 0.95, y: 0.95 }}
          style={[appStyles.dashboardGridCard, calendarStyles.summaryCardLeft]}
        >
          <View style={calendarStyles.summaryGradientTopRightIcon}>
            <MaterialIcons name="event" size={24} color="#FFFFFF" />
          </View>
          <View style={calendarStyles.summaryCardContent}>
            <Text style={[calendarStyles.summaryCardLabel, calendarStyles.summaryCardLabelLight]}>Events</Text>
            <Text style={[calendarStyles.summaryCardValue, calendarStyles.summaryCardValueLight]}>
              {upcomingEvents.length}
            </Text>
            <Text style={[calendarStyles.summaryCardText, calendarStyles.summaryCardTextLight]}>
              {upcomingEvents[0]
                ? `${formatCalendarDateLabel(upcomingEvents[0].date)} • ${upcomingEvents[0].title}`
                : 'No upcoming events'}
            </Text>
            
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
          start={{ x: 0.05, y: 0.05 }}
          end={{ x: 0.95, y: 0.95 }}
          style={[appStyles.dashboardGridCard, calendarStyles.summaryCardRight]}
        >
          <View style={calendarStyles.summaryGradientTopRightIcon}>
            <MaterialIcons name="event-note" size={24} color="#FFFFFF" />
          </View>
          <View style={calendarStyles.summaryCardContent}>
            <Text style={[calendarStyles.summaryCardLabel, calendarStyles.summaryCardLabelLight]}>
              Extra Classes
            </Text>
            <Text style={[calendarStyles.summaryCardValue, calendarStyles.summaryCardValueLight]}>
              {upcomingExtraClasses.length}
            </Text>
            <Text style={[calendarStyles.summaryCardText, calendarStyles.summaryCardTextLight]}>
              {upcomingExtraClasses.length > 0
                ? `${upcomingExtraClasses.length} upcoming`
                : 'No upcoming extra classes'}
            </Text>
           
          </View>
        </LinearGradient>
      </View>

      <View style={styles.calendarContainer}>
        <View style={styles.monthNavigation}>
          <TouchableOpacity style={styles.navBtn} onPress={goToPrevMonth}>
            <Text style={{ color: '#111827', fontSize: 20, fontWeight: '900' }}>{'‹'}</Text>
          </TouchableOpacity>

          <Text style={styles.monthTitle}>
            {new Date(currentYear, currentMonthIndex).toLocaleString('default', {
              month: 'long',
            })}
          </Text>

          <TouchableOpacity style={styles.navBtn} onPress={goToNextMonth}>
            <Text style={{ color: '#111827', fontSize: 20, fontWeight: '900' }}>{'›'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.month}>
          <View style={styles.weekdays}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.days}>{days}</View>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <Text style={{ fontWeight: '700', color: '#111', marginBottom: 6 }}>
          Upcoming Extra Classes
        </Text>
        {upcomingExtraClasses.length === 0 ? (
          <Text style={{ color: '#666', fontSize: 12 }}>No upcoming extra classes.</Text>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
          >
            {upcomingExtraClasses.map((item: any, idx: number) => {
              const dt = new Date(item.request_date);
              return (
                <View
                  key={`${item.id || idx}-${item.request_date}`}
                  style={{
                    backgroundColor: '#f6f6f7',
                    borderWidth: 1,
                    borderColor: '#F36B79',
                    borderRadius: 8,
                    padding: 8,
                    marginRight: 10,
                  }}
                >
                  <Text style={{ color: '#1d472a', fontWeight: '600', fontSize: 12 }}>
                    {dt.toLocaleDateString()} • {item.class || studentData?.class_name}
                  </Text>
                  <Text style={{ color: '#2f5f3e', fontSize: 11, marginTop: 4 }}>
                    {item.teacher_name ? `Teacher: ${item.teacher_name}` : 'Extra class approved'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Modal for events */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 10, width: '80%' }}>
                {selectedDayItems.length > 0 ? (
                  <>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'black' }}>{selectedDateLabel}</Text>
                    <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                      {selectedDayItems.map((item, index) => (
                        <View key={`${item.id || item.title}-${index}`} style={{ marginTop: 12 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>{item.title}</Text>
                          <Text style={{ marginTop: 4, color: '#333', fontSize: 12 }}>
                            {item.kind === 'meeting' ? 'Meeting' : 'Event'}
                            {item.subtitle ? ` • ${item.subtitle}` : ''}
                            {item.time ? ` • ${formatCalendarTime(item.time)}` : ''}
                          </Text>
                          {item.description ? (
                            <Text style={{ marginTop: 4, color: '#333', fontSize: 12 }}>{item.description}</Text>
                          ) : null}
                        </View>
                      ))}
                    </ScrollView>
                  </>
                ) : selectedEvent ? (
                  <>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'black' }}>{selectedEvent.title}</Text>
                    {selectedEvent.details ? (
                      <Text style={{ marginTop: 8, color: '#333' }}>{selectedEvent.details}</Text>
                    ) : null}
                  </>
                ) : null}
                <TouchableOpacity onPress={() => {
                  setModalVisible(false);
                  setSelectedDayItems([]);
                  setSelectedDateLabel('');
                  setSelectedEvent(null);
                }} style={{ marginTop: 20, padding: 10, backgroundColor: 'rgb(160, 180, 182)', borderRadius: 5 }}>
                    <Text style={{ color: 'white', textAlign: 'center' }}>Close</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
};

const calendarStyles = StyleSheet.create({
  calendarContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24,
  },
  academicGraphSection: {
    marginTop: 0,
    marginBottom: 12,
    marginHorizontal: -16,
    paddingTop: 16,
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  academicGraphSectionInner: {
    paddingHorizontal: 0,
    paddingBottom: 8,
  },
  academicGraphExplain: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#444',
    marginBottom: 8,
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
  academicGraphEmptyPlain: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  academicGraphEmptyTitlePlain: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
    textAlign: 'center',
  },
  academicGraphEmptyTextPlain: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#444',
    textAlign: 'center',
  },
  academicChartPlain: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
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
    marginBottom: 10,
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
  summaryActionButton: {
    backgroundColor: '#404040',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  summaryActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
/* ---------------- PHOTO UPLOAD/GALLERY SUB-COMPONENT ---------------- */
const PhotoGalleryView = () => {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventName, setSelectedEventName] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [downloadingUri, setDownloadingUri] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      try {
        const response = await fetch(`http://162.215.210.38:3010/api/media?schoolCode=${schoolCode}`);
        const data = await response.json();
        setMedia(Array.isArray(data) ? data : []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchMedia();
  }, []);

  const groupedByEvent = media.reduce((acc: Record<string, any[]>, item: any) => {
    const eventName = item?.eventName || 'Untitled Event';
    if (!acc[eventName]) acc[eventName] = [];
    acc[eventName].push(item);
    return acc;
  }, {});

  const eventFolders = Object.keys(groupedByEvent).map(eventName => ({
    eventName,
    items: groupedByEvent[eventName],
  }));

  const selectedItems = selectedEventName ? groupedByEvent[selectedEventName] || [] : [];
  const imageItems = selectedItems.filter((item: any) => !!item?.attachments);

  const askStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Number(Platform.Version) >= 33) return true;

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const getFileExtension = (uri: string) => {
    const cleaned = uri.split('?')[0];
    const ext = cleaned.split('.').pop()?.toLowerCase() || 'jpg';
    if (ext.length > 5) return 'jpg';
    return ext;
  };
  const resolveAttachmentUrl = (uri: string) => {
    const raw = String(uri || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:')) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    const normalized = raw.startsWith('/') ? raw : `/${raw}`;
    return `http://162.215.210.38:3010${normalized}`;
  };
  const extensionFromMime = (mime: string) => {
    const normalized = String(mime || '').toLowerCase();
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('webp')) return 'webp';
    if (normalized.includes('gif')) return 'gif';
    if (normalized.includes('mp4')) return 'mp4';
    return 'bin';
  };

  const safeName = (value: string) =>
    String(value || 'photo')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

  const handleDownload = async (uri: string, index: number) => {
    if (!uri) return;
    try {
      const hasPermission = await askStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission needed', 'Please allow storage permission to download images.');
        return;
      }

      setDownloadingUri(uri);
      const finalUrl = resolveAttachmentUrl(uri);
      if (!finalUrl) {
        Alert.alert('Download failed', 'Invalid image URL.');
        return;
      }

      const isDataUri = finalUrl.startsWith('data:');
      const dataUriMatch = finalUrl.match(/^data:([^;]+);base64,(.*)$/);
      const ext = isDataUri
        ? extensionFromMime(dataUriMatch?.[1] || '')
        : getFileExtension(finalUrl);
      const eventLabel = safeName(selectedEventName || 'event');
      const fileName = `${eventLabel}_${Date.now()}_${index}.${ext}`;

      const targets =
        Platform.OS === 'android'
          ? [RNFS.DownloadDirectoryPath, RNFS.ExternalDirectoryPath, RNFS.DocumentDirectoryPath]
          : [RNFS.DocumentDirectoryPath];

      let savedPath = '';
      let lastStatus = 0;

      for (const dir of targets) {
        if (!dir) continue;
        const targetPath = `${dir}/${fileName}`;
        try {
          if (isDataUri) {
            const base64Data = dataUriMatch?.[2] || '';
            if (!base64Data) throw new Error('Invalid base64 payload');
            await RNFS.writeFile(targetPath, base64Data, 'base64');
            lastStatus = 200;
            savedPath = targetPath;
            break;
          } else {
            const result = await RNFS.downloadFile({
              fromUrl: finalUrl,
              toFile: targetPath,
              background: false,
            }).promise;

            lastStatus = result?.statusCode || 0;
            if (lastStatus >= 200 && lastStatus < 300) {
              savedPath = targetPath;
              break;
            }
          }
        } catch (innerError) {
          console.log('Download attempt failed for path:', targetPath, innerError);
        }
      }

      if (savedPath) {
        Alert.alert('Downloaded', `Saved to:\n${savedPath}`);
      } else {
        Alert.alert('Download failed', `Unable to save image (status ${lastStatus || 'unknown'}).`);
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Download failed', 'Unable to download image.');
    } finally {
      setDownloadingUri(null);
    }
  };

  if (loading) {
    return <ActivityIndicator size="small" color="#000" style={{ marginTop: 20 }} />;
  }

  return (
    <ScrollView style={{ height: 400 }}>
      {!selectedEventName ? (
        <View style={{ padding: 8 }}>
          {eventFolders.length === 0 ? (
            <Text style={{ padding: 20 }}>No photos found.</Text>
          ) : (
            eventFolders.map(folder => (
              <TouchableOpacity
                key={folder.eventName}
                onPress={() => setSelectedEventName(folder.eventName)}
                style={{
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 10,
                  marginBottom: 10,
                  padding: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 24, marginRight: 10 }}>📁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: '#111' }}>{folder.eventName}</Text>
                  <Text style={{ color: '#666' }}>{folder.items.length} image(s)</Text>
                </View>
                {folder.items[0]?.attachments ? (
                  <Image
                    source={{ uri: resolveAttachmentUrl(folder.items[0].attachments) }}
                    style={{ width: 46, height: 46, borderRadius: 6 }}
                  />
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View style={{ padding: 8 }}>
          <TouchableOpacity
            onPress={() => setSelectedEventName(null)}
            style={{
              backgroundColor: 'rgb(160, 180, 182)',
              borderRadius: 6,
              paddingVertical: 8,
              paddingHorizontal: 12,
              alignSelf: 'flex-start',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>← Back to Folders</Text>
          </TouchableOpacity>

          <Text style={{ fontWeight: '700', color: '#111', marginBottom: 8 }}>
            {selectedEventName}
          </Text>
          {imageItems.length === 0 ? (
            <Text style={{ padding: 20 }}>No images in this event.</Text>
          ) : (
            <FlatList
              data={imageItems}
              keyExtractor={(item: any, index: number) => `${item.id || 'img'}-${index}`}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
              renderItem={({ item, index }) => (
                <View
                  style={{
                    width: (width - 42) / 3,
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#e5e5e5',
                    padding: 4,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setPreviewStartIndex(index);
                      setPreviewIndex(index);
                      setPreviewVisible(true);
                    }}
                  >
                    <Image
                      source={{ uri: resolveAttachmentUrl(item.attachments) }}
                      style={{ width: '100%', height: 90, borderRadius: 6 }}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDownload(item.attachments, index)}
                    style={{
                      marginTop: 6,
                      borderRadius: 6,
                      backgroundColor: '#2f4f88',
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: '#fff', textAlign: 'center', fontSize: 11, fontWeight: '700' }}>
                      {downloadingUri === item.attachments ? 'Downloading...' : 'Download'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      )}

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.88)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <FlatList
            key={`preview-${previewStartIndex}-${imageItems.length}`}
            data={imageItems}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={previewStartIndex}
            getItemLayout={(_, index) => ({
              length: width - 32,
              offset: (width - 32) * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const nextIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
              setPreviewIndex(nextIndex);
            }}
            renderItem={({ item }) => (
              <View style={{ width: width - 32, alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  source={{ uri: resolveAttachmentUrl(item.attachments) }}
                  resizeMode="contain"
                  style={{ width: '100%', height: '75%', borderRadius: 8 }}
                />
              </View>
            )}
          />
          <Text style={{ color: '#fff', marginTop: 8, fontSize: 12 }}>
            Swipe left or right to view more photos ({previewIndex + 1}/{imageItems.length})
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() =>
                imageItems[previewIndex]?.attachments &&
                handleDownload(imageItems[previewIndex].attachments, previewIndex)
              }
              style={{ backgroundColor: '#2f4f88', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPreviewVisible(false)}
              style={{ backgroundColor: '#777', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */

const ParentCalender: React.FC<
  NativeStackScreenProps<RootStackParamList, 'ParentCalender'> & { embedded?: boolean }
> = ({ embedded = false }) => {
  const [academicSummary, setAcademicSummary] = useState({ grade: '-', percentage: '0.00' });
  const [totalPaid, setTotalPaid] = useState('₹0.00');
  const [totalDue, setTotalDue] = useState('₹0.00');
  const [feeSummary, setFeeSummary] = useState({ paid: '₹ 0.00', due: '₹ 0.00' });
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const appStyles = createAppStyles({ phoneWidth, phoneHeight });

const [studentData, setStudentData] = useState<any>(null);

const computeAcademicSummary = (performance: any[], testTypes: any[]) => {
  if (!performance.length) return { grade: '-', percentage: '0.00' };

  const fallbackTermRows = [
    { label: 'FA1', key: 'FA1' },
    { label: 'FA2', key: 'FA2' },
    { label: 'SA1', key: 'SA1' },
    { label: 'FA3', key: 'FA3' },
    { label: 'FA4', key: 'FA4' },
    { label: 'SA2', key: 'SA2' },
  ];

  const termRows = (testTypes || []).length
    ? testTypes
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

  performance.forEach((subj) => {
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
  const p = Number(percentage);
  let grade = 'D';
  if (p >= 90) grade = 'A+';
  else if (p >= 80) grade = 'A';
  else if (p >= 70) grade = 'B+';
  else if (p >= 60) grade = 'B';
  else if (p >= 50) grade = 'C';

  return { grade, percentage };
};

useEffect(() => {
  const loadData = async () => {
    try {
      console.log('🔄 Attempting to load student data from AsyncStorage...');
      
      const keys = ['studentId', 'name', 'schoolCode', 'class_name', 'section', 'username'];
      const stores = await AsyncStorage.multiGet(keys);
      
      const data: any = {};
      stores.forEach(([k, v]) => { 
        if (v) {
          data[k] = v; 
        } else {
          console.warn(`⚠️ Warning: Key "${k}" is empty in AsyncStorage`);
        }
      });

      // Check if we actually got any data
      if (Object.keys(data).length > 0) {
        console.log('✅ Student Data successfully loaded:', data);
        setStudentData(data);
      } else {
        console.error('❌ No student data found. Did you select a student in ParentDetails?');
      }

    } catch (error) {
      console.error('❌ AsyncStorage Error:', error);
    }
  };

  loadData();
}, []);
const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);

  // Simplified Fee/Academic logic (re-using your logic from file 2)
useEffect(() => {
    if (!studentData) {
      console.log('⚠️ fetchSummaries skipped: studentData is null');
      return;
    }

    const fetchSummaries = async () => {
      try {
        console.log('🚀 Starting Summary Fetches for:', studentData.name);

        // --- Fetch Academics ---
        const acadPayload = {
          name: studentData.name,
          class_name: studentData.class_name,
          section: studentData.section,
          schoolCode: studentData.schoolCode,
        };
        console.log('📡 Fetching Academics with payload:', acadPayload);

        const acadRes = await axios.post('https://cleezoclass.com:4000/api/overall/academic-performance', acadPayload);
        const performance = Array.isArray(acadRes.data)
          ? acadRes.data
          : Array.isArray(acadRes.data?.performance)
          ? acadRes.data.performance
          : Array.isArray(acadRes.data?.data)
          ? acadRes.data.data
          : [];
        const testTypes = Array.isArray(acadRes.data?.testTypes) ? acadRes.data.testTypes : [];
        console.log('📦 Academic Raw Data:', performance);

        const summary = computeAcademicSummary(performance, testTypes);
        console.log(`📊 Academic Summary: ${summary.grade} (${summary.percentage}%)`);
        setAcademicSummary(summary);

        // --- Fetch Fees ---
        const feePayload = {
          studentId: studentData.studentId,
          schoolCode: studentData.schoolCode,
        };
        console.log('📡 Fetching Fees with payload:', feePayload);

        const feeRes = await axios.post('https://cleezoclass.com:4000/api/studentFees', feePayload);
        const f = feeRes.data?.feeDetails || {};
        console.log('📦 Fees Raw Data:', f);

        const paidAmount = 
          Number(f.Paid_Amount ?? 0) + Number(f.Admission_paid ?? 0) +
          Number(f.books_paid ?? 0) + Number(f.uniform_paid ?? 0) +
          Number(f.bus_paid ?? 0) + Number(f.exam_paid ?? 0) + Number(f.others_paid ?? 0);
        
        const totalAmount = Number(f.Final_Amount ?? f.CompleteFee ?? 0);
        const dueAmount = totalAmount - paidAmount;

        console.log(`💰 Fees Calc: Total(${totalAmount}) - Paid(${paidAmount}) = Due(${dueAmount})`);

        setFeeSummary({
          paid: formatINR(paidAmount),
          due: formatINR(dueAmount)
        });

      } catch (err) {
        console.error("❌ Summary fetch error:", err);
      }
    };

    fetchSummaries();
  }, [studentData]);

  const embeddedHeight = Math.max(phoneHeight * 0.78, 620);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView} nestedScrollEnabled>
        <View style={embedded ? [styles.container, { padding: 0 }] : { padding: 0 }}>
          {studentData ? <CalendarView studentData={studentData} appStyles={appStyles} /> : <ActivityIndicator size="large" color="#000" />}
        </View>
      </ScrollView>
      <ParentFooter/>
    </SafeAreaView>
  );
};

export default ParentCalender;
