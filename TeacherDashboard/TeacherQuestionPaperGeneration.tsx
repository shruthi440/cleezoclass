import React, { useContext, useState, useCallback,useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,BackHandler,ActivityIndicator,
  Platform,Image,Dimensions,StyleSheet
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';

import { Picker } from '@react-native-picker/picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeContext } from '../ThemeContext';
import { globalStyles as styles } from '../teacherStyles';
import ticketIcon from '../icons/application.png'
import { TouchableWithoutFeedback } from 'react-native';
import { TeacherTimetableContext } from '../Modalcontext';
import TeacherTimetableComponent from '../TeacherTimetableComponent';
import TeacherFooter from './TeacherFooter';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scaleFont = (size: number) => (SCREEN_WIDTH / 375) * size;
/* ---------------- TYPES ---------------- */

type RootStackParamList = {
  TeacherQuestionPaperGeneration: {
    className?: string;
    section?: string;
    name:string;
    username?: string;
        schoolCode?: string;

  };
};


const TeacherQuestionPaperGeneration: React.FC<
  NativeStackScreenProps<RootStackParamList, 'TeacherQuestionPaperGeneration'>
> = ({ route, navigation }) => {
  const { themeStyles } = useContext(ThemeContext);
  const { name, username, schoolCode: routeSchoolCode } = route.params;
   const { nextClass } = useNextClass();
   const [selectedClass, setSelectedClass] = useState('');
 const [selectedSubject, setSelectedSubject] = useState('');
 const [selectedLesson, setSelectedLesson] = useState('');
 const [selectedTopic, setSelectedTopic] = useState('');
 const [selectedExam, setSelectedExam] = useState('');
 const [showTeacherTableModal, setShowTeacherTableModal] = useState(false);
 const context = useContext(TeacherTimetableContext);
 const teacherTimetable = context?.teacherTimetable || [];
 const loadingTable = context?.loading || false;
 const loading = context?.loading || false;
 const [modalData, setModalData] = useState<any[]>([]);
const [modalTitle, setModalTitle] = useState('');
const [modalLoading, setModalLoading] = useState(false);
const openModal = (title: string, data: any[] = []) => {
  setModalTitle(title);
  setModalData(data);
  setShowTeacherTableModal(true);
};
useFocusEffect(
  useCallback(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        navigation.goBack();
        return true; // prevent app exit
      }
    );

    return () => backHandler.remove(); // ✅ correct way
  }, [navigation])
);
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
  const [selectedSection, setSelectedSection] = useState('');

  const [selectedClassSection, setSelectedClassSection] = useState('');
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [sectionData, setSectionData] = useState<any[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
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
        console.log('📊 Sections fetched:', sectionData);
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

  // Sorted section data
  const classSortOrder: Record<string, number> = {
    Nursery: 0,
    LKG: 1,
    UKG: 2,
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

  const sortedSectionData = sectionData.sort((a, b) => {
    const indexA = classSortOrder[a.class_name] ?? 999;
    const indexB = classSortOrder[b.class_name] ?? 999;
    return indexA - indexB;
  });
  const handleClassSectionChange = async (value: string) => {
    setSelectedClassSection(value);

    if (!value) return;

    const [cls, sec] = value.split(' - ');
    setSelectedClass(cls);
    setSelectedSection(sec);

    // Auto load students (placeholder)
    setTimeout(() => {
      console.log(`Load students for class ${cls} section ${sec}`);
      // loadStudents(); // implement if needed
    }, 100);
  };
  const { fullTimetable, refreshNextClass } = useNextClass();
    const [showModal, setShowModal] = useState(false);
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>

          {/* DROPDOWN CONTAINER */}
          <View style={styles.dropdownWrapper}>
         <View style={styles.dropdownContainer}>
                   <Picker
                     selectedValue={selectedClassSection}
                     onValueChange={handleClassSectionChange}
                     style={[styles.picker, { color: '#fff' }]}
                     dropdownIconColor="#fff"
                   >
                     <Picker.Item label="Select Class - Section" value="" />
                     {sortedSectionData.map(item => (
                       <Picker.Item
                         key={`${item.class_name}-${item.section}`}
                         label={`${item.class_name} - ${item.section}`}
                         value={`${item.class_name} - ${item.section}`}
                       />
                     ))}
                   </Picker>
                 </View>
          </View>
    <View style={styles.mainLayout}>
               {/* Left Cards */}
            <View style={styles.leftColumn}>
                       <View style={[styles.smallCard, styles.overallBg]}>
                         <Text style={styles.cardTitleBlack}>Performance Syllabus</Text>
                         <Text style={styles.bigGradeBlack}>C</Text>
                         <Text style={styles.percentTextBlack}>68%</Text>
                         <TouchableOpacity>
                           <Text style={styles.viewLinkBlack}>View Report</Text>
                         </TouchableOpacity>
                       </View>
                     </View>
         
               {/* Right Card with Notches */}
   
     {/* Card */}
     <View style={styles.combinedCard}>
     <View style={styles.combinedSection}>
                   <Text style={styles.cardTitle}>pending Q.P Generations</Text>
                 <Text style={styles.bigNum}>24 
   </Text>
   
   <Text style={styles.percentTextBlack}>
    6A-2, 7A-1
   </Text>
   
                   <TouchableOpacity onPress={() => openModal('Next Test List', [])}><Text style={styles.viewLinkBlue}>View Report</Text></TouchableOpacity>
                 </View>
   
       <View style={styles.combinedSection}>
         <Text style={[styles.cardTitle,{marginTop:20}]}>Next Test</Text>
   <Text style={[styles.bigNum, { fontSize: 15 }]}>
   </Text>
         <Text style={styles.percentText}>FA2</Text>
<TouchableOpacity onPress={() => openModal('Next Test List', [])}>           <Text style={styles.viewLink1}>View List</Text>
         </TouchableOpacity>
       </View>
   
       {/* CENTERED NOTCH */}
       <View style={styles.notchContainer}>
         <View style={styles.leftNotch} />
         <View style={styles.dashedLine} />
         <View style={styles.rightNotch} />
       </View>
     </View>
   </View>

          {/* MAIN CONTAINER */}
          <View style={styles.syllabusContainer1}>

            {/* BUTTON ROW (EMPTY) */}
{/* DROPDOWN ROW */}
<View style={[styles.buttonRow1, { marginTop: 20 }]}>

  {/* EXAM TYPE DROPDOWN */}
<View style={styles.dropdownWrapper}>
  <Picker
    selectedValue={selectedExam}
    onValueChange={(value) => setSelectedExam(value)}
    style={[styles.picker, {color:'#000'}]}
    dropdownIconColor="#000"
  >
    <Picker.Item label="Select Exam" value="" color="black" />
    <Picker.Item label="FA1" value="FA1" color="black" />
    <Picker.Item label="FA2" value="FA2" color="black" />
    <Picker.Item label="FA3" value="FA3" color="black" />
    <Picker.Item label="FA4" value="FA4" color="black" />
    <Picker.Item label="SA1" value="SA1" color="black" />
    <Picker.Item label="SA2" value="SA2" color="black" />
  </Picker>
</View>

{/* TOPICS DROPDOWN */}
<View style={styles.dropdownWrapper}>
  <Picker
    selectedValue={selectedTopic}
    onValueChange={(value) => setSelectedTopic(value)}
    style={[styles.picker, {color:'#000'}]}
    dropdownIconColor="#000" 
  >
    <Picker.Item label="Select Topic" value="" color="black" />
    <Picker.Item label="Algebra" value="Algebra" color="black" />
    <Picker.Item label="Geometry" value="Geometry" color="black" />
    <Picker.Item label="Trigonometry" value="Trigonometry" color="black" />
    <Picker.Item label="Probability" value="Probability" color="black" />
    <Picker.Item label="Statistics" value="Statistics" color="black" />
  </Picker>
</View>


</View>


            
            {/* NOTCH */}
         

                {/* Content */}
                <View style={styles.syllabusContent}>
  <View style={[styles.notchContainer3,{marginTop:'-40%'}]}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine} />
              <View style={styles.rightNotch} />
            </View>
{/* MAIN CHART CONTAINER */}


{/* TITLE */}
<View>
  <Text style={[styles.blueName]}>Questions</Text>
</View>

{/* TOP CONTROLS */}
{/* MAIN CONTAINER */}
<View style={[styles.messageLayout, {marginTop:10}]}>

  {/* LEFT SIDE (TWO ROWS) */}
  <View style={styles.leftColumn3}>

    {/* TOP ROW */}
    <View style={styles.topRow}>
      <View style={styles.leftButtons}>

        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={selectedClass}
            onValueChange={setSelectedClass}
            style={styles.picker}
            dropdownIconColor="#fff"
          >
            <Picker.Item label=" Long" value="" />
            <Picker.Item label="6" value="6" />
            <Picker.Item label="7" value="7" />
            <Picker.Item label="8" value="8" />
          </Picker>
        </View>

        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={selectedSubject}
            onValueChange={setSelectedSubject}
            style={styles.picker}
            dropdownIconColor="#fff"
          >
            <Picker.Item label=" Short" value="" />
            <Picker.Item label="Maths" value="Maths" />
            <Picker.Item label="Science" value="Science" />
          </Picker>
        </View>

      </View>
    </View>
<View>
  <Text style={styles.blueName}>Choices</Text>
</View>
    {/* BOTTOM ROW */}
    <View style={[styles.topRow1, {marginTop:30}]}>
      <View style={styles.leftButtons}>

        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={selectedLesson}
            onValueChange={setSelectedLesson}
            style={styles.picker}
          >
            <Picker.Item label=" Long" value="" />
            <Picker.Item label="Algebra" value="Algebra" />
            <Picker.Item label="Geometry" value="Geometry" />
          </Picker>
        </View>

        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={selectedTopic}
            onValueChange={setSelectedTopic}
            style={styles.picker}
          >
            <Picker.Item label=" Short" value="" />
            <Picker.Item label="Linear Equations" value="Linear Equations" />
            <Picker.Item label="Quadratic Equations" value="Quadratic Equations" />
          </Picker>
        </View>

      </View>
    </View>

  </View>

  {/* RIGHT SIDE MESSAGE ICON (SPANS BOTH ROWS) */}
<TouchableOpacity style={styles.messageBtnTall}>
          <Image source={ticketIcon} style={[styles.iconImage, { tintColor: '#0088cc' }]} />

</TouchableOpacity>

</View>

    
    
            
                
                
    
    </View>

            {/* BOTTOM NOTCH */}
            <View style={styles.notchContainer5}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine} />
              <View style={styles.rightNotch} />
            </View>

          </View>
           
        </View>
      </ScrollView>

      {/* EMPTY MODAL */}
      <Modal transparent visible={false} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent} />
        </View>
      </Modal>
      {/* <Modal
        visible={showTeacherTableModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeacherTableModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowTeacherTableModal(false)}>
          <View style={modalStyles.overlay}> 
            
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={modalStyles.container}>
                <View style={modalStyles.header}>
                  <Text style={modalStyles.title}>My Timetable</Text>
                  <TouchableOpacity onPress={() => setShowTeacherTableModal(false)}>
                    <Ionicons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>
      
                <View style={{ flex: 1 }}>
                  {loading ? (
                    <ActivityIndicator color="gray" style={{ marginTop: 20 }} />
                  ) : (
                    <TeacherTimetableComponent data={teacherTimetable} />
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
      
          </View>
        </TouchableWithoutFeedback>
      </Modal> */}
<Modal
  visible={showTeacherTableModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowTeacherTableModal(false)}
>
  <TouchableWithoutFeedback onPress={() => setShowTeacherTableModal(false)}>
    <View style={modalStyles.overlay}>
      <TouchableWithoutFeedback>
        <View style={modalStyles.container}>
          {/* Header */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{modalTitle}</Text>
            <TouchableOpacity onPress={() => setShowTeacherTableModal(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            {modalLoading ? (
              <ActivityIndicator color="gray" style={{ marginTop: 20 }} />
            ) : modalData.length > 0 ? (
              modalData[0]?.day ? (
                <ScrollView>
                  {modalData.map((day: any, index: number) => (
                    <View key={index} style={{ marginBottom: 15 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{day.day}</Text>
                      {day.periods.map((p: any, idx: number) => (
                        <Text key={idx}>
                          {p.fromTime.slice(0, 5)} - {p.toTime.slice(0, 5)} : {p.subject} ({p.class_id})
                        </Text>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <TeacherTimetableComponent data={modalData} />
              )
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: '#555' }}>No Data Found</Text>
              </View>
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

export default TeacherQuestionPaperGeneration;
