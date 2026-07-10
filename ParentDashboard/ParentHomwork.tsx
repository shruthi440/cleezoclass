import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  StyleSheet,
  Image,
  Share,
  Alert,
  Linking,
  useWindowDimensions,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../ThemeContext';
import { globalStyles as styles } from '../inner';
import { createAppStyles } from '../App.styles';
import ParentFooter from './ParentFooter';

import axios from 'axios';
import { ErrorContext } from '../ErrorContext';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';

/* ---------------- INTERNAL COMPONENTS ---------------- */

const HomeworkTabContent: React.FC<{ studentData: any }> = ({ studentData }) => {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useContext(ErrorContext);

const openHomeworkFile = async (item: any) => {
    console.log('DEBUG: Attempting to open file for item ID:', item.id);
    
    try {
      if (!item?.homework_file) {
        console.error('DEBUG: No homework_file found in item object.');
        Alert.alert('No file', 'No document found.');
        return;
      }

      // Determine extension
      const ext = item.file_type?.toLowerCase().includes('pdf') ? 'pdf' : 'jpg';
      
      // Clean the base64 string
      const base64Data = item.homework_file.includes('base64,') 
        ? item.homework_file.split(',')[1] 
        : item.homework_file;

      const localPath = `${RNFS.CachesDirectoryPath}/parent_hw_${item.id || Date.now()}.${ext}`;
      console.log('DEBUG: Attempting to write file to:', localPath);

      // Write file
      await RNFS.writeFile(localPath, base64Data, 'base64');
      
      // Verify file existence
      const exists = await RNFS.exists(localPath);
      console.log('DEBUG: Does file exist at path?', exists);

      if (exists) {
        // Attempt to open
        console.log('DEBUG: Calling FileViewer.open...');
        await FileViewer.open(localPath, { 
          showOpenWithDialog: true,
          showAppsSuggestions: true 
        });
        console.log('DEBUG: FileViewer.open success');
      } else {
        console.error('DEBUG: File verification failed. File does not exist.');
        Alert.alert('Error', 'File could not be saved.');
      }
    } catch (e: any) {
      console.error('DEBUG: Final catch block error:', e);
      Alert.alert('Error', 'Unable to open this file: ' + (e.message || 'Unknown error'));
    }
  };
  useEffect(() => {
    const fetchHomework = async () => {
      try {
        if (!studentData?.class_name || !studentData?.section || !studentData?.schoolCode) {
          return;
        }
        const res = await axios.get(
          `http://162.215.210.38:3010/api/homework-lists?class_name=${encodeURIComponent(studentData.class_name)}&section=${encodeURIComponent(studentData.section)}&schoolCode=${encodeURIComponent(studentData.schoolCode)}&username=${encodeURIComponent(studentData.username || '')}`
        );
        setHomework(res.data || []);
      } catch (error) {
        console.error('Homework fetch error:', error);
        showError('Homework Error', 'Unable to load homework. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchHomework();
  }, [studentData]);

  if (loading) return <ActivityIndicator size="small" color="#000" style={{ marginTop: 20 }} />;
  if (homework.length === 0) return <Text style={{ textAlign: 'center', marginTop: 20 }}>No homework assigned.</Text>;

  return (
    <View style={{ padding: 10 }}>
      {homework.map((item: any, index: number) => (
        <View key={index} style={{ padding: 15, backgroundColor: '#f6f6f7', marginBottom: 10, borderRadius: 8 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.subject}</Text>
          {item.description ? <Text style={{ color: '#555', marginVertical: 4 }}>{item.description}</Text> : null}
          <Text style={{ fontSize: 12, color: '#999' }}>By: {item.uploader_name} | {new Date(item.date).toLocaleDateString()}</Text>

          {item.file_type?.startsWith('image/') && item.homework_file ? (
            <Image
              source={{ uri: `data:${item.file_type};base64,${item.homework_file}` }}
              style={{ height: 140, marginTop: 10, borderRadius: 8 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ marginTop: 8, color: '#444' }}>
              File: {item.file_type?.includes('pdf') ? 'PDF Document' : 'Document'}
            </Text>
          )}

          <TouchableOpacity
            style={{
              marginTop: 10,
              backgroundColor: '#0a3d62',
              paddingVertical: 8,
              borderRadius: 6,
              alignItems: 'center',
            }}
            onPress={() => openHomeworkFile(item)}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Open File</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

/* ---------------- MAIN SCREEN ---------------- */

const ParentHomework: React.FC<
  NativeStackScreenProps<RootStackParamList, 'ParentHomework'> & { embedded?: boolean }
> = ({ embedded = false }) => {
  const [studentData, setStudentData] = useState<any>(null);
  const { showError } = useContext(ErrorContext);
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const appStyles = createAppStyles({ phoneWidth, phoneHeight });

  useEffect(() => {
    const loadStudent = async () => {
      try {
        const keys = ['studentId', 'name', 'class_name', 'section', 'schoolCode', 'username'];
        const stores = await AsyncStorage.multiGet(keys);
        const data: any = {};
        stores.forEach(([k, v]) => { if (v) data[k] = v; });

        const required = ['studentId', 'name', 'class_name', 'section', 'schoolCode'];
        const missing = required.filter(k => !data[k]);
        if (missing.length > 0) {
          showError('Student Data Missing', 'Please select student again in Parent Details.');
          return;
        }
        setStudentData(data);
      } catch (error) {
        console.error('Storage error:', error);
        showError('Storage Error', 'Unable to load saved data. Please restart the app.');
      }
    };
    loadStudent();
  }, []);

  return (
    <SafeAreaView style={embedded ? [styles.safeArea, { padding: 0 }] : styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView}>
        <View style={embedded ? [styles.container, { padding: 0, marginTop: 0 }] : styles.container}>
          <View style={styles.syllabusContainertwo}>
            <View
              style={[
                styles.gridContainer,
                embedded
                  ? { marginTop: 0, marginLeft: 0, marginRight: 0, paddingHorizontal: 0 }
                  : { marginTop: '10%', marginLeft: 10 },
              ]}
            >
              {studentData ? <HomeworkTabContent studentData={studentData} /> : <ActivityIndicator size="large" color="#000" />}
            </View>
          </View>
        </View>
      </ScrollView>
      <ParentFooter embedded={embedded} />
    </SafeAreaView>
  );
};

export default ParentHomework;

const timetableStyles = StyleSheet.create({
  tableOuter: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f3f3',
  },
  cornerCell: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingHorizontal: 8,
  },
  dayHeaderCell: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingHorizontal: 8,
  },
  dataRow: {
    flexDirection: 'row',
  },
  periodCell: {
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingHorizontal: 8,
    backgroundColor: '#fafafa',
  },
  subjectCell: {
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingHorizontal: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  periodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  subjectText: {
    fontSize: 11,
    color: '#111',
    textAlign: 'center',
    lineHeight: 15,
  },
});