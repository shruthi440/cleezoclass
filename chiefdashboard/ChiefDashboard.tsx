import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  Children,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  ImageBackground,
  Animated,
  Modal,
  Alert,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createAppStyles } from '../App.styles';
import { RootStackParamList } from '../types';
import AcademicStudent from './Chief_operation_AcademicStudent';
import AcademicTeacher from './Chief_operation_AcademicTeacher';
import ExamManagement from './Chief_operation_ExamManagement';
import Meetings from './Chief_operation_Meetings';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scaleFont = (size: number) => (SCREEN_WIDTH / 375) * size;
const FIXED_CARD_WIDTH = SCREEN_WIDTH * 0.92;
const backArrowImage = require('../assets/Arrow.png');
const chiefGradientColors = ['#F4ECFF', '#DDCBFF', '#C6B0FF'];

const COLORS = {
  primary: '#f0f0f0',
  brandBlue: '#97b9e0',
  brandRed: '#ff7171',
  textBlack: '#000',
  gridLine: 'rgba(0,0,0,0.1)',
};

type Props = NativeStackScreenProps<RootStackParamList, 'ChiefDashboard'>;
type BranchFeeSummary = {
  dbName: string;
  institute_name: string;
  totalAmount: number;
  totalDiscount: number;
  totalPaid: number;
  balance: number;
};

type DynamicFeeType = {
  id?: number | string;
  feeName?: string;
  feesType?: string;
  scope?: string;
  frequency?: string;
  installments?: number;
  columnBase?: string;
};

type DynamicFeeSummary = {
  key: string;
  label: string;
  amount: number;
  count: number;
};

const normalizeFeeKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const formatFeeLabel = (key: string) =>
  String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bFees\b/g, 'Fee')
    .trim();

const formatMoneyWithDecimals = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getNumericValueFromRow = (row: Record<string, any>, keys: string[]) => {
  const lookup = new Map(
    Object.entries(row || {}).map(([key, value]) => [normalizeFeeKey(key), value] as const),
  );

  for (const key of keys) {
    const variants = buildFeeKeyVariants(key);

    for (const variant of variants) {
      if (!lookup.has(variant)) continue;
      const value = lookup.get(variant);
      const numeric = toNumber(value);
      if (numeric || value === 0) return numeric;
    }

    for (const [candidateKey, candidateValue] of lookup.entries()) {
      if (
        variants.some(
          (variant) =>
            candidateKey === variant ||
            candidateKey.includes(variant) ||
            variant.includes(candidateKey),
        )
      ) {
        const numeric = toNumber(candidateValue);
        if (numeric || candidateValue === 0) return numeric;
      }
    }
  }

  return 0;
};

const buildFeeKeyVariants = (value: string) => {
  const normalized = normalizeFeeKey(value);
  const variants = new Set<string>();
  if (!normalized) return [];

  variants.add(normalized);
  variants.add(normalized.replace(/_fee(s)?$/, ''));
  variants.add(normalized.replace(/_amount$/, ''));

  if (normalized.endsWith('s')) {
    variants.add(normalized.slice(0, -1));
  } else {
    variants.add(`${normalized}s`);
  }

  if (normalized.endsWith('ies')) {
    variants.add(normalized.replace(/ies$/, 'y'));
  }

  return Array.from(variants).filter(Boolean);
};

const PIE_PALETTE = [
  ['#E4D8FF', '#B58BFF'],
  ['#B58BFF', '#7C3AED'],
  ['#7C3AED', '#4C1D95'],
  ['#4C1D95', '#1E3A8A'],
  ['#1E3A8A', '#B58BFF'],
  ['#E4D8FF', '#7C3AED'],
  ['#B58BFF', '#4C1D95'],
  ['#7C3AED', '#1E3A8A'],
] as [string, string][];

const PIE_CARD_GRADIENT = ['#F4EFEB', '#D1C7F9', '#C3BDFB'];

const PIE_INNER_GRADIENT = ['rgba(244, 239, 235, 0.82)', 'rgba(211, 199, 249, 0.56)', 'rgba(195, 189, 251, 0.26)'];

const PIE_CENTER_SHADOW = '#EDE6FF';

const PIE_OUTLINE = 'rgba(255,255,255,0.95)';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_OPTIONS = (() => {
  const options: { label: string; value: string }[] = [];
  for (let year = 2025; year <= 2030; year += 1) {
    MONTH_LABELS.forEach((monthLabel, monthIndex) => {
      const value = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
      options.push({ label: `${monthLabel} ${year}`, value });
    });
  }
  return options;
})();

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

const extractRowDate = (row: Record<string, any>) => {
  const rawValue = row?.record_date || row?.payment_date || row?.created_at || row?.updated_at || row?.date;
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameMonth = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const toNumber = (value: any) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const extractArrayFromApiPayload = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidateKeys = [
    'data',
    'fees',
    'rows',
    'records',
    'result',
    'results',
    'items',
    'list',
    'feeTypes',
    'fee_types',
    'feeTypesList',
  ];

  for (const key of candidateKeys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  const nestedObjects = [
    payload?.data,
    payload?.result,
    payload?.results,
    payload?.payload,
  ].filter(Boolean);

  for (const nested of nestedObjects) {
    const found = extractArrayFromApiPayload(nested);
    if (found.length) return found;
  }

  const visited = new WeakSet<object>();
  const candidateArrays: any[][] = [];
  const collectArrays = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      candidateArrays.push(value);
      return;
    }

    Object.values(value).forEach(child => collectArrays(child));
  };

  collectArrays(payload);

  if (candidateArrays.length) {
    const scored = candidateArrays
      .map(arr => {
        const sample = arr.find(item => item && typeof item === 'object') || {};
        const keys = Object.keys(sample).map(key => key.toLowerCase());
        const keySet = new Set(keys);
        const score =
          (keySet.has('fee_type') || keySet.has('feetype') ? 12 : 0) +
          (keySet.has('bill_type') || keySet.has('billtype') ? 12 : 0) +
          (keySet.has('dynamicfeebreakdown') ? 10 : 0) +
          (keySet.has('individualfeeassignments') ? 10 : 0) +
          (keySet.has('dynamicfeetotals') ? 10 : 0) +
          (keySet.has('feebreakdown') ? 10 : 0) +
          (keySet.has('total_expected') ? 5 : 0) +
          (keySet.has('total_paid') ? 5 : 0) +
          (keySet.has('paid_amount') ? 4 : 0) +
          (keySet.has('due_amount') ? 4 : 0) +
          (keySet.has('remaining_amount') ? 4 : 0) +
          (keys.some(key => key.includes('fee')) ? 4 : 0) +
          (keys.some(key => key.includes('amount')) ? 3 : 0) +
          (keys.some(key => key.includes('paid')) ? 2 : 0) +
          (keys.some(key => key.includes('due')) ? 2 : 0) +
          (keys.some(key => key.includes('discount')) ? 2 : 0) +
          (keys.some(key => key.includes('student')) ? 1 : 0) +
          (keys.some(key => key.includes('class')) ? 1 : 0) +
          (keys.some(key => key.includes('section')) ? 1 : 0) +
          Math.min(arr.length, 5);
        return { arr, score };
      })
      .sort((a, b) => b.score - a.score);

    if (scored[0]?.arr?.length) return scored[0].arr;
  }

  return [];
};

const pickFirstNonEmpty = (...values: any[]) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const ROW_METADATA_KEYS = new Set([
  'id',
  'student_id',
  'studentid',
  'student_name',
  'studentname',
  'name',
  'class_name',
  'classname',
  'section',
  'section_name',
  'father_name',
  'mobile_no',
  'phone_no',
  'admission_no',
  'admission_number',
  'reg_no',
  'roll_no',
  'receipt_no',
  'receipt_number',
  'gender',
  'email',
  'record_date',
  'payment_date',
  'created_at',
  'updated_at',
  'discount',
  'discount_amount',
  'total_amount',
  'total_due',
  'due_amount',
  'unpaid_amount',
  'completefee',
  'complete_fee',
  'updatedcompletefee',
  'updatedcomplete_fee',
  'totalfee',
  'total_fee',
  'total_expected',
  'fee_expected',
  'paid_amount',
  'total_paid',
  'paidamount',
  'remaining_amount',
]);

const extractDynamicFeeEntries = (row: Record<string, any>) => {
  const entries: Array<{ key: string; label: string; amount: number }> = [];
  const pushEntry = (entry: Record<string, any>) => {
    const rawLabel = String(
      entry?.label || entry?.key || entry?.type || entry?.feeName || entry?.columnBase || '',
    ).trim();
    const key = normalizeFeeKey(entry?.key || entry?.label || entry?.type || entry?.feeName || entry?.columnBase || rawLabel);
    if (!key) return;

    const amount = toNumber(
      entry?.total ??
        entry?.amount ??
        entry?.amountTotal ??
        entry?.assignedAmount ??
        entry?.paidAmount ??
        entry?.paid_amount ??
        entry?.amount_paid ??
        entry?.totalPaid ??
        entry?.completeFee ??
        entry?.totalAmount ??
        entry?.finalAmount ??
        entry?.Final_Amount ??
        entry?.expectedAmount ??
        entry?.expected_amount ??
        entry?.value ??
        0,
    );
    if (amount <= 0) return;

    entries.push({
      key,
      label: formatFeeLabel(rawLabel || key),
      amount,
    });
  };

  pushEntry({
    key:
      row?.fee_type ??
      row?.feeType ??
      row?.bill_type ??
      row?.billType ??
      row?.type ??
      row?.feeName ??
      row?.label ??
      '',
    label:
      row?.fee_type ??
      row?.feeType ??
      row?.bill_type ??
      row?.billType ??
      row?.type ??
      row?.feeName ??
      row?.label ??
      '',
    amount:
      row?.amount ??
      row?.total_amount ??
      row?.totalAmount ??
      row?.Total_Expected ??
      row?.Total_Paid ??
      row?.CompleteFee ??
      row?.Final_Amount ??
      0,
  });

  if (Array.isArray(row?.dynamicFeeBreakdown)) {
    row.dynamicFeeBreakdown.forEach((entry: Record<string, any>) => pushEntry(entry));
  } else if (
    row?.dynamicFeeBreakdown &&
    typeof row.dynamicFeeBreakdown === 'object'
  ) {
    Object.entries(row.dynamicFeeBreakdown).forEach(([key, amount]) =>
      pushEntry({ key, label: key, amount }),
    );
  }
  if (Array.isArray(row?.individualFeeAssignments)) {
    row.individualFeeAssignments.forEach((entry: Record<string, any>) => pushEntry(entry));
  } else if (
    row?.individualFeeAssignments &&
    typeof row.individualFeeAssignments === 'object'
  ) {
    Object.entries(row.individualFeeAssignments).forEach(([key, amount]) =>
      pushEntry({ key, label: key, amount }),
    );
  }
  if (Array.isArray(row?.feeBreakdown)) {
    row.feeBreakdown.forEach((entry: Record<string, any>) => {
      if (Array.isArray(entry)) {
        const [label, amount] = entry;
        pushEntry({ key: label, label, amount });
      } else {
        pushEntry(entry);
      }
    });
  } else if (row?.feeBreakdown && typeof row.feeBreakdown === 'object') {
    Object.entries(row.feeBreakdown).forEach(([key, amount]) =>
      pushEntry({ key, label: key, amount }),
    );
  }

  const totals = row?.dynamicFeeTotals;
  if (totals && typeof totals === 'object' && !Array.isArray(totals)) {
    Object.entries(totals).forEach(([key, amount]) => {
      const normalized = normalizeFeeKey(key);
      const numeric = toNumber(amount);
      if (!normalized || numeric <= 0) return;
      entries.push({
        key: normalized,
        label: formatFeeLabel(key),
        amount: numeric,
      });
    });
  }

  return entries;
};

