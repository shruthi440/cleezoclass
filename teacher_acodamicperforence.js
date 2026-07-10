

import React, { useState, useEffect,useContext } from 'react';
import {
    View,
    Text,
    Button,
    TextInput,
    Modal,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Image,
    ScrollView,ActionSheetIOS
} from 'react-native';
import PickerSelect from 'react-native-picker-select';
import { useNavigation } from '@react-navigation/native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faHome, faUser } from '@fortawesome/free-solid-svg-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { ThemeContext } from './ThemeContext';
import { color } from 'react-native-elements/dist/helpers';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TeacherAcademicPerformanceEntry = () => {
      const {themeStyles} = useContext(ThemeContext);
       const placeholderTextColor = themeStyles.inputBorderColor; const [busNumber, setBusNumber] = useState('');
       const [isLoadStudentsClicked, setIsLoadStudentsClicked] = useState(false);

    const [classSelected, setClassSelected] = useState('');
    const [sectionSelected, setSectionSelected] = useState('');
    const [testTypeSelected, setTestTypeSelected] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [academicReport, setAcademicReport] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
     const [subjects, setSubjects] = useState([]); 
         const [data, setData] = useState([]);
    const navigation = useNavigation();
    const [isLoadDisabled, setIsLoadDisabled] = useState(false);
    const [isFetchDisabled, setIsFetchDisabled] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

const [isLoading,setIsLoading]=useState(false);

    const showClassActionSheet = () => {
        const options = ['Cancel', ...Array.from({ length: 10 }, (_, i) => `${i + 1}`)];
    
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: 0, // "Cancel" button at index 0
          },
          (buttonIndex) => {
            if (buttonIndex !== 0) {
              setClassSelected(options[buttonIndex]); // Set selected class
            }
          }
        );
      };
    
      // Function to show ActionSheet for Section selection
      const showSectionActionSheet = () => {
        const options = ['Cancel', 'A', 'B', 'C', 'D', 'E'];
    
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: 0, // "Cancel" button at index 0
          },
          (buttonIndex) => {
            if (buttonIndex !== 0) {
              setSectionSelected(options[buttonIndex]); // Set selected section
            }
          }
        );
      };
    
      // Function to show ActionSheet for Test Type selection
      const showTestTypeActionSheet = () => {
        const options = [
          'Cancel',
          'FA1',
          'FA2',
          'SA1',
          'FA3',
          'FA4',
          'SA2',
          
        ];
    
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: 0, // "Cancel" button at index 0
          },
          (buttonIndex) => {
            if (buttonIndex !== 0) {
              setTestTypeSelected(options[buttonIndex]); // Set selected test type
            }
          }
        );
      };


    
    useEffect(() => {
        console.log("Modal Visibility:", modalVisible);
      }, [modalVisible]);
      
      const fetchSubjects = async () => {
        if (classSelected && sectionSelected) {
          try {
            // Get schoolCode from AsyncStorage
            const schoolCode = await AsyncStorage.getItem('schoolCode');
            if (!schoolCode) {
              Alert.alert('Error', 'School Code not found. Please log in again.');
              return;
            }
      
            const response = await fetch(
              `http://162.215.210.38:3010/api/get_subjects?class=${classSelected}&section=${sectionSelected}&schoolCode=${schoolCode}`
            );
      
            if (!response.ok) {
              const errorText = await response.text();
              Alert.alert('Error', errorText || 'Failed to fetch subjects.');
              return;
            }
      
            const data = await response.json();
            setAcademicReport(data.map((subject) => ({ subject, marks: '' })));
      
          } catch (error) {
            console.error('Error fetching subjects:', error);
            Alert.alert('Error', 'Failed to fetch subjects.');
          }
        } else {
        }
      };
    
    useEffect(() => {
    
        fetchSubjects();
    }, [classSelected, sectionSelected]);
    
    const fetchStudents = async () => {
      console.log('fetchStudents called');
    
      if (classSelected && sectionSelected) {
        console.log('Class:', classSelected, 'Section:', sectionSelected);
    
        try {
          const schoolCode = await AsyncStorage.getItem('schoolCode');
          console.log('Retrieved schoolCode:', schoolCode);
    
          if (!schoolCode) {
            console.error('School Code not found');
            Alert.alert('Error', 'School Code not found. Please log in again.');
            return;
          }
    
          const apiUrl = `http://162.215.210.38:3010/api/get_students?class=${classSelected}&section=${sectionSelected}&schoolCode=${schoolCode}`;
          console.log('Fetching from URL:', apiUrl);
    
          const response = await fetch(apiUrl);
    
          console.log('Response status:', response.status);
    
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            Alert.alert('Error', `Error: ${response.status} - ${errorText || response.statusText}`);
            return;
          }
    
          const data = await response.json();
          console.log('Received data:', data);
    
          setStudents(data.students);
          setIsLoadStudentsClicked(true); // Disable Fetch Data button
        } catch (error) {
          console.error('Fetch error:', error);
          Alert.alert('Error', 'Failed to fetch students.');
        }
      } else {
        console.warn('Class or section not selected');
        Alert.alert('Error', 'Please select both class and section.');
      }
    };
    
      useEffect(() => {
        fetchSubjects();
      }, [classSelected, sectionSelected]);
 

    useEffect(() => {
      
        fetchSubjects();
    }, [classSelected, sectionSelected]);

    const handleMarksChange = (index, value) => {
        const updatedReport = [...academicReport];
        updatedReport[index].marks = value;
        setAcademicReport(updatedReport);
    };

    const submitReport = async () => {
      if (academicReport.some((item) => item.marks === undefined || item.marks === null || item.marks === '')) {
        Alert.alert('Error', 'Please fill in marks for all subjects.');
        return;
      }
    
      if (!testTypeSelected || !classSelected || !sectionSelected || !selectedStudent) {
        Alert.alert('Error', 'Please select student, class, section, and test type.');
        return;
      }
    
      try {
        // Retrieve schoolCode from AsyncStorage
        const schoolCode = await AsyncStorage.getItem('schoolCode');
        if (!schoolCode) {
          Alert.alert('Error', 'School Code not found. Please log in again.');
          return;
        }
    
        const reportData = {
          name: selectedStudent,
          academic_report: academicReport,
          class_name: classSelected,
          section: sectionSelected,
          test_type: testTypeSelected,
          schoolCode,
        };
    
        const response = await fetch('http://162.215.210.38:3010/api/save_academic_report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData),
        });
    
        if (response.ok) {
          Alert.alert('Success', 'Academic Report submitted successfully!');
          setIsSubmitted(true);
          setModalVisible(false);
        } else {
          const errorData = await response.json();
          Alert.alert('Error', errorData.message || 'Failed to submit report.');
        }
      } catch (error) {
        console.error('Error during submission:', error);
        Alert.alert('Error', 'Failed to submit report.');
      }
    };
    
    const openModal = (studentName) => {
        setSelectedStudent(studentName);
        setIsSubmitted(false);
        fetchSubjects();
        setModalVisible(true);
    };
    const renderStudent = ({ item }) => (
        <TouchableOpacity
          style={styles.studentContainer}
          onPress={() => openModal(item.name)}
        >
          <View style={styles.iconBackground}>
            {item.photoUrl ? (
              <Image
                source={{ uri: item.photoUrl }}
                style={styles.studentPhoto} // Custom styling for image
              />
            ) : (
              <FontAwesomeIcon icon={faUser} size={wp('9%')} />
            )}
          </View>
          <Text style={styles.studentName}>{item.name}</Text>
        </TouchableOpacity>
      );
      

      const fetchData = async () => {
        if (!classSelected || !sectionSelected || !testTypeSelected) {
            alert('Please select class, section, and test type.');
            return;
        }
    
        console.log('🔍 Fetching data with:', { classSelected, sectionSelected, testTypeSelected });
    
        try {
            // Get school code from AsyncStorage
            const schoolCode = await AsyncStorage.getItem('schoolCode');
            if (!schoolCode) {
                alert('School code not found. Please login again.');
                return;
            }
            console.log('🏫 School Code:', schoolCode);
    
            const queryParams = new URLSearchParams({
                class_name: classSelected,
                section: sectionSelected,
                test_type: testTypeSelected,
                schoolcode: schoolCode, // ✅ Added schoolcode here
            });
    
            const finalURL = `http://162.215.210.38:3010/api/academic_performance?${queryParams.toString()}`;
            console.log('🌐 Final API URL:', finalURL);
    
            const response = await fetch(finalURL);
            console.log('📡 Raw response:', response);
    
            if (!response.ok) {
                console.error('❌ Response not OK:', response.status, response.statusText);
                throw new Error('Failed to fetch');
            }
    
            const data = await response.json();
            console.log('📦 Parsed JSON:', data);
    
            if (data.records && data.records.length > 0) {
                console.log(`✅ ${data.records.length} records found.`);
                setData(data.records);
    
                const extractSubjects = new Set();
    
                data.records.forEach((record, index) => {
                    console.log(`🧾 Record ${index + 1}:`, record);
                    Object.keys(record).forEach(key => {
                        if (key !== 'name' && key !== 'totalMarks') {
                            extractSubjects.add(key);
                        }
                    });
                });
    
                const subjectsArray = Array.from(extractSubjects);
                console.log('📚 Extracted Subjects:', subjectsArray);
                setSubjects(subjectsArray);
            } else {
                console.warn('⚠️ No records found for the selected criteria.');
                setData([]);
                setSubjects([]);
                alert('No records found for the selected criteria.');
            }
        } catch (error) {
            console.error('🚨 Error fetching data:', error);
            alert('Error in fetching data. Please try again.');
        }
    };
    
    
    const renderTable = () => {
      if (subjects.length === 0 || data.length === 0) {
          return (
               <Text style={styles.noDataText}>select proper class and section</Text>
          );
      }

    
            // Sort the data by total marks in descending order and identify top 3
            const sortedData = [...data].sort((a, b) => b.totalMarks - a.totalMarks);
            const topThreeIds = sortedData.slice(0, 3).map((item) => item.name);
    
            return (
                <View style={styles.table}>
                    {/* Table Header */}
                    <View style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.headerCell, styles.fixedCell]}>Name</Text>
                        {subjects.map((subject, index) => (
                            <Text key={index} style={[styles.tableCell, styles.headerCell, styles.fixedCell]}>
                                {subject}
                            </Text>
                        ))}
                        <Text style={[styles.tableCell, styles.headerCell, styles.fixedCell]}>Total Marks</Text>
                    </View>
    
                    {/* Table Rows */}
                    {data.map((item, rowIndex) => {
                        // Determine the background color for top 3 students
                        let rowBackgroundColor = '#fff'; // Default
                        if (topThreeIds.includes(item.name)) {
                            const position = topThreeIds.indexOf(item.name);
                            if (position === 0) rowBackgroundColor = '#d1e7ff'; // Light Blue for 1st place
                            else if (position === 1) rowBackgroundColor = '#e2ebf9'; // Lighter Blue for 2nd place
                            else if (position === 2) rowBackgroundColor = '#f5f7fa'; // Light Gray for 3rd place
                        }
    
                        return (
                            <View
                                key={rowIndex}
                                style={[styles.tableRow, { backgroundColor: rowBackgroundColor }]}
                            >
                                <Text style={[styles.tableCell, styles.fixedCell]}>{item.name}</Text>
                                {subjects.map((subject, colIndex) => (
                                    <Text key={colIndex} style={[styles.tableCell, styles.fixedCell]}>
                                        {item[subject] !== undefined && item[subject] !== null
                                            ? item[subject]
                                            : '-'}
                                    </Text>
                                ))}
                                <Text style={[styles.tableCell, styles.fixedCell]}>{item.totalMarks}</Text>
                            </View>
                        );
                    })}
                </View>
            );
        };
        const handleLoadStudents = async () => {
            if (!isLoadDisabled) {  
                setIsLoadDisabled(true);
                setIsFetchDisabled(true); // Disable Fetch Data while loading students
        
                await fetchStudents(); // Ensure this function is async
        
                setIsLoadDisabled(false);
                setIsFetchDisabled(false); // Re-enable both buttons after completion
            }
        };
        
        const handleFetchData = async () => {
            if (!isFetchDisabled) {  
                setIsFetchDisabled(true);
                setIsLoadDisabled(true); // Disable Load Students while fetching data
        
                await fetchData(); // Ensure this function is async
        
                setIsFetchDisabled(false);
                setIsLoadDisabled(false); // Re-enable both buttons after completion
            }
        };
        
    
    
    

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={styles.mainHeader}>
                <TouchableOpacity onPress={() => navigation.navigate('TeacherProfile')}>
                    <Image source={require('./assets/images/slides/logo226.png')} style={styles.logo} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('TeacherProfile')}>
                    <FontAwesomeIcon icon={faHome} size={wp('9%')} color="#000" />
                </TouchableOpacity>
            </View>

            <View style={styles.subHeader}>
                <Text style={styles.subHeaderText}></Text>
            </View>

            <Text style={styles.title}>Academic Performance Entry </Text>
                        



        {/* Class Picker */}
        <View style={styles.pickerContainer}>
