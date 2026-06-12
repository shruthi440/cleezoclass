import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  Platform,Image,
  TextInput,ActivityIndicator,
  Keyboard,RefreshControl,Modal,
  StyleSheet
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import usersicon from '../icons/user (1).png'
import editIcon from '../icons/edit.png'
import { ThemeContext } from '../ThemeContext';
import { globalStyles as styles } from '../teacherStyles';
import ticketIcon from '../icons/application.png'
import { useNextClass } from '../NextClassContext';
import TeacherFooter from './TeacherFooter';
import TeacherSummaryCard from './TeacherSummaryCard';

const BASE_URL = 'https://cleezoclass.com:4000';

const TeacherChatAndEvents = ({ route, navigation }: any) => {
  const routeParams = route?.params || {};
  const routeName = routeParams.name || '';
  const routeUsername = routeParams.username || '';
  const { themeStyles } = useContext(ThemeContext);

  const isMounted = useRef(true);
  const { nextClass } = useNextClass();
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'chat' | 'meetings'>('chat');
  const [teacherName, setTeacherName] = useState(routeName);
  const [teacherUsername, setTeacherUsername] = useState(routeUsername);
    const [chatSummary, setChatSummary] = useState({
    total_chats: 0,
    chats_pending_approval: 0,
    chats_accepted: 0,
  });
  const [eventSummary, setEventSummary] = useState({
    total_events: 0,
    upcoming_events: 0, // Changed from constant 4 to 0
    conducted_events: 1, // Retaining as constant/fallback
    events_pending_approval: 0, // NEW STATE FIELD for the accurate dashboard count
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportType, setReportType] = useState<'meetings' | 'events' | 'chats' | null>(null);
const openReportModal = (type: 'meetings' | 'events' | 'chats') => {
  setReportType(type);

  // Set the data depending on type
  switch(type) {
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
  const summaryCards = useMemo(() => [
    {
      label: 'Live Chats',
      value: String(chatSummary.total_chats),
      footer: `${chatSummary.chats_accepted} approved`,
      action: () => openReportModal('chats'),
    },
    {
      label: 'Upcoming Events',
      value: String(eventSummary.upcoming_events),
      footer: `${eventSummary.events_pending_approval} waiting`,
      action: () => openReportModal('events'),
    },
  ], [
    chatSummary.total_chats,
    chatSummary.chats_accepted,
    eventSummary.upcoming_events,
    eventSummary.events_pending_approval,
  ]);

  // ------------------------------
  // NEW EVENT DETAIL STATES
  // ------------------------------
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showUpcomingEventsPopup, setShowUpcomingEventsPopup] = useState(false);
  const [showCompletedEventsPopup, setShowCompletedEventsPopup] = useState(false);
  const [completedEvents, setCompletedEvents] = useState([]); // Corrected state definition
  const [loadingCompletedEvents, setLoadingCompletedEvents] = useState(false); // Corrected state definition
  // Fetch Chat Summary
  const fetchChatSummary = async () => {
    try {
      const res = await axios.get("https://cleezoclass.com:4000/api/api/chat-summary", {
        params: { schoolCode },
      });
      setChatSummary(res.data);
    } catch (err) {
      console.error("Error fetching chat summary:", err);
    }
  };
  useEffect(() => {
    fetchChatSummary();
    fetchTotalEvents();
    fetchUpcomingEvents(); // Fetch event list (now fetches PENDING list)
    fetchPendingEventsCount(); // Fetch the count of PENDING events
  }, [ schoolCode]);

  // Fetch Total Events Count
  const fetchTotalEvents = async () => {
    try {
      const res = await axios.get("https://cleezoclass.com:4000/api/api/event-summary", {
        params: { schoolCode },
      });
      setEventSummary((prev) => ({
        ...prev,
        total_events: res.data.total_events || 0,
      }));
    } catch (err) {
      console.error("Error fetching event summary:", err);
    }
  };

  // Fetch Pending Events Count
  const fetchPendingEventsCount = async () => {
    try {
      const res = await axios.get("https://cleezoclass.com:4000/api/api/pending-events-count", {
        params: { schoolCode },
      });
      setEventSummary((prev) => ({
        ...prev,
        events_pending_approval: res.data.events_pending_approval || 0,
      }));
    } catch (err) {
      console.error("Error fetching pending events count:", err);
    }
  };

const fetchCompletedEvents = async () => {
  console.log("Fetching completed events for schoolCode:", schoolCode);
  setLoadingCompletedEvents(true);

  try {
    const res = await axios.get("https://cleezoclass.com:4000/api/api/completed-events", {
      params: { schoolCode },
    });

    console.log("Completed events data:", res.data);
    setCompletedEvents(res.data);

    // Update the count in summary
    setEventSummary(prev => ({
      ...prev,
      conducted_events: res.data.length || 0
    }));

    console.log("Updated conducted_events count:", res.data.length || 0);
  } catch (err) {
    console.error("Error fetching completed events:", err);
  } finally {
    setLoadingCompletedEvents(false);
  }
};
const fetchUpcomingEvents = async () => {
  console.log("Fetching upcoming events for schoolCode:", schoolCode); 

  setLoadingEvents(true);
  try {
    // NOTE: This now fetches only events with status='pending'
    const res = await axios.get("https://cleezoclass.com:4000/api/api/upcoming-events", {
      params: { schoolCode },
    });

    console.log("Response data:", res.data);

    setUpcomingEvents(res.data);

    // Update the main 'upcoming_events' count state to reflect the fetched list count
    setEventSummary(prev => ({ 
      ...prev, 
      upcoming_events: res.data.length || 0 
    })); 

    console.log("Updated event summary:", res.data.length || 0);
  } catch (err) {
    console.error("Error fetching upcoming events:", err);
  } finally {
    setLoadingEvents(false);
    console.log("Loading events state set to false");
  }
};
useEffect(() => {
  fetchUpcomingEvents();
  fetchCompletedEvents();
}, []);
  // dropdowns
  const [classList, setClassList] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [indClass, setIndClass] = useState('');
  const [indSection, setIndSection] = useState('');
  const [indStudent, setIndStudent] = useState('');

  // teacher
  const [teacherData, setTeacherData] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);

  // datetime
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  const [sending, setSending] = useState(false);

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    isMounted.current = true;
    init();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const init = async () => {
    const code = await AsyncStorage.getItem('schoolCode');
    const storedUsername = await AsyncStorage.getItem('username');
    const storedName = await AsyncStorage.getItem('name');
    const activeUsername = routeUsername || storedUsername || '';
    const activeName = routeName || storedName || '';

    setTeacherUsername(activeUsername);
    setTeacherName(activeName);
    setSchoolCode(code);

    try {
      await Promise.all([
        fetchClasses(code),
        fetchTeachers(code, activeUsername, activeName),
      ]);
    } catch (err) {
      console.error('Init load failed:', err);
    }
  };

  const fetchClasses = async (code: string | null) => {
    if (!code) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/admin/classes`, { params: { schoolCode: code } });
      setClassList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching classes:', err);
      setClassList([]);
    }
  };

  const fetchTeachers = async (code: string | null, activeUsername?: string, activeName?: string) => {
    if (!code) return;
    const resolvedUsername = activeUsername || teacherUsername;
    const resolvedName = activeName || teacherName;

    try {
      const res = await axios.get(`${BASE_URL}/teachers`, { params: { schoolCode: code } });
      setTeacherData(res.data || []);

      const loggedTeacher =
        (res.data || []).find((t: any) => t.username === resolvedUsername) ||
        (res.data || []).find((t: any) => t.name === resolvedName);

      if (loggedTeacher?.id) {
        setSelectedTeacherId(Number(loggedTeacher.id));
        return;
      }
    } catch (err) {
      console.error('Error fetching teachers list:', err);
    }

    // Fallback: direct lookup by username from 3010 API
    if (resolvedUsername) {
      try {
        const detailRes = await axios.get(`http://162.215.210.38:3010/api/get-teacher-name`, {
          params: { username: resolvedUsername, schoolCode: code },
        });
        if (detailRes?.data?.id) {
          setSelectedTeacherId(Number(detailRes.data.id));
        }
      } catch (err) {
        console.error('Error fetching teacher details:', err);
      }
    }
  };

  /* ---------------- DEPENDENT DROPDOWNS ---------------- */
  useEffect(() => {
    if (indClass && schoolCode) {
      setIndSection('');
      setIndStudent('');
      setStudents([]);
      axios
        .get(`${BASE_URL}/api/admin/sectionFilter`, { params: { schoolCode } })
        .then(res => {
          const sectionRows = Array.isArray(res.data) ? res.data : [];
          const filtered = sectionRows.filter((row: any) => {
            const rowClass = String(row?.class_name ?? row?.class ?? row?.class_id ?? '').trim();
            return rowClass === String(indClass).trim();
          });
          const uniqueSections = [...new Set(filtered.map((row: any) => String(row?.section ?? '').trim()).filter(Boolean))];
          setSections(uniqueSections);
        })
        .catch(err => {
          console.error('Error fetching sections:', err);
          setSections([]);
        });
    }
  }, [indClass, schoolCode]);

  const loadStudents = async (classNameArg?: string, sectionArg?: string) => {
    try {
      const activeSchoolCode = (await AsyncStorage.getItem('schoolCode')) || schoolCode;
      const classToLoad = classNameArg || indClass;
      const sectionToLoad = sectionArg || indSection;

      if (!classToLoad || !sectionToLoad || !activeSchoolCode) {
        return;
      }

      setIndStudent('');
      setStudents([]);

      const response = await fetch('http://162.215.210.38:3010/api/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: classToLoad,
          section: sectionToLoad,
          schoolCode: activeSchoolCode,
        }),
      });

      const data = await response.json();
      if (data.success && Array.isArray(data.students)) {
        const sorted = data.students
          .filter((s: any) => s?.name)
          .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
        setStudents(sorted);
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      Alert.alert('Error', 'Failed to load students');
      setStudents([]);
    }
  };

  useEffect(() => {
    if (!indClass || !indSection || !schoolCode) return;
    loadStudents(indClass, indSection);
  }, [indClass, indSection, schoolCode]);

  /* ---------------- DATE PICKER ---------------- */
  const openDateTimePicker = () => {
    Keyboard.dismiss();
    setPickerMode('date');
    setShowPicker(true);
  };

  const onChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);

    if (event.type === 'set' && date) {
      setSelectedDate(date);
      setDateConfirmed(true);

      if (pickerMode === 'date' && Platform.OS === 'android') {
        setTimeout(() => {
          setPickerMode('time');
          setShowPicker(true);
        }, 200);
      }
    }
  };

  /* ---------------- SEND CHAT ---------------- */
  const handleSendChat = async () => {
    if (!indClass || !indSection || !indStudent || !dateConfirmed) {
      Alert.alert('Error', 'Fill all fields');
      return;
    }

    if (!selectedTeacherId) {
      Alert.alert('Error', 'Teacher ID missing');
      return;
    }

    const payload = {
      schoolCode,
      party1_id: selectedTeacherId,
      party1_name: teacherName || teacherUsername,
      party2_class: indClass,
      party2_section: indSection,
      party2_student: indStudent,
      scheduled_at: selectedDate.toISOString(),
    };

    try {
      setSending(true);
      await axios.post(`${BASE_URL}/api/chat-requests`, payload);
      Alert.alert('Success', 'Chat request sent');

      setIndClass('');
      setIndSection('');
      setIndStudent('');
      setDateConfirmed(false);
      setSelectedDate(new Date());
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.response?.data?.message || 'Failed');
    } finally {
      setSending(false);
    }
  };
  const [agendaItem, setAgendaItem] = useState('');
   const [chatRequests, setChatRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);

