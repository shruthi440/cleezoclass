import React, { useEffect,useContext, useState,useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,BackHandler
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ErrorContext } from '../ErrorContext';
import ParentFooter from './ParentFooter';

/* ================= TYPES ================= */

interface Student {
  id: number;
  name: string;
  username?: string;
  father_name?: string;
  phone_no?: string;
  class_name?: string;
  section?: string;
  photoUrl?: string;
  schoolCode?: string;
  aadhar_no?: string;
  address?: string;
  class_teacher?: string;
  gender?: string;
  school_name?: string;
  photo?: string;
}

const API_BASE = 'http://162.215.210.38:3010';
const STUDENT_UPLOAD_BASE = 'https://cleezoclass.com:4000/CRM/public/uploads';

const decodeBase64Text = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const atobFn = (globalThis as any).atob;
    if (typeof atobFn === 'function') return atobFn(raw);
  } catch {}
  try {
    const bufferCtor = (globalThis as any).Buffer;
    if (bufferCtor?.from) return bufferCtor.from(raw, 'base64').toString('utf8');
  } catch {}
  return '';
};

const resolvePhotoUri = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const buildUploadUrl = (path: string) => {
    const cleanPath = String(path || '').trim().replace(/^\/+/, '');
    if (!cleanPath) return STUDENT_UPLOAD_BASE;

    const relativePath = cleanPath
      .replace(/^CRM\/public\/uploads\/?/i, '')
      .replace(/^uploads\/?/i, '')
      .replace(/^\/+/, '');

    return `${STUDENT_UPLOAD_BASE}/${relativePath}`;
  };

  if (raw.startsWith('data:image')) {
    const base64Part = raw.split(',')[1] || '';
    const decoded = decodeBase64Text(base64Part);
    const decodedPath = String(decoded || '').trim();
    if (decodedPath.includes('CRM/public/uploads') || decodedPath.startsWith('/uploads/') || decodedPath.startsWith('uploads/')) {
      return buildUploadUrl(decodedPath);
    }
    if (decodedPath.startsWith('http://') || decodedPath.startsWith('https://')) return decodedPath;
    return raw;
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.includes('CRM/public/uploads') || raw.startsWith('/uploads/') || raw.startsWith('uploads/')) {
    return buildUploadUrl(raw);
  }
  if (raw.startsWith('L3VwbG9hZHMv') || raw.startsWith('dXBsb2Fkcy8')) {
    const decodedPath = String(decodeBase64Text(raw) || '').trim();
    if (decodedPath.includes('CRM/public/uploads') || decodedPath.startsWith('/uploads/') || decodedPath.startsWith('uploads/')) {
      return buildUploadUrl(decodedPath);
    }
    if (decodedPath.startsWith('http://') || decodedPath.startsWith('https://')) return decodedPath;
  }
  return raw;
};

interface ApiResponse<T> {
  success: boolean;
  student?: T;
  siblings?: T[];
  message?: string;
}

/* ================= COMPONENT ================= */

const ParentStudentIconManagement = () => {
  const navigation = useNavigation<any>();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useContext(ErrorContext);
  
useFocusEffect(
  useCallback(() => {
    const onBackPress = () => {
      navigation.navigate('TeacherLogin' as any);
      return true; // Keeps the app from closing
    };

    // 1. Create the subscription
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    // 2. Use .remove() on the subscription itself
    return () => subscription.remove(); 
  }, [navigation])
);
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const username = await AsyncStorage.getItem('username');
      const schoolCode = await AsyncStorage.getItem('schoolCode');

      if (!username || !schoolCode) {
        showError('Error', 'Missing login details');
        return;
      }

      // 1. Get base student profile to find family links
      const profileRes = await axios.get<ApiResponse<Student>>(
        'http://162.215.210.38:3010/api/student/profile',
        { params: { username, schoolCode } }
      );

      if (!profileRes.data.success || !profileRes.data.student) {
        showError('Error', 'Student profile not found');
        return;
      }

      const base = {
        ...profileRes.data.student,
        photoUrl: resolvePhotoUri(profileRes.data.student.photoUrl || (profileRes.data.student as any).photo),
      };

      console.log('[ParentDetails] profile photo', {
        photoUrl: (profileRes.data.student as any).photoUrl || null,
        photo: (profileRes.data.student as any).photo || null,
        resolvedPhotoUrl: base.photoUrl || null,
      });

      // 2. Fetch all students associated with this parent
      const siblingsRes = await axios.post<ApiResponse<Student>>(
        'http://162.215.210.38:3010/api/student/siblings',
        {
          username,
          schoolCode,
          father_name: base.father_name,
          phone_no: base.phone_no,
        }
      );

      if (siblingsRes.data.success && siblingsRes.data.siblings) {
        setStudents(
          siblingsRes.data.siblings.map((item) => ({
            ...item,
            photoUrl: resolvePhotoUri(item.photoUrl || item.photo || base.photoUrl || ''),
            photo: item.photo || base.photoUrl || '',
          }))
        );
      } else {
        showError('Notice', 'No students found for this account.');
      }
    } catch (err) {
      console.error('❌ Load error:', err);
      showError('Error', 'Unable to load student list');
    } finally {
      setLoading(false);
    }
  };

  /* ================= SELECT & STORE DATA ================= */
