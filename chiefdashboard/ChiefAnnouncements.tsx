import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  PermissionsAndroid,
  NativeModules,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import axios from 'axios';
import RNFS from 'react-native-fs';

const API_BASE_URL = 'http://162.215.210.38:3010/api';

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const normalizeFilePath = (uri: string): string => uri.replace(/^file:\/\//, '');

const toFileUri = (path: string): string =>
  path.startsWith('file://') ? path : `file://${path}`;

type RecordedAudio = {
  uri: string;
  name: string;
  type: string;
};

const { AudioRecorder } = NativeModules as {
  AudioRecorder?: {
    startRecording: () => Promise<string>;
    stopRecording: () => Promise<string>;
  };
};

const AnnouncementScreen: React.FC = () => {
  // Form State
  const [schoolCode, setSchoolCode] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('General');
  const [announcementDate, setAnnouncementDate] = useState<Date>(new Date());
  const [description, setDescription] = useState<string>('');
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(
    null,
  );
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingSchoolCode, setIsLoadingSchoolCode] = useState<boolean>(true);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  useEffect(() => {
    const loadSchoolCode = async (): Promise<void> => {
      try {
        const [
          storedSchoolCode,
          storedUserDetails,
          storedCurrentUser,
          storedCurrentChief,
        ] = await Promise.all([
          AsyncStorage.getItem('schoolCode'),
          AsyncStorage.getItem('userDetails'),
          AsyncStorage.getItem('currentUser'),
          AsyncStorage.getItem('currentChief'),
        ]);

        const parseStoredValue = (value: string | null): any => {
          if (!value) return {};

          try {
            return JSON.parse(value);
          } catch {
            return {};
          }
        };

        const userDetails = parseStoredValue(storedUserDetails);
        const currentUser = parseStoredValue(storedCurrentUser);
        const currentChief = parseStoredValue(storedCurrentChief);
        const resolvedSchoolCode = String(
          userDetails.schoolCode ||
            currentUser.schoolCode ||
            currentChief.schoolCode ||
            storedSchoolCode ||
            '',
        ).trim();

        setSchoolCode(resolvedSchoolCode);
      } catch (error) {
        console.error('Load School Code Error:', error);
      } finally {
        setIsLoadingSchoolCode(false);
      }
    };

    loadSchoolCode();
  }, []);

  const requestAudioPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not Supported',
        'Audio recording is only available on Android in this build.',
      );
      return false;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'Please allow microphone access to record an announcement.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const getRecordedAudioName = (path: string): string => {
    return path.split('/').pop() || `announcement-audio-${Date.now()}.m4a`;
  };

  const startRecording = async (): Promise<void> => {
    try {
      if (!AudioRecorder) {
        Alert.alert(
          'Recorder Error',
          'Audio recorder is not available. Please rebuild the app.',
        );
        return;
      }

      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record audio.',
        );
        return;
      }

      await AudioRecorder.startRecording();
      setRecordedAudio(null);
      setIsRecording(true);
    } catch (error) {
      console.error('Start Recording Error:', error);
      Alert.alert(
        'Error',
        'Failed to start audio recording. Please try again.',
      );
    }
  };

  const stopRecording = async (): Promise<void> => {
    try {
      if (!AudioRecorder) {
        Alert.alert(
          'Recorder Error',
          'Audio recorder is not available. Please rebuild the app.',
        );
        return;
      }

      const path = await AudioRecorder.stopRecording();
      const normalizedPath = normalizeFilePath(path);
      const audioExists = await RNFS.exists(normalizedPath);
      const audioStat = audioExists ? await RNFS.stat(normalizedPath) : null;

      console.log('[ChiefAnnouncements] recording stopped', {
        path,
        normalizedPath,
        exists: audioExists,
        size: audioStat?.size,
      });

      if (!audioExists || Number(audioStat?.size || 0) <= 0) {
        Alert.alert(
          'Recording Error',
          'The recorded audio file could not be read. Please record again.',
        );
        return;
      }

      setRecordedAudio({
        uri: toFileUri(normalizedPath),
        name: getRecordedAudioName(path),
        type: 'audio/mp4',
      });
    } catch (error) {
      console.error('Stop Recording Error:', error);
      Alert.alert('Error', 'Failed to save audio recording. Please try again.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleRecordingPress = (): void => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleDateConfirm = (selectedDate: Date): void => {
    setShowDatePicker(false);
    setAnnouncementDate(selectedDate);
  };

  const handleSubmit = async (): Promise<void> => {
    if (isLoadingSchoolCode) {
      Alert.alert('Please Wait', 'School details are still loading.');
      return;
    }

    if (!schoolCode) {
      Alert.alert(
        'Missing School Details',
        'Please go back and open this page again from the dashboard.',
      );
      return;
    }

    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required.');
      return;
    }

    if (isRecording) {
      Alert.alert(
        'Recording in Progress',
        'Please stop the audio recording before submitting.',
      );
      return;
    }

    if (!description.trim() && !recordedAudio) {
      Alert.alert(
        'Validation Error',
        'Please enter a description or record an audio message.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const audioPath = recordedAudio
        ? normalizeFilePath(recordedAudio.uri)
        : null;
      const audioStat = audioPath ? await RNFS.stat(audioPath) : null;
      const audioBase64 = audioPath ? await RNFS.readFile(audioPath, 'base64') : null;

      console.log('[ChiefAnnouncements] submitting announcement', {
        url: `${API_BASE_URL}/announcements`,
        schoolCode,
        title: title.trim(),
        category,
        announcementDate: formatDate(announcementDate),
        descriptionLength: description.trim().length,
        hasAudio: Boolean(recordedAudio),
        audioPath,
        audioSize: audioStat?.size,
        audioBase64Length: audioBase64?.length,
        audio: recordedAudio
          ? {
              name: recordedAudio.name,
              type: recordedAudio.type,
              uri: recordedAudio.uri,
            }
          : null,
      });

      const response = await axios.post(`${API_BASE_URL}/announcements`, {
        schoolCode,
        title: title.trim(),
        category,
        announcement_date: formatDate(announcementDate),
        description: description.trim(),
        audioBase64,
        audioFileName: recordedAudio?.name,
        audioMimeType: recordedAudio?.type,
      });

      console.log('[ChiefAnnouncements] submit success', {
        status: response.status,
        data: response.data,
      });

      Alert.alert('Success', 'Announcement created successfully!');

      // Reset form
      setTitle('');
      setCategory('General');
      setDescription('');
      setRecordedAudio(null);
    } catch (error: any) {
      const serverError =
        error.response?.data?.error || error.response?.data?.message;

      console.error('[ChiefAnnouncements] submit failed', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      Alert.alert(
        'Error',
        serverError ||
          'Failed to create announcement. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.headerTitle}>Create Announcement</Text>

         <TextInput
  style={styles.input}
  placeholder="Announcement Title"
  placeholderTextColor="#000"
  value={title}
  onChangeText={setTitle}
/>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Category (e.g., General)"
              value={category}
              onChangeText={setCategory}
            />
            <TouchableOpacity
              style={[styles.input, styles.halfInput, styles.dateInput]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.dateText}>
                {formatDate(announcementDate)}
              </Text>
            </TouchableOpacity>
          </View>

          <DateTimePickerModal
            isVisible={showDatePicker}
            mode="date"
            date={announcementDate}
            onConfirm={handleDateConfirm}
            onCancel={() => setShowDatePicker(false)}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Announcement Description"
              placeholderTextColor="#000"

            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <View style={styles.audioContainer}>
            <Text style={styles.label}>Audio Message</Text>
            <TouchableOpacity
              style={[
                styles.audioButton,
                isRecording && styles.recordingButton,
              ]}
              onPress={handleRecordingPress}
              disabled={isSubmitting}
            >
              <Text style={styles.audioButtonText}>
                {isRecording
                  ? 'Stop Recording'
                  : recordedAudio
                  ? 'Record Again'
                  : 'Record Audio'}
              </Text>
            </TouchableOpacity>
            {isRecording && (
              <Text style={styles.recordingText}>Recording...</Text>
            )}
            {recordedAudio && !isRecording && (
              <View style={styles.audioInfo}>
                <Text style={styles.audioName} numberOfLines={1}>
                  {recordedAudio.name}
                </Text>
                <TouchableOpacity onPress={() => setRecordedAudio(null)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSubmitting || isLoadingSchoolCode) && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || isLoadingSchoolCode}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Announcement</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 22,
    textAlign: 'center',
    color: '#333',
  },

  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color:'#000'
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  dateInput: { justifyContent: 'center' },
  dateText: { color: '#111', fontSize: 16 },
  textArea: { height: 120 },

  audioContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
  },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 15, color: '#555' },
  audioButton: {
    backgroundColor: '#28a745',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  recordingButton: { backgroundColor: '#dc3545' },
  audioButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  recordingText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  audioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  audioName: { flex: 1, color: '#333', fontSize: 14, fontWeight: '600' },
  removeText: { color: '#dc3545', fontSize: 14, fontWeight: '700' },

  submitButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: { opacity: 0.65 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default AnnouncementScreen;