<TouchableOpacity onPress={showClassActionSheet} style={styles.button}>
        <Text style={[styles.picker1, { color: classSelected ? 'black' : placeholderTextColor }]}>
          {classSelected || 'Select Class'}
        </Text>
      </TouchableOpacity>

</View>

{/* Section Picker */}
<View style={styles.pickerContainer}>
<TouchableOpacity onPress={showSectionActionSheet} style={styles.button}>
        <Text style={[styles.picker1, { color: sectionSelected ? 'black' : placeholderTextColor }]}>
          {sectionSelected || 'Select Section'}
        </Text>
      </TouchableOpacity>

</View>

{/* Test Type Picker */}
<View style={styles.pickerContainer}>
<TouchableOpacity onPress={showTestTypeActionSheet} style={styles.button}>
        <Text style={[styles.picker1, { color: testTypeSelected ? 'black' : placeholderTextColor }]}>
          {testTypeSelected || 'Select Test Type'}
        </Text>
      </TouchableOpacity>

</View>


                <TextInput
              placeholderTextColor={placeholderTextColor}
              style={styles.input}
                    placeholder="Search by student name"
                    value={searchText}
                    onChangeText={setSearchText}
                />
               <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
    {/* Buttons */}
    <View style={styles.buttonContainer}>
        <Button
            title="Load Students"
            onPress={handleLoadStudents}
            disabled={!classSelected || !sectionSelected}
            color="white"
        />
    </View>

    <View style={styles.buttonContainer}>
        <Button
            title="Fetch Data"
            onPress={handleFetchData}
            disabled={!classSelected || !sectionSelected}
            color="white"
        />
    </View>

    {/* Academic Performance Table - horizontal scroll inside vertical */}
    <View style={{ marginTop: 20 }}>
        <ScrollView horizontal>
            {renderTable()}
        </ScrollView>
    </View>

    {/* Students List - will scroll vertically with entire screen */}
    <View style={{ marginTop: 20 }}>
        <FlatList
            data={students.filter((student) =>
                student.name.toLowerCase().includes(searchText.toLowerCase())
            )}
            renderItem={renderStudent}
            keyExtractor={(item, index) => item.id?.toString() || `${item.name}-${index}`}
            numColumns={4}
            contentContainerStyle={styles.studentList}
            scrollEnabled={false} // <== Important to allow outer ScrollView to control vertical scrolling
        />
    </View>
