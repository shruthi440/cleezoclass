import React, { useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';

import { Picker } from '@react-native-picker/picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ThemeContext } from '../ThemeContext';
import { globalStyles as styles } from '../teacherStyles';
import Header from '../ChiefHeader';
import TeacherFooter from './TeacherFooter';
import { useNextClass } from '../NextClassContext';

/* ---------------- TYPES ---------------- */

type RootStackParamList = {
  TeacherTicket: {
    username: string
    className?: string;
    section?: string;
  };
};

/* ---------------- COMPONENT ---------------- */

const TeacherTicket: React.FC<
  NativeStackScreenProps<RootStackParamList, 'TeacherTicket'>
  
> = ({ route }) => {
    const { nextClass } = useNextClass();
  const { themeStyles } = useContext(ThemeContext);
const { username} = route.params || {};
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>

          {/* HEADER */}
          <View style={styles.headerRow}>
            <Text style={styles.headerText}>Routine - Ticket</Text>
            <Header />
          </View>

          {/* DROPDOWN CONTAINER */}
          <View style={styles.dropdownWrapper}>
            <View style={styles.dropdownContainer}>
              <Picker
                selectedValue="-"
                onValueChange={() => {}}
                style={{ color: '#fff' }}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="Select Class - Section" value="-" />
              </Picker>
            </View>
          </View>

          {/* INFO CARDS */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
            <View style={[styles.smallCard, { marginRight: 5, width: '50%' }]}>
              <Text style={styles.cardTitle}>Censure Rank Syllabus</Text>
                     <Text style={styles.bigGradeBlack}>82.41%</Text>
                                 <TouchableOpacity><Text style={styles.viewLinkBlue}>View Report</Text></TouchableOpacity>
              
            </View>

            <View style={[styles.smallCard, styles.overallBg, { marginLeft: 5, width: '50%' }]}>
 <Text style={styles.cardTitle}>Censure Rank Overall</Text>
                     <Text style={styles.bigGradeBlack}>82.41%</Text>
                                 <TouchableOpacity><Text style={styles.viewLinkBlue}>View Report</Text></TouchableOpacity>            </View>
          </View>

          {/* MAIN CONTAINER */}
          <View style={styles.syllabusContainer1}>

            {/* BUTTON ROW (EMPTY) */}
         <View style={[styles.buttonRow1]}>
  {/* SELECT BUTTON */}
  <TouchableOpacity style={[styles.submitBtn1,{borderWidth: 0}]}>
  <Text style={[styles.submitBtnText,]}>
          NOC-Students

</Text>

  </TouchableOpacity>

  {/* DOWNLOAD BUTTON */}
  <TouchableOpacity style={styles.submitBtn1}>
    <Text style={styles.submitBtnText}>
      Censure-Self
    </Text>
  </TouchableOpacity>
</View>

            {/* NOTCH */}
            <View style={styles.notchContainer3}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine} />
              <View style={styles.rightNotch} />
            </View>

            {/* GRID CONTAINER (EMPTY) */}
            <View style={styles.gridContainer}>
              <ScrollView contentContainerStyle={styles.gridScrollContent} />
            </View>

            {/* BOTTOM NOTCH */}
            <View style={styles.notchContainer4}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine1} />
              <View style={styles.rightNotch} />
            </View>

            {/* FOOTER NOTES (EMPTY) */}
<View style={styles.extraButtonRow}>
  <TouchableOpacity
    style={styles.extraBtn}
    onPress={() => {
      console.log('Extra Class clicked');
    }}
  >
    <Text style={styles.extraBtnText}>Extra Class</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.extraBtn}
    onPress={() => {
      console.log('Address clicked');
    }}
  >
    <Text style={styles.extraBtnText}>Address</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.extraBtn}
    onPress={() => {
      console.log('Reason clicked');
    }}
  >
    <Text style={styles.extraBtnText}>Reason</Text>
  </TouchableOpacity>
</View>
          </View>
        </View>
      </ScrollView>

      <TeacherFooter />

      {/* EMPTY MODAL */}
      <Modal transparent visible={false} animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent} />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TeacherTicket;
