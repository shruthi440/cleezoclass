import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ParentFooter from './ParentFooter';
import { createAppStyles } from '../App.styles';
import { ErrorContext } from '../ErrorContext';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentFees'>;
type FeesViewProps = Props & { embedded?: boolean };

type FeeRow = {
  key: string;
  label: string;
  amount: number;
  paid: number;
  discount: number;
  due: number;
  paymentDate?: string;
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

const logoImage: ImageSourcePropType = require('../assets/Cleezo.png');

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

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

const mergeFeeData = (classFeeData: Record<string, any> | null, studentFeeData: Record<string, any> | null) => {
  const merged: Record<string, any> = { ...(classFeeData || {}) };

  Object.entries(studentFeeData || {}).forEach(([key, studentValue]) => {
    if (studentValue === null || studentValue === undefined || studentValue === '') return;

    const classValue = merged[key];
    const studentLooksNumeric =
      typeof studentValue === 'number' ||
      (typeof studentValue === 'string' && studentValue.trim() !== '' && !Number.isNaN(Number(studentValue)));

    if (studentLooksNumeric) {
      const studentAmount = toNumber(studentValue);
      const classAmount = toNumber(classValue);
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

const buildRowsFromSource = (
  paymentSource: Record<string, any> | null,
  amountSource: Record<string, any> | null,
  dynamicFeeTypes: DynamicFeeType[] = [],
  feeBreakdown: Array<Record<string, any>> = []
): FeeRow[] => {
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
          const numeric = toNumber(sourceLookup.get(variant));
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

  const rows: FeeRow[] = [];
  const seen = new Set<string>();

  const addRow = (label: string, amount: number, paid: number, discount: number) => {
    const due = Math.max(amount - paid - discount, 0);
    const key = normalizeFeeKey(label);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      key: label,
      label,
      amount,
      paid,
      discount,
      due,
      paymentDate: '-',
    });
  };

  const dynamicTypesByBase = new Map<string, DynamicFeeType>();
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

const ParentFees: React.FC<FeesViewProps> = ({ navigation, embedded = false }) => {
  const { height, width } = useWindowDimensions();
  const appStyles = useMemo(
    () => createAppStyles({ phoneWidth: width, phoneHeight: height }),
    [height, width],
  );
  const [studentData, setStudentData] = useState<Record<string, any> | null>(null);
  const [classFeeSource, setClassFeeSource] = useState<Record<string, any> | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any> | null>(null);
  const [feeApiSummary, setFeeApiSummary] = useState<Record<string, any> | null>(null);
  const [dynamicFeeTypes, setDynamicFeeTypes] = useState<DynamicFeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const { showError } = React.useContext(ErrorContext);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const keys = ['studentId', 'username', 'name', 'class_name', 'section', 'schoolCode'];
        const stores = await AsyncStorage.multiGet(keys);
        const data: Record<string, any> = {};
        stores.forEach(([key, value]) => {
          if (value) data[key] = value;
        });
        setStudentData(data);
      } catch {
        showError('Data Error', 'Failed to load student information.');
      }
    };

    fetchStudentData();
  }, [showError]);

  useEffect(() => {
    let active = true;

    const fetchDynamicFeeTypes = async () => {
      try {
        if (!studentData?.schoolCode) return;

        const res = await axios.get('https://cleezoclass.com:4000/api/fee-types', {
          params: { schoolCode: studentData.schoolCode, _t: Date.now() },
        });

        if (!active) return;

        const rows = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
        setDynamicFeeTypes(
          rows
            .filter((item: Record<string, any>) => String(item?.feeName || item?.feesType || '').trim() !== '')
            .map((item: Record<string, any>) => ({
              id: item?.id,
              feeName: item?.feeName || '',
              feesType: item?.feesType || 'Custom Fee',
              scope: item?.scope || 'All',
              frequency: item?.frequency || 'One time',
              installments: item?.installments || 1,
              columnBase: normalizeFeeKey(item?.columnBase || item?.feeName || item?.feesType || ''),
            }))
        );
      } catch {
        if (active) setDynamicFeeTypes([]);
      }
    };

    fetchDynamicFeeTypes();
    return () => {
      active = false;
    };
  }, [studentData?.schoolCode]);

  useEffect(() => {
    let active = true;

    const fetchFees = async () => {
      try {
        if (!studentData?.class_name || !studentData?.section || !studentData?.schoolCode) return;

        const [feeApiRes, classRes, studentRes, paymentRes, dynamicRowsRes, feeStructureRes] = await Promise.allSettled([
          axios.get(`https://cleezoclass.com:4000/api/fees/${encodeURIComponent(String(studentData.username || ''))}`, {
            params: { schoolCode: studentData.schoolCode },
          }),
          axios.get('https://cleezoclass.com:4000/api/feeDetailsByClassSection', {
            params: {
              className: studentData.class_name,
              section: studentData.section,
              schoolCode: studentData.schoolCode,
            },
          }),
          axios.post('https://cleezoclass.com:4000/api/studentFees', {
            studentId: studentData.studentId,
            schoolCode: studentData.schoolCode,
          }),
          axios.get(`https://cleezoclass.com:4000/api/payment/${studentData.studentId}?schoolCode=${studentData.schoolCode}`),
          axios.get('https://cleezoclass.com:4000/api/student-transactions-dynamic', {
            params: {
              schoolCode: studentData.schoolCode,
              studentName: studentData.name || studentData.username || '',
              className: studentData.class_name,
              section: studentData.section,
              includeUnpaid: 1,
            },
          }),
          axios.get(`https://cleezoclass.com:4000/feeStructure/${encodeURIComponent(String(studentData.class_name || ''))}`, {
            params: {
              schoolCode: studentData.schoolCode,
              section: studentData.section,
            },
          }),
        ]);

        if (!active) return;

        const feeApiPayload = feeApiRes.status === 'fulfilled' ? feeApiRes.value.data?.data || {} : {};
        const classFeeData = classRes.status === 'fulfilled' ? classRes.value.data?.feeDetail || {} : {};
        const studentFeeData = studentRes.status === 'fulfilled' ? studentRes.value.data?.feeDetails || {} : {};
        const paymentPayload = paymentRes.status === 'fulfilled' ? paymentRes.value.data?.payments || {} : {};
        const feeStructureData =
          feeStructureRes.status === 'fulfilled'
            ? feeStructureRes.value.data?.feeStructure || feeStructureRes.value.data?.feeDetail || {}
            : {};
        const fallbackClassFeeData =
          classRes.status === 'fulfilled'
            ? classRes.value.data?.feeDetail || classRes.value.data?.feeStructure || {}
            : {};
        const apiRows = dynamicRowsRes.status === 'fulfilled' && Array.isArray(dynamicRowsRes.value.data)
          ? dynamicRowsRes.value.data
          : [];

        console.log('[ParentFees] API response bodies:', {
          feeApiRes: feeApiRes.status === 'fulfilled' ? feeApiRes.value.data : feeApiRes.reason,
          classRes: classRes.status === 'fulfilled' ? classRes.value.data : classRes.reason,
          studentRes: studentRes.status === 'fulfilled' ? studentRes.value.data : studentRes.reason,
          paymentRes: paymentRes.status === 'fulfilled' ? paymentRes.value.data : paymentRes.reason,
          dynamicRowsRes: dynamicRowsRes.status === 'fulfilled' ? dynamicRowsRes.value.data : dynamicRowsRes.reason,
          feeStructureRes: feeStructureRes.status === 'fulfilled' ? feeStructureRes.value.data : feeStructureRes.reason,
        });

        console.log('[ParentFees] feeApiPayload keys:', Object.keys(feeApiPayload || {}));
        console.log('[ParentFees] classFeeData keys:', Object.keys(classFeeData || {}));
        console.log('[ParentFees] studentFeeData keys:', Object.keys(studentFeeData || {}));
        console.log('[ParentFees] paymentPayload keys:', Object.keys(paymentPayload || {}));
        console.log('[ParentFees] dynamicRowsRes status:', dynamicRowsRes.status);
        console.log('[ParentFees] dynamicRows count:', apiRows.length);
        console.log('[ParentFees] dynamicRows sample:', apiRows.slice(0, 5).map((row) => ({
          id: row?.id,
          studentName: row?.StudentName || row?.studentName || row?.name,
          className: row?.Class_name || row?.class_name || row?.className,
          section: row?.Section || row?.section || row?.sectionName,
          feeType: row?.fee_type || row?.feeType || row?.FeeType || row?.feeName,
          totalAmount: row?.CompleteFee || row?.completeFee || row?.Final_Amount || row?.Total_Amount || row?.totalAmount,
          paidAmount: row?.Paid_Amount || row?.paid_amount || row?.paidAmount,
          dueAmount: row?.Due_Amount || row?.Total_Due || row?.dueAmount,
        })));

        const routeFeeData = {
          ...(feeApiPayload || {}),
          ...(feeApiPayload?.studentFeeDetails || {}),
        };

        const mergedFeeData = {
          ...mergeFeeData(classFeeData, studentFeeData),
          ...routeFeeData,
          ...(paymentPayload || {}),
          ...(paymentPayload?.discounts || {}),
        };

        console.log('[ParentFees] fee fetch raw payloads:', {
          feeApiPayloadKeys: Object.keys(feeApiPayload || {}),
          classFeeDataKeys: Object.keys(classFeeData || {}),
          studentFeeDataKeys: Object.keys(studentFeeData || {}),
          paymentPayloadKeys: Object.keys(paymentPayload || {}),
          feeStructureDataKeys: Object.keys(feeStructureData || {}),
          fallbackClassFeeDataKeys: Object.keys(fallbackClassFeeData || {}),
          mergedFeeDataKeys: Object.keys(mergedFeeData || {}),
        });
        console.log('[ParentFees] fee fetch important values:', {
          studentName: studentData.name,
          className: studentData.class_name,
          section: studentData.section,
          schoolCode: studentData.schoolCode,
          studentId: studentData.studentId,
          routeFeeData,
        });
        console.log('[ParentFees] fee api summary payload:', feeApiPayload);
        console.log('[ParentFees] payment payload snapshot:', {
          totalRemaining: paymentPayload?.totalRemaining,
          totalDue: paymentPayload?.totalDue,
          totalPaid: paymentPayload?.totalPaid,
          paidAmount: paymentPayload?.paidAmount,
          finalAmount: paymentPayload?.finalAmount,
          completeFee: paymentPayload?.completeFee,
          feeBreakdown: Array.isArray(paymentPayload?.feeBreakdown)
            ? paymentPayload.feeBreakdown.map((row: any) => ({
                key: row?.key,
                label: row?.label,
                total: row?.total,
                amount: row?.amount,
                paid: row?.paid,
                discount: row?.discount,
                due: row?.due,
              }))
            : [],
        });

        setClassFeeSource(Object.keys(feeStructureData || {}).length ? feeStructureData : fallbackClassFeeData || null);
        setPaymentDetails({
          ...(paymentPayload || {}),
          ...(feeApiPayload || {}),
          ...(feeApiPayload?.studentFeeDetails || {}),
          ...(studentFeeData || {}),
          ...(paymentPayload?.discounts || {}),
        });
        setFeeApiSummary(feeApiPayload || null);
        console.log('[ParentFees] feeStructureData keys:', Object.keys(feeStructureData || {}));
        console.log('[ParentFees] fallbackClassFeeData keys:', Object.keys(fallbackClassFeeData || {}));
        console.log('[ParentFees] mergedFeeData keys:', Object.keys(mergedFeeData || {}));
      } catch {
        if (active) {
          showError('Fee Load Error', 'Unable to load fee details.');
          setClassFeeSource(null);
          setPaymentDetails(null);
        }
      }
    };

    const run = async () => {
      setLoading(true);
      await fetchFees();
      if (active) setLoading(false);
    };

    run();
    return () => {
      active = false;
    };
  }, [studentData?.class_name, studentData?.section, studentData?.schoolCode, studentData?.studentId, studentData?.username, showError]);

  const paymentSource = useMemo(
    () => {
      const flattened: Record<string, any> = {
        ...(paymentDetails || {}),
        ...(paymentDetails?.discounts || {}),
      };

      Object.entries(paymentDetails?.dynamicFeeTotals || {}).forEach(([key, value]) => {
        const normalized = normalizeFeeKey(key);
        if (!normalized) return;
        flattened[normalized] = value;
      });

      (Array.isArray(paymentDetails?.feeBreakdown) ? paymentDetails.feeBreakdown : []).forEach((row: any) => {
        const label = String(row?.label || row?.key || '').trim();
        const normalized = normalizeFeeKey(label);
        if (!normalized) return;

        flattened[normalized] = row?.total ?? row?.amount ?? flattened[normalized];
        flattened[`${normalized}_paid`] = row?.paid ?? flattened[`${normalized}_paid`];
        flattened[`${normalized}_discount`] = row?.discount ?? flattened[`${normalized}_discount`];
        flattened[`${normalized}_due`] = row?.due ?? flattened[`${normalized}_due`];
      });

      console.log('[ParentFees] flattened paymentSource:', flattened);
      return flattened;
    },
    [paymentDetails]
  );

  const feeRows = useMemo(() => {
    const dynamicRows = buildRowsFromSource(paymentSource, classFeeSource, dynamicFeeTypes, paymentDetails?.feeBreakdown || []);
    const allowedLabels = new Set(
      dynamicFeeTypes
        .map((item) => normalizeFeeKey(item?.columnBase || item?.feeName || item?.feesType || ''))
        .filter(Boolean)
    );
    const finalRows = dynamicRows.filter((row) => allowedLabels.size === 0 || allowedLabels.has(normalizeFeeKey(row.label)));

    console.log('[ParentFees] dynamicRows count:', dynamicRows.length);
    console.log('[ParentFees] final feeRows count:', finalRows.length);
    console.log('[ParentFees] final feeRows labels:', finalRows.map((row) => row.label));
    console.log('[ParentFees] paymentSource keys:', Object.keys(paymentSource || {}));
    console.log('[ParentFees] classFeeSource keys:', Object.keys(classFeeSource || {}));
    console.log('[ParentFees] feeSource resolved amounts:', {
      dynamicTypeCount: dynamicFeeTypes.length,
    });
    console.log('[ParentFees] summary row values:', finalRows.map((row) => ({
      label: row.label,
      amount: row.amount,
      paid: row.paid,
      discount: row.discount,
      due: row.due,
    })));

    return finalRows;
  }, [classFeeSource, dynamicFeeTypes, paymentDetails?.feeBreakdown, paymentSource]);

  const getExplicitNumeric = (source: Record<string, any> | null, keys: string[]) => {
    for (const key of keys) {
      if (!source || !Object.prototype.hasOwnProperty.call(source, key)) continue;
      const raw = source[key];
      if (raw === null || raw === undefined || raw === '') continue;
      return toNumber(raw);
    }
    return null;
  };

  const summaryTotalFee = useMemo(() => {
    return feeRows.reduce((sum, row) => sum + row.amount, 0);
  }, [feeRows]);

  const summaryPaid = useMemo(() => {
    return feeRows.reduce((sum, row) => sum + row.paid, 0);
  }, [feeRows]);

  const summaryDiscount = useMemo(() => {
    return feeRows.reduce((sum, row) => sum + row.discount, 0);
  }, [feeRows]);

  const summaryDue = useMemo(() => {
    return feeRows.reduce((sum, row) => sum + row.due, 0);
  }, [feeRows]);

  const feeChartMax = Math.max(summaryTotalFee, summaryPaid + summaryDue, 1);

  useEffect(() => {
    console.log('[ParentFees] summary totals:', {
      summaryTotalFee,
      summaryPaid,
      summaryDiscount,
      summaryDue,
      feeChartMax,
      feeRowsCount: feeRows.length,
    });
  }, [feeChartMax, feeRows.length, summaryDiscount, summaryDue, summaryPaid, summaryTotalFee]);

  const studentProfile = useMemo(
    () => ({
      studentName: paymentDetails?.studentName || studentData?.name || '-',
      fatherName: paymentDetails?.father_name || studentData?.father_name || studentData?.fatherName || '-',
      mobile: paymentDetails?.phone_no || studentData?.phone_no || studentData?.mobile || studentData?.phoneNumber || '-',
      admissionNo: paymentDetails?.admission_no || studentData?.admission_no || studentData?.admissionNo || '-',
      gender: paymentDetails?.gender || studentData?.gender || '-',
      email: paymentDetails?.email || studentData?.email || '-',
    }),
    [paymentDetails, studentData]
  );

  if (loading || !studentData) {
    return (
      <View style={embedded ? styles.embeddedShell : styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111" />
          <Text style={styles.loadingText}>Loading fee data...</Text>
        </View>
      </View>
    );
  }  

  const content = (
    <View style={embedded ? styles.embeddedContent : styles.content}>
      <StatusBar barStyle="light-content" backgroundColor="#0D3F66" translucent={false} />

      <LinearGradient
        colors={['#0D3F66', '#BFD7FA', '#F6F8FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.feeGradientSection}
      >
        {!embedded ? (
          <View style={styles.headerRow}>
            
        
            
          </View>
        ) : null}

        <View style={styles.feeGraphSection}>
          <View style={styles.feeGraphTitleRow}>
            <Text style={styles.feeGraphTitle}>Fee Status</Text>
            <Text style={styles.feeGraphSubtitle}>Paid amount vs amount remaining</Text>
          </View>

          <View style={styles.feeLegendRow}>
            <View style={styles.feeLegendItem}>
              <View style={[styles.feeLegendDot, { backgroundColor: '#2EE59D' }]} />
              <Text style={styles.feeLegendText}>Paid so far</Text>
            </View>
            <View style={styles.feeLegendItem}>
              <View style={[styles.feeLegendDot, { backgroundColor: '#F36B79' }]} />
              <Text style={styles.feeLegendText}>Amount remaining</Text>
            </View>
          </View>

          <View style={styles.feeChartCard}>
            <View style={styles.feeChartGrid}>
              {[
                { label: 'Paid so far', value: summaryPaid, color: '#2EE59D' },
                { label: 'Amount remaining', value: summaryDue, color: '#F36B79' },
              ].map((item) => {
                const heightPct = `${Math.max(6, (item.value / feeChartMax) * 100)}%`;
                return (
                  <View key={item.label} style={styles.feeChartItem}>
                    <Text style={styles.feeChartValue}>{formatINR(item.value)}</Text>
                    <View style={styles.feeChartBarTrack}>
                      <View
                        style={[
                          styles.feeChartBarFill,
                          {
                            height: heightPct,
                            backgroundColor: item.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.feeChartLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.studentDataWrap}>
        <View style={styles.transactionWrap}>
          <View style={styles.summaryRow}>
            <LinearGradient
              colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
              start={{ x: 0.05, y: 0.05 }}
              end={{ x: 0.95, y: 0.95 }}
              style={[styles.summaryGradientCard, styles.summaryCardLeft]}
            >
              <View style={styles.summaryGradientIconWrap}>
                <MaterialIcons name="payments" size={24} color="#1A1A1A" />
              </View>
              <View style={styles.summaryCardContent}>
                <Text style={styles.summaryGradientLabel}>Discount</Text>
                <Text style={styles.summaryGradientValue}>{formatINR(summaryDiscount)}</Text>
                <Text style={[styles.summaryGradientLabel, { marginTop: 8 }]}>Amount</Text>
                <Text style={styles.summaryGradientValue}>{formatINR(summaryTotalFee)}</Text>
              </View>
            </LinearGradient>
            <LinearGradient
              colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
              start={{ x: 0.05, y: 0.05 }}
              end={{ x: 0.95, y: 0.95 }}
              style={[styles.summaryGradientCard, styles.summaryCardRight]}
            >
              <View style={styles.summaryGradientIconWrap}>
                <MaterialIcons name="account-balance-wallet" size={24} color="#1A1A1A" />
              </View>
              <View style={styles.summaryCardContent}>
                <Text style={styles.summaryGradientLabel}>Due</Text>
                <Text style={styles.summaryGradientValue}>{formatINR(summaryDue)}</Text>
                <Text style={[styles.summaryGradientLabel, { marginTop: 8 }]}>Amount</Text>
                <Text style={styles.summaryGradientValue}>{formatINR(summaryPaid)}</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.thFee]}>Fee Type</Text>
              <Text style={styles.th}>Discount</Text>
              <Text style={styles.th}>Total</Text>
              <Text style={styles.th}>Paid</Text>
              <Text style={styles.th}>Due</Text>
            </View>

            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.tableBody}>
              {feeRows.length ? (
                feeRows.map((row) => (
                  <View key={row.key} style={styles.tableRow}>
                    <Text style={[styles.td, styles.tdFee]} numberOfLines={2}>
                      {row.label}
                    </Text>
                    <Text style={styles.td}>{formatINR(row.discount)}</Text>
                    <Text style={styles.td}>{formatINR(row.amount)}</Text>
                    <Text style={styles.td}>{formatINR(row.paid)}</Text>
                    <Text style={styles.td}>{formatINR(row.due)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No fee breakdown available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
              <ParentFooter />

    </View>
  );

  return embedded ? <View style={styles.embeddedCard}>{content}</View> : <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>;
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f6f7' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 20, backgroundColor: '#FFFFFF' },
  embeddedContent: { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 20 },
  embeddedShell: { flex: 1, backgroundColor: '#FFFFFF' },
  embeddedCard: { marginHorizontal: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerBrand: { width: 36, alignItems: 'flex-start' },
  headerTitleBlock: { flex: 1, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#111' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#666', textAlign: 'center' },
  logo: { width: 30, height: 30 },
  backBtn: { backgroundColor: '#404040', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  feeGradientSection: {
    marginHorizontal: -16,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  feeGraphSection: {
    paddingTop: 4,
  },
  feeGraphTitleRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  feeGraphTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: '#111',
  },
  feeGraphSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textAlign: 'left',
  },
  feeLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  feeLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 6,
  },
  feeLegendText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '700',
  },
  feeChartCard: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feeChartGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    minHeight: 220,
  },
  feeChartItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
  },
  feeChartValue: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  feeChartBarTrack: {
    width: '62%',
    height: 170,
    backgroundColor: 'rgba(17,24,39,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  feeChartBarFill: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 10,
  },
  feeChartLabel: {
    color: '#333',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  tabBtn: {
    borderWidth: 1,
    borderColor: '#D8D8DD',
    borderRadius: 18,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    marginBottom: 10,
  },
  tabBtnActive: {
    backgroundColor: '#404040',
    borderColor: '#404040',
  },
  tabText: { fontSize: 13, fontWeight: '700', color: '#222' },
  tabTextActive: { color: '#fff' },
  studentDataWrap: { paddingBottom: 8 },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoCard: {
    width: '31.5%',
    minWidth: 92,
    backgroundColor: '#FBF4F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6D6DA',
    padding: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  infoCardWide: {
    width: '64%',
    minWidth: 180,
    backgroundColor: '#FBF4F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6D6DA',
    padding: 12,
    marginBottom: 8,
  },
  infoLabel: { fontSize: 12, color: '#777', marginBottom: 8, textAlign: 'center' },
  infoValue: { fontSize: 15, color: '#222', fontWeight: '800', textAlign: 'center' },
  transactionWrap: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  summaryGradientCard: {
    flex: 1,
    minHeight: 210,
    borderRadius: 28,
    padding: 16,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  summaryCardLeft: { marginRight: 8 },
  summaryCardRight: { marginLeft: 8 },
  summaryGradientIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    marginBottom: 14,
  },
  summaryCardContent: {
    flex: 1,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  summaryGradientLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'right',
  },
  summaryGradientValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  tableCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E2E6',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f6f6f7',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  th: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
  },
  thFee: { flex: 1.25, textAlign: 'left' },
  tableBody: {
    paddingBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8EC',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
  },
  td: {
    flex: 1,
    fontSize: 11,
    color: '#222',
    textAlign: 'center',
  },
  tdFee: { flex: 1.25, textAlign: 'left', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: '#555' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 6, padding: 14 },
});

export default ParentFees;
