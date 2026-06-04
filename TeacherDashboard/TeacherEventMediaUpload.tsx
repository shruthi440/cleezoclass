import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ticketIcon from '../icons/application.png';
import RNFS from 'react-native-fs';
import axios from 'axios';

import { globalStyles as styles, attendanceStyles as ui } from '../teacherStyles';
import TeacherFooter from './TeacherFooter';
import TeacherSummaryCard from './TeacherSummaryCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_BASE = 'http://162.215.210.38:3010/api';

type RootStackParamList = {
  TeacherEventMediaUpload: { username: string; name: string };
};

type EventMedia = {
  uri: string;
  id: string;
  name: string;
  type: string;
};

const TeacherEventMediaUpload: React.FC<
  NativeStackScreenProps<RootStackParamList, 'TeacherEventMediaUpload'>
> = ({ route }) => {
  const { name } = route.params;

  const [uploaderName, setUploaderName] = useState('');
  const [uploaderDesignation, setUploaderDesignation] = useState('Teacher');
  const [nameOfEvent, setNameOfEvent] = useState('');
  const [eventMedia, setEventMedia] = useState<EventMedia[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const uploadStatusText = isUploading ? uploadProgress || 'Uploading...' : uploadProgress || 'Ready';
  const summaryCards = [
    {
      title: `${eventMedia.length}`,
      subtitle: 'Selected photos',
      footer: uploadStatusText,
      icon: 'images-outline',
      background: '#D7E7CD',
    },
    {
      title: isUploading ? 'Uploading' : 'Ready',
      subtitle: 'Upload status',
      footer: nameOfEvent.trim() || 'Event details',
      icon: 'cloud-upload-outline',
      background: '#F0EE96',
    },
  ];

  useEffect(() => {
    if (name) setUploaderName(name);
  }, [name]);

  const pickMultipleImages = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 30,
        quality: 0.7,
        maxWidth: 1280,
        maxHeight: 1280,
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert('Error', result.errorMessage || 'Image selection failed.');
        return;
      }

      const selected =
        result.assets?.filter((a: Asset) => !!a.uri).map((asset: Asset, idx: number) => ({
          uri: asset.uri as string,
          id: asset.fileName || `${asset.uri}_${idx}`,
          name: asset.fileName || `event_${Date.now()}_${idx}.jpg`,
          type: asset.type || 'image/jpeg',
        })) || [];

      setEventMedia(selected);
    } catch {
      Alert.alert('Error', 'Unable to select images.');
    }
  };

  const removeImage = (id: string) => {
    setEventMedia(prev => prev.filter(item => item.id !== id));
  };

  const validateAndUpload = async () => {
    if (!uploaderName.trim() || !uploaderDesignation.trim() || !nameOfEvent.trim()) {
      Alert.alert('Validation', 'Please fill event name, uploader name and designation.');
      return;
    }
    if (eventMedia.length === 0) {
      Alert.alert('Validation', 'Please select at least one photo.');
      return;
    }

    setIsUploading(true);
    setUploadProgress('');
    try {
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      if (!schoolCode) {
        Alert.alert('Error', 'School code missing. Please login again.');
        return;
      }

      for (let i = 0; i < eventMedia.length; i += 1) {
        const file = eventMedia[i];
        setUploadProgress(`Uploading ${i + 1}/${eventMedia.length}`);
        const normalizedPath = file.uri.replace('file://', '');
        const base64File = await RNFS.readFile(normalizedPath, 'base64');

        const response = await axios.post(`${API_BASE}/teacher-upload-base64`, {
          photo_data: '',
          name_of_event: nameOfEvent.trim(),
          uploader_name: uploaderName.trim(),
          uploader_designation: uploaderDesignation.trim(),
          school_code: schoolCode,
          file_name: file.name,
          file_type: file.type,
          file_base64: base64File,
        });

        if (response.status < 200 || response.status >= 300) {
          throw new Error(response.data?.message || `Upload failed at file ${i + 1}`);
        }
      }

      setUploadProgress('Upload complete');
      Alert.alert('Success', 'Photos uploaded successfully!');
      setNameOfEvent('');
      setEventMedia([]);
    } catch (error: any) {
      setUploadProgress('');
      Alert.alert('Upload Error', error?.message || 'Unable to upload photos.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView style={styles.scrollView} contentContainerStyle={ui.page} showsVerticalScrollIndicator={false}>
        <View style={local.container}>
          <View style={local.summaryRow}>
            {summaryCards.map((card, index) => (
              <TeacherSummaryCard
                key={`${card.subtitle}-${index}`}
                style={[
                  index === 0 ? local.summaryCardLeft : local.summaryCardRight,
                  { flex: 1 },
                ]}
              >
                <View style={local.summaryText}>
                  <View style={local.summaryTitleRow}>
                    <Text style={local.summaryNumber} numberOfLines={1} ellipsizeMode="tail">
                      {card.title}
                    </Text>
                    <Text style={local.summarySubtitle} numberOfLines={1} ellipsizeMode="tail">
                      {card.subtitle}
                    </Text>
                  </View>
                  <Text style={local.summaryFooter} numberOfLines={2} ellipsizeMode="tail">
                    {card.footer}
                  </Text>
                </View>
                <View style={local.summaryIconWrap}>
                  <Ionicons name={card.icon as any} size={28} color="#4C4C4C" />
                </View>
              </TeacherSummaryCard>
            ))}
          </View>

          <View style={ui.card}>
            <Text style={ui.cardLabel}>Upload Actions</Text>
            <View style={ui.actionsRow}>
              <TouchableOpacity style={ui.secondaryButton} onPress={pickMultipleImages}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="images-outline" size={18} color="#111827" />
                  <Text style={ui.secondaryButtonText}> Photos</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.messageBtnTall, { marginLeft: 0 }, isUploading && { opacity: 0.75 }]}
                onPress={validateAndUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Image source={ticketIcon} style={[styles.iconImage, { tintColor: '#0a3d62' }]} />
                )}
              </TouchableOpacity>
            </View>

            <View style={local.formArea}>
              <TextInput
                style={local.input}
                placeholder="Name of Event"
                placeholderTextColor="#777"
                value={nameOfEvent}
                onChangeText={setNameOfEvent}
              />
              <TextInput
                style={local.input}
                placeholder="Uploader Name"
                placeholderTextColor="#777"
                value={uploaderName}
                onChangeText={setUploaderName}
              />
              <TextInput
                style={local.input}
                placeholder="Uploader Designation"
                placeholderTextColor="#777"
                value={uploaderDesignation}
                onChangeText={setUploaderDesignation}
              />
            </View>

            <View style={local.mediaQueueCard}>
              <Text style={ui.cardLabel}>Media Queue</Text>
              <Text style={local.metaText}>Selected: {eventMedia.length} photo(s)</Text>
              {!!uploadProgress && <Text style={local.progressText}>{uploadProgress}</Text>}

              <ScrollView
                style={local.mediaQueueScroll}
                contentContainerStyle={local.bottomMediaContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                {eventMedia.length === 0 ? (
                  <Text style={local.emptyStateText}>No photos selected yet</Text>
                ) : (
                    <View style={local.gridWrap}>
                    {eventMedia.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          ui.studentTile,
                          ui.studentTileDefault,
                          local.thumbWrap,
                          index % 3 !== 2 && local.thumbGapRight,
                        ]}
                      >
                        <Image source={{ uri: item.uri }} style={local.thumb} />
                        <TouchableOpacity style={local.removeBtn} onPress={() => removeImage(item.id)}>
                          <Text style={local.removeBtnText}>X</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </ScrollView>

      <TeacherFooter />
    </SafeAreaView>
  );
};