const extractNumericFeeColumns = (row: Record<string, any>) => {
  const entries: Array<{ key: string; label: string; amount: number }> = [];
  Object.entries(row || {}).forEach(([rawKey, rawValue]) => {
    const normalizedKey = normalizeFeeKey(rawKey);
    if (!normalizedKey || ROW_METADATA_KEYS.has(normalizedKey)) return;
    if (normalizedKey.startsWith('total_') || normalizedKey.startsWith('dynamicfee')) return;
    if (
      normalizedKey.endsWith('_paid') ||
      normalizedKey.endsWith('_due') ||
      normalizedKey.endsWith('_discount') ||
      normalizedKey.endsWith('_amount') ||
      normalizedKey.endsWith('_total') ||
      normalizedKey === 'amount' ||
      normalizedKey === 'paid' ||
      normalizedKey === 'due' ||
      normalizedKey === 'discount'
    ) {
      return;
    }

    const amount = toNumber(rawValue);
    if (amount <= 0) return;

    entries.push({
      key: normalizedKey,
      label: formatFeeLabel(rawKey),
      amount,
    });
  });

  return entries;
};

const findMatchingAmountInRow = (row: Record<string, any>, keys: string[]) => {
  const normalizedEntries = Object.entries(row || {}).map(([key, value]) => [
    normalizeFeeKey(key),
    value,
  ] as const);
  const lookup = new Map<string, any>(normalizedEntries);

  for (const key of keys) {
    const variants = buildFeeKeyVariants(key);
    for (const variant of variants) {
      if (!lookup.has(variant)) continue;
      const numeric = toNumber(lookup.get(variant));
      if (numeric || lookup.get(variant) === 0) return numeric;
    }

    for (const [candidateKey, candidateValue] of lookup.entries()) {
      if (
        variants.some(
          (variant) =>
            candidateKey === variant ||
            candidateKey.includes(variant) ||
            variant.includes(candidateKey),
        )
      ) {
        const numeric = toNumber(candidateValue);
        if (numeric || candidateValue === 0) return numeric;
      }
    }
  }

  return 0;
};

type ChiefProfile = {
  username: string;
  name: string;
  designation: string;
  schoolCode: string;
  userType: string;
  phoneNo: string;
  email: string;
};

type ChiefSectionKey =
  | 'AcademicStudent'
  | 'AcademicTeacher'
  | 'ExamManagement'
  | 'Meetings';

// ------------------- Dashboard Card -------------------
const DashboardCard = ({
  item,
  onPress,
}: {
  item: any;
  onPress: (title: string) => void;
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) animatedValue.setValue(0);
  }, [isFocused]);

  const handlePress = () => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start(() => onPress(item.title));
  };

  const cardBackground = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#fff', '#ee4242ff'],
  });

  return (
    <Animated.View
      style={[
        styles.smallCard1,
        { width: SCREEN_WIDTH * 0.75, backgroundColor: cardBackground },
      ]}
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={handlePress}
        activeOpacity={1}
      >
        <Text style={styles.cardTitle}>{item.title}</Text>
        <ImageBackground
          source={item.image}
          resizeMode="cover"
          style={[
            styles.cardImageBg,
            { width: item.imageWidth, height: item.imageHeight },
          ]}
        />
        <View style={styles.plusIconBadge}>
          <Text style={styles.plusText}>+</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ------------------- Horizontal Scroll With Scrollbar -------------------
const HorizontalScrollWithScrollbar1: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const ITEM_WIDTH = SCREEN_WIDTH * 0.85 + 10;

  return (
    <View style={styles.hContainer}>
      {title && <Text style={styles.hTitle}>{title}</Text>}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        snapToAlignment="start"
        disableIntervalMomentum
      >
        <View style={styles.hRow}>{children}</View>
      </ScrollView>
    </View>
  );
};

