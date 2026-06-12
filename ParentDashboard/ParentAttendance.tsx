import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { BarChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { createAppStyles } from '../App.styles';
import { RootStackParamList } from '../types';
import ParentFooter from './ParentFooter';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentAttendance'>;

const resolveStudentPhotoUri = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/uploads/')) return `http://162.215.210.38:3010${raw}`;
  if (raw.startsWith('uploads/')) return `http://162.215.210.38:3010/${raw}`;
  return raw;
};

const ParentAttendance: React.FC<Props> = ({ navigation }) => {
  const { height, width } = useWindowDimensions();
  const appStyles = useMemo(
    () => createAppStyles({ phoneWidth: width, phoneHeight: height }),
    [height, width],
  );

  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('Student');
  const [studentClass, setStudentClass] = useState('-');
  const [studentSection, setStudentSection] = useState('-');
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPhoto, setStudentPhoto] = useState('');
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState(new Date());
  const [leaveEndDate, setLeaveEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const loadStudent = async () => {
      try {
        const stored = await AsyncStorage.multiGet([
          'currentStudent',
          'name',
          'class_name',
          'section',
          'schoolCode',
          'photoUrl',
          'photo',
        ]);
        const entries = Object.fromEntries(stored);
        let parsed: Record<string, any> = {};

        if (entries.currentStudent) {
          try {
            parsed = JSON.parse(entries.currentStudent);
          } catch {}
        }

        const nextName = String(parsed.name || entries.name || 'Student').trim() || 'Student';
        const nextClass = String(parsed.class_name || entries.class_name || '-').trim() || '-';
        const nextSection = String(parsed.section || entries.section || '-').trim() || '-';
        const nextUsername = String(parsed.username || entries.username || '').trim();
        const nextSchool = String(parsed.schoolCode || entries.schoolCode || '').trim();
        const nextPhoto = resolveStudentPhotoUri(
          parsed.photoUrl || parsed.photo || entries.photoUrl || entries.photo || '',
        );

        setStudentName(nextName);
        setStudentClass(nextClass);
        setStudentSection(nextSection);
        setStudentUsername(nextUsername);
        setStudentPhoto(nextPhoto);
        setSelectedSchool(nextSchool);
      } catch (error) {
        console.error('Failed to load student info for attendance:', error);
      }
    };

    void loadStudent();
  }, []);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const schoolCode = String(selectedSchool || (await AsyncStorage.getItem('schoolCode')) || '').trim();
        if (!schoolCode) {
          setLeaveData([]);
          return;
        }

        const response = await fetch(
          `http://162.215.210.38:3010/api/api/leave/all?schoolCode=${encodeURIComponent(schoolCode)}`,
        );
        const data = await response.json().catch(() => []);
        setLeaveData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load attendance data:', error);
        setLeaveData([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchAttendance();
  }, [selectedSchool]);

  const filteredLeaves = useMemo(() => {
    const selectedName = String(studentName || '').trim().toLowerCase();
    const selectedClass = String(studentClass || '').trim().toLowerCase();
    const selectedSection = String(studentSection || '').trim().toLowerCase();

    return (Array.isArray(leaveData) ? leaveData : []).filter((item: any) => {
      const itemName = String(item?.student_name || item?.name || '').trim().toLowerCase();
      const itemClass = String(item?.class_name || '').trim().toLowerCase();
      const itemSection = String(item?.section || '').trim().toLowerCase();

      const nameMatch = selectedName ? itemName === selectedName : false;
      const classMatch = selectedClass && selectedSection
        ? itemClass === selectedClass && itemSection === selectedSection
        : true;

      return nameMatch && classMatch;
    });
  }, [leaveData, studentName, studentClass, studentSection]);

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeaves.forEach((item: any) => {
      const key = String(item?.leave_type || 'Leave').trim() || 'Leave';
      counts[key] = (counts[key] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    return labels.length
      ? { labels, datasets: [{ data }] }
      : null;
  }, [filteredLeaves]);

  const totalLeaves = filteredLeaves.length;
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const handleLeaveRequest = async () => {
    if (!leaveType) {
      Alert.alert('Please select leave type');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Please enter the reason');
      return;
    }

    const resolvedUsername = String(
      studentUsername || (await AsyncStorage.getItem('username')) || '',
    ).trim();

    if (!resolvedUsername) {
      Alert.alert('Missing username', 'Please reselect the student and try again.');
      return;
    }

    if (!studentName || !studentClass || !studentSection || !selectedSchool) {
      Alert.alert('Missing student details', 'Class/section/schoolCode is missing.');
      return;
    }

    const formData = new FormData();
    formData.append('username', resolvedUsername);
    formData.append('student_name', studentName);
    formData.append('class_name', studentClass);
    formData.append('section', studentSection);
    formData.append('start_date', formatDate(leaveStartDate));
    formData.append('end_date', formatDate(leaveEndDate));
    formData.append('reason', reason);
    formData.append('leave_type', leaveType);
    formData.append('schoolCode', selectedSchool);

    try {
      const response = await fetch('http://162.215.210.38:3010/api/student-leave-request', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        Alert.alert('Leave Request Submitted');
        setReason('');
        setLeaveType('');
        setLeaveStartDate(new Date());
        setLeaveEndDate(new Date());
      } else {
        Alert.alert('Submission failed');
      }
    } catch (error) {
      console.error('Leave request failed:', error);
      Alert.alert('An error occurred');
    }
  };

  return (
    <SafeAreaView style={appStyles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0a3d62" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          appStyles.dashboardScrollContent,
          { paddingTop: 10, paddingBottom: 28, backgroundColor: '#FFFFFF' },
        ]}
      >
        <LinearGradient
          colors={['#0a3d62', '#7fa3c9', '#f6f7fb']}
          locations={[0, 0.46, 1]}
          style={{
            paddingHorizontal: 10,
            paddingTop: 14,
            paddingBottom: 14,
          }}
        >
          <View style={appStyles.academicGraphHeader}>
            <View style={appStyles.academicGraphHeaderText}>
              <Text style={appStyles.academicGraphTitle}>Attendance</Text>
              <Text style={appStyles.academicGraphSubtitle}>
                This chart shows the leave summary by type.
              </Text>
            </View>
          </View>

          <View style={appStyles.academicGraphLegendRow}>
            <View style={appStyles.academicGraphLegendItem}>
              <View style={[appStyles.academicGraphLegendDot, { backgroundColor: '#0a3d62' }]} />
              <Text style={appStyles.academicGraphLegendText}>Leaves</Text>
            </View>
            <View style={appStyles.academicGraphLegendItem}>
              <View style={[appStyles.academicGraphLegendDot, { backgroundColor: '#f1f3f6' }]} />
              <Text style={appStyles.academicGraphLegendText}>Records</Text>
            </View>
          </View>

          <View style={appStyles.academicGraphCard}>
            {loading ? (
              <ActivityIndicator size="large" color="#0a3d62" style={{ paddingVertical: 60 }} />
            ) : chartData ? (
              <BarChart
                data={chartData}
                width={Math.max(width - 48, 280)}
                height={260}
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
                  color: (opacity = 1) => `rgba(10, 61, 98, ${opacity})`,
                  labelColor: () => '#111827',
                  propsForBackgroundLines: {
                    stroke: '#E6E8EE',
                    strokeDasharray: '',
                  },
                  propsForBarLabels: {
                    fill: '#111827',
                  },
                }}
                style={{ borderRadius: 18 }}
              />
            ) : (
              <Text style={appStyles.academicGraphEmptyState}>
                No attendance data found for this student.
              </Text>
            )}
          </View>
        </LinearGradient>

          <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 4, paddingTop: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[appStyles.dashboardGridCard, { flex: 1 }]}>
                <LinearGradient
                  colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
                  start={{ x: 0.05, y: 0.05 }}
                  end={{ x: 0.95, y: 0.95 }}
                  style={appStyles.dashboardGridCardContent}
                >
                  <View style={appStyles.dashboardGridTextBlock}>
                    <Text style={[appStyles.gridLabel, { color: '#FFFFFF' }]}>Leaves</Text>
                    <Text style={[appStyles.dashboardGridMetaLabel, { color: 'rgba(255,255,255,0.84)' }]}>
                      Records
                    </Text>
                    <Text style={[appStyles.dashboardGridMetaValue, { color: '#FFFFFF' }]}>{totalLeaves}</Text>
                  </View>
                  <View style={appStyles.gridIconWrap}>
                    <MaterialIcons name="event-note" size={28} color="#000000" />
                  </View>
                </LinearGradient>
              </View>
              <View style={[appStyles.dashboardGridCard, { flex: 1 }]}>
                <LinearGradient
                  colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
                  start={{ x: 0.05, y: 0.05 }}
                  end={{ x: 0.95, y: 0.95 }}
                  style={appStyles.dashboardGridCardContent}
                >
                  <View style={appStyles.dashboardGridTextBlock}>
                    <Text style={[appStyles.gridLabel, { color: '#FFFFFF' }]}>Student</Text>
                    <Text style={[appStyles.dashboardGridMetaLabel, { color: 'rgba(255,255,255,0.84)' }]}>
                      Class
                    </Text>
                    <Text style={[appStyles.dashboardGridMetaValue, { color: '#FFFFFF' }]} numberOfLines={1}>
                      {studentClass} {studentSection}
                    </Text>
                  </View>
                  <View style={appStyles.gridIconWrap}>
                    <MaterialIcons name="school" size={28} color="#000000" />
                  </View>
                </LinearGradient>
              </View>
            </View>

          <View
            style={{
              marginTop: 14,
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E7EAF0',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 }}>
              Leave Request
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <Pressable
                onPress={() => setShowStartPicker(true)}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#DDE3EB',
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  backgroundColor: '#F8FAFC',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', marginBottom: 4 }}>
                  Start Date
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
                  {leaveStartDate.toDateString()}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowEndPicker(true)}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#DDE3EB',
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  backgroundColor: '#F8FAFC',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', marginBottom: 4 }}>
                  End Date
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
                  {leaveEndDate.toDateString()}
                </Text>
              </Pressable>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={leaveStartDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartPicker(false);
                  if (selectedDate) setLeaveStartDate(selectedDate);
                }}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={leaveEndDate}
                minimumDate={leaveStartDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndPicker(false);
                  if (selectedDate) setLeaveEndDate(selectedDate);
                }}
              />
            )}

            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#DDE3EB',
                marginBottom: 10,
                overflow: 'hidden',
                backgroundColor: '#F8FAFC',
              }}
            >
              <Picker
                selectedValue={leaveType}
                onValueChange={(itemValue) => setLeaveType(itemValue)}
                dropdownIconColor="#111827"
                style={{ color: '#111827' }}
              >
                <Picker.Item label="Select Leave Type" value="" />
                <Picker.Item label="Sick Leave" value="Sick Leave" />
                <Picker.Item label="Casual Leave" value="Casual Leave" />
                <Picker.Item label="Half Day" value="Half Day" />
              </Picker>
            </View>

            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for leave"
              placeholderTextColor="#94A3B8"
              multiline
              style={{
                minHeight: 96,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#DDE3EB',
                backgroundColor: '#F8FAFC',
                paddingHorizontal: 12,
                paddingVertical: 12,
                textAlignVertical: 'top',
                color: '#111827',
                marginBottom: 12,
              }}
            />

            <Pressable
              onPress={handleLeaveRequest}
              style={{
                borderRadius: 14,
                backgroundColor: '#0a3d62',
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
                Send Request
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              marginTop: 16,
              marginBottom: 6,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#E6E8EE',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>
              <ParentFooter />
      
    </SafeAreaView>
  );
};

export default ParentAttendance;
