import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Share,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  pick,
  types,
  keepLocalCopy,
  DocumentPickerResponse,
} from '@react-native-documents/picker';
import { launchImageLibrary, Asset } from 'react-native-image-picker';

import { buildTeacherDayPeriods, useNextClass } from '../NextClassContext';
import { globalStyles as styles, attendanceStyles as ui } from '../teacherStyles';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_BASE = 'http://162.215.210.38:3010/api';

type RootStackParamList = {
  TeacherHomework: {
    className?: string;
    section?: string;
    name: string;
    username?: string;
    schoolCode?: string;
  };
};

type SectionItem = {
  class_name: string;
  section: string;
};

const normalizeSectionItems = (value: unknown): SectionItem[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is SectionItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as SectionItem).class_name === 'string' &&
        typeof (item as SectionItem).section === 'string'
    );
  }

  if (value && typeof value === 'object') {
    const maybeWrapped =
      (value as { data?: unknown }).data ??
      (value as { sectionData?: unknown }).sectionData ??
      (value as { sections?: unknown }).sections;
    return normalizeSectionItems(maybeWrapped);
  }

  return [];
};

type UploadableFile = {
  uri: string;
  name: string;
  type: string;
};

type HomeworkItem = {
  id: number;
  class_name: string;
  section: string;
  subject: string;
  date: string;
  file_type: string;
  homework_file: string | null;
};

const TeacherHomework: React.FC<
  NativeStackScreenProps<RootStackParamList, 'TeacherHomework'>