// ------------------- Main Dashboard -------------------
const ChiefDashboard: React.FC<Props> = ({ route }) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const name = route.params?.name || '';
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const sectionOffsets = useRef<Partial<Record<ChiefSectionKey, number>>>({});
  const { width, height } = Dimensions.get('window');
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const appStyles = createAppStyles({ phoneWidth, phoneHeight });
  const [showSummary, setShowSummary] = useState(false);
  const [summaryModalLoading, setSummaryModalLoading] = useState(false);
  const [branchSummaries, setBranchSummaries] = useState<BranchFeeSummary[]>(
    [],
  );
  const [showFooterNav, setShowFooterNav] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [chiefProfile, setChiefProfile] = useState<ChiefProfile>({
    username: '',
    name: '',
    designation: '',
    schoolCode: '',
    userType: '',
    phoneNo: '',
    email: '',
  });
  const [selectedChip, setSelectedChip] = useState<
    'Overview' | 'Finance' | 'Actions'
  >('Overview');

  const [selectedMonth, setSelectedMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const [chartData, setChartData] = useState<any[]>([]);
  const [finalPaid, setFinalPaid] = useState(0);
  const [finalUnpaid, setFinalUnpaid] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    gross: 0,
    concession: 0,
    netPayable: 0,
    totalPaid: 0,
    totalDue: 0,
    totalAmount: 0,
    totalDiscount: 0,
    balance: 0,
  });
  const [dynamicFeeTypes, setDynamicFeeTypes] = useState<DynamicFeeType[]>(
    [],
  );
  const [dynamicFeeSummaries, setDynamicFeeSummaries] = useState<
    DynamicFeeSummary[]
  >([]);
  const [dynamicFeesLoading, setDynamicFeesLoading] = useState(false);
  const [activePieSlice, setActivePieSlice] = useState<{
    label: string;
    amount: number;
  } | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountStudents, setDiscountStudents] = useState<any[]>([]);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountTotalFromApi, setDiscountTotalFromApi] = useState(0);

  const [leaves, setLeaves] = useState<any[]>([]);
  const [latecomers, setLatecomers] = useState<any[]>([]);
  const [absentTeachers, setAbsentTeachers] = useState<any[]>([]);
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [selectedAbsentTeacher, setSelectedAbsentTeacher] = useState<any>(null);
  const [substituteId, setSubstituteId] = useState('');
  const [subPeriod, setSubPeriod] = useState('');
  const [subSubject, setSubSubject] = useState('');
  const [subClassId, setSubClassId] = useState('');
  const [subSectionId, setSubSectionId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('Loading...');
  const [branches, setBranches] = useState<any[]>([]);
  const [currentDbName, setCurrentDbName] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logo, setLogo] = useState('/default-logo.png');
  const [username, setUsername] = useState('');
  const dashboardIsFocused = useIsFocused();

  useEffect(() => {
    setShowFooterNav(true);
  }, []);

  useEffect(() => {
    console.log('🟩 [ChiefDashboard] mount started', {
      routeName: 'ChiefDashboard',
      routeParams: route.params,
    });

    const loadChiefProfile = async () => {
      try {
        const storedUserDetailsRaw = await AsyncStorage.getItem('userDetails');
        const storedUserDetails = storedUserDetailsRaw
          ? JSON.parse(storedUserDetailsRaw)
          : {};
        const storedUsername = await AsyncStorage.getItem('username');
        const storedName = await AsyncStorage.getItem('name');
        const storedDesignation = await AsyncStorage.getItem('designation');
        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
        const storedUserType = await AsyncStorage.getItem('userType');

        setChiefProfile({
          username:
            storedUserDetails.username ||
            storedUserDetails.user_name ||
            storedUsername ||
            route.params?.username ||
            '',
          name:
            storedUserDetails.name ||
            storedUserDetails.teacher_name ||
            storedName ||
            route.params?.name ||
            '',
          designation:
            storedUserDetails.designation ||
            storedDesignation ||
            storedUserDetails.role ||
            '',
          schoolCode: String(
            storedUserDetails.schoolCode || storedSchoolCode || '',
          ),
          userType: String(storedUserDetails.userType || storedUserType || ''),
          phoneNo: String(
            storedUserDetails.phone_no ||
              storedUserDetails.phoneNo ||
              storedUserDetails.mobile_number ||
              storedUserDetails.contact_no ||
              '',
          ),
          email: String(
            storedUserDetails.email_id || storedUserDetails.email || '',
          ),
        });

        console.log('🟩 [ChiefDashboard] chief profile loaded', {
          username:
            storedUserDetails.username ||
            storedUserDetails.user_name ||
            storedUsername ||
            route.params?.username ||
            '',
          name:
            storedUserDetails.name ||
            storedUserDetails.teacher_name ||
            storedName ||
            route.params?.name ||
            '',
          schoolCode: String(
            storedUserDetails.schoolCode || storedSchoolCode || '',
          ),
          userType: String(storedUserDetails.userType || storedUserType || ''),
        });
      } catch (error) {
        console.error('Failed to load chief profile:', error);
      }
    };

    loadChiefProfile().finally(() => {
      console.log('🟩 [ChiefDashboard] chief profile mount complete');
    });
    return () => {
      console.log('🟥 [ChiefDashboard] unmounted');
    };
  }, [route.params]);

  const routineData = [
    {
      title: 'Academic \nStudents',
      image: require('../assets/Student Report.png'),
      imageHeight: SCREEN_HEIGHT * 0.29,
      imageWidth: SCREEN_WIDTH * 0.65,
    },
    {
      title: 'Academic \nStaff',
      image: require('../assets/Attendance.png'),
      imageHeight: SCREEN_HEIGHT * 0.29,
      imageWidth: SCREEN_WIDTH * 0.65,
    },
    {
      title: 'Exam \nManagement',
      image: require('../assets/QuestionPaper.png'),
      imageHeight: SCREEN_HEIGHT * 0.29,
      imageWidth: SCREEN_WIDTH * 0.65,
    },
    {
      title: 'Meetings',
      image: require('../assets/chat.png'),
      imageHeight: SCREEN_HEIGHT * 0.29,
      imageWidth: SCREEN_WIDTH * 0.65,
    },
  ];
  const chiefTiles = [
    {
      label: 'Academic Students',
      title: 'Academic \nStudents',
      icon: 'school',
      gradientColors: ['#EEE8FF', '#C7B8FF'],
      sectionKey: 'AcademicStudent' as ChiefSectionKey,
    },
    {
      label: 'Academic Staff',
      title: 'Academic \nStaff',
      icon: 'groups',
      gradientColors: ['#EEE8FF', '#C7B8FF'],
      sectionKey: 'AcademicTeacher' as ChiefSectionKey,
    },
    {
      label: 'Exam Management',
      title: 'Exam \nManagement',
      icon: 'assignment',
      gradientColors: ['#EEE8FF', '#C7B8FF'],
      sectionKey: 'ExamManagement' as ChiefSectionKey,
    },
    {
      label: 'Meetings',
      title: 'Meetings',
      icon: 'chat',
      gradientColors: ['#EEE8FF', '#C7B8FF'],
      sectionKey: 'Meetings' as ChiefSectionKey,
    },
  ];

  const prefix = currentDbName.split('_')[0];

  // ------------------- Fetch AsyncStorage -------------------
  useEffect(() => {
    const loadStorage = async () => {
      const db = await AsyncStorage.getItem('schoolCode');
      const user = await AsyncStorage.getItem('username');
      if (db) setCurrentDbName(db);
      if (user) setUsername(user);
    };
    loadStorage();
  }, []);

  // ------------------- Fetch Institute Info -------------------
  useEffect(() => {
    if (!currentDbName) return;
    fetch(`https://cleezoclass.com:4000/api/institute?dbName=${currentDbName}`)
      .then(res => res.json())
      .then(data => {
        setSchoolName(data.institute_name);
        setLogo(data.logo || '/default-logo.png');
      })
      .catch(() => {
        setSchoolName('Unknown School');
        setLogo('/default-logo.png');
      });
  }, [currentDbName]);
  // Intentionally removed auto-trigger of /notify-absent on dashboard load.
  // Absent teacher push alerts are now sent by backend schedule at 3:00 PM.
  // ------------------- Fetch Branches -------------------
  useEffect(() => {
    if (!prefix) return;
    fetch(`https://cleezoclass.com:4000/api/branches?prefix=${prefix}`)
      .then(res => res.json())
      .then(data => setBranches(data))
      .catch(err => console.error(err));
  }, [prefix]);

  const switchBranch = async (dbName: string) => {
    await AsyncStorage.setItem('schoolCode', dbName);
    setCurrentDbName(dbName);
    setDropdownOpen(false);
  };

  const fetchAllBranchSummaries = async () => {
    try {
      setSummaryModalLoading(true);
      const branchList =
        branches.length > 0
          ? branches
          : currentDbName
          ? [
              {
                dbName: currentDbName,
                institute_name: schoolName || currentDbName,
              },
            ]
          : [];

      if (!branchList.length) {
        setBranchSummaries([]);
        return;
      }

      const results = await Promise.all(
        branchList.map(async (branch: any) => {
          try {
            const response = await axios.get(
              'https://cleezoclass.com:4000/api/fees-summary-ledgerData',
              { params: { schoolCode: branch.dbName } },
            );

            const data = response?.data || {};
            return {
              dbName: branch.dbName,
              institute_name: branch.institute_name || branch.dbName,
              totalAmount: Number(data.totalAmount) || 0,
              totalDiscount: Number(data.totalDiscount) || 0,
              totalPaid: Number(data.totalPaid) || 0,
              balance: Number(data.balance) || 0,
            };
          } catch {
            return {
              dbName: branch.dbName,
              institute_name: branch.institute_name || branch.dbName,
              totalAmount: 0,
              totalDiscount: 0,
              totalPaid: 0,
              balance: 0,
            };
          }
        }),
      );

      const ordered = results.sort((a, b) => {
        if (a.dbName === currentDbName && b.dbName !== currentDbName) return -1;
        if (b.dbName === currentDbName && a.dbName !== currentDbName) return 1;
        return 0;
      });

      setBranchSummaries(ordered);
    } finally {
      setSummaryModalLoading(false);
    }
  };

  // ------------------- Fetch Fees Summary -------------------
  const fetchSummary = async () => {
    try {
      setLoading(true);
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      if (!schoolCode) return;

      console.log('🟦 [ChiefDashboard] fees summary API request', {
        schoolCode,
        year: 'All',
        className: 'All',
        section: 'All',
      });

      const response = await axios.get(
        'https://cleezoclass.com:4000/api/fees-summary-ledgerData',
        { params: { schoolCode, year: 'All', className: 'All', section: 'All' } },
      );

      const payload = response?.data?.data || response?.data || {};
      const gross = Number(payload.gross ?? payload.totalAmount ?? 0) || 0;
      const concession =
        Number(payload.concession ?? payload.totalDiscount ?? 0) || 0;
      const totalPaid = Number(payload.totalPaid ?? payload.paid ?? 0) || 0;
      const netPayable =
        Number(payload.netPayable ?? payload.net_payable ?? 0) ||
        Math.max(gross - concession, 0);
      const totalDue =
        Number(payload.totalDue ?? payload.balance ?? 0) ||
        Math.max(netPayable - totalPaid, 0);

      console.log('🟦 [ChiefDashboard] fees summary API response', {
        rawPayload: payload,
        totalAmount: gross,
        totalDue,
      });

      setSummary({
        gross,
        concession,
        netPayable,
        totalPaid,
        totalDue,
        totalAmount: gross,
        totalDiscount: concession,
        balance: totalDue,
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  // ------------------- Fetch Fee Records -------------------
  const fetchFeeData = useCallback(async () => {
    const monthStart = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth(),
      1,
    );
    const monthEnd = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      0,
    );
    const fromStr = monthStart.toISOString().split('T')[0];
    const toStr = monthEnd.toISOString().split('T')[0];

    try {
      setLoading(true);
      const schoolCode =
        currentDbName ||
        chiefProfile.schoolCode ||
        (await AsyncStorage.getItem('schoolCode')) ||
        'CLEEZOCLASS';

      console.log('🟦 [ChiefDashboard] fee api context resolved', {
        schoolCode,
        currentDbName,
        chiefSchoolCode: chiefProfile.schoolCode,
        selectedMonth: selectedMonth.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
        fromDate: fromStr,
        toDate: toStr,
      });

      const url = `https://cleezoclass.com:4000/api/fee-records?type=AllFeesStatusReport&fromDate=${fromStr}&toDate=${toStr}&schoolCode=${schoolCode}`;
      console.log('🟦 [ChiefDashboard] Commerce pie API request', {
        schoolCode,
        fromDate: fromStr,
        toDate: toStr,
        url,
      });

      const [feeRecordsRes, feeTypesRes] = await Promise.allSettled([
        axios.get(url),
        axios.get('https://cleezoclass.com:4000/api/fee-types', {
          params: { schoolCode, _t: Date.now() },
        }),
      ]);

      const fees =
        feeRecordsRes.status === 'fulfilled'
          ? extractArrayFromApiPayload(feeRecordsRes.value.data)
          : [];
      const monthFilteredFees = fees.filter((item: any) => {
        const rowDate = extractRowDate(item);
        if (!rowDate) return true;
        return isSameMonth(rowDate, selectedMonth);
      });
      console.log('🟦 [ChiefDashboard] Commerce pie API response', {
        status: feeRecordsRes.status === 'fulfilled' ? feeRecordsRes.value.status : 'rejected',
        isArray: Array.isArray(fees),
        rowCount: Array.isArray(fees) ? fees.length : 0,
        filteredRowCount: monthFilteredFees.length,
        sample: Array.isArray(fees) ? fees.slice(0, 3) : fees,
      });

      let paidTotal = 0;
      let unpaidTotal = 0;
      const grouped: Record<string, any> = {};

      monthFilteredFees.forEach((item: any) => {
        const paid = getNumericValueFromRow(item, [
          'Total_Paid',
          'total_paid',
          'paid_amount',
          'paidAmount',
          'paid',
        ]);
        const expected = getNumericValueFromRow(item, [
          'Total_Expected',
          'total_expected',
          'expected_amount',
          'expectedAmount',
          'amount',
          'totalAmount',
        ]);
        paidTotal += paid;
        const pending = Math.max(expected - paid, 0);
        unpaidTotal += pending;

        const rowDate = extractRowDate(item);
        if (!rowDate) return;

        const dateLabel = rowDate.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
        });
        if (!grouped[dateLabel])
          grouped[dateLabel] = { label: dateLabel, Paid: 0, Pending: 0 };
        grouped[dateLabel].Paid += paid;
        grouped[dateLabel].Pending += pending;
      });

      const groupedChartData = Object.values(grouped);
      console.log('🟦 [ChiefDashboard] Commerce pie grouped data', groupedChartData);
      console.log('🟦 [ChiefDashboard] Commerce pie totals', {
        paidTotal,
        unpaidTotal,
      });

      setChartData(groupedChartData);
      setFinalPaid(paidTotal);
      setFinalUnpaid(unpaidTotal);

      const rawFeeTypes =
        feeTypesRes.status === 'fulfilled'
          ? extractArrayFromApiPayload(feeTypesRes.value.data)
          : [];
      const normalizedFeeTypes: DynamicFeeType[] = rawFeeTypes
        .filter(
          (item: Record<string, any>) =>
            pickFirstNonEmpty(
              item?.feeName,
              item?.feesType,
              item?.fee_type,
              item?.feeType,
              item?.bill_type,
              item?.billType,
              item?.name,
              item?.label,
              item?.type,
            ) !== '',
        )
        .map((item: Record<string, any>) => ({
          id: item?.id,
          feeName: pickFirstNonEmpty(
            item?.feeName,
            item?.fee_type,
            item?.feeType,
            item?.bill_type,
            item?.billType,
            item?.name,
            item?.label,
            item?.type,
          ),
          feesType: pickFirstNonEmpty(
            item?.feesType,
            item?.fee_category,
            item?.category,
            item?.type,
            item?.label,
            'Custom Fee',
          ),
          scope: pickFirstNonEmpty(item?.scope, 'All'),
          frequency: pickFirstNonEmpty(item?.frequency, 'One time'),
          installments: Number(item?.installments || item?.installment || 1) || 1,
          columnBase: normalizeFeeKey(
            item?.columnBase ||
              item?.column_base ||
              item?.feeName ||
              item?.fee_type ||
              item?.feeType ||
              item?.bill_type ||
              item?.billType ||
              item?.feesType ||
              item?.name ||
              item?.label ||
              item?.type ||
              '',
          ),
        }));

      if (!normalizedFeeTypes.length && Array.isArray(fees)) {
        const feeTypeSeed = new Map<string, DynamicFeeType>();
        fees.forEach((row: Record<string, any>) => {
          extractDynamicFeeEntries(row).forEach(entry => {
            const key = normalizeFeeKey(entry.key || entry.label);
            if (!key || feeTypeSeed.has(key)) return;
            feeTypeSeed.set(key, {
              id: key,
              feeName: entry.label || formatFeeLabel(key),
              feesType: entry.label || formatFeeLabel(key),
              scope: 'All',
              frequency: 'One time',
              installments: 1,
              columnBase: key,
            });
          });
        });
        normalizedFeeTypes.push(...Array.from(feeTypeSeed.values()));
      }

      const summaryMap = new Map<
        string,
        { key: string; label: string; amount: number; count: number; order: number }
      >();
      let usedFallbackColumns = false;

      normalizedFeeTypes.forEach((item, index) => {
        const rawLabel = String(
          item?.feeName || item?.feesType || item?.columnBase || '',
        ).trim();
        const key = normalizeFeeKey(item?.columnBase || rawLabel);
        if (!key) return;

        summaryMap.set(key, {
          key,
          label: formatFeeLabel(rawLabel || key),
          amount: 0,
          count: 0,
          order: index,
        });
      });

      (Array.isArray(fees) ? fees : []).forEach((row: any) => {
        const dynamicEntries = extractDynamicFeeEntries(row);
        normalizedFeeTypes.forEach((item, index) => {
          const rawLabel = String(
            item?.feeName || item?.feesType || item?.columnBase || '',
          ).trim();
          const key = normalizeFeeKey(item?.columnBase || rawLabel);
          if (!key) return;

          const amount = findMatchingAmountInRow(row, [
            key,
            rawLabel,
            `${key}_amount`,
            `${key}_fee`,
            `${key}_fees`,
            `${rawLabel}_amount`,
            `${rawLabel}_fee`,
            `${rawLabel}_fees`,
          ]);

          if (amount <= 0) return;

          const current = summaryMap.get(key);
          if (!current) return;
          current.amount += amount;
          current.count += 1;
        });

        // Fallback: if the row carries nested fee breakdown structures, use them too.
        dynamicEntries.forEach((entry) => {
          const key = normalizeFeeKey(entry.key || entry.label);
          const amount = toNumber(entry.amount);
          if (!key || amount <= 0) return;

          if (!summaryMap.has(key)) {
            summaryMap.set(key, {
              key,
              label: entry.label || formatFeeLabel(key),
              amount: 0,
              count: 0,
              order: summaryMap.size,
            });
          }

          const current = summaryMap.get(key);
          if (!current) return;
          current.amount += amount;
          current.count += 1;
        });

        if (!dynamicEntries.length) {
          extractNumericFeeColumns(row).forEach((entry) => {
            const key = normalizeFeeKey(entry.key || entry.label);
            const amount = toNumber(entry.amount);
            if (!key || amount <= 0) return;
            usedFallbackColumns = true;

            if (!summaryMap.has(key)) {
              summaryMap.set(key, {
                key,
                label: entry.label || formatFeeLabel(key),
                amount: 0,
                count: 0,
                order: summaryMap.size,
              });
            }

            const current = summaryMap.get(key);
            if (!current) return;
            current.amount += amount;
            current.count += 1;
          });
        }
      });

      const dynamicRows = Array.from(summaryMap.values()).sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return b.amount - a.amount;
      });

      console.log('🟦 [ChiefDashboard] fee api parsing complete', {
        feeTypeCount: normalizedFeeTypes.length,
        dynamicRowCount: dynamicRows.length,
        usedFallbackColumns,
        dynamicRows: dynamicRows.slice(0, 10),
      });

      setDynamicFeeTypes(normalizedFeeTypes);
      setDynamicFeeSummaries(dynamicRows.map(({ order, ...rest }) => rest));
    } catch (err) {
      console.error('Fee fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [chiefProfile.schoolCode, currentDbName, selectedMonth]);

  useEffect(() => {
    fetchFeeData();
  }, [fetchFeeData]);
  useEffect(() => {
    fetchSummary();
  }, [currentDbName]);

  const fetchDiscountStudents = async () => {
    try {
      setDiscountLoading(true);
      const schoolCode = (await AsyncStorage.getItem('schoolCode')) || '';
      if (!schoolCode) {
        setDiscountStudents([]);
        return;
      }

      const url = `https://cleezoclass.com:4000/api/discounted-students?schoolCode=${encodeURIComponent(
        schoolCode,
      )}`;
      const response = await axios.get(url);
      const results = Array.isArray(response.data) ? response.data : [];

      const rawList = results
        .map((item: any) => {
          const totalDiscount =
            Number(item.effective_discount) ||
            Math.max(
              Number(item.Discount) || 0,
              Number(item.tuition_discount) || 0,
              Number(item.fee_discount) || 0,
              Number(item.bus_discount) || 0,
            );

          return {
            id: item.login_id || item.student_id || item.id || null,
            name: item.StudentName || 'Unknown',
            discount: totalDiscount,
          };
        })
        .filter((item: any) => item.discount > 0);

      // De-duplicate by student name only (one student should count once),
      // and keep the highest discount for that name.
      const byStudentName: Record<
        string,
        { id: any; name: string; discount: number }
      > = {};
      rawList.forEach((item: any) => {
        const normalizedName = String(item.name || 'unknown')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/[^a-z0-9 ]/g, '')
          .trim();
        const key = `name:${normalizedName}`;
        if (
          !byStudentName[key] ||
          item.discount > byStudentName[key].discount
        ) {
          byStudentName[key] = item;
        }
      });

      const list = Object.values(byStudentName).sort(
        (a: any, b: any) => b.discount - a.discount,
      );

      setDiscountStudents(list);
      setDiscountTotalFromApi(
        list.reduce(
          (sum: number, item: any) => sum + (Number(item.discount) || 0),
          0,
        ),
      );
    } catch (err) {
      console.error('❌ Discount list fetch error:', err);
      setDiscountStudents([]);
      setDiscountTotalFromApi(0);
    } finally {
      setDiscountLoading(false);
    }
  };
  useEffect(() => {
    fetchDiscountStudents();
  }, [currentDbName]);

  // ------------------- Fetch Teacher Leaves -------------------
  const fetchTeacherLeaves = async () => {
    try {
      setLoading(true);
      const schoolCode = (await AsyncStorage.getItem('schoolCode')) || currentDbName;
      if (!schoolCode) return;

      const response = await fetch(
        `http://162.215.210.38:3010/api/leave/pending?schoolCode=${schoolCode}`,
      );
      const data = await response.json();
      if (response.ok) setLeaves(data);
    } catch (err) {
      console.error('❌ Leave fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dashboardIsFocused) return;
    fetchTeacherLeaves();
  }, [dashboardIsFocused, currentDbName]);

  const fetchLatecomers = async () => {
    try {
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      if (!schoolCode) return;

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const response = await fetch(
        `https://cleezoclass.com:4000/api/teacher-list-of-latecomers?schoolCode=${schoolCode}&month=${month}&year=${year}`,
      );
      const data = await response.json();
      if (response.ok) setLatecomers(Array.isArray(data) ? data : []);
      else setLatecomers([]);
    } catch (err) {
      console.error('❌ Latecomer fetch error:', err);
      setLatecomers([]);
    }
  };

  const fetchAbsentTeachers = async () => {
    try {
      console.log('🟪 [ChiefDashboard] fetchAbsentTeachers started');
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      console.log('🟪 [ChiefDashboard] schoolCode:', schoolCode);
      if (!schoolCode) {
        console.warn(
          '⚠️ [ChiefDashboard] schoolCode missing, aborting absent fetch',
        );
        return;
      }

      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const url = `http://162.215.210.38:3010/api/chief/absent-teachers?schoolCode=${encodeURIComponent(
        schoolCode,
      )}&date=${date}`;
      console.log('🟪 [ChiefDashboard] calling:', url);

      const response = await fetch(url);
      console.log('🟪 [ChiefDashboard] absent API status:', response.status);
      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();
      console.log('🟪 [ChiefDashboard] absent API content-type:', contentType);
      console.log(
        '🟪 [ChiefDashboard] absent API raw body (first 200):',
        rawBody.slice(0, 200),
      );

      let data: any = {};
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(rawBody);
        } catch (parseErr) {
          console.error('❌ [ChiefDashboard] JSON parse failed:', parseErr);
          data = {};
        }
      } else {
        console.warn('⚠️ [ChiefDashboard] Non-JSON response from absent API');
        data = { raw: rawBody };
      }
      console.log('🟪 [ChiefDashboard] absent API payload:', data);

      if (response.ok) {
        const teachers = Array.isArray(data?.teachers) ? data.teachers : [];
        console.log(
          '🟪 [ChiefDashboard] absent teachers count:',
          teachers.length,
        );
        setAbsentTeachers(teachers);
      } else {
        console.warn('⚠️ [ChiefDashboard] absent API non-200:', data);
        setAbsentTeachers([]);
      }
    } catch (err) {
      console.error('❌ Absent teacher fetch error:', err);
      setAbsentTeachers([]);
    }
  };

  useEffect(() => {
    fetchLatecomers();
    fetchAbsentTeachers();
  }, [currentDbName]);

  const submitSubstituteAssignment = async () => {
    try {
      if (!selectedAbsentTeacher) {
        Alert.alert('Select Teacher', 'Please select an absent teacher first.');
        return;
      }
      if (!subPeriod || !substituteId || !subClassId || !subSectionId) {
        Alert.alert('Missing Details', 'Please fill all substitute fields.');
        return;
      }

      const schoolCode = await AsyncStorage.getItem('schoolCode');
      if (!schoolCode) {
        Alert.alert('Error', 'schoolCode missing');
        return;
      }

      setAssignLoading(true);
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(now.getDate()).padStart(2, '0')}`;

      const payload = {
        schoolCode,
        date,
        period: subPeriod,
        subject: subSubject,
        substituteId,
        classId: subClassId,
        sectionId: subSectionId,
        absentTeacherId: selectedAbsentTeacher.teacher_id,
      };

      console.log(
        '🟧 [ChiefDashboard] submitting substitute assignment:',
        payload,
      );
      const response = await fetch(
        'http://162.215.210.38:3010/api/chief/assign-substitute',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      console.log(
        '🟧 [ChiefDashboard] assign-substitute response:',
        response.status,
        data,
      );

      if (!response.ok) {
        Alert.alert('Error', data?.error || 'Failed to assign substitute');
        return;
      }

      Alert.alert(
        'Success',
        data?.message || 'Substitute assigned successfully',
      );
      setShowSubstituteModal(false);
      setSelectedAbsentTeacher(null);
      setSubstituteId('');
      setSubPeriod('');
      setSubSubject('');
      setSubClassId('');
      setSubSectionId('');
      fetchAbsentTeachers();
    } catch (err) {
      console.error('❌ [ChiefDashboard] assign-substitute error:', err);
      Alert.alert('Error', 'Something went wrong while assigning substitute');
    } finally {
      setAssignLoading(false);
    }
  };

  const updateLeaveStatus = async (
    leaveId: string | number,
    newStatus: string,
  ) => {
    try {
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      if (!schoolCode) return;

      const response = await fetch(
        'http://162.215.210.38:3010/api/leave/update-status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leaveId, status: newStatus, schoolCode }),
        },
      );

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', `Leave ${newStatus} successfully!`);
        fetchTeacherLeaves();
      } else {
        Alert.alert('Error', data.error || 'Failed to update leave');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong while updating leave');
    }
  };

  const openChiefModule = (sectionKey: ChiefSectionKey) => {
    navigation.navigate(sectionKey);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleOpenProfilePanel = () => {
    setShowProfileModal(true);
  };

  const handleGoBack = () => {
    const currentY = scrollYRef.current;
    const offsets = [0, ...Object.values(sectionOffsets.current)]
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => a - b);

    const previousOffset = offsets.filter(offset => offset < currentY - 8).pop();

    if (typeof previousOffset === 'number') {
      scrollRef.current?.scrollTo({
        y: Math.max(0, previousOffset - 12),
        animated: true,
      });
      if (previousOffset <= 12) {
        setSelectedChip('Overview');
      }
      return;
    }

    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setSelectedChip('Overview');
  };

  const handleChiefLogout = async () => {
    try {
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

      setShowProfileModal(false);
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    } catch (error) {
      console.error('Chief logout failed:', error);
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    }
  };

  // ------------------- Chart Calculations -------------------
  const dynamicPieDataRaw = dynamicFeeSummaries
    .map((item, index) => ({
      label: item.label,
      value: item.amount,
      displayAmount: item.amount,
      color: PIE_PALETTE[index % PIE_PALETTE.length][1],
      gradientStart: PIE_PALETTE[index % PIE_PALETTE.length][0],
      gradientEnd: PIE_PALETTE[index % PIE_PALETTE.length][1],
    }));
  const pieTotal = dynamicPieDataRaw.reduce((sum, item) => sum + item.value, 0);
  const pieHasPositiveAmounts = dynamicPieDataRaw.some(item => item.value > 0);
  const pieData =
    pieHasPositiveAmounts || dynamicPieDataRaw.length === 0
      ? dynamicPieDataRaw.filter(item => item.value > 0)
      : dynamicPieDataRaw.map(item => ({
          ...item,
          value: 1,
          displayAmount: item.value,
        }));
  const PIE_SIZE = 314;
  const PIE_RADIUS = 124;
  const PIE_CENTER = PIE_SIZE / 2;
  const pieSlices = (() => {
    if (!pieData.length) return [];
    let startAngle = -90;
    const chartTotal = pieData.reduce((sum, item) => sum + item.value, 0) || 1;

    return pieData.map(item => {
      const sweep = (item.value / chartTotal) * 360;
      const endAngle = startAngle + sweep;
      const largeArcFlag = sweep > 180 ? 1 : 0;

      const start = {
        x: PIE_CENTER + PIE_RADIUS * Math.cos((Math.PI * startAngle) / 180),
        y: PIE_CENTER + PIE_RADIUS * Math.sin((Math.PI * startAngle) / 180),
      };
      const end = {
        x: PIE_CENTER + PIE_RADIUS * Math.cos((Math.PI * endAngle) / 180),
        y: PIE_CENTER + PIE_RADIUS * Math.sin((Math.PI * endAngle) / 180),
      };

      const path = [
        `M ${PIE_CENTER} ${PIE_CENTER}`,
        `L ${start.x} ${start.y}`,
        `A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
        'Z',
      ].join(' ');

      const slice = {
        ...item,
        path,
        displayAmount: item.displayAmount ?? item.value,
      };
      startAngle = endAngle;
      return slice;
    });
  })();

  // ------------------- Metric Badge -------------------
  const MetricBadge: React.FC<{ label: string; value: string }> = ({
    label,
    value,
  }) => (
    <View style={styles.metricBadge}>
      <Text style={styles.badgeLabel}>
        <Text style={styles.bullet}>• </Text>
        {label}
      </Text>
      <Text style={styles.badgeValue}>{value}</Text>
    </View>
  );

  const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f7' }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 15, paddingBottom: 140 }}
          onScroll={event => {
            scrollYRef.current = event.nativeEvent.contentOffset.y;
            if (event.nativeEvent.contentOffset.y > 8) {
              setShowFooterNav(true);
            }
          }}
          scrollEventThrottle={16}
        >
          <View style={styles.headerRow1}>
            <Text style={styles.headerText}>Welcome, {name}</Text>
          </View>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.leftContainer}>
              {/* Branch display */}
              {branches.length <= 1 ? (
                <Text style={styles.schoolName}>
                  {(
                    branches[0]?.institute_name ||
                    schoolName ||
                    currentDbName
                  ).toUpperCase()}
                </Text>
              ) : (
                <HorizontalScrollWithScrollbar1>
                  {branches.map(branch => (
                    <TouchableOpacity
                      key={branch.dbName}
                      style={[
                        styles.branchButton,
                        branch.dbName === currentDbName &&
                          styles.branchButtonActive,
                      ]}
                      onPress={() => switchBranch(branch.dbName)}
                    >
                      <Text
                        style={[
                          styles.branchText,
                          branch.dbName === currentDbName &&
                            styles.branchTextActive,
                        ]}
                      >
                        {branch.institute_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </HorizontalScrollWithScrollbar1>
              )}
              {/* Branch Dropdown */}
              <Modal visible={dropdownOpen} transparent animationType="fade">
                <TouchableOpacity
                  style={styles.modalOverlay}
                  onPress={() => setDropdownOpen(false)}
                >
                  <View style={styles.dropdownList}>
                    <FlatList
                      data={branches}
                      keyExtractor={item => item.dbName}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => switchBranch(item.dbName)}
                        >
                          <Text style={styles.dropdownItemText}>
                            {item.institute_name.toUpperCase()} (
                            {item.dbName.toUpperCase()})
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          </View>

          {/* <View style={appStyles.chipStickyHeader}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={appStyles.chipRow}>
                {(['Overview', 'Finance', 'Actions'] as const).map(chip => {
                  const active = selectedChip === chip;
                  return (
                    <Pressable
                      key={chip}
                      onPress={() => setSelectedChip(chip)}
                      style={[
                        appStyles.chip,
                        appStyles.chipSpacing,
                        active ? appStyles.chipActive : appStyles.chipInactive,
                      ]}
                    >
                      <Text
                        style={[
                          appStyles.chipText,
                          active
                            ? appStyles.chipTextActive
                            : appStyles.chipTextInactive,
                        ]}
                      >
                        {chip}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View> */}

       

         

          <Modal
            transparent
            visible={showMonthPicker}
            animationType="fade"
            onRequestClose={() => setShowMonthPicker(false)}
          >
            <View style={styles.monthPickerOverlay}>
              <View style={styles.monthPickerSheet}>
                <Text style={styles.monthPickerTitle}>Select Month</Text>
                <View style={styles.monthPickerFrame}>
                  <Picker
                    selectedValue={getMonthKey(selectedMonth)}
                    onValueChange={(itemValue: string) => {
                      const [year, month] = itemValue.split('-').map(Number);
                      if (!year || !month) return;
                      setSelectedMonth(new Date(year, month - 1, 1));
                    }}
                    style={styles.monthPicker}
                  >
                    {MONTH_OPTIONS.map(option => (
                      <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Picker>
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setShowMonthPicker(false)}
                  style={styles.monthPickerDoneBtn}
                >
                  <Text style={styles.monthPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <HorizontalScrollWithScrollbar1 title="">
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={async () => {
                setShowSummary(true);
                await fetchAllBranchSummaries();
              }}
              style={[
                styles.sectionCard,
                styles.chartContainer,
                styles.pieChartNoShadow,
              ]}
            >
              <LinearGradient
                colors={PIE_CARD_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.58, 1]}
                style={styles.pieCardGradient}
              >
                <LinearGradient
                  colors={[
                    'rgba(244,239,235,0.16)',
                    'rgba(209,199,249,0.10)',
                    'rgba(195,189,251,0.06)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.55, 1]}
                  style={styles.pieCardTopGlow}
                />
                <LinearGradient
                  colors={[
                    'rgba(124,58,237,0.08)',
                    'rgba(255,255,255,0)',
                    'rgba(30,58,138,0.05)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.56, 1]}
                  style={styles.pieCardSoftShadow}
                />
                <LinearGradient
                  colors={PIE_INNER_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.55, 1]}
                  style={styles.pieCardInnerGlow}
                />
                <View style={styles.pieCardHeader}>
                  <View style={styles.pieCardHeaderLeft}>
                    <Text style={styles.pieCardHeaderLabel}>
                      Total Amount
                    </Text>
                    <Text style={styles.pieCardHeaderValue}>
                      {formatMoneyWithDecimals(
                        finalPaid + finalUnpaid,
                      )}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowMonthPicker(true)}
                    activeOpacity={0.85}
                    style={styles.pieCardHeaderBadge}
                  >
                    <Text style={styles.pieCardHeaderBadgeText}>
                      {selectedMonth.toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
                {loading ? (
                  <ActivityIndicator color={COLORS.brandBlue} />
                ) : pieData.length > 0 ? (
                  <View style={styles.pieChartWrap}>
                    <Svg height={PIE_SIZE} width={PIE_SIZE}>
                      <Defs>
                        {pieSlices.map((slice, index) => (
                          <SvgLinearGradient
                            key={`${slice.label}-gradient`}
                            id={`pie-gradient-${index}`}
                            x1="6%"
                            y1="6%"
                            x2="94%"
                            y2="94%"
                          >
                            <Stop
                              offset="0%"
                              stopColor={slice.gradientStart}
                              stopOpacity="1"
                            />
                            <Stop
                              offset="100%"
                              stopColor={slice.gradientEnd}
                              stopOpacity="1"
                            />
                          </SvgLinearGradient>
                        ))}
                      </Defs>
                    <Circle
                      cx={PIE_CENTER}
                      cy={PIE_CENTER}
                      r={PIE_RADIUS}
                      fill="url(#pie-gradient-0)"
                      opacity={0.14}
                    />
                      {pieSlices.length === 1 ? (
                        <Circle
                          cx={PIE_CENTER}
                          cy={PIE_CENTER}
                          r={PIE_RADIUS}
                          fill="url(#pie-gradient-0)"
                          stroke={PIE_OUTLINE}
                          strokeWidth="2.5"
                        />
                      ) : (
                        pieSlices.map((slice, index) => {
                          const isActive =
                            activePieSlice?.label === slice.label;
                          const sliceHandlers: any = {
                            onPress: () =>
                              setActivePieSlice(prev =>
                                prev?.label === slice.label
                                  ? null
                                  : {
                                      label: slice.label,
                                      amount:
                                        slice.displayAmount ?? slice.value,
                                    },
                              ),
                          };

                          if (Platform.OS === 'web') {
                            sliceHandlers.onMouseEnter = () =>
                              setActivePieSlice({
                                label: slice.label,
                                amount: slice.displayAmount ?? slice.value,
                              });
                            sliceHandlers.onMouseLeave = () =>
                              setActivePieSlice(null);
                          }

                          return (
                            <Path
                              key={slice.label}
                              d={slice.path}
                              fill={`url(#pie-gradient-${index})`}
                              stroke={PIE_OUTLINE}
                              strokeWidth={isActive ? 3.5 : 2.25}
                              opacity={isActive ? 1 : 0.92}
                              {...sliceHandlers}
                            />
                          );
                        })
                      )}
                    <Circle
                      cx={PIE_CENTER}
                      cy={PIE_CENTER}
                      r={68}
                      fill={PIE_CENTER_SHADOW}
                    />
                    </Svg>
                  <View style={styles.pieCenterLabel}>
                    <Text style={styles.pieCenterDueValue}>
                      {formatMoneyWithDecimals(
                        finalUnpaid,
                      )}
                    </Text>
                    <Text style={styles.pieCenterDueLabel}>Due</Text>
                    {activePieSlice ? (
                      <>
                        <Text style={styles.pieCenterSliceLabel}>
                          {activePieSlice.label}
                        </Text>
                        <Text style={styles.pieCenterSliceValue}>
                          {formatMoneyWithDecimals(
                            Number(activePieSlice.amount || 0),
                          )}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.pieCenterSliceLabel}>
                        {pieHasPositiveAmounts ? '' : 'No Amounts Yet'}
                      </Text>
                    )}
                  </View>
                  </View>
                ) : (
                  <View style={styles.pieEmptyState}>
                    <Text style={styles.pieEmptyTitle}>
                      No dynamic fee data
                    </Text>
                    <Text style={styles.pieEmptyText}>
                      The chart is based on saved fee types and amounts from the
                      accountant screen.
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={async () => {
                setShowSummary(true);
                await fetchAllBranchSummaries();
              }}
              style={[styles.sectionCard, styles.commerceSummaryCard]}
            >
              <View style={styles.financeGrid}>
                <View style={[styles.financeColumn, { gap: 8 }]}>
                  <Text style={styles.subHeading}>FINANCE SUMMARY</Text>
                  <MetricBadge
                    label="Gross"
                    value={formatMoneyWithDecimals(summary.gross)}
                  />
                  <MetricBadge
                    label="Concession"
                    value={formatMoneyWithDecimals(summary.concession)}
                  />
                  <MetricBadge
                    label="Net Payable"
                    value={formatMoneyWithDecimals(summary.netPayable)}
                  />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Paid</Text>
                    <Text
                      style={[styles.totalValue, { color: COLORS.brandBlue }]}
                    >
                      {formatMoneyWithDecimals(summary.totalPaid)}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={[styles.financeColumn, { gap: 8 }]}>
                  <Text style={styles.subHeading}>DYNAMIC FEES</Text>
                  {dynamicFeesLoading ? (
                    <ActivityIndicator color={COLORS.brandRed} />
                  ) : dynamicFeeSummaries.slice(0, 4).length > 0 ? (
                    dynamicFeeSummaries.slice(0, 4).map((item) => (
                      <MetricBadge
                        key={item.key}
                        label={`${item.label}${item.count > 1 ? ` (${item.count})` : ''}`}
                        value={`₹${item.amount.toLocaleString('en-IN')}`}
                      />
                    ))
                  ) : (
                    <MetricBadge label="Dynamic Fees" value="No data" />
                  )}
                  <MetricBadge
                    label="Dynamic Fee Total"
                    value={`₹${dynamicFeeSummaries
                      .reduce((sum, item) => sum + item.amount, 0)
                      .toLocaleString('en-IN')}`}
                  />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Dynamic Types</Text>
                    <Text
                      style={[styles.totalValue, { color: COLORS.brandRed }]}
                    >
                      {dynamicFeeTypes.length}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </HorizontalScrollWithScrollbar1>
          <HorizontalScrollWithScrollbar1 title="Actions">
            <LinearGradient
              colors={chiefGradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionCard, styles.actionGradientCard]}
            >
              <View style={styles.actionHeaderRow}>
                <View style={styles.actionIconWrap}>
                  <MaterialIcons name="event-busy" size={20} color="#242424" />
                </View>
                <View style={styles.actionHeaderTextBlock}>
                  <Text style={styles.actionCardTitle}>Leave Approval</Text>
                  <Text style={styles.actionSubText}>
                    {leaves.length > 0
                      ? `${leaves[0].teacher_name || 'Unknown'} needs review`
                      : 'No pending leave approvals'}
                  </Text>
                </View>
              </View>
              {leaves.length > 0 && (
                <>
                  <Text style={styles.actionBodyText} numberOfLines={2}>
                    {leaves[0].reason || 'No reason provided'}
                  </Text>
                  <View style={styles.actionMetaRow}>
                    <View style={styles.actionMetaPill}>
                      <Text style={styles.actionMetaPillText}>
                        {formatDate(leaves[0].leave_start_date)}
                      </Text>
                    </View>
                    <View style={styles.compactBtnRow}>
                      <TouchableOpacity
                        style={[
                          styles.approveBtn,
                          styles.actionApproveYes,
                        ]}
                        onPress={() =>
                          updateLeaveStatus(leaves[0].id, 'approved')
                        }
                      >
                        <Text style={styles.approveText}>OK</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.approveBtn,
                          styles.actionApproveNo,
                        ]}
                        onPress={() =>
                          updateLeaveStatus(leaves[0].id, 'rejected')
                        }
                      >
                        <Text style={styles.approveText}>NO</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </LinearGradient>

            <LinearGradient
              colors={chiefGradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionCard, styles.actionGradientCard]}
            >
              <View style={styles.actionHeaderRow}>
                <View style={styles.actionIconWrap}>
                  <MaterialIcons name="schedule" size={20} color="#242424" />
                </View>
                <View style={styles.actionHeaderTextBlock}>
                  <Text style={styles.actionCardTitle}>Late Comers</Text>
                  <Text style={styles.actionSubText}>
                    {latecomers.length} record{latecomers.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <Text style={styles.actionBodyText} numberOfLines={2}>
                Top: {latecomers.length > 0 ? latecomers[0]?.teacher_name || '-' : 'No latecomers found'}
              </Text>
              <View style={styles.actionMetaRow}>
                <View style={styles.actionMetaPillMuted}>
                  <Text style={styles.actionMetaPillText}>
                    {latecomers.length > 0 ? 'Trending' : 'Idle'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={async () => {
                setShowDiscountModal(true);
                await fetchDiscountStudents();
              }}
            >
              <LinearGradient
                colors={chiefGradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.actionCard, styles.actionGradientCard]}
              >
                <View style={styles.actionHeaderRow}>
                  <View style={styles.actionIconWrap}>
                    <MaterialIcons name="local-offer" size={20} color="#242424" />
                  </View>
                  <View style={styles.actionHeaderTextBlock}>
                    <Text style={styles.actionCardTitle}>Discount Provided</Text>
                    <Text style={styles.actionSubText}>
                      Tap to open the list
                    </Text>
                  </View>
                </View>
                <Text style={styles.actionBodyText} numberOfLines={2}>
                  Total: ₹{discountTotalFromApi.toLocaleString('en-IN')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <LinearGradient
              colors={chiefGradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.actionCard, styles.actionGradientCard]}
            >
              <View style={styles.actionHeaderRow}>
                <View style={styles.actionIconWrap}>
                  <MaterialIcons name="groups" size={20} color="#242424" />
                </View>
                <View style={styles.actionHeaderTextBlock}>
                  <Text style={styles.actionCardTitle}>Substitute Required</Text>
                  <Text style={styles.actionSubText}>
                    Teachers needing coverage
                  </Text>
                </View>
              </View>
              <Text style={styles.actionBodyText} numberOfLines={2}>
                Absent: {absentTeachers.length}
              </Text>
              <View style={styles.actionMetaRow}>
                <View style={styles.actionMetaPill}>
                  <Text style={styles.actionMetaPillText}>
                    {absentTeachers.length > 0 ? 'Needs action' : 'All clear'}
                  </Text>
                </View>
                {absentTeachers.length > 0 && (
                  <TouchableOpacity
                    style={[styles.approveBtn, styles.actionAssignBtn]}
                    onPress={() => {
                      console.log(
                        '🟪 [ChiefDashboard] Assign clicked, absentTeachers:',
                        absentTeachers,
                      );
                      setShowSubstituteModal(true);
                    }}
                  >
                    <Text style={styles.approveText}>Assign</Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </HorizontalScrollWithScrollbar1>

     
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingRight: 12,
              paddingBottom: 4,
            }}
            style={{ marginBottom: 10 }}
          >
            <View style={[appStyles.dashboardGrid, { flexWrap: 'nowrap' }]}>
              {chiefTiles.map(item => (
                <Pressable
                  key={item.title}
                  onPress={() => openChiefModule(item.sectionKey)}
                >
                  <LinearGradient
                    colors={item.gradientColors}
                    start={{ x: 0.02, y: 0.02 }}
                    end={{ x: 0.98, y: 0.92 }}
                    style={[
                      appStyles.dashboardGridCardThree,
                      styles.chiefGradientCard,
                      { marginRight: 10, marginBottom: 0 },
                    ]}
                  >
                    <View style={styles.chiefGradientIconWrap}>
                      <MaterialIcons
                        name={item.icon as any}
                        size={24}
                        color="#242424"
                      />
                    </View>
                    <Text style={styles.chiefGradientLabel}>{item.label}</Text>
                  </LinearGradient>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Modal */}
          <Modal
            visible={showSummary}
            animationType="slide"
            transparent
            onRequestClose={() => setShowSummary(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <TouchableOpacity
                  onPress={() => setShowSummary(false)}
                  style={styles.closeButton}
                >
                  <Text style={{ fontSize: 18, color: 'red' }}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.summaryModalTitle}>Branch Fee Summary</Text>
                {summaryModalLoading ? (
                  <ActivityIndicator size="large" color="#1565c0" />
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {branchSummaries.length === 0 ? (
                      <Text style={styles.discountEmpty}>
                        No branch summary data found.
                      </Text>
                    ) : (
                      branchSummaries.map((item, index) => {
                        const netAmount = item.totalAmount - item.totalDiscount;
                        const calculatedBalance = netAmount - item.totalPaid;
                        return (
                          <View
                            key={`${item.dbName}-${index}`}
                            style={styles.summaryBranchCard}
                          >
                            <Text style={styles.summaryBranchTitle}>
                              {item.institute_name}
                            </Text>
                            <View style={styles.summaryMetricCard}>
                              <Text style={styles.summaryLabel}>
                                Total Amount
                              </Text>
                              <Text style={styles.summaryValue}>
                                ₹ {item.totalAmount.toLocaleString('en-IN')}
                              </Text>
                            </View>
                            <View style={styles.summaryMetricCard}>
                              <Text style={styles.summaryLabel}>
                                Total Discount
                              </Text>
                              <Text style={styles.summaryValue}>
                                ₹ {item.totalDiscount.toLocaleString('en-IN')}
                              </Text>
                            </View>
                            <View style={styles.summaryMetricCard}>
                              <Text style={styles.summaryLabel}>
                                Net Amount
                              </Text>
                              <Text style={styles.summaryValue}>
                                ₹ {netAmount.toLocaleString('en-IN')}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.summaryMetricCard,
                                styles.summaryMetricCardPaid,
                              ]}
                            >
                              <Text style={styles.summaryLabel}>
                                Total Paid
                              </Text>
                              <Text style={styles.summaryValue}>
                                ₹ {item.totalPaid.toLocaleString('en-IN')}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.summaryMetricCard,
                                styles.summaryMetricCardDue,
                              ]}
                            >
                              <Text style={styles.summaryLabel}>Balance</Text>
                              <Text style={styles.summaryValue}>
                                ₹ {calculatedBalance.toLocaleString('en-IN')}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
          {/* <View style={styles.sectionCard}>
          <View style={styles.financeGrid}>
            <View style={[styles.financeColumn, { gap: 8 }]}>
              <Text style={styles.subHeading}>INCOME</Text>
              <MetricBadge
                label="Fees Paid Report"
                value={`₹${finalPaid.toLocaleString()}`}
              />
              <MetricBadge
                label="Fees Unpaid Report"
                value={`₹${finalUnpaid.toLocaleString()}`}
              />
              <MetricBadge
                label="Income Ledger"
                value={`₹${(finalPaid + finalUnpaid).toLocaleString()}`}
              />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Income</Text>
                <Text style={[styles.totalValue, { color: COLORS.brandBlue }]}>
                  ₹{(finalPaid + finalUnpaid).toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />

            <View style={[styles.financeColumn, { gap: 8 }]}>
              <Text style={styles.subHeading}>EXPENSE</Text>
              <MetricBadge label="Income Expense" value="₹1,000" />
              <MetricBadge label="Pending Expense" value="N/A" />
              <MetricBadge label="Expense Ledger" value="N/A" />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Expense</Text>
                <Text style={[styles.totalValue, { color: COLORS.brandRed }]}>
                  ₹1,000
                </Text>
              </View>
            </View>
          </View>
        </View> */}
          <Modal
            visible={showDiscountModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDiscountModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.discountModalContent}>
                <View style={styles.discountModalHeader}>
                  <Text style={styles.discountModalTitle}>
                    Discounted Students
                  </Text>
                  <TouchableOpacity onPress={() => setShowDiscountModal(false)}>
                    <Text style={styles.discountModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                {discountLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : discountStudents.length > 0 ? (
                  <FlatList
                    data={discountStudents}
                    keyExtractor={(item, index) => `${item.name}-${index}`}
                    renderItem={({ item, index }) => (
                      <View style={styles.discountRow}>
                        <Text style={styles.discountName}>
                          {index + 1}. {item.name}
                        </Text>
                        <Text style={styles.discountAmount}>
                          ₹{Number(item.discount).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                  />
                ) : (
                  <Text style={styles.discountEmpty}>
                    No discounted students found for selected dates.
                  </Text>
                )}
              </View>
            </View>
          </Modal>

          <Modal
            visible={showSubstituteModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowSubstituteModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.discountModalContent}>
                <View style={styles.discountModalHeader}>
                  <Text style={styles.discountModalTitle}>
                    Assign Substitute
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowSubstituteModal(false)}
                  >
                    <Text style={styles.discountModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                {!selectedAbsentTeacher ? (
                  <>
                    <Text style={styles.discountEmpty}>
                      Select absent teacher first
                    </Text>
                    <FlatList
                      data={absentTeachers}
                      keyExtractor={(item, index) =>
                        String(item.teacher_id || index)
                      }
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.absentRow}
                          onPress={() => {
                            console.log(
                              '🟪 [ChiefDashboard] selected absent teacher:',
                              item,
                            );
                            setSelectedAbsentTeacher(item);
                          }}
                        >
                          <Text style={styles.discountName}>{item.name}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.discountName}>
                      Absent: {selectedAbsentTeacher.name}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Period (e.g. 1)"
                      value={subPeriod}
                      onChangeText={setSubPeriod}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Subject (optional, for log)"
                      value={subSubject}
                      onChangeText={setSubSubject}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Substitute Teacher ID"
                      value={substituteId}
                      onChangeText={setSubstituteId}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Class ID"
                      value={subClassId}
                      onChangeText={setSubClassId}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Section ID"
                      value={subSectionId}
                      onChangeText={setSubSectionId}
                    />

                    <View
                      style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}
                    >
                      <TouchableOpacity
                        style={[styles.approveBtn, { backgroundColor: '#777' }]}
                        onPress={() => setSelectedAbsentTeacher(null)}
                      >
                        <Text style={styles.approveText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.approveBtn,
                          { backgroundColor: '#2e7d32' },
                        ]}
                        onPress={submitSubstituteAssignment}
                        disabled={assignLoading}
                      >
                        <Text style={styles.approveText}>
                          {assignLoading ? 'Saving...' : 'Submit'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>
    
          <Modal
            visible={showProfileModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowProfileModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.profileModalContent}>
                <View style={styles.profileModalHeader}>
                  <Text style={styles.profileModalTitle}>Chief Profile</Text>
                  <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                    <Text style={styles.profileModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.profileAvatarWrap}>
                  <Text style={styles.profileAvatarText}>
                    {(chiefProfile.name || chiefProfile.username || 'C')
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View style={styles.profileDetailsCard}>
                  {[
                    { label: 'Name', value: chiefProfile.name || '-' },
                    { label: 'Username', value: chiefProfile.username || '-' },
                    {
                      label: 'Designation',
                      value: chiefProfile.designation || '-',
                    },
                    
                    { label: 'Phone', value: chiefProfile.phoneNo || '-' },
                    { label: 'Email', value: chiefProfile.email || '-' },
                  ].map(item => (
                    <View key={item.label} style={styles.profileRow}>
                      <Text style={styles.profileLabel}>{item.label}</Text>
                      <Text style={styles.profileValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.profileLogoutButton}
                  onPress={handleChiefLogout}
                >
                  <Text style={styles.profileLogoutText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>

        {showFooterNav && (
          <LinearGradient
            colors={['#FFFFFF', '#FBFBFD', '#F4F1FF']}
            start={{ x: 0.08, y: 0.05 }}
            end={{ x: 0.95, y: 1 }}
            style={[appStyles.footer, styles.fixedFooter, styles.curvedFooter]}
          >
            <View style={[appStyles.footerNav, styles.footerDockRow]}>
              <Pressable
                style={[appStyles.footerNavItem, styles.footerNavItemLeft]}
                onPress={handleGoBack}
              >
                <Image source={backArrowImage} style={{ width: 22, height: 22 }} resizeMode="contain" />
                <Text style={appStyles.footerNavLabel}>Back</Text>
              </Pressable>
              <Pressable
                style={[appStyles.footerNavItem, styles.footerNavItemLeft]}
                onPress={() => setSelectedChip('Overview')}
              >
                <Ionicons name="home" size={18} color="#111" />
                <Text style={appStyles.footerNavLabel}>Home</Text>
              </Pressable>
              <Pressable
                style={styles.footerAddButtonFloating}
                onPress={() => setShowSummary(true)}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 26,
                    fontWeight: '700',
                    marginTop: -2,
                  }}
                >
                  +
                </Text>
              </Pressable>
              <Pressable
                style={[appStyles.footerNavItem, styles.footerNavItemRight]}
                onPress={() => setSelectedChip('Actions')}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#B0B0B5" />
                <Text style={appStyles.footerNavLabelMuted}>Chat</Text>
              </Pressable>
              <Pressable
                style={[appStyles.footerNavItem, styles.footerNavItemRight]}
                onPress={handleOpenProfilePanel}
              >
                <Ionicons name="person-outline" size={18} color="#B0B0B5" />
                <Text style={appStyles.footerNavLabelMuted}>Profile</Text>
              </Pressable>
            </View>
            <View style={appStyles.footerBrandRow}>
              <Text style={appStyles.poweredBy}>Powered By</Text>
              <ImageBackground
                source={require('../assets/Cleezo.png')}
                style={appStyles.logo}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerRow1: { flexDirection: 'row', justifyContent: 'space-between', marginTop:'40' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop:'5' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#333' },
  subTitle: { fontSize: 14, color: '#666' },
  sectionHeader: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  monthPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  monthPickerSheet: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 12,
  },
  monthPickerFrame: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  monthPicker: {
    width: '100%',
    height: 220,
    color: '#000',
  },
  monthPickerDoneBtn: {
    marginTop: 16,
    alignSelf: 'flex-end',
    backgroundColor: '#4B3CE2',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  monthPickerDoneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  mainGraphCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
    height: SCREEN_HEIGHT * 0.25,
    elevation: 3,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#000',
  },
  internalTotalRow: {
    flexDirection: 'row',
    marginBottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 10,
    marginTop: -40,
  },
  centerAlign: { alignItems: 'center' },
  internalLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  internalValue: { fontSize: 12, fontWeight: 'bold' },
  chartContainer: {
    width: FIXED_CARD_WIDTH,
    height: 418,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  pieChartNoShadow: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  pieCardGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 18,
    overflow: 'hidden',
    shadowColor: '#B49BFF',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  pieCardTopGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    opacity: 0.9,
  },
  pieCardSoftShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    opacity: 0.9,
  },
  pieCardInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
    borderRadius: 20,
  },
  pieChartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 6,
  },
  pieCardHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 6,
    marginBottom: 8,
    zIndex: 2,
  },
  pieCardHeaderLeft: {
    flexShrink: 1,
  },
  pieCardHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C7C88',
    letterSpacing: 0.2,
  },
  pieCardHeaderValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#17171D',
    marginTop: 2,
  },
  pieCardHeaderBadge: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#9E8BEA',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pieCardHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4A4A55',
  },
  pieCenterLabel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenterDueLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#70707A',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  pieCenterDueValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#17171D',
    letterSpacing: -0.5,
    marginTop: 0,
  },
  pieCenterSliceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5E5E6A',
    marginTop: 6,
  },
  pieCenterSliceValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5E5E6A',
    marginTop: 1,
  },
  pieLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  pieLegendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A2A2A',
  },
  pieEmptyState: {
    width: '100%',
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  pieEmptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  pieEmptyText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#66666D',
    textAlign: 'center',
  },
  heroGraphCard: {
    width: '100%',
    minHeight: SCREEN_HEIGHT * 0.28,
    marginBottom: 12,
  },
  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  curvedFooter: {
    alignSelf: 'center',
    width: SCREEN_WIDTH - 16,
    marginHorizontal: 8,
    marginBottom: 8,
    borderTopWidth: 0,
    borderRadius: 40,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: 'visible',
  },
  footerDockRow: {
    paddingHorizontal: 14,
    alignItems: 'center',
    paddingTop: 2,
    justifyContent: 'space-between',
  },
  footerNavItemLeft: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  footerNavItemRight: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  footerAddButtonFloating: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F14A40',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: '#FFF',
    marginTop: -34,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  yAxis: {
    height: 120,
    justifyContent: 'space-between',
    paddingRight: 12,
    minWidth: 60,
  },
  xAxis: { flexDirection: 'row', marginTop: -20, height: 20 },
  axisText: { color: '#555', fontSize: 9, fontWeight: '600' },
  hContainer: { marginBottom: 10, marginTop: 0 },
  hRow: { flexDirection: 'row' },
  hTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  actionBg: { padding: 16, borderRadius: 12, overflow: 'hidden' },
  actionImage: {
    borderRadius: 12,
    opacity: 0.8,
    backgroundColor: '#000',
    height: 60,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionHeaderTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  actionText: { color: '#fff', fontSize: 10, fontWeight: '600', flex: 1 },
  actionBodyText: {
    color: '#202124',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  actionSubText: {
    color: '#5F6368',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  actionSubTextLight: { color: '#fff', fontSize: 9, marginTop: 1 },
  chiefGradientCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  chiefGradientIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  chiefGradientLabel: {
    color: '#191919',
    fontSize: 13.5,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'left',
    alignSelf: 'flex-start',
    minHeight: 32,
    marginTop: 12,
    paddingHorizontal: 0,
    maxWidth: '100%',
  },
  actionCard: {
    width: SCREEN_WIDTH * 0.88,
    height: 132,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionGradientCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  actionCardTitle: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 18,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactBtnRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionMetaPill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f6f6f7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  actionMetaPillMuted: {
    backgroundColor: '#D7E7CD',
    borderWidth: 1,
    borderColor: '#A8C597',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  actionMetaPillText: {
    color: '#202124',
    fontSize: 10,
    fontWeight: '800',
  },
  actionApproveYes: {
    backgroundColor: '#4CAF50',
    borderColor: '#2E7D32',
  },
  actionApproveNo: {
    backgroundColor: '#F44336',
    borderColor: '#C62828',
  },
  actionAssignBtn: {
    backgroundColor: '#404040',
    borderColor: '#111111',
  },
  approveBtn: {
    backgroundColor: '#404040',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#111111',
  },
  approveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  smallCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    width: '48%',
    borderWidth: 2,
    borderColor: '#000',
    elevation: 4,
    marginBottom: 10,
  },
  cardTitle: { marginTop: 10, fontSize: 12, fontWeight: '600' },
  smallCard1: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    padding: 12,
    minHeight: SCREEN_HEIGHT * 0.25,
    borderWidth: 2,
    borderColor: '#000',
    marginRight: 15,
  },
  cardImageBg: {
    width: 280,
    height: SCREEN_HEIGHT * 0.29,
    position: 'absolute',
    right: -12,
    top: -35,
  },
  plusIconBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 20,
    backgroundColor: '#ff6b6b',
    borderRadius: 20,
    elevation: 5,
  },
  plusText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  headerText: { fontSize: scaleFont(16), fontWeight: 'bold', color: '#000' },
  footerWrapper: {
    position: 'absolute',
    bottom: -60, // ✅ 30px from bottom
    left: 0,
    right: 0,
  },
  divider: {
    width: 1, // thickness of the line
    backgroundColor: '#ccc', // line color
    marginHorizontal: 10, // spacing around the line
  },
  subHeading: {
    color: 'black',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  footerWrapper1: {
    position: 'absolute',
    bottom: hp('-2%'), // 1% from the very bottom of the screen
    left: 0,
    right: 0,
    alignItems: 'center', // Centers children horizontally
    justifyContent: 'center',
    zIndex: 99, // Ensures it stays above all other content
  },

  metricBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    marginBottom: 2,
    gap: 3, // <-- gap between label and value
  },
  bullet: {
    fontSize: 11, // bigger bullet
    color: '#fff', // same color as label
  },
  badgeLabel: {
    color: '#000',
    fontSize: 11,
  },
  badgeValue: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
  },
  financeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  commerceSummaryCard: {
    width: FIXED_CARD_WIDTH,
    minHeight: SCREEN_HEIGHT * 0.22,
  },
  commerceGraphCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    padding: 10,
    marginBottom: 10,
  },
  commerceGraphHeader: {
    marginBottom: 8,
  },
  commerceGraphTitle: {
    color: '#111',
    fontSize: 13,
    fontWeight: '700',
  },
  commerceGraphSubtitle: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  commerceLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 6,
  },
  commerceLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commerceLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  commerceLegendText: {
    color: '#333',
    fontSize: 10,
    fontWeight: '600',
  },
  commerceNoData: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 12,
  },
  profileModalContent: {
    width: '92%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  profileModalTitle: {
    color: '#111',
    fontSize: 18,
    fontWeight: '800',
  },
  profileModalClose: {
    color: 'red',
    fontSize: 18,
    fontWeight: '700',
  },
  profileAvatarWrap: {
    alignSelf: 'center',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#eceef3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  profileAvatarText: {
    color: '#111',
    fontSize: 28,
    fontWeight: '800',
  },
  profileDetailsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ececec',
    backgroundColor: '#fafafa',
    padding: 12,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#efefef',
  },
  profileLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  profileValue: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
    flex: 1.4,
    textAlign: 'right',
  },
  profileLogoutButton: {
    marginTop: 14,
    backgroundColor: '#f44336',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  profileLogoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    padding: 6,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#000',
    // Shadow
    shadowColor: '#000000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 5,
    height: SCREEN_HEIGHT * 0.22,
  },
  financeColumn: {
    flex: 1,
    paddingHorizontal: 3,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderTopWidth: 1,
    marginTop: 3,
  },
  totalLabel: {
    color: '#000',
    fontSize: 8,
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  summaryModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  summaryBranchCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ececec',
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  summaryBranchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  summaryMetricCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ebebeb',
  },
  summaryMetricCardPaid: {
    backgroundColor: '#e8f7e8',
    borderColor: '#b9e3b9',
  },
  summaryMetricCardDue: {
    backgroundColor: '#fdeaea',
    borderColor: '#f6c3c3',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#444',
  },
  summaryValue: {
    color: '#111',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  discountModalContent: {
    width: '92%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  discountModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  discountModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  discountModalClose: {
    fontSize: 18,
    color: 'red',
    fontWeight: '700',
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  discountName: {
    color: '#111',
    fontSize: 13,
    flex: 1,
    paddingRight: 10,
  },
  discountAmount: {
    color: '#0d5f1f',
    fontWeight: '700',
    fontSize: 13,
  },
  discountEmpty: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  absentRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    fontSize: 12,
    color: '#111',
  },
  leftContainer: { flexDirection: 'row', alignItems: 'center' },
  schoolName: { fontSize: 16, fontWeight: 'bold', marginRight: 10 },
  branchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  branchText: {
    fontSize: 12,
    marginRight: 5,
    color: '#a5a3a3ff',
    textTransform: 'uppercase', // 👈 Add this
    // 👈 Add this
  },

  dropdownList: {
    width: 250,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
  dropdownItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  dropdownItemText: { fontSize: 14, color: '#111827' },
  branchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 10,
  },

  branchButtonActive: {
    backgroundColor: 'transparent',
    fontSize: 12,
  },

  branchTextActive: {
    color: '#000',
    fontWeight: '300',
  },
  chiefSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  chiefSummaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECECEC',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  chiefSummaryLabel: {
    fontSize: 10,
    color: '#6A6A70',
    fontWeight: '700',
    marginBottom: 4,
  },
  chiefSummaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#171717',
  },
});

export default ChiefDashboard;
