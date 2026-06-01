import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  pick as pickDocument,
  types as documentPickerTypes,
  keepLocalCopy,
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';
import { Asset, launchImageLibrary } from 'react-native-image-picker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import { createAppStyles } from '../App.styles';
import { stopPersistentAttendanceTracking } from './AttendanceService';

type IconKind = 'material' | 'fontawesome';

type RegisterFormData = {
  student_name: string;
  full_name: string;
  occupation: string;
  mobile_number: string;
  email_id: string;
  address: string;
  dob: string;
  lead_admission_for: string;
  interest_status: string;
  entry_type: 'manual' | 'automatic';
  refer_by: string;
};

type EnrollmentFormData = {
  first_name: string;
  last_name: string;
  father_name: string;
  mother_name: string;
  dob: string;
  blood_group: string;
  admission_for: string;
  branch: string;
  address: string;
};

type LeadSummary = {
  id: string | number;
  full_name?: string;
  student_name?: string;
  last_name?: string;
  mother_name?: string;
  dob?: string;
  blood_group?: string;
  branch?: string;
  address?: string;
  mobile_number?: string;
  email_id?: string;
  lead_admission_for?: string;
  reg_no?: string | number;
  ticket_no?: string | number;
  status?: string;
  enrolled?: string | boolean | number;
  admission_paid?: string | number;
  date?: string;
  lead_time?: string;
  entry_type?: string;
  channel?: string;
  channels?: string[];
  assigned_teacher_name?: string;
  assigned_teacher_id?: string | number;
  refer_by?: string;
  tc_document?: string;
  aadhar_document?: string;
  dob_document?: string;
  appeared_document?: string;
  father_id?: string;
  mother_id?: string;
  address_proof?: string;
};

type TeacherSummary = {
  teacher_id: string | number;
  teacher_name: string;
  phone_no?: string;
  subject?: string;
  designation?: string;
};

type CommunicationFormData = {
  lead_id: string;
  comm_date: string;
  comm_time: string;
  channels: string[];
  message: string;
};

type TestCounsellingFormData = {
  lead_id: string;
  teacher_id: string;
  test_date: string;
  test_time: string;
  test_mode: string;
  counselling_required: boolean;
  counselling_date: string;
  counselling_time: string;
};

type ReportType =
  | 'all'
  | 'staff'
  | 'digital'
  | 'automated'
  | 'followup'
  | 'registered'
  | 'timeline'
  | 'lead_profile'
  | 'enrolled';

type ReportRow = {
  id: string | number;
  full_name?: string;
  lead_name?: string;
  refer_by?: string;
  mobile_number?: string;
  email_id?: string;
  reg_no?: string | number;
  ticket_no?: string | number;
  lead_admission_for?: string;
  assigned_teacher_name?: string;
  assigned_teacher_id?: string | number;
  grade?: string;
  entry_type?: string;
  date?: string;
  lead_time?: string;
  time?: string;
  followup_day?: number;
  test_date?: string;
  test_time?: string;
  counselling_required?: string | boolean;
  counselling_date?: string;
  counselling_time?: string;
  status?: string;
  enrolled?: string | boolean | number;
  admission_paid?: string | number;
};

type EnrollmentDocumentKey =
  | 'tc_document'
  | 'father_id'
  | 'appeared_document'
  | 'mother_id'
  | 'dob_document'
  | 'address_proof'
  | 'aadhar_document';

type PickedFile = {
  uri: string;
  name: string;
  type: string;
};
type PickedFileWithMeta = PickedFile & {
  isVirtual?: boolean;
  convertibleToMimeTypes?: Array<{ mimeType: string }>;
};

type TeacherDashboardRouteParams = {
  TeacherDashboard?: {
    username?: string;
    name?: string;
  };
};

type TeacherProfile = {
  username: string;
  name: string;
  designation: string;
  schoolCode: string;
  userType: string;
  phoneNo: string;
  subject: string;
  teacherId: string;
  email: string;
};

type TeacherDashboardStackParamList = {
  TeacherLogin: undefined;
  TeacherDashboard: {
    username?: string;
    name?: string;
  } | undefined;
};

type SectionKey = 'admission' | 'enrollment' | 'communication' | 'test' | 'reports';
type DateFieldKey =
  | 'registerDob'
  | 'enrollmentDob'
  | 'communicationDate'
  | 'communicationFilterDate'
  | 'testDate'
  | 'counsellingDate';

const logoImage: ImageSourcePropType = require('../assets/Cleezo.png');
const heroImage: ImageSourcePropType = require('../assets/dashboard.png');
const backArrowImage: ImageSourcePropType = require('../assets/Arrow.png');

const topChips = ['Register', 'Admission', 'Enrollment', 'Communication', 'Test & Couns.', 'Reports'];
const defaultParentCommunicationMessage =
  'Dear Parent, admissions are now open at our school. Please contact the school office for admission details, eligibility, and enrollment support.';

const dashboardTiles = [
  { label: 'Register', icon: 'person-add', kind: 'material' as const, chipLabel: 'Register' },
  { label: 'Admission', icon: 'person', kind: 'material' as const, chipLabel: 'Admission' },
  { label: 'Test & Couns.', icon: 'groups', kind: 'material' as const, chipLabel: 'Test & Couns.' },
  { label: 'Enrollment', icon: 'school', kind: 'material' as const, chipLabel: 'Enrollment' },
  { label: 'Communication', icon: 'forum', kind: 'material' as const, chipLabel: 'Communication' },
  { label: 'Report', icon: 'description', kind: 'material' as const, chipLabel: 'Reports' },
];

type CampaignSendCounts = {
  whatsappRemaining: number;
  emailRemaining: number;
  totalRemaining: number;
  fromDate: string;
  toDate: string;
};

const createCampaignCards = (counts: CampaignSendCounts) => [
  {
    title: String(counts.whatsappRemaining),
    subtitle: 'WhatsApp sent',
    footer: counts.fromDate && counts.toDate ? 'Last 30 days' : 'Sent today',
    icon: 'whatsapp',
    kind: 'fontawesome' as const,
    background: '#D7E7CD',
  },
  {
    title: String(counts.emailRemaining),
    subtitle: 'Email sent',
    footer: counts.fromDate && counts.toDate ? 'Last 30 days' : 'Sent today',
    icon: 'envelope-o',
    kind: 'fontawesome' as const,
    background: '#F0EE96',
  },
];

const reportCards: Array<{ title: string; subtitle: string; reportType: ReportType; icon: string; kind: IconKind }> = [
  { title: 'Campaigning', subtitle: 'Staff Report', icon: 'groups', kind: 'material', reportType: 'staff' },
  { title: 'Campaigning', subtitle: 'Digital Report', icon: 'campaign', kind: 'material', reportType: 'digital' },
  { title: 'Campaigning', subtitle: 'Automated Report', icon: 'notifications', kind: 'material', reportType: 'automated' },
  { title: 'Follow-up', subtitle: 'Lead wise Report', icon: 'manage-search', kind: 'material', reportType: 'all' },
  { title: 'Admission', subtitle: 'Registered Report', icon: 'person-add', kind: 'material', reportType: 'registered' },
  { title: 'Timeline', subtitle: 'Communication Report', icon: 'schedule', kind: 'material', reportType: 'timeline' },
  { title: 'Admission', subtitle: 'Lead Profile Report', icon: 'badge', kind: 'material', reportType: 'lead_profile' },
  { title: 'Admission', subtitle: 'Enrolled Report', icon: 'verified-user', kind: 'material', reportType: 'enrolled' },
];
    
const interestStatusOptions = [
  'Interested',
  'Not Interested',
  'Partially Interested',
];

const formatDateCell = (value?: string) => (value ? String(value).split('T')[0] : '-');

const formatTimeCell = (value?: string) => {
  if (!value) return '-';
  const text = String(value).trim();
  return text.length > 8 ? text.slice(11, 19) || text.slice(0, 8) : text.slice(0, 8);
};

const hasValue = (value: unknown) => String(value ?? '').trim().length > 0;

const isTruthyStatus = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'paid', 'enrolled'].includes(normalized);
};

const normalizeCampaignStaffName = (value: unknown) =>
  String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeComparableText = (value: unknown) =>
  String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizePhone = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const isGenericCampaignReferBy = (value: unknown) => {
  const normalized = normalizeCampaignStaffName(value);
  return normalized === 'campaign' || normalized === 'campaigning';
};

const enrollmentDocumentLabels: Record<EnrollmentDocumentKey, string> = {
  tc_document: 'TC Document',
  father_id: 'Father ID',
  appeared_document: 'Apaar',
  mother_id: 'Mother ID',
  dob_document: 'DOB Document',
  address_proof: 'Address Proof',
  aadhar_document: 'Student Aadhar',
};

const renderIcon = (kind: IconKind, name: string, color: string, size: number) => {
  if (kind === 'fontawesome') {
    return <FontAwesome name={name} size={size} color={color} />;
  }

  return <MaterialIcons name={name} size={size} color={color} />;
};

const formatDatePickerValue = (date: Date) => date.toISOString().split('T')[0];

const DashboardScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<TeacherDashboardStackParamList>>();
  const route = useRoute<RouteProp<TeacherDashboardRouteParams, 'TeacherDashboard'>>();
  const [selectedChip, setSelectedChip] = useState('');
  const [showTeacherDetails, setShowTeacherDetails] = useState(false);
  const [showAccountSwitchOptions, setShowAccountSwitchOptions] = useState(false);
  const [parentProfileCache, setParentProfileCache] = useState<Record<string, any> | null>(null);
  const [sendCounts, setSendCounts] = useState<CampaignSendCounts>({
    whatsappRemaining: 0,
    emailRemaining: 0,
    totalRemaining: 0,
    fromDate: '',
    toDate: '',
  });
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>({
    username: '',
    name: '',
    designation: '',
    schoolCode: '',
    userType: '',
    phoneNo: '',
    subject: '',
    teacherId: '',
    email: '',
  });
  const [schoolLogo, setSchoolLogo] = useState('');
  const [storedDisplayName, setStoredDisplayName] = useState('');
  const [storedReferBy, setStoredReferBy] = useState('');
  const campaignCards = createCampaignCards(sendCounts);
  const [registerForm, setRegisterForm] = useState<RegisterFormData>({
    student_name: '',
    full_name: '',
    occupation: '',
    mobile_number: '',
    email_id: '',
    address: '',
    dob: '',
    lead_admission_for: '',
    interest_status: '',
    entry_type: 'manual',
    refer_by: '',
  });
  const [photo, setPhoto] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentFormData>({
    first_name: '',
    last_name: '',
    father_name: '',
    mother_name: '',
    dob: '',
    blood_group: '',
    admission_for: '',
    branch: '',
    address: '',
  });
  const [enrollmentDocs, setEnrollmentDocs] = useState<Record<EnrollmentDocumentKey, PickedFile | null>>({
    tc_document: null,
    father_id: null,
    appeared_document: null,
    mother_id: null,
    dob_document: null,
    address_proof: null,
    aadhar_document: null,
  });
  const [selectedEnrollmentLead, setSelectedEnrollmentLead] = useState<LeadSummary | null>(null);
  const [enrollmentLeadSearch, setEnrollmentLeadSearch] = useState('');
  const [communicationLeads, setCommunicationLeads] = useState<LeadSummary[]>([]);
  const [selectedCommunicationLead, setSelectedCommunicationLead] = useState<LeadSummary | null>(null);
  const [communicationDateFilter, setCommunicationDateFilter] = useState('');
  const [communicationLeadSearch, setCommunicationLeadSearch] = useState('');
  const [communicationForm, setCommunicationForm] = useState<CommunicationFormData>({
    lead_id: '',
    comm_date: new Date().toISOString().split('T')[0],
    comm_time: '10:00',
    channels: ['All'],
    message: defaultParentCommunicationMessage,
  });
  const [testLeads, setTestLeads] = useState<LeadSummary[]>([]);
  const [selectedTestLead, setSelectedTestLead] = useState<LeadSummary | null>(null);
  const [testLeadSearch, setTestLeadSearch] = useState('');
  const [availableTeachers, setAvailableTeachers] = useState<TeacherSummary[]>([]);
  const [testPanelTab, setTestPanelTab] = useState<'Test' | 'Counselling'>('Test');
  const [testForm, setTestForm] = useState<TestCounsellingFormData>({
    lead_id: '',
    teacher_id: '',
    test_date: new Date().toISOString().split('T')[0],
    test_time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date()
      .getMinutes()
      .toString()
      .padStart(2, '0')}`,
    test_mode: 'Offline',
    counselling_required: false,
    counselling_date: '',
    counselling_time: '',
  });
  const [referByOptions, setReferByOptions] = useState<string[]>([]);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState('Admission');
  const [popupMessage, setPopupMessage] = useState('');
  const [showLeadReportModal, setShowLeadReportModal] = useState(false);
  const [leadReportTitle, setLeadReportTitle] = useState('Lead Report');
  const [leadReportSubtitle, setLeadReportSubtitle] = useState('');
  const [leadReportRows, setLeadReportRows] = useState<LeadSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnrollmentSubmitting, setIsEnrollmentSubmitting] = useState(false);
  const [isCommunicationSubmitting, setIsCommunicationSubmitting] = useState(false);
  const [isTestSubmitting, setIsTestSubmitting] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [allLeadRows, setAllLeadRows] = useState<ReportRow[]>([]);
  const [activeReportType, setActiveReportType] = useState<ReportType>('digital');
  const [reportSearch, setReportSearch] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [showFooterNav, setShowFooterNav] = useState(false);
  const [activeDateField, setActiveDateField] = useState<DateFieldKey | null>(null);
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const registerFieldStyle: ViewStyle = {
    width: '30%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 50,
  };
  const enrollmentFieldStyle: ViewStyle = {
    width: '30%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 50,
  };
  const styles = createAppStyles({ phoneWidth, phoneHeight });
  const scrollRef = useRef<ScrollView>(null);
  const moduleSectionOffset = useRef(0);
  const pendingScrollSection = useRef<SectionKey | null>(null);
  const sectionOffsets = useRef<Record<SectionKey, number | null>>({
    admission: null,
    enrollment: null,
    communication: null,
    test: null,
    reports: null,
  });
  const currentModuleIndex = Math.max(0, topChips.indexOf(selectedChip));
  const [moduleOpen, setModuleOpen] = useState(true);
  const showAdmissionPanel = true;
  const showEnrollmentPanel = true;
  const showCommunicationPanel = true;
  const showTestPanel = true;
  const showReportPanel = true;
  const normalizedStoredReferBy = normalizeCampaignStaffName(storedReferBy || registerForm.refer_by);
  const myReferredLeads = communicationLeads.filter((lead) => {
    if (!normalizedStoredReferBy) return false;
    return normalizeCampaignStaffName(lead.refer_by) === normalizedStoredReferBy;
  });
  const normalizedTeacherName = normalizeCampaignStaffName(teacherProfile.name || storedDisplayName);
  const myAssignedTeacherLeads = allLeadRows.filter((row) => {
    if (!normalizedTeacherName) return false;
    return normalizeCampaignStaffName(row.assigned_teacher_name) === normalizedTeacherName;
  });
  const myAssignedTeacherEnrolled = allLeadRows.filter((row) => {
    const rowTeacherName = normalizeCampaignStaffName(row.assigned_teacher_name);
    const isTeacherMatch = !normalizedTeacherName || rowTeacherName === normalizedTeacherName;
    const isEnrolled =
      String(row.status || '').trim().toLowerCase() === 'enrolled' || isTruthyStatus(row.enrolled);
    return isTeacherMatch && isEnrolled;
  });
  const openLeadReportModal = (title: string, subtitle: string, rows: LeadSummary[]) => {
    setLeadReportTitle(title);
    setLeadReportSubtitle(subtitle);
    setLeadReportRows(rows);
    setShowLeadReportModal(true);
  };
  const registerLeadStats = {
    total: myReferredLeads.length,
    replied: myReferredLeads.filter((lead) => hasValue(lead.refer_by)).length,
    enrolled: allLeadRows.filter((row) => {
      const rowReferBy = normalizeCampaignStaffName(row.refer_by);
      const isMatchedReferBy = !normalizedStoredReferBy || rowReferBy === normalizedStoredReferBy;
      const isEnrolled =
        String(row.status || '').trim().toLowerCase() === 'enrolled' || isTruthyStatus(row.enrolled);

      return isMatchedReferBy && isEnrolled;
    }).length,
    admissions: myReferredLeads.filter((lead) => hasValue(lead.lead_admission_for)).length,
  };
  const testLeadStats = {
    assigned: myAssignedTeacherLeads.length,
    enrolled: myAssignedTeacherEnrolled.length,
  };
  const filteredEnrollmentLeads = communicationLeads.filter((lead) =>
    matchesLeadSearch(lead, enrollmentLeadSearch)
  );
  const filteredCommunicationLeads = communicationLeads
    .filter((lead) => {
      if (!communicationDateFilter) return true;
      return formatDateCell(lead.date || lead.test_date || lead.counselling_date) === communicationDateFilter;
    })
    .filter((lead) => matchesLeadSearch(lead, communicationLeadSearch));
  const filteredTestLeads = testLeads.filter((lead) => matchesLeadSearch(lead, testLeadSearch));
  const parsePickerDate = (value: string) => {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };
  const setDateFieldValue = (field: DateFieldKey, value: string) => {
    if (field === 'registerDob') {
      setRegisterForm((prev) => ({ ...prev, dob: value }));
      return;
    }
    if (field === 'enrollmentDob') {
      setEnrollmentForm((prev) => ({ ...prev, dob: value }));
      return;
    }
    if (field === 'communicationDate') {
      setCommunicationForm((prev) => ({ ...prev, comm_date: value }));
      return;
    }
    if (field === 'communicationFilterDate') {
      setCommunicationDateFilter(value);
      return;
    }
    if (field === 'testDate') {
      setTestForm((prev) => ({ ...prev, test_date: value }));
      return;
    }
    if (field === 'counsellingDate') {
      setTestForm((prev) => ({ ...prev, counselling_date: value }));
    }
  };
  const openDatePicker = (field: DateFieldKey) => {
    setActiveDateField(field);
  };
  function getSectionKeyForChip(chip: string): SectionKey | null {
    if (chip === 'Register' || chip === 'Admission') return 'admission';
    if (chip === 'Enrollment') return 'enrollment';
    if (chip === 'Communication') return 'communication';
    if (chip === 'Test & Couns.') return 'test';
    if (chip === 'Reports') return 'reports';
    return null;
  }
  const scrollToSection = (sectionKey: SectionKey, attempt = 0) => {
    pendingScrollSection.current = sectionKey;
    requestAnimationFrame(() => {
      const scrollNode = scrollRef.current;
      const targetY = sectionOffsets.current[sectionKey];

      if (!scrollNode || targetY == null) {
        if (attempt < 8) {
          setTimeout(() => scrollToSection(sectionKey, attempt + 1), 60);
        }
        return;
      }

      setTimeout(() => {
        requestAnimationFrame(() => {
          scrollNode.scrollTo({
            y: Math.max(0, moduleSectionOffset.current + targetY - 12),
            animated: true,
          });
          pendingScrollSection.current = null;
        });
      }, attempt === 0 ? 40 : 0);
    });
  };
  const openModule = (chip: string) => {
    console.log('[DashboardScroll] openModule', {
      chip,
      currentSelectedChip: selectedChip,
    });
    setSelectedChip(chip);
    setModuleOpen(true);
    const sectionKey = getSectionKeyForChip(chip);
    if (sectionKey) {
      scrollToSection(sectionKey);
    }
  };
  const closeModule = () => {
    console.log('[DashboardScroll] closeModule');
    setSelectedChip('');
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };
  const goToPreviousModule = () => {
    const previousIndex = currentModuleIndex > 0 ? currentModuleIndex - 1 : topChips.length - 1;
    openModule(topChips[previousIndex]);
  };
  const goToNextModule = () => {
    const nextIndex = currentModuleIndex < topChips.length - 1 ? currentModuleIndex + 1 : 0;
    openModule(topChips[nextIndex]);
  };

  const handleSectionLayout = (sectionKey: SectionKey) => (event: any) => {
    sectionOffsets.current[sectionKey] = event.nativeEvent.layout.y;
  };

  const renderDateField = (
    label: string,
    value: string,
    field: DateFieldKey,
    placeholder = 'YYYY-MM-DD',
    containerStyle?: any
  ) => (
    <View style={[styles.inputGroup, containerStyle]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Pressable style={styles.datePickerField} onPress={() => openDatePicker(field)}>
        <Text style={[styles.datePickerValue, !value && styles.datePickerPlaceholder]}>
          {value || placeholder}
        </Text>
        <MaterialIcons name="calendar-today" size={18} color="#5B5B60" />
      </Pressable>
    </View>
  );

  useEffect(() => {
    const loadTeacherProfile = async () => {
      try {
        const storedUserDetailsRaw = await AsyncStorage.getItem('userDetails');
        const storedUserDetails = storedUserDetailsRaw ? JSON.parse(storedUserDetailsRaw) : {};
        const storedUsername = await AsyncStorage.getItem('username');
        const storedName = await AsyncStorage.getItem('name');
        const storedDesignation = await AsyncStorage.getItem('designation');
        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
        const storedUserType = await AsyncStorage.getItem('userType');
        const params = route.params ?? {};
        const storedReferByValue = String(
          storedUserDetails.refer_by ||
            storedUserDetails.referBy ||
            storedUserDetails.referred_by ||
            storedUserDetails.ref_by ||
            ''
        ).trim();

        const nextTeacherProfile = {
          username:
            params.username ||
            storedUserDetails.username ||
            storedUserDetails.user_name ||
            storedUsername ||
            '',
          name:
            params.name ||
            storedUserDetails.name ||
            storedUserDetails.teacher_name ||
            storedName ||
            '',
          designation:
            storedUserDetails.designation ||
            storedDesignation ||
            storedUserDetails.role ||
            '',
          schoolCode: String(storedUserDetails.schoolCode || storedSchoolCode || ''),
          userType: String(storedUserDetails.userType || storedUserType || ''),
          phoneNo: String(
            storedUserDetails.phone_no ||
              storedUserDetails.phoneNo ||
              storedUserDetails.mobile_number ||
              storedUserDetails.contact_no ||
              ''
          ),
          subject: String(
            storedUserDetails.subject ||
              storedUserDetails.class_name ||
              storedUserDetails.department ||
              ''
          ),
          teacherId: String(storedUserDetails.teacher_id || storedUserDetails.id || ''),
          email: String(storedUserDetails.email_id || storedUserDetails.email || ''),
        };

        setTeacherProfile(nextTeacherProfile);
        await AsyncStorage.setItem('teacherProfile', JSON.stringify(nextTeacherProfile));
        setStoredDisplayName(params.name || storedUserDetails.name || storedUserDetails.teacher_name || storedName || '');
        setStoredReferBy(storedReferByValue || storedUserDetails.teacher_name || storedName || '');
        setRegisterForm((prev) =>
          prev.refer_by
            ? prev
            : {
                ...prev,
                refer_by: storedReferByValue || storedUserDetails.teacher_name || storedName || '',
              }
        );
      } catch (error) {
        console.error('Failed to load teacher profile:', error);
      }
    };

    loadTeacherProfile();
  }, [route.params]);

  useEffect(() => {
    const loadParentProfileCache = async () => {
      try {
        const cachedParentProfileRaw = await AsyncStorage.getItem('parentProfile');
        if (!cachedParentProfileRaw) {
          setParentProfileCache(null);
          return;
        }

        const cachedParentProfile = JSON.parse(cachedParentProfileRaw);
        setParentProfileCache(cachedParentProfile);
      } catch (error) {
        console.error('Failed to load cached parent profile:', error);
        setParentProfileCache(null);
      }
    };

    if (showTeacherDetails) {
      void loadParentProfileCache();
    }
  }, [showTeacherDetails]);

  useEffect(() => {
    const loadSchoolLogo = async () => {
      try {
        const cachedLogo = await AsyncStorage.getItem('schoolLogo');
        setSchoolLogo(cachedLogo || '');
      } catch (error) {
        console.error('Failed to load school logo:', error);
      }
    };

    loadSchoolLogo();
  }, []);

  useEffect(() => {
    const fetchSendCounts = async () => {
      try {
        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
        if (!storedSchoolCode) return;

        const response = await fetch(
          `https://cleezoclass.com:4000/api/frontdesk/send-counts?schoolCode=${encodeURIComponent(
            storedSchoolCode
          )}&days=30`
        );
        const data = await response.json();

        setSendCounts({
          whatsappRemaining: Number(data?.whatsappSentToday ?? data?.whatsappRemaining ?? 0),
          emailRemaining: Number(data?.emailSentToday ?? data?.emailRemaining ?? 0),
          totalRemaining: Number(data?.totalSentToday ?? data?.totalRemaining ?? 0),
          fromDate: String(data?.fromDate || ''),
          toDate: String(data?.date || ''),
        });
      } catch (error) {
        console.error('Failed to load campaign send counts:', error);
      }
    };

    fetchSendCounts();
  }, []);


  const switchToTeacherDashboard = async () => {
    try {
      setShowTeacherDetails(false);
      await AsyncStorage.setItem('lastScreen', 'TeacherDashboard');
      navigation.replace('TeacherDashboard', {
        username: teacherProfile.username || route.params?.username || '',
        name: teacherProfile.name || route.params?.name || '',
      });
    } catch (error) {
      console.error('Failed to switch to teacher dashboard:', error);
    }
  };

  const toggleAccountSwitchOptions = () => {
    setShowAccountSwitchOptions((current) => !current);
  };

  const canSwitchToParentAccount =
    Boolean(parentProfileCache) &&
    normalizeComparableText(teacherProfile.name) === normalizeComparableText(parentProfileCache?.father_name) &&
    normalizePhone(teacherProfile.phoneNo) ===
      normalizePhone(
        parentProfileCache?.phone_no ||
          parentProfileCache?.phoneNo ||
          parentProfileCache?.mobile_number ||
          parentProfileCache?.phone ||
          ''
      );

  const switchToParentAccount = async () => {
    try {
      if (!parentProfileCache) {
        Alert.alert('Unavailable', 'Parent account details were not found on this device.');
        return;
      }

      const username = String(parentProfileCache.username || '');
      const name = String(parentProfileCache.name || '');
      const schoolCode = String(parentProfileCache.schoolCode || '');

      await AsyncStorage.multiSet([
        ['username', username],
        ['name', name],
        ['schoolCode', schoolCode],
        ['userType', 'student'],
        ['userDetails', JSON.stringify(parentProfileCache)],
        ['currentStudent', JSON.stringify(parentProfileCache)],
        ['lastScreen', 'ParentDashboard'],
      ]);

      setShowTeacherDetails(false);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'ParentDashboard' as never,
            params: { username, name },
          },
        ],
      });
    } catch (error) {
      console.error('Failed to switch to parent account:', error);
      Alert.alert('Error', 'Failed to switch to parent account.');
    }
  };

  const handleGoBack = () => {
    setShowFooterNav(true);
    goToPreviousModule();
  };

  const handleOpenProfilePanel = () => {
    setShowAccountSwitchOptions(false);
    setShowTeacherDetails(true);
  };

  const handleOpenHomePanel = () => {
    setShowTeacherDetails(false);
    setShowFooterNav(false);
    setSelectedChip('');
    setModuleOpen(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  const handleLogout = async () => {
    try {
      setShowTeacherDetails(false);
      await stopPersistentAttendanceTracking();
      await AsyncStorage.multiRemove([
        'userType',
        'username',
        'name',
        'schoolCode',
        'designation',
        'lastScreen',
        'userDetails',
        'fcmToken',
      ]);

      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    } catch (error) {
      console.error('Logout failed:', error);
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    }
  };

  function matchesLeadSearch(lead: LeadSummary, query: string) {
    const normalizedQuery = normalizeComparableText(query);
    if (!normalizedQuery) return true;

    return [
      lead.full_name,
      lead.student_name,
      lead.mobile_number,
      lead.email_id,
      lead.lead_admission_for,
      lead.grade,
      lead.refer_by,
    ]
      .map(normalizeComparableText)
      .join(' ')
      .includes(normalizedQuery);
  }

  const getValidSchoolCode = async () => {
    const raw = String((await AsyncStorage.getItem('schoolCode')) || '').trim();
    if (!raw) return '';
    const lowered = raw.toLowerCase();
    if (lowered === 'null' || lowered === 'undefined') return '';
    return raw;
  };

  const handleRegisterField = (name: keyof RegisterFormData, value: string) => {
    let formattedValue = value;

    if (name === 'mobile_number') {
      formattedValue = value.replace(/\D/g, '').slice(0, 10);
    } else if (['full_name', 'student_name', 'occupation'].includes(name)) {
      const onlyLetters = value.replace(/[^a-zA-Z ]/g, '');
      formattedValue = onlyLetters.replace(/\b\w+/g, (word) => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      });
    } else if (name === 'email_id') {
      formattedValue = value.slice(0, 100);
    } else if (name === 'address') {
      formattedValue = value
        .split(' ')
        .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
        .join(' ');
    }

    setRegisterForm((prev) => ({ ...prev, [name]: formattedValue }));
  };

  const resetRegisterForm = () => {
    setRegisterForm({
      student_name: '',
      full_name: '',
      occupation: '',
      mobile_number: '',
      email_id: '',
      address: '',
      dob: '',
      lead_admission_for: '',
      interest_status: '',
      entry_type: 'manual',
      refer_by: '',
    });
    setPhoto(null);
  };

  const resetEnrollmentForm = () => {
    setEnrollmentForm({
      first_name: '',
      last_name: '',
      father_name: '',
      mother_name: '',
      dob: '',
      blood_group: '',
      admission_for: '',
      branch: '',
      address: '',
    });
    setEnrollmentDocs({
      tc_document: null,
      father_id: null,
      appeared_document: null,
      mother_id: null,
      dob_document: null,
      address_proof: null,
      aadhar_document: null,
    });
    setSelectedEnrollmentLead(null);
  };

  const resetCommunicationForm = () => {
    setCommunicationForm((prev) => ({
      ...prev,
      lead_id: '',
      message: defaultParentCommunicationMessage,
      channels: ['All'],
      comm_date: new Date().toISOString().split('T')[0],
      comm_time: '10:00',
    }));
    setSelectedCommunicationLead(null);
  };

  const resetTestForm = () => {
    const firstLead = testLeads[0];
    const firstTeacher = availableTeachers[0];
    setTestForm((prev) => ({
      ...prev,
      lead_id: firstLead ? String(firstLead.id) : '',
      teacher_id: firstTeacher ? String(firstTeacher.teacher_id) : '',
      test_date: new Date().toISOString().split('T')[0],
      test_time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date()
        .getMinutes()
        .toString()
        .padStart(2, '0')}`,
      test_mode: 'Offline',
      counselling_required: false,
      counselling_date: '',
      counselling_time: '',
    }));
    setSelectedTestLead(firstLead || null);
    setTestPanelTab('Test');
  };

  const applyEnrollmentLead = (lead: LeadSummary) => {
    console.log('[Dashboard] Selected enrollment lead:', {
      id: lead.id,
      keys: Object.keys(lead || {}),
      lead,
    });
    setSelectedEnrollmentLead(lead);
    setEnrollmentForm({
      first_name: lead.student_name || '',
      last_name: lead.last_name || '',
      father_name: lead.full_name || '',
      mother_name: lead.mother_name || '',
      dob: lead.dob ? String(lead.dob).split('T')[0] : '',
      blood_group: lead.blood_group || '',
      admission_for: lead.lead_admission_for || '',
      branch: lead.branch || '',
      address: lead.address || '',
    });
  };

  const applyCommunicationLead = (lead: LeadSummary) => {
    setSelectedCommunicationLead(lead);
    setCommunicationForm((prev) => ({ ...prev, lead_id: String(lead.id) }));
  };

  const applyTestLead = (lead: LeadSummary) => {
    setSelectedTestLead(lead);
    setTestForm((prev) => ({ ...prev, lead_id: String(lead.id) }));
  };

  const handlePhotoPick = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
      });

      if (response.didCancel) return;
      if (response.errorMessage) {
        Alert.alert('Image Picker', response.errorMessage);
        return;
      }

      const asset: Asset | undefined = response.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Image Picker', 'Could not load the selected image.');
        return;
      }

      setPhoto({
        uri: asset.uri,
        name: asset.fileName || `lead-photo-${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
      });
    } catch (error: any) {
      Alert.alert('Image Picker', error?.message || 'Unable to pick image');
    }
  };

  const handleEnrollmentDocumentPick = async (key: EnrollmentDocumentKey) => {
    try {
      const result = await pickDocument({
        type: [documentPickerTypes.allFiles],
      });
      const file = result?.[0];
      if (!file?.uri) {
        Alert.alert('Document Picker', 'Could not load the selected file.');
        return;
      }

      let uploadUri = file.uri;
      try {
        const sourceFile = file as PickedFileWithMeta;
        const convertVirtualFileToType =
          sourceFile.isVirtual && sourceFile.convertibleToMimeTypes?.length
            ? sourceFile.convertibleToMimeTypes.find((item) => item.mimeType === 'application/pdf')
                ?.mimeType || sourceFile.convertibleToMimeTypes[0].mimeType
            : undefined;

        const copied = await keepLocalCopy({
          destination: 'cachesDirectory',
          files: [
            {
              uri: file.uri,
              fileName: file.name || `${key}-${Date.now()}`,
              convertVirtualFileToType,
            },
          ],
        });

        const copyResult = copied?.[0];
        if (copyResult?.status === 'success' && copyResult.localUri) {
          uploadUri = copyResult.localUri;
        }
      } catch (copyError) {
        console.log('[Enrollment] keepLocalCopy failed:', copyError);
      }

      setEnrollmentDocs((prev) => ({
        ...prev,
        [key]: {
          uri: uploadUri.startsWith('/') ? `file://${uploadUri}` : uploadUri,
          name: file.name || `${key}-${Date.now()}`,
          type: file.type || 'application/octet-stream',
        },
      }));
    } catch (error: any) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Document Picker', error?.message || 'Unable to pick document');
    }
  };

  useEffect(() => {
    const loadReferByOptions = async () => {
      const schoolCode = await getValidSchoolCode();
      if (!schoolCode) return;

      try {
        const [usersRes, campaignStaffRes] = await Promise.all([
          fetch('https://cleezoclass.com:4000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schoolCode,
              user_type: 'teacher',
            }),
          }),
          fetch(
            `https://cleezoclass.com:4000/api/lead-staff?schoolCode=${encodeURIComponent(
              schoolCode
            )}`
          ),
        ]);

        const usersData = await usersRes.json();
        const campaignStaffData = await campaignStaffRes.json();
        const combinedStaff = [
          ...(Array.isArray(usersData) ? usersData : []),
          ...(Array.isArray(campaignStaffData)
            ? campaignStaffData
            : Array.isArray((campaignStaffData as any)?.leads)
              ? (campaignStaffData as any).leads
              : Array.isArray((campaignStaffData as any)?.data)
                ? (campaignStaffData as any).data
                : []),
        ];

        const options = Array.from(
          new Set(
            combinedStaff
              .map((item: any) =>
                String(
                  item?.teacher_name ??
                    item?.name ??
                    item?.full_name ??
                    item?.assigned_teacher_name ??
                    item?.refer_by ??
                    ''
                ).trim()
              )
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        setReferByOptions(options);
      } catch (error) {
        console.error('Failed to load refer-by options:', error);
        setReferByOptions([]);
      }
    };

    loadReferByOptions();
  }, []);

  useEffect(() => {
    const loadLeads = async () => {
      const schoolCode = await getValidSchoolCode();
      if (!schoolCode) return;

      try {
        setPanelLoading(true);
        const leadSources = [
          `https://cleezoclass.com:4000/api/api/leads?schoolCode=${encodeURIComponent(
            schoolCode
          )}`,
          `https://cleezoclass.com:4000/api/communication/leads?schoolCode=${encodeURIComponent(
            schoolCode
          )}`,
        ];

        let data: any = null;
        for (const source of leadSources) {
          const response = await fetch(source);
          if (!response.ok) continue;
          data = await response.json();
          if (data) break;
        }

        const leads = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.leads)
            ? (data as any).leads
            : Array.isArray((data as any)?.data)
              ? (data as any).data
              : [];

        console.log('[Dashboard] Enrollment lead payload:', {
          total: leads.length,
          sampleFields: leads.slice(0, 3).map((lead: any) => ({
            id: lead?.id,
            keys: Object.keys(lead || {}),
            full_name: lead?.full_name,
            student_name: lead?.student_name,
            mobile_number: lead?.mobile_number,
            lead_admission_for: lead?.lead_admission_for,
            grade: lead?.grade,
            date: lead?.date,
            lead_time: lead?.lead_time,
            test_date: lead?.test_date,
            test_time: lead?.test_time,
            counselling_date: lead?.counselling_date,
            counselling_time: lead?.counselling_time,
          })),
        });

        setCommunicationLeads(leads);
        setTestLeads(leads);

        const firstLead = leads[0];
        if (firstLead?.id !== undefined) {
          setCommunicationForm((prev) =>
            prev.lead_id ? prev : { ...prev, lead_id: String(firstLead.id) }
          );
          setTestForm((prev) => (prev.lead_id ? prev : { ...prev, lead_id: String(firstLead.id) }));
          setSelectedCommunicationLead((prev) => prev || firstLead);
          setSelectedTestLead((prev) => prev || firstLead);
          setSelectedEnrollmentLead((prev) => prev || firstLead);
          setEnrollmentForm((prev) =>
            prev.first_name || prev.father_name ? prev : {
              ...prev,
              first_name: firstLead.student_name || '',
              last_name: firstLead.last_name || '',
              father_name: firstLead.full_name || '',
              mother_name: firstLead.mother_name || '',
              dob: firstLead.dob ? String(firstLead.dob).split('T')[0] : '',
              blood_group: firstLead.blood_group || '',
              admission_for: firstLead.lead_admission_for || firstLead.grade || '',
              branch: firstLead.branch || '',
              address: firstLead.address || '',
            }
          );
        }
      } catch (error) {
        console.error('Failed to load communication leads:', error);
        setCommunicationLeads([]);
        setTestLeads([]);
      } finally {
        setPanelLoading(false);
      }
    };

    loadLeads();
  }, []);

  useEffect(() => {
    const loadTeachers = async () => {
      const schoolCode = await getValidSchoolCode();
      if (!schoolCode) return;
      if (!testForm.test_date || !testForm.test_time) return;

      try {
        setPanelLoading(true);
        const response = await fetch(
          `https://cleezoclass.com:4000/api/chief/available-teachers-marketing?schoolCode=${encodeURIComponent(
            schoolCode
          )}&date=${encodeURIComponent(testForm.test_date)}&time=${encodeURIComponent(
            testForm.test_time
          )}`
        );
        const data = await response.json();
        const rawTeachers = Array.isArray(data?.available_teachers)
          ? data.available_teachers
          : Array.isArray(data)
            ? data
            : [];

        const teachers = rawTeachers.map((teacher: any) => ({
          teacher_id: teacher?.teacher_id ?? teacher?.id ?? teacher?.user_id ?? '',
          teacher_name: teacher?.teacher_name || teacher?.name || teacher?.full_name || 'Teacher',
          subject: teacher?.subject || teacher?.designation || teacher?.phone_no || '',
          designation: teacher?.designation || '',
          phone_no: teacher?.phone_no || teacher?.mobile_number || '',
        }));

        setAvailableTeachers(teachers);
        const firstTeacher = teachers[0];
        if (firstTeacher?.teacher_id !== undefined) {
          setTestForm((prev) =>
            prev.teacher_id ? prev : { ...prev, teacher_id: String(firstTeacher.teacher_id) }
          );
        }
      } catch (error) {
        console.error('Failed to load available teachers:', error);
        setAvailableTeachers([]);
      } finally {
        setPanelLoading(false);
      }
    };

    loadTeachers();
  }, [showTestPanel, testForm.test_date, testForm.test_time]);

  useEffect(() => {
    const loadReports = async () => {
      const schoolCode = await getValidSchoolCode();
      if (!schoolCode) return;

      setReportLoading(true);
      setReportError('');

      const reportParams = [
        ['schoolCode', schoolCode],
        [
          'reportType',
          activeReportType === 'staff' || activeReportType === 'automated' ? 'all' : activeReportType,
        ],
        ['page', '1'],
        ['limit', '3000'],
        ['sortBy', 'date'],
        ['sortDir', 'DESC'],
      ];

      if (reportSearch.trim()) {
        reportParams.push(['search', reportSearch.trim()]);
      }

      const reportQuery = reportParams
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      fetch(`https://cleezoclass.com:4000/api/frontdesk/reports/leads?${reportQuery}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Failed to load report data');
          setReportRows(Array.isArray(data?.rows) ? data.rows : []);
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return;
          setReportRows([]);
          setReportError(error?.message || 'Failed to load report data');
        })
        .finally(() => setReportLoading(false));
    };

    loadReports();
  }, [showReportPanel, activeReportType, reportSearch]);

  useEffect(() => {
    const loadAllLeadRows = async () => {
      const schoolCode = await getValidSchoolCode();
      if (!schoolCode) return;

      try {
        const reportQuery = [
          ['schoolCode', schoolCode],
          ['reportType', 'all'],
          ['page', '1'],
          ['limit', '3000'],
          ['sortBy', 'date'],
          ['sortDir', 'DESC'],
        ]
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');

        const res = await fetch(`https://cleezoclass.com:4000/api/frontdesk/reports/leads?${reportQuery}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load all lead data');
        setAllLeadRows(Array.isArray(data?.rows) ? data.rows : []);
      } catch (error) {
        console.error('Failed to load all lead rows:', error);
        setAllLeadRows([]);
      }
    };

    loadAllLeadRows();
  }, []);

  const reportVisibleRows = reportRows.filter((row) => {
    if (activeReportType === 'staff') {
      const referByName = normalizeCampaignStaffName(row.refer_by);
      if (!referByName || isGenericCampaignReferBy(referByName)) return false;
      return hasValue(row.refer_by);
    }

    if (activeReportType === 'digital') {
      return isGenericCampaignReferBy(row.refer_by);
    }

    if (activeReportType === 'automated') {
      const isLeadNameEmpty = !hasValue(row.lead_name);
      const isRegNoEmpty = !hasValue(row.reg_no);
      const isTicketNoEmpty = !hasValue(row.ticket_no);
      return isLeadNameEmpty && isRegNoEmpty && isTicketNoEmpty;
    }

    if (activeReportType === 'timeline') {
      const hasTeacher = hasValue(row.assigned_teacher_name) || hasValue(row.assigned_teacher_id);
      const hasTestOrCounselling =
        hasValue(row.test_date) ||
        hasValue(row.test_time) ||
        hasValue(row.counselling_date) ||
        hasValue(row.counselling_time);
      return hasTeacher && hasTestOrCounselling;
    }

    if (activeReportType === 'enrolled') {
      const statusEnrolled = String(row.status || '').trim().toLowerCase() === 'enrolled';
      const enrolledStatus = isTruthyStatus(row.enrolled);
      const paidAdmission = Number(row.admission_paid || 0) > 0;
      return statusEnrolled || (enrolledStatus && paidAdmission);
    }

    if (activeReportType === 'registered') {
      const referByName = normalizeCampaignStaffName(row.refer_by);
      const isDigitalCampaignLead = isGenericCampaignReferBy(referByName);
      const isStaffCampaignLead = !!referByName && !isDigitalCampaignLead;
      return !isDigitalCampaignLead && !isStaffCampaignLead;
    }

    return true;
  });

  const reportTableColumns =
    activeReportType === 'timeline'
      ? ['ID', 'Name', 'Class', 'Mobile', 'Teacher', 'Test Date', 'Test Time', 'Counselling Date', 'Counselling Time']
      : activeReportType === 'enrolled'
        ? ['ID', 'Name', 'Class', 'Mobile', 'Reg No', 'Teacher', 'Enrolled', 'Admission Fee Paid']
        : [
            'ID',
            'Name',
            activeReportType === 'staff' ? 'Campaign Staff' : 'Lead Name',
            'Mobile',
            'Email',
            'Reg No',
            ...(activeReportType === 'digital' ? [] : [activeReportType === 'staff' ? 'Lead Name' : 'Teacher']),
            ...(activeReportType === 'digital' ? [] : ['Entry']),
            'Date',
            'Time',
          ];

  const isDuplicateLead = async (schoolCode: string) => {
    const res = await fetch('https://cleezoclass.com:4000/api/check-duplicate-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolCode,
        ...registerForm,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Unable to check duplicate lead');
    }

    return data;
  };

  const scheduleLeadMessages = async (schoolCode: string, data: any) => {
    if (!data?.email_id) return;

    const message = `Hi ${data.full_name}! 🎉\nYour child registration is successful.\n\nReg No: ${data.reg_no}\nTicket No: ${data.ticket_no}\n\n🔐 Parent Login: https://cleezoclass.com/CRM/ParentAdmissionLogin?schoolCode=${encodeURIComponent(
      schoolCode
    )}`;

    const schedule: Array<Record<string, string | number | string[]>> = [];
    const now = new Date();
    const immediateTime = new Date(now.getTime() + 60 * 1000);
    const immediateTimeStr = immediateTime.toTimeString().split(' ')[0];

    schedule.push({
      leadId: data.id,
      leadName: data.full_name,
      phone: data.mobile_number,
      email: data.email_id,
      date: now.toISOString().split('T')[0],
      time: immediateTimeStr,
      channels: ['Mail'],
      message,
      schoolCode,
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(10, 0, 0, 0);

    for (let i = 0; i < 29; i++) {
      const sendDate = new Date(startDate);
      sendDate.setDate(startDate.getDate() + i);

      schedule.push({
        leadId: data.id,
        leadName: data.full_name,
        phone: data.mobile_number,
        email: data.email_id,
        date: sendDate.toISOString().split('T')[0],
        time: '10:00:00',
        channels: ['Mail'],
        message,
        schoolCode,
      });
    }

    await fetch('https://cleezoclass.com:4000/api/schedule-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule, schoolCode }),
    });
  };

  const scheduleCommunicationMessages = async () => {
    const schoolCode = await getValidSchoolCode();
    if (!schoolCode) {
      setPopupTitle('Communication');
      setPopupMessage('School Code is missing. Please login again.');
      setShowPopup(true);
      return;
    }

    const lead = communicationLeads.find((item) => String(item.id) === communicationForm.lead_id);
    if (!lead) {
      setPopupTitle('Communication');
      setPopupMessage('Please choose a lead for communication.');
      setShowPopup(true);
      return;
    }

    if (!communicationForm.comm_date || !communicationForm.comm_time) {
      setPopupTitle('Communication');
      setPopupMessage('Please choose both communication date and time.');
      setShowPopup(true);
      return;
    }

    if (communicationForm.channels.length === 0) {
      setPopupTitle('Communication');
      setPopupMessage('Please choose at least one communication channel.');
      setShowPopup(true);
      return;
    }

    const startDate = new Date(`${communicationForm.comm_date}T${communicationForm.comm_time}:00`);
    const schedule = Array.from({ length: 30 }, (_, index) => {
      const sendDate = new Date(startDate);
      sendDate.setDate(startDate.getDate() + index);

      return {
        leadId: lead.id,
        leadName: lead.full_name || lead.student_name || '',
        phone: lead.mobile_number || '',
        email: lead.email_id || '',
        date: sendDate.toISOString().split('T')[0],
        time: sendDate.toTimeString().split(' ')[0],
        channels: communicationForm.channels,
        message: communicationForm.message || defaultParentCommunicationMessage,
        schoolCode,
      };
    });

    await fetch('https://cleezoclass.com:4000/api/schedule-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule, schoolCode }),
    });
  };

  const createEnrollmentLogin = async (schoolCode: string, leadId?: string | number | null) => {
    const response = await fetch('https://cleezoclass.com:4000/api/create-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: enrollmentForm.first_name,
        last_name: enrollmentForm.last_name,
        father_name: enrollmentForm.father_name,
        dob: enrollmentForm.dob,
        address: enrollmentForm.address,
        admission_for: enrollmentForm.admission_for,
        schoolCode,
        lead_id: leadId ?? null,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.message || 'Failed to create login for the enrolled student.');
    }
    return result;
  };

  const postEnrollmentForm = async (createForm: () => FormData) => {
    const enrollmentUrls = [
      'https://cleezoclass.com:4000/enrollment',
      'https://cleezoclass.com:4000/api/enrollment',
    ];

    let lastError: any = null;

    for (const url of enrollmentUrls) {
      try {
        const form = createForm();
        const response = await fetch(url, {
          method: 'POST',
          body: form,
        });

        const responseText = await response.text();
        let result: any = null;
        try {
          result = responseText ? JSON.parse(responseText) : null;
        } catch (parseError) {
          result = { message: responseText };
        }

        if (response.ok) {
          return result;
        }

        lastError = new Error(result?.message || `Enrollment request failed at ${url}`);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Unable to submit enrollment');
  };

  const submitEnrollment = async () => {
    const schoolCode = await getValidSchoolCode();
    if (!schoolCode) {
      setPopupTitle('Enrollment');
      setPopupMessage('School Code is missing. Please login again.');
      setShowPopup(true);
      return;
    }

    const missingFields: string[] = [];
    if (!enrollmentForm.first_name) missingFields.push('first name');
    if (!enrollmentForm.father_name) missingFields.push('father name');
    if (!enrollmentForm.dob) missingFields.push('date of birth');
    if (!enrollmentForm.admission_for) missingFields.push('admission for');
    if (!enrollmentForm.address) missingFields.push('address');

    if (missingFields.length > 0) {
      setPopupTitle('Enrollment');
      setPopupMessage(`Kindly fill ${missingFields.join(', ')} to proceed.`);
      setShowPopup(true);
      return;
    }

    setIsEnrollmentSubmitting(true);
    try {
      console.log('[Enrollment] submitting', {
        schoolCode,
        formKeys: Object.keys(enrollmentForm),
        docKeys: Object.entries(enrollmentDocs)
          .filter(([, file]) => Boolean(file))
          .map(([key]) => key),
      });

      const result = await postEnrollmentForm(() => {
        const nextForm = new FormData();
        Object.entries(enrollmentForm).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            nextForm.append(key, String(value));
          }
        });
        if (selectedEnrollmentLead?.id !== undefined && selectedEnrollmentLead?.id !== null) {
          nextForm.append('id', String(selectedEnrollmentLead.id));
          nextForm.append('lead_id', String(selectedEnrollmentLead.id));
        }
        (Object.entries(enrollmentDocs) as Array<[EnrollmentDocumentKey, PickedFile | null]>).forEach(
          ([key, file]) => {
            if (file) {
              nextForm.append(
                key,
                {
                  uri: file.uri,
                  name: file.name,
                  type: file.type,
                } as any
              );
            }
          }
        );
        nextForm.append('schoolCode', schoolCode);
        return nextForm;
      });

      try {
        await createEnrollmentLogin(schoolCode, selectedEnrollmentLead?.id ?? null);
      } catch (loginError: any) {
        console.error('Login creation failed:', loginError);
        throw loginError;
      }

      setPopupTitle('Enrollment');
      setPopupMessage('Enrollment submitted successfully.');
      setShowPopup(true);
      resetEnrollmentForm();
    } catch (error: any) {
      setPopupTitle('Enrollment');
      setPopupMessage(
        error?.message === 'Network request failed'
          ? 'Enrollment upload could not reach the server. Please check the selected documents and network connection.'
          : error?.message || 'Enrollment submission failed'
      );
      setShowPopup(true);
    } finally {
      setIsEnrollmentSubmitting(false);
    }
  };

  const submitCommunication = async () => {
    setIsCommunicationSubmitting(true);
    try {
      await scheduleCommunicationMessages();
      setPopupTitle('Communication');
      setPopupMessage('Communication has been scheduled for the next 30 days.');
      setShowPopup(true);
      resetCommunicationForm();
    } catch (error: any) {
      setPopupTitle('Communication');
      setPopupMessage(error?.message || 'Unable to schedule communication');
      setShowPopup(true);
    } finally {
      setIsCommunicationSubmitting(false);
    }
  };

  const submitTestCounselling = async () => {
    const schoolCode = await getValidSchoolCode();
    if (!schoolCode) {
      setPopupTitle('Test & Couns.');
      setPopupMessage('School Code is missing. Please login again.');
      setShowPopup(true);
      return;
    }

    const lead = testLeads.find((item) => String(item.id) === testForm.lead_id) || testLeads[0];
    const teacher =
      availableTeachers.find((item) => String(item.teacher_id) === testForm.teacher_id) ||
      availableTeachers[0];

    if (!lead || !teacher) {
      setPopupTitle('Test & Couns.');
      setPopupMessage('Please choose both a lead and a teacher.');
      setShowPopup(true);
      return;
    }

    if (testForm.counselling_required && (!testForm.counselling_date || !testForm.counselling_time)) {
      setPopupTitle('Test & Couns.');
      setPopupMessage('Please choose counselling date and time.');
      setShowPopup(true);
      return;
    }

    setIsTestSubmitting(true);
    try {
      const response = await fetch('https://cleezoclass.com:4000/api/api/add-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateType: 'ASSIGN_TEACHER',
          lead_id: lead.id,
          schoolCode,
          assigned_teacher_id: teacher.teacher_id,
          assigned_teacher_name: teacher.teacher_name,
          test_date: testForm.test_date,
          test_time: testForm.test_time,
          test_mode: testForm.test_mode,
          counselling_required: testForm.counselling_required ? 'Yes' : 'No',
          counselling_date: testForm.counselling_required ? testForm.counselling_date : null,
          counselling_time: testForm.counselling_required ? testForm.counselling_time : null,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || 'Unable to assign the teacher.');
      }

      setPopupTitle('Test & Couns.');
      setPopupMessage('Teacher assignment saved successfully.');
      setShowPopup(true);
      resetTestForm();
    } catch (error: any) {
      setPopupTitle('Test & Couns.');
      setPopupMessage(error?.message || 'Unable to assign the teacher.');
      setShowPopup(true);
    } finally {
      setIsTestSubmitting(false);
    }
  };

  const toggleCommunicationChannel = (channel: string) => {
    setCommunicationForm((prev) => {
      if (channel === 'All') {
        return {
          ...prev,
          channels: prev.channels.includes('All') ? [] : ['All'],
        };
      }

      const nextChannels = prev.channels.includes('All')
        ? prev.channels.filter((item) => item !== 'All').concat(channel)
        : prev.channels.includes(channel)
          ? prev.channels.filter((item) => item !== channel)
          : [...prev.channels, channel];

      return { ...prev, channels: nextChannels };
    });
  };

  const submitLead = async (allowDuplicate = false) => {
    const schoolCode = await getValidSchoolCode();
    if (!schoolCode) {
      setPopupTitle('Admission');
      setPopupMessage('School Code is missing. Please login again.');
      setShowPopup(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const dataToSend = new FormData();
      dataToSend.append('schoolCode', schoolCode);
      (Object.keys(registerForm) as Array<keyof RegisterFormData>).forEach((key) => {
        dataToSend.append(key, registerForm[key]);
      });
      dataToSend.append('allow_duplicate', allowDuplicate ? 'true' : 'false');
      dataToSend.append('test_type', '');
      dataToSend.append('test_date', '');
      dataToSend.append('counselling_required', '');
      dataToSend.append('counselling_date', '');
      dataToSend.append('counselling_time', '');

      if (photo) {
        dataToSend.append(
          'photo',
          {
            uri: photo.uri,
            name: photo.name,
            type: photo.type,
          } as any
        );
      }

      const res = await fetch('https://cleezoclass.com:4000/api/add-lead', {
        method: 'POST',
        body: dataToSend,
      });

      const data = await res.json();
      if (res.status === 409 && data?.duplicate && !allowDuplicate) {
        setPopupTitle('Duplicate Lead');
        setPopupMessage(
          data?.error || 'You already have submitted this lead. Do you want to submit it again?'
        );
        setShowPopup(true);
        setShowDuplicateConfirm(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Lead submission failed');
      }

      setPopupTitle('Admission');
      setPopupMessage('Lead submitted successfully!');
      setShowPopup(true);

      try {
        await scheduleLeadMessages(schoolCode, data);
      } catch (error) {
        console.error('Failed to schedule QR lead emails:', error);
      }

      resetRegisterForm();
    } catch (error: any) {
      setPopupTitle('Admission');
      setPopupMessage(error?.message || 'Lead submission failed');
      setShowPopup(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPress = async () => {
    const schoolCode = await getValidSchoolCode();
    if (!schoolCode) {
      setPopupTitle('Admission');
      setPopupMessage('School Code is missing. Please login again.');
      setShowPopup(true);
      return;
    }

    try {
      const duplicateResult = await isDuplicateLead(schoolCode);
      if (duplicateResult?.duplicate) {
        setPopupTitle('Duplicate Lead');
        setPopupMessage(
          duplicateResult?.error ||
            'You already have submitted this lead. Do you want to submit it again?'
        );
        setShowPopup(true);
        setShowDuplicateConfirm(true);
        return;
      }

      await submitLead(false);
    } catch (error: any) {
      setPopupTitle('Admission');
      setPopupMessage(error?.message || 'Unable to verify duplicate lead');
      setShowPopup(true);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0E0E0F" />

      <View style={styles.background}>
        <View style={styles.phoneShell}>
          <View style={styles.phoneFrame}>

        

            <View style={styles.toolbar}>
              <View style={styles.toolbarBrand}>
                <Image
                  source={schoolLogo ? { uri: schoolLogo } : logoImage}
                  style={styles.toolbarBrandLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.toolbarCenterAbsolute}>
                <Text style={styles.toolbarBrandName} numberOfLines={1}>
                  Welcome {teacherProfile.name || storedDisplayName || teacherProfile.username || 'Teacher'}
                </Text>
              </View>
              <View style={styles.toolbarSpacer} />
              
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              stickyHeaderIndices={[0]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(event) => {
                const scrollY = event.nativeEvent.contentOffset.y;
                if (scrollY > 8) {
                  setShowFooterNav(true);
                }
              }}
            >
              <View style={styles.chipStickyHeader}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {topChips.map((chip, index) => {
                    const active = selectedChip === chip;

                    return (
                      <Pressable
                        key={chip}
                        hitSlop={8}
                        onPress={() => openModule(chip)}
                        style={[
                          styles.chip,
                          index !== topChips.length - 1 && styles.chipSpacing,
                          active ? styles.chipActive : styles.chipInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active ? styles.chipTextActive : styles.chipTextInactive,
                          ]}
                        >
                          {chip}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.homeSection}>
                <View style={styles.heroCard}>
                  <View style={styles.heroGlow} />
                  <Image source={heroImage} style={styles.heroImage} resizeMode="contain" />
                </View>

                <Text style={styles.sectionTitle}>Dashboard</Text>

                <View style={styles.dashboardGrid}>
                  {dashboardTiles.map((tile) => (
                    <Pressable
                      key={tile.label}
                      hitSlop={8}
                      onPress={() => openModule(tile.chipLabel)}
                      style={styles.dashboardGridCardThree}
                    >
                      <View style={styles.dashboardTileIconWrap}>
                        {renderIcon(tile.kind, tile.icon, '#7F7F84', 26)}
                      </View>
                      <Text style={styles.dashboardTileLabel}>{tile.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sectionTitle}>Campaigning Status</Text>

                <View style={styles.statusCardsRow}>
                  {campaignCards.map((card, index) => (
                    <View
                      key={card.subtitle}
                      style={[
                        styles.statusCard,
                        index === 0 ? styles.statusCardLeft : styles.statusCardRight,
                        { backgroundColor: card.background },
                      ]}
                    >
                      <View style={styles.statusCardText}>
                        <View style={styles.statusTitleRow}>
                          <Text style={styles.statusNumber}>{card.title}</Text>
                          <Text style={styles.statusSubtitle}>{card.subtitle}</Text>
                        </View>
                        <Text style={styles.statusFooter}>{card.footer}</Text>
                      </View>

                      <View style={styles.statusIconWrap}>
                        {renderIcon(card.kind, card.icon, '#4C4C4C', 30)}
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {moduleOpen && (
                <View
                  style={styles.moduleSection}
                  onLayout={(event) => {
                    moduleSectionOffset.current = event.nativeEvent.layout.y;
                  }}
                >
                  

                    <View style={styles.sectionAnchor} onLayout={handleSectionLayout('admission')} />
                  {showAdmissionPanel && (
                    <View style={styles.registerPanel}>
                      <View style={styles.leadDetailsSection}>
                        <Text style={styles.leadDetailsTitle}>Lead Details</Text>

                        <View style={styles.leadStatsRow}>
                          <Pressable
                            style={[styles.leadStatCard, styles.leadStatCardGreen]}
                            onPress={() =>
                              openLeadReportModal(
                                'Lead Report',
                                storedReferBy || registerForm.refer_by || 'My Leads',
                                myReferredLeads
                              )
                            }
                          >
                            <View style={styles.leadStatTextBlock}>
                              <Text style={styles.leadStatNumber}>{registerLeadStats.total}</Text>
                              <Text style={styles.leadStatLabel}>Total Leads</Text>
                              <Text style={styles.leadStatFooter}>View Report</Text>
                            </View>
                            <View style={styles.leadStatIconWrap}>
                              {renderIcon('material', 'person-outline', '#111111', 30)}
                            </View>
                          </Pressable>

                          <Pressable
                            style={[styles.leadStatCard, styles.leadStatCardYellow]}
                            onPress={() => setShowLeadReportModal(true)}
                          >
                            <View style={styles.leadStatTextBlock}>
                              <Text style={styles.leadStatNumber}>{registerLeadStats.enrolled}</Text>
                              <Text style={styles.leadStatLabel}>Enrolled</Text>
                              <Text style={styles.leadStatFooter}>View Report</Text>
                            </View>
                            <View style={styles.leadStatIconWrap}>
                              {renderIcon('material', 'person-add', '#111111', 30)}
                            </View>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.registerHeader}>
                        <Text style={styles.registerTitle}>Register Lead</Text>
                      </View>

                      <View style={styles.registerBody}>
                        <View style={styles.formColumn}>
                          <View style={[styles.formRow, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
                            <View style={[styles.inputGroup, registerFieldStyle]}>
                              <Text style={styles.inputLabel}>Parent Name *</Text>
                              <TextInput
                                value={registerForm.full_name}
                                onChangeText={(value) => handleRegisterField('full_name', value)}
                                placeholder="Parent Name"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                            <View style={[styles.inputGroup, registerFieldStyle]}>
                              <Text style={styles.inputLabel}>Occupation</Text>
                              <TextInput
                                value={registerForm.occupation}
                                onChangeText={(value) => handleRegisterField('occupation', value)}
                                placeholder="Occupation"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          <View style={[styles.formRow, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
                            <View style={[styles.inputGroup, registerFieldStyle]}>
                              <Text style={styles.inputLabel}>Mobile Number *</Text>
                              <TextInput
                                value={registerForm.mobile_number}
                                onChangeText={(value) => handleRegisterField('mobile_number', value)}
                                placeholder="Mobile Number"
                                keyboardType="number-pad"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                            <View style={[styles.inputGroup, registerFieldStyle]}>
                              <Text style={styles.inputLabel}>E-Mail</Text>
                              <TextInput
                                value={registerForm.email_id}
                                onChangeText={(value) => handleRegisterField('email_id', value)}
                                placeholder="E-Mail"
                                keyboardType="email-address"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          <View style={styles.formRow}>
                            <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                              <Text style={styles.inputLabel}>Address *</Text>
                              <TextInput
                                value={registerForm.address}
                                onChangeText={(value) => handleRegisterField('address', value)}
                                placeholder="Address"
                                placeholderTextColor="#A0A0A0"
                                style={[styles.textInput, styles.multilineInput]}
                                multiline
                              />
                            </View>
                          </View>

                          <View style={[styles.formRow, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
                            <View style={[styles.inputGroup, registerFieldStyle]}>
                              <Text style={styles.inputLabel}>Student Name *</Text>
                              <TextInput
                                value={registerForm.student_name}
                                onChangeText={(value) => handleRegisterField('student_name', value)}
                                placeholder="Student Name"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                            <View style={[styles.inputGroup, registerFieldStyle]}>
                              <Text style={styles.inputLabel}>For Class *</Text>
                              <TextInput
                                value={registerForm.lead_admission_for}
                                onChangeText={(value) =>
                                  handleRegisterField('lead_admission_for', value)
                                }
                                placeholder="For Class"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          <View style={[styles.formRow, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
                            {renderDateField('DOB', registerForm.dob, 'registerDob', 'DOB', registerFieldStyle)}
                            <View style={[styles.inputGroup, registerFieldStyle]}>
                              <Text style={styles.inputLabel}>Referred By</Text>
                              <TextInput
                                value={registerForm.refer_by}
                                onChangeText={(value) => handleRegisterField('refer_by', value)}
                                placeholder="Referred By"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          {referByOptions.length > 0 && (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.pillRow}
                            >
                              {referByOptions.map((option) => {
                                const active =
                                  normalizeComparableText(registerForm.refer_by) ===
                                  normalizeComparableText(option);

                                return (
                                  <Pressable
                                    key={option}
                                    onPress={() => handleRegisterField('refer_by', option)}
                                    style={[styles.pill, active && styles.pillActive]}
                                  >
                                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                                      {option}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                          )}

                          <View style={styles.registerActions}>
                            <Pressable
                              style={[
                                styles.registerButton,
                                isSubmitting && styles.registerButtonDisabled,
                              ]}
                              onPress={handleSubmitPress}
                              disabled={isSubmitting}
                            >
                              {isSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                              ) : (
                                <Text style={styles.registerButtonText}>Register</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                    <View style={styles.sectionAnchor} onLayout={handleSectionLayout('enrollment')} />
                  {showEnrollmentPanel && (
                    <View style={styles.registerPanel}>
                      <View style={styles.registerHeader}>
                        <Text style={styles.registerTitle}>Enrollment Leads</Text>
                        <Text style={styles.registerSubtitle}>
                          Tap a lead below to load the enrollment form
                        </Text>
                      </View>

                      <View style={styles.leadDetailsSection}>
                        <View style={styles.leadStatsRow}>
                          <View style={[styles.leadStatCard, styles.leadStatCardGreen]}>
                            <View style={styles.leadStatTextBlock}>
                              <Text style={styles.leadStatNumber}>
                                {selectedEnrollmentLead?.lead_admission_for || '-'}
                              </Text>
                              <Text style={styles.leadStatLabel}>Total Leads</Text>
                              <Text style={styles.leadStatFooter}>Selected lead</Text>
                            </View>
                            <View style={styles.leadStatIconWrap}>
                              {renderIcon('material', 'school', '#111111', 30)}
                            </View>
                          </View>

                          <View style={[styles.leadStatCard, styles.leadStatCardYellow]}>
                            <View style={styles.leadStatTextBlock}>
                              <Text style={styles.leadStatNumber}>{registerLeadStats.total}</Text>
                              <Text style={styles.leadStatLabel}>My Leads</Text>
                              <Text style={styles.leadStatFooter}>Assigned leads</Text>
                            </View>
                            <View style={styles.leadStatIconWrap}>
                              {renderIcon('material', 'person', '#111111', 30)}
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.formRow}>
                        <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                          <Text style={styles.inputLabel}>Search Leads</Text>
                          <TextInput
                            value={enrollmentLeadSearch}
                            onChangeText={setEnrollmentLeadSearch}
                            placeholder="Search by name, mobile, class, admission"
                            placeholderTextColor="#A0A0A0"
                            style={styles.textInput}
                          />
                        </View>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.enrollmentLeadStrip}
                      >
                        {filteredEnrollmentLeads.length > 0 ? (
                          filteredEnrollmentLeads.map((lead, index) => {
                            const active = String(selectedEnrollmentLead?.id || '') === String(lead.id);

                            return (
                              <Pressable
                                key={`enrollment-${String(lead.id)}-${index}`}
                                onPress={() => applyEnrollmentLead(lead)}
                                style={[styles.leadCard, active && styles.leadCardActive]}
                              >
                                <Text style={[styles.leadCardTitle, active && styles.leadCardTitleActive]}>
                                  {lead.full_name || lead.student_name || `Lead ${lead.id}`}
                                </Text>
                                <Text style={[styles.leadCardMeta, active && styles.leadCardMetaActive]}>
                                  {lead.mobile_number || '-'}
                                </Text>
                                <Text style={[styles.leadCardMeta, active && styles.leadCardMetaActive]}>
                                  {lead.lead_admission_for || lead.grade || '-'}
                                </Text>
                              </Pressable>
                            );
                          })
                        ) : (
                          <Text style={styles.summaryText}>No leads available for enrollment.</Text>
                        )}
                      </ScrollView>

                      <View style={styles.registerBody}>
                        <View style={styles.formColumn}>
                          <View style={[styles.formRow, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
                            <View style={[styles.inputGroup, enrollmentFieldStyle]}>
                              <Text style={styles.inputLabel}>First Name *</Text>
                              <TextInput
                                value={enrollmentForm.first_name}
                                onChangeText={(value) =>
                                  setEnrollmentForm((prev) => ({ ...prev, first_name: value }))
                                }
                                placeholder="First name"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                            <View style={[styles.inputGroup, enrollmentFieldStyle]}>
                              <Text style={styles.inputLabel}>Last Name</Text>
                              <TextInput
                                value={enrollmentForm.last_name}
                                onChangeText={(value) =>
                                  setEnrollmentForm((prev) => ({ ...prev, last_name: value }))
                                }
                                placeholder="Last name"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          <View style={[styles.formRow, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
                            <View style={[styles.inputGroup, enrollmentFieldStyle]}>
                              <Text style={styles.inputLabel}>Father Name *</Text>
                              <TextInput
                                value={enrollmentForm.father_name}
                                onChangeText={(value) =>
                                  setEnrollmentForm((prev) => ({ ...prev, father_name: value }))
                                }
                                placeholder="Father name"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                            <View style={[styles.inputGroup, enrollmentFieldStyle]}>
                              <Text style={styles.inputLabel}>Mother Name</Text>
                              <TextInput
                                value={enrollmentForm.mother_name}
                                onChangeText={(value) =>
                                  setEnrollmentForm((prev) => ({ ...prev, mother_name: value }))
                                }
                                placeholder="Mother name"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          <View style={[styles.formRow, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
                            {renderDateField(
                              'Date Of Birth *',
                              enrollmentForm.dob,
                              'enrollmentDob',
                              'YYYY-MM-DD',
                              enrollmentFieldStyle
                            )}
                            <View style={[styles.inputGroup, enrollmentFieldStyle]}>
                              <Text style={styles.inputLabel}>Blood Group</Text>
                              <TextInput
                                value={enrollmentForm.blood_group}
                                onChangeText={(value) =>
                                  setEnrollmentForm((prev) => ({ ...prev, blood_group: value }))
                                }
                                placeholder="Blood group"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          <View style={[styles.formRow, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
                            <View style={[styles.inputGroup, enrollmentFieldStyle]}>
                              <Text style={styles.inputLabel}>Admission For *</Text>
                              <TextInput
                                value={enrollmentForm.admission_for}
                                onChangeText={(value) =>
                                  setEnrollmentForm((prev) => ({ ...prev, admission_for: value }))
                                }
                                placeholder="Admission for"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                            <View style={[styles.inputGroup, enrollmentFieldStyle]}>
                              <Text style={styles.inputLabel}>Branch</Text>
                              <TextInput
                                value={enrollmentForm.branch}
                                onChangeText={(value) =>
                                  setEnrollmentForm((prev) => ({ ...prev, branch: value }))
                                }
                                placeholder="Branch"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          <View style={styles.formRow}>
                            <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                              <Text style={styles.inputLabel}>Address *</Text>
                              <TextInput
                                value={enrollmentForm.address}
                                onChangeText={(value) =>
                                  setEnrollmentForm((prev) => ({ ...prev, address: value }))
                                }
                                placeholder="Enter address"
                                placeholderTextColor="#A0A0A0"
                                style={[styles.textInput, styles.multilineInput]}
                                multiline
                              />
                            </View>
                          </View>

                          <View style={styles.enrollmentDocsSection}>
                            <Text style={styles.enrollmentDocsTitle}>Supporting Documents</Text>
                            <View style={styles.enrollmentDocsGrid}>
                              {(Object.keys(enrollmentDocumentLabels) as EnrollmentDocumentKey[]).map(
                                (key) => {
                                  const pickedFile = enrollmentDocs[key];

                                  return (
                                    <Pressable
                                      key={key}
                                      onPress={() => handleEnrollmentDocumentPick(key)}
                                      style={styles.enrollmentDocButton}
                                    >
                                      <Text style={styles.enrollmentDocButtonLabel}>
                                        {enrollmentDocumentLabels[key]}
                                      </Text>
                                      <Text style={styles.enrollmentDocButtonHint}>
                                        {pickedFile ? pickedFile.name : 'Tap to attach'}
                                      </Text>
                                    </Pressable>
                                  );
                                }
                              )}
                            </View>
                          </View>

                          <View style={styles.registerActions}>
                            <Pressable
                              style={[
                                styles.registerButton,
                                isEnrollmentSubmitting && styles.registerButtonDisabled,
                              ]}
                              onPress={submitEnrollment}
                              disabled={isEnrollmentSubmitting}
                            >
                              {isEnrollmentSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                              ) : (
                                <Text style={styles.registerButtonText}>Submit Enrollment</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                    <View style={styles.sectionAnchor} onLayout={handleSectionLayout('communication')} />
                  {showCommunicationPanel && (
                    <View
                      style={styles.registerPanel}
                    >
                  <View style={styles.registerHeader}>
                    <Text style={styles.registerTitle}>Communication</Text>
                  
                  </View>

                  <View style={styles.communicationToolbar}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Date Filter</Text>
                      <Pressable
                        style={styles.datePickerField}
                        onPress={() => openDatePicker('communicationFilterDate')}
                      >
                        <Text
                          style={[
                            styles.datePickerValue,
                            !communicationDateFilter && styles.datePickerPlaceholder,
                          ]}
                        >
                          {communicationDateFilter || 'YYYY-MM-DD'}
                        </Text>
                        <MaterialIcons name="calendar-today" size={18} color="#5B5B60" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                      <Text style={styles.inputLabel}>Search Leads</Text>
                      <TextInput
                        value={communicationLeadSearch}
                        onChangeText={setCommunicationLeadSearch}
                        placeholder="Search by name, mobile, class, admission"
                        placeholderTextColor="#A0A0A0"
                        style={styles.textInput}
                      />
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timelineStrip}
                  >
                    {filteredCommunicationLeads.length > 0 ? (
                      filteredCommunicationLeads.map((lead, index) => {
                        const active = String(selectedCommunicationLead?.id || '') === String(lead.id);
                        return (
                          <Pressable
                            key={`communication-${String(lead.id)}-${index}`}
                            onPress={() => applyCommunicationLead(lead)}
                            style={[styles.timelineCard, active && styles.timelineCardActive]}
                          >
                            <Text
                              style={[styles.timelineCardDate, active && styles.timelineCardDateActive]}
                            >
                              {formatDateCell(lead.date || lead.test_date || lead.counselling_date)}
                            </Text>
                            <Text
                              style={[styles.timelineCardName, active && styles.timelineCardNameActive]}
                            >
                              {lead.full_name || lead.student_name || `Lead ${lead.id}`}
                            </Text>
                            <Text
                              style={[styles.timelineCardMeta, active && styles.timelineCardMetaActive]}
                            >
                              {lead.mobile_number || '-'}
                            </Text>
                            <Text
                              style={[styles.timelineCardMeta, active && styles.timelineCardMetaActive]}
                            >
                              {lead.lead_admission_for || lead.grade || '-'}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={styles.summaryText}>No leads match your search.</Text>
                    )}
                  </ScrollView>

                  <View style={styles.registerBody}>
                    <View style={styles.formColumn}>
                      <View style={styles.formRow}>
                        {renderDateField(
                          'Communication Date *',
                          communicationForm.comm_date,
                          'communicationDate'
                        )}
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Communication Time *</Text>
                          <TextInput
                            value={communicationForm.comm_time}
                            onChangeText={(value) =>
                              setCommunicationForm((prev) => ({ ...prev, comm_time: value }))
                            }
                            placeholder="HH:MM"
                            placeholderTextColor="#A0A0A0"
                            style={styles.textInput}
                          />
                        </View>
                      </View>

                      <View style={styles.formRow}>
                        <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                          <Text style={styles.inputLabel}>Lead *</Text>
                          <Text style={styles.summaryText}>
                            {selectedCommunicationLead?.full_name ||
                              selectedCommunicationLead?.student_name ||
                              'Select a lead from the timeline above'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.formRow}>
                        <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                          <Text style={styles.inputLabel}>Channels *</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.pillRow}
                          >
                            {['All', 'WhatsApp', 'Mail', 'SMS'].map((channel) => {
                              const active = communicationForm.channels.includes(channel);
                              return (
                                <Pressable
                                  key={channel}
                                  onPress={() => toggleCommunicationChannel(channel)}
                                  style={[styles.pill, active && styles.pillActive]}
                                >
                                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                                    {channel}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      </View>

                      <View style={styles.formRow}>
                        <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                          <Text style={styles.inputLabel}>Message *</Text>
                          <TextInput
                            value={communicationForm.message}
                            onChangeText={(value) =>
                              setCommunicationForm((prev) => ({ ...prev, message: value }))
                            }
                            placeholder="Your message"
                            placeholderTextColor="#A0A0A0"
                            style={[styles.textInput, styles.multilineInput]}
                            multiline
                          />
                        </View>
                      </View>

                      <View style={styles.registerActions}>
                        <Pressable
                          style={[
                            styles.registerButton,
                            isCommunicationSubmitting && styles.registerButtonDisabled,
                          ]}
                          onPress={submitCommunication}
                          disabled={isCommunicationSubmitting}
                        >
                          {isCommunicationSubmitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.registerButtonText}>Schedule Messages</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>

             
                  </View>
                    </View>
                  )}

                    <View style={styles.sectionAnchor} onLayout={handleSectionLayout('test')} />
                  {showTestPanel && (
                    <View style={styles.registerPanel}>
                      <View style={styles.registerHeader}>
                        <Text style={styles.registerTitle}>Test & Counselling</Text>
                        
                      </View>   

                      <View style={styles.leadDetailsSection}>
                       
                        <View style={styles.leadStatsRow}>
                          <View style={[styles.leadStatCard, styles.leadStatCardGreen]}>
                            <Pressable
                              style={styles.leadStatTextBlock}
                              onPress={() =>
                                openLeadReportModal(
                                  'Test & Counselling Report',
                                  teacherProfile.name || storedDisplayName || 'This teacher',
                                  myAssignedTeacherLeads
                                )
                              }
                            >
                              <Text style={styles.leadStatNumber}>{testLeadStats.assigned}</Text>
                              <Text style={styles.leadStatLabel}>Test & Couns.</Text>
                              <Text style={styles.leadStatFooter}>View Report</Text>
                            </Pressable>
                            <View style={styles.leadStatIconWrap}>
                              {renderIcon('material', 'person', '#111111', 30)}
                            </View>
                          </View>

                          <View style={[styles.leadStatCard, styles.leadStatCardYellow]}>
                            <Pressable
                              style={styles.leadStatTextBlock}
                              onPress={() =>
                                openLeadReportModal(
                                  'Test & Counselling Report',
                                  teacherProfile.name || storedDisplayName || 'This teacher',
                                  myAssignedTeacherEnrolled
                                )
                              }
                            >
                              <Text style={styles.leadStatNumber}>{testLeadStats.enrolled}</Text>
                              <Text style={styles.leadStatLabel}>Enrolled</Text>
                              <Text style={styles.leadStatFooter}>View Report</Text>
                            </Pressable>
                            <View style={styles.leadStatIconWrap}>
                              {renderIcon('material', 'verified-user', '#111111', 30)}
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.tabStrip}>
                        {(['Test', 'Counselling'] as const).map((tab) => {
                          const active = testPanelTab === tab;

                          return (
                            <Pressable
                              key={tab}
                              onPress={() => setTestPanelTab(tab)}
                              style={[styles.tabChip, active && styles.tabChipActive]}
                            >
                              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                                {tab}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <View style={styles.formRow}>
                        <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                          <Text style={styles.inputLabel}>Search Leads</Text>
                          <TextInput
                            value={testLeadSearch}
                            onChangeText={setTestLeadSearch}
                            placeholder="Search by name, mobile, class, admission"
                            placeholderTextColor="#A0A0A0"
                            style={styles.textInput}
                          />
                        </View>
                      </View>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineStrip}>
                        {filteredTestLeads.length > 0 ? (
                          filteredTestLeads.map((lead, index) => {
                            const active = String(selectedTestLead?.id || '') === String(lead.id);

                            return (
                              <Pressable
                                key={`test-${String(lead.id)}-${index}`}
                                onPress={() => applyTestLead(lead)}
                                style={[styles.timelineCard, active && styles.timelineCardActive]}
                              >
                                <Text style={[styles.timelineCardName, active && styles.timelineCardNameActive]}>
                                  {lead.full_name || lead.student_name || `Lead ${lead.id}`}
                                </Text>
                                <Text style={[styles.timelineCardMeta, active && styles.timelineCardMetaActive]}>
                                  {lead.mobile_number || '-'}
                                </Text>
                                <Text style={[styles.timelineCardMeta, active && styles.timelineCardMetaActive]}>
                                  {lead.lead_admission_for || lead.grade || '-'}
                                </Text>
                              </Pressable>
                            );
                          })
                        ) : (
                          <Text style={styles.summaryText}>No leads match your search.</Text>
                        )}
                      </ScrollView>

                      <View style={styles.registerBody}>
                        <View style={styles.formColumn}>
                          <View style={styles.formRow}>
                            {renderDateField('Test Date *', testForm.test_date, 'testDate')}
                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Test Time *</Text>
                              <TextInput
                                value={testForm.test_time}
                                onChangeText={(value) =>
                                  setTestForm((prev) => ({ ...prev, test_time: value }))
                                }
                                placeholder="HH:MM"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                          </View>

                          <View style={styles.formRow}>
                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Lead *</Text>
                              <Text style={styles.summaryText}>
                                {selectedTestLead?.full_name ||
                                  selectedTestLead?.student_name ||
                                  'Select a lead from the strip above'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.formRow}>
                            <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                              <Text style={styles.inputLabel}>Teacher *</Text>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.timelineStrip}
                              >
                                {availableTeachers.map((teacher) => {
                                  const active = String(teacher.teacher_id) === testForm.teacher_id;

                                  return (
                                    <Pressable
                                      key={`teacher-${String(teacher.teacher_id)}-${teacher.teacher_name}`}
                                      onPress={() =>
                                        setTestForm((prev) => ({
                                          ...prev,
                                          teacher_id: String(teacher.teacher_id),
                                        }))
                                      }
                                      style={[styles.teacherCard, active && styles.teacherCardActive]}
                                    >
                                      <View style={styles.teacherCardIconWrap}>
                                        {renderIcon(
                                          'material',
                                          'person',
                                          active ? '#FFFFFF' : '#2B2B2B',
                                          18
                                        )}
                                      </View>
                                      <Text
                                        style={[styles.teacherCardName, active && styles.teacherCardNameActive]}
                                      >
                                        {teacher.teacher_name}
                                      </Text>
                                      <Text
                                        style={[styles.teacherCardMeta, active && styles.teacherCardMetaActive]}
                                      >
                                        {teacher.subject || teacher.designation || teacher.phone_no || '-'}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </ScrollView>
                            </View>
                          </View>

                          <View style={styles.formRow}>
                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Test Mode</Text>
                              <TextInput
                                value={testForm.test_mode}
                                onChangeText={(value) =>
                                  setTestForm((prev) => ({ ...prev, test_mode: value }))
                                }
                                placeholder="Offline / Online"
                                placeholderTextColor="#A0A0A0"
                                style={styles.textInput}
                              />
                            </View>
                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Counselling Required</Text>
                              <Pressable
                                onPress={() =>
                                  setTestForm((prev) => ({
                                    ...prev,
                                    counselling_required: !prev.counselling_required,
                                  }))
                                }
                                style={[
                                  styles.pill,
                                  testForm.counselling_required && styles.pillActive,
                                  styles.counsellingToggle,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.pillText,
                                    testForm.counselling_required && styles.pillTextActive,
                                  ]}
                                >
                                  {testForm.counselling_required ? 'Yes' : 'No'}
                                </Text>
                              </Pressable>
                            </View>
                          </View>

                          {testForm.counselling_required && (
                            <View style={styles.formRow}>
                              {renderDateField('Counselling Date *', testForm.counselling_date, 'counsellingDate')}
                              <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Counselling Time *</Text>
                                <TextInput
                                  value={testForm.counselling_time}
                                  onChangeText={(value) =>
                                    setTestForm((prev) => ({ ...prev, counselling_time: value }))
                                  }
                                  placeholder="HH:MM"
                                  placeholderTextColor="#A0A0A0"
                                  style={styles.textInput}
                                />
                              </View>
                            </View>
                          )}

                          <View style={styles.registerActions}>
                            <Pressable
                              style={[styles.registerButton, isTestSubmitting && styles.registerButtonDisabled]}
                              onPress={submitTestCounselling}
                              disabled={isTestSubmitting}
                            >
                              {isTestSubmitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                              ) : (
                                <Text style={styles.registerButtonText}>Save Assignment</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                    <View style={styles.sectionAnchor} onLayout={handleSectionLayout('reports')} />
                  {showReportPanel && (
                    <View
                      style={styles.registerPanel}
                    >
                  <View style={styles.registerHeader}>
                    <Text style={styles.registerTitle}>Reports</Text>
                   
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.reportCardRow}
                  >
                    {reportCards.map((card) => {
                      const active = activeReportType === card.reportType;
                      return (
                        <Pressable
                          key={`${card.title}-${card.subtitle}`}
                          onPress={() => setActiveReportType(card.reportType)}
                          style={[styles.reportMiniCard, active && styles.reportMiniCardActive]}
                        >
                          <View style={styles.reportMiniIconWrap}>
                            {renderIcon(card.kind, card.icon, active ? '#FFFFFF' : '#5A5A5A', 22)}
                          </View>
                          <Text style={[styles.reportMiniTitle, active && styles.reportMiniTitleActive]}>
                            {card.title}
                          </Text>
                          <Text
                            style={[
                              styles.reportMiniSubtitle,
                              active && styles.reportMiniSubtitleActive,
                            ]}
                          >
                            {card.subtitle}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.formRow}>
                    <View style={[styles.inputGroup, styles.fullWidthGroup]}>
                      <Text style={styles.inputLabel}>Search</Text>
                      <TextInput
                        value={reportSearch}
                        onChangeText={setReportSearch}
                        placeholder="Search name / mobile / email / lead name"
                        placeholderTextColor="#A0A0A0"
                        style={styles.textInput}
                      />
                    </View>
                  </View>

                  {reportLoading && <Text style={styles.summaryText}>Loading report data...</Text>}
                  {!reportLoading && reportError ? (
                    <Text style={styles.summaryText}>{reportError}</Text>
                  ) : null}
                  {!reportLoading && !reportError && reportVisibleRows.length === 0 ? (
                    <Text style={styles.summaryText}>No data found.</Text>
                  ) : null}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.reportTable}>
                      <View style={styles.reportTableHeader}>
                        {reportTableColumns.map((column) => (
                          <Text key={column} style={styles.reportTableHeaderCell}>
                            {column}
                          </Text>
                        ))}
                      </View>

                      {reportVisibleRows.map((row, index) => (
                        <View key={`report-${String(row.id)}-${index}`} style={styles.reportTableRow}>
                          {activeReportType === 'timeline' ? (
                            <>
                              <Text style={styles.reportTableCell}>{row.id}</Text>
                              <Text style={styles.reportTableCell}>{row.full_name || '-'}</Text>
                              <Text style={styles.reportTableCell}>{row.lead_admission_for || '-'}</Text>
                              <Text style={styles.reportTableCell}>{row.mobile_number || '-'}</Text>
                              <Text style={styles.reportTableCell}>
                                {row.assigned_teacher_name || '-'}
                              </Text>
                              <Text style={styles.reportTableCell}>{formatDateCell(row.test_date)}</Text>
                              <Text style={styles.reportTableCell}>{formatTimeCell(row.test_time)}</Text>
                              <Text style={styles.reportTableCell}>{formatDateCell(row.counselling_date)}</Text>
                              <Text style={styles.reportTableCell}>{formatTimeCell(row.counselling_time)}</Text>
                            </>
                          ) : activeReportType === 'enrolled' ? (
                            <>
                              <Text style={styles.reportTableCell}>{row.id}</Text>
                              <Text style={styles.reportTableCell}>{row.full_name || '-'}</Text>
                              <Text style={styles.reportTableCell}>{row.lead_admission_for || '-'}</Text>
                              <Text style={styles.reportTableCell}>{row.mobile_number || '-'}</Text>
                              <Text style={styles.reportTableCell}>{row.reg_no || '-'}</Text>
                              <Text style={styles.reportTableCell}>
                                {row.assigned_teacher_name || '-'}
                              </Text>
                              <Text style={styles.reportTableCell}>
                                {isTruthyStatus(row.enrolled) ? 'Yes' : 'No'}
                              </Text>
                              <Text style={styles.reportTableCell}>{Number(row.admission_paid || 0)}</Text>
                            </>
                          ) : (
                            <>
                              <Text style={styles.reportTableCell}>{row.id}</Text>
                              <Text style={styles.reportTableCell}>{row.full_name || '-'}</Text>
                              <Text style={styles.reportTableCell}>
                                {activeReportType === 'staff' ? row.refer_by || '-' : row.lead_name || '-'}
                              </Text>
                              <Text style={styles.reportTableCell}>{row.mobile_number || '-'}</Text>
                              <Text style={styles.reportTableCell}>{row.email_id || '-'}</Text>
                              <Text style={styles.reportTableCell}>{row.reg_no || '-'}</Text>
                              {activeReportType !== 'digital' && (
                                <Text style={styles.reportTableCell}>
                                  {activeReportType === 'staff' ? row.lead_name || '-' : row.assigned_teacher_name || '-'}
                                </Text>
                              )}
                              {activeReportType !== 'digital' && (
                                <Text style={styles.reportTableCell}>{row.entry_type || '-'}</Text>
                              )}
                              <Text style={styles.reportTableCell}>{formatDateCell(row.date)}</Text>
                              <Text style={styles.reportTableCell}>{formatTimeCell(row.lead_time)}</Text>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                    </View>
                  )}
              </View>
            )}

            </ScrollView>

            {activeDateField && (
              <DateTimePicker
                value={parsePickerDate(
                  activeDateField === 'registerDob'
                    ? registerForm.dob
                    : activeDateField === 'enrollmentDob'
                      ? enrollmentForm.dob
                      : activeDateField === 'communicationDate'
                        ? communicationForm.comm_date
                        : activeDateField === 'communicationFilterDate'
                          ? communicationDateFilter
                          : activeDateField === 'testDate'
                            ? testForm.test_date
                            : testForm.counselling_date
                )}
                mode="date"
                display="default"
                onChange={(_, date) => {
                  setActiveDateField(null);
                  if (!date) return;
                  setDateFieldValue(activeDateField, formatDatePickerValue(date));
                }}
              />
            )}

            {showDuplicateConfirm && (
              <View style={styles.overlay}>
                <View style={styles.popupCard}>
                  <Text style={styles.popupTitle}>Duplicate Lead</Text>
                  <Text style={styles.popupMessage}>
                    You already have submitted this lead. Do you want to submit it again?
                  </Text>
                  <View style={styles.popupActions}>
                    <Pressable
                      style={[styles.popupButton, styles.popupButtonSecondary]}
                      onPress={() => {
                        setShowDuplicateConfirm(false);
                        setShowPopup(false);
                      }}
                    >
                      <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.popupButton, styles.popupButtonPrimary]}
                      onPress={async () => {
                        setShowDuplicateConfirm(false);
                        await submitLead(true);
                      }}
                    >
                      <Text style={styles.popupButtonText}>Submit Again</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {showPopup && !showDuplicateConfirm && (
              <View style={styles.overlay}>
                <View style={styles.popupCard}>
                  <Text style={styles.popupTitle}>{popupTitle}</Text>
                  <Text style={styles.popupMessage}>{popupMessage}</Text>
                  <View style={styles.popupActions}>
                    <Pressable
                      style={[styles.popupButton, styles.popupButtonPrimary]}
                      onPress={() => {
                        setShowPopup(false);
                        setPopupMessage('');
                      }}
                    >
                      <Text style={styles.popupButtonText}>OK</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            <Modal
              visible={showLeadReportModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowLeadReportModal(false)}
            >
              <View style={styles.overlay}>
                <View style={styles.leadReportCard}>
                  <Text style={styles.popupTitle}>Lead Report</Text>
                  <Text style={styles.popupMessage}>
                    {storedReferBy || registerForm.refer_by || 'My Leads'}
                  </Text>

                  <ScrollView
                    style={{ maxHeight: phoneHeight * 0.55 }}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {leadReportRows.length === 0 ? (
                      <Text style={styles.summaryText}>No assigned leads found.</Text>
                    ) : (
                      leadReportRows.map((lead, index) => (
                        <View key={`lead-report-${String(lead.id)}-${index}`} style={styles.leadReportRow}>
                          <Text style={styles.leadReportName}>
                            {lead.full_name || lead.student_name || `Lead ${lead.id}`}
                          </Text>
                          <Text style={styles.leadReportMeta}>
                            full_name: {lead.full_name || lead.student_name || '-'}
                          </Text>
                          <Text style={styles.leadReportMeta}>
                            test_date: {formatDateCell(lead.test_date)}
                          </Text>
                          <Text style={styles.leadReportMeta}>
                            test_time: {formatTimeCell(lead.test_time)}
                          </Text>
                          <Text style={styles.leadReportMeta}>
                            counselling_date: {formatDateCell(lead.counselling_date)}
                          </Text>
                          <Text style={styles.leadReportMeta}>
                            counselling_time: {formatTimeCell(lead.counselling_time)}
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>   

                  <View style={styles.popupActions}>
                    <Pressable
                      style={[styles.popupButton, styles.popupButtonPrimary]}
                      onPress={() => setShowLeadReportModal(false)}
                    >
                      <Text style={styles.popupButtonText}>Close</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>

            <Modal
              visible={showTeacherDetails}
              transparent
              animationType="fade"
              onRequestClose={() => setShowTeacherDetails(false)}
            >
              <View style={styles.overlay}>
                <View style={styles.teacherPopupCard}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.teacherHeaderRow}>
                      <View style={styles.teacherAvatar}>
                        <Text style={styles.teacherAvatarText}>
                          {(teacherProfile.name || teacherProfile.username || 'T')
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.teacherHeaderText}>
                        <Text style={styles.teacherTitle}>Teacher Details</Text>
                        <Text style={styles.teacherSubtitle}>
                          {teacherProfile.name || 'Teacher profile'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.teacherDetailsList}>
                      {[
                        { label: 'Name', value: teacherProfile.name || '-' },
                        { label: 'Username', value: teacherProfile.username || '-' },
                        { label: 'Designation', value: teacherProfile.designation || '-' },
                        { label: 'Phone', value: teacherProfile.phoneNo || '-' },
                      ].map((item) => (
                        <View key={item.label} style={styles.teacherDetailRow}>
                          <Text style={styles.teacherDetailLabel}>{item.label}</Text>
                          <Text style={styles.teacherDetailValue}>{item.value}</Text>
                        </View>
                      ))}
                    </View>

              
                 
                  <View style={styles.teacherActions}>
                    {showAccountSwitchOptions ? (
                      <View style={{ gap: 10, marginTop: 8, width: '100%' }}>
                        <Pressable
                          style={{
                            width: '100%',
                            minHeight: 44,
                            borderRadius: 12,
                            backgroundColor: '#F1F3F6',
                            borderWidth: 1,
                            borderColor: '#D9DDE5',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => setShowAccountSwitchOptions(false)}
                        >
                          <Text
                            style={{
                              color: '#2B2B2B',
                              fontSize: 13.5,
                              fontWeight: '800',
                              textAlign: 'center',
                            }}
                          >
                            Close
                          </Text>
                        </Pressable>
                        <Pressable
                          style={{
                            width: '100%',
                            minHeight: 48,
                            borderRadius: 12,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#D9DDE5',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={switchToTeacherDashboard}
                        >
                          <Text
                            style={{
                              color: '#1F1F22',
                              fontSize: 14,
                              fontWeight: '800',
                              textAlign: 'center',
                            }}
                          >
                              Dashboard
                          </Text>
                        </Pressable>
                        {canSwitchToParentAccount && (
                          <Pressable
                            style={{
                              width: '100%',
                              minHeight: 48,
                              borderRadius: 12,
                              backgroundColor: '#FFFFFF',
                              borderWidth: 1,
                              borderColor: '#D9DDE5',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onPress={switchToParentAccount}
                          >
                            <Text
                              style={{
                                color: '#1F1F22',
                                fontSize: 14,
                                fontWeight: '800',
                                textAlign: 'center',
                              }}
                            >
                              Parent
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      ) : (
                        <>
                          <Pressable
                            style={[
                              styles.popupButton,
                              styles.popupButtonSecondary,
                              styles.teacherActionButton,
                            ]}
                            onPress={() => setShowTeacherDetails(false)}
                          >
                            <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                              Close
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.popupButton,
                              styles.popupButtonPrimary,
                              styles.teacherActionButton,
                            ]}
                            onPress={toggleAccountSwitchOptions}
                          >
                            <Text style={styles.popupButtonText}>Switch Account</Text>
                          </Pressable>
                        </>
                      )}
                    </View>

                    <Pressable
                      style={[styles.popupButton, styles.teacherLogoutButton, { marginTop: 10 }]}
                      onPress={handleLogout}
                    >
                      <Text style={styles.teacherLogoutText}>Logout</Text>
                    </Pressable>
                  </ScrollView>
                </View>
              </View>
            </Modal>

            <View style={styles.footer}>
              {showFooterNav && (
                <View style={styles.footerNav}>
                  <Pressable style={styles.footerNavItem} onPress={handleGoBack}>
                    <Image source={backArrowImage} style={{ width: 22, height: 22 }} resizeMode="contain" />
                    <Text style={styles.footerNavLabel}>Back</Text>
                  </Pressable>
                  <Pressable style={styles.footerNavItem} onPress={handleOpenHomePanel}>
                    <MaterialIcons name="home" size={22} color="#C2C2C7" />
                    <Text style={styles.footerNavLabel}>Home</Text>
                  </Pressable>
                  <Pressable style={styles.footerAddButton} onPress={() => openModule('Register')}>
                    <MaterialIcons name="add" size={26} color="#FFFFFF" />
                  </Pressable>
                  <Pressable style={styles.footerNavItem}>
                    <MaterialIcons name="chat-bubble-outline" size={22} color="#C2C2C7" />
                    <Text style={styles.footerNavLabelMuted}>Chat</Text>
                  </Pressable>
                  <Pressable style={styles.footerNavItem} onPress={handleOpenProfilePanel}>
                    <MaterialIcons name="person-outline" size={22} color="#C2C2C7" />
                    <Text style={styles.footerNavLabelMuted}>Profile</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.footerBrandRow}>
                <Text style={styles.poweredBy}>Powered By</Text>
                <Image source={logoImage} style={styles.logo} resizeMode="contain" />
              </View>
              {showFooterNav && <View style={styles.homeIndicator} />}
            </View>

          </View>
        </View>
      </View>
    </View>
  );
};

export default DashboardScreen;
            