> = ({ route }) => {
  const { schoolCode: routeSchoolCode } = route.params || {};
  const { nextClass, fullTimetable, refreshNextClass } = useNextClass();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [sectionData, setSectionData] = useState<SectionItem[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [schoolCode, setSchoolCode] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('General');
  const [showModal, setShowModal] = useState(false);
  const [lastUploadStatus, setLastUploadStatus] = useState('');
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    const fetchClassSection = async () => {
      try {
        console.log('[TeacherHomework] fetchClassSection:start');
        setDropdownLoading(true);
        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
        const code = storedSchoolCode || routeSchoolCode || '';
        console.log('[TeacherHomework] schoolCode resolved:', code);
        setSchoolCode(code);

        if (!code) {
          Alert.alert('Error', 'School code missing');
          return;
        }

        const sectionRes = await fetch(
          `https://cleezoclass.com:4000/api/admin/sectionFilter?schoolCode=${code}`
        );
        console.log('[TeacherHomework] sectionFilter status:', sectionRes.status);
        const fetchedSectionData = await sectionRes.json();
        const normalizedSectionData = normalizeSectionItems(fetchedSectionData);
        console.log(
          '[TeacherHomework] sectionFilter count:',
          normalizedSectionData.length
        );
        setSectionData(normalizedSectionData);
      } catch (err) {
        console.log('[TeacherHomework] fetchClassSection error:', err);
        Alert.alert('Error', 'Failed to load class and section');
      } finally {
        console.log('[TeacherHomework] fetchClassSection:end');
        setDropdownLoading(false);
      }
    };

    fetchClassSection();
  }, [routeSchoolCode]);

  useEffect(() => {
    if (nextClass?.subject) {
      setSelectedSubject(nextClass.subject);
    }
  }, [nextClass]);

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

  const sortedClassOptions = useMemo(
    () =>
      [...new Set((Array.isArray(sectionData) ? sectionData : []).map(item => item.class_name).filter(Boolean))].sort(
        (a, b) => (classSortOrder[a] ?? 999) - (classSortOrder[b] ?? 999)
      ),
    [sectionData]
  );

  const availableSections = useMemo(
    () =>
      selectedClass
        ? [...new Set(
            (Array.isArray(sectionData) ? sectionData : [])
              .filter(item => item.class_name === selectedClass)
              .map(item => String(item.section || '').trim())
              .filter(Boolean)
          )].sort()
        : [],
    [sectionData, selectedClass]
  );

  const timetableSubjects = useMemo(() => {
    const set = new Set<string>();
    fullTimetable.forEach((day: any) => {
      day.periods?.forEach((period: any) => {
        if (period.subject) set.add(period.subject);
      });
    });
    const list = Array.from(set);
    return list.length ? list : ['General'];
  }, [fullTimetable]);

  const summaryCards = useMemo(
    () => [
      {
        title: 'Homework',
        subtitle:
          selectedClass && selectedSection ? `${selectedClass} - ${selectedSection}` : 'Select class and section',
        footer: `${homeworkList.length} uploaded items`,
        icon: 'document-text-outline',
        background: '#D7E7CD',
      },
      {
        title: nextClass?.class_id || '--',
        subtitle: nextClass?.subject || selectedSubject || 'No class',
        footer: nextClass ? `${nextClass.fromTime} - ${nextClass.toTime}` : 'No timetable available',
        icon: 'time-outline',
        background: '#F0EE96',
      },
    ],
    [homeworkList.length, nextClass, selectedClass, selectedSection, selectedSubject]
  );

  const handleClassChange = (value: string) => {
    console.log('[TeacherHomework] class selected raw:', value);
    setSelectedClass(value);
    setSelectedSection('');
    setHomeworkList([]);
  };

  const handleSectionChange = (value: string) => {
    console.log('[TeacherHomework] section selected raw:', value);
    setSelectedSection(value);
    setHomeworkList([]);
  };

  const fetchUploadedHomework = async () => {
    if (!schoolCode || !selectedClass || !selectedSection) return;

    setListLoading(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      const res = await fetch(
        `${API_BASE}/homework-list?date=${date}&schoolCode=${encodeURIComponent(schoolCode)}`
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch uploads (${res.status})`);
      }
      const data: HomeworkItem[] = await res.json();
      const filtered = (Array.isArray(data) ? data : [])
        .filter(item => item.class_name === selectedClass && item.section === selectedSection)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setHomeworkList(filtered);
    } catch (e) {
      console.log('[TeacherHomework] fetchUploadedHomework error:', e);
      setHomeworkList([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchUploadedHomework();
  }, [selectedClass, selectedSection, schoolCode]);

  const shareHomeworkFile = async (item: HomeworkItem) => {
    try {
      if (!item.homework_file) {
        Alert.alert('No file', 'This record has no file data.');
        return;
      }
      const ext = item.file_type?.includes('pdf')
        ? 'pdf'
        : item.file_type?.includes('png')
        ? 'png'
        : item.file_type?.includes('jpeg') || item.file_type?.includes('jpg')
        ? 'jpg'
        : 'bin';
      const filePath = `${RNFS.CachesDirectoryPath}/hw_${item.id}_${Date.now()}.${ext}`;
      await RNFS.writeFile(filePath, item.homework_file, 'base64');
      await Share.share({ url: `file://${filePath}`, message: 'Homework file' });
    } catch (e) {
      console.log('[TeacherHomework] shareHomeworkFile error:', e);
      Alert.alert('Error', 'Unable to open/share this file.');
    }
  };

  const uploadHomeworkFile = async (file: UploadableFile) => {
    const finalUri = file.uri.startsWith('/') ? `file://${file.uri}` : file.uri;
    console.log('[TeacherHomework] uploadHomeworkFile:start', {
      className: selectedClass,
      section: selectedSection,
      subject: selectedSubject,
      schoolCode,
      fileName: file?.name,
      fileType: file?.type,
      fileUri: file?.uri,
      finalUri,
    });
    if (!selectedClass || !selectedSection) {
      Alert.alert('Select Class', 'Please select class and section first.');
      return;
    }

    if (!schoolCode) {
      Alert.alert('Missing Data', 'School code is missing. Please login again.');
      return;
    }

    setIsUploading(true);
    try {
      const healthRes = await fetch(`${API_BASE}/health`);
      console.log('[TeacherHomework] health status:', healthRes.status);
      if (!healthRes.ok) {
        throw new Error(`Backend unreachable at ${API_BASE} (status ${healthRes.status})`);
      }

      const pingRes = await fetch(`${API_BASE}/homework-ping`);
      console.log('[TeacherHomework] homework-ping status:', pingRes.status);

      console.log('[TeacherHomework] upload API URL:', `${API_BASE}/upload-homework-base64`);
      const normalizedPath = finalUri.replace('file://', '');
      const base64File = await RNFS.readFile(normalizedPath, 'base64');
      console.log('[TeacherHomework] base64 size:', base64File.length);

      const base64Response = await axios.post(`${API_BASE}/upload-homework-base64`, {
        class_name: selectedClass,
        section: selectedSection,
        subject: selectedSubject || 'General',
        schoolCode,
        file_name: file.name,
        file_type: file.type,
        file_base64: base64File,
      });
      console.log('[TeacherHomework] base64 upload status:', base64Response.status);
      console.log('[TeacherHomework] base64 upload data:', base64Response.data);
      if (base64Response.status < 200 || base64Response.status >= 300) {
        throw new Error(base64Response.data?.message || 'Upload failed');
      }
      const uploadMessage = base64Response.data?.message || 'Homework uploaded successfully';
      Alert.alert('Success', uploadMessage);
      const uploadedType = file.type?.startsWith('image/') ? 'Image' : 'Document';
      setLastUploadStatus(`Upload complete: ${uploadedType}`);
      fetchUploadedHomework();
    } catch (err: any) {
      console.log('[TeacherHomework] upload error:', err);
      console.log('[TeacherHomework] upload error response:', err?.response?.data);
      const fallback =
        Platform.OS === 'ios'
          ? 'Could not reach server. Rebuild iOS app after ATS change and retry.'
          : 'Could not reach server. Check internet/server status.';
      Alert.alert('Upload failed', err?.message || fallback);
    } finally {
      setIsUploading(false);
    }
  };

  const pickDocumentAndUpload = async () => {
    let file: DocumentPickerResponse;
    try {
      console.log('[TeacherHomework] picker:document open');
      const res = await pick({ type: [types.pdf, types.doc, types.docx] });
      console.log('[TeacherHomework] picker:document result count:', res?.length ?? 0);
      if (!res?.length) return;
      file = res[0];
      console.log('[TeacherHomework] picker:document selected:', {
        name: file.name,
        type: file.type,
        uri: file.uri,
        isVirtual: file.isVirtual,
        convertibleToMimeTypes: file.convertibleToMimeTypes,
      });
    } catch (err: any) {
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.log('[TeacherHomework] picker:document error:', err);
        Alert.alert('Error', 'Document selection failed');
      }
      return;
    }

    let uploadUri = file.uri;
    try {
      const convertVirtualFileToType =
        file.isVirtual && file.convertibleToMimeTypes?.length
          ? file.convertibleToMimeTypes.find(t => t.mimeType === 'application/pdf')?.mimeType ||
            file.convertibleToMimeTypes[0].mimeType
          : undefined;

      const copied = await keepLocalCopy({
        destination: 'cachesDirectory',
        files: [
          {
            uri: file.uri,
            fileName: file.name || `homework_${Date.now()}.pdf`,
            convertVirtualFileToType,
          },
        ],
      });

      const copyResult = copied?.[0];
      console.log('[TeacherHomework] keepLocalCopy result:', copyResult);
      if (copyResult?.status === 'success' && copyResult.localUri) {
        uploadUri = copyResult.localUri;
      }
    } catch (copyErr) {
      console.log('[TeacherHomework] keepLocalCopy error:', copyErr);
    }

    const finalDocUri = uploadUri.startsWith('/') ? `file://${uploadUri}` : uploadUri;
    if (finalDocUri.startsWith('content://com.google.android.apps.docs.storage')) {
      Alert.alert(
        'File Access Error',
        'Google Drive file could not be converted for upload. Please download the file to device storage and try again.'
      );
      return;
    }

    await uploadHomeworkFile({
      uri: finalDocUri,
      name: file.name || `homework_${Date.now()}.pdf`,
      type: file.type || 'application/pdf',
    });
  };

  const pickImageAndUpload = async () => {
    try {
      console.log('[TeacherHomework] picker:image open');
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        console.log('[TeacherHomework] picker:image error:', result.errorCode, result.errorMessage);
        Alert.alert('Error', result.errorMessage || 'Image selection failed');
        return;
      }

      const asset: Asset | undefined = result.assets?.[0];
      console.log('[TeacherHomework] picker:image selected:', {
        name: asset?.fileName,
        type: asset?.type,
        uri: asset?.uri,
      });
      if (!asset?.uri) return;

      await uploadHomeworkFile({
        uri: asset.uri,
        name: asset.fileName || `homework_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
      });
    } catch {
      Alert.alert('Error', 'Image selection failed');
    }
  };

  const openUploadOptions = () => {
    console.log('[TeacherHomework] openUploadOptions');
    console.log('[TeacherHomework] VERSION base64-only-2026-03-03');
    Alert.alert('Upload Homework', 'Select file type', [
      { text: 'Image', onPress: pickImageAndUpload },
      { text: 'PDF / Document', onPress: pickDocumentAndUpload },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={local.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={local.scrollView} contentContainerStyle={local.scrollContent}>
        <View style={local.container}>
          <View style={local.summaryRow}>
            {summaryCards.map((card, index) => (
              <View
                key={`${card.title}-${index}`}
                style={[
                  local.summaryCard,
                  index === 0 ? local.summaryCardLeft : local.summaryCardRight,
                  { backgroundColor: card.background },
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
                  <Ionicons name={card.icon} size={28} color="#4C4C4C" />
                </View>
              </View>
            ))}
          </View>

          <View style={ui.card}>
            <Text style={ui.cardLabel}>Class and section</Text>
            <View style={local.classSectionRow}>
              <View style={[styles.dropdownContainer, local.flexDropdown]}>
                <Picker
                  selectedValue={selectedClass}
                  onValueChange={handleClassChange}
                  style={[styles.picker, { color: '#111827' }]}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label="Select Class" value="" />
                  {sortedClassOptions.map(className => (
                    <Picker.Item key={className} label={className} value={className} />
                  ))}
                </Picker>
              </View>

              <View style={[styles.dropdownContainer, local.flexDropdown]}>
                <Picker
                  selectedValue={selectedSection}
                  onValueChange={handleSectionChange}
                  enabled={Boolean(selectedClass)}
                  style={[styles.picker, { color: '#111827' }]}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item
                    label={selectedClass ? 'Select Section' : 'Select Class First'}
                    value=""
                  />
                  {availableSections.map(section => (
                    <Picker.Item key={section} label={section} value={section} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={ui.card}>
            <Text style={ui.cardLabel}>Upload tools</Text>
            <View style={ui.actionsRow}>
              <TouchableOpacity
                style={[ui.primaryButton, { flex: 1 }]}
                onPress={openUploadOptions}
                disabled={isUploading}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {isUploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={20} color="#000" />
                  )}
                  <Text style={ui.primaryButtonText}>
                    {isUploading ? 'Uploading...' : 'Hw Upload'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[ui.secondaryButton, { flex: 1 }]}
                onPress={() => {
                  Alert.alert(
                    'Choose Topic',
                    'Pick homework subject',
                    timetableSubjects.map(topic => ({
                      text: topic,
                      onPress: () => setSelectedSubject(topic),
                    }))
                  );
                }}
              >
                <Text style={ui.secondaryButtonText}>Choose Topic</Text>
              </TouchableOpacity>
            </View>
            <Text style={local.statusText}>{lastUploadStatus || 'No file uploaded yet'}</Text>
          </View>

          <View style={ui.card}>
            <View style={local.listHeaderRow}>
              <Text style={ui.cardLabel}>Uploaded files</Text>
              <Text style={local.listCount}>{homeworkList.length} items</Text>
            </View>
            <View style={local.listBox}>
              <ScrollView contentContainerStyle={styles.gridScrollContent} nestedScrollEnabled>
                {listLoading ? (
                  <ActivityIndicator size="small" color="#333" />
                ) : homeworkList.length === 0 ? (
                  <Text style={local.emptyText}>No uploaded documents yet</Text>
                ) : (
                  homeworkList.map(item => (
                    <View key={item.id} style={local.fileCard}>
                      <Text style={local.fileTitle}>
                        {item.subject || 'Homework'} - {item.file_type?.includes('image') ? 'Image' : 'Document'}
                      </Text>
                      <Text style={local.fileMeta}>
                        {item.class_name}-{item.section} | {new Date(item.date).toLocaleString()}
                      </Text>

                      {item.file_type?.startsWith('image/') && item.homework_file ? (
                        <Image
                          source={{ uri: `data:${item.file_type};base64,${item.homework_file}` }}
                          style={local.previewImage}
                          resizeMode="cover"
                        />
                      ) : null}

                      <TouchableOpacity style={local.shareButton} onPress={() => shareHomeworkFile(item)}>
                        <Text style={local.shareButtonText}>Open / Share</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000000aa', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 10, maxHeight: '80%' }}>
            <ScrollView>
              {buildTeacherDayPeriods(fullTimetable).length === 0 ? (
                <Text>No timetable available</Text>
              ) : (
                buildTeacherDayPeriods(fullTimetable).map((day: any, index: number) => (
                  <View key={index} style={{ marginBottom: 15 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{day.day}</Text>
                    {day.periods.map((p: any, idx: number) => (
                      <Text key={idx}>
                        {p.fromTime.slice(0, 5)} - {p.toTime.slice(0, 5)} : {p.subject} ({p.class_id})
                      </Text>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity onPress={() => setShowModal(false)} style={{ marginTop: 10 }}>
              <Text style={{ color: 'blue', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {dropdownLoading && (
        <View style={ui.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </SafeAreaView>
  );
};

const local = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  container: {
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    height: 108,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
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
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9ECF2',
  },
  heroKicker: {
    color: '#7A7F87',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#5F6672',
    fontSize: 14,
    lineHeight: 20,
  },
  heroPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPillText: {
    color: '#3949AB',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECF2',
  },
  sectionLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButton: {
    backgroundColor: '#111827',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '700',
    textAlign: 'center',
  },
  statusText: {
    marginTop: 10,
    color: '#1F7A1F',
    fontWeight: '600',
    textAlign: 'center',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listCount: {
    color: '#6B7280',
    fontSize: 12,
  },
  listBox: {
    minHeight: 220,
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
  fileCard: {
    backgroundColor: '#FAFAFB',
    borderWidth: 1,
    borderColor: '#DDE3EA',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  fileTitle: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 15,
  },
  fileMeta: {
    color: '#6B7280',
    marginTop: 4,
    fontSize: 12,
  },
  previewImage: {
    height: 120,
    borderRadius: 12,
    marginTop: 10,
  },
  shareButton: {
    marginTop: 10,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000033',
  },
  classSectionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexDropdown: {
    flex: 1,
    width: 'auto',
  },
});

export default TeacherHomework;
