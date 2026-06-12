import React, { useEffect, useState,useContext } from 'react';
import {
  View,
  Text,
  Button,
  Modal,
  TouchableOpacity,BackHandler,Alert,TextInput,Image,Dimensions,StyleSheet,ActivityIndicator,ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { globalStyles as styles } from '../teacherStyles';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import { RouteProp, useNavigation, useRoute, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import ticketicon from '../icons/ticket.png'
import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';
import { TouchableWithoutFeedback } from 'react-native';
import { TeacherTimetableContext } from '../Modalcontext';
import TeacherTimetableComponent from '../TeacherTimetableComponent';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import TeacherFooter from './TeacherFooter';
import TeacherSummaryCard from './TeacherSummaryCard';
import LinearGradient from 'react-native-linear-gradient';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const scaleFont = (size: number) => (SCREEN_WIDTH / 375) * size;

const local = StyleSheet.create({
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    flexGrow: 1,
    paddingBottom: hp('12%'),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
    marginBottom: 12,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  summaryCardLeft: {
    marginRight: 4,
  },
  summaryCardRight: {
    marginLeft: 4,
  },
  summaryText: {
    flex: 1,
    paddingRight: 8,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginRight: 4,
  },
  summarySubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#252525',
    lineHeight: 18,
  },
  summaryFooter: {
    marginTop: 20,
    fontSize: 12.5,
    fontWeight: '500',
    color: '#2B2B2B',
  },
  summaryIconWrap: {
    width: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 2,
  },
  reasonInputFix: {
    width: '100%',
    minHeight: 50,

    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    color: '#111827',
    fontSize: 14,
    textAlignVertical: 'top',
  },
});

const ADMIN_API_BASE = 'https://cleezoclass.com:4000/api';

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

const normalizeAdminCalendarItems = (items: any[] = []): CalendarEvent[] =>
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
/* 🔹 Event type */
interface CalendarEvent {
  id?: number;
  title: string;
  date: string;
  time?: string;
  description?: string;
  kind?: 'event' | 'meeting';
  subtitle?: string;
}
interface Teacher {
  id: string;
  name: string;
  subject: string;
}

type TeacherEventCalendarRouteProp = RouteProp<
  RootStackParamList,
  'TeacherEventCalendar'
>;

type TeacherEventCalendarNavigationProp = NavigationProp<
  RootStackParamList,
  'TeacherEventCalendar'
>;
interface TeacherRequest {
  id: number;
  teacher_name: string;
  class: string;
  request_date: string;
  address_request: number;
  reason: string;
  status: string;
  created_at: string;
}

type TeacherEventCalendarProps = {
  inlineParams?: {
    username?: string;
    name?: string;
  };
};

const TeacherEventCalendar: React.FC<TeacherEventCalendarProps> = ({ inlineParams }) => {
  // Use typed navigation
  const navigation = useNavigation<TeacherEventCalendarNavigationProp>();
  // Use typed route
  const route = inlineParams
    ? ({ params: inlineParams } as TeacherEventCalendarRouteProp)
    : useRoute<TeacherEventCalendarRouteProp>();
const { nextClass, refreshNextClass , fullTimetable} = useNextClass();
  const [showModal, setShowModal] = useState(false);
  // Now you can safely destructure params
  const { username, name } = route.params || inlineParams || {};
  console.log('📝 Route params:', route.params);
  console.log('📌 Teacher Username:', username);
console.log('📌 Teacher Name:', name);
  const today = new Date();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(
    today.getMonth()
  );
const [showTeacherTableModal, setShowTeacherTableModal] = useState(false);
const context = useContext(TeacherTimetableContext);
const teacherTimetable = context?.teacherTimetable || [];
const loadingTable = context?.loading || false;
const loading1 = context?.loading || false;
  // School code
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load school code from AsyncStorage
  useEffect(() => {
    const loadSchoolCode = async () => {
      try {
        const storedCode = await AsyncStorage.getItem('schoolCode');
        setSchoolCode(storedCode);
      } catch (err) {
        console.error('Failed to load school code:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSchoolCode();
  }, []);
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 10,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    height: SCREEN_HEIGHT * 0.58,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#000',
  },
});
useEffect(() => {
  console.log("🔁 useEffect triggered for fetching teachers");
  console.log("📌 Current schoolCode:", schoolCode);

  if (!schoolCode) {
    console.warn("❌ No school code, skipping fetch");
    return;
  }

const fetchTeachers = async () => {
  console.log("🌐 Starting fetchTeachers...");

  try {
    // 🔹 Log the school code being used
    console.log("📌 Using schoolCode:", schoolCode);

    // 🔹 API call to fetch teachers
    console.log("📡 Sending GET request to /teachers API...");
    const res = await axios.get('https://cleezoclass.com:4000/teachers', {
      params: { schoolCode },
    });

    // 🔹 Log raw API response
    console.log("✅ API response received:", res);

    // 🔹 Log the data part specifically
    console.log("📊 API data:", res.data);

    // 🔹 Check if the response is an array
    if (Array.isArray(res.data)) {
      console.log(`🎉 Response is an array with ${res.data.length} items`);

      // 🔹 Save teachers to state
      setTeachers(res.data);
      console.log("📥 Teachers saved to state");

      // 🔹 Find logged-in teacher by name
      const loggedInTeacher = res.data.find((t: any) => {
        console.log("🔍 Checking teacher:", t.name);
        return t.name === name;
      });

      if (loggedInTeacher) {
        console.log("👤 Logged-in teacher found:", loggedInTeacher);

        // 🔹 Handle classes
        if (loggedInTeacher.class) {
          console.log("📚 Classes for teacher:", loggedInTeacher.class);

          const classesArray = loggedInTeacher.class
            .split(',')
            .map((cls: string) => cls.trim());

          console.log("🔹 Parsed availableClasses array===================:", classesArray);

          setAvailableClasses(classesArray);

          // 🔹 Optionally auto-select first class
          if (classesArray.length > 0) {
            setSelectedClass(classesArray[0]);
            console.log("🎯 Auto-selected first class:", classesArray[0]);
          } else {
            console.warn("⚠️ Teacher has no classes assigned after parsing");
          }
        } else {
          console.warn("⚠️ Logged-in teacher has no class property");
        }
      } else {
        console.warn(`⚠️ No teacher matched the logged-in name: "${name}"`);
      }
    } else {
      console.error("❌ Teachers API response is not an array:", res.data);
    }
  } catch (err) {
    console.error("❌ Error fetching teachers:", err);
    if (axios.isAxiosError(err)) {
      console.error("⚠️ Axios error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
    }
  } finally {
    console.log("🟢 fetchTeachers completed");
  }
};
  fetchTeachers();
}, [schoolCode, name]); // include 'name' so it reacts to logged-in teacher

const [showClassDropdown, setShowClassDropdown] = useState(false);
const [selectedClass, setSelectedClass] = useState('');
const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [addressRequest, setAddressRequest] = useState(false);
  const [reasonRequest, setReasonRequest] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [selectedRequestDate, setSelectedRequestDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedDayItems, setSelectedDayItems] = useState<CalendarEvent[]>([]);
  const [selectedDateLabel, setSelectedDateLabel] = useState('');

  /* 🔹 TOP SWITCH */
  const [activeTopTab, setActiveTopTab] =
    useState<'calendar' | 'currentMonth'>('calendar');

  /* 🔹 MONTH DROPDOWN STATE */
  const [monthView, setMonthView] =
    useState<'current' | 'last'>('current');

  useEffect(() => {
    fetchEventCalendarData(currentYear, currentMonthIndex);
  }, [currentYear, currentMonthIndex]);

  /* 🔹 Fetch events */
  const fetchEventCalendarData = async (
    year: number,
    monthIndex: number
  ) => {
    try {
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      if (!schoolCode) return;

      const [eventRes, meetingRes] = await Promise.all([
        fetch(
          `${ADMIN_API_BASE}/admin-events?schoolCode=${encodeURIComponent(schoolCode)}&year=${encodeURIComponent(
            String(year)
          )}&month=${encodeURIComponent(String(monthIndex + 1))}`
        ),
        fetch(
          `${ADMIN_API_BASE}/admin-meetings?schoolCode=${encodeURIComponent(schoolCode)}&year=${encodeURIComponent(
            String(year)
          )}&month=${encodeURIComponent(String(monthIndex + 1))}`
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
    } catch (err) {
      console.error('Error fetching events', err);
      setEvents([]);
    }
  };

  /* 🔹 Calendar Days */
/* 🔹 Calendar Days */
const createCalendarDays = (
  year: number,
  monthIndex: number,
  daysInMonth: number,
  startDay: number
) => {
  const days: React.ReactNode[] = [];

  for (let i = 0; i < startDay; i++) {
    days.push(<View key={`empty-${i}`} style={styles.emptyDay} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === monthIndex &&
      today.getDate() === day;

    const dayKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter((e) => e.date === dayKey);

    // 🔹 Approved request only
    const approvedRequest = requests.find(
      r =>
        r.status === 'approved' &&
        new Date(r.request_date).getFullYear() === year &&
        new Date(r.request_date).getMonth() === monthIndex &&
        new Date(r.request_date).getDate() === day
    );

    const dayStyle = [
      styles.day,
      approvedRequest && styles.approvedDay, // ✅ ONLY approved colored
      selectedRequestDate === `${year}-${monthIndex + 1}-${day}` &&
        styles.eventDaySelected,
      isToday && styles.today,
    ].filter(Boolean);

    days.push(
      <TouchableOpacity
        key={day}
        style={dayStyle}
        onPress={() => {
          setSelectedRequestDate(`${year}-${monthIndex + 1}-${day}`);

          // 🔹 Show extra class info if approved
          if (approvedRequest) {
            Alert.alert(
              'Extra Class Approved ✅',
              `Class: ${approvedRequest.class}`
            );
            return;
          }

          // 🔹 Normal event modal
          if (dayEvents.length > 0) {
            setSelectedDayItems(dayEvents);
            setSelectedDateLabel(formatCalendarDateLabel(dayKey));
            setModalVisible(true);
          }
        }}
      >
        <Text style={isToday ? styles.todayText : styles.dayText}>
          {day}
        </Text>
      </TouchableOpacity>
    );
  }

  return days;
};



  const generateCalendar = () => {
    const firstDay = new Date(currentYear, currentMonthIndex, 1);
    const daysInMonth = new Date(
      currentYear,
      currentMonthIndex + 1,
      0
    ).getDate();

    return (
      <View style={styles.month}>
        <View style={styles.weekdays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
            d => (
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            )
          )}
        </View>

        <View style={styles.days}>
          {createCalendarDays(
            currentYear,
            currentMonthIndex,
            daysInMonth,
            firstDay.getDay()
          )}
        </View>
      </View>
    );
  };
console.log('showClassDropdown:', showClassDropdown);
console.log('availableClasses:', availableClasses);

  /* 🔹 Submit request */
const submitRequest = async () => {
  if (!selectedClass || !selectedRequestDate) {
    Alert.alert('Error', 'Please select a class and a date.');
    return;
  }

  try {
    // Make sure we have the latest schoolCode
    const storedSchoolCode = schoolCode || (await AsyncStorage.getItem('schoolCode'));
    if (!storedSchoolCode) {
      Alert.alert('Error', 'School code not found.');
      return;
    }

    const requestData = {
      teacherName: name,
      class: selectedClass,
      date: selectedRequestDate,
      addressRequest,
      reason: reasonText,
      schoolCode: storedSchoolCode, // <-- send from AsyncStorage
    };

    const res = await axios.post('http://162.215.210.38:3010/api/admin/request', requestData);
    if (res.status === 200) {
      Alert.alert('Success', 'Request sent for approval');

      // Reset form
      setAddressRequest(false);
      setReasonRequest(false);
      setReasonText('');
      setSelectedRequestDate(null);
    }
  } catch (err) {
    console.error('Error submitting request', err);
    Alert.alert('Error', 'Failed to send request.');
  }
};
  const [requests, setRequests] = useState<TeacherRequest[]>([]);

  /* Fetch requests */
const fetchRequests = async () => {
  try {
    setLoading(true);

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
    setRequests(res.data);
  } catch (err) {
    console.error('❌ Error fetching requests:', err);
    Alert.alert('Error', 'Failed to fetch requests');
  } finally {
    setLoading(false);
  }
};


useEffect(() => {
  if (!schoolCode) return;

  fetchRequests(); // initial fetch

  const interval = setInterval(() => {
    console.log('🔁 Auto-refreshing requests');
    fetchRequests();
  }, 15000); // every 15 seconds

  return () => clearInterval(interval);
}, [schoolCode]);

const todayKey = new Date().toISOString().slice(0, 10);
const upcomingEvents = [...events]
  .filter((item) => item.date >= todayKey)
  .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
const upcomingExtraClasses = [...requests]
  .filter((row: any) => String(row?.status || '').toLowerCase() === 'approved')
  .filter((row: any) => {
    const dateKey = normalizeCalendarDate(row?.request_date);
    return !!dateKey && dateKey >= todayKey;
  })
  .sort(
    (a: any, b: any) =>
      normalizeCalendarDate(a?.request_date).localeCompare(normalizeCalendarDate(b?.request_date))
  );

const summaryCards = [
  {
    title: 'Events',
    subtitle: String(upcomingEvents.length),
    footer: upcomingEvents[0]
      ? `${formatCalendarDateLabel(upcomingEvents[0].date)} • ${upcomingEvents[0].title}`
      : 'No upcoming events',
    icon: 'calendar-outline',
    background: '#D7E8C9',
  },
  {
    title: 'Extra',
    subtitle: 'Classes',
    footer:
      upcomingExtraClasses.length > 0
        ? `${upcomingExtraClasses.length} upcoming`
        : 'No upcoming extra classes',
    icon: 'sparkles-outline',
    background: '#F2EE9E',
  },
];

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: hp('28%') }}
        nestedScrollEnabled
      >
    <View style={styles.container}>

                    <LinearGradient
                        pointerEvents="none"
                        colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
                        start={{ x: 0.05, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.dashboardTopGradient}
                      >
      <View style={local.summaryRow}>
        {summaryCards.map((card, index) => (
              <TeacherSummaryCard
                key={`${card.title}-${index}`}
                style={[
                  local.summaryCard,
                  index === 0 ? local.summaryCardLeft : local.summaryCardRight,
                ]}
              >
            <View style={local.summaryText}>
              <View style={local.summaryTitleRow}>
                <Text style={local.summaryNumber}>{card.title}</Text>
                <Text style={local.summarySubtitle}>{card.subtitle}</Text>
              </View>
              <Text style={local.summaryFooter}>{card.footer}</Text>
            </View>
            <View style={local.summaryIconWrap}>
              <Ionicons name={card.icon as any} size={28} color="#4C4C4C" />
            </View>
              </TeacherSummaryCard>
            ))}
          </View>
</LinearGradient>
      <View style={styles.syllabusContainerCalenders}>
        <ScrollView
          style={local.cardScroll}
          contentContainerStyle={local.cardScrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.syllabusContent}>
                            
                        

      {/* 🔹 CALENDAR VIEW */}
      {(activeTopTab === 'calendar' || activeTopTab === 'currentMonth') && (
        <View style={styles.calendarContainer}>
        <View style={styles.monthNavigation}>
  <TouchableOpacity
    style={styles.navBtn}
    onPress={() =>
      setCurrentMonthIndex(prev => (prev === 0 ? 11 : prev - 1))
    }
  >
    <Ionicons name="chevron-back" size={24} color="#000" />
  </TouchableOpacity>

  <Text style={styles.monthTitle}>
    {new Date(currentYear, currentMonthIndex).toLocaleString('default', {
      month: 'long',
    })}
  </Text>

  <TouchableOpacity
    style={styles.navBtn}
    onPress={() =>
      setCurrentMonthIndex(prev => (prev === 11 ? 0 : prev + 1))
    }
  >
    <Ionicons name="chevron-forward" size={24} color="#000" />
  </TouchableOpacity>
</View>

          {generateCalendar()}
        </View>
      )}

<View style={styles.notchContainerRelative}>
                                        <View style={styles.leftNotch} />
                                        <View style={styles.dashedLine} />
                                        <View style={styles.rightNotch} />
                                      </View>
                                      {/* 🔹 EXTRA ACTION BUTTONS */}
<View style={styles.extraButtonRow1}>
<TouchableOpacity
  style={styles.extraBtn}
  onPress={() => {
    console.log('✅ Extra Class clicked → showing dropdown');
    setShowClassDropdown(prev => !prev); // 🔴 THIS WAS MISSING
  }}
>
  <Text style={styles.extraBtnText}>Extra Class</Text>
  
</TouchableOpacity>


       <TouchableOpacity
          style={styles.extraBtn}
          onPress={() => setAddressRequest(true)}
        >
          <Text style={styles.extraBtnText}>Address</Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.extraBtn}
          onPress={() => setReasonRequest(true)}
        >
          <Text style={styles.extraBtnText}>Reason</Text>
        </TouchableOpacity>
         <TouchableOpacity onPress={submitRequest}>
          <Image source={ticketicon} style={[styles.iconImage, { tintColor: '#0a3d62' }]} />

              </TouchableOpacity>
</View>
{showClassDropdown && (
  <View style={styles.classDropdownWrapper}>
    <Picker
      selectedValue={selectedClass}
      onValueChange={(value: string) => setSelectedClass(value)}
      style={{ color: "black" }}   // Picker selected text
    >
      <Picker.Item label="Select Class" value="" color="black" />

      {availableClasses.map((cls) => (
        <Picker.Item
          key={cls}
          label={cls}
          value={cls}
          color="black"   // Force black color for dropdown items
        />
      ))}
    </Picker>
  </View>
)}
      <Modal
  transparent
  animationType="fade"
  visible={reasonRequest}
  onRequestClose={() => setReasonRequest(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.reasonModal}>
      <Text style={styles.modalTitle}>Enter Reason</Text>

      <TextInput
        placeholder="Enter reason here..."
        placeholderTextColor="#9CA3AF"
        value={reasonText}
        onChangeText={setReasonText}
        style={[styles.reasonInput, local.reasonInputFix]}
        multiline
      />

      <View style={styles.modalBtnRow}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => {
            setReasonText('');
            setReasonRequest(false);
          }}
        >
          <Text style={styles.btnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => setReasonRequest(false)}
        >
          <Text style={styles.btnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

      {/* 🔹 EVENT MODAL */}
      <Modal transparent visible={modalVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedDayItems.length > 0 && (
              <>
                <Text style={styles.modalText}>{selectedDateLabel}</Text>
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  {selectedDayItems.map((item, index) => (
                    <View key={`${item.id || item.title}-${index}`} style={{ marginTop: 10 }}>
                      <Text style={styles.modalText}>{item.title}</Text>
                      <Text style={[styles.modalText, { fontSize: 12, color: '#4B5563' }]}>
                        {item.kind === 'meeting' ? 'Meeting' : 'Event'}
                        {item.subtitle ? ` • ${item.subtitle}` : ''}
                        {item.time ? ` • ${formatCalendarTime(item.time)}` : ''}
                      </Text>
                      {item.description ? (
                        <Text style={[styles.modalText, { fontSize: 12, color: '#4B5563', marginTop: 4 }]}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedDayItems([]);
                    setSelectedDateLabel('');
                  }}
                >
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      <Modal
  visible={showTeacherTableModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowTeacherTableModal(false)}
>
  <TouchableWithoutFeedback onPress={() => setShowTeacherTableModal(false)}>
    {/* ADD THIS OVERLAY VIEW */}
    <View style={modalStyles.overlay}> 
      
      <TouchableWithoutFeedback onPress={() => {}}>
        <View style={modalStyles.container}>
          {/* Header */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>My Timetable</Text>
            <TouchableOpacity onPress={() => setShowTeacherTableModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {loading ? (
              <ActivityIndicator color="gray" style={{ marginTop: 20 }} />
            ) : (
              /* The component handles its own horizontal scrolling now */
              <TeacherTimetableComponent data={teacherTimetable} />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>

    </View>
  </TouchableWithoutFeedback>
      </Modal>
          </View>
        </ScrollView>
      </View>
    </View>
  </ScrollView>
      <TeacherFooter />
</View>
  );
};

export default TeacherEventCalendar;