</ScrollView>










<Modal
      transparent
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>

          <Text style={styles.modalHeading}>Academic Report for {selectedStudent}</Text>

          <ScrollView contentContainerStyle={styles.scrollViewContainer}>
            {academicReport.map((item, index) => (
              <View key={index} style={styles.subjectContainer}>
                <Text style={styles.subjectLabel}>{item.subject}</Text>
                {!isSubmitted ? (
                  <TextInput
                    placeholder="Enter Marks"
                    value={item.marks}
                    onChangeText={(value) => handleMarksChange(index, value)}
                    keyboardType="numeric"
                    style={styles.marksInput}
                  />
                ) : (
                  <Text style={styles.marksInput}>{item.marks}</Text>
                )}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.submitButton} onPress={submitReport}>
            <Text style={styles.submitButtonText}>Submit Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
        </View>
        
    );
};



const styles = StyleSheet.create({
    mainHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgb(160, 180, 182)',
        paddingVertical: hp('1.5%'),  // Responsive padding
        paddingHorizontal: wp('4%'),  // Responsive padding
        height: hp('12%'),  // Responsive height
        marginBottom: wp('1%'),
    },

    iconBackground: {
        backgroundColor: 'lightgray', // Your desired background color
        borderRadius: 25, // Half of width/height for a circular background
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: wp('15%'),
    height: wp('15%'),
    },
    subHeader: {
        backgroundColor: 'rgb(160, 180, 182)',
paddingVertical: hp('1%'),
alignItems: 'center',
height: hp('3%'),
    },
    subHeaderText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        padding: 10,
        color:'black',

    },
    rowContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap', // Allows students to wrap into rows
        justifyContent: 'space-between', // Distributes items evenly
        paddingHorizontal: 10,
      },
      
      studentContainer: {
        width: '23%', // 4 items per row (23% x 4 ≈ 92% with gaps)
        marginVertical: 10,
        alignItems: 'center',
        padding: 5,
      },
      
    studentName: {
        fontSize: wp('4%'),
        marginTop: 5,
        color:'black',

    },
    container1: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 10,
    },
    
  
    fetchbuttonText: {
        color: "white",
        fontSize: 16,
        textAlign: 'center',
        fontSize: wp('4.0%'),
        fontWeight: 'bold',
    },
 

    input: {
        borderWidth: 1,
        borderRadius: 5,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 10,
    },
    studentList: {
        alignItems: 'center',
    },
    modalContainer: {
      marginTop:'100',
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#fff',
        margin: 20,
        padding: 20,
        borderRadius: 10,
    },
    closeButton: {
        alignSelf: 'flex-end',
        padding: 5,
    },
    closeButtonText: {
        color: 'red',
        fontWeight: 'bold',
    },
    modalHeading: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color:"black"
    },
    subjectContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: 10,
        height: 25,
    },
    subjectLabel: {
        fontSize: wp('4%'),
        fontWeight: 'bold',
        width: '50%',
        color:"black"
    },
    label: {
        fontWeight: 'bold',
    },
    marksInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 6, // Adjusted padding for better fit
        paddingVertical: 4, // Smaller vertical padding
        width: '35%', // Reduced width to fit smaller container
        fontSize: 14, // Adjust font size to match the reduced size
        height: 35, // Explicit height to prevent overflow
        backgroundColor: '#fff', // Ensure the background is visible against the shadow
        shadowColor: '#000', // Shadow color
        shadowOffset: { width: 0, height: 2 }, // Shadow position
        shadowOpacity: 0.2, // Shadow transparency
        shadowRadius: 4, // Shadow blur
        elevation: 3,
        color:"black" // Elevation for Android shadow
    },
    picker1:{
        justifyContent:'center',textAlign:'center',borderRadius:40,
          backgroundColor: '#fff',
            color: '#333',
            fontSize: 16,
            textAlign:'left',  
          },

    submitButton: {
        borderRadius: 5,
        backgroundColor: 'rgb(160, 180, 182)',

        borderRadius: 5,
        backgroundColor: 'rgb(160, 180, 182)', // Consistent color
        borderRadius: 15,  // Apply border radius to the container
        marginVertical: 10,
        overflow: 'hidden',  // Ensures that the content inside doesn't spill out of rounded edges
        width: 150,
        marginLeft: 70,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        height: 40,
    },
    submitButtonText: {
        color: '#fff',
        textAlign: 'center',
        fontWeight: 'bold',
        marginTop: 10,
    },
    studentPhoto: {
        width: wp('18%'),  // Adjust the size as per your need (Instagram share icon size)
        height: wp('18%'), // Keep the width and height equal to make it circular
        borderRadius: 70,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 50 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 3, // To make the image circular
      }
