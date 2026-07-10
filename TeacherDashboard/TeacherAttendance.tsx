import React, { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  ScrollView,
  FlatList,
  ActionSheetIOS,
  Modal,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  Button,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { RouteProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ticketIcon from '../icons/application.png';
import { ThemeContext } from '../ThemeContext';
import TeacherFooter from './TeacherFooter';
import LinearGradient from 'react-native-linear-gradient';

import {
  globalStyles as styles,
  attendanceStyles as ui,
  attendanceModalStyles as modalStyles,
} from '../teacherStyles';
import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';
import { TouchableWithoutFeedback } from 'react-native';
import { TeacherTimetableContext } from '../Modalcontext';
import TeacherTimetableComponent from '../TeacherTimetableComponent';
import TeacherSummaryCard from './TeacherSummaryCard';

/* ---------------- TYPES ---------------- */
interface Student {
  username: string;
  name: string;
  photoUrl?: string;
}

interface AttendanceState {
  [key: number]: 'present' | 'absent' | null;
}

const buildAllPresentAttendance = (studentList: Student[]) => {
  const all: AttendanceState = {};
  studentList.forEach((_, index) => {
    all[index] = 'present';
  });
  return all;
};

interface LeaveStudent {
  username: string;
}

type RootStackParamList = {
  TeacherAttendance: {
    username?: string;
    schoolCode?: string;
    className?: string;
    section?: string;
    leaveStudents?: LeaveStudent[];
  };
};

type AttendanceRouteProp = RouteProp<RootStackParamList, 'TeacherAttendance'>;

/* ---------------- COMPONENT ---------------- */
const TeacherAttendance: React.FC<NativeStackScreenProps<RootStackParamList, 'TeacherAttendance'>> = ({ route }) => {
  const { themeStyles } = useContext(ThemeContext);

  /* ---------------- ROUTE PARAMS ---------------- */
  const {
    username: routeUsername,
    schoolCode: routeSchoolCode,
    className: routeClassName,
    section: routeSection,
    leaveStudents = [],
  } = route.params || {};

  /* ---------------- STATE ---------------- */
  const { nextClass } = useNextClass();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceState>({});
  const [leaveTypes, setLeaveTypes] = useState<(string | null)[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState(routeUsername || '');
  const [schoolCode, setSchoolCode] = useState(routeSchoolCode || '');
  const [selectedClass, setSelectedClass] = useState(routeClassName || '');
  const [selectedSection, setSelectedSection] = useState(routeSection || '');
  const [showTeacherTableModal, setShowTeacherTableModal] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [sectionData, setSectionData] = useState([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number | null>(null);
  const [previousStatus, setPreviousStatus] = useState<'present' | 'absent' | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const context = useContext(TeacherTimetableContext);
  const teacherTimetable = context?.teacherTimetable || [];
  const loadingTable = context?.loading || false;

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    const init = async () => {
      if (!username) setUsername(await AsyncStorage.getItem('username') || '');
      if (!schoolCode) setSchoolCode(await AsyncStorage.getItem('schoolCode') || '');
      if (!selectedClass) setSelectedClass(await AsyncStorage.getItem('teacherClass') || '');
      if (!selectedSection) setSelectedSection(await AsyncStorage.getItem('teacherSection') || '');
    };
    init();
  }, []);

  /* ---------------- FETCH CLASS & SECTION ---------------- */
useEffect(() => {
  const fetchClassSection = async () => {
    try {
      console.log('📌 Starting fetchClassSection…');
      setDropdownLoading(true);

      const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
      console.log('📥 Stored schoolCode from AsyncStorage:', storedSchoolCode);

      const schoolCode = storedSchoolCode || routeSchoolCode;
      console.log('🏫 Using schoolCode:', schoolCode);

      if (!schoolCode) {
        console.warn('⚠️ School code is missing!');
        return;
      }

      // Fetch classes
      console.log('📡 Fetching classes from API…');
      const classRes = await fetch(
        `https://cleezoclass.com:4000/api/admin/classes?schoolCode=${schoolCode}`
      );
      const classData = await classRes.json();
      console.log('📊 Classes fetched:', classData);
      setClasses(classData || []);

      // Fetch sections
      console.log('📡 Fetching sections from API…');
      const sectionRes = await fetch(
        `https://cleezoclass.com:4000/api/admin/sectionFilter?schoolCode=${schoolCode}`
      );
      const sectionData = await sectionRes.json();
      console.log('📊 Sections fetched========================:', sectionData);
      setSectionData(sectionData);

      // Extract unique section names
      const uniqueSections = [...new Set(sectionData.map(item => item.section))];
      console.log('🔹 Unique sections extracted:', uniqueSections);
      setSections(uniqueSections);

    } catch (err) {
      console.error('❌ Error fetching class & section:', err);
      Alert.alert('Error', 'Failed to load class & section');
    } finally {
      setDropdownLoading(false);
      console.log('✅ fetchClassSection finished, dropdown loading set to false');
    }
  };

  fetchClassSection();
}, []);

  // Debug: Log classes and sections after they are set
  console.log('📌 Classes:', classes);
  console.log('📌 Sections:', sections);

  /* ---------------- DROPDOWN HANDLER ---------------- */
  const resetStudentState = () => {
    setStudents([]);
    setFilteredStudents([]);
    setAttendance({});
    setStudentsLoaded(false);
    setLeaveTypes([]);
    setStudentSearch('');
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSelectedSection('');
    resetStudentState();
  };

  const handleSectionChange = (value: string) => {
    setSelectedSection(value);
    resetStudentState();
  };

  /* ---------------- STUDENT LOAD ---------------- */
  const loadStudents = useCallback(async (classNameArg?: string, sectionArg?: string) => {
    try {
      setIsLoading(true);
      const activeSchoolCode = (await AsyncStorage.getItem('schoolCode')) || schoolCode;
      const classToLoad = classNameArg || selectedClass;
      const sectionToLoad = sectionArg || selectedSection;

      if (!classToLoad || !sectionToLoad || !activeSchoolCode) {
        Alert.alert('Error', 'Class, section, or school code is missing.');
        return;
      }

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

      if (data.success && data.students?.length) {
        const sorted = data.students
          .filter((s: any) => s.name)
          .sort((a: Student, b: Student) => a.name.localeCompare(b.name));

        setStudents(sorted);
        setFilteredStudents(sorted);
        setAttendance(buildAllPresentAttendance(sorted));
        setLeaveTypes(new Array(sorted.length).fill(null));
        setStudentsLoaded(true);
      } else {
        Alert.alert('No Students Found');
        resetStudentState();
      }
    } catch {
      Alert.alert('Error fetching students');
      resetStudentState();
    } finally {
      setIsLoading(false);
    }
  }, [schoolCode, selectedClass, selectedSection]);

  useEffect(() => {
    if (selectedClass && selectedSection) {
      loadStudents(selectedClass, selectedSection);
    }
  }, [loadStudents, selectedClass, selectedSection]);

  useEffect(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) {
      setFilteredStudents(students);
      return;
    }

    setFilteredStudents(
      students.filter(student =>
        student.name.toLowerCase().includes(query) ||
        student.username.toLowerCase().includes(query)
      )
    );
  }, [studentSearch, students]);

  /* ---------------- ATTENDANCE ---------------- */
  const submitAttendance = async () => {
    if (Object.keys(attendance).length < students.length) {
      Alert.alert("Incomplete Attendance", "Please mark attendance for all students before submitting.");
      return;
    }

    try {
      const activeSchoolCode = await AsyncStorage.getItem('schoolCode') || schoolCode;

      if (!activeSchoolCode) {
        Alert.alert("Error", "School code is missing. Please log in again.");
        return;
      }

      const studentsData = students.map((student, index) => ({
        username: student.username,
        name: student.name,
        section: selectedSection,
        className: selectedClass,
        leaves: attendance[index] === 'present'
          ? 'Present'
          : leaveTypes[index] || 'UnInformed',
      }));

      const payload = {
        username,
        className: selectedClass,
        section: selectedSection,
        students: studentsData,
        schoolCode: activeSchoolCode,
      };

      const response = await fetch('http://162.215.210.38:3010/submit-attendance-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert("Success", result.message);
        setStudentsLoaded(false);
        setAttendance({});
      } else {
        const errorResult = await response.json();
        Alert.alert("Error", errorResult.message || 'Failed to submit attendance!');
      }
    } catch (error) {
      Alert.alert("Error", "Failed to submit attendance!");
    }
  };

  /* ---------------- STUDENT ICON CLICK HANDLER ---------------- */
  const handleStudentIconClick = (index: number) => {
    const currentStatus = attendance[index];
    setPreviousStatus(currentStatus || null);
    setSelectedStudentIndex(index);

    if (currentStatus === 'present') {
      setAttendance({ ...attendance, [index]: 'absent' });
      setLeaveModalVisible(true);
    } else if (currentStatus === 'absent') {
      const newAttendance = { ...attendance };
      delete newAttendance[index];
      setAttendance(newAttendance);
      const updatedLeaveTypes = [...leaveTypes];
      updatedLeaveTypes[index] = null;
      setLeaveTypes(updatedLeaveTypes);
    } else {
      setAttendance({ ...attendance, [index]: 'present' });
      const updatedLeaveTypes = [...leaveTypes];
      updatedLeaveTypes[index] = null;
      setLeaveTypes(updatedLeaveTypes);
    }
  };

  /* ---------------- LEAVE OPTION HANDLER ---------------- */
  const handleLeaveOption = (leaveType: string) => {
    if (selectedStudentIndex !== null) {
      const updatedLeaveTypes = [...leaveTypes];
      updatedLeaveTypes[selectedStudentIndex] = leaveType;
      setLeaveTypes(updatedLeaveTypes);
    }
    setLeaveModalVisible(false);
  };

  /* ---------------- CLOSE MODAL WITHOUT SELECTION ---------------- */
  const closeModalWithoutSelection = () => {
    if (selectedStudentIndex !== null && previousStatus !== null) {
      setAttendance({ ...attendance, [selectedStudentIndex]: previousStatus });
    }
    setLeaveModalVisible(false);
  };

  /* ---------------- SELECT ALL STUDENTS ---------------- */
  const handleSelectAll = () => {
    setAttendance(buildAllPresentAttendance(students));
    setLeaveTypes(new Array(students.length).fill(null));
  };

  const summaryCards = useMemo(
    () => {
      const totalStudents = students.length || filteredStudents.length || 0;
      const pendingCount = Math.max(totalStudents - Object.keys(attendance).length, 0);

      return [
        {
          title: 'Attendance',
          subtitle:
            selectedClass && selectedSection
              ? `${selectedClass} - ${selectedSection}`
              : 'Select class and section',
          footer: `${totalStudents} students | ${pendingCount} pending`,
          icon: 'checkbox-outline',
          background: '#D7E7CD',
        },
        {
          title: nextClass?.class_id || '--',
          subtitle: nextClass?.subject || 'No class',
          footer: nextClass ? `${nextClass.fromTime} - ${nextClass.toTime}` : 'No timetable available',
          icon: 'time-outline',
          background: '#F0EE96',
        },
      ];
    },
    [attendance, filteredStudents.length, nextClass, selectedClass, selectedSection, students.length]
  );

// Create a mapping for sorting
const classSortOrder = {
  'Nursery': 0,
  'LKG': 1,
  'UKG': 2,
  '1': 3,
  '2': 4,
  '3': 5,
  '4': 6,
  '5': 7,
  '6': 8,
  '7': 9,
  '8': 10,
  '9': 11,
  '10': 12,
  '11': 13,
  '12': 14,
};
  const [showModal, setShowModal] = useState(false);

// Sort dynamically
const normalizeClassName = (item: any) =>
  String(item?.class_name || item?.class || item?.name || item || '').trim();

const sortedClassOptions = [...new Set(classes.map(normalizeClassName).filter(Boolean))].sort(
  (a, b) => (classSortOrder[a] ?? 999) - (classSortOrder[b] ?? 999)
);
const availableSections = selectedClass
  ? [...new Set(
      sectionData
        .filter((item: any) => normalizeClassName(item) === selectedClass)
        .map((item: any) => String(item?.section || '').trim())
        .filter(Boolean)
    )].sort()
  : [];
  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={ui.page}
      >
           
          <LinearGradient
  pointerEvents="none"
  colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
  start={{ x: 0.05, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.dashboardTopGradient}
>
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 60,
      marginBottom: 12,
    }}
  >
    {summaryCards.map((card, index) => (
      <TeacherSummaryCard
        key={`${card.title}-${index}`}
        style={{
          flex: 1,
          minHeight: 92,
          borderRadius: 14,
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderColor: 'transparent',
          paddingVertical: 0,
          paddingHorizontal: 0,
          marginRight: index === 0 ? 4 : 0,
          marginLeft: index === 1 ? 4 : 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          overflow: 'hidden',
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              flexWrap: 'wrap',
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '900',
                color: '#111111',
                marginRight: 4,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {card.title}
            </Text>

            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '500',
                color: '#252525',
                lineHeight: 18,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {card.subtitle}
            </Text>
          </View>

          <Text
            style={{
              marginTop: 20,
              fontSize: 12.5,
              fontWeight: '500',
              color: '#2B2B2B',
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {card.footer}
          </Text>
        </View>

        <View
          style={{
            width: 34,
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingTop: 2,
          }}
        >
          <Ionicons name={card.icon} size={28} color="#4C4C4C" />
        </View>
      </TeacherSummaryCard>
    ))}
  </View>
</LinearGradient>
        <View style={ui.card}>
          <Text style={ui.cardLabel}>Class and Section</Text>
          <View style={ui.classSectionRow}>
            <View style={ui.classSectionField}>
              <Text style={ui.fieldLabel}>Class</Text>
              <View style={ui.attendanceDropdownContainer}>
                <Picker
                  selectedValue={selectedClass}
                  onValueChange={handleClassChange}
                  style={[styles.picker, { color: '#111827' }]}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label="Select Class" value="" />
                  {sortedClassOptions.map((className) => (
                    <Picker.Item key={className} label={className} value={className} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={ui.classSectionField}>
              <Text style={ui.fieldLabel}>Section</Text>
              <View style={ui.attendanceDropdownContainer}>
                <Picker
                  selectedValue={selectedSection}
                  onValueChange={handleSectionChange}
                  enabled={Boolean(selectedClass)}
                  style={[styles.picker, { color: '#111827' }]}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label={selectedClass ? 'Select Section' : 'Select Class First'} value="" />
                  {availableSections.map((section) => (
                    <Picker.Item key={section} label={section} value={section} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={ui.classSectionBadgeWrap}>
              <View style={ui.heroBadge}>
                <Text style={ui.heroBadgeText}>{filteredStudents.length}</Text>
                <Text style={ui.heroBadgeLabel}>Students</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={ui.card}>
          <View style={ui.actionsRow}>
            <TouchableOpacity style={ui.secondaryButton} onPress={handleSelectAll}>
              <Text style={ui.secondaryButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.messageBtnTall, { marginLeft: 0 }]} onPress={submitAttendance}>
              <Image source={ticketIcon} style={[styles.iconImage, { tintColor: '#0a3d62' }]} />
            </TouchableOpacity>
          </View>

          <View style={ui.searchRow}>
            <Ionicons name="search" size={18} color="#6B7280" />
            <TextInput
              value={studentSearch}
              onChangeText={setStudentSearch}
              placeholder="Search students"
              placeholderTextColor="#9CA3AF"
              style={ui.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {studentSearch ? (
              <TouchableOpacity onPress={() => setStudentSearch('')}>
                <Ionicons name="close-circle" size={18} color="#6B7280" />
              </TouchableOpacity>
            ) : null}
          </View>

<View style={[ui.gridCard, { minHeight: 500 }]}> {/* Adjust minHeight as needed */}
            <FlatList
              data={filteredStudents}
              keyExtractor={(item) => item.username}
              numColumns={3}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              initialNumToRender={filteredStudents.length}
              maxToRenderPerBatch={filteredStudents.length}
              windowSize={Math.max(21, Math.ceil(filteredStudents.length / 3))}
              columnWrapperStyle={ui.studentGridRow}
 contentContainerStyle={[
      ui.studentGridContent,
      { paddingBottom: 80 }, // Add padding to ensure last row is visible
    ]}              renderItem={({ item }) => {
                const originalIndex = students.findIndex(s => s.username === item.username);

                return (
                <Pressable
                  style={[
                    ui.studentTile,
                    attendance[originalIndex] === 'present'
                      ? ui.studentTilePresent
                      : attendance[originalIndex] === 'absent'
                      ? ui.studentTileAbsent
                      : ui.studentTileDefault,
                  ]}
                  onPress={() => handleStudentIconClick(originalIndex)}
                >
                  <View
                    style={[
                      ui.studentAvatar,
                      attendance[originalIndex] === 'present'
                        ? ui.studentAvatarPresent
                        : attendance[originalIndex] === 'absent'
                        ? ui.studentAvatarAbsent
                        : ui.studentAvatarDefault,
                    ]}
                  >
                    <Ionicons name="person-outline" size={20} color="#2B2B2B" />
                  </View>
                  <Text style={ui.studentName}>{item.name}</Text>
                </Pressable>
                );
              }}
            />
          </View>
        </View>

          {/* LEAVE MODAL */}
          <Modal visible={leaveModalVisible} transparent={true} animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Leave Type</Text>
                <TouchableOpacity onPress={() => handleLeaveOption('Informed')}>
                  <Text style={styles.leaveOption}>Informed Leave</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleLeaveOption('UnInformed')}>
                  <Text style={styles.leaveOption}>UnInformed Leave</Text>
                </TouchableOpacity>
                <Button title="Cancel" onPress={closeModalWithoutSelection} color="rgb(160, 180, 182)" />
              </View>
            </View>
          </Modal>

          {/* TEACHER TIMETABLE MODAL */}
          <Modal
            visible={showTeacherTableModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowTeacherTableModal(false)}
          >
            <TouchableWithoutFeedback onPress={() => setShowTeacherTableModal(false)}>
              <View style={modalStyles.overlay}>
                <TouchableWithoutFeedback onPress={() => { }}>
                  <View style={modalStyles.container}>
                    <View style={modalStyles.header}>
                      <Text style={modalStyles.title}>My Timetable</Text>
                      <TouchableOpacity onPress={() => setShowTeacherTableModal(false)}>
                        <Ionicons name="close" size={24} color="#000" />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      {loadingTable ? (
                        <ActivityIndicator color="gray" style={{ marginTop: 20 }} />
                      ) : (
                        <TeacherTimetableComponent data={teacherTimetable} />
                      )}
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

      </ScrollView>

      <TeacherFooter />
    </SafeAreaView>
  );
};

export default TeacherAttendance;