const onRefresh = async () => {
  setRefreshing(true);
  await fetchChatRequests();
  setRefreshing(false);
};

  useEffect(() => {
    fetchChatRequests();
  }, [schoolCode]);
  const fetchChatRequests = async () => {
    try {
      setLoading(true);
      const res = await axios.get('https://cleezoclass.com:4000/api/chat-requests', {
        params: { schoolCode }
      });
      setChatRequests(res.data || []);
    } catch (err) {
      console.error('Error fetching chat requests:', err);
    } finally {
      setLoading(false);
    }
  };
    const [meetingNo, setMeetingNo] = useState('');
  
const handleAddAgenda = async () => {
  // 1. Check if all fields are present
  if (!meetingNo || !agendaItem) {
    Alert.alert('Error', 'Please select a meeting number and enter an agenda name.');
    return;
  }

  // 2. Ensure schoolCode is available
  if (!schoolCode) {
    const code = await AsyncStorage.getItem('schoolCode');
    if (!code) {
      Alert.alert('Error', 'School code is missing');
      return;
    }
  }

  try {
    setSending(true); // Re-use the sending state for a loader
    const response = await axios.post('https://cleezoclass.com:4000/api/agenda', { 
      meetingNo, 
      agendaItem, 
      schoolCode: schoolCode 
    });

    if (response.status === 200 || response.status === 201) {
      Alert.alert('Success', 'Meeting  added successfully');
      setAgendaItem('');
      setMeetingNo(''); // Reset the picker
    }
  } catch (err) {
    console.error(err);
    Alert.alert('Error', 'Failed to submit meeting. Check if the server endpoint /agenda exists.');
  } finally {
    setSending(false);
  }
};
const approvedChats = chatRequests.filter(
  chat => chat.status === 'approved' && chat.party2_student !== null && chat.party1_name === (teacherName || teacherUsername)
);