const local = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    paddingTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
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
  mediaCard: {
    marginHorizontal: 12,
    borderRadius: 28,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#E8E1D3',
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  mediaHeader: {
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  mediaKicker: {
    color: '#9A7B4F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mediaTitle: {
    marginTop: 4,
    color: '#111827',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  actionButtonPrimary: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: '#F4EBDD',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2D8C6',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  formArea: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 2,
  },
  mediaQueueCard: {
    marginTop: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f6f6f7',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  input: {
    backgroundColor: '#f6f6f7',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: '#111',
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  metaRow: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  metaText: {
    color: '#111827',
    fontWeight: '600',
    textAlign: 'center',
  },
  progressText: {
    color: '#2563EB',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  mediaQueueScroll: {
    marginTop: 8,
    maxHeight: SCREEN_HEIGHT * 0.34,
  },
  bottomMediaArea: {
    marginTop: 4,
    paddingHorizontal: 2,
    flexGrow: 0,
    maxHeight: SCREEN_HEIGHT * 0.28,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 2,
    paddingHorizontal: 4,
  },
  bottomMediaContent: {
    paddingBottom: 4,
  },
  emptyStateText: {
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 14,
    fontWeight: '500',
  },
  thumbWrap: {
    width: '31%',
    marginBottom: 10,
    position: 'relative',
  },
  thumbGapRight: {
    marginRight: 8,
  },
  thumb: {
    width: '100%',
    height: 82,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  removeBtn: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  footerWrapper: {
    marginTop: 10,
  },
  footerLogoWrap: {
    backgroundColor: '#F5F1E8',
  },
});

export default TeacherEventMediaUpload;
