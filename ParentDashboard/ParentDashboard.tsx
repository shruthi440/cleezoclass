import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Svg, { Circle, Path } from 'react-native-svg';

import { createAppStyles } from '../App.styles';
import { RootStackParamList } from '../types';
import ParentAcademic from './ParentAcademic';
import ParentAttendance from './ParentAttendance';
import ParentHomework from './ParentHomwork';
import ParentFees from './ParentFees';
import ParentTimetable from './ParentTimetable';
import ParentCalender from './ParentCalender';
import ParentPhotos from './ParentPhotos';
import ParentLiveChatTicket from './ParentLiveChatTicket';
import ParentHomepage from './parentEvents';
import ParentAnnouncements from './ParentAnnouncements';
import ParentMessage from './parent_msg';

const ParentHomeworkView = ParentHomework as unknown as React.ComponentType<any>;
const ParentAcademicView = ParentAcademic as unknown as React.ComponentType<any>;
const ParentFeesView = ParentFees as unknown as React.ComponentType<any>;
const ParentTimetableView = ParentTimetable as unknown as React.ComponentType<any>;
const ParentCalenderView = ParentCalender as unknown as React.ComponentType<any>;
const ParentPhotosView = ParentPhotos as unknown as React.ComponentType<any>;
const ParentLiveChatTicketView = ParentLiveChatTicket as unknown as React.ComponentType<any>;
const ParentHomepageView = ParentHomepage as unknown as React.ComponentType<any>;

type IconKind = 'material' | 'fontawesome';
type ParentModuleRoute =
  | 'AcademicSummary'
  | 'FeesSummary'
  | 'ParentReports'
  | 'ParentAcademic'
  | 'ParentAttendance'
  | 'ParentFees'
  | 'ParentHomework'
  | 'ParentTimetable'
  | 'ParentCalender'
  | 'ParentPhotos'
  | 'ParentLiveChatTicket'
  | 'ParentMessage'
  | 'ParentHomepage'
  | 'ParentAnnouncements';

type ParentTile = {
  label: string;
  icon: string;
  kind: IconKind;
  route: ParentModuleRoute;
  component: React.ComponentType<any>;
  iconColor: string;
  borderColor: string;
  iconBg: string;
  cardBg: string;
  metaLabel: string;
  metaValue: string;
};

type ParentChild = {
  id: number | string;
  name?: string;
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
};

type BehaviourReport = {
  positivePercentage: number;
  needsImprovementPercentage: number;
  negativePercentage: number;
  comments: {
    Positive?: string[];
    NeedsToImprovement?: string[];
    Negative?: string[];
  };
};

type AcademicReportRow = {
  subject: string;
  totalMarks: number;
};

type OverallAttendanceReport = {
  presentPercentage: number;
  informedPercentage: number;
  uninformedPercentage: number;
  presentDays: number;
};

type ReportSlice = {
  label: string;
  value: number;
  color: string;
  detail?: string;
};

const logoImage: ImageSourcePropType = require('../assets/Cleezo.png');
const backArrowImage: ImageSourcePropType = require('../assets/Arrow.png');
const studentPhotoUploadBase = 'https://cleezoclass.com:4000/CRM/public/uploads';

const normalizeInstituteLogo = (rawLogo: any) => {
  if (!rawLogo) return '';

  let logo = rawLogo;

  if (typeof logo === 'object' && logo?.type === 'Buffer' && Array.isArray(logo?.data)) {
    try {
      const bytes = new Uint8Array(logo.data);
      const bufferCtor = (globalThis as any).Buffer;
      const bufferBase64 = bufferCtor ? bufferCtor.from(bytes).toString('base64') : '';
      return bufferBase64 ? `data:image/png;base64,${bufferBase64}` : '';
    } catch {
      return '';
    }
  }

  if (typeof logo !== 'string') return '';
  logo = logo.trim();
  if (!logo) return '';
  if (logo.startsWith('data:image')) return logo;
  if (logo.startsWith('http')) return logo;

  if (logo.startsWith('uploads/')) {
    return `https://cleezoclass.com:4000/${logo}`;
  }

  if (logo.startsWith('/uploads/')) {
    return `https://cleezoclass.com:4000${logo}`;
  }

  if (/^[A-Za-z0-9+/=]+$/.test(logo) && logo.length > 100) {
    return `data:image/png;base64,${logo}`;
  }

  return '';
};

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

const resolveStudentPhotoUri = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const buildUploadUrl = (path: string) => {
    const cleanPath = String(path || '').trim().replace(/^\/+/, '');
    if (!cleanPath) return studentPhotoUploadBase;

    const relativePath = cleanPath
      .replace(/^CRM\/public\/uploads\/?/i, '')
      .replace(/^uploads\/?/i, '')
      .replace(/^\/+/, '');

    return `${studentPhotoUploadBase}/${relativePath}`;
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

const resolveRenderablePhotoUri = (value?: string | null) => {
  const uri = resolveStudentPhotoUri(value);
  if (!uri) return '';
  if (uri.startsWith('data:image')) return uri;
  try {
    return encodeURI(uri);
  } catch {
    return uri;
  }
};

const normalizeFeeKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

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

const formatFeeLabel = (key: string) =>
  String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bFees\b/g, 'Fee')
    .trim();

const toFeeNumber = (value: any) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mergeFeeData = (classFeeData: Record<string, any> | null, studentFeeData: Record<string, any> | null) => {
  const merged: Record<string, any> = { ...(classFeeData || {}) };

  Object.entries(studentFeeData || {}).forEach(([key, studentValue]) => {
    if (studentValue === null || studentValue === undefined || studentValue === '') return;

    const classValue = merged[key];
    const studentLooksNumeric =
      typeof studentValue === 'number' ||
      (typeof studentValue === 'string' && studentValue.trim() !== '' && !Number.isNaN(Number(studentValue)));

    if (studentLooksNumeric) {
      const studentAmount = toFeeNumber(studentValue);
      const classAmount = toFeeNumber(classValue);
      if (studentAmount === 0 && classAmount > 0) return;
    }

    merged[key] = studentValue;
  });

  return merged;
};

const isStudentScopedFee = (scope?: string) =>
  /student|individual|personal|per\s*student/i.test(String(scope || ''));

const isClassScopedFee = (scope?: string) =>
  /class|section|batch|group/i.test(String(scope || ''));

const buildFeeRowsFromSource = (
  paymentSource: Record<string, any> | null,
  amountSource: Record<string, any> | null,
  dynamicFeeTypes: Array<{ feeName?: string; feesType?: string; columnBase?: string; scope?: string }> = [],
) => {
  if (!paymentSource && !amountSource) return [];

  const paymentEntries = Object.entries(paymentSource || {}).map(([key, value]) => [normalizeFeeKey(key), value] as const);
  const amountEntries = Object.entries(amountSource || {}).map(([key, value]) => [normalizeFeeKey(key), value] as const);
  const paymentLookup = new Map<string, any>(paymentEntries);
  const amountLookup = new Map<string, any>(amountEntries);

  const exactLookup = (keys: string[], lookups: Array<Map<string, any>>) => {
    for (const key of keys) {
      const variants = buildFeeKeyVariants(key);
      for (const sourceLookup of lookups) {
        for (const variant of variants) {
          if (!sourceLookup.has(variant)) continue;
          const numeric = toFeeNumber(sourceLookup.get(variant));
          if (numeric || sourceLookup.get(variant) === 0) return numeric;
        }
      }
    }
    return 0;
  };

  const findFirstValue = (keys: string[], lookups: Array<Map<string, any>> = [paymentLookup, amountLookup]) =>
    exactLookup(keys, lookups);

  const findBestAmountValue = (keys: string[], lookups: Array<Map<string, any>> = [amountLookup, paymentLookup]) =>
    exactLookup(keys, lookups);

  const rows: Array<{ label: string; amount: number; paid: number; discount: number; due: number }> = [];
  const seen = new Set<string>();

  const addRow = (label: string, amount: number, paid: number, discount: number) => {
    const due = Math.max(amount - paid - discount, 0);
    const key = normalizeFeeKey(label);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ label, amount, paid, discount, due });
  };

  const dynamicTypesByBase = new Map<string, { feeName?: string; feesType?: string; columnBase?: string; scope?: string }>();
  dynamicFeeTypes.forEach((item) => {
    const label = String(item?.feeName || item?.feesType || '').trim();
    const base = normalizeFeeKey(item?.columnBase || label);
    if (base) dynamicTypesByBase.set(base, item);
  });

  dynamicTypesByBase.forEach((item, base) => {
    const label = String(item?.feeName || item?.feesType || base).trim();
    const scope = String(item?.scope || '').trim();
    const amountLookups = isStudentScopedFee(scope)
      ? [paymentLookup, amountLookup]
      : isClassScopedFee(scope)
      ? [amountLookup, paymentLookup]
      : [amountLookup, paymentLookup];
    const amount = findBestAmountValue([base, `${base}_fee`, `${base}_fees`, `${base}_amount`, label], amountLookups);
    const paid = findFirstValue([`${base}_paid`, `${base}Paid`, `${label}_paid`, `${label}Paid`], [paymentLookup, amountLookup]);
    const discount = findFirstValue([`${base}_discount`, `${base}Discount`, `${label}_discount`, `${label}Discount`], [paymentLookup, amountLookup]);
    const due = findFirstValue([`${base}_due`, `${base}Due`, `${label}_due`, `${label}Due`], [paymentLookup, amountLookup]);
    const finalLabel = formatFeeLabel(label || base);
    addRow(finalLabel, amount, paid, discount);
    if (seen.has(normalizeFeeKey(finalLabel))) {
      const existing = rows.find((row) => normalizeFeeKey(row.label) === normalizeFeeKey(finalLabel));
      if (existing) {
        if (existing.amount > 0) {
          existing.due = Math.max(existing.amount - existing.paid - existing.discount, 0);
        } else if (due > 0) {
          existing.amount = Math.max(existing.amount, existing.paid + existing.discount + due);
          existing.due = due;
        }
      }
    }
  });

  return rows;
};

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const topChips = ['Overview', 'Learning', 'Attendance', 'Support', 'Events'];

const parentTiles: ParentTile[] = [
  {
    label: 'Academic',
    icon: 'school',
    kind: 'material',
    route: 'ParentAcademic',
    component: ParentAcademic,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Summary',
    metaValue: '',
  },
  {
    label: 'Reports',
    icon: 'assessment',
    kind: 'material',
    route: 'ParentReports',
    component: ParentAcademic,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Academics',
    metaValue: '',
  },
  {
    label: 'Homework',
    icon: 'assignment',
    kind: 'material',
    route: 'ParentHomework',
    component: ParentHomework,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Tasks',
    metaValue: '',
  },
  {
    label: 'Fees',
    icon: 'payments',
    kind: 'material',
    route: 'ParentFees',
    component: ParentFees,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Summary',
    metaValue: '',
  },
  {
    label: 'Attendance',
    icon: 'event-note',
    kind: 'material',
    route: 'ParentAttendance',
    component: ParentAttendance,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Leaves',
    metaValue: '',
  },
  {
    label: 'Timetable',
    icon: 'schedule',
    kind: 'material',
    route: 'ParentTimetable',
    component: ParentTimetable,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Slot',
    metaValue: '',
  },
  {
    label: 'Calendar',
    icon: 'event',
    kind: 'material',
    route: 'ParentCalender',
    component: ParentCalender,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Events',
    metaValue: '',
  },
  {
    label: 'Photos',
    icon: 'photo-library',
    kind: 'material',
    route: 'ParentPhotos',
    component: ParentPhotos,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Gallery',
    metaValue: '',
  },
  {
    label: 'Messages',
    icon: 'message',
    kind: 'material',
    route: 'ParentMessage',
    component: ParentMessage,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Chat',
    metaValue: '',
  },
  {
    label: 'Chat & Tickets',
    icon: 'chat',
    kind: 'material',
    route: 'ParentLiveChatTicket',
    component: ParentLiveChatTicket,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Support',
    metaValue: '',
  },
  {
    label: 'Announcements',
    icon: 'campaign',
    kind: 'material',
    route: 'ParentAnnouncements',
    component: ParentAnnouncements,
    iconColor: '#000000',
    borderColor: '#D9DDE5',
    iconBg: '#FFFFFF',
    cardBg: '#FFFFFF',
    metaLabel: 'Updates',
    metaValue: '',
  },
];

