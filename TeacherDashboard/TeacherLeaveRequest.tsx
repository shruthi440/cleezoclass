import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemeContext } from '../ThemeContext';
import TeacherFooter from './TeacherFooter';
import { globalStyles as styles } from '../teacherStyles';
import TeacherSummaryCard from './TeacherSummaryCard';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as DocumentPicker from '@react-native-documents/picker';
import { Picker } from '@react-native-picker/picker';
import sendIcon from '../icons/application.png'
import usersicon from '../icons/user (1).png'
import editIcon from '../icons/edit.png'
import { useNextClass } from '../NextClassContext';
import LinearGradient from 'react-native-linear-gradient';
/* ---------------- TYPES ---------------- */
type RootStackParamList = {
  TeacherLeaveRequest: {
    username?: string;
    name?: string;
  };
};

interface Teacher { id: number; name: string; class?: string; }
interface Attendance { id: number; username: string; date: string; status: string; entry_time?: string; exit_time?: string; }
interface MonthlySalaryData {
  base_salary: number; deductions: number; bonuses: number; final_salary: number;
  status: string; payment_date?: string; salary_month?: string; hra: number;
  pf: number; professional_tax: number; mediclaim: number; salary_type: string;
}

type UserType = 'self' | 'student';

const TeacherLeaveRequest: React.FC<NativeStackScreenProps<RootStackParamList, 'TeacherLeaveRequest'>> = ({ route }) => {
  const { name } = route.params;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonthIndex = new Date().getMonth();
  const { nextClass } = useNextClass();
  const { height } = useWindowDimensions();
  const requestsBoxHeight = Math.max(Math.min(height * 0.34, 320), 220);
  // Tab & Form States
  const [activeTab, setActiveTab] = useState<UserType>('self');
  const [fromDate, setFromDate] = useState<Date>(new Date());
  const [toDate, setToDate] = useState<Date>(new Date());
  const [reason, setReason] = useState('');
  const [leaveLetter, setLeaveLetter] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
const [showSLModal, setShowSLModal] = useState(false);
const openSLModal = () => setShowSLModal(true);
const closeSLModal = () => setShowSLModal(false);

  // Data States
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [teacherDetails, setTeacherDetails] = useState({ id: '', designation: '' });
  const [studentDetails, setStudentDetails] = useState({ student_name: '', class_name: '', section: '' });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [teacherSelfRequests, setTeacherSelfRequests] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[currentMonthIndex]);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [monthlySalaryData, setMonthlySalaryData] = useState<MonthlySalaryData | null>(null);
  const [presentDays, setPresentDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const summaryCards = useMemo(() => [
    {
      label: 'Self Leaves',
      value: String(teacherSelfRequests.length),
      footer: 'Requests submitted by you',
    },
    {
      label: 'Student Leaves',
      value: String(pendingRequests.length),
      footer: 'Pending approvals to review',
    },
  ], [teacherSelfRequests.length, pendingRequests.length]);

  // Initial Data Load
  useEffect(() => {
    const init = async () => {
      const storedCode = await AsyncStorage.getItem('schoolCode');
      const username = await AsyncStorage.getItem('username');
      setSchoolCode(storedCode);
      if (storedCode && username) {
        fetchTeacherInfo(username, storedCode);
        fetchStudentInfo(username, storedCode);
        fetchTeacherSelfRequests();
        // Fetch Payroll info for the first time
        // Note: You'd need the teacher ID from fetchTeacherInfo or a separate call
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab === 'student') fetchTeacherLeaveRequests();
  }, [activeTab]);

  const fetchTeacherInfo = async (user: string, code: string) => {
    try {
      const res = await axios.get(`http://162.215.210.38:3010/api/get-teacher-name?username=${user}&schoolCode=${code}`);
      setTeacherDetails({ id: res.data.id, designation: res.data.designation });
      fetchSalaryAndAttendance(res.data.id, selectedMonth);
    } catch (err) { console.error("Error fetching teacher details", err); }
  };

  const fetchStudentInfo = async (user: string, code: string) => {
    try {
      const res = await axios.get(`http://162.215.210.38:3010/api/student-details?username=${user}&schoolCode=${code}`);
      setStudentDetails({ student_name: res.data.student_name, class_name: res.data.class_name, section: res.data.section });
    } catch (err) { console.error("Error fetching student details", err); }
  };

  const fetchTeacherSelfRequests = async () => {
    try {
      const storedUsername = await AsyncStorage.getItem('username');
      const storedCode = await AsyncStorage.getItem('schoolCode');
      const url = `http://162.215.210.38:3010/api/get-teacher-leaves?username=${storedUsername}&schoolCode=${storedCode}`;
      const res = await axios.get(url);
      setTeacherSelfRequests(res.data);
    } catch (err) { console.error("Error fetching teacher self requests", err); }
  };

  const fetchTeacherLeaveRequests = async () => {
    try {
      setLoadingRequests(true);
      const teacherUsername = await AsyncStorage.getItem('username');
      const nameRes = await fetch(`http://162.215.210.38:5000/api/api/teacher/name?username=${teacherUsername}`);
      const nameData = await nameRes.json();
      const teacherName = nameData.name.trim().toLowerCase();
      const res = await fetch(`http://162.215.210.38:5000/api/api/leave/pending`);
      const data = await res.json();
      const filtered = [];
      for (const request of data) {
        const classRes = await fetch(`http://162.215.210.38:5000/api/api/class/teacher?class_name=${request.class_name}&section=${request.section || ''}`);
        const classData = await classRes.json();
        if (classData.class_teacher?.trim().toLowerCase() === teacherName) filtered.push(request);
      }
      setPendingRequests(filtered);
    } catch (err) { console.error('Error filtering leave requests:', err); } finally { setLoadingRequests(false); }
  };

  const fetchSalaryAndAttendance = async (teacherId: any, month: string) => {
    try {
      setLoading(true);
      const sCode = await AsyncStorage.getItem('schoolCode');
      const year = new Date().getFullYear();
      const apiMonth = MONTHS.indexOf(month) + 1;

      const calcSalaryRes = await fetch(`https://cleezoclass.com:4000/calculated-salary/${teacherId}?schoolCode=${sCode}&month=${month}`);
      const calcSalaryData = await calcSalaryRes.json();

      const salaryApiRes = await fetch(`https://cleezoclass.com:4000/api/salary/${teacherId}?schoolCode=${sCode}&month=${apiMonth}&year=${year}`);
      const salaryApiData = await salaryApiRes.json();

      const attendanceRes = await fetch(`https://cleezoclass.com:4000/api/payroll/${teacherId}?schoolCode=${sCode}`);
      const attendanceRaw: Attendance[] = await attendanceRes.json();

      const filtered = attendanceRaw.filter(a => new Date(a.date).getMonth() === MONTHS.indexOf(month));
      setPresentDays(filtered.filter(a => a.status.toLowerCase() === 'present').length);
      setAttendanceData(filtered);

      setMonthlySalaryData({
        base_salary: Number(salaryApiData.salary_amount || 0),
        pf: Number(salaryApiData.pf || 0),
        professional_tax: Number(salaryApiData.professional_tax || 0),
        mediclaim: Number(salaryApiData.mediclaim || 0),
        hra: Number(salaryApiData.hra || 0),
        bonuses: Number(salaryApiData.bonuses || 0),
        deductions: Number(salaryApiData.pf || 0) + Number(salaryApiData.professional_tax || 0) + Number(salaryApiData.mediclaim || 0),
        final_salary: Number(calcSalaryData.final_salary || 0),
        status: calcSalaryData.status,
        salary_type: salaryApiData.salary_type || "monthly"
      });
    } catch (err) { console.log("Payroll info missing for this month"); } finally { setLoading(false); }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (teacherDetails.id) fetchSalaryAndAttendance(teacherDetails.id, month);
  };

  const handleSubmission = async () => {
    if (!reason.trim()) { Alert.alert("Required", "Please enter a reason."); return; }
    const submitStartedAt = Date.now();
    console.log('[TeacherLeaveRequest] submit started', {
      activeTab,
      teacherId: teacherDetails.id,
      teacherName: name,
      designation: teacherDetails.designation,
      schoolCode,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      reasonLength: reason.trim().length,
      hasLeaveLetter: !!leaveLetter,
      leaveLetterName: leaveLetter?.name || null,
    });
    setSubmitting(true);
    try {
      if (activeTab === 'self') {
        const payload = {
          teacher_id: teacherDetails.id, teacher_name: name, designation: teacherDetails.designation,
          leave_start_date: fromDate.toISOString().split('T')[0], leave_end_date: toDate.toISOString().split('T')[0],
          reason, schoolCode
        };
        console.log('[TeacherLeaveRequest] self leave payload', payload);
        const requestStartedAt = Date.now();
        const res = await axios.post('http://162.215.210.38:3010/api/leave-request', payload);
        console.log('[TeacherLeaveRequest] self leave response', {
          status: res.status,
          data: res.data,
          durationMs: Date.now() - requestStartedAt,
        });
      } else {
        const formData = new FormData();
        const username = await AsyncStorage.getItem('username');
        formData.append('username', username || '');
        formData.append('student_name', studentDetails.student_name);
        formData.append('class_name', studentDetails.class_name);
        formData.append('section', studentDetails.section);
        formData.append('reason', reason);
        formData.append('start_date', fromDate.toISOString().split('T')[0]);
        formData.append('end_date', toDate.toISOString().split('T')[0]);
        formData.append('schoolCode', schoolCode || '');
        if (leaveLetter) {
          formData.append('leave_letter', { uri: leaveLetter.uri, name: leaveLetter.name, type: leaveLetter.type } as any);
        }
        console.log('[TeacherLeaveRequest] student leave payload', {
          username,
          student_name: studentDetails.student_name,
          class_name: studentDetails.class_name,
          section: studentDetails.section,
          reasonLength: reason.trim().length,
          start_date: fromDate.toISOString().split('T')[0],
          end_date: toDate.toISOString().split('T')[0],
          schoolCode: schoolCode || '',
          hasAttachment: !!leaveLetter,
          attachmentName: leaveLetter?.name || null,
        });
        const requestStartedAt = Date.now();
        const res = await axios.post('http://162.215.210.38:3010/api/student-leave-request', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        console.log('[TeacherLeaveRequest] student leave response', {
          status: res.status,
          data: res.data,
          durationMs: Date.now() - requestStartedAt,
        });
      }
      console.log('[TeacherLeaveRequest] submit finished successfully', {
        durationMs: Date.now() - submitStartedAt,
      });
      Alert.alert("Success", "Leave request submitted successfully");
      setReason(''); setLeaveLetter(null);
      console.log('[TeacherLeaveRequest] refreshing requests after submit');
      fetchTeacherSelfRequests();
      if (activeTab === 'student') fetchTeacherLeaveRequests();
    } catch (error: any) {
      console.log('[TeacherLeaveRequest] submit failed', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      Alert.alert("Error", "Failed to submit request");
    } finally {
      console.log('[TeacherLeaveRequest] submit finished', {
        durationMs: Date.now() - submitStartedAt,
      });
      setSubmitting(false);
    }
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.pick({ type: [DocumentPicker.types.pdf, DocumentPicker.types.images] });
      if (res && res.length > 0) setLeaveLetter(res[0]);
    } catch (err) { if (!DocumentPicker.isCancel(err)) Alert.alert("Error", "Failed to select document."); }
  };
  const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'deductions' | 'takehome' | 'attendance' | 'overtime' | null>(null);
    const toggleModal = (type: 'deductions' | 'takehome' | 'attendance' | 'overtime') => {
    setModalType(type);
    setIsModalVisible(true);
  };

const renderModalContent = () => {
  switch (modalType) {
    case 'deductions':
      if (!monthlySalaryData) {
        return <Text style={styles.noDataText}>No Data Found</Text>;
      }
      return (
        <View>
          <Text style={styles.receiptTitle}>Deduction Breakdown</Text>
          <View style={styles.receiptRowContainer}><Text>PF</Text><Text>₹{monthlySalaryData?.pf}</Text></View>
          <View style={styles.receiptRowContainer}><Text>Prof. Tax</Text><Text>₹{monthlySalaryData?.professional_tax}</Text></View>
          <View style={styles.receiptRowContainer}><Text>Mediclaim</Text><Text>₹{monthlySalaryData?.mediclaim}</Text></View>
        </View>
      );

    case 'takehome':
      if (!monthlySalaryData) {
        return <Text style={styles.noDataText}>No Data Found</Text>;
      }
      return (
        <View>
          <Text style={styles.receiptTitle}>Take Home Calculation</Text>
          <View style={styles.receiptRowContainer}><Text>Base Salary</Text><Text>₹{monthlySalaryData?.base_salary}</Text></View>
          <View style={styles.receiptRowContainer}><Text>HRA (+)</Text><Text>₹{monthlySalaryData?.hra}</Text></View>
          <View style={styles.receiptRowContainer}><Text>Bonuses (+)</Text><Text>₹{monthlySalaryData?.bonuses}</Text></View>
          <View style={styles.receiptRowContainer}><Text>Deductions (-)</Text><Text>₹{monthlySalaryData?.deductions}</Text></View>
          <View style={[styles.receiptRowContainer, { borderTopWidth: 1, marginTop: 10 }]}>
            <Text style={{ fontWeight: 'bold' }}>Total</Text>
            <Text style={{ fontWeight: 'bold' }}>₹{monthlySalaryData?.final_salary}</Text>
          </View>
        </View>
      );

    case 'attendance':
      if (!attendanceData || attendanceData.length === 0) {
        return <Text style={styles.noDataText}>No Attendance Data Found</Text>;
      }
      return (
        <View>
          <Text style={styles.receiptTitle}>Attendance Logs</Text>
          {attendanceData.map((item, index) => {
            const formattedDate = new Date(item.date).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const statusText = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase() : 'N/A';
            const statusColor = statusText.toLowerCase() === 'present' ? 'green' : 'red';

            return (
              <View key={index} style={styles.receiptRowContainer}>
                <Text>{formattedDate}</Text>
                <Text style={{ color: statusColor }}>{statusText}</Text>
              </View>
            );
          })}
        </View>
      );

    case 'overtime':
      if (!attendanceData || attendanceData.length === 0) {
        return <Text style={styles.noDataText}>No Overtime Data Found</Text>;
      }
      const lateEntries = attendanceData.filter(
        a => a.entry_time && new Date(`1970-01-01T${a.entry_time}`) > new Date("1970-01-01T09:00:00")
      );
      if (lateEntries.length === 0) {
        return <Text style={styles.noDataText}>No Late Entries Found</Text>;
      }
      return (
        <View>
          <Text style={styles.receiptTitle}>Late Entry Logs</Text>
          {lateEntries.map((item, index) => {
            const formattedDate = new Date(item.date).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const entryTime = new Date(`1970-01-01T${item.entry_time}`).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });

            return (
              <View key={index} style={styles.receiptRowContainer}>
                <Text>{formattedDate}</Text>
                <Text style={{ color: 'orange' }}>In: {entryTime}</Text>
              </View>
            );
          })}
        </View>
      );

    default:
      return <Text style={styles.noDataText}>No Data Found</Text>;
  }
};
   const [topNotchY, setTopNotchY] = useState(0);
  const [bottomNotchY, setBottomNotchY] = useState(0);
  const middleHeight =
    bottomNotchY > topNotchY
      ? bottomNotchY - topNotchY
      : 200; // fallback
const { fullTimetable, refreshNextClass } = useNextClass();
  const [showModal, setShowModal] = useState(false);
  return (
    <SafeAreaView style={ui.screen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={ui.scrollView}
        contentContainerStyle={ui.scrollContent}
        nestedScrollEnabled
      >
        <View style={ui.container}>
            <LinearGradient
                                            pointerEvents="none"
                                            colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
                                            start={{ x: 0.05, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.dashboardTopGradient}
                                          >
          <View style={ui.summaryGrid}>
            {summaryCards.map((card, index) => (
              <TeacherSummaryCard
                key={card.label}
                style={[
                  index === 0 ? ui.summaryCardLeft : ui.summaryCardRight,
                  { width: '48%' },
                ]}
                onPress={() => setActiveTab(index === 0 ? 'self' : 'student')}
              >
                <Text style={ui.summaryLabel}>{card.label}</Text>
                <Text style={ui.summaryAmount}>{card.value}</Text>
                <Text style={ui.summaryFooter}>{card.footer}</Text>
              </TeacherSummaryCard>
            ))}
          </View>
</LinearGradient>
          <View style={ui.card}>
            <Text style={ui.sectionLabel}>Request type</Text>
            <View style={ui.segmentRow}>
              <TouchableOpacity
                style={[ui.segmentBtn, activeTab === 'self' && ui.segmentBtnActive]}
                onPress={() => setActiveTab('self')}
              >
                <Text style={[ui.segmentText, activeTab === 'self' && ui.segmentTextActive]}>Self</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ui.segmentBtn, activeTab === 'student' && ui.segmentBtnActive]}
                onPress={() => setActiveTab('student')}
              >
                <Text style={[ui.segmentText, activeTab === 'student' && ui.segmentTextActive]}>Student</Text>
              </TouchableOpacity>
            </View>

            <View style={ui.formCard}>
              <View style={ui.dateRow}>
                <TouchableOpacity style={ui.inputPill} onPress={() => setShowFromPicker(true)}>
                  <Text style={ui.inputPillText}>{fromDate.toDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ui.inputPill} onPress={() => setShowToPicker(true)}>
                  <Text style={ui.inputPillText}>{toDate.toDateString()}</Text>
                </TouchableOpacity>
              </View>
              <View style={ui.dateRow}>
                <TextInput
                  style={ui.inputPill}
                  placeholder="Reason"
                  placeholderTextColor="#9CA3AF"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <TouchableOpacity style={ui.inputPill} onPress={pickDocument}>
                  <Text style={ui.uploadPillText} numberOfLines={1}>
                    {leaveLetter ? leaveLetter.name : 'Upload'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={ui.submitButton} onPress={handleSubmission} disabled={submitting}>
                <Image source={sendIcon} style={[styles.iconImage,{marginTop: 10}, { tintColor: '#0a3d62' }]} />
                <Text style={ui.submitButtonText}>{submitting ? 'Submitting...' : ''}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={ui.card}>
            <View style={ui.listHeaderRow}>
              <Text style={ui.sectionLabel}>Requests</Text>
              <Text style={ui.listHint}>{activeTab === 'student' ? 'Student' : 'Self'}</Text>
            </View>

            {activeTab === 'student' ? (
              <View style={[localStyles.requestsScrollBox, { height: requestsBoxHeight }]}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  contentContainerStyle={localStyles.requestsScrollContent}
                >
                  {loadingRequests ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : pendingRequests.length === 0 ? (
                    <View style={localStyles.emptyContainer}>
                      <Ionicons name="document-text-outline" size={36} color="#CBD5E1" />
                      <Text style={localStyles.emptyText}>No pendings</Text>
                    </View>
                  ) : (
                    pendingRequests.map((item, index) => (
                      <View key={index} style={localStyles.requestCard}>
                        <Text style={localStyles.cardName}>{item.student_name}</Text>
                        <Text style={localStyles.cardReason}>{item.reason}</Text>
                        <Text style={localStyles.cardDate}>
                          {item.start_date} to {item.end_date}
                        </Text>
                        {item.leave_letter && (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedImage(item.leave_letter);
                              setShowImageModal(true);
                            }}
                          >
                            <Text style={ui.linkText}>View attachment</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            ) : teacherSelfRequests.length === 0 ? (
              <View style={localStyles.emptyContainer}>
                <Text style={localStyles.emptyText}>No leave requests found.</Text>
              </View>
            ) : (
              <View style={[localStyles.requestsScrollBox, { height: requestsBoxHeight }]}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  contentContainerStyle={localStyles.requestsScrollContent}
                >
                  {teacherSelfRequests.map((item, index) => {
                    const start = new Date(item.leave_start_date);
                    const end = new Date(item.leave_end_date);
                    const dateStr = isNaN(start.getTime())
                      ? 'Date Pending'
                      : `SL-${String(start.getDate()).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}/${String(
                          end.getMonth() + 1
                        ).padStart(2, '0')}/${end.getFullYear()}`;

                    return (
                      <View key={index} style={localStyles.requestCard}>
                        <View style={ui.requestRow}>
                          <View style={ui.requestRowLeft}>
                            <Ionicons name="time-outline" size={14} color="#111827" />
                            <Text style={localStyles.cardName}>{dateStr}</Text>
                          </View>
                          <View style={ui.requestActions}>
                            <TouchableOpacity style={localStyles.iconBtn}>
                              <Image source={usersicon} style={[localStyles.iconImg, { tintColor: '#1b6818ff' }]} />
                            </TouchableOpacity>
                            <TouchableOpacity style={localStyles.iconBtn}>
                              <Image source={editIcon} style={[localStyles.iconImg, { tintColor: '#f39c12' }]} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {showFromPicker && <DateTimePicker value={fromDate} mode="date" display="default" onChange={(e, d) => { setShowFromPicker(false); if(d) setFromDate(d); }} />}
      {showToPicker && <DateTimePicker value={toDate} mode="date" minimumDate={fromDate} display="default" onChange={(e, d) => { setShowToPicker(false); if(d) setToDate(d); }} />}

      <Modal visible={showImageModal} transparent={false}>
        <View style={localStyles.modalContainer}>
          <TouchableOpacity onPress={() => setShowImageModal(false)} style={localStyles.closeButton}><Text style={{color: 'white'}}>Close</Text></TouchableOpacity>
          <Image source={{ uri: `http://162.215.210.38:5000/uploads/${selectedImage?.trim()}` }} style={{width: '100%', height: '80%'}} resizeMode="contain" />
        </View>
      </Modal>
            <Modal 
              transparent 
              visible={isModalVisible} 
              animationType="slide"
              onRequestClose={() => setIsModalVisible(false)}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ backgroundColor: 'white', width: '90%', maxHeight: '70%', borderRadius: 15, padding: 20 }}>
                  <ScrollView>
                      {renderModalContent()}
                  </ScrollView>
                  <TouchableOpacity 
                      onPress={() => setIsModalVisible(false)}
                      style={{ marginTop: 20, backgroundColor: '#000', padding: 12, borderRadius: 8, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
            <Modal 
  visible={showSLModal} 
  transparent 
  animationType="slide"
  onRequestClose={closeSLModal}
>
  <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' }}>
    <View style={{ backgroundColor:'#fff', width:'90%', maxHeight:'70%', borderRadius:15, padding:20 }}>
      <Text style={{ fontSize:18, fontWeight:'bold', marginBottom:10 }}>Leave Requests Report</Text>
      {teacherSelfRequests.length === 0 ? (
        <View style={{ alignItems:'center', padding:30 }}>
          <Text style={{ color:'#999' }}>No leave requests found.</Text>
        </View>
      ) : (
        <ScrollView>
          {teacherSelfRequests.map((item, index) => {
            const start = new Date(item.leave_start_date);
            const end = new Date(item.leave_end_date);
            const formattedStart = isNaN(start.getTime()) ? 'N/A' : start.toDateString();
            const formattedEnd = isNaN(end.getTime()) ? 'N/A' : end.toDateString();
            const statusColor = item.status?.toLowerCase() === 'approved' ? 'green' : item.status?.toLowerCase() === 'pending' ? 'orange' : 'red';

            return (
              <View key={index} style={{ backgroundColor:'#f0f0f0', padding:10, marginBottom:10, borderRadius:6 }}>
                <Text style={{ fontWeight:'bold' }}>{item.student_name || 'Teacher'} </Text>
                <Text>From: {formattedStart}</Text>
                <Text>To: {formattedEnd}</Text>
                <Text>Status: <Text style={{ color: statusColor, fontWeight:'bold' }}>{item.status || 'Requested'}</Text></Text>
                {item.reason && <Text>Reason: {item.reason}</Text>}
              </View>
            )
          })}
        </ScrollView>
      )}
      <TouchableOpacity 
        onPress={closeSLModal} 
        style={{ marginTop:20, backgroundColor:'#000', padding:12, borderRadius:8, alignItems:'center' }}
      >
        <Text style={{ color:'#fff', fontWeight:'bold' }}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
      </Modal>
      <TeacherFooter />
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  listTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  emptyContainer: { alignItems: 'center', padding: 30 },
  emptyText: { color: '#999', marginTop: 10, fontSize: 16 },
  requestCard: { backgroundColor: '#f6f6f7', padding: 12,  borderRadius: 10, marginBottom: 10 },
  requestsScrollBox: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  requestsScrollContent: {
    paddingBottom: 4,
  },
  cardName: { fontWeight: 'bold', fontSize: 14 },
  cardReason: { color: '#666', marginVertical: 1, fontSize: 12 },
  cardDate: { fontSize: 11, color: '#999' },
  modalContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 5 },
  iconBtn: {
  marginLeft: 10,
  padding: 6,
  borderRadius: 6,
  backgroundColor: '#f2f2f2',
},

  iconImg: {
  width: 20,
  height: 20,
  resizeMode: 'contain',
  tintColor: '#000', // change to '#fff' if needed
},

});

const ui = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 18,
  },
  container: {
    gap: 10,
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
  monthPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthPillText: {
    color: '#3949AB',
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  summaryCard: {
    width: '48%',
    minHeight: 92,
    borderWidth: 1,
    borderColor: '#E1E4EA',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  summaryCardLeft: { backgroundColor: '#FFFFFF', marginRight: 8 },
  summaryCardRight: { backgroundColor: '#FFFFFF', marginLeft: 8 },
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
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f6f6f7',
  },
  sectionLabel: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 3,
    borderRadius: 16,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
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
    marginTop: 10,
    backgroundColor: '#FAFBFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EBF0',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  inputPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#f6f6f7',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  inputPillText: {
    color: '#111827',
    fontWeight: '600',
  },
  reasonInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#f6f6f7',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    color: '#000',
  },
  uploadPill: {
    flexBasis: 120,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#DDE3FF',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  uploadPillText: {
    color: '#3949AB',
    fontWeight: '700',
    textAlign: 'center',
  },
  submitButton: {
   width: 54,
  height: 54,
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
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listHint: {
    color: '#6B7280',
    fontSize: 12,
  },
  linkText: {
    color: '#2563EB',
    marginTop: 6,
    fontWeight: '600',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  requestRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default TeacherLeaveRequest;
