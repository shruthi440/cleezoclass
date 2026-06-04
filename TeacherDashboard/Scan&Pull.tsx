import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,Modal
} from 'react-native';
import axios from 'axios';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { globalStyles as styles, attendanceStyles as ui } from '../teacherStyles';
import TeacherFooter from './TeacherFooter';
import TeacherSummaryCard from './TeacherSummaryCard';

type ScanData = {
  name: string;
  class_name: string;
  section: string;
  test_type: string;
  subject: string;
  marks: string;
  marks_obtained: string;
  grade: string;
  remarks: string;
  ranking: string;
};

type PulledRow = {
  id?: number | string;
  name: string;
  class_name: string;
  section: string;
  test_type: string;
  subject: string;
  marks: number;
  marks_obtained: number | null;
  grade: string | null;
  remarks: string | null;
  ranking: number | null;
  createdAt: string;
};

const API_BASE = 'http://162.215.210.38:3010';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const emptyScan: ScanData = {
  name: '',
  class_name: '',
  section: '',
  test_type: '',
  subject: '',
  marks: '',
  marks_obtained: '',
  grade: '',
  remarks: '',
  ranking: '',
};

const HandwritingScanPull: React.FC = () => {
  const [schoolCode, setSchoolCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'pull'>('scan');

  const [scanForm, setScanForm] = useState<ScanData>(emptyScan);
  const [previewUri, setPreviewUri] = useState('');

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('General');
  const [showModal, setShowModal] = useState(false);
  const savedSignaturesRef = useRef<Set<string>>(new Set());

  const [filters, setFilters] = useState({
    class_name: '',
    section: '',
    test_type: '',
    subject: '',
    name: '',
    grade: '',
  });
  const [rows, setRows] = useState<PulledRow[]>([]);
  const summaryCards = [
    {
      title: activeTab === 'scan' ? 'Scan' : 'Pull',
      subtitle: activeTab === 'scan' ? 'OCR entry' : 'Saved marks',
      footer: activeTab === 'scan' ? (scanning ? 'Scanning now' : 'Ready to scan') : (pulling ? 'Loading records' : `${rows.length} records`),
      icon: activeTab === 'scan' ? 'scan-outline' : 'download-outline',
      background: '#D7E7CD',
    },
    {
      title: activeTab === 'scan' ? 'Camera' : 'Filters',
      subtitle: activeTab === 'scan' ? 'Image input' : 'Search fields',
      footer: activeTab === 'scan' ? 'Gallery available too' : 'Class, section and test type',
      icon: activeTab === 'scan' ? 'camera-outline' : 'funnel-outline',
      background: '#F0EE96',
    },
  ];


  const canSave = useMemo(() => {
    const marksNum = Number(scanForm.marks);
    const marksObtainedNum =
      scanForm.marks_obtained.trim() !== '' ? Number(scanForm.marks_obtained) : null;
    const rankNum = scanForm.ranking.trim() !== '' ? Number(scanForm.ranking) : null;

    return (
      !!schoolCode &&
      !!scanForm.name &&
      !!scanForm.class_name &&
      !!scanForm.section &&
      !!scanForm.test_type &&
      !!scanForm.subject &&
      Number.isFinite(marksNum) &&
      marksNum >= 0 &&
      (marksObtainedNum === null || (Number.isFinite(marksObtainedNum) && marksObtainedNum >= 0)) &&
      (rankNum === null || (Number.isInteger(rankNum) && rankNum >= 0))
    );
  }, [scanForm, schoolCode]);

  const loadSchoolCode = async () => {
    try {
      setLoadingCode(true);
      const storedCode = await AsyncStorage.getItem('schoolCode');
      if (!storedCode) {
        Alert.alert('Not found', 'schoolCode is not available in storage.');
        return;
      }
      setSchoolCode(storedCode);
    } catch {
      Alert.alert('Error', 'Failed to load schoolCode');
    } finally {
      setLoadingCode(false);
    }
  };
  
  useEffect(() => {
    loadSchoolCode();
  }, []);

  const normalizeImageMimeType = (mimeType?: string) => {
    const type = String(mimeType || '').toLowerCase();
    if (type.includes('heic') || type.includes('heif')) return 'image/jpeg';
    if (type.startsWith('image/')) return type;
    return 'image/jpeg';
  };

  const readBase64FromUri = async (uri?: string) => {
    if (!uri) return null;
    try {
      return await RNFS.readFile(uri, 'base64');
    } catch {
      return null;
    }
  };

  const resolveBase64 = async (asset?: { base64?: string; uri?: string }) => {
    if (asset?.base64) return asset.base64;
    const fromUri = await readBase64FromUri(asset?.uri);
    return fromUri;
  };

  const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();
  const normalizeNumber = (value: unknown) =>
    value === null || value === undefined || String(value).trim() === '' ? null : Number(value);
  const extractFractionMarks = (value: unknown) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const match = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if (!match) return null;
    return {
      obtained: match[1],
      total: match[2],
    };
  };
  const buildSignature = () => [
    normalizeText(schoolCode),
    normalizeText(scanForm.name),
    normalizeText(scanForm.class_name),
    normalizeText(scanForm.section),
    normalizeText(scanForm.test_type),
    normalizeText(scanForm.subject),
    String(normalizeNumber(scanForm.marks) ?? ''),
    String(normalizeNumber(scanForm.marks_obtained) ?? ''),
    normalizeText(scanForm.grade),
    normalizeText(scanForm.remarks),
    String(normalizeNumber(scanForm.ranking) ?? ''),
  ].join('|');

  const onScanImage = async (base64: string, uri?: string, mimeType?: string) => {
    if (!schoolCode) {
      Alert.alert('Missing schoolCode', 'Load or enter schoolCode first.');
      return;
    }

    try {
      setScanning(true);
      console.log('🧾 OCR scan started', {
        schoolCode,
        mimeType,
        hasBase64: !!base64,
      });
      const normalizedMimeType = normalizeImageMimeType(mimeType);
      const payload = {
        schoolCode,
        image: `data:${normalizedMimeType};base64,${base64}`,
      };

      const response = await axios.post(`${API_BASE}/api/uploadscanner`, payload, {
        timeout: 60000,
      });

      console.log('📥 OCR raw response:', response?.data);
      const data = response?.data?.data || {};
      console.log('🧾 OCR parsed data:', data);
      const rawMarks = data.marks ?? '';
      const rawObtained = data.marks_obtained ?? '';
      const rawRemarks = data.remarks ?? '';
      const fraction =
        extractFractionMarks(rawMarks) ||
        extractFractionMarks(rawObtained) ||
        extractFractionMarks(rawRemarks);

      console.log('🧾 OCR values', {
        rawMarks,
        rawObtained,
        rawRemarks,
        fraction,
      });

      const marksValue = fraction?.total ?? String(rawMarks ?? '').trim();
      const marksObtainedValue =
        fraction?.obtained ?? String(rawObtained ?? rawMarks ?? '').trim();

      setScanForm({
        name: String(data.name || '').trim(),
        class_name: String(data.class_name || '').trim(),
        section: String(data.section || '').trim(),
        test_type: String(data.testType || data.test_type || data.exam_type || 'FA1').trim(),
        subject: String(data.subject || '').trim(),
        marks: String(marksValue).trim(),
        marks_obtained: String(marksObtainedValue).trim(),
        grade: String(data.grade || '').trim().toUpperCase(),
        remarks: String(rawRemarks || '').trim(),
        ranking: String(data.ranking ?? '').trim(),
      });

      if (uri) setPreviewUri(uri);
      Alert.alert('Scan complete', 'Handwriting pulled. You can edit before saving.');
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message ||
        (status === 413 ? 'Image is too large. Choose a smaller image and try again.' : null) ||
        'Unable to process image';
      Alert.alert('Scan failed', message);
    } finally {
      setScanning(false);
    }
  };

  const scanFromCamera = () => {
    const openCamera = () => {
      launchCamera(
        {
          mediaType: 'photo',
          includeBase64: true,
          // Smaller capture makes OCR upload + processing faster.
          quality: 0.7,
          cameraType: 'back',
          saveToPhotos: false,
          maxWidth: 1600,
          maxHeight: 1600,
          assetRepresentationMode: 'compatible',
        },
        async response => {
          if (response.didCancel) return;
          if (response.errorCode) {
            const code = response.errorCode;
            const message =
              response.errorMessage ||
              (code === 'camera_unavailable'
                ? 'Camera unavailable on this device/emulator.'
                : code === 'permission'
                ? 'Camera permission denied.'
                : 'Failed to open camera');
            Alert.alert('Camera error', `[${code}] ${message}`);
            return;
          }
          const asset = response.assets?.[0];
          const base64 = await resolveBase64(asset);
          if (!base64) {
            Alert.alert('No image', 'Camera image is empty or unreadable');
            return;
          }
          await onScanImage(base64, asset.uri, asset.type);
        },
      );
    };

    if (Platform.OS !== 'android') {
      openCamera();
      return;
    }

    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera Permission',
      message: 'Camera access is required to scan marks.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    })
      .then(result => {
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          openCamera();
          return;
        }
        Alert.alert(
          'Permission required',
          'Please enable Camera permission in app settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
      })
      .catch(() => {
        Alert.alert('Camera error', 'Unable to request camera permission');
      });
  };

  const scanFromGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
        maxWidth: 2200,
        maxHeight: 2200,
        assetRepresentationMode: 'compatible',
        selectionLimit: 1,
      },
      async response => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Gallery error', response.errorMessage || 'Failed to open gallery');
          return;
        }
        const asset = response.assets?.[0];
        const base64 = await resolveBase64(asset);
        if (!base64) {
          Alert.alert('No image', 'Selected image is empty or unreadable');
          return;
        }
        await onScanImage(base64, asset.uri, asset.type);
      },
    );
  };

  const saveScannedMarks = async () => {
    if (!canSave) {
      Alert.alert('Validation', 'Fill all fields and ensure marks is a non-negative number.');
      return;
    }

    const signature = buildSignature();
    if (savedSignaturesRef.current.has(signature)) {
      Alert.alert('Duplicate', 'Same details already submitted.');
      return;
    }

    try {
      setSaving(true);
      await axios.post(`${API_BASE}/api/save_academic_report`, {
        schoolCode,
        name: scanForm.name.trim(),
        class_name: scanForm.class_name.trim(),
        section: scanForm.section.trim(),
        test_type: scanForm.test_type.trim(),
        academic_report: [
          {
            subject: scanForm.subject.trim(),
            marks: Number(scanForm.marks),
          },
        ],
      });

      Alert.alert('Saved', 'Marks saved successfully');
      savedSignaturesRef.current.add(signature);
      setScanForm(emptyScan);
      setPreviewUri('');
    } catch (error: any) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save marks');
    } finally {
      setSaving(false);
    }
  };

  const pullMarks = async () => {
    if (!schoolCode || !filters.class_name || !filters.section || !filters.test_type) {
      Alert.alert('Validation', 'schoolCode, class, section and test type are required to pull.');
      return;
    }

    try {
      setPulling(true);
      const response = await axios.get(`${API_BASE}/api/academic_performance`, {
        params: {
          schoolCode,
          class_name: filters.class_name,
          section: filters.section,
          test_type: filters.test_type,
          subject: filters.subject || undefined,
          name: filters.name || undefined,
          grade: filters.grade || undefined,
        },
        timeout: 30000,
      });

      setRows(
        Array.isArray(response?.data?.records)
          ? response.data.records
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : []
      );
    } catch (error: any) {
      Alert.alert('Pull failed', error?.response?.data?.message || 'Unable to pull marks');
    } finally {
      setPulling(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 24 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={local.summaryRow}>
            {summaryCards.map((card, index) => (
              <TeacherSummaryCard
                key={`${card.subtitle}-${index}`}
                style={[
                  local.summaryCard,
                  index === 0 ? local.summaryCardLeft : local.summaryCardRight,
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
          <View style={[styles.syllabusContainer4]}>
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.submitBtn1,{marginTop:10}]}
                onPress={() => setActiveTab('scan')}
              >
                <Text style={styles.submitBtnText}>Upload marks</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn1,{marginTop:10}]}
                onPress={() => setActiveTab('pull')}
              >
<Text style={styles.submitBtnText}>Marks Retrieval</Text>              </TouchableOpacity>
            </View>

            {activeTab === 'scan' && (
              <View style={[styles.buttonRow1, {marginTop:'5%'}]}>
                <TouchableOpacity style={styles.submitBtn1} onPress={scanFromCamera} disabled={scanning}>
                  <Text style={styles.submitBtnText}>{scanning ? 'Scanning...' : 'Camera '}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn1} onPress={scanFromGallery} disabled={scanning}>
                  <Text style={styles.submitBtnText}>Gallery </Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView
              style={[local.formScroll, activeTab === 'scan' ? local.formScrollScan : local.formScrollPull]}
              contentContainerStyle={local.formContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'scan' ? (
                <>
                  <Text style={local.sectionTitle}></Text>
                  <TextInput
                    style={local.input}
                    value={scanForm.name}
                    onChangeText={v => setScanForm(p => ({ ...p, name: v }))}
                    placeholder="Student name"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.class_name}
                    onChangeText={v => setScanForm(p => ({ ...p, class_name: v }))}
                    placeholder="Class"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.section}
                    onChangeText={v => setScanForm(p => ({ ...p, section: v }))}
                    placeholder="Section"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.test_type}
                    onChangeText={v => setScanForm(p => ({ ...p, test_type: v }))}
                    placeholder="Test type (FA1/SA1...)"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.subject}
                    onChangeText={v => setScanForm(p => ({ ...p, subject: v }))}
                    placeholder="Subject"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.marks}
                    onChangeText={v => setScanForm(p => ({ ...p, marks: v.replace(/[^\d.]/g, '') }))}
                    placeholder="Marks"
                    keyboardType="numeric"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.marks_obtained}
                    onChangeText={v => setScanForm(p => ({ ...p, marks_obtained: v.replace(/[^\d]/g, '') }))}
                    placeholder="Marks Obtained (optional)"
                    keyboardType="numeric"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.grade}
                    onChangeText={v => setScanForm(p => ({ ...p, grade: v.toUpperCase() }))}
                    placeholder="Grade (optional)"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.remarks}
                    onChangeText={v => setScanForm(p => ({ ...p, remarks: v }))}
                    placeholder="Remarks (optional)"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={scanForm.ranking}
                    onChangeText={v => setScanForm(p => ({ ...p, ranking: v.replace(/[^\d]/g, '') }))}
                    placeholder="Rank (optional)"
                    keyboardType="numeric"
                    placeholderTextColor="#777"
                  />

                  <TouchableOpacity
                    style={[local.actionBtn, (saving || !canSave) && local.actionBtnDisabled]}
                    onPress={saveScannedMarks}
                    disabled={saving || !canSave}
                  >
                    <Ionicons name="send" size={16} color="#fff" style={local.actionIcon} />
                    <Text style={local.actionBtnText}>{saving ? 'Sending...' : 'Send'}</Text>
                  </TouchableOpacity>

                  <Text style={local.previewTitle}>Scanned Image</Text>
                  <View style={local.previewArea}>
                    {previewUri ? (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setShowModal(true)}>
                        <Image source={{ uri: previewUri }} style={local.preview} />
                      </TouchableOpacity>
                    ) : (
                      <Text style={local.previewPlaceholder}>No scan preview yet</Text>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <Text style={local.sectionTitle}>2) Pull Saved Marks</Text>
                  <TextInput
                    style={local.input}
                    value={filters.class_name}
                    onChangeText={v => setFilters(p => ({ ...p, class_name: v }))}
                    placeholder="Class (required)"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={filters.section}
                    onChangeText={v => setFilters(p => ({ ...p, section: v }))}
                    placeholder="Section (required)"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={filters.test_type}
                    onChangeText={v => setFilters(p => ({ ...p, test_type: v }))}
                    placeholder="Test type (required)"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={filters.subject}
                    onChangeText={v => setFilters(p => ({ ...p, subject: v }))}
                    placeholder="Subject (optional)"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={filters.name}
                    onChangeText={v => setFilters(p => ({ ...p, name: v }))}
                    placeholder="Student name (optional)"
                    placeholderTextColor="#777"
                  />
                  <TextInput
                    style={local.input}
                    value={filters.grade}
                    onChangeText={v => setFilters(p => ({ ...p, grade: v.toUpperCase() }))}
                    placeholder="Grade (optional)"
                    placeholderTextColor="#777"
                  />

                  <TouchableOpacity
                    style={[local.actionBtn, pulling && local.actionBtnDisabled]}
                    onPress={pullMarks}
                    disabled={pulling}
                  >
                    <Ionicons name="download" size={16} color="#fff" style={local.actionIcon} />
                    <Text style={local.actionBtnText}>{pulling ? 'Pulling...' : 'Pull Marks'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            {activeTab === 'pull' && (
              <View style={local.resultsArea}>
                {pulling ? (
                  <ActivityIndicator style={local.loader} />
                ) : (
                  <FlatList
                    data={rows}
                    keyExtractor={item => String(item.id ?? `${item.name}-${item.class_name}-${item.section}-${item.test_type}-${item.subject}`)}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <View style={local.rowItem}>
                        <Text style={local.rowTitle}>{item.name}</Text>
                        <Text style={local.rowText}>
                          {item.class_name} - {item.section} | {item.test_type}
                        </Text>
                        <Text style={local.rowText}>{item.subject} | Marks: {item.marks}</Text>
                        <Text style={local.rowText}>
                          Obtained: {item.marks_obtained ?? '-'} | Grade: {item.grade || '-'}
                        </Text>
                        <Text style={local.rowText}>
                          Rank: {item.ranking ?? '-'} | Remarks: {item.remarks || '-'}
                        </Text>
                      </View>
                    )}
                    ListEmptyComponent={<Text style={local.empty}>No records</Text>}
                  />
                )}
              </View>
            )}

           
          </View>
        </View>
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={local.modalOverlay}>
          <View style={local.modalCard}>
            <Text style={local.modalTitle}>Scanned Image</Text>
            <Image source={{ uri: previewUri }} style={local.modalImage} />
            <TouchableOpacity style={local.modalBtn} onPress={() => setShowModal(false)}>
              <Text style={local.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TeacherFooter />
    </SafeAreaView>
  );
};

