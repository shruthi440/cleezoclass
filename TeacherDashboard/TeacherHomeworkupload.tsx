import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Alert,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNextClass } from '../NextClassContext';

import {
  pick,
  types,
  DocumentPickerResponse,
} from '@react-native-documents/picker';


import { launchImageLibrary, launchCamera, Asset } from 'react-native-image-picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../ThemeContext';
import TeacherFooter from './TeacherFooter';

/* ---------------- TYPES ---------------- */

interface HomeworkItem {
  id: number;
  class_name: string;
  section: string;
  subject: string;
  description: string;
  date: string;
}

interface MediaFile {
  uri: string;
  name: string;
  type: string;
}

/* ---------------- COMPONENT ---------------- */

const TeacherHomeworkUpload: React.FC = () => {
  const { themeStyles } = useContext(ThemeContext);

  const [schoolCode, setSchoolCode] = useState('');
  const [classInput] = useState('1');
  const [sectionInput] = useState('A');
  const [subjectInput] = useState('Maths');
  const [descriptionInput] = useState('');

  const [homeworkMedia, setHomeworkMedia] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);

  /* ---------------- LOAD SCHOOL CODE ---------------- */

  useEffect(() => {
    const loadSchoolCode = async () => {
      const code = await AsyncStorage.getItem('schoolCode');
      if (code) setSchoolCode(code);
    };
    loadSchoolCode();
  }, []);

  /* ---------------- DATE PICKER ---------------- */

  const handleConfirm = (selectedDate: Date) => {
    setShowDatePicker(false);
    setDate(selectedDate);
  };

  /* ---------------- DOCUMENT PICKER ---------------- */

const pickDocument = async () => {
  try {
    const res: DocumentPickerResponse[] = await pick({
      type: [types.allFiles],
    });

    const file = res[0];

    setHomeworkMedia(prev => [
      ...prev,
      {
        uri: file.uri,
        name: file.name ?? 'file',
        type: file.type ?? 'application/octet-stream',
      },
    ]);
  } catch (err: any) {
    // USER CANCELLED PICKER → ignore silently
    if (err?.code === 'DOCUMENT_PICKER_CANCELED') {
      return;
    }

    Alert.alert('Error', 'Document selection failed');
  }
};


  /* ---------------- IMAGE PICKER ---------------- */

const pickImage = async () => {
  try {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
      selectionLimit: 1, // change to 0 for multiple images
    });

    // User cancelled
    if (result.didCancel) {
      return;
    }

    // Error from image picker
    if (result.errorCode) {
      Alert.alert('Error', result.errorMessage || 'Image picker error');
      return;
    }

    if (!result.assets || result.assets.length === 0) return;

    const asset: Asset = result.assets[0];

    if (!asset.uri) return;

    setHomeworkMedia(prev => [
      ...prev,
      {
        uri: asset.uri,
        name: asset.fileName ?? `image_${Date.now()}.jpg`,
        type: asset.type ?? 'image/jpeg',
      },
    ]);
  } catch (error) {
    Alert.alert('Error', 'Failed to pick image');
  }
};


  /* ---------------- CAMERA ---------------- */

  const takePhoto = async () => {
    const permission =
      Platform.OS === 'ios'
        ? await request(PERMISSIONS.IOS.CAMERA)
        : await request(PERMISSIONS.ANDROID.CAMERA);

    if (permission !== RESULTS.GRANTED) {
      Alert.alert('Camera permission denied');
      return;
    }

    const result = await launchCamera({ mediaType: 'photo', quality: 1 });

    if (result.assets?.length) {
      const asset = result.assets[0];
      if (!asset.uri) return;

      setHomeworkMedia(prev => [
        ...prev,
        {
          uri: asset.uri,
          name: asset.fileName ?? 'camera.jpg',
          type: asset.type ?? 'image/jpeg',
        },
      ]);
    }
  };

  /* ---------------- UPLOAD ---------------- */

  const uploadHomework = async () => {
    if (!descriptionInput || homeworkMedia.length === 0) {
      Alert.alert('Please fill all fields');
      return;
    }

    const formData = new FormData();

    homeworkMedia.forEach(file => {
      formData.append('homework_file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    });

    formData.append('class_name', classInput);
    formData.append('section', sectionInput);
    formData.append('subject', subjectInput);
    formData.append('description', descriptionInput);
    formData.append('schoolCode', schoolCode);

    setIsUploading(true);

    try {
      const res = await fetch('http://162.215.210.38:3010/api/upload-homework', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      Alert.alert('Success', json.message || 'Homework uploaded');
    } catch {
      Alert.alert('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  /* ---------------- FETCH LIST ---------------- */

  const fetchHomeworkList = async () => {
    setIsLoading(true);
    try {
      const formattedDate = date.toISOString().split('T')[0];
      const res = await fetch(
        `http://162.215.210.38:3010/api/homework-list?date=${formattedDate}&schoolCode=${schoolCode}`
      );

      const data: HomeworkItem[] = await res.json();
      setHomeworkList(data);
    } catch {
      Alert.alert('Failed to fetch homework');
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Teacher Homework Upload</Text>

      <TouchableOpacity style={styles.btn} onPress={pickDocument}>
        <Text>Pick Document</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={pickImage}>
        <Text>Pick Image</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={takePhoto}>
        <Text>Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={uploadHomework}>
        <Text>{isUploading ? 'Uploading...' : 'Upload Homework'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={fetchHomeworkList}>
        <Text>Fetch Homework</Text>
      </TouchableOpacity>

      {isLoading && <ActivityIndicator size="large" />}

      <FlatList
        data={homeworkList}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>{item.subject}</Text>
            <Text>{item.description}</Text>
          </View>
        )}
      />

      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={() => setShowDatePicker(false)}
      />
      <TeacherFooter />
    </View>
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F4F6F8' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: '#111827', marginBottom: 12 },
  btn: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  card: {
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});

export default TeacherHomeworkUpload;
