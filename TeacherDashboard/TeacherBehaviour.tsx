import React, { useMemo, useState, useContext, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  ActionSheetIOS,
  Modal,
  Alert,
  SafeAreaView,
  StatusBar,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ticketIcon from '../icons/application.png';
import { ThemeContext } from '../ThemeContext';
import TeacherFooter from './TeacherFooter';
import TeacherSummaryCard from './TeacherSummaryCard';
import {
  globalStyles as styles,
  behaviorStyles as ui,
  attendanceModalStyles as modalStyles,
} from '../teacherStyles';
import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';
import { TouchableWithoutFeedback } from 'react-native';
import { TeacherTimetableContext } from '../Modalcontext';
import TeacherTimetableComponent from '../TeacherTimetableComponent';

/* ---------------- TYPES ---------------- */
interface Student {
  username: string;
  name: string;
  photoUrl?: string;
}

type RootStackParamList = {
  TeacherBehaviour: {
    username?: string;
    schoolCode?: string;
    className?: string;
    section?: string;
  };
};

interface BehaviorSuggestions {
  Positive: string[];
  Negative: string[];
  'Needs Improvement': string[];
}

type BehaviorType = 'Positive' | 'Negative' | 'Needs Improvement' | null;

/* ---------------- COMPONENT ---------------- */
const TeacherBehaviour: React.FC<NativeStackScreenProps<RootStackParamList, 'TeacherBehaviour'>> = ({ route }) => {
  const { themeStyles } = useContext(ThemeContext);
  const placeholderTextColor = '#999';
  const { nextClass } = useNextClass();

  /* ---------------- STATE ---------------- */
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [additionalComment, setAdditionalComment] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showTeacherTableModal, setShowTeacherTableModal] = useState(false);
  const [classSelected, setClassSelected] = useState<string>(route.params?.className || '');
  const [sectionSelected, setSectionSelected] = useState<string>(route.params?.section || '');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [behaviorComment, setBehaviorComment] = useState<BehaviorType>(null);
  const [submittedReports, setSubmittedReports] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [sectionData, setSectionData] = useState([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);

  const context = useContext(TeacherTimetableContext);
  const teacherTimetable = context?.teacherTimetable || [];
  const loadingTable = context?.loading || false;

  const behaviorSuggestions: BehaviorSuggestions = {
    Positive: ['Excellent progress', 'Great participation', 'Shows leadership skills', 'Very cooperative'],
    Negative: ['Needs to follow rules', 'Disrupts class', 'Incomplete assignments'],
    'Needs Improvement': ['Needs encouragement', 'Can improve focus', 'Requires extra practice'],
  };

  const summaryCards = useMemo(
    () => [
      {
        title: 'Behaviour',
        subtitle:
          classSelected && sectionSelected ? `${classSelected} - ${sectionSelected}` : 'Select class and section',
        footer: `${filteredStudents.length} students ready`,
        icon: 'person-outline',
        background: '#D7E7CD',
      },
      {
        title: nextClass?.class_id || '--',
        subtitle: nextClass?.subject || 'No class',
        footer: nextClass ? `${nextClass.fromTime} - ${nextClass.toTime}` : 'No timetable available',
        icon: 'time-outline',
        background: '#F0EE96',
      },
    ],
    [classSelected, filteredStudents.length, nextClass, sectionSelected]
  );

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    const loadStoredData = async () => {
      if (!classSelected) {
        const storedClass = await AsyncStorage.getItem('teacherClass');
        if (storedClass) setClassSelected(storedClass);
      }
      if (!sectionSelected) {
        const storedSection = await AsyncStorage.getItem('teacherSection');
        if (storedSection) setSectionSelected(storedSection);
      }
    };
    loadStoredData();
  }, []);

  /* ---------------- FETCH CLASS & SECTION ---------------- */
  useEffect(() => {
    const fetchClassSection = async () => {
      try {
        console.log('Fetching Class & Section...');
        setDropdownLoading(true);

        const schoolCode = await AsyncStorage.getItem('schoolCode');
        if (!schoolCode) {
          console.warn('School code is missing!');
          return;
        }

        // Fetch classes
        const classRes = await fetch(
          `https://cleezoclass.com:4000/api/admin/classes?schoolCode=${schoolCode}`
        );
        const classData = await classRes.json();
        setClasses(classData || []);

        // Fetch sections
        const sectionRes = await fetch(
          `https://cleezoclass.com:4000/api/admin/sectionFilter?schoolCode=${schoolCode}`
        );
        const sectionData = await sectionRes.json();
        setSectionData(sectionData);

        // Extract unique section names
        const uniqueSections = [...new Set(sectionData.map(item => item.section))];
        setSections(uniqueSections);

      } catch (err) {
        console.error('Error fetching class & section:', err);
        Alert.alert('Error', 'Failed to load class & section');
      } finally {
        setDropdownLoading(false);
      }
    };

    fetchClassSection();
  }, []);

  const handleStudentIconClick = (student: Student) => {
    setSelectedStudent(student.name);
    setBehaviorComment(null);
    setAdditionalComment('');
    setModalVisible(true);
  };

  const showBehaviorCommentActionSheet = (): void => {
    const options = ['Positive', 'Negative', 'Needs Improvement'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...options],
          cancelButtonIndex: 0
        },
        (index: number) => {
          if (index !== 0) {
            const selected = options[index - 1] as BehaviorType;
            setBehaviorComment(selected);
            setShowCommentInput(true);
          }
        }
      );
    } else {
      Alert.alert(
        'Select Behavior',
        'Choose a category',
        [
          { text: 'Positive', onPress: () => { setBehaviorComment('Positive'); setShowCommentInput(true); }},
          { text: 'Negative', onPress: () => { setBehaviorComment('Negative'); setShowCommentInput(true); }},
          { text: 'Needs Improvement', onPress: () => { setBehaviorComment('Needs Improvement'); setShowCommentInput(true); }},
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }
  };

  const handleCommentChange = (text: string): void => {
    setAdditionalComment(text);
    if (text && behaviorComment) {
      const categorySuggestions = behaviorSuggestions[behaviorComment];
      setFilteredSuggestions(
        categorySuggestions?.filter(s => s.toLowerCase().includes(text.toLowerCase())) || []
      );
    } else {
      setFilteredSuggestions([]);
    }
  };

  const submitReport = async (): Promise<void> => {
    if (!behaviorComment) {
      Alert.alert('Error', 'Select behavior');
      return;
    }

    const student = students.find(s => s.name === selectedStudent);
    if (!student) return;

    const schoolCode = await AsyncStorage.getItem('schoolCode');

    const payload = {
      username: student.username,
      class_name: classSelected,
      section: sectionSelected,
      name: selectedStudent,
      report: behaviorComment,
      comment: additionalComment || "",
      schoolCode: schoolCode,
    };

    try {
      const res = await fetch('http://162.215.210.38:3010/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (res.ok) {
        Alert.alert('Success', 'Report submitted successfully');
        setSubmittedReports(prev => [...prev, student.username]);
        setModalVisible(false);
        setAdditionalComment('');
        setBehaviorComment(null);
      } else {
        Alert.alert('Server Error', JSON.stringify(responseData));
      }
    } catch (error: any) {
      Alert.alert('Connection Failed', error.message);
    }
  };
const classSortOrder: Record<string, number> = {
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

const normalizeClassName = (item: any) =>
  String(item?.class_name || item?.class || item?.name || item || '').trim();

const sortedClassOptions = [...new Set(classes.map(normalizeClassName).filter(Boolean))].sort(
  (a, b) => (classSortOrder[a] ?? 999) - (classSortOrder[b] ?? 999)
);
const availableSections = classSelected
  ? [...new Set(
      sectionData
        .filter((item: any) => normalizeClassName(item) === classSelected)
        .map((item: any) => String(item?.section || '').trim())
        .filter(Boolean)
    )].sort()
  : [];
  const [showModal, setShowModal] = useState(false);

  const resetBehaviorState = useCallback(() => {
    setStudents([]);
    setFilteredStudents([]);
    setSubmittedReports([]);
    setStudentSearch('');
  }, []);

  const handleClassChange = (value: string) => {
    setClassSelected(value);
    setSectionSelected('');
    resetBehaviorState();
  };

  const handleSectionChange = (value: string) => {
    setSectionSelected(value);
    resetBehaviorState();
  };

  const loadStudents = useCallback(
    async (classArg?: string, sectionArg?: string): Promise<void> => {
      const classToLoad = classArg || classSelected;
      const sectionToLoad = sectionArg || sectionSelected;

      if (!classToLoad || !sectionToLoad) {
        Alert.alert('Error', 'Please select class and section');
        return;
      }

      try {
        setIsLoading(true);
        const schoolCode = await AsyncStorage.getItem('schoolCode');
        const res = await fetch('http://162.215.210.38:3010/api/student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ className: classToLoad, section: sectionToLoad, schoolCode }),
        });

        const data = await res.json();
        console.log('Behaviour student API response:', data);
        if (data.success && data.students?.length) {
          const sorted = data.students
            .filter((student: Student) => student.name)
            .sort((a: Student, b: Student) => a.name.localeCompare(b.name));
          setStudents(sorted);
          setFilteredStudents(sorted);
        } else {
          Alert.alert('Notice', 'No students found.');
          resetBehaviorState();
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to load students');
      } finally {
        setIsLoading(false);
      }
    },
    [classSelected, sectionSelected, resetBehaviorState]
  );

  useEffect(() => {
    if (classSelected && sectionSelected) {
      loadStudents(classSelected, sectionSelected);
    }
  }, [classSelected, sectionSelected, loadStudents]);

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
  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={ui.page}
        nestedScrollEnabled
      >
        <View style={local.summaryRow}>
          {summaryCards.map((card, index) => (
            <TeacherSummaryCard
              key={`${card.title}-${index}`}
              style={[
                index === 0 ? local.summaryCardLeft : local.summaryCardRight,
                { flex: 1 },
              ]}
            >
              <View style={local.summaryText}>
                <View style={local.summaryTitleRow}>
                  <Text style={local.summaryNumber} numberOfLines={1} ellipsizeMode="tail">
                    {card.title}
                  </Text>
                  <Text style={local.summarySubtitle} numberOfLines={1} ellipsizeMode="tail">
                    {card.subtitle}
                  </Text>
                </View>
                <Text style={local.summaryFooter} numberOfLines={2} ellipsizeMode="tail">
                  {card.footer}
                </Text>
              </View>
              <View style={local.summaryIconWrap}>
                <Ionicons name={card.icon} size={28} color="#4C4C4C" />
              </View>
            </TeacherSummaryCard>
          ))}
        </View>

        <View style={ui.card}>
          <Text style={ui.cardLabel}>Class and Section</Text>
          <View style={ui.classSectionRow}>
            <View style={ui.classSectionField}>
              <Text style={ui.fieldLabel}>Class</Text>
              <View style={ui.attendanceDropdownContainer}>
                <Picker
                  selectedValue={classSelected}
                  onValueChange={handleClassChange}
                  style={{ color: '#111827' }}
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
                  selectedValue={sectionSelected}
                  onValueChange={handleSectionChange}
                  enabled={Boolean(classSelected)}
                  style={{ color: '#111827' }}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label={classSelected ? 'Select Section' : 'Select Class First'} value="" />
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
            <TouchableOpacity style={ui.secondaryButton} onPress={loadStudents}>
              <Text style={ui.secondaryButtonText}>Load Students</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.messageBtnTall,
                { marginLeft: 0 },
                (!behaviorComment || isLoading) && { opacity: 0.5 },
              ]}
              onPress={submitReport}
              disabled={!behaviorComment || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Image source={ticketIcon} style={[styles.iconImage, { tintColor: '#0a3d62' }]} />
              )}
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

          <View style={ui.gridCard}>
            <FlatList
              data={filteredStudents}
              keyExtractor={(item) => item.username}
              numColumns={3}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              columnWrapperStyle={ui.studentGridRow}
              contentContainerStyle={ui.studentGridContent}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    ui.studentTile,
                    submittedReports.includes(item.username) ? ui.studentTilePresent : ui.studentTileDefault,
                  ]}
                  onPress={() => handleStudentIconClick(item)}
                >
                  <View style={[ui.studentAvatar, submittedReports.includes(item.username) && ui.studentAvatarPresent]}>
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={ui.studentPhoto} />
                    ) : (
                      <Ionicons name="person-outline" size={22} color="#2B2B2B" />
                    )}
                  </View>
                  <Text style={ui.studentName}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </ScrollView>

      {/* BEHAVIOR MODAL */}
      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 15 }}>{selectedStudent}</Text>

            <TouchableOpacity onPress={showBehaviorCommentActionSheet} style={styles.input1}>
              <Text style={{ color: behaviorComment ? '#333' : placeholderTextColor }}>
                {behaviorComment || "Select Behavior Category"}
              </Text>
            </TouchableOpacity>

            {showCommentInput && (
              <View style={{ width: '100%' }}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Additional comment..."
                  value={additionalComment}
                  onChangeText={handleCommentChange}
                  placeholderTextColor={placeholderTextColor}
                />
                {filteredSuggestions.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={{ padding: 10, backgroundColor: '#fff', marginTop: 5, borderRadius: 5 }}
                    onPress={() => {
                      setAdditionalComment(item);
                      setFilteredSuggestions([]);
                    }}
                  >
                    <Text>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.messageBtnTall, { marginLeft: 0 }, !behaviorComment && { opacity: 0.5 }]}
              onPress={submitReport}
              disabled={!behaviorComment}
            >
              <Image source={ticketIcon} style={[styles.iconImage, { tintColor: '#0a3d62' }]} />
            </TouchableOpacity>
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

      <TeacherFooter />
    </SafeAreaView>
  );
};

export default TeacherBehaviour;

const local = {
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginTop: 60,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4EA',
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    flexWrap: 'wrap' as const,
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: '900' as const,
    color: '#111111',
    marginRight: 4,
  },
  summarySubtitle: {
    fontSize: 12.5,
    fontWeight: '500' as const,
    color: '#252525',
    lineHeight: 18,
  },
  summaryFooter: {
    marginTop: 20,
    fontSize: 12.5,
    fontWeight: '500' as const,
    color: '#2B2B2B',
  },
  summaryIconWrap: {
    width: 34,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
    paddingTop: 2,
  },
};