const selectStudent = async (student: any) => {
  try {
    console.log('✅ Saving data for:', student.name);
    console.log('🆔 Student ID:', student.id);
    const existingSchoolCode = await AsyncStorage.getItem('schoolCode');
    const safeSchoolCode = String(student.schoolCode || existingSchoolCode || '');
    const existingUsername = await AsyncStorage.getItem('username');
    const safeUsername = String(student.username || existingUsername || '');

    const studentEntries: [string, string][] = [
      ['studentId', String(student.id || '')],
      ['username', safeUsername],
      ['schoolCode', safeSchoolCode],
      ['name', student.name || ''],
      ['class_name', student.class_name || ''],
      ['section', student.section || ''],
      ['photoUrl', resolvePhotoUri(student.photoUrl || student.photo)],
      ['photo', String(student.photo || student.photoUrl || '')],
      ['aadhar_no', student.aadhar_no || ''],
      ['address', student.address || ''],
      ['class_teacher', student.class_teacher || ''],
      ['father_name', student.father_name || ''],
      ['gender', student.gender || ''],
      ['phone_no', student.phone_no || ''],
      ['school_name', student.school_name || ''],
      ['userType', 'student'],
    ];

    await AsyncStorage.multiSet(studentEntries);
    await AsyncStorage.setItem('currentStudent', JSON.stringify(student));

    // ✅ PASS studentId HERE
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'ParentDashboard',
          params: {
            name: student.name,
            selectedStudentId: student.id,   // 🔥 ADD THIS
            className: student.class_name,
            section: student.section,
          },
        },
      ],
    });

  } catch (err) {
    console.error('❌ Storage Error:', err);
    showError('Error', 'Failed to save selection');
  }
};


  /* ================= UI RENDER ================= */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{marginTop: 10}}>Loading students...</Text>
      </View>
    );
  }

  return (
    <>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Select a Student</Text>

      {students.map((student) => {
        const photoUri = resolvePhotoUri(student.photoUrl || student.photo);
        const hasValidPhoto = Boolean(photoUri);
        console.log('[ParentDetails] student photo', {
          id: student.id,
          name: student.name,
          photoUrl: student.photoUrl || null,
          photo: student.photo || null,
          photoUri: photoUri || null,
        });

        return (
          <TouchableOpacity
            key={student.id}
            style={styles.card}
            onPress={() => selectStudent(student)}
          >
            <View style={styles.cardRow}>
              <View style={styles.photoWrapper}>
                {hasValidPhoto ? (
                  <Image
                    source={{ uri: encodeURI(photoUri) }}
                    style={styles.avatar}
                    onError={(event) => {
                      console.log('[ParentDetails] image load failed', {
                        id: student.id,
                        name: student.name,
                        uri: photoUri,
                        error: event?.nativeEvent?.error || null,
                      });
                    }}
                  />
                ) : (
                  <Ionicons name="person-circle-outline" size={84} color="#D1D1D1" />
                )}
              </View>

              <View style={styles.detailsWrapper}>
                <Text style={styles.nameText}>{student.name || 'Unknown Student'}</Text>
                <Text style={styles.idLabel}>Student ID: {student.id || 'N/A'}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    Class {student.class_name || '-'} — Section {student.section || '-'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
    <ParentFooter />
    </>
  );
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    backgroundColor: '#F8F9FA',
    minHeight: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 25,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#FF6B6B',
  },
  photoWrapper: {
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailsWrapper: {
    flex: 1,
    minWidth: 0,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 6,
  },
  idLabel: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ParentStudentIconManagement;