const local = StyleSheet.create({
  mainCard: {
    height: SCREEN_HEIGHT * 0.65,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 40,
    marginBottom: 8,
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
  formScroll: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  formScrollScan: {
    maxHeight: SCREEN_HEIGHT * 0.58,
  },
  formScrollPull: {
    maxHeight: SCREEN_HEIGHT * 0.44,
  },
  formContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#f6f6f7',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    color: '#111',
  },
  actionBtn: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  actionIcon: {
    marginRight: 8,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    marginTop: 4,
    marginBottom: 8,
  },
  previewArea: {
    marginTop: 4,
    marginBottom: 8,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    resizeMode: 'cover',
    borderWidth: 1,
    borderColor: '#d8dde6',
  },
  previewPlaceholder: {
    textAlign: 'center',
    color: '#444',
    paddingVertical: 12,
  },
  resultsArea: {
    marginTop: 6,
    paddingHorizontal: 12,
    height: SCREEN_HEIGHT * 0.28,
    marginBottom: 60,
  },
  rowItem: {
    borderWidth: 1,
    borderColor: '#e2e6ee',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  rowTitle: {
    fontWeight: '700',
    color: '#111',
  },
  rowText: {
    color: '#333',
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: '#555',
    marginTop: 10,
  },
  loader: {
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginBottom: 12,
  },
  modalImage: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.55,
    borderRadius: 14,
    resizeMode: 'contain',
    backgroundColor: '#f4f6f8',
  },
  modalBtn: {
    marginTop: 14,
    alignSelf: 'flex-end',
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default HandwritingScanPull;
