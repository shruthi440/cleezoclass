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

/* ---------------- INTERNAL COMPONENTS ---------------- */

const HomeworkTabContent: React.FC<{ studentData: any }> = ({ studentData }) => {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useContext(ErrorContext);

  const openHomeworkFile = async (item: any) => {
    try {
      if (!item?.homework_file) {
        Alert.alert('No file', 'No document found for this homework.');
        return;
      }

      const ext = item.file_type?.includes('pdf')
        ? 'pdf'
        : item.file_type?.includes('png')
        ? 'png'
        : item.file_type?.includes('jpeg') || item.file_type?.includes('jpg')
        ? 'jpg'
        : 'bin';

      const localPath = `${RNFS.CachesDirectoryPath}/parent_hw_${item.id || Date.now()}.${ext}`;
      await RNFS.writeFile(localPath, item.homework_file, 'base64');
      const fileUrl = `file://${localPath}`;
      const canOpen = await Linking.canOpenURL(fileUrl);

      if (canOpen) {
        await Linking.openURL(fileUrl);
      } else {
        await Share.share({ url: fileUrl, message: 'Homework document' });
      }
    } catch (e) {
      try {
        const fallbackPath = `${RNFS.CachesDirectoryPath}/parent_hw_${item?.id || Date.now()}.bin`;
        await RNFS.writeFile(fallbackPath, item?.homework_file || '', 'base64');
        await Share.share({ url: `file://${fallbackPath}`, message: 'Homework document' });
      } catch {
        Alert.alert('Error', 'Unable to open this file.');
      }
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
      }
  catch {
  showError(
    'Homework Error',
    'Unable to load homework. Please try again.'
  );
}

       finally {
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
        <View key={index} style={{ padding: 15, backgroundColor: '#f6f6f7', marginBottom: 10,  }}>
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
const TimetableTabContent: React.FC<{ studentData: any }> = ({ studentData }) => {
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useContext(ErrorContext);
  const { width } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);

  /* ================= FETCH ================= */
  useEffect(() => {
    const fetchTT = async () => {
      try {
        if (!studentData?.class_name || !studentData?.section || !studentData?.schoolCode) return;

        const url = `http://162.215.210.38:3010/api/parent-timetable?class_id=${encodeURIComponent(studentData.class_name)}&section_id=${encodeURIComponent(studentData.section)}&schoolCode=${encodeURIComponent(studentData.schoolCode)}`;

        console.log('🌐 Fetching timetable:', url);

        const res = await axios.get(url);
        const data = res.data.timetable || [];

        console.log(
          '📅 Days from API:',
          data.map((d: any) => d.day)
        );

        /* ========== 🔥 KEEP LAST ENTRY PER DAY ========== */
        const dayMap: any = {};

        data.forEach((item: any) => {
          // 👇 overwrites previous same-day data
          dayMap[item.day] = {
            day: item.day,
            periods: item.periods || {
              morning: [],
              afternoon: [],
              evening: [],
              night: [],
            },
          };
        });

        const uniqueDays = Object.values(dayMap);

        /* ========== SORT DAYS ========== */
        const daysOrder = [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];

        const sortedData = uniqueDays.sort(
          (a: any, b: any) =>
            daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day)
        );

        setTimetable(sortedData);
      } 
    catch {
  showError(
    'Timetable Error',
    'Unable to load timetable. Please try again.'
  );
}

      
      finally {
        setLoading(false);
      }
    };

    fetchTT();
  }, [studentData]);

  if (loading) {
    return (
      <ActivityIndicator size="small" color="#000" style={{ marginTop: 20 }} />
    );
  }

  /* ================= HELPERS ================= */

  const getSortedPeriods = (row: any) => {
    const allPeriods = [
      ...(row.periods?.morning || []),
      ...(row.periods?.afternoon || []),
      ...(row.periods?.evening || []),
      ...(row.periods?.night || []),
    ];

    // safety dedupe (optional)
    const uniqueMap = new Map();
    allPeriods.forEach((p: any) => {
      const key = `${p.fromTime}-${p.toTime}-${p.subject}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, p);
    });

    return Array.from(uniqueMap.values()).sort((a, b) =>
      a.fromTime.localeCompare(b.fromTime)
    );
  };

  const maxPeriods = Math.max(
    ...timetable.map(row => getSortedPeriods(row).length),
    0
  );
  const rowLabelWidth = 88;
  const dayCellMinWidth =
    timetable.length > 0
      ? Math.max(
          96,
          Math.floor((phoneWidth - rowLabelWidth - 56) / Math.min(timetable.length, 5)),
        )
      : 110;

  /* ================= RENDER ================= */

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={timetableStyles.tableOuter}>
          <View style={timetableStyles.headerRow}>
            <View style={[timetableStyles.cornerCell, { width: rowLabelWidth }]}>
              <Text style={timetableStyles.headerText}>Period</Text>
            </View>
            {timetable.map((row, index) => (
              <View
                key={`${row.day}-${index}`}
                style={[timetableStyles.dayHeaderCell, { minWidth: dayCellMinWidth }]}
              >
                <Text style={timetableStyles.headerText}>{row.day}</Text>
              </View>
            ))}
          </View>

          {Array.from({ length: maxPeriods }).map((_, periodIndex) => (
            <View key={periodIndex} style={timetableStyles.dataRow}>
              <View style={[timetableStyles.periodCell, { width: rowLabelWidth }]}>
                <Text style={timetableStyles.periodText}>{`Period ${periodIndex + 1}`}</Text>
              </View>

              {timetable.map((dayRow, dayIndex) => {
                const periods = getSortedPeriods(dayRow);
                const p = periods[periodIndex];

                return (
                  <View
                    key={`${dayRow.day}-${dayIndex}-${periodIndex}`}
                    style={[timetableStyles.subjectCell, { minWidth: dayCellMinWidth }]}
                  >
                    <Text numberOfLines={2} style={timetableStyles.subjectText}>
                      {p ? p.subject : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
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

  // 1. Load basic student data
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
          showError(
            'Student Data Missing',
            'Please select student again in Parent Details.'
          );
          return;
        }

        setStudentData(data);
      }
  catch {
  showError(
    'Storage Error',
    'Unable to load saved data. Please restart the app.'
  );
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
