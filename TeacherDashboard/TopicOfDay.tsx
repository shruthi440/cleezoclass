import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,StyleSheet
} from 'react-native';
import axios from 'axios';
import { Picker } from '@react-native-picker/picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons'
import ticketIcon from '../icons/application.png';
import { ThemeContext } from '../ThemeContext';
import { globalStyles as styles } from '../styles';
import Header from '../ChiefHeader';
import TeacherFooter from './TeacherFooter';
import { RootStackParamList } from '../types';
import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';
import TeacherSummaryCard from './TeacherSummaryCard';
import { TouchableWithoutFeedback } from 'react-native';
import { TeacherTimetableContext } from '../Modalcontext';
import TeacherTimetableComponent from '../TeacherTimetableComponent';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scaleFont = (size: number) => (SCREEN_WIDTH / 375) * size;

const localStyles = StyleSheet.create({
  pickerText: {
    color: '#111827',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
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
  topicSendButton: {
    alignSelf: 'center',
    marginLeft: 12,
    marginTop: 10,
  },
});
/* ---------------- TYPES ---------------- */

interface Teacher {
  id: string;
  name: string;
  subject: string;
  class: string;
}

type SubTopic = {
  id: string;
  title: string;
};

type TopicApiResponse = {
  fileName: string;
  subTopics: SubTopic[];
};

/* ---------------- COMPONENT ---------------- */

const TopicOfDay: React.FC<
  NativeStackScreenProps<RootStackParamList, 'TopicOfDay'>
> = ({ route }) => {
  const { username, name } = route.params;
console.log("Navigating with:", username, name);
  const { themeStyles } = useContext(ThemeContext);



  /* ---------------- STATE ---------------- */

  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
const [showTeacherTableModal, setShowTeacherTableModal] = useState(false);
const context = useContext(TeacherTimetableContext);
const teacherTimetable = context?.teacherTimetable || [];
const loadingTable = context?.loading || false;
const loading1 = context?.loading || false;
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [lessons, setLessons] = useState<{ label: string; code: string }[]>([]);
  const [topics, setTopics] = useState<SubTopic[]>([]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

  const [topicLoading, setTopicLoading] = useState(false);

  /* ---------------- LOAD SCHOOL CODE ---------------- */

  useEffect(() => {
    const loadSchoolCode = async () => {
      const code = await AsyncStorage.getItem('schoolCode');
      setSchoolCode(code);
      setLoading(false);
    };
    loadSchoolCode();
  }, []);

  /* ---------------- FETCH TEACHERS ---------------- */
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
    if (!schoolCode) return;

  const fetchTeachers = async () => {
  try {
    console.log('🔹 Fetching teachers with schoolCode:', schoolCode);
    console.log('🔹 Teacher name to match:', name);

    const res = await axios.get(
      'https://cleezoclass.com:4000/teachers',
      { params: { schoolCode } }
    );

    console.log('🔹 Teachers API response:', res.data);

    const loggedTeacher = res.data.find((t: Teacher) => t.name === name);

    if (loggedTeacher) {
      console.log('🔹 Logged-in teacher found:', loggedTeacher);

      // SUBJECTS
      const subjectArr = loggedTeacher.subject?.split(',').map(s => s.trim()) || [];
      console.log('🔹 Subjects for teacher:', subjectArr);
      setSubjects(subjectArr);
      setSelectedSubject(subjectArr.length > 0 ? subjectArr[0] : '');
      console.log('🔹 Selected subject set to:', subjectArr.length > 0 ? subjectArr[0] : '');

      // CLASSES
      const classArr = loggedTeacher.class?.split(',').map(c => c.trim()) || [];
      console.log('🔹 Classes for teacher:', classArr);
      setClasses(classArr);
      setSelectedClass(classArr.length > 0 ? classArr[0] : '');
      console.log('🔹 Selected class set to:', classArr.length > 0 ? classArr[0] : '');
    } else {
      console.warn('⚠️ No teacher found with name:', name);
    }
  } catch (err) {
    console.error('🔥 Teacher fetch error:', err);
  }
};

    fetchTeachers();
  }, [schoolCode, name]);

  /* ---------------- BUILD LESSONS ---------------- */
useEffect(() => {
  console.log('🟡 Selected Class:', selectedClass);
}, [selectedClass]);

useEffect(() => {
  console.log('🟡 Selected Subject:', selectedSubject);
}, [selectedSubject]);

useEffect(() => {
  console.log('🟡 Selected Lesson (fileCode):', selectedLesson);
}, [selectedLesson]);

  useEffect(() => {
    if (!selectedSubject || !selectedClass) return;

    const chapterList = Array.from({ length: 10 }, (_, i) => ({
      label: `Chapter ${i + 1}`,
      code: `${101 + i}`,
    }));

    setLessons(chapterList);
    setSelectedLesson(chapterList[0].code);
  }, [selectedSubject, selectedClass]);

  /* ---------------- FETCH TOPICS ---------------- */
const gradeMap: Record<string, string> = {
  '1': '1st maths',
  '2': '2nd maths',
  '3': '3rd maths',
  '4': '4th maths',
  '5': '5th maths',
  '6': '6th maths',
  '7': '7th maths',
};
  const { nextClass, fullTimetable, refreshNextClass } = useNextClass();
const normalizedGrade = gradeMap[selectedClass] || selectedClass;
const summaryCards = [
  {
    title: topics.length ? `${topics.length}` : '0',
    subtitle: 'Topics',
    footer: selectedTopic || 'Choose a topic',
    icon: 'book-outline',
    background: '#D7E7CD',
  },
  {
    title: selectedLesson || 'Lesson',
    subtitle: selectedSubject || 'Subject',
    footer: selectedClass ? `Class ${selectedClass}` : 'Select class first',
    icon: 'school-outline',
    background: '#F0EE96',
  },
];

const fetchTopics = async () => {
  console.log('🚀 fetchTopics triggered');

  if (!selectedSubject || !selectedClass || !selectedLesson) {
    console.warn('❌ Missing params:', {
      selectedSubject,
      selectedClass,
      selectedLesson,
    });
    return;
  }

  // Convert subject to uppercase
  const subjectUpper = selectedSubject.toUpperCase();

  // If you have a gradeMap for folder names
  const gradeMap: Record<string, string> = {
    '1': '1st maths',
    '2': '2nd maths',
    '3': '3rd maths',
    '4': '4th maths',
    '5': '5th maths',
    '6': '6th maths',
    '7': '7th maths',
  };
  const normalizedGrade = gradeMap[selectedClass] || selectedClass;

  const url = `https://cleezoclass.com:4000/api/extract-topics?subject=${encodeURIComponent(
    subjectUpper
  )}&grade=${encodeURIComponent(
    normalizedGrade
  )}&fileCode=${encodeURIComponent(selectedLesson)}`;

  console.log('🌐 Fetching Topics URL:', url);

  setTopicLoading(true);

  try {
    const response = await fetch(url);
    console.log('📡 HTTP Status:', response.status);

    const data = await response.json();
    console.log('✅ Topics API Response:', data);

    if (data?.subTopics && Array.isArray(data.subTopics)) {
      console.log(`🎉 ${data.subTopics.length} topics found`);
      setTopics(data.subTopics);
    } else {
      console.warn('⚠️ No subTopics array in response');
      setTopics([]);
    }
  } catch (error) {
    console.error('🔥 Fetch Topics Error:', error);
    setTopics([]);
  }

  setTopicLoading(false);
};



useEffect(() => {
  console.log('🔁 useEffect → fetchTopics (class/subject/lesson)');
  fetchTopics();
}, [selectedClass, selectedSubject, selectedLesson]);

const saveTopicOfDay = async (topicName: string) => {
  if (!selectedLesson || !selectedSubject || !topicName || !schoolCode) return;

  // Normalize chapter (101 -> 1, 102 -> 2, etc.)
  const normalizedChapter =
    parseInt(selectedLesson, 10) >= 101
      ? parseInt(selectedLesson, 10) - 100
      : parseInt(selectedLesson, 10);

  const payload = {
    schoolCode,           // used dynamically by backend
    teacherName: name,
    subject: selectedSubject.toUpperCase(),
    chapter: normalizedChapter,  // send normalized chapter
    topic: topicName,
  };

  try {
    const res = await axios.post(
      'https://cleezoclass.com:4000/api/save-topic',
      payload
    );

    if (res.data.success) {
      console.log('✅ Topic of the Day saved successfully');
      Alert.alert(
        'Success',
        'Topic of the Day saved successfully!',
        [{ text: 'OK', style: 'default' }]
      );
    } else {
      console.warn('⚠️ Failed to save topic:', res.data.error);
      Alert.alert(
        'Error',
        'Failed to save Topic of the Day. Please try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    }
  } catch (err) {
    console.error('🔥 Error saving topic:', err);
    Alert.alert(
      'Error',
      'An error occurred while saving the topic.',
      [{ text: 'OK', style: 'cancel' }]
    );
  }
};
  /* ---------------- UI ---------------- */
  const [showModal, setShowModal] = useState(false);
  useEffect(() => {
    refreshNextClass();
  }, [refreshNextClass]);    
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
          <View style={localStyles.summaryRow}>
            {summaryCards.map((card, index) => (
              <TeacherSummaryCard
                key={`${card.subtitle}-${index}`}
                style={[
                  localStyles.summaryCard,
                  index === 0 ? localStyles.summaryCardLeft : localStyles.summaryCardRight,
                ]}
              >
                <View style={localStyles.summaryText}>
                  <View style={localStyles.summaryTitleRow}>
                    <Text style={localStyles.summaryNumber} numberOfLines={1} ellipsizeMode="tail">
                      {card.title}
                    </Text>
                    <Text style={localStyles.summarySubtitle} numberOfLines={1} ellipsizeMode="tail">
                      {card.subtitle}
                    </Text>
                  </View>
                  <Text style={localStyles.summaryFooter} numberOfLines={2} ellipsizeMode="tail">
                    {card.footer}
                  </Text>
                </View>
                <View style={localStyles.summaryIconWrap}>
                  <Ionicons name={card.icon as any} size={28} color="#4C4C4C" />
                </View>
              </TeacherSummaryCard>
            ))}
          </View>

     

          {/* MAIN CONTAINER */}
          <View style={[styles.syllabusContainer1, { height: SCREEN_HEIGHT * 0.6 }]}>

                {/* Content */}
                <View style={[styles.syllabusContent,{marginTop:-40}]}>
<View style={styles.notchContainer3}>
  <View style={styles.leftNotch} />
  <View style={styles.dashedLine} />
  <View style={styles.rightNotch} />
</View>
{/* MAIN CHART CONTAINER */}
<View style={styles.chartWrapper}>

  {/* GRAPH (YAxis + Bars) */}
  <View style={styles.chartFrame1}>
    <View style={styles.yAxis}>
      {['dec', 'nov', 'oct', 'sep'].map(m => (
        <Text key={m} style={styles.axisLabel}>{m}</Text>
      ))}
    </View>

    <View style={styles.chartArea1}>

      {/* 6A */}
      <View style={styles.barPair}>
        <View style={styles.barRow}>
          <View style={[styles.bar, styles.runBar, { height: 40 }]} />
          <View style={[styles.bar, styles.lagBar, { height: 50 }]} />
        </View>
        <Text style={styles.barName}>6A</Text>
      </View>

      {/* 6B */}
      <View style={styles.barPair}>
        <View style={styles.barRow}>
          <View style={[styles.bar, styles.runBar, { height: 70 }]} />
          <View style={[styles.bar, styles.lagBar, { height: 40 }]} />
        </View>
        <Text style={styles.barName}>6B</Text>
      </View>

      {/* 7B */}
      <View style={styles.barPair}>
        <View style={styles.barRow}>
          <View style={[styles.bar, styles.runBar, { height: 55 }]} />
          <View style={[styles.bar, styles.lagBar, { height: 20 }]} />
        </View>
        <Text style={styles.barName}>7B</Text>
      </View>

    </View>
  </View>

  {/* LEGEND (BOTTOM) */}
  <View style={[styles.legendRow]}>
    <View style={styles.legendItem}>
      <View style={[styles.box, styles.runBar]} />
      <Text>Running</Text>
    </View>
    <View style={styles.legendItem}>
      <View style={[styles.box, styles.lagBar]} />
      <Text>Lagging</Text>
    </View>
  </View>

</View>
<View style={styles.middleSection}>

{/* TITLE */}
<View>
            {/* TITLE */}
            <Text style={styles.blueName}>Topic of Day</Text>

            {/* DROPDOWNS */}
            <View style={styles.messageLayout}>
              <View style={styles.leftColumn3}>

                {/* ROW 1 */}
                <View style={styles.topRow}>
                  <View style={styles.leftButtons}>

                    {/* CLASS */}
                    <View style={styles.dropdownContainer}>
                      <Picker
                        selectedValue={selectedClass}
                        onValueChange={setSelectedClass}
                        style={[styles.picker, localStyles.pickerText]}
                      >
                        <Picker.Item label="Class" value="" color="#111827" />
                    {[...classes]
  .sort((a, b) => {
    const order = ['LKG', 'UKG'];

    if (order.includes(a) && order.includes(b)) {
      return order.indexOf(a) - order.indexOf(b);
    }
    if (order.includes(a)) return -1;
    if (order.includes(b)) return 1;

    return Number(a) - Number(b);
  })
  .map(cls => (
    <Picker.Item key={cls} label={cls.toString()} value={cls} color="#111827" />
  ))}

                      </Picker>
                    </View>

                    {/* SUBJECT */}
                    <View style={styles.dropdownContainer}>
                      <Picker
                        selectedValue={selectedSubject}
                        onValueChange={setSelectedSubject}
                        style={[styles.picker, localStyles.pickerText]}
                      >
                        <Picker.Item label="Subject" value="" color="#111827" />
                        {subjects.map(sub => (
                          <Picker.Item key={sub} label={sub} value={sub} color="#111827" />
                        ))}
                      </Picker>
                    </View>

                  </View>
                </View>

                {/* ROW 2 */}
                <View style={styles.topRow1}>
                  <View style={styles.leftButtons}>

                    {/* LESSON */}
                    <View style={styles.dropdownContainer}>
                      <Picker
                        selectedValue={selectedLesson}
                        onValueChange={setSelectedLesson}
                        style={[styles.picker, localStyles.pickerText]}
                      >
                        <Picker.Item label="Lesson" value="" color="#111827" />
                        {lessons.map(lsn => (
                          <Picker.Item
                            key={lsn.code}
                            label={lsn.label}
                            value={lsn.code}
                            color="#111827"
                          />
                        ))}
                      </Picker>
                    </View>

                    {/* TOPIC */}
                    <View style={styles.dropdownContainer}>
                      {topicLoading ? (
                        <ActivityIndicator />
                      ) : (
<Picker
  selectedValue={selectedTopic}
  onValueChange={(val) => {
    console.log('🟢 Topic selected:', val);
    setSelectedTopic(val);
  }}
  style={[styles.picker, localStyles.pickerText]}
>
  <Picker.Item label="Topic" value="" color="#111827" />
  {topics.map(tp => (
    <Picker.Item key={tp.id} label={tp.title} value={tp.title} color="#111827" />
  ))}
</Picker>


                      )}
                    </View>

                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.messageBtnTall, localStyles.topicSendButton]}
                onPress={() => {
                  if (!selectedClass || !selectedSubject || !selectedLesson || !selectedTopic) {
                    alert("Please select Class, Subject, Lesson and Topic");
                    return;
                  }

                  saveTopicOfDay(selectedTopic);
                }}
              >
                <Image
                  source={ticketIcon}
                  style={[styles.iconImage, { tintColor: '#0a3d62' }]}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

  <View style={styles.notchContainer5}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine} />
              <View style={styles.rightNotch} />
            </View>

            {/* FOOTER NOTES (EMPTY) */}


            {/* FOOTER */}
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
        </View>
     
          </View>
      </ScrollView>

      <Modal transparent visible={false}>
        <View />
      </Modal>
           <View style={styles.footerWrapper1}>
            <TeacherFooter />
          </View>
    </SafeAreaView>
  );
};

export default TopicOfDay;
