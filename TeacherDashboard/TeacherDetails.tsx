import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, 
  ScrollView, Modal,SafeAreaView, StatusBar, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import TeacherFooter from './TeacherFooter';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import Header from '../TeacherHeader'
type Props = NativeStackScreenProps<RootStackParamList, 'TeacherDetails'>;



type Navigation = NativeStackNavigationProp<RootStackParamList>;

// Data types
interface Teacher {
  username: string;
  name: string;
  gender: string;
  designation: string;
  phone_no: string;
  aadhar_no: string;
  address: string;
  photoUrl?: string;
  schoolCode: string;
  teaches_to_1?: number | null;
  teaches_to_2?: number | null;
  teaches_to_3?: number | null;
  teaches_to_4?: number | null;
  teaches_to_5?: number | null;
  teaches_to_6?: number | null;
  teaches_to_7?: number | null;
  teaches_to_8?: number | null;
  teaches_to_9?: number | null;
  teaches_to_10?: number | null;
}

interface TeacherData extends Teacher {
  teachesToClasses: number[];
}

interface Child {
  id: number;
  name: string;
  class_name: string;
  section: string;
  username: string;
  phone_no: string | number;
  user_type: string;
}

const TeacherDetails: React.FC<Props> = ({ route, navigation }) => {
  const { username: passedUsername } = route.params 
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [showChildrenModal, setShowChildrenModal] = useState<boolean>(false);
const [schoolCode, setSchoolCode] = useState<string | null>(null);
useEffect(() => {
  const loadSchoolCode = async () => {
    try {
      const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
      setSchoolCode(storedSchoolCode);
    } catch {
      // Ignore storage read failures here and let the profile load handle it.
    }
  };

  loadSchoolCode();
}, []);
useEffect(() => {
  if (!teacherData || !schoolCode) return;

  fetchTeacherChildren(
    teacherData.phone_no,
    schoolCode
  ).then(setChildren);
}, [teacherData, schoolCode]);


const fetchTeacherChildren = async (
  teacherPhone: string, 
  schoolCode: string
): Promise<Child[]> => {
  try {
    const response = await axios.get(
      'http://162.215.210.38:3010/api/find-children-by-credentials', 
      {
        params: { phone_no: teacherPhone, schoolCode },
        timeout: 10000
      }
    );

    // ✅ Use response.data.students instead of response.data.children
    if (response.data.success && response.data.students) {
      return response.data.students;
    }

    // Fallback if no students are returned
    return [
      {
        id: 513,
        name: 'shruthi',
        class_name: '1',
        section: 'C',
        username: 'unknown',
        phone_no: teacherPhone,
        user_type: 'student'
      }
    ];
  } catch {
    return [
      {
        id: 513,
        name: 'shruthi',
        class_name: '1',
        section: 'C',
        username: 'unknown',
        phone_no: teacherPhone,
        user_type: 'student'
      }
    ];
  }
};


  const fetchTeacherProfile = async () => {
    try {
      setLoading(true);

      const [username, schoolCode] = await Promise.all([
        AsyncStorage.getItem('username'),
        AsyncStorage.getItem('schoolCode')
      ]);

      if (!username || !schoolCode) {
        Alert.alert('Session Expired', 'Please login again');
        navigation.navigate('Login');
        return;
      }

      const response = await axios.get('http://162.215.210.38:3010/api/teacher/profile', {
        params: { username, schoolCode },
        timeout: 15000
      });

      if (response.data.success) {
        const teacher: Teacher = response.data.teacher;

        const teachesToClasses: number[] = [
          teacher.teaches_to_1, teacher.teaches_to_2, teacher.teaches_to_3, teacher.teaches_to_4,
          teacher.teaches_to_5, teacher.teaches_to_6, teacher.teaches_to_7, teacher.teaches_to_8,
          teacher.teaches_to_9, teacher.teaches_to_10
        ].filter(cls => cls != null && cls !== 0) as number[];

        const processedTeacherData: TeacherData = {
          ...teacher,
          photoUrl: teacher.photoUrl || 'https://via.placeholder.com/150?text=Teacher',
          teachesToClasses
        };

        await AsyncStorage.setItem('teacherProfile', JSON.stringify(processedTeacherData));
        setTeacherData(processedTeacherData);

        const childrenData = await fetchTeacherChildren(
          teacher.phone_no, 
          teacher.schoolCode
        );
        
        setChildren(childrenData);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to load profile');
      }
    } catch (error: any) {
      let errorMessage = 'Network error';
      if (error.response) {
        errorMessage = `Server error: ${error.response.status}`;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout';
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherProfile();
  }, []);

  const handleSwitchToChild = async (child: Child) => {
    try {
      await AsyncStorage.multiSet([
        ['activeChildId', child.id.toString()],
        ['activeChildName', child.name],
        ['activeChildClass', child.class_name || ''],
        ['activeChildSection', child.section || ''],
        ['activeRole', 'parent'],
        ['activeUserType', 'student'],
        ['currentChildData', JSON.stringify(child)]
      ]);

      Alert.alert(
        'Account Switched', 
        `Successfully switched to ${child.name}'s parent account`,
        [{ text: 'OK', onPress: () => navigation.replace('ParentDashboard', { username: child.username ,  name: child.name || '' // must pass a string
}) }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to switch to child account');
    } finally {
      setShowChildrenModal(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ color:'black' }}>Loading Teacher Profile...</Text>
      </View>
    );
  }

  if (!teacherData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load teacher profile. Please try again later.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTeacherProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { name, photoUrl, gender, designation, phone_no, aadhar_no, address, teachesToClasses, username } = teacherData;


  return (
  <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView}>
        <View style={styles.container}>
      {/* Header Section */}
<Header/>

   

      {/* Children Modal */}
      <Modal visible={showChildrenModal} transparent animationType="slide" onRequestClose={() => setShowChildrenModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Child</Text>
            <Text style={styles.modalSubtitle}>Switch to parent role for:</Text>
            
            {children.length > 0 ? children.map((child, index) => (
              <TouchableOpacity key={child.id || index} style={styles.childItem} onPress={() => handleSwitchToChild(child)}>
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childDetails}>Class: {child.class_name || 'N/A'} | Section: {child.section || 'N/A'}</Text>
                <Text style={styles.childCredentials}>Username: {child.username} | Phone: {child.phone_no}</Text>
              </TouchableOpacity>
            )) : (
              <Text style={styles.noChildrenText}>No children found</Text>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={() => setShowChildrenModal(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.scrollView}>
        <View style={styles.profileContainer}>
          <Text style={styles.headerText}>Teacher Information</Text>
          
          {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.profileImage} /> : <Text style={styles.noPhotoText}>No Profile Picture</Text>}
          
     <View style={styles.infoBox}>

  {/* Row 1 */}
  <View style={styles.row}>
    <Text style={styles.field}>
      <Text style={styles.bold}>Name:</Text> {name}
    </Text>
    <Text style={styles.field}>
      <Text style={styles.bold}>Username:</Text> {username}
    </Text>
  </View>

  {/* Row 2 */}
  <View style={styles.row}>
    <Text style={styles.field}>
      <Text style={styles.bold}>Gender:</Text> {gender}
    </Text>
    <Text style={styles.field}>
      <Text style={styles.bold}>Designation:</Text> {designation}
    </Text>
  </View>

  {/* Row 3 */}
  <View style={styles.row}>
    <Text style={styles.field}>
      <Text style={styles.bold}>Phone:</Text> {phone_no}
    </Text>
    <Text style={styles.field}>
      <Text style={styles.bold}>Aadhar:</Text> {aadhar_no}
    </Text>
  </View>

  {/* Row 4 */}
  <View style={styles.row}>
    <Text style={[styles.field, { flex: 1 }]}>
      <Text style={styles.bold}>Address:</Text> {address}
    </Text>
  </View>

  {/* Classes Section */}
  {teachesToClasses.length > 0 && (
    <View style={styles.classesSection}>
      <Text style={styles.bold}>Teaches to Classes:</Text>
      {teachesToClasses.map((className, index) => (
        <Text key={index} style={styles.classItem}>
          • Class {className}
        </Text>
      ))}
    </View>
  )}

</View>


          {children.length > 0 && (
            <View style={styles.childrenSection}>
              <Text style={styles.childrenTitle}>Your Children in School</Text>
              {children.map((child, index) => (
                <View key={child.id || index} style={styles.childSummary}>
                  <Text style={styles.childSummaryName}>{child.name}</Text>
                  <Text style={styles.childSummaryDetails}>Class {child.class_name} - Section {child.section}</Text>
                </View>
              ))}
              <Text style={styles.switchHint}>Use the "Switch" button to access parent features</Text>
            </View>
          )}
        </View>
<View style={styles.buttonRow}>
  <TouchableOpacity
    style={[
      styles.switchButton,
      children.length === 0 && styles.switchButtonDisabled
    ]}
    onPress={() =>
      children.length > 0
        ? setShowChildrenModal(true)
        : Alert.alert('Info', 'No children found with your credentials')
    }
    disabled={children.length === 0}
  >
    <Ionicons name="power-outline" size={28} color="#fff" />
    <Text style={styles.switchButtonText}>
      Switch {children.length > 0 ? `(${children.length})` : ''}
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.logoutButton}
    onPress={async () => {
      await AsyncStorage.multiRemove([
        'username', 'userType', 'lastScreen',
        'activeChildId', 'activeChildName', 'activeChildClass',
        'activeChildSection', 'activeRole', 'activeUserType', 'currentChildData'
      ]);
      navigation.navigate('Home');
    }}
  >
    <Text style={styles.logoutButtonText}>Logout</Text>
  </TouchableOpacity>
</View>

      </ScrollView>

    </View>
  </ScrollView>

  <TeacherFooter profileRoute="TeacherDashboard" />
</SafeAreaView>
  );
};
const styles = StyleSheet.create({
  mobileFrame: { flex: 1, backgroundColor: '#fff' },
  safeArea: { 
      flex: 1, 
      backgroundColor: '#F4F6F8' 
    },
    scrollView: { 
      flex: 1 
    },
    container: { 
      padding:'4%',// 4% of screen width for consistent margins
      marginTop: Platform.OS === 'ios' ? 0 : 10 
    },
    
  scrollView: { flex: 1 },
  subHeader: {
    backgroundColor: '#111827',
    paddingVertical: hp('1%'),
    alignItems: 'center',
    height: hp('5%'),
    justifyContent: 'center',
  },
  subHeaderText: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    height: hp('12%'),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  logo: { width: 60, height: 60 },
buttonRow: {
  flexDirection: 'row',
  justifyContent: 'space-between', // or 'space-around'
  alignItems: 'center',
  marginTop: 15,
},

switchButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
  marginRight: 10,
  borderRadius: 999,
  backgroundColor: '#111827',
},

switchButtonDisabled: {
  backgroundColor: '#CBD5E1',
},

logoutButton: {
  flex: 1,
  padding: 12,
  borderRadius: 999,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#EF4444',
},

  switchButtonText: {
    color: '#fff',
    fontSize: wp('3.5%'),
    fontWeight: 'bold',
  },
  debugInfo: {
    backgroundColor: '#fff3CD',
    padding: 8,
    margin: 10,
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  debugText: {
    fontSize: 12,
    color: '#856404',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  childItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderRadius: 14,
  },
  childName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  childDetails: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  childCredentials: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontStyle: 'italic',
  },
  noChildrenText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginVertical: 20,
  },
  closeButton: {
    backgroundColor: 'rgb(160, 180, 182)',
    padding: 12,
    borderRadius: 5,
    marginTop: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  profileContainer: { 
    padding: 20, 
    backgroundColor: '#fff', 
  },
  headerText: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: 'black', 
    marginBottom: 15, 
    textAlign: 'center' 
  },

  profileImage: { 
    width: 60, 
    height: 60, 
    borderRadius: 60, 
    marginBottom: 20, 
    alignSelf: 'center', 
    borderWidth: 2, 
    borderColor: '#ccc' 
  },
  noPhotoText: { 
    textAlign: 'center', 
    marginVertical: 10, 
    color: '#666',
    fontStyle: 'italic'
  },
  infoBox: { 
    padding: 15, 
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  field: {
    fontSize: 10,   // ✅ font size 10
    flex: 0.48,     // two equal columns
  },

  bold: {
    fontWeight: "bold",
    fontSize: 10,   // ✅ keep same size
  },
  classesSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  classItem: { 
    marginLeft: 10, 
    color: '#555',
    marginTop: 4,
  },
  childrenSection: {
    backgroundColor: '#EEF2FF',
    padding: 15,
    borderRadius: 18,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#111827',
  },
  childrenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  childSummary: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  childSummaryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  childSummaryDetails: {
    fontSize: 14,
    color: '#666',
  },
  footerWrapper: {
    position: 'absolute',
    bottom: -40,
    left: 0,
    right: 0,
  },
  switchHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },

  
  logoutButtonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  errorText: { 
    color: 'red', 
    fontSize: 16, 
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: 'rgb(160, 180, 182)',
    padding: 12,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
export default TeacherDetails;
