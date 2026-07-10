import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  View,
  Modal,
  ActionSheetIOS,
} from 'react-native';
import axios from 'axios';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import ReactNativeBlobUtil from 'react-native-blob-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { globalStyles as styles } from '../teacherStyles';
import TeacherFooter from './TeacherFooter';
import TeacherSummaryCard from './TeacherSummaryCard';
import XLSX from 'xlsx';

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

type StudentRow = {
  id?: number | string;
  name: string;
  photoUrl?: string;
};

type AcademicReportItem = {
  subject: string;
  marks: string;
  marks_obtained: string;
};

type PerformanceRow = {
  name: string;
  totalMarks?: number;
  maxMarksBySubject?: Record<string, string | number>;
  [key: string]: string | number | Record<string, string | number> | undefined;
};

const API_BASE = 'http://162.215.210.38:3010';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CLASS_OPTIONS = Array.from({ length: 10 }, (_, i) => `${i + 1}`);
const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E'];
const EXCEL_MIME_TYPES = [types.xls, types.xlsx];
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME_TYPE = 'application/vnd.ms-excel';
const HIDDEN_SUBJECT_LABELS = new Set([
  'free',
  'free period',
  'break',
  'lunch',
  'recess',
  'teacher',
]);

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();
const isVisibleSubject = (subject: unknown) => {
  const normalized = normalizeText(subject);
  return normalized !== '' && !HIDDEN_SUBJECT_LABELS.has(normalized);
};

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
  const [_loadingCode, setLoadingCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'pull' | 'excel'>('pull');

  const [scanForm, setScanForm] = useState<ScanData>(emptyScan);
  const [previewUri, setPreviewUri] = useState('');

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [optionModal, setOptionModal] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    onSelect?: (value: string) => void;
  }>({
    visible: false,
    title: '',
    options: [],
  });
  const savedSignaturesRef = useRef<Set<string>>(new Set());

  const [filters, setFilters] = useState({
    class_name: '',
    section: '',
    test_type: '',
    subject: '',
    name: '',
    grade: '',
  });
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [academicReport, setAcademicReport] = useState<AcademicReportItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceRow[]>([]);
  const [isLoadDisabled, setIsLoadDisabled] = useState(false);
  const [isFetchDisabled, setIsFetchDisabled] = useState(false);
  const [academicModalVisible, setAcademicModalVisible] = useState(false);
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);
  const [isEditingReport, setIsEditingReport] = useState(false);
  
  const summaryCards = [
    {
      title: activeTab === 'scan' ? 'Scan' : activeTab === 'pull' ? 'Select' : 'Excel',
      subtitle: activeTab === 'scan' ? 'OCR entry' : activeTab === 'pull' ? 'Class & section' : 'Bulk upload',
      footer: activeTab === 'scan'
        ? (scanning ? 'Scanning now' : 'Ready to scan')
        : activeTab === 'pull'
          ? (isLoadDisabled || isFetchDisabled ? 'Loading records' : `${students.length} students`)
          : (isUploadingExcel ? 'Uploading file' : 'Ready to upload'),
      icon: activeTab === 'scan' ? 'scan-outline' : activeTab === 'pull' ? 'list-outline' : 'document-attach-outline',
      background: '#D7E7CD',
    },
    {
      title: activeTab === 'scan' ? 'Camera' : activeTab === 'pull' ? 'Filters' : 'Sheet',
      subtitle: activeTab === 'scan' ? 'Image input' : activeTab === 'pull' ? 'Search fields' : 'XLS/XLSX',
      footer: activeTab === 'scan'
        ? 'Gallery available too'
        : activeTab === 'pull'
          ? 'Class, section and test type'
          : (schoolCode ? `School ${schoolCode}` : 'School code needed'),
      icon: activeTab === 'scan' ? 'camera-outline' : activeTab === 'pull' ? 'funnel-outline' : 'cloud-upload-outline',
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

  const normalizeNumber = (value: unknown) =>
    value === null || value === undefined || String(value).trim() === '' ? null : Number(value);
  const normalizeExcelMimeType = (fileName?: string | null, mimeType?: string | null) => {
    if (mimeType) return mimeType;
    return String(fileName || '').toLowerCase().endsWith('.xls') ? XLS_MIME_TYPE : XLSX_MIME_TYPE;
  };
  const getExcelExtension = (fileName?: string | null, mimeType?: string | null) => {
    const lowerName = String(fileName || '').toLowerCase();
    if (lowerName.endsWith('.xls')) return 'xls';
    if (lowerName.endsWith('.xlsx')) return 'xlsx';
    return mimeType === XLS_MIME_TYPE ? 'xls' : 'xlsx';
  };
  const createSafeExcelFileName = (fileName?: string | null, mimeType?: string | null) =>
    `academic_marks_${Date.now()}.${getExcelExtension(fileName, mimeType)}`;
  const getFilePathFromUri = (uri: string) =>
    decodeURIComponent(uri.replace(/^file:\/\//, ''));
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

  const openOptionModal = (
    title: string,
    options: string[],
    onSelect: (value: string) => void,
  ) => {
    if (Platform.OS === 'ios') {
      const actionOptions = ['Cancel', ...options];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: actionOptions,
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          if (buttonIndex !== 0) {
            onSelect(actionOptions[buttonIndex]);
          }
        },
      );
      return;
    }

    setOptionModal({
      visible: true,
      title,
      options,
      onSelect,
    });
  };

  const closeOptionModal = () => {
    setOptionModal({
      visible: false,
      title: '',
      options: [],
    });
  };

  const selectOption = (value: string) => {
    optionModal.onSelect?.(value);
    closeOptionModal();
  };

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
          if (!asset) {
            Alert.alert('No image', 'Camera image is empty or unreadable');
            return;
          }
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
        if (!asset) {
          Alert.alert('No image', 'Selected image is empty or unreadable');
          return;
        }
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
            marks_obtained: scanForm.marks_obtained.trim() !== ''
              ? Number(scanForm.marks_obtained)
              : Number(scanForm.marks),
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

  const fetchSubjects = useCallback(async () => {
    if (!filters.class_name || !filters.section) return [];

    try {
      if (!schoolCode) {
        Alert.alert('Error', 'School Code not found. Please log in again.');
        return [];
      }

      const response = await fetch(
        `${API_BASE}/api/get_subjects?class=${filters.class_name}&section=${filters.section}&schoolCode=${schoolCode}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        Alert.alert('Error', errorText || 'Failed to fetch subjects.');
        return [];
      }

      const data = await response.json();
      const subjectList = (Array.isArray(data) ? data : [])
        .map(subject => String(subject).trim())
        .filter(isVisibleSubject);
      setAcademicReport(subjectList.map(subject => ({
        subject,
        marks: '',
        marks_obtained: '',
      })));
      return subjectList;
    } catch (error) {
      console.error('Error fetching subjects:', error);
      Alert.alert('Error', 'Failed to fetch subjects.');
      return [];
    }
  }, [filters.class_name, filters.section, schoolCode]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const fetchStudents = async () => {
    if (!filters.class_name || !filters.section) {
      Alert.alert('Error', 'Please select both class and section.');
      return;
    }

    try {
      if (!schoolCode) {
        Alert.alert('Error', 'School Code not found. Please log in again.');
        return;
      }

      const apiUrl = `${API_BASE}/api/get_students?class=${filters.class_name}&section=${filters.section}&schoolCode=${schoolCode}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        Alert.alert('Error', `Error: ${response.status} - ${errorText || response.statusText}`);
        return;
      }

      const data = await response.json();
      setStudents(Array.isArray(data?.students) ? data.students : []);
    } catch (error) {
      console.error('Fetch error:', error);
      Alert.alert('Error', 'Failed to fetch students.');
    }
  };

  const handleMarksChange = (index: number, value: string) => {
    const updatedReport = [...academicReport];
    updatedReport[index].marks = value.replace(/[^\d.]/g, '');
    setAcademicReport(updatedReport);
  };

  const handleMarksObtainedChange = (index: number, value: string) => {
    const updatedReport = [...academicReport];
    updatedReport[index].marks_obtained = value.replace(/[^\d.]/g, '');
    setAcademicReport(updatedReport);
  };

  const buildReportWithExistingMarks = (
    subjectList: string[],
    studentRecord?: PerformanceRow,
  ) => {
    const subjectNames = new Set(
      subjectList
        .map(subject => String(subject).trim())
        .filter(isVisibleSubject),
    );
    if (studentRecord) {
      Object.keys(studentRecord).forEach(key => {
        if (
          key !== 'name' &&
          key !== 'totalMarks' &&
          key !== 'maxMarksBySubject' &&
          isVisibleSubject(key)
        ) {
          subjectNames.add(key);
        }
      });
    }

    return Array.from(subjectNames).map(subject => {
      const existingObtainedMarks = studentRecord?.[subject];
      const existingMaxMarks = studentRecord?.maxMarksBySubject?.[subject];
      return {
        subject,
        marks:
          existingMaxMarks !== undefined && existingMaxMarks !== null
            ? String(existingMaxMarks)
            : '',
        marks_obtained:
          existingObtainedMarks !== undefined && existingObtainedMarks !== null
            ? String(existingObtainedMarks)
            : '',
      };
    });
  };

  const loadStudentMarksForEdit = async (studentName: string, subjectList: string[]) => {
    const className = filters.class_name;
    const section = filters.section;
    const testType = filters.test_type.trim();

    setIsEditingReport(false);
    setAcademicReport(buildReportWithExistingMarks(subjectList));

    if (!testType) {
      Alert.alert('Select Test Type', 'Please enter test type to retrieve existing marks.');
      return;
    }

    try {
      setIsLoadingMarks(true);
      const response = await axios.get(`${API_BASE}/api/academic_performance`, {
        params: {
          class_name: className,
          section,
          test_type: testType,
          schoolCode,
          _: Date.now(),
        },
        timeout: 30000,
      });

      const records = Array.isArray(response?.data?.records) ? response.data.records : [];
      const studentRecord = records.find(
        (record: PerformanceRow) => normalizeText(record.name) === normalizeText(studentName),
      );

      if (studentRecord) {
        setAcademicReport(buildReportWithExistingMarks(subjectList, studentRecord));
        setIsEditingReport(true);
      }
    } catch (error) {
      console.error('Error loading student marks:', error);
      Alert.alert('Error', 'Failed to retrieve existing marks.');
    } finally {
      setIsLoadingMarks(false);
    }
  };

  const refreshPerformanceData = async (
    className: string,
    section: string,
    testType: string,
    showEmptyAlert = true,
  ) => {
    if (!className || !section || !testType) {
      Alert.alert('Error', 'Please select class, section, and test type.');
      return;
    }

    try {
      if (!schoolCode) {
        Alert.alert('Error', 'School code not found. Please login again.');
        return;
      }

      const response = await axios.get(`${API_BASE}/api/academic_performance`, {
        params: {
          class_name: className,
          section,
          test_type: testType,
          schoolcode: schoolCode,
          schoolCode,
          _: Date.now(),
        },
        timeout: 30000,
      });

      const records = Array.isArray(response?.data?.records) ? response.data.records : [];
      if (records.length > 0) {
        const extractedSubjects = new Set<string>();
        records.forEach((record: PerformanceRow) => {
          Object.keys(record).forEach(key => {
            if (
              key !== 'name' &&
              key !== 'totalMarks' &&
              key !== 'maxMarksBySubject' &&
              isVisibleSubject(key)
            ) {
              extractedSubjects.add(key);
            }
          });
        });

        setPerformanceData(records);
        setSubjects(Array.from(extractedSubjects));
      } else {
        setPerformanceData([]);
        setSubjects([]);
        if (showEmptyAlert) {
          Alert.alert('No records', 'No records found for the selected criteria.');
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Error in fetching data. Please try again.');
    }
  };

  const submitReport = async () => {
    const filledAcademicReport = academicReport.filter(item => (
      String(item.marks ?? '').trim() !== '' ||
      String(item.marks_obtained ?? '').trim() !== ''
    ));
    const className = filters.class_name;
    const section = filters.section;
    const testType = filters.test_type.trim();

    if (!testType || !className || !section || !selectedStudent) {
      Alert.alert('Error', 'Please select student, class, section, and test type.');
      return;
    }

    if (filledAcademicReport.length === 0) {
      Alert.alert('Error', 'Please enter marks for at least one subject.');
      return;
    }

    const incompleteSubject = filledAcademicReport.find(item => (
      String(item.marks ?? '').trim() === '' ||
      String(item.marks_obtained ?? '').trim() === ''
    ));

    if (incompleteSubject) {
      Alert.alert('Error', `Please enter both marks and marks obtained for ${incompleteSubject.subject}.`);
      return;
    }

    try {
      if (!schoolCode) {
        Alert.alert('Error', 'School Code not found. Please log in again.');
        return;
      }

      const reportData = {
        name: selectedStudent,
        academic_report: filledAcademicReport,
        class_name: className,
        section,
        test_type: testType,
        schoolCode,
        replaceExisting: isEditingReport,
      };

      const response = await fetch(`${API_BASE}/api/save_academic_report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });

      if (response.ok) {
        Alert.alert('Success', isEditingReport ? 'Academic Report updated successfully!' : 'Academic Report submitted successfully!');
        setIsSubmitted(true);
        setAcademicModalVisible(false);
        setAcademicReport(prev => prev.map(item => ({ ...item, marks: '', marks_obtained: '' })));
        setIsEditingReport(false);
        await refreshPerformanceData(className, section, testType, false);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to submit report.');
      }
    } catch (error) {
      console.error('Error during submission:', error);
      Alert.alert('Error', 'Failed to submit report.');
    }
  };

  const openAcademicModal = async (studentName: string) => {
    setSelectedStudent(studentName);
    setIsSubmitted(false);
    setIsEditingReport(false);
    setAcademicModalVisible(true);
    const subjectList = await fetchSubjects();
    await loadStudentMarksForEdit(studentName, subjectList);
  };

  const fetchData = async (showEmptyAlert = true) => {
    const className = filters.class_name;
    const section = filters.section;
    const testType = filters.test_type.trim();

    await refreshPerformanceData(className, section, testType, showEmptyAlert);
  };

  const handleLoadStudents = async () => {
    if (isLoadDisabled) return;

    if (students.length > 0) {
      setStudents([]);
      setSearchText('');
      return;
    }

    setIsLoadDisabled(true);
    setIsFetchDisabled(true);
    try {
      await fetchStudents();
    } finally {
      setIsLoadDisabled(false);
      setIsFetchDisabled(false);
    }
  };

  const handleFetchData = async () => {
    if (isFetchDisabled) return;

    if (performanceData.length > 0 || subjects.length > 0) {
      setPerformanceData([]);
      setSubjects([]);
      return;
    }

    setIsFetchDisabled(true);
    setIsLoadDisabled(true);
    try {
      await fetchData();
    } finally {
      setIsFetchDisabled(false);
      setIsLoadDisabled(false);
    }
  };

  const renderTable = () => {
    if (subjects.length === 0 || performanceData.length === 0) {
      return <Text style={local.empty}>select proper class and section</Text>;
    }

    const sortedData = [...performanceData].sort(
      (a, b) => Number(b.totalMarks || 0) - Number(a.totalMarks || 0),
    );
    const topThreeIds = sortedData.slice(0, 3).map(item => item.name);

    return (
      <View style={local.table}>
        <View style={local.tableRow}>
          <Text style={[local.tableCell, local.headerCell]}>Name</Text>
          {subjects.map(subject => (
            <Text key={subject} style={[local.tableCell, local.headerCell]}>
              {subject}
            </Text>
          ))}
          <Text style={[local.tableCell, local.headerCell]}>Total Marks</Text>
        </View>
        {performanceData.map((item, rowIndex) => {
          let rowBackgroundColor = '#fff';
          if (topThreeIds.includes(item.name)) {
            const position = topThreeIds.indexOf(item.name);
            if (position === 0) rowBackgroundColor = '#d1e7ff';
            else if (position === 1) rowBackgroundColor = '#e2ebf9';
            else if (position === 2) rowBackgroundColor = '#f5f7fa';
          }

          return (
            <View
              key={`${item.name}-${rowIndex}`}
              style={[local.tableRow, { backgroundColor: rowBackgroundColor }]}
            >
              <Text style={local.tableCell}>{item.name}</Text>
              {subjects.map(subject => (
                <Text key={`${item.name}-${subject}`} style={local.tableCell}>
                  {item[subject] !== undefined && item[subject] !== null ? String(item[subject]) : '-'}
                </Text>
              ))}
              <Text style={local.tableCell}>{item.totalMarks ?? '-'}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const uploadExcel = async () => {
    const logPrefix = '[ScanPullExcel]';
    console.log(`${logPrefix} uploadExcel:start`, {
      hasSchoolCode: Boolean(schoolCode),
      schoolCode,
      endpoint: `${API_BASE}/upload-excel-academics`,
      platform: Platform.OS,
    });

    if (!schoolCode) {
      console.log(`${logPrefix} uploadExcel:blocked`, 'schoolCode missing');
      Alert.alert('Error', 'School code not available');
      return;
    }

    try {
      setIsUploadingExcel(true);
      console.log(`${logPrefix} picker:open`);

      const files = await pick({
        allowMultiSelection: false,
        type: EXCEL_MIME_TYPES,
      });

      console.log(`${logPrefix} picker:result`, {
        count: files?.length ?? 0,
        files,
      });

      if (!files || files.length === 0) {
        console.log(`${logPrefix} picker:empty`);
        return;
      }

const file = files[0];
const validExtensions = ['.xls', '.xlsx'];
const fileNameForValidation = (file.name || '').toLowerCase(); // <-- Renamed
const isValidExtension = validExtensions.some(ext => fileNameForValidation.endsWith(ext));

const validMimeTypes = [
  XLSX_MIME_TYPE,
  XLS_MIME_TYPE,
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];
const isValidMimeType = file.type ? validMimeTypes.includes(file.type.toLowerCase()) : false;

if (!isValidExtension && !isValidMimeType) {
  Alert.alert(
    'Invalid File',
    'Only Excel files (.xls or .xlsx) are allowed. Please select a valid Excel file.'
  );
  return;
}      
      let uploadUri = file.uri;
      const originalFileName = file.name || '';
      const fileName = createSafeExcelFileName(originalFileName, file.type);
      const fileType = normalizeExcelMimeType(fileName, file.type);

      console.log(`${logPrefix} file:selected`, {
        name: file.name,
        safeUploadName: fileName,
        type: file.type,
        normalizedType: fileType,
        uri: file.uri,
        size: file.size,
        isVirtual: file.isVirtual,
        convertibleToMimeTypes: file.convertibleToMimeTypes,
      });

      try {
        console.log(`${logPrefix} keepLocalCopy:start`, {
          uri: file.uri,
          fileName,
        });

        const copied = await keepLocalCopy({
          destination: 'cachesDirectory',
          files: [
            {
              uri: file.uri,
              fileName,
            },
          ],
        });

        console.log(`${logPrefix} keepLocalCopy:result`, copied);

        const copyResult = copied?.[0];
        if (copyResult?.status === 'success' && copyResult.localUri) {
          uploadUri = copyResult.localUri;
        }
      } catch (copyError) {
        console.log(`${logPrefix} keepLocalCopy:error`, copyError);
      }

      const finalUri = uploadUri.startsWith('/') ? `file://${uploadUri}` : uploadUri;
      console.log(`${logPrefix} uri:resolved`, {
        uploadUri,
        finalUri,
      });

      if (finalUri.startsWith('content://com.google.android.apps.docs.storage')) {
        console.log(`${logPrefix} uri:blocked-google-drive`, { finalUri });
        Alert.alert(
          'File Access Error',
          'Google Drive file could not be prepared for upload. Please download the Excel file to device storage and try again.',
        );
        return;
      }

      let uploadPath = finalUri.startsWith('file://') ? getFilePathFromUri(finalUri) : finalUri;
      if (finalUri.startsWith('file://')) {
        try {
          const fileExists = await RNFS.exists(uploadPath);
          const fileStat = fileExists ? await RNFS.stat(uploadPath) : null;
          console.log(`${logPrefix} localFile:check`, {
            localPath: uploadPath,
            exists: fileExists,
            size: fileStat?.size,
          });

          if (!fileExists) {
            throw new Error('Copied Excel file was not found on device cache.');
          }
        } catch (fileCheckError) {
          console.log(`${logPrefix} localFile:error`, fileCheckError);
          throw fileCheckError;
        }
      }

      console.log(`${logPrefix} multipart:create`, {
        uploadPath,
      });

      console.log(`${logPrefix} request:payload`, {
        url: `${API_BASE}/upload-excel-academics`,
        fileName,
        fileType,
        originalUri: file.uri,
        uploadUri: finalUri,
        uploadPath,
        schoolCode,
      });

      console.log(`${logPrefix} health:start`, {
        url: `${API_BASE}/api/health`,
      });
      try {
        const healthResponse = await fetch(`${API_BASE}/api/health`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });
        const healthText = await healthResponse.text();
        console.log(`${logPrefix} health:response`, {
          status: healthResponse.status,
          text: healthText,
        });

        if (!healthResponse.ok) {
          throw new Error(`Health check failed with status ${healthResponse.status}`);
        }
      } catch (healthError: any) {
        console.log(`${logPrefix} health:error`, {
          message: healthError?.message,
          name: healthError?.name,
          stack: healthError?.stack,
          apiBase: API_BASE,
        });
        throw new Error(`Backend is not reachable at ${API_BASE}. Start backend server on port 3010 or use a reachable API URL.`);
      }

      console.log(`${logPrefix} request:start`);
      const response = await ReactNativeBlobUtil.fetch(
        'POST',
        `${API_BASE}/upload-excel-academics`,
        {
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
        },
        [
          {
            name: 'file',
            filename: fileName,
            type: fileType,
            data: ReactNativeBlobUtil.wrap(uploadPath),
          },
          {
            name: 'schoolCode',
            data: schoolCode,
          },
        ],
      );
      const responseInfo = response.info();
      console.log(`${logPrefix} response:headers`, {
        status: responseInfo.status,
        headers: responseInfo.headers,
      });

      const responseText = await response.text();
      console.log(`${logPrefix} response:text`, responseText);

      let responseData: any = {};
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { message: responseText };
      }
      console.log(`${logPrefix} response:parsed`, responseData);

      if (responseInfo.status < 200 || responseInfo.status >= 300) {
        throw new Error(responseData?.message || `Upload failed with status ${responseInfo.status}`);
      }

if (responseData?.success) {
  console.log(`${logPrefix} uploadExcel:success`, responseData);
  
  const message = responseData.duplicatesSkipped > 0
    ? `Excel uploaded successfully. ${responseData.duplicatesSkipped} duplicate entries were skipped.`
    : 'Excel uploaded successfully';
  
  Alert.alert('Success', message);
} else {
  console.log(`${logPrefix} uploadExcel:server-failed`, responseData);
  Alert.alert('Error', responseData?.message || 'Upload failed');
}
    } catch (error: any) {
      console.log(`${logPrefix} uploadExcel:error`, {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
        responseData: error?.response?.data,
        responseStatus: error?.response?.status,
      });

      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        console.log(`${logPrefix} picker:cancelled`);
        return;
      }
      Alert.alert(
        'Upload Error',
        error?.response?.data?.message ||
          error?.message ||
          'Failed to upload file',
      );
    } finally {
      console.log(`${logPrefix} uploadExcel:finish`);
      setIsUploadingExcel(false);
    }
  };

  const renderSelectButton = (
    label: string,
    value: string,
    options: string[],
    onSelect: (value: string) => void,
  ) => (
    <TouchableOpacity
      style={local.selectField}
      onPress={() => openOptionModal(label, options, onSelect)}
    >
      <Text
        style={[local.selectFieldText, !value && local.selectFieldPlaceholder]}
        numberOfLines={1}
      >
        {value || label}
      </Text>
      <Ionicons name="chevron-down" size={18} color="#333" />
    </TouchableOpacity>
  );
const downloadExcelTemplate = async () => {
  try {
    const headers = [[
      'name',
      'class_name',
      'section',
      'test_type',
      'subject',
      'marks',
      'marks_obtained',
     
    ]];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);

    XLSX.utils.book_append_sheet(wb, ws, 'Academic Marks');

    const excelBase64 = XLSX.write(wb, {
      type: 'base64',
      bookType: 'xlsx',
    });

    const dirs = ReactNativeBlobUtil.fs.dirs;
    const pathToWrite =
      Platform.OS === 'ios'
        ? `${dirs.DocumentDir}/academic_marks_template.xlsx`
        : `${dirs.DownloadDir}/academic_marks_template.xlsx`;

    await ReactNativeBlobUtil.fs.writeFile(
      pathToWrite,
      excelBase64,
      'base64'
    );

    Alert.alert(
      'Success',
      `Template downloaded successfully.\n${pathToWrite}`
    );
  } catch (error) {
    console.log('Template download error:', error);
    Alert.alert('Error', 'Could not create template file');
  }
};

// Inside your component
const [classes, setClasses] = useState<string[]>([]);
const [sectionData, setSectionData] = useState<any[]>([]); // To filter sections based on class
const [availableSections, setAvailableSections] = useState<string[]>([]);

// Helper to normalize class names for consistent sorting/matching
const normalizeClassName = (item: any) =>
  String(item?.class_name || item?.class || item || '').trim();

// Fetch Class and Section Data on Mount
useEffect(() => {
  const fetchClassSection = async () => {
    try {
      const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
      if (!storedSchoolCode) return;

      // 1. Fetch Classes
      const classRes = await fetch(`https://cleezoclass.com:4000/api/admin/classes?schoolCode=${storedSchoolCode}`);
      const classData = await classRes.json();
      setClasses(classData || []);

      // 2. Fetch Section Filter Data
      const sectionRes = await fetch(`https://cleezoclass.com:4000/api/admin/sectionFilter?schoolCode=${storedSchoolCode}`);
      const sectionData = await sectionRes.json();
      setSectionData(sectionData);
    } catch (err) {
      console.error('Error fetching dropdowns:', err);
    }
  };
  fetchClassSection();
}, []);

// Update available sections whenever filters.class_name changes
useEffect(() => {
  if (filters.class_name) {
    const filtered = [...new Set(
      sectionData
        .filter((item: any) => normalizeClassName(item) === filters.class_name)
        .map((item: any) => String(item?.section || '').trim())
        .filter(Boolean)
    )].sort();
    setAvailableSections(filtered);
  } else {
    setAvailableSections([]);
  }
}, [filters.class_name, sectionData]);
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={local.pageScrollContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
           <LinearGradient
                                  pointerEvents="none"
                                  colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
                                  start={{ x: 0.05, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={local.dashboardTopGradient}
                                >
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
          </View></LinearGradient>
          <View style={[styles.syllabusContainer4]}>
            <View style={local.tabsContainer}>
              <TouchableOpacity
                style={[local.tabButton, activeTab === 'pull' && local.tabButtonActive]}
                onPress={() => setActiveTab('pull')}
              >
                <Ionicons name="list-outline" size={16} color="#111" />
                <Text style={local.tabButtonText}>Class & Section</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[local.tabButton, activeTab === 'excel' && local.tabButtonActive]}
                onPress={() => setActiveTab('excel')}
              >
                <Ionicons name="document-attach-outline" size={16} color="#111" />
                <Text style={local.tabButtonText}>Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[local.tabButton, activeTab === 'scan' && local.tabButtonActive]}
                onPress={() => setActiveTab('scan')}
              >
                <Ionicons name="scan-outline" size={16} color="#111" />
                <Text style={local.tabButtonText}>Scanning</Text>
              </TouchableOpacity>
            </View>

{activeTab === 'scan' && (
  <View style={[styles.buttonRow1, local.scanButtonRow]}>
    <TouchableOpacity
      style={styles.submitBtn1}
      onPress={scanFromCamera}
      disabled={scanning}
    >
      <Ionicons name="qr-code-outline" size={28} color="black" />
      {scanning && <Text style={styles.submitBtnText}>Scanning...</Text>}
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.submitBtn1}
      onPress={scanFromGallery}
      disabled={scanning}
    >
      <Ionicons name="camera-outline" size={28} color="black" />
    </TouchableOpacity>
  </View>
)}

            <ScrollView
              style={[
                local.formScroll,
                activeTab === 'scan' ? local.formScrollScan : local.formScrollPull,
              ]}
              contentContainerStyle={local.formContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'scan' ? (
                <>
                  <Text style={local.sectionTitle} />
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
              ) : activeTab === 'pull' ? (
                <>
                  <Text style={local.sectionTitle}>Academic Performance Entry</Text>
                 {renderSelectButton('Select Class', filters.class_name, classes, v => {
  setFilters(p => ({ ...p, class_name: v, section: '' })); // Reset section on class change
  setStudents([]);
  setPerformanceData([]);
  setSubjects([]);
})}{renderSelectButton('Select Section', filters.section, availableSections, v => {
  setFilters(p => ({ ...p, section: v }));
  setStudents([]);
  setPerformanceData([]);
  setSubjects([]);
})}
                  <TextInput
                    style={local.input}
                    value={filters.test_type}
                    onChangeText={v => {
                      setFilters(p => ({ ...p, test_type: v }));
                      setPerformanceData([]);
                      setSubjects([]);
                    }}
                    placeholder="Enter Test Type"
                    placeholderTextColor="#777"
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={local.input}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Search by student name"
                    placeholderTextColor="#777"
                  />

                  <View style={local.dualActionRow}>
                    <TouchableOpacity
                      style={[
                        local.actionBtn,
                        local.dualActionBtn,
                        (!filters.class_name || !filters.section || isLoadDisabled) && local.actionBtnDisabled,
                      ]}
                      onPress={handleLoadStudents}
                      disabled={!filters.class_name || !filters.section || isLoadDisabled}
                    >
                      <Ionicons name="people" size={16} color="#fff" style={local.actionIcon} />
                      <Text style={local.actionBtnText}>
                        {isLoadDisabled ? 'Loading...' : students.length > 0 ? 'Clear Students' : 'Load Students'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        local.actionBtn,
                        local.dualActionBtn,
                        (!filters.class_name || !filters.section || isFetchDisabled) && local.actionBtnDisabled,
                      ]}
                      onPress={handleFetchData}
                      disabled={!filters.class_name || !filters.section || isFetchDisabled}
                    >
                      <Ionicons name="bar-chart" size={16} color="#fff" style={local.actionIcon} />
                      <Text style={local.actionBtnText}>
                        {isFetchDisabled
                          ? 'Fetching...'
                          : performanceData.length > 0 || subjects.length > 0
                            ? 'Clear Data'
                            : 'Fetch Data'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal style={local.tableScroll}>
                    {renderTable()}
                  </ScrollView>

                  <FlatList
                    data={students.filter(student =>
                      String(student.name || '').toLowerCase().includes(searchText.toLowerCase()),
                    )}
                    keyExtractor={(item, index) => String(item.id ?? `${item.name}-${index}`)}
                    numColumns={4}
                    scrollEnabled={false}
                    contentContainerStyle={local.studentList}
                    ListEmptyComponent={<Text style={local.empty}>No students loaded</Text>}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={local.studentContainer}
                        onPress={() => openAcademicModal(item.name)}
                      >
                        <View style={local.studentIconBackground}>
                          {item.photoUrl ? (
                            <Image source={{ uri: item.photoUrl }} style={local.studentPhoto} />
                          ) : (
                            <Ionicons name="person" size={28} color="#111" />
                          )}
                        </View>
                        <Text style={local.studentName} numberOfLines={2}>
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              ) : (
<>
  <Text style={local.sectionTitle}>Excel Management</Text>

  <View style={local.excelCard}>
    <Ionicons name="document-text-outline" size={38} color="#111" />
    <Text style={local.excelTitle}>Academic Marks Sheet Format</Text>

    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ marginTop: 15 }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#f0f0f0' }}>
          {[
            'name',
            'class_name',
            'section',
            'test_type',
            'subject',
            'marks',
            'marks_obtained',
           
          ].map((header) => (
            <View
              key={header}
              style={{
                minWidth: 120,
                borderWidth: 1,
                borderColor: '#ddd',
                padding: 10,
              }}
            >
              <Text style={{ fontWeight: 'bold' }}>{header}</Text>
            </View>
          ))}
        </View>

        {/* Sample Empty Row */}
        <View style={{ flexDirection: 'row' }}>
          {Array(7)
            .fill('')
            .map((_, index) => (
              <View
                key={index}
                style={{
                  minWidth: 120,
                  borderWidth: 1,
                  borderColor: '#ddd',
                  padding: 10,
                }}
              >
                <Text>-</Text>
              </View>
            ))}
        </View>
      </View>
    </ScrollView>

    <View style={local.divider} />

    <TouchableOpacity
      style={[local.actionBtn, local.templateBtn]}
      onPress={downloadExcelTemplate}
    >
      <Ionicons
        name="download-outline"
        size={16}
        color="#111"
        style={local.actionIcon}
      />
      <Text style={local.templateBtnText}>Download Template</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        local.actionBtn,
        (isUploadingExcel || !schoolCode) &&
          local.actionBtnDisabled,
      ]}
      onPress={uploadExcel}
      disabled={isUploadingExcel || !schoolCode}
    >
      <Ionicons
        name="cloud-upload"
        size={16}
        color="#fff"
        style={local.actionIcon}
      />
      <Text style={local.actionBtnText}>
        {isUploadingExcel
          ? 'Uploading...'
          : 'Select & Upload Excel'}
      </Text>
    </TouchableOpacity>

    {isUploadingExcel && (
      <ActivityIndicator style={local.loader} />
    )}
  </View>
</>
              )}
            </ScrollView>

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

      <Modal
        transparent
        visible={academicModalVisible}
        animationType="fade"
        onRequestClose={() => setAcademicModalVisible(false)}
      >
        <View style={local.academicModalOverlay}>
          <View style={local.academicModalCard}>
            <TouchableOpacity
              style={local.closeButton}
              onPress={() => setAcademicModalVisible(false)}
            >
              <Text style={local.closeButtonText}>Close</Text>
            </TouchableOpacity>

            <Text style={local.modalTitle}>Academic Report for {selectedStudent}</Text>
            <Text style={local.modalSubtitle}>
              {isLoadingMarks
                ? 'Retrieving marks...'
                : isEditingReport
                  ? 'Existing marks loaded. Edit and update.'
                  : 'Enter marks for this test.'}
            </Text>

            <ScrollView contentContainerStyle={local.subjectList}>
              {academicReport.map((item, index) => (
                <View key={`${item.subject}-${index}`} style={local.subjectContainer}>
                  <Text style={local.subjectLabel}>{item.subject}</Text>
                  {!isSubmitted ? (
                    <View style={local.marksInputGroup}>
                      <TextInput
                        placeholder="Marks"
                        placeholderTextColor="#777"
                        value={item.marks}
                        onChangeText={value => handleMarksChange(index, value)}
                        keyboardType="numeric"
                        style={local.marksInput}
                      />
                      <TextInput
                        placeholder="Obtained"
                        placeholderTextColor="#777"
                        value={item.marks_obtained}
                        onChangeText={value => handleMarksObtainedChange(index, value)}
                        keyboardType="numeric"
                        style={local.marksInput}
                      />
                    </View>
                  ) : (
                    <Text style={local.marksValue}>{item.marks_obtained}/{item.marks}</Text>
                  )}
                </View>
              ))}
              {academicReport.length === 0 && (
                <Text style={local.empty}>
                  {isLoadingMarks ? 'Loading marks...' : 'No subjects found for selected class and section'}
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[local.submitReportButton, isLoadingMarks && local.actionBtnDisabled]}
              onPress={submitReport}
              disabled={isLoadingMarks}
            >
              <Text style={local.submitReportButtonText}>
                {isEditingReport ? 'Update Report' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={optionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeOptionModal}
      >
        <TouchableOpacity
          style={local.optionOverlay}
          activeOpacity={1}
          onPress={closeOptionModal}
        >
          <View style={local.optionCard}>
            <Text style={local.optionTitle}>{optionModal.title}</Text>
            {optionModal.options.map(option => (
              <TouchableOpacity
                key={option}
                style={local.optionItem}
                onPress={() => selectOption(option)}
              >
                <Text style={local.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <TeacherFooter />
    </SafeAreaView>
  );
};

const local = StyleSheet.create({
  pageScrollContent: {
    paddingBottom: 24,
  },
  scanButtonRow: {
    marginTop: '5%',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f6f6f7',
    borderRadius: 14,
    marginHorizontal: 10,
    marginBottom: 15,
    marginTop: 10,
    padding: 5,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#d7d7d7',
  },
  tabButtonText: {
    marginTop: 3,
    color: '#111',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  templateBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#111',
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  templateBtnText: {
    color: '#111',
    fontWeight: '700',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e6ee',
    width: '100%',
    marginVertical: 14,
  },
  dashboardTopGradient: {
    borderRadius: 0,
    paddingBottom: 8,
  },
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
    maxHeight: SCREEN_HEIGHT * 0.78,
  },
  formScrollPull: {
    maxHeight: SCREEN_HEIGHT * 0.78,
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
  selectField: {
    minHeight: 42,
    backgroundColor: '#f6f6f7',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectFieldText: {
    flex: 1,
    color: '#111',
    fontWeight: '600',
    marginRight: 8,
  },
  selectFieldPlaceholder: {
    color: '#777',
    fontWeight: '400',
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
  dualActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dualActionBtn: {
    flex: 1,
  },
  tableScroll: {
    marginTop: 4,
    marginBottom: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: '#d8dde6',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCell: {
    width: 110,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e4e7ec',
    color: '#111',
    fontSize: 12,
  },
  headerCell: {
    backgroundColor: '#eef2f7',
    fontWeight: '800',
  },
  studentList: {
    paddingTop: 8,
    paddingBottom: 14,
  },
  studentContainer: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  studentIconBackground: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e8eaee',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  studentPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  studentName: {
    color: '#111',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 5,
    minHeight: 28,
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
  excelCard: {
    borderWidth: 1,
    borderColor: '#e2e6ee',
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    alignItems: 'center',
  },
  excelTitle: {
    marginTop: 8,
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
  },
  excelText: {
    marginTop: 6,
    marginBottom: 14,
    color: '#333',
    fontSize: 13,
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
  modalSubtitle: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -6,
    marginBottom: 8,
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
  academicModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 18,
  },
  academicModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: SCREEN_HEIGHT * 0.78,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 5,
  },
  closeButtonText: {
    color: '#c1121f',
    fontWeight: '800',
  },
  subjectList: {
    paddingBottom: 8,
  },
  subjectContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 8,
  },
  subjectLabel: {
    color: '#111',
    fontSize: 14,
    fontWeight: '800',
    width: '34%',
    paddingTop: 9,
  },
  marksInputGroup: {
    width: '62%',
    flexDirection: 'row',
    gap: 8,
  },
  marksInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: '#d8dde6',
    borderRadius: 10,
    paddingHorizontal: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  marksValue: {
    width: '62%',
    color: '#111',
    fontWeight: '700',
    textAlign: 'right',
    paddingTop: 9,
  },
  submitReportButton: {
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: '#111',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  submitReportButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  optionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
  },
  optionTitle: {
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  optionText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default HandwritingScanPull;