,    
    pickerContainer:
    {
        borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginVertical: 10,
    backgroundColor: '#fff',
    color: '#333',
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4, // For Android shadow
    width: 300,
    marginLeft: 30,
    height: 49,
    color:'black',// For Android shadow
    },
    buttonContainer: {
      borderRadius: 5,
      backgroundColor: 'rgb(160, 180, 182)',
      borderRadius: 5,
      backgroundColor: 'rgb(160, 180, 182)',
      borderRadius: 15,  // Apply border radius to the container
      marginVertical: 10,
      overflow: 'hidden',  // Ensures that the content inside doesn't spill out of rounded edges
      width: 150,
      marginLeft: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
  },
    label: {
        fontSize: 16,
        marginBottom: 5,
        color: '#333',
        fontWeight: "bold",
    },
  

    table: {
        borderWidth: 1,
        borderColor: '#ccc',
        marginTop: 20,
        width: '100%', // Ensures the table doesn't exceed the screen width
    },
    tableRow: {
        flexDirection: 'row',
    },
    subHeader: {
        backgroundColor: 'rgb(160, 180, 182)',
    paddingVertical: hp('1%'),
    alignItems: 'center',
    height: hp('3%'),
    },
    subHeaderText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    tableCell: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        textAlign: 'center',
        fontSize: 14,
        width: 100,
        color:'black', // Ensures consistent column size
    },
    headerCell: {
        backgroundColor: '#ddd',
        fontWeight: 'bold',
        padding: 15,
    },
    noDataText: {
        textAlign: 'center',
        marginVertical: 20,
        marginHorizontal:20,
        fontSize: 16,
        color: 'black',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        // textDecorationLine: 'underline', // Underline the text
        textShadowColor: 'rgba(0, 0, 0, 0.25)', // Subtle shadow
        textShadowOffset: { width: 1, height: 2 }, // Offset for the shadow
        textShadowRadius: 3, // Blur radius for the shadow
        fontStyle: 'italic',
        color:"black" // Shadow blur radius
         // Apply italic

    },
    pickerContainer: {
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 15,
        marginVertical: 10,
        backgroundColor: '#fff',
        color: 'black',
        fontSize: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4, // For Android shadow
        width: 300,
        marginLeft: 30,
        height: 49,// For Android shadow
    },
    picker1:{
        justifyContent:'center',textAlign:'center',borderRadius:40,
            
         
            backgroundColor: '#fff',
            color: '#333',
            fontSize: 16,
            textAlign:'left',
            
            
            
          
          },
    picker: {
        height: 50,
        width: '100%',
        color: '#333', // Text color inside picker
        
        fontSize: 16,
    },
    fetchbutton: {
      
      
       
      

        borderRadius: 5,
     
       
        borderRadius: 15,  // Apply border radius to the container
        marginVertical: 10,
     // Ensures that the content inside doesn't spill out of rounded edges
        width: 150,
      
      
    },
   

});

export default TeacherAcademicPerformanceEntry;