const endedChats = chatRequests.filter(
  chat => (chat.status === 'pending' || chat.status === 'completed') && chat.party2_student !== null && chat.party1_name === (teacherName || teacherUsername)
);


  if (loading) {
    return <ActivityIndicator size="large" color="#0088cc" style={{ marginTop: 50 }} />;
  }
  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={ui.screen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
        contentContainerStyle={ui.scrollContent}
      >
        <View style={ui.container}>
         

          <View style={ui.summaryGrid}>
            {summaryCards.map((card, index) => (
              <TeacherSummaryCard
                key={card.label}
                style={[
                  ui.summaryCard,
                  index === 0 ? ui.summaryCardLeft : ui.summaryCardRight,
                ]}
                onPress={card.action}
              >
                <Text style={ui.summaryLabel}>{card.label}</Text>
                <Text style={ui.summaryAmount}>{card.value}</Text>
                <Text style={ui.summaryFooter}>{card.footer}</Text>
              </TeacherSummaryCard>
            ))}
          </View>

          <View style={ui.card}>
            <Text style={ui.sectionLabel}>Mode</Text>
            <View style={ui.segmentRow}>
              <TouchableOpacity
                style={[ui.segmentBtn, selectedTab === 'chat' && ui.segmentBtnActive]}
                onPress={() => setSelectedTab('chat')}
              >
                <Text style={[ui.segmentText, selectedTab === 'chat' && ui.segmentTextActive]}>Live Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ui.segmentBtn, selectedTab === 'meetings' && ui.segmentBtnActive]}
                onPress={() => setSelectedTab('meetings')}
              >
                <Text style={[ui.segmentText, selectedTab === 'meetings' && ui.segmentTextActive]}>Meetings</Text>
              </TouchableOpacity>
            </View>

            {selectedTab === 'chat' ? (
              <View style={ui.formCard}>
                <View style={ui.pickerRow}>
                  <View style={styles.dropdownContainer}>
                    <Picker
                      selectedValue={indClass}
                      onValueChange={setIndClass}
                      style={styles.dropdownText}
                      dropdownIconColor="#111827"
                    >
                      <Picker.Item label="Class" value="" style={{ fontSize: 14 }} />
                      {classList.map(c => (
                        <Picker.Item key={c} label={c} value={c} />
                      ))}
                    </Picker>
                  </View>
                  <View style={styles.dropdownContainer}>
                    <Picker
                      selectedValue={indSection}
                      onValueChange={setIndSection}
                      style={styles.dropdownText}
                      dropdownIconColor="#111827"
                    >
                      <Picker.Item label="Section" value="" style={{ fontSize: 14 }} />
                      {sections.map(s => (
                        <Picker.Item key={s} label={s} value={s} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={ui.pickerRow}>
                  <View style={styles.dropdownContainer}>
                    <Picker
                      selectedValue={indStudent}
                      onValueChange={setIndStudent}
                      style={styles.dropdownText}
                      dropdownIconColor="#111827"
                    >
                      <Picker.Item label="Student" value="" style={{ fontSize: 14 }} />
                      {students.map((s: any) => (
                        <Picker.Item key={s.username || s.id || s.name} label={s.name} value={s.name} />
                      ))}
                    </Picker>
                  </View>
                  <TouchableOpacity onPress={openDateTimePicker} style={styles.dropdownContainer}>
                    <Text style={styles.dropdownText}>
                      {dateConfirmed ? selectedDate.toLocaleString() : 'Set Date & Time'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={ui.submitButton} onPress={handleSendChat} disabled={sending}>
                  <Image source={ticketIcon} style={[styles.iconImage, { tintColor: '#0a3d62' }]} />
                  <Text style={ui.submitButtonText}>{sending ? 'Sending...' : ''}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={ui.formCard}>
                <View style={styles.dropdownContainer}>
                  <Picker
                    selectedValue={meetingNo}
                    onValueChange={setMeetingNo}
                    dropdownIconColor="#111827"
                    style={styles.dropdownText}
                  >
                    <Picker.Item label="Meeting No" value="" />
                    {['1', '2', '3', '4', '5'].map(n => (
                      <Picker.Item key={n} label={`Meeting ${n}`} value={n} />
                    ))}
                  </Picker>
                </View>
                <TextInput
                  placeholder="Enter meeting name..."
                  placeholderTextColor="#9CA3AF"
                  value={agendaItem}
                  onChangeText={setAgendaItem}
                  style={ui.agendaInput}
                  multiline
                />
                <TouchableOpacity onPress={handleAddAgenda} style={ui.submitButton}>
                  <Text style={ui.submitButtonText}>{sending ? 'Saving...' : 'Add Meeting'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {selectedTab === 'chat' && (
            <View style={ui.card}>
              <Text style={ui.sectionLabel}>Pending chats</Text>
              <View style={ui.pendingChatsBox}>
                <ScrollView
                  style={ui.pendingChatsScroll}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  contentContainerStyle={ui.pendingChatsScrollContent}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                  {endedChats.length > 0 ? (
                    endedChats
                      .filter(chat => chat.party2_student && chat.party1_name === (teacherName || teacherUsername))
                      .map(chat => (
                        <View key={chat.id} style={ui.listItem}>
                          <Text style={ui.listItemMain} numberOfLines={1}>
                            {chat.party2_student || 'N/A'}
                          </Text>
                          <Text style={ui.listItemMeta}>
                            {chat.party2_class || 'N/A'} • {chat.party2_section || 'N/A'}
                          </Text>
                        </View>
                      ))
                  ) : (
                    <Text style={ui.emptyText}>No pending chats</Text>
                  )}
                </ScrollView>
              </View>

              <Text style={[ui.sectionLabel, { marginTop: 12 }]}>Approved chats</Text>
              <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {approvedChats.length > 0 ? (
                  approvedChats
                    .filter(chat => chat.party2_student && chat.party1_name === (teacherName || teacherUsername))
                    .map(chat => (
                      <TouchableOpacity
                        key={chat.id}
                        style={ui.listItem}
                        onPress={() =>
                          navigation.navigate('TeacherMessage', {
                            username: teacherUsername,
                            name: teacherName,
                          })
                        }
                      >
                        <Text style={ui.listItemMain} numberOfLines={1}>
                          {chat.party2_student || 'N/A'}
                        </Text>
                        <Text style={ui.listItemMeta}>
                          {chat.party2_class || 'N/A'} • {chat.party2_section || 'N/A'}
                        </Text>
                      </TouchableOpacity>
                    ))
                ) : (
                  <Text style={ui.emptyText}>No approved chats</Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode={pickerMode}
          is24Hour
          display="default"
          onChange={onChange}
        />
      )}
      <Modal
  visible={showReportModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowReportModal(false)}
>
  <View style={{
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  }}>
    <View style={{
      backgroundColor: 'white',
      padding: 20,
      borderRadius:20,
      width: '100%',
      maxHeight: '80%',
      borderWidth:2,
      borderColor:'#000'
    }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        {reportType === 'meetings' ? 'Meetings Conducted' :
         reportType === 'events' ? 'Event Summary' : 'Chat Summary'}
      </Text>

      {reportData && reportType === 'events' && (
        <>
          <Text>Total Events: {reportData.total_events}</Text>
          <Text>Upcoming Events: {reportData.upcoming_events}</Text>
          <Text>Conducted Events: {reportData.conducted_events}</Text>
          <Text>Pending Approval: {reportData.events_pending_approval}</Text>
        </>
      )}

      {reportData && reportType === 'chats' && (
        <>
          <Text>Total Chats: {reportData.total_chats}</Text>
          <Text>Pending Approval: {reportData.chats_pending_approval}</Text>
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
        <Text style={{ color: '#0088cc', fontWeight: 'bold' }}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
    <TeacherFooter />
    </SafeAreaView>
  );
};

const ui = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  container: {
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9ECF2',
  },
  heroKicker: {
    color: '#7A7F87',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#5F6672',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  summaryCard: {
    width: '48%',
    minHeight: 92,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 10,
  },
  summaryCardLeft: { marginRight: 8 },
  summaryCardRight: { marginLeft: 8 },
  summaryLabel: {
    fontSize: 12,
    color: '#000',
    fontWeight: '700',
  },
  summaryAmount: {
    marginTop: 6,
    fontSize: 18,
    color: '#000',
    fontWeight: '800',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 10,
  },
  summaryFooter: {
    color: '#000',
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#f6f6f7',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f6f7f7',
  },
  sectionLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#f6f6f7',
    padding: 4,
    borderRadius: 18,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
        borderWidth: 1,
    borderColor: '#ccc',
  },
  segmentBtnActive: {
    backgroundColor: '#f6f6f7',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  segmentText: {
    color: '#000',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#000',
  },
  formCard: {
    marginTop: 12,
    backgroundColor: '#f6f6f7',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EBF0',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  dateButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dateButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  agendaInput: {
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    color: '#111827',
    textAlignVertical: 'top',
    marginTop: 4,
  },
  submitButton: {
  width: 60,
  height: 60,
  backgroundColor: '#f6f6f7',
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  marginLeft: 0,
  elevation: 4,
  borderColor:'#F06292',
  borderWidth:2
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pendingChatsBox: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  pendingChatsScroll: {
    height: 200,
  },
  pendingChatsScrollContent: {
    paddingBottom: 6,
  },
  listItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderColor: '#E8EBF0',
    marginBottom: 10,
  },
  listItemMain: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
  },
  listItemMeta: {
    color: '#6B7280',
    marginTop: 4,
    fontSize: 12,
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default TeacherChatAndEvents;