const parentDashboardCardStyles = StyleSheet.create({
  cardWrapper: {
    width: '46.6%',
    minHeight: 112,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: 12,
    overflow: 'visible',
  },
  card: {
    width: '100%',
    minHeight: 112,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#D8DDE6',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  cardActive: {
    borderColor: '#B59BF4',
  },
  cornerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 34,
    height: 112,
    overflow: 'hidden',
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 80,
    backgroundColor: 'transparent',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  cardContent: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    paddingTop: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 14,
    textAlign: 'right',
    fontWeight: '800',
    color: '#222222',
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 0,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'right',
    color: '#6C6C74',
    fontWeight: '600',
    marginTop: 4,
    paddingHorizontal: 4,
  },
});

const reportStyles = StyleSheet.create({
  shell: {
    paddingTop: 4,
  },
  overallCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  chartCard: {
    width: '48%',
    minHeight: 268,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  wideChartCard: {
    width: '100%',
    minHeight: 236,
  },
  chartTitle: {
    fontSize: 15,
    lineHeight: 19,
    color: '#111111',
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartCenterText: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    alignItems: 'center',
  },
  chartCenterValue: {
    fontSize: 18,
    lineHeight: 22,
    color: '#111111',
    fontWeight: '900',
  },
  chartCenterLabel: {
    fontSize: 10,
    lineHeight: 13,
    color: '#666A73',
    fontWeight: '700',
    marginTop: 2,
  },
  legendWrap: {
    width: '100%',
    marginTop: 12,
    gap: 7,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginRight: 7,
  },
  legendText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    color: '#333740',
    fontWeight: '700',
  },
  reportHint: {
    fontSize: 12,
    lineHeight: 16,
    color: '#666A73',
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  summaryCard: {
    width: '47%',
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECEEF3',
    backgroundColor: '#F8F9FC',
    padding: 12,
  },
  fullCard: {
    width: '100%',
  },
  cardLabel: {
    fontSize: 12,
    lineHeight: 15,
    color: '#666A73',
    fontWeight: '700',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 20,
    lineHeight: 25,
    color: '#101114',
    fontWeight: '900',
  },
  cardHint: {
    fontSize: 12,
    lineHeight: 16,
    color: '#666A73',
    fontWeight: '600',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 19,
    color: '#101114',
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 10,
  },
  progressRow: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#333740',
    fontWeight: '800',
  },
  progressValue: {
    fontSize: 12,
    lineHeight: 16,
    color: '#333740',
    fontWeight: '900',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ECEEF3',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  commentBox: {
    borderRadius: 12,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#ECEEF3',
    padding: 12,
    marginBottom: 8,
  },
  commentLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#333740',
    fontWeight: '900',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#666A73',
    fontWeight: '600',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: '#17477F',
    paddingHorizontal: 10,
    height: 34,
    minWidth: 98,
  },
  downloadButtonDisabled: {
    opacity: 0.62,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  reportCardOuter: {
    borderWidth: 2,
    borderColor: '#9BB8D8',
    backgroundColor: '#F7FBFF',
    padding: 5,
    marginTop: 12,
  },
  reportCardInner: {
    borderWidth: 1,
    borderColor: '#2F63A3',
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  schoolTitle: {
    color: '#16457E',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  reportSubtitle: {
    color: '#56718F',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#C6D8EB',
    paddingBottom: 8,
  },
  reportLogoBox: {
    width: 58,
    borderWidth: 1,
    borderColor: '#C6D8EB',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  reportLogoImage: {
    width: 50,
    height: 46,
  },
  reportLogoText: {
    color: '#16457E',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  identityGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  identityCell: {
    width: '32%',
    minHeight: 25,
    borderWidth: 1,
    borderColor: '#C6D8EB',
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 2,
    backgroundColor: '#F9FCFF',
  },
  identityText: {
    color: '#0E2742',
    fontSize: 8,
    lineHeight: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  identityLabel: {
    fontWeight: '900',
  },
  studentPhotoBox: {
    width: 58,
    borderWidth: 1,
    borderColor: '#C6D8EB',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  studentPhotoImage: {
    width: '100%',
    height: '100%',
  },
  studentPhotoText: {
    color: '#33485F',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  reportSectionHeader: {
    borderWidth: 1,
    borderColor: '#9CB9D9',
    borderRadius: 4,
    backgroundColor: '#EAF1F8',
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginTop: 10,
  },
  reportSectionTitle: {
    color: '#17477F',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  reportTable: {
    minWidth: '100%',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: '#9FB0C7',
    marginTop: 6,
  },
  reportTableRow: {
    flexDirection: 'row',
  },
  reportTableHead: {
    backgroundColor: '#315E9F',
  },
  reportTh: {
    width: 52,
    minHeight: 27,
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#7E99BD',
    paddingVertical: 6,
  },
  reportTd: {
    width: 52,
    minHeight: 27,
    color: '#0E2742',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#9FB0C7',
    paddingVertical: 6,
    paddingHorizontal: 3,
  },
  subjectColumn: {
    width: 96,
  },
  behaviourTh: {
    width: 76,
    minHeight: 28,
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#7E99BD',
    paddingVertical: 6,
  },
  behaviourTd: {
    width: 76,
    minHeight: 34,
    color: '#0E2742',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#9FB0C7',
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  remarkColumn: {
    flex: 1,
    minWidth: 130,
  },
  attendanceTh: {
    flex: 1,
    minHeight: 27,
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#7E99BD',
    paddingVertical: 6,
  },
  attendanceTd: {
    flex: 1,
    minHeight: 27,
    color: '#0E2742',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#9FB0C7',
    paddingVertical: 6,
  },
  teacherRemarkBox: {
    borderWidth: 1,
    borderColor: '#C6D8EB',
    backgroundColor: '#FFFFFF',
    padding: 8,
    marginTop: 6,
  },
  teacherRemarkText: {
    color: '#0E2742',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  graphReportRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  graphReportBox: {
    flex: 1,
    minHeight: 78,
    borderWidth: 1,
    borderColor: '#C6D8EB',
    padding: 8,
    backgroundColor: '#FBFDFF',
  },
  graphReportTitle: {
    color: '#597CA5',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    marginBottom: 3,
  },
  graphReportText: {
    color: '#31516F',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
  },
});

const renderIcon = (kind: IconKind, name: string, color: string, size: number) => {
  if (kind === 'fontawesome') {
    return <FontAwesome name={name} size={size} color={color} />;
  }

  return <MaterialIcons name={name} size={size} color={color} />;
};

const clampPercent = (value: any) => Math.max(0, Math.min(100, Number(value) || 0));

const makePiePath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const startX = centerX + radius * Math.cos(startAngle);
  const startY = centerY + radius * Math.sin(startAngle);
  const endX = centerX + radius * Math.cos(endAngle);
  const endY = centerY + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
};

const ReportPie = ({
  slices,
  size = 150,
  fallbackColor = '#F0F1F5',
}: {
  slices: ReportSlice[];
  size?: number;
  fallbackColor?: string;
}) => {
  const radius = size / 2;
  const validSlices = slices.filter((slice) => Number(slice.value) > 0);
  const total = validSlices.reduce((sum, slice) => sum + Number(slice.value || 0), 0);

  if (!total) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={radius} cy={radius} r={radius} fill={fallbackColor} />
      </Svg>
    );
  }

  let startAngle = -Math.PI / 2;

  return (
    <Svg width={size} height={size}>
      {validSlices.map((slice) => {
        const angle = (Number(slice.value || 0) / total) * 2 * Math.PI;
        const endAngle = startAngle + angle;
        const path = makePiePath(radius, radius, radius, startAngle, endAngle);
        startAngle = endAngle;

        return <Path key={slice.label} d={path} fill={slice.color} stroke="#FFFFFF" strokeWidth={2} />;
      })}
    </Svg>
  );
};

const ReportLegend = ({ slices }: { slices: ReportSlice[] }) => (
  <View style={reportStyles.legendWrap}>
    {slices.map((slice) => (
      <View key={slice.label} style={reportStyles.legendItem}>
        <View style={[reportStyles.legendColor, { backgroundColor: slice.color }]} />
        <Text style={reportStyles.legendText} numberOfLines={2}>
          {slice.label}: {slice.detail || `${Math.round(Number(slice.value || 0))}%`}
        </Text>
      </View>
    ))}
  </View>
);

const computeAcademicSummary = (performance: any[], testTypes: any[]) => {
  const safePerformance = Array.isArray(performance) ? performance : [];
  const safeTestTypes = Array.isArray(testTypes) ? testTypes : [];

  if (!safePerformance.length) return { grade: '-', percentage: '0.00' };

  const fallbackTermRows = [
    { label: 'FA1', key: 'FA1' },
    { label: 'FA2', key: 'FA2' },
    { label: 'SA1', key: 'SA1' },
    { label: 'FA3', key: 'FA3' },
    { label: 'FA4', key: 'FA4' },
    { label: 'SA2', key: 'SA2' },
  ];

  const termRows = safeTestTypes.length
    ? safeTestTypes
        .filter((row: any) => row?.key && row?.label)
        .map((row: any) => ({ key: row.key, label: row.label }))
    : fallbackTermRows;

  const getLegacyMarkForRow = (subj: any, rowKey: string) => {
    const match = String(rowKey || '').toUpperCase().match(/^(FA|SA)(\d+)$/);
    if (!match) return { mark: '-', max: 0 };

    const type = match[1];
    const index = Number(match[2]) - 1;
    const mark = type === 'FA' ? subj?.FA?.[index] : subj?.SA?.[index];
    const max = type === 'FA' ? 20 : 80;

    return { mark: mark ?? '-', max: mark === null || mark === undefined ? 0 : max };
  };

  const getMarkForRow = (subj: any, row: any) => {
    const testEntry = subj?.tests?.[row?.key];
    if (testEntry?.obtained !== null && testEntry?.obtained !== undefined) {
      return testEntry.obtained;
    }
    return getLegacyMarkForRow(subj, row?.key).mark;
  };

  const getMaxForRow = (subj: any, row: any) => {
    const testEntry = subj?.tests?.[row?.key];
    if (testEntry?.max !== null && testEntry?.max !== undefined) {
      return Number(testEntry.max) || 0;
    }
    return getLegacyMarkForRow(subj, row?.key).max;
  };

  let obtained = 0;
  let total = 0;

  safePerformance.forEach((subj) => {
    termRows.forEach((row) => {
      const mark = getMarkForRow(subj, row);
      const maxMark = getMaxForRow(subj, row);
      const numericMark = Number(mark);

      if (
        mark !== '-' &&
        mark !== null &&
        mark !== undefined &&
        !Number.isNaN(numericMark) &&
        maxMark > 0
      ) {
        obtained += numericMark;
        total += maxMark;
      }
    });
  });

  const percentage = total > 0 ? ((obtained / total) * 100).toFixed(2) : '0.00';
  const pct = Number(percentage);
  let grade = 'D';
  if (pct >= 90) grade = 'A+';
  else if (pct >= 80) grade = 'A';
  else if (pct >= 70) grade = 'B+';
  else if (pct >= 60) grade = 'B';
  else if (pct >= 50) grade = 'C';

  return { grade, percentage };
};

const escapeHtml = (value: any) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getGradeFromPercent = (value: number) => {
  const pct = Number(value || 0);
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return pct > 0 ? 'D' : '-';
};

const formatReportPercent = (value: number) => `${Math.max(0, Math.min(100, Number(value || 0))).toFixed(1)}%`;

const ParentDashboard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const RNHTMLtoPDF = require('react-native-html-to-pdf').default;
  const [selectedChip, setSelectedChip] = useState<(typeof topChips)[number]>('Overview');
  const [selectedModule, setSelectedModule] = useState<ParentModuleRoute>('ParentAcademic');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [studentProfile, setStudentProfile] = useState<Record<string, any> | null>(null);
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [studentData, setStudentData] = useState<Record<string, any> | null>(null);
  const [teacherProfileCache, setTeacherProfileCache] = useState<Record<string, any> | null>(null);
  const [loginName, setLoginName] = useState('Parent');
  const [schoolLogo, setSchoolLogo] = useState<string>('');
  const [academicSummary, setAcademicSummary] = useState({ grade: '-', percentage: '0.00' });
  const [feeSummary, setFeeSummary] = useState({ paid: '₹ 0.00', due: '₹ 0.00', percent: '0' });
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any>(null);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [behaviourReport, setBehaviourReport] = useState<BehaviourReport | null>(null);
  const [behaviourLoading, setBehaviourLoading] = useState(false);
  const [academicReportRows, setAcademicReportRows] = useState<AcademicReportRow[]>([]);
  const [overallAttendanceReport, setOverallAttendanceReport] = useState<OverallAttendanceReport | null>(null);
  const [reportDataLoading, setReportDataLoading] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const parentActionAnimValues = useRef<Animated.Value[]>([]);
  const parentActionImageAnimValues = useRef<Animated.Value[]>([]);
  const parentActionImageLoops = useRef<Animated.CompositeAnimation[]>([]);
  const sectionPositions = useRef<Partial<Record<ParentModuleRoute, number>>>({});
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const styles = createAppStyles({ phoneWidth, phoneHeight });
  const normalizeText = (value: any) =>
    String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizePhone = (value: any) => String(value ?? '').replace(/\D/g, '');
  const normalizeValue = (value: any) => String(value || '').trim().toLowerCase();

  const cacheTeacherProfile = async (profile: Record<string, any> | null) => {
    if (!profile) return;
    try {
      await AsyncStorage.setItem('teacherProfile', JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to cache teacher profile:', error);
    }
  };

  const loadStudentData = async () => {
    try {
      const currentStudentRaw = await AsyncStorage.getItem('currentStudent');
      let currentStudent = null;
      if (currentStudentRaw) {
        try {
          currentStudent = JSON.parse(currentStudentRaw);
        } catch (parseError) {
          console.warn('Failed to parse currentStudent, falling back to stored keys only:', parseError);
        }
      }

      const keys = ['studentId', 'name', 'class_name', 'section', 'schoolCode', 'username', 'parentName'];
      const stores = await AsyncStorage.multiGet(keys);
      const data: Record<string, any> = {};
      stores.forEach(([key, value]) => {
        if (value) data[key] = value;
      });

      const merged = {
        ...(currentStudent || {}),
        ...data,
        photoUrl: resolveRenderablePhotoUri((currentStudent || {})?.photoUrl || data.photoUrl || data.photo || ''),
      };

      if (merged.studentId && !merged.id) merged.id = merged.studentId;
      if (merged.id && !merged.studentId) merged.studentId = merged.id;

      setStudentData(merged);
      setLoginName((current) => {
        if (current !== 'Parent') return current;
        return String(data.parentName || data.name || merged.name || current);
      });
      return merged;
    } catch (error) {
      console.error('Failed to load parent student data:', error);
      return null;
    }
  };

  const loadStudentProfile = async () => {
    try {
      setProfileLoading(true);
      const [username, schoolCode] = await Promise.all([
        AsyncStorage.getItem('username'),
        AsyncStorage.getItem('schoolCode'),
      ]);

      if (!username || !schoolCode) {
        setStudentProfile(null);
        return null;
      }

      const response = await fetch(
        `http://162.215.210.38:3010/api/student/profile?username=${encodeURIComponent(username)}&schoolCode=${encodeURIComponent(schoolCode)}`
      );
      const json = await response.json().catch(() => null);

      if (response.ok && json?.success && json?.student) {
        const nextProfile = {
          ...json.student,
          photoUrl: resolveRenderablePhotoUri(json.student.photoUrl || json.student.photo || ''),
        };
        setStudentProfile(nextProfile);
        await AsyncStorage.setItem('parentProfile', JSON.stringify(nextProfile));
        return nextProfile;
      }

      const fallbackProfile = {
        username,
        schoolCode,
        name: (await AsyncStorage.getItem('name')) || 'Parent',
        photoUrl: resolveRenderablePhotoUri((await AsyncStorage.getItem('photoUrl')) || ''),
      };
      setStudentProfile(fallbackProfile);
      await AsyncStorage.setItem('parentProfile', JSON.stringify(fallbackProfile));
      return fallbackProfile;
    } catch (error) {
      console.error('Failed to load parent profile:', error);
      setStudentProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  const loadChildren = async (profileLike?: Record<string, any> | null) => {
    try {
      setChildrenLoading(true);
      const base = profileLike || {};
      const username = String(base.username || (await AsyncStorage.getItem('username')) || '');
      const schoolCode = String(base.schoolCode || (await AsyncStorage.getItem('schoolCode')) || '');

      if (!username || !schoolCode) {
        setChildren([]);
        return [] as ParentChild[];
      }

      const profileRes = await axios.get('http://162.215.210.38:3010/api/student/profile', {
        params: { username, schoolCode },
      });

      if (!profileRes.data.success || !profileRes.data.student) {
        setChildren([]);
        return [] as ParentChild[];
      }

      const baseStudent = profileRes.data.student;
      const siblingsRes = await axios.post('http://162.215.210.38:3010/api/student/siblings', {
        username,
        schoolCode,
        father_name: baseStudent.father_name,
        phone_no: baseStudent.phone_no,
      });

      if (siblingsRes.data.success && Array.isArray(siblingsRes.data.siblings)) {
        const nextChildren = siblingsRes.data.siblings.map((child: any) => ({
          ...child,
          photoUrl: resolveRenderablePhotoUri(child.photoUrl || child.photo || ''),
        }));
        setChildren(nextChildren);
        return nextChildren;
      }

      setChildren([]);
      return [] as ParentChild[];
    } catch (error) {
      console.error('Failed to load parent children:', error);
      setChildren([]);
      return [] as ParentChild[];
    } finally {
      setChildrenLoading(false);
    }
  };
const loadSummaries = async (profileLike?: Record<string, any> | null, dataLike?: Record<string, any> | null) => {
  console.log('================ LOAD SUMMARIES START ================');

  const activeStudent = { ...(profileLike || {}), ...(dataLike || {}) };

  console.log('👨‍🎓 Active Student:', activeStudent);

  if (
    !activeStudent?.name ||
    !activeStudent?.class_name ||
    !activeStudent?.section ||
    !activeStudent?.schoolCode
  ) {
    console.log('❌ Missing required student data', {
      name: activeStudent?.name,
      class_name: activeStudent?.class_name,
      section: activeStudent?.section,
      schoolCode: activeStudent?.schoolCode,
    });
    return;
  }

  try {
    const studentId =
      activeStudent?.studentId ||
      activeStudent?.id ||
      (await AsyncStorage.getItem('studentId')) ||
      '';

    console.log('🆔 Student ID:', studentId);

    console.log('📡 Calling APIs...');

    const [academicRes, paymentRes] = await Promise.allSettled([
      axios.post(
        'https://cleezoclass.com:4000/api/overall/academic-performance',
        {
          name: activeStudent.name,
          class_name: activeStudent.class_name,
          section: activeStudent.section,
          schoolCode: activeStudent.schoolCode,
        }
      ),
      axios.get(
        `https://cleezoclass.com:4000/api/payment/${studentId}?schoolCode=${activeStudent.schoolCode}`
      ),
    ]);

    console.log('📚 Academic API Status:', academicRes.status);
    console.log('💰 Payment API Status:', paymentRes.status);

    if (academicRes.status === 'fulfilled') {
      console.log('📚 Academic Response:', academicRes.value.data);
    } else {
      console.error('❌ Academic API Failed:', academicRes.reason);
    }

    if (paymentRes.status === 'fulfilled') {
      console.log('💰 Payment Response:', paymentRes.value.data);
    } else {
      console.error('❌ Payment API Failed:', paymentRes.reason);
    }

    // Academic Summary
    const academicData =
      academicRes.status === 'fulfilled'
        ? academicRes.value.data
        : {};

    const performance = Array.isArray(academicData)
      ? academicData
      : academicData?.performance || academicData?.data || [];

    const testTypes = Array.isArray(academicData?.testTypes)
      ? academicData.testTypes
      : [];

    console.log('📖 Performance Data:', performance);
    console.log('📝 Test Types:', testTypes);

    const academicSummary = computeAcademicSummary(
      performance,
      testTypes
    );

    console.log('📊 Academic Summary:', academicSummary);

    setAcademicSummary(academicSummary);

    // Fee Summary
    const paymentData =
      paymentRes.status === 'fulfilled'
        ? paymentRes.value.data
        : null;

    console.log('💳 Full Payment Data:', paymentData);

    const dynamicBreakdown =
      paymentData?.payments?.dynamicFeeBreakdown || [];

    console.log(
      '💳 Dynamic Fee Breakdown:',
      JSON.stringify(dynamicBreakdown, null, 2)
    );

    if (dynamicBreakdown.length > 0) {
      const summaryRows = dynamicBreakdown.map((fee: any) => ({
        label: fee.label || fee.key || 'Fee',
        amount: Number(fee.total || 0),
        paid: Number(fee.paid || 0),
        discount: Number(fee.discount || 0),
        due: Number(fee.remaining || 0),
      }));

      console.log('📋 Summary Rows:', summaryRows);

      const totalAmount = summaryRows.reduce(
        (sum, row) => sum + row.amount,
        0
      );

      const paidAmount = summaryRows.reduce(
        (sum, row) => sum + row.paid,
        0
      );

      const discountAmount = summaryRows.reduce(
        (sum, row) => sum + row.discount,
        0
      );

      const calculatedDue = summaryRows.reduce(
        (sum, row) => sum + row.due,
        0
      );

      const totalDue = Number(
        paymentData?.payments?.totalRemaining || 0
      );

      console.log('💰 Fee Calculations:', {
        totalAmount,
        paidAmount,
        discountAmount,
        calculatedDue,
        backendTotalDue: totalDue,
      });

      const feeSummary = {
        paid: formatINR(paidAmount),
        due: formatINR(totalDue),
        percent:
          totalAmount > 0
            ? String(
                Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round((paidAmount / totalAmount) * 100)
                  )
                )
              )
            : '0',
      };

      console.log('📊 Final Fee Summary:', feeSummary);

      setFeeSummary(feeSummary);
    } else {
      console.warn(
        '⚠️ No dynamicFeeBreakdown found in payment response'
      );

      setFeeSummary({
        paid: '₹ 0.00',
        due: '₹ 0.00',
        percent: '0',
      });
    }

    console.log('================ LOAD SUMMARIES END ================');
  } catch (error) {
    console.error('❌ Failed to load parent summaries:', error);

    if (axios.isAxiosError(error)) {
      console.error('📛 Axios Error Response:', error.response?.data);
      console.error('📛 Axios Error Status:', error.response?.status);
      console.error('📛 Axios Error URL:', error.config?.url);
    }
  }
};

  const filteredAttendanceLeaves = useMemo(() => {
    const selectedUsername = normalizeValue(studentData?.username || studentProfile?.username);
    const selectedName = normalizeValue(studentData?.name || studentProfile?.name);
    const selectedClass = normalizeValue(studentData?.class_name || studentProfile?.class_name);
    const selectedSection = normalizeValue(studentData?.section || studentProfile?.section);

    return (Array.isArray(leaveData) ? leaveData : []).filter((item: any) => {
      const itemUsername = normalizeValue(item?.username);
      const itemName = normalizeValue(item?.student_name);
      const itemClass = normalizeValue(item?.class_name);
      const itemSection = normalizeValue(item?.section);

      const classSectionMatch = selectedClass && selectedSection
        ? itemClass === selectedClass && itemSection === selectedSection
        : true;

      const identityMatch = selectedName ? itemName === selectedName : false;
      const usernameMatch = selectedUsername ? itemUsername === selectedUsername : false;

      return (identityMatch && classSectionMatch) || (usernameMatch && classSectionMatch);
    });
  }, [leaveData, studentData?.username, studentData?.name, studentData?.class_name, studentData?.section, studentProfile?.username, studentProfile?.name, studentProfile?.class_name, studentProfile?.section]);

  useEffect(() => {
    const leaveCount = filteredAttendanceLeaves.length;
    setAttendanceCount(leaveCount);

    const leaveCountByType: Record<string, number> = {};
    filteredAttendanceLeaves.forEach((item: any) => {
      const key = String(item?.leave_type || 'Leave').trim() || 'Leave';
      leaveCountByType[key] = (leaveCountByType[key] || 0) + 1;
    });

    const labels = Object.keys(leaveCountByType);
    const data = Object.values(leaveCountByType);

    setAttendanceChartData(
      labels.length
        ? {
            labels,
            datasets: [{ data }],
          }
        : null
    );
  }, [filteredAttendanceLeaves]);

  useEffect(() => {
    const fetchAttendanceLeaves = async () => {
      try {
        const schoolCode = String(
          studentData?.schoolCode ||
          studentProfile?.schoolCode ||
          (await AsyncStorage.getItem('schoolCode')) ||
          ''
        ).trim();

        if (!schoolCode) {
          setLeaveData([]);
          return;
        }

        const response = await fetch(
          `http://162.215.210.38:3010/api/api/leave/all?schoolCode=${encodeURIComponent(schoolCode)}`
        );
        const data = await response.json().catch(() => []);
        setLeaveData(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load attendance leaves:', error);
        setLeaveData([]);
      }
    };

    void fetchAttendanceLeaves();
  }, [studentData?.schoolCode, studentProfile?.schoolCode]);

  useEffect(() => {
    const fetchBehaviourReport = async () => {
      const studentName = String(studentData?.name || studentProfile?.name || '').trim();
      const schoolCode = String(
        studentData?.schoolCode ||
          studentProfile?.schoolCode ||
          (await AsyncStorage.getItem('schoolCode')) ||
          ''
      ).trim();

      if (!studentName) {
        setBehaviourReport(null);
        return;
      }

      try {
        setBehaviourLoading(true);
        const reportUrl = schoolCode
          ? `http://162.215.210.38:3010/over-all-reports/report/${encodeURIComponent(studentName)}?schoolCode=${encodeURIComponent(schoolCode)}`
          : `http://162.215.210.38:3010/report/${encodeURIComponent(studentName)}`;
        let response = await fetch(reportUrl);
        let data = await response.json().catch(() => null);

        if (!response.ok && schoolCode) {
          response = await fetch(`http://162.215.210.38:3010/report/${encodeURIComponent(studentName)}`);
          data = await response.json().catch(() => null);
        }

        if (response.ok && data) {
          setBehaviourReport({
            positivePercentage: Number(data.positivePercentage || 0),
            needsImprovementPercentage: Number(data.needsImprovementPercentage || 0),
            negativePercentage: Number(data.negativePercentage || 0),
            comments: data.comments || {},
          });
        } else {
          setBehaviourReport(null);
        }
      } catch (error) {
        console.error('Failed to load behaviour report:', error);
        setBehaviourReport(null);
      } finally {
        setBehaviourLoading(false);
      }
    };

    void fetchBehaviourReport();
  }, [studentData?.name, studentData?.schoolCode, studentProfile?.name, studentProfile?.schoolCode]);

  useEffect(() => {
    const fetchReportCards = async () => {
      const studentName = String(studentData?.name || studentProfile?.name || '').trim();
      const schoolCode = String(
        studentData?.schoolCode ||
          studentProfile?.schoolCode ||
          (await AsyncStorage.getItem('schoolCode')) ||
          ''
      ).trim();

      if (!studentName || !schoolCode) {
        setAcademicReportRows([]);
        setOverallAttendanceReport(null);
        return;
      }

      try {
        setReportDataLoading(true);
        const [academicRes, attendanceRes] = await Promise.allSettled([
          axios.get('http://162.215.210.38:3010/over-all-reports/student-performance', {
            params: { name: studentName, schoolCode },
          }),
          axios.get(`http://162.215.210.38:3010/over-all-reports/attendance/${encodeURIComponent(studentName)}`, {
            params: { schoolCode },
          }),
        ]);

        if (academicRes.status === 'fulfilled' && academicRes.value.data) {
          const academicPayload = academicRes.value.data;
          const rows = Object.keys(academicPayload).map((subject) => ({
            subject,
            totalMarks: Number(academicPayload?.[subject]?.totalMarks || 0),
          }));
          setAcademicReportRows(rows.filter((row) => row.subject));
        } else {
          setAcademicReportRows([]);
        }

        if (attendanceRes.status === 'fulfilled' && attendanceRes.value.data) {
          const attendancePayload = attendanceRes.value.data;
          setOverallAttendanceReport({
            presentPercentage: clampPercent(attendancePayload.presentPercentage),
            informedPercentage: clampPercent(attendancePayload.informedPercentage),
            uninformedPercentage: clampPercent(attendancePayload.uninformedPercentage),
            presentDays: Number(attendancePayload.presentDays || 0),
          });
        } else {
          setOverallAttendanceReport(null);
        }
      } catch (error) {
        console.error('Failed to load report card charts:', error);
        setAcademicReportRows([]);
        setOverallAttendanceReport(null);
      } finally {
        setReportDataLoading(false);
      }
    };

    void fetchReportCards();
  }, [studentData?.name, studentData?.schoolCode, studentProfile?.name, studentProfile?.schoolCode]);

  const refreshParentAccount = async () => {
    const data = await loadStudentData();
    const profile = await loadStudentProfile();
    const activeStudent = {
      ...(profile || {}),
      ...(data || {}),
    };

    await Promise.all([loadChildren(activeStudent), loadSummaries(profile, data)]);
  };

  useEffect(() => {
    const loadTeacherProfileCache = async () => {
      try {
        const cachedTeacherProfileRaw = await AsyncStorage.getItem('teacherProfile');
        if (!cachedTeacherProfileRaw) {
          setTeacherProfileCache(null);
          return;
        }

        const cachedTeacherProfile = JSON.parse(cachedTeacherProfileRaw);
        setTeacherProfileCache(cachedTeacherProfile);
      } catch (error) {
        console.error('Failed to load cached teacher profile:', error);
        setTeacherProfileCache(null);
      }
    };

    void loadTeacherProfileCache();
  }, [showProfileModal]);

  useEffect(() => {
    const loadSchoolLogo = async () => {
      try {
        const schoolCode = String(
          studentData?.schoolCode ||
            (await AsyncStorage.getItem('schoolCode')) ||
            ''
        ).trim();

        if (!schoolCode) {
          setSchoolLogo('');
          return;
        }

        const response = await fetch(
          `https://cleezoclass.com:4000/api/institute?dbName=${encodeURIComponent(schoolCode)}`
        );
        const data = await response.json().catch(() => null);
        const normalizedLogo = normalizeInstituteLogo(data?.logo);
        setSchoolLogo(normalizedLogo);
        if (normalizedLogo) {
          await AsyncStorage.setItem('schoolLogo', normalizedLogo);
        }
      } catch (error) {
        console.error('Failed to load school logo:', error);
        const cachedLogo = await AsyncStorage.getItem('schoolLogo');
        setSchoolLogo(cachedLogo || '');
      }
    };

    void loadSchoolLogo();
  }, [studentData?.schoolCode]);

  useEffect(() => {
    void refreshParentAccount();
  }, []);

  const visibleTiles = useMemo(() => {
    switch (selectedChip) {
      case 'Learning':
        return parentTiles.filter(
          (tile) =>
            tile.route === 'ParentAcademic' ||
            tile.route === 'ParentReports' ||
            tile.route === 'ParentFees' ||
            tile.route === 'ParentAttendance' ||
            tile.route === 'ParentHomework' ||
            tile.route === 'ParentTimetable'
        );
      case 'Attendance':
        return parentTiles.filter((tile) => tile.route === 'ParentAttendance');
      case 'Support':
        return parentTiles.filter(
          (tile) => tile.route === 'ParentMessage' || tile.route === 'ParentLiveChatTicket'
        );
      case 'Events':
        return parentTiles.filter(
          (tile) =>
            tile.route === 'ParentHomepage' ||
            tile.route === 'ParentAnnouncements' ||
            tile.route === 'ParentCalender' ||
            tile.route === 'ParentPhotos'
        );
      default:
        return parentTiles;
    }
  }, [selectedChip]);

  const selectedChipTiles = useMemo(() => {
    const quickOrder: ParentModuleRoute[] = [
      'ParentAcademic',
      'ParentReports',
      'ParentHomework',
      'ParentFees',
      'ParentTimetable',
      'ParentCalender',
      'ParentPhotos',
      'ParentMessage',
      'ParentLiveChatTicket',
      'ParentHomepage',
      'ParentAnnouncements',
    ];

    return quickOrder
      .map((route) => parentTiles.find((tile) => tile.route === route))
      .filter((tile): tile is ParentTile => {
        if (!tile) return false;

        switch (selectedChip) {
          case 'Learning':
            return (
            tile.route === 'ParentAcademic' ||
            tile.route === 'ParentReports' ||
            tile.route === 'ParentFees' ||
            tile.route === 'ParentAttendance' ||
            tile.route === 'ParentHomework' ||
            tile.route === 'ParentTimetable'
          );
          case 'Attendance':
            return tile.route === 'ParentAttendance';
          case 'Support':
            return tile.route === 'ParentMessage' || tile.route === 'ParentLiveChatTicket';
          case 'Events':
            return (
              tile.route === 'ParentHomepage' ||
              tile.route === 'ParentAnnouncements' ||
              tile.route === 'ParentCalender' ||
              tile.route === 'ParentPhotos'
            );
          default:
            return true;
        }
      });
  }, [selectedChip]);

  const selectedSummary = useMemo(() => {
    switch (selectedChip) {
      case 'Learning':
        return 'Academic progress, fees, homework and timetable live here.';
      case 'Attendance':
        return 'Attendance leaves and history are shown here.';
      case 'Support':
        return 'Open chat and ticket tools for parent communication.';
      case 'Events':
        return 'See calendar events, photos and school announcements.';
      default:
        return 'Everything a parent needs in one launcher.';
    }
  }, [selectedChip]);

  const dashboardTiles = useMemo(
    () =>
      visibleTiles.map((tile) => {
        if (tile.route === 'ParentAcademic') {
          return {
            ...tile,
            metaLabel: 'Summary',
            metaValue: `${academicSummary.grade} • ${academicSummary.percentage}%`,
          };
        }

        if (tile.route === 'ParentReports') {
          return {
            ...tile,
            metaLabel: 'View',
            metaValue: 'Academic Behaviour Attendance',
          };
        }

        if (tile.route === 'ParentFees') {
          return {
            ...tile,
            metaLabel: 'Summary',
            metaValue: feeSummary.due,
          };
        }

        if (tile.route === 'ParentAttendance') {
          return {
            ...tile,
            metaLabel: 'Leaves',
            metaValue: String(attendanceCount),
          };
        }

        if (tile.route === 'ParentHomework') {
          return {
            ...tile,
            metaLabel: 'Tasks',
            metaValue: 'Open work',
          };
        }

        if (tile.route === 'ParentTimetable') {
          return {
            ...tile,
            metaLabel: 'Slot',
            metaValue: 'Today',
          };
        }

        if (tile.route === 'ParentCalender') {
          return {
            ...tile,
            metaLabel: 'Events',
            metaValue: 'This week',
          };
        }

        if (tile.route === 'ParentPhotos') {
          return {
            ...tile,
            metaLabel: 'Gallery',
            metaValue: 'Latest photos',
          };
        }

        if (tile.route === 'ParentMessage') {
          return {
            ...tile,
            metaLabel: 'Chat',
            metaValue: 'Open messages',
          };
        }

        if (tile.route === 'ParentLiveChatTicket') {
          return {
            ...tile,
            metaLabel: 'Support',
            metaValue: 'Chat now',
          };
        }

        return {
          ...tile,
          metaLabel: 'Updates',
          metaValue: 'News',
        };
      }),
    [academicSummary.grade, academicSummary.percentage, attendanceCount, feeSummary.due, visibleTiles]
  );

  const parentActionCards = useMemo(
    () => [
      {
        id: 'fees-due',
        title: 'Fees Due',
        value: feeSummary.due,
        subtitle: 'Review payment summary',
        cta: 'Open Fees',
        image: require('../assets/fees.png'),
        route: 'ParentFees' as ParentModuleRoute,
        accent: '#FFF',
      },
      {
        id: 'attendance',
        title: 'Attendance',
        value: `${attendanceCount} leaves`,
        subtitle: 'Check attendance history',
        cta: 'Open Attendance',
        image: require('../assets/leaves.png'),
        route: 'ParentAttendance' as ParentModuleRoute,
        accent: '#FFF',
      },
      {
        id: 'reports',
        title: 'Reports',
        value: 'Academics',
        subtitle: 'Behaviour and attendance together',
        cta: 'Open Reports',
        image: require('../assets/studentReports.png'),
        route: 'ParentReports' as ParentModuleRoute,
        accent: '#FFF',
      },
      {
        id: 'homework',
        title: 'Homework',
        value: 'Open work',
        subtitle: 'See assignments and tasks',
        cta: 'Open Homework',
        image: require('../assets/homework animated.png'),
        route: 'ParentHomework' as ParentModuleRoute,
        accent: '#FFF',
      },
    ],
    [attendanceCount, feeSummary.due]
  );

  useEffect(() => {
    if (parentActionAnimValues.current.length !== parentActionCards.length) {
      parentActionAnimValues.current = parentActionCards.map(() => new Animated.Value(0));
    }

    const animations = parentActionAnimValues.current.map((animValue) =>
      Animated.spring(animValue, {
        toValue: 1,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      })
    );

    Animated.stagger(120, animations).start();
  }, [parentActionCards, parentActionAnimValues]);

  useEffect(() => {
    if (parentActionImageAnimValues.current.length !== parentActionCards.length) {
      parentActionImageAnimValues.current = parentActionCards.map(() => new Animated.Value(0));
    }

    parentActionImageLoops.current.forEach((animation) => animation.stop());
    parentActionImageLoops.current = parentActionCards.map((_, index) => {
      const animValue = parentActionImageAnimValues.current[index];
      animValue.setValue(0);

      const sequence = Animated.sequence([
        Animated.delay(index * 140),
        Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            }),
          ])
        ),
      ]);

      sequence.start();
      return sequence;
    });

    return () => {
      parentActionImageLoops.current.forEach((animation) => animation.stop());
    };
  }, [parentActionCards]);

const openModule = (route: ParentModuleRoute) => {
  setSelectedModule(route);
  
  // Construct the parameters safely
  const studentParams = {
    username: studentData?.username || studentProfile?.username || '',
    name: studentData?.name || studentProfile?.name || '',
    class_name: activeStudentClass, // e.g., "Class 1"
    className: activeStudentClass,  // fallback key if your sub-screens use camelCase
    section: activeStudentSection,
    schoolCode: studentData?.schoolCode || studentProfile?.schoolCode || '',
  };

  (navigation.navigate as any)(route, studentParams);
};
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleOpenHomePanel = () => {
    setSelectedChip('Overview');
    setSelectedModule('ParentAcademic');
  };

  useEffect(() => {
    setSelectedModule(selectedChipTiles[0]?.route ?? 'ParentHomework');
  }, [selectedChipTiles]);

  const handleAddPress = () => {
    openModule('ParentAcademic');
  };

  const handleTilePress = (route: ParentModuleRoute) => {
    openModule(route);
  };

  const handleOpenChat = () => {
    openModule('ParentMessage');
  };

  const handleOpenProfilePanel = () => {
    setShowProfileModal(true);
    void refreshParentAccount();
  };

const schoolCodeOrName = String(
  studentData?.school_name ||
    studentProfile?.school_name ||
    studentData?.schoolCode ||
    studentProfile?.schoolCode ||
    teacherProfileCache?.schoolCode ||
    'School Name'
).trim();

const schoolNameDisplay = schoolCodeOrName.includes("_")
  ? schoolCodeOrName.split("_").slice(1).join(" ").trim()
  : schoolCodeOrName;
  const activeStudentName =
    String(studentData?.name || studentProfile?.name || loginName || 'Student').trim() || 'Student';
  const activeStudentClass =
    String(studentData?.class_name || studentProfile?.class_name || '-').trim() || '-';
  const activeStudentSection =
    String(studentData?.section || studentProfile?.section || '-').trim() || '-';
  const activeStudentPhone = String(
    studentData?.phone_no || studentProfile?.phone_no || studentProfile?.mobile || studentData?.mobile || '-'
  ).trim() || '-';
  const activeStudentFather =
    String(studentData?.father_name || studentProfile?.father_name || '-').trim() || '-';
  const activeStudentAadhar = String(studentData?.aadhar_no || studentProfile?.aadhar_no || '-').trim() || '-';
  const activeStudentAddress = String(studentData?.address || studentProfile?.address || '-').trim() || '-';
  const activeStudentDob = String(studentData?.dob || studentProfile?.dob || studentData?.date_of_birth || studentProfile?.date_of_birth || '-').trim() || '-';
  const activeStudentAdmission = String(studentData?.admission_no || studentProfile?.admission_no || studentData?.admission || studentProfile?.admission || '-').trim() || '-';
  const activeStudentId = String(
    studentData?.studentId || studentProfile?.studentId || studentData?.id || studentProfile?.id || '-'
  ).trim() || '-';
  const activeStudentPhoto = resolveRenderablePhotoUri(
    studentData?.photoUrl || studentData?.photo || studentProfile?.photoUrl || studentProfile?.photo || ''
  );
  const activeStudentInitial = activeStudentName.trim().charAt(0).toUpperCase() || 'S';
  const studentProfileRows = [
    { label: 'Student name', value: activeStudentName },
    { label: 'Class', value: `${activeStudentClass} - ${activeStudentSection}` },
    { label: 'Father name', value: activeStudentFather },
    { label: 'Phone', value: activeStudentPhone },
    { label: 'Student ID', value: activeStudentId },
  ];
  const reportAcademicRows = academicReportRows.length
    ? academicReportRows.map((row) => {
        const marks = Number(row.totalMarks || 0);
        const percent = Math.max(0, Math.min(100, marks));
        return {
          subject: row.subject,
          fa1: '-',
          fa2: '-',
          sa1: '-',
          fa3: '-',
          fa4: '-',
          sa2: '-',
          marks: marks.toFixed(marks % 1 === 0 ? 0 : 1),
          percent: formatReportPercent(percent),
          grade: getGradeFromPercent(percent),
        };
      })
    : [
        {
          subject: 'Overall',
          fa1: '-',
          fa2: '-',
          sa1: '-',
          fa3: '-',
          fa4: '-',
          sa2: '-',
          marks: academicSummary.percentage,
          percent: `${academicSummary.percentage}%`,
          grade: academicSummary.grade,
        },
      ];
  const attendancePresentPercent = overallAttendanceReport?.presentPercentage ?? Math.max(0, 100 - attendanceCount);
  const attendancePresentDays = overallAttendanceReport?.presentDays ?? 0;
  const estimatedTotalDays =
    attendancePresentPercent > 0 && attendancePresentDays > 0
      ? Math.max(attendancePresentDays, Math.round(attendancePresentDays / (attendancePresentPercent / 100)))
      : attendancePresentDays + attendanceCount;
  const attendanceAbsentDays = Math.max(0, estimatedTotalDays - attendancePresentDays);
  const attendanceMonthLabel = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
  const behaviourPositiveRemark = behaviourReport?.comments?.Positive?.filter(Boolean)?.[0] || 'Consistent participation and classroom conduct.';
  const behaviourImprovementRemark =
    behaviourReport?.comments?.NeedsToImprovement?.filter(Boolean)?.[0] || 'Keep improving with regular practice and focus.';
  const behaviourNegativeRemark = behaviourReport?.comments?.Negative?.filter(Boolean)?.[0] || 'No major negative behaviour reported.';
  const teacherRemark = `${activeStudentName} is showing ${academicSummary.grade === '-' ? 'steady' : academicSummary.grade} progress with ${academicSummary.percentage}% academic performance. Attendance is ${formatReportPercent(attendancePresentPercent)} and behaviour feedback is reviewed above.`;
  const positiveBehaviour = Math.max(0, Math.min(100, behaviourReport?.positivePercentage || 0));
  const improvementBehaviour = Math.max(0, Math.min(100, behaviourReport?.needsImprovementPercentage || 0));
  const negativeBehaviour = Math.max(0, Math.min(100, behaviourReport?.negativePercentage || 0));
  const behaviourComments = [
    {
      label: 'Positive',
      comments: behaviourReport?.comments?.Positive || [],
    },
    {
      label: 'Needs Improvement',
      comments: behaviourReport?.comments?.NeedsToImprovement || [],
    },
    {
      label: 'Negative',
      comments: behaviourReport?.comments?.Negative || [],
    },
  ].filter((item) => item.comments.length > 0);
  const academicPieColors = ['#A8E6A3', '#77D77D', '#4CAF50', '#388E3C', '#607D3B', '#2C6B2F'];
  const academicSlices = academicReportRows.length
    ? academicReportRows.map((row, index) => ({
        label: row.subject,
        value: row.totalMarks,
        color: academicPieColors[index % academicPieColors.length],
        detail: String(row.totalMarks || 0),
      }))
    : [
        {
          label: 'Overall',
          value: Number(academicSummary.percentage) || 0,
          color: '#A8E6A3',
          detail: `${academicSummary.percentage}%`,
        },
      ];
  const attendanceSlices = [
    {
      label: 'Present',
      value: overallAttendanceReport?.presentPercentage ?? Math.max(0, 100 - attendanceCount),
      color: '#81CDD4',
      detail: `${Math.round(overallAttendanceReport?.presentPercentage ?? Math.max(0, 100 - attendanceCount))}%`,
    },
    {
      label: 'Informed',
      value: overallAttendanceReport?.informedPercentage ?? 0,
      color: '#4CB7B7',
      detail: `${Math.round(overallAttendanceReport?.informedPercentage ?? 0)}%`,
    },
    {
      label: 'Uninformed',
      value: overallAttendanceReport?.uninformedPercentage ?? attendanceCount,
      color: '#008080',
      detail: `${Math.round(overallAttendanceReport?.uninformedPercentage ?? attendanceCount)}%`,
    },
  ];
  const behaviourSlices = [
    { label: 'Positive', value: positiveBehaviour || (!behaviourReport ? 100 : 0), color: '#E6A2AC', detail: `${positiveBehaviour || (!behaviourReport ? 100 : 0)}%` },
    { label: 'Needs Improvement', value: improvementBehaviour, color: '#820D23', detail: `${improvementBehaviour}%` },
    { label: 'Negative', value: negativeBehaviour, color: '#C15168', detail: `${negativeBehaviour}%` },
  ];
  const bestAcademic = academicSlices.reduce(
    (best, item) => (Number(item.value || 0) > Number(best.value || 0) ? item : best),
    academicSlices[0]
  );
  const bestAttendance = attendanceSlices.reduce(
    (best, item) => (Number(item.value || 0) > Number(best.value || 0) ? item : best),
    attendanceSlices[0]
  );
  const bestBehaviour = behaviourSlices.reduce(
    (best, item) => (Number(item.value || 0) > Number(best.value || 0) ? item : best),
    behaviourSlices[0]
  );
  const overallSlices = [
    {
      label: 'Academic',
      value: clampPercent(bestAcademic?.value),
      color: 'rgba(76, 183, 183, 0.75)',
      detail: bestAcademic ? `${bestAcademic.label}: ${bestAcademic.detail || `${Math.round(bestAcademic.value)}%`}` : 'N/A',
    },
    {
      label: 'Attendance',
      value: clampPercent(bestAttendance?.value),
      color: 'rgba(10, 167, 10, 0.4)',
      detail: bestAttendance ? `${bestAttendance.label}: ${bestAttendance.detail || `${Math.round(bestAttendance.value)}%`}` : 'N/A',
    },
    {
      label: 'Behaviour',
      value: clampPercent(bestBehaviour?.value),
      color: 'rgba(130, 13, 35, 0.7)',
      detail: bestBehaviour ? `${bestBehaviour.label}: ${bestBehaviour.detail || `${Math.round(bestBehaviour.value)}%`}` : 'N/A',
    },
  ];

  const buildReportCardHtml = () => {
    const academicRowsHtml = reportAcademicRows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.subject)}</td>
            <td>${escapeHtml(row.fa1)}</td>
            <td>${escapeHtml(row.fa2)}</td>
            <td>${escapeHtml(row.sa1)}</td>
            <td>${escapeHtml(row.fa3)}</td>
            <td>${escapeHtml(row.fa4)}</td>
            <td>${escapeHtml(row.sa2)}</td>
            <td>${escapeHtml(row.marks)}</td>
            <td>${escapeHtml(row.percent)}</td>
            <td>${escapeHtml(row.grade)}</td>
          </tr>
        `
      )
      .join('');

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #10233f; margin: 18px; }
            .card { border: 2px solid #8db0d9; padding: 8px; }
            .inner { border: 1px solid #2f63a3; padding: 10px; }
            .title { text-align: center; font-size: 20px; font-weight: 800; color: #16457e; }
            .sub { text-align: center; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
            .top { display: table; width: 100%; margin-bottom: 10px; }
            .logo, .photo { display: table-cell; width: 90px; border: 1px solid #c8d8eb; text-align: center; vertical-align: middle; font-weight: 700; color: #456; }
            .info { display: table-cell; padding: 0 8px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
            .cell { border: 1px solid #c8d8eb; border-radius: 4px; padding: 5px; text-align: center; font-size: 10px; }
            .label { font-weight: 800; }
            .section { background: #eaf1f8; border: 1px solid #9cb9d9; color: #17477f; font-weight: 800; padding: 6px; margin-top: 10px; border-radius: 4px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
            th { background: #315e9f; color: white; padding: 7px 4px; border: 1px solid #7e99bd; }
            td { padding: 7px 4px; border: 1px solid #9fb0c7; text-align: center; }
            .remark { border: 1px solid #c8d8eb; padding: 8px; margin-top: 6px; font-size: 12px; line-height: 1.4; }
            .reportBoxes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
            .box { border: 1px solid #c8d8eb; padding: 8px; min-height: 70px; font-size: 11px; }
            .boxTitle { font-size: 13px; color: #597ca5; font-weight: 800; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="inner">
              <div class="title">${escapeHtml(schoolNameDisplay)}</div>
              <div class="sub">ANNUAL PROGRESS REPORT ${new Date().getFullYear()}</div>
              <div class="top">
                <div class="logo">CLEEZO<br/>CLASS</div>
                <div class="info">
                  <div class="grid">
                    <div class="cell"><span class="label">Name:</span> ${escapeHtml(activeStudentName)}</div>
                    <div class="cell"><span class="label">Class:</span> ${escapeHtml(activeStudentClass)}</div>
                    <div class="cell"><span class="label">Section:</span> ${escapeHtml(activeStudentSection)}</div>
                    <div class="cell"><span class="label">Father:</span> ${escapeHtml(activeStudentFather)}</div>
                    <div class="cell"><span class="label">DOB:</span> ${escapeHtml(activeStudentDob)}</div>
                    <div class="cell"><span class="label">Admission:</span> ${escapeHtml(activeStudentAdmission)}</div>
                    <div class="cell"><span class="label">Phone:</span> ${escapeHtml(activeStudentPhone)}</div>
                    <div class="cell"><span class="label">Aadhar:</span> ${escapeHtml(activeStudentAadhar)}</div>
                    <div class="cell"><span class="label">Address:</span> ${escapeHtml(activeStudentAddress)}</div>
                  </div>
                </div>
                <div class="photo">Student<br/>Photo</div>
              </div>
              <div class="section">Academic Performance</div>
              <table>
                <thead>
                  <tr><th>Subject</th><th>FA1</th><th>FA2</th><th>SA1</th><th>FA3</th><th>FA4</th><th>SA2</th><th>Marks</th><th>%</th><th>Grade</th></tr>
                </thead>
                <tbody>${academicRowsHtml}</tbody>
              </table>
              <div class="section">Behaviour Report</div>
              <table>
                <thead><tr><th>Area</th><th>Percentage</th><th>Remark</th><th>Grade</th></tr></thead>
                <tbody>
                  <tr><td>Positive</td><td>${formatReportPercent(positiveBehaviour || (!behaviourReport ? 100 : 0))}</td><td>${escapeHtml(behaviourPositiveRemark)}</td><td>${getGradeFromPercent(positiveBehaviour || (!behaviourReport ? 100 : 0))}</td></tr>
                  <tr><td>Needs Improvement</td><td>${formatReportPercent(improvementBehaviour)}</td><td>${escapeHtml(behaviourImprovementRemark)}</td><td>${getGradeFromPercent(100 - improvementBehaviour)}</td></tr>
                  <tr><td>Negative</td><td>${formatReportPercent(negativeBehaviour)}</td><td>${escapeHtml(behaviourNegativeRemark)}</td><td>${negativeBehaviour > 0 ? 'Review' : 'A'}</td></tr>
                </tbody>
              </table>
              <div class="section">Attendance Record</div>
              <table>
                <thead><tr><th>Month</th><th>Total Days</th><th>Present</th><th>Absent</th><th>Percentage</th></tr></thead>
                <tbody><tr><td>${escapeHtml(attendanceMonthLabel)}</td><td>${estimatedTotalDays}</td><td>${attendancePresentDays}</td><td>${attendanceAbsentDays}</td><td>${formatReportPercent(attendancePresentPercent)}</td></tr></tbody>
              </table>
              <div class="section">Class Teacher's Remark</div>
              <div class="remark">${escapeHtml(teacherRemark)}</div>
              <div class="section">Graphical Report</div>
              <div class="reportBoxes">
                <div class="box"><div class="boxTitle">Graphical Report:</div><div>Academic: ${escapeHtml(academicSummary.percentage)}%<br/>Attendance: ${formatReportPercent(attendancePresentPercent)}<br/>Behaviour positive: ${formatReportPercent(positiveBehaviour || (!behaviourReport ? 100 : 0))}</div></div>
                <div class="box"><div class="boxTitle">Analytical Report:</div><div>AI generated performance summary based on academic marks, attendance and behaviour report.</div></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadReportCard = async () => {
    try {
      setReportDownloading(true);
      const safeName = activeStudentName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Student';
      const file = await RNHTMLtoPDF.convert({
        html: buildReportCardHtml(),
        fileName: `${safeName}_Report_Card`,
        directory: 'Documents',
      });
      Alert.alert('Report downloaded', `PDF saved to: ${file.filePath || 'Documents'}`);
    } catch (error) {
      console.error('Failed to download report card:', error);
      Alert.alert('Download failed', 'Unable to create the report card PDF.');
    } finally {
      setReportDownloading(false);
    }
  };

  const handleSwitchToChild = async (child: ParentChild) => {
    try {
      const existingSchoolCode = await AsyncStorage.getItem('schoolCode');
      const safeSchoolCode = String(child.schoolCode || existingSchoolCode || '');
      const existingUsername = await AsyncStorage.getItem('username');
      const safeUsername = String(child.username || existingUsername || '');
      const existingParentName = await AsyncStorage.getItem('parentName');
      const safeParentName = String(existingParentName || loginName || '');

      await AsyncStorage.multiSet([
        ['studentId', String(child.id || '')],
        ['username', safeUsername],
        ['schoolCode', safeSchoolCode],
        ['parentName', safeParentName],
        ['name', child.name || ''],
        ['class_name', child.class_name || ''],
        ['section', child.section || ''],
        ['photoUrl', resolveRenderablePhotoUri(child.photoUrl || child.photo || '')],
        ['aadhar_no', child.aadhar_no || ''],
        ['address', child.address || ''],
        ['class_teacher', child.class_teacher || ''],
        ['father_name', child.father_name || ''],
        ['gender', child.gender || ''],
        ['phone_no', child.phone_no || ''],
        ['school_name', child.school_name || ''],
        ['userType', 'student'],
      ]);
      await AsyncStorage.setItem('currentStudent', JSON.stringify(child));

      setShowProfileModal(false);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'ParentDashboard' as never,
            params: {
              username: safeUsername,
              name: child.name || '',
            } as never,
          },
        ],
      });
    } catch (error) {
      console.error('Failed to switch child:', error);
      Alert.alert('Error', 'Failed to switch to this student.');
    }
  };

  const canSwitchToTeacherAccount = useMemo(() => {
    const currentName = normalizeText(studentProfile?.father_name || studentData?.father_name);
    const currentPhone = normalizePhone(
      studentProfile?.phone_no || studentData?.phone_no || studentData?.mobile || ''
    );
    const teacherName = normalizeText(teacherProfileCache?.name);
    const teacherPhone = normalizePhone(
      teacherProfileCache?.phoneNo ||
        teacherProfileCache?.phone_no ||
        teacherProfileCache?.mobile_number ||
        ''
    );

    return Boolean(
      teacherProfileCache &&
        normalizeText(teacherProfileCache?.userType) === 'teacher' &&
        currentName &&
        currentPhone &&
        currentName === teacherName &&
        currentPhone === teacherPhone
    );
  }, [studentData?.father_name, studentData?.phone_no, studentData?.mobile, studentProfile, teacherProfileCache]);

  const handleSwitchToTeacherAccount = async () => {
    try {
      if (!teacherProfileCache) {
        Alert.alert('Unavailable', 'Teacher account details were not found on this device.');
        return;
      }

      const username = String(teacherProfileCache.username || '');
      const schoolCode = String(teacherProfileCache.schoolCode || '');
      const name = String(teacherProfileCache.name || '');
      const designation = String(teacherProfileCache.designation || '');

      await AsyncStorage.multiSet([
        ['username', username],
        ['name', name],
        ['schoolCode', schoolCode],
        ['designation', designation],
        ['userType', 'teacher'],
        ['userDetails', JSON.stringify(teacherProfileCache)],
        ['lastScreen', 'TeacherDashboard'],
      ]);
      await cacheTeacherProfile(teacherProfileCache);

      setShowProfileModal(false);
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'TeacherDashboard' as never,
            params: { username, name },
          },
        ],
      });
    } catch (error) {
      console.error('Failed to switch to teacher account:', error);
      Alert.alert('Error', 'Failed to switch to teacher account.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              'username',
              'userType',
              'name',
              'schoolCode',
              'designation',
              'lastScreen',
              'studentId',
              'activeChildId',
              'activeChildName',
              'activeChildClass',
              'activeChildSection',
              'activeRole',
              'activeUserType',
              'currentChildData',
              'fcmToken',
            ]);
          } catch (error) {
            console.error('Failed to clear parent session:', error);
          } finally {
            setShowProfileModal(false);
            navigation.reset({
              index: 0,
              routes: [{ name: 'TeacherLogin' }],
            });
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={"#0a3d62"} />

      <View style={styles.background}>
        <View style={styles.phoneShell}>
          <View style={styles.phoneFrame}>
            <LinearGradient
              pointerEvents="none"
                colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dashboardTopGradient}
            />
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
                  {schoolNameDisplay}
                </Text>
              </View>
              <View style={styles.toolbarSpacer} />
              
            </View>

            <View style={styles.dashboardHeroCard}>
              <LinearGradient
colors={['#6826df', '#a174eb','#1A2D4A']}   
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dashboardHeroGradientCard}
              >
                <View style={styles.dashboardHeroExpandedLayout}>
                  <View style={styles.dashboardHeroExpandedLeft}>
                    <Text style={styles.dashboardHeroSchool} numberOfLines={1}>
                      {schoolNameDisplay}
                    </Text>
                    <Text style={styles.dashboardHeroClass} numberOfLines={1}>
                      {activeStudentClass} {activeStudentSection}
                    </Text>
                    <Text style={styles.dashboardHeroName} numberOfLines={2}>
                      {activeStudentName}
                    </Text>
                  </View>
                  <View style={styles.dashboardHeroExpandedRight}>
                    {childrenLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      (() => {
                        const otherChildren = children.filter(
                          (child) =>
                            String(child.id) !==
                            String(studentData?.studentId || studentProfile?.studentId || ''),
                        );

                        return (
                          <ScrollView
                            horizontal
                            nestedScrollEnabled
                            directionalLockEnabled
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.dashboardHeroProfilesRow}
                          >
                            {otherChildren.slice(0, 2).map((child, index) => {
                              const childPhoto = resolveRenderablePhotoUri(child.photoUrl || child.photo || '');
                              const childInitial =
                                (child.name || child.username || `S${index + 1}`).trim().charAt(0).toUpperCase() || 'S';

                              return (
                                <Pressable
                                  key={child.id || index}
                                  onPress={() => handleSwitchToChild(child)}
                                  style={[
                                    styles.dashboardHeroSecondaryProfile,
                                    styles.dashboardHeroProfileItem,
                                  ]}
                                >
                                  <View style={styles.dashboardHeroSecondaryAvatarWrap}>
                                    {childPhoto ? (
                                      <Image
                                        source={{ uri: childPhoto }}
                                        style={styles.dashboardHeroSecondaryAvatar}
                                        resizeMode="cover"
                                      />
                                    ) : (
                                      <Text style={styles.dashboardHeroSecondaryAvatarText}>
                                        {childInitial}
                                      </Text>
                                    )}
                                  </View>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        );
                      })()
                    )}
                  </View>
                </View>
                <View style={styles.dashboardHeroActiveProfileFloat} pointerEvents="none">
                  <View style={styles.dashboardHeroPrimaryProfile}>
                    {activeStudentPhoto ? (
                      <Image
                        source={{ uri: activeStudentPhoto }}
                        style={styles.dashboardHeroPrimaryAvatar}
                        resizeMode="cover"
                        onLoad={() => {
                          console.log('[ParentDashboard] hero photo loaded', {
                            uri: activeStudentPhoto,
                            studentName: activeStudentName,
                          });
                        }}
                        onError={(event) => {
                          console.log('[ParentDashboard] hero photo failed', {
                            uri: activeStudentPhoto,
                            studentName: activeStudentName,
                            error: event?.nativeEvent?.error || null,
                          });
                        }}
                      />
                    ) : (
                      <Text style={styles.dashboardHeroPrimaryAvatarText}>
                        {activeStudentInitial}
                      </Text>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </View>
            <ScrollView
              ref={scrollRef}
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
            >
{/* 
              <View style={[styles.chipStickyHeader, styles.chipRowSection]}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectedChipMapRow}
                >
                  {selectedChipTiles.map((tile, index) => {
                    const active = selectedModule === tile.route;

                    return (
                      <Pressable
                        key={tile.route}
                        onPress={() => openModule(tile.route)}
                        style={[
                          styles.selectedChipMapItem,
                          index !== selectedChipTiles.length - 1 &&
                            styles.selectedChipMapItemSpacing,
                          active ? styles.selectedChipMapItemActive : styles.selectedChipMapItemInactive,
                        ]}
                      >
                        <View style={styles.selectedChipMapIconWrap}>
                          {renderIcon(tile.kind, tile.icon, active ? '#1F1F22' : '#6A6A70', 18)}
                        </View>
                        <Text
                          style={[
                            styles.selectedChipMapText,
                            active
                              ? styles.selectedChipMapTextActive
                              : styles.selectedChipMapTextInactive,
                          ]}
                        >
                          {tile.label}
                        </Text>
                        {active ? <View style={styles.selectedChipMapActiveIndicator} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View> */}

              <View style={styles.parentActionSection}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToAlignment="start"
                  snapToInterval={phoneWidth - 14}
                  contentContainerStyle={styles.parentActionScroll}
                >
                  {parentActionCards.map((action, index) => {
                    const animValue = parentActionAnimValues.current[index] || new Animated.Value(1);
                    const imageAnimValue =
                      parentActionImageAnimValues.current[index] || new Animated.Value(0);
                    const imageTranslateY = imageAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    });
                    const imageScale = imageAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.06],
                    });
                    const imageRotate = imageAnimValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '-4deg'],
                    });

                    return (
                      <Animated.View
                        key={action.id}
                        style={{
                          opacity: animValue,
                          transform: [
                            {
                              translateY: animValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: [16, 0],
                              }),
                            },
                            {
                              scale: animValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.98, 1],
                              }),
                            },
                          ],
                        }}
                      > 
                        <Pressable
                          onPress={() => openModule(action.route)}
                          style={[
                            styles.parentActionCard,
                            { backgroundColor: action.accent },
                            index !== parentActionCards.length - 1 && styles.parentActionCardSpacing,
                          ]}
                        >
                          <View style={styles.parentActionCardBody}>
                            <View style={styles.parentActionCardTextBlock}>
                              <Text style={styles.parentActionCardLabel}>{action.title}</Text>
                              <Text style={styles.parentActionCardValue} numberOfLines={1}>
                                {action.value}
                              </Text>
                              <Text style={styles.parentActionCardSubtitle} numberOfLines={2}>
                                {action.subtitle}
                              </Text>
                              <View style={styles.parentActionCta}>
                                <Text style={styles.parentActionCtaText}>{action.cta}</Text>
                              </View>
                            </View>
                            <Animated.Image
                              source={action.image}
                              style={[
                                styles.parentActionImage,
                                {
                                  transform: [
                                    { translateY: imageTranslateY },
                                    { scale: imageScale },
                                    { rotate: imageRotate },
                                  ],
                                },
                              ]}
                              resizeMode="contain"
                            />
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </ScrollView>
              </View>


              <View style={styles.dashboardGrid}>
                {dashboardTiles.map((tile) => {
                  const tileSubtitle = tile.metaValue
                    ? `${tile.metaLabel} ${tile.metaValue}`.trim()
                    : tile.metaLabel;

                  return (
                  <Pressable
                    key={tile.route}
                    onPress={() => handleTilePress(tile.route)}
                    style={[
                      parentDashboardCardStyles.cardWrapper,
                      selectedModule === tile.route && parentDashboardCardStyles.cardActive,
                    ]}
                  >
                    <View style={parentDashboardCardStyles.card}>
                      <View style={styles.dashboardGridCornerAccent}>
                        <LinearGradient
                          colors={['#d2c2eeff', '#a174eb', '#6826df']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.dashboardGridCornerAccentFill}
                        />
                      </View>
                      <View style={parentDashboardCardStyles.iconWrap}>
                        {renderIcon(tile.kind, tile.icon, '#000000', 30)}
                      </View>
                      <View style={parentDashboardCardStyles.cardContent}>
                        <View style={parentDashboardCardStyles.textBlock}>
                          <Text style={parentDashboardCardStyles.label} numberOfLines={2}>
                          {tile.label}
                          </Text>
                          <Text style={parentDashboardCardStyles.subtitle} numberOfLines={1}>
                            {tileSubtitle}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                  );
                })}
              </View>

              {/* <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: Math.max(phoneHeight * 0.24, 180) }}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                <View style={[styles.statusCardsRow, { paddingHorizontal: 5 }]}>
                  <View
                    style={[
                      styles.statusCard,
                      styles.statusCardLeft,
                      { backgroundColor: '#D7E8C9' },
                    ]}
                    onLayout={(event) => {
                      sectionPositions.current.ParentAcademic = event.nativeEvent.layout.y;
                    }}
                  >
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      style={styles.statusCardTextScroll}
                      contentContainerStyle={styles.statusCardTextScrollContent}
                    >
                      <View style={styles.statusTitleRow}>
                        <Text style={styles.statusNumber} numberOfLines={1} ellipsizeMode="tail">
                          Academic
                        </Text>
                        <Text style={styles.statusSubtitle} numberOfLines={1} ellipsizeMode="tail">
                          {academicSummary.grade}
                        </Text>
                      </View>
                      <Text style={styles.statusFooter} numberOfLines={1} ellipsizeMode="tail">
                        {academicSummary.percentage}%
                      </Text>
                      <Pressable
                        onPress={() => openModule('ParentAcademic')}
                        style={styles.statusActionButton}
                      >
                        <Text style={styles.statusActionLink}>Open Academic</Text>
                      </Pressable>
                    </ScrollView>
                    <View style={styles.statusIconWrap}>
                      <MaterialIcons name="school" size={30} color="#000000" />
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusCard,
                      styles.statusCardRight,
                      { backgroundColor: '#F2EE9E' },
                    ]}
                    onLayout={(event) => {
                      sectionPositions.current.ParentFees = event.nativeEvent.layout.y;
                    }}
                  >
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      style={styles.statusCardTextScroll}
                      contentContainerStyle={styles.statusCardTextScrollContent}
                    >
                      <View style={styles.statusTitleRow}>
                        <Text style={styles.statusNumber} numberOfLines={1} ellipsizeMode="tail">
                          Fees
                        </Text>
                        <Text style={styles.statusSubtitle} numberOfLines={1} ellipsizeMode="tail">
                          Summary
                        </Text>
                      </View>
                      <Text style={styles.statusFooter} numberOfLines={1} ellipsizeMode="tail">
                        {feeSummary.due}
                      </Text>
                      <Pressable
                        onPress={() => openModule('ParentFees')}
                        style={styles.statusActionButton}
                      >
                        <Text style={styles.statusActionLink}>Open Fees</Text>
                      </Pressable>
                    </ScrollView>
                    <View style={styles.statusIconWrap}>
                      <MaterialIcons name="payments" size={30} color="#000000" />
                    </View>
                  </View>
                </View>
              </ScrollView> */}

              {/* <View
                onLayout={(event) => {
                  sectionPositions.current.ParentAcademic = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Academic</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Student marks, grades and performance.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentAcademicView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentFees = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Fees</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Fee totals, breakdown and installments.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentFeesView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentHomework = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Homework</Text>
                    </View>
                  </View>
                </View>
                <ParentHomeworkView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentTimetable = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Timetable</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Daily class routine and periods.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentTimetableView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentCalender = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Calendar</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Events, holidays and school timeline.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentCalenderView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentPhotos = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Photos</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Gallery and school media updates.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentPhotosView embedded />
              </View>

              <View
                onLayout={(event) => {
                  sectionPositions.current.ParentLiveChatTicket = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.moduleHeaderCard}>
                  <View style={styles.moduleHeaderTopRow}>
                    <View style={styles.moduleHeaderTextBlock}>
                      <Text style={styles.moduleHeaderTitle}>Chat & Tickets</Text>
                      <Text style={styles.moduleHeaderSubtitle}>
                        Messages and support requests.
                      </Text>
                    </View>
                  </View>
                </View>
                <ParentLiveChatTicketView embedded />
              </View> */}

            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.footerNav}>
                <Pressable style={styles.footerNavItem} onPress={handleGoBack}>
                  <Image source={backArrowImage} style={{ width: 22, height: 22 }} resizeMode="contain" />
                  <Text style={styles.footerNavLabel}>Back</Text>
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenHomePanel}>
<Ionicons name="home-outline" size={22} color="#1F1F22" />                  <Text style={styles.footerNavLabel}>Home</Text>
                </Pressable>
                <Pressable style={styles.footerAddButton} onPress={handleAddPress}>
                  <MaterialIcons name="add" size={26} color="#FFFFFF" />
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenChat}>
                  <MaterialIcons name="chat-bubble-outline" size={22} color="#000000" />
                  <Text style={styles.footerNavLabelMuted}>Chat</Text>
                </Pressable>
                <Pressable style={styles.footerNavItem} onPress={handleOpenProfilePanel}>
                  <MaterialIcons name="person-outline" size={22} color="#000000" />
                  <Text style={styles.footerNavLabelMuted}>Profile</Text>
                </Pressable>
              </View>

              <View style={styles.footerBrandRow}>
                <Text style={styles.poweredBy}>Powered By</Text>
                <Image source={logoImage} style={styles.logo} resizeMode="contain" />
              </View>

            </View>
          </View>
        </View>
      </View>
      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.teacherPopupCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 2 }}
            >
              <View style={styles.teacherHeaderRow}>
                <View style={styles.teacherAvatar}>
                  {resolveRenderablePhotoUri(studentProfile?.photoUrl || studentProfile?.photo || '') ? (
                    <Image
                      source={{ uri: resolveRenderablePhotoUri(studentProfile?.photoUrl || studentProfile?.photo || '') }}
                      style={{ width: '100%', height: '100%', borderRadius: 26 }}
                      resizeMode="cover"
                      onLoad={() => {
                        console.log('[ParentDashboard] profile photo loaded', {
                          uri: resolveRenderablePhotoUri(studentProfile?.photoUrl || studentProfile?.photo || ''),
                          name: studentProfile?.name || null,
                        });
                      }}
                      onError={(event) => {
                        console.log('[ParentDashboard] profile photo failed', {
                          uri: resolveRenderablePhotoUri(studentProfile?.photoUrl || studentProfile?.photo || ''),
                          name: studentProfile?.name || null,
                          error: event?.nativeEvent?.error || null,
                        });
                      }}
                    />
                  ) : (
                    <Text style={styles.teacherAvatarText}>
                      {(studentProfile?.name || studentProfile?.username || 'P')
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.teacherHeaderText}>
                  <Text style={styles.teacherTitle}>Parent Profile</Text>
                  <Text style={styles.teacherSubtitle}>
                    {studentProfile?.name || 'Parent profile'}
                  </Text>
                </View>
              </View>

              {profileLoading ? (
                <ActivityIndicator size="large" color="#000" style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <View style={styles.teacherDetailsList}>
                    <View style={styles.teacherDetailRow}>
                      <Text style={styles.teacherDetailLabel}>Father Name</Text>
                      <Text style={styles.teacherDetailValue}>
                        {studentProfile?.father_name || '-'}
                      </Text>
                    </View>
                  </View>

       

                  <View style={[styles.teacherDetailsList, { marginBottom: 8 }]}>
                    <Text style={styles.teacherTitle}>Switch Student</Text>
                    <Text style={styles.teacherSubtitle}>
                      Tap a student below to switch the active profile.
                    </Text>

                    {childrenLoading ? (
                      <ActivityIndicator size="small" color="#000" style={{ marginVertical: 16 }} />
                    ) : children.length > 0 ? (
                      children.map((child, index) => {
                        const isActive =
                          String(child.id) === String(studentData?.studentId || studentProfile?.studentId || '');

                        return (
                          <Pressable
                            key={child.id || index}
                            onPress={() => handleSwitchToChild(child)}
                            style={[
                              styles.teacherDetailRow,
                              {
                                backgroundColor: isActive ? '#EEF4FF' : '#F7F8FA',
                                borderColor: isActive ? '#B7C9FF' : '#ECEEF3',
                              },
                            ]}
                          >
                            <Text style={styles.teacherDetailLabel}>
                              {child.name || `Student ${index + 1}`}
                            </Text>
                            <Text style={styles.teacherDetailValue}>
                              Class {child.class_name || '-'} - Section {child.section || '-'}
                            </Text>
                            <Text style={[styles.teacherDetailValue, { marginTop: 4, fontSize: 12 }]}>
                              {child.username ? `Username: ${child.username}` : 'Tap to switch'}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={{ color: '#666', fontStyle: 'italic', marginTop: 8 }}>
                        No additional students found for this parent account.
                      </Text>
                    )}
                  </View>

                  {canSwitchToTeacherAccount && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.teacherTitle}>Switch Account</Text>
                      <Text style={styles.teacherSubtitle}>
                        A matching teacher account was found on this device.
                      </Text>
                      <Pressable
                        style={[
                          styles.popupButton,
                          styles.popupButtonPrimary,
                          styles.teacherActionButton,
                          { marginTop: 12 },
                        ]}
                        onPress={handleSwitchToTeacherAccount}
                      >
                        <Text style={styles.popupButtonText}>Switch to Teacher Account</Text>
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.teacherActions}>
                    <Pressable
                      style={[styles.popupButton, styles.popupButtonSecondary, styles.teacherActionButton]}
                      onPress={() => setShowProfileModal(false)}
                    >
                      <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                        Close
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.popupButton, styles.popupButtonPrimary, styles.teacherActionButton]}
                      onPress={handleLogout}
                    >
                      <Text style={styles.popupButtonText}>Logout</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>


      <Modal
        visible={showAttendanceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttendanceModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.teacherPopupCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 2 }}
            >
              <View style={styles.teacherHeaderRow}>
                <View style={styles.teacherAvatar}>
                  <MaterialIcons name="event-note" size={28} color="#fff" />
                </View>
                <View style={styles.teacherHeaderText}>
                  <Text style={styles.teacherTitle}>Attendance</Text>
                  <Text style={styles.teacherSubtitle}>
                    Leave summary for {activeStudentName}
                  </Text>
                </View>
              </View>

              {attendanceChartData ? (
                <BarChart
                  data={attendanceChartData}
                  width={Math.max(phoneWidth - 80, 250)}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=""
                  fromZero
                  showValuesOnTopOfBars
                  withInnerLines={false}
                  segments={4}
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(13, 63, 102, ${opacity})`,
                    labelColor: () => '#111',
                    propsForBackgroundLines: {
                      stroke: '#E9E9EE',
                      strokeDasharray: '',
                    },
                    propsForLabels: {
                      fill: '#111',
                    },
                  }}
                  style={{ borderRadius: 14, marginVertical: 8 }}
                />
              ) : (
                <Text style={styles.teacherSubtitle}>
                  No attendance/leave data found for this student.
                </Text>
              )}

              <View style={styles.teacherDetailsList}>
                <View style={styles.teacherDetailRow}>
                  <Text style={styles.teacherDetailLabel}>Leave Records</Text>
                  <Text style={styles.teacherDetailValue}>{attendanceCount}</Text>
                </View>
              </View>

              <View style={styles.teacherActions}>
                <Pressable
                  style={[styles.popupButton, styles.popupButtonSecondary, styles.teacherActionButton]}
                  onPress={() => setShowAttendanceModal(false)}
                >
                  <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                    Close
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ParentDashboard;
