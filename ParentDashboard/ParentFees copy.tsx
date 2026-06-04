import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ErrorContext } from '../ErrorContext';
import ParentFooter from './ParentFooter';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentFees'>;
type FeesViewProps = Props & { embedded?: boolean };

const logoImage: ImageSourcePropType = require('../assets/Cleezo.png');

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);

const toNumber = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatFeeLabel = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bFees\b/g, 'Fee')
    .trim();

const RESERVED_FEE_KEYS = new Set([
  'id',
  'studentId',
  'student_id',
  'username',
  'name',
  'class_name',
  'section',
  'schoolCode',
  'FeeClass',
  'FeeSection',
  'Class_name',
  'StudentName',
  'CompleteFee',
  'Final_Amount',
  'Paid_Amount',
  'Discount',
  'Admission_paid',
  'books_paid',
  'uniform_paid',
  'bus_paid',
  'exam_paid',
  'others_paid',
  'Admission_Discount',
  'books_discount',
  'uniform_discount',
  'bus_discount',
  'exam_discount',
  'others_discount',
  'ResidentialCompleteFee',
  'feeDetails',
  'feeDetail',
  'login_id',
  'receiptNumber',
  'paidDate',
  'paymentMode',
  'transaction_id',
  'status',
  'remarks',
  'discount_reason',
  'Discount_Approved_By',
  'discount_Approved_By',
  'Discount_Date',
  'Discount_RefNo',
  'Discount_Referred_By',
  'marks_obtained',
  'rank',
  'grade',
  'frequency_type',
  'amount_paid',
  'previous_fee_due',
  'previous_paid',
  'UploadFeeDetails',
  'UpdatedCompleteFee',
  'createdAt',
  'updatedAt',
]);

const isFeeMetadataKey = (key: string) =>
  [
    /^login_id$/i,
    /^receiptNumber$/i,
    /^paidDate$/i,
    /^paymentMode$/i,
    /^transaction_id$/i,
    /^status$/i,
    /^remarks$/i,
    /^discount_reason$/i,
    /^discount_approved_by$/i,
    /^discount_date$/i,
    /^discount_refno$/i,
    /^discount_referred_by$/i,
    /^marks_obtained$/i,
    /^rank$/i,
    /^grade$/i,
    /^frequency_type$/i,
    /^amount_paid$/i,
    /^previous_fee_due$/i,
    /^previous_paid$/i,
    /^uploadfeedetails$/i,
    /^updatedcompletefee$/i,
  ].some((pattern) => pattern.test(key));

const getFirstNumericValue = (source: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = toNumber(source[key]);
      if (value || source[key] === 0) return value;
    }
  }
  return 0;
};

const mergeFeeData = (
  classFeeData: Record<string, any> | null,
  studentFeeData: Record<string, any> | null
) => {
  const merged: Record<string, any> = { ...(classFeeData || {}) };

  Object.entries(studentFeeData || {}).forEach(([key, studentValue]) => {
    const classValue = merged[key];

    if (studentValue === null || studentValue === undefined || studentValue === '') {
      return;
    }

    const studentLooksNumeric =
      typeof studentValue === 'number' ||
      (typeof studentValue === 'string' && studentValue.trim() !== '' && !Number.isNaN(Number(studentValue)));

    if (studentLooksNumeric) {
      const studentAmount = toNumber(studentValue);
      const classAmount = toNumber(classValue);
      if (studentAmount === 0 && classAmount > 0) {
        return;
      }
    }

    merged[key] = studentValue;
  });

  return merged;
};

const normalizeFeeKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const buildFeeRowsFromSummary = (
  source: Record<string, any> | null,
  dynamicFeeTypes: Array<Record<string, any>> = []
) => {
  if (!source) return [];

  const feeConfigs = [
    {
      label: 'Class Fee',
      totalKeys: ['CompleteFee', 'complete_fee', 'UpdatedCompleteFee', 'updatedCompleteFee'],
      paidKeys: ['Paid_Amount', 'paid_amount', 'Total_Paid', 'totalPaid'],
      discountKeys: ['Discount', 'feeDiscount', 'fee_discount'],
    },
    {
      label: 'Tuition Fee',
      totalKeys: ['completeFee', 'complete_fee', 'Final_Amount', 'final_amount'],
      paidKeys: ['paidAmount', 'Paid_Amount', 'paid_amount'],
      discountKeys: ['tuitionDiscount', 'tuition_discount'],
    },
    {
      label: 'Admission Fee',
      totalKeys: ['admissionFee', 'Admission_fees', 'Admission_Fees'],
      paidKeys: ['admissionPaid', 'Admission_paid', 'admission_paid'],
      discountKeys: ['admissionDiscount', 'Admission_Discount', 'admission_discount'],
    },
    {
      label: 'Books Fee',
      totalKeys: ['bookFee', 'Book_Fees', 'Books_Fees', 'book_fees'],
      paidKeys: ['bookPaid', 'books_paid', 'book_paid'],
      discountKeys: ['bookDiscount', 'books_discount', 'Book_Discount', 'book_discount'],
    },
    {
      label: 'Uniform Fee',
      totalKeys: ['uniformFee', 'Uniform_fees', 'uniform_fees'],
      paidKeys: ['uniformPaid', 'uniform_paid'],
      discountKeys: ['uniformDiscount', 'uniform_discount', 'Uniform_Discount'],
    },
    {
      label: 'Bus Fee',
      totalKeys: ['busFee', 'Bus_fees', 'Bus_Fees', 'transport', 'transport_fee'],
      paidKeys: ['busPaid', 'bus_paid', 'transport_paid'],
      discountKeys: ['busDiscount', 'bus_discount', 'transport_discount'],
    },
    {
      label: 'Exam Fee',
      totalKeys: ['examFee', 'Exam_fees', 'Exam_Fees', 'exam_fees'],
      paidKeys: ['examPaid', 'exam_paid'],
      discountKeys: ['examDiscount', 'exam_discount'],
    },
    {
      label: 'Other Fee',
      totalKeys: ['othersFee', 'Others', 'otherFee', 'other_fee'],
      paidKeys: ['othersPaid', 'others_paid', 'other_paid'],
      discountKeys: ['othersDiscount', 'others_discount', 'other_discount'],
    },
    {
      label: 'Library',
      totalKeys: ['library', 'libraryFee', 'library_fee'],
      paidKeys: ['libraryPaid', 'library_paid'],
      discountKeys: ['libraryDiscount', 'library_discount'],
    },
    {
      label: 'Stationary',
      totalKeys: ['stationary', 'stationery', 'stationaryFee', 'stationeryFee'],
      paidKeys: ['stationaryPaid', 'stationary_paid', 'stationery_paid'],
      discountKeys: ['stationaryDiscount', 'stationary_discount', 'stationery_discount'],
    },
    {
      label: 'Guides',
      totalKeys: ['guides', 'guide', 'guidesFee', 'guide_fee'],
      paidKeys: ['guidesPaid', 'guides_paid', 'guide_paid'],
      discountKeys: ['guidesDiscount', 'guides_discount', 'guide_discount'],
    },
    {
      label: 'Belt',
      totalKeys: ['belt', 'belt_fee', 'beltFee'],
      paidKeys: ['beltPaid', 'belt_paid', 'belt_fee_paid'],
      discountKeys: ['beltDiscount', 'belt_discount', 'belt_fee_discount'],
    },
    {
      label: 'Tie',
      totalKeys: ['tie', 'tie_fee', 'tieFee'],
      paidKeys: ['tieFeePaid', 'tie_fee_paid', 'tie_paid'],
      discountKeys: ['tieDiscount', 'tie_discount', 'tie_fee_discount'],
    },
    {
      label: 'Sports',
      totalKeys: ['sports', 'sport', 'sportsFee', 'sport_fee'],
      paidKeys: ['sportsPaid', 'sports_paid', 'sport_paid'],
      discountKeys: ['sportsDiscount', 'sports_discount', 'sport_discount'],
    },
    {
      label: 'Saving',
      totalKeys: ['Saving_Fees', 'saving_fees', 'Savings_Fees'],
      paidKeys: ['Saving_paid', 'saving_paid', 'Savings_paid'],
      discountKeys: ['Saving_Discount', 'saving_discount', 'Savings_discount'],
    },
    {
      label: 'Residential Fee',
      totalKeys: ['ResidentialCompleteFee', 'residentialFee', 'residential_fee'],
      paidKeys: ['residentialPaid', 'ResidentialPaid', 'residential_paid'],
      discountKeys: ['ResidentialDiscount', 'residential_discount'],
    },
  ];

  const rowMap = new Map<string, any>();
  const sourceEntries = Object.entries(source).map(([key, value]) => [normalizeFeeKey(key), value] as const);
  const sourceKeys = new Set(sourceEntries.map(([key]) => key));

  const findFirstValue = (keys: string[]) => {
    for (const key of keys) {
      const normalizedKey = normalizeFeeKey(key);
      const matched = sourceEntries.find(([candidate]) => candidate === normalizedKey);
      if (matched) {
        const numeric = toNumber(matched[1]);
        if (Number.isFinite(numeric)) return numeric;
      }
    }
    return 0;
  };

  const dynamicFeeNames = new Set<string>();
  (dynamicFeeTypes || []).forEach((fee) => {
    const label = String(fee?.feeName || fee?.feesType || fee?.label || '').trim();
    const normalized = normalizeFeeKey(fee?.columnBase || label);
    if (normalized) dynamicFeeNames.add(normalized);
    if (label) dynamicFeeNames.add(normalizeFeeKey(label));
  });

  const coveredKeys = new Set(
    feeConfigs.flatMap((config) => [
      ...config.totalKeys.map((key) => normalizeFeeKey(key)),
      ...config.paidKeys.map((key) => normalizeFeeKey(key)),
      ...config.discountKeys.map((key) => normalizeFeeKey(key)),
      normalizeFeeKey(config.label),
    ])
  );

  const pushRow = (label: string, total: number, paid: number, discount: number) => {
    const due = Math.max(total - paid - discount, 0);
    if (total <= 0 && paid <= 0 && discount <= 0 && due <= 0) return;
    rowMap.set(normalizeFeeKey(label), {
      key: label,
      label,
      amount: total,
      paid,
      discount,
      due,
    });
  };

  feeConfigs.forEach((config) => {
    const total = findFirstValue(config.totalKeys);
    const paid = findFirstValue(config.paidKeys);
    const discount = findFirstValue(config.discountKeys);

    if (total <= 0 && paid <= 0 && discount <= 0) {
      return;
    }

    pushRow(config.label, total, paid, discount);
  });

  Object.entries(source).forEach(([rawKey, rawValue]) => {
    const normalizedKey = normalizeFeeKey(rawKey);
    if (!normalizedKey) return;
    if (coveredKeys.has(normalizedKey)) return;
    if (
      normalizedKey === 'id' ||
      normalizedKey === 'student_id' ||
      normalizedKey === 'username' ||
      normalizedKey === 'name' ||
      normalizedKey === 'class_name' ||
      normalizedKey === 'classname' ||
      normalizedKey === 'section' ||
      normalizedKey === 'schoolcode' ||
      normalizedKey.endsWith('_paid') ||
      normalizedKey.endsWith('_due') ||
      normalizedKey.endsWith('_discount') ||
      normalizedKey.startsWith('total_') ||
      normalizedKey.startsWith('dynamicfee')
    ) {
      return;
    }

    const amount = toNumber(rawValue);
    const isDynamicFee = dynamicFeeNames.has(normalizedKey);
    const shouldInclude = amount > 0 || isDynamicFee;
    if (!shouldInclude) return;

    const paid = findFirstValue([
      `${rawKey}_paid`,
      `${rawKey}_Paid`,
      `${normalizedKey}_paid`,
      `${normalizedKey}_Paid`,
    ]);
    const discount = findFirstValue([
      `${rawKey}_discount`,
      `${rawKey}_Discount`,
      `${normalizedKey}_discount`,
      `${normalizedKey}_Discount`,
    ]);

    pushRow(formatFeeLabel(rawKey), amount, paid, discount);
  });

  return Array.from(rowMap.values());
};

const buildFeeRowsFromBackend = (payment: Record<string, any> | null) => {
  const breakdown = Array.isArray(payment?.feeBreakdown) ? payment.feeBreakdown : [];
  console.log('[ParentFees] backend feeBreakdown raw:', breakdown);
  return breakdown
    .map((row: any, index: number) => ({
      key: String(row?.label || row?.key || `fee-${index}`),
      label: String(row?.label || row?.key || `Fee ${index + 1}`),
      amount: toNumber(row?.total ?? row?.amount),
      paid: toNumber(row?.paid),
      discount: toNumber(row?.discount),
      due: toNumber(row?.due),
    }))
    .filter((row) => {
      const keep = row.amount > 0 || row.paid > 0 || row.discount > 0 || row.due > 0;
      if (!keep) {
        console.log('[ParentFees] backend fee row filtered out:', row);
      } else {
        console.log('[ParentFees] backend fee row kept:', row);
      }
      return keep;
    });
};

const mergeFeeRows = (
  primaryRows: Array<{
    key: string;
    label: string;
    amount: number;
    paid: number;
    discount: number;
    due: number;
  }>,
  fallbackRows: Array<{
    key: string;
    label: string;
    amount: number;
    paid: number;
    discount: number;
    due: number;
  }>
) => {
  const merged = new Map<string, (typeof primaryRows)[number]>();

  fallbackRows.forEach((row) => {
    merged.set(normalizeFeeKey(row.label || row.key), row);
  });

  primaryRows.forEach((row) => {
    const normalizedKey = normalizeFeeKey(row.label || row.key);
    const existing = merged.get(normalizedKey);
    if (!existing) {
      merged.set(normalizedKey, row);
      return;
    }

    merged.set(normalizedKey, {
      ...existing,
      ...row,
      amount: row.amount || existing.amount,
      paid: row.paid || existing.paid,
      discount: row.discount || existing.discount,
      due: row.due || existing.due,
    });
  });

  return Array.from(merged.values());
};

const buildDynamicFeeRows = (feeData: Record<string, any> | null) => {
  if (!feeData) return [];

  const rows: Array<{
    key: string;
    label: string;
    amount: number;
    paid: number;
    discount: number;
    due: number;
  }> = [];
  const consumedKeys = new Set<string>();

  const addRow = (config: {
    key: string;
    label: string;
    amountKeys: string[];
    paidKeys: string[];
    discountKeys: string[];
  }) => {
    const amount = getFirstNumericValue(feeData, [config.key, ...config.amountKeys]);
    if (amount <= 0) return;

    const paid = getFirstNumericValue(feeData, config.paidKeys);
    const discount = getFirstNumericValue(feeData, config.discountKeys);

    rows.push({
      key: config.key,
      label: config.label,
      amount,
      paid,
      discount,
      due: Math.max(amount - paid - discount, 0),
    });

    [config.key, ...config.amountKeys, ...config.paidKeys, ...config.discountKeys].forEach((key) =>
      consumedKeys.add(key)
    );
  };

  addRow({
    key: 'Tuition_Fee',
    label: 'Tuition Fee',
    amountKeys: ['Tuition_Fee', 'Calculated_Tuition_Fee', 'CompleteFee', 'Final_Amount'],
    paidKeys: ['Paid_Amount'],
    discountKeys: ['Discount'],
  });
  addRow({
    key: 'Admission_fees',
    label: 'Admission Fee',
    amountKeys: ['Admission_fees'],
    paidKeys: ['Admission_paid'],
    discountKeys: ['Admission_Discount'],
  });
  addRow({
    key: 'Book_Fees',
    label: 'Books Fee',
    amountKeys: ['Book_Fees', 'Books_Fees'],
    paidKeys: ['books_paid'],
    discountKeys: ['books_discount', 'Book_Discount'],
  });
  addRow({
    key: 'Uniform_fees',
    label: 'Uniform Fee',
    amountKeys: ['Uniform_fees'],
    paidKeys: ['uniform_paid'],
    discountKeys: ['uniform_discount', 'Uniform_Discount'],
  });
  addRow({
    key: 'Bus_fees',
    label: 'Bus Fee',
    amountKeys: ['Bus_fees'],
    paidKeys: ['bus_paid'],
    discountKeys: ['bus_discount', 'Bus_Discount'],
  });
  addRow({
    key: 'Exam_fees',
    label: 'Exam Fee',
    amountKeys: ['Exam_fees'],
    paidKeys: ['exam_paid'],
    discountKeys: ['exam_discount', 'Exam_Discount'],
  });
  addRow({
    key: 'Others',
    label: 'Other Fee',
    amountKeys: ['Others'],
    paidKeys: ['others_paid'],
    discountKeys: ['others_discount', 'Others_Discount'],
  });
  addRow({
    key: 'Saving_Fees',
    label: 'Saving Fee',
    amountKeys: ['Saving_Fees'],
    paidKeys: ['Saving_paid'],
    discountKeys: ['Saving_discount', 'Saving_Discount'],
  });
  addRow({
    key: 'ResidentialCompleteFee',
    label: 'Residential Fee',
    amountKeys: ['ResidentialCompleteFee'],
    paidKeys: ['ResidentialPaid', 'residentialPaid'],
    discountKeys: ['ResidentialDiscount'],
  });

  Object.keys(feeData).forEach((key) => {
    if (consumedKeys.has(key) || RESERVED_FEE_KEYS.has(key) || isFeeMetadataKey(key)) return;
    if (/_paid$|_due$|_discount$/i.test(key)) return;

    const amount = toNumber(feeData[key]);
    if (amount <= 0) return;

    const paid = getFirstNumericValue(feeData, [
      `${key}_paid`,
      `${key}_Paid`,
      `${key.replace(/fees?/i, '')}_paid`,
      `${key.replace(/fees?/i, '')}Paid`,
    ]);
    const discount = getFirstNumericValue(feeData, [
      `${key}_discount`,
      `${key}_Discount`,
      `${key.replace(/fees?/i, '')}_discount`,
      `${key.replace(/fees?/i, '')}Discount`,
    ]);
    rows.push({
      key,
      label: formatFeeLabel(key),
      amount,
      paid,
      discount,
      due: Math.max(amount - paid - discount, 0),
    });
  });

  return rows;
};

const ParentFees: React.FC<FeesViewProps> = ({ navigation, embedded = false }) => {
  const [studentData, setStudentData] = useState<Record<string, any> | null>(null);
  const [fees, setFees] = useState<Record<string, any> | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any> | null>(null);
  const [dynamicFeeTypes, setDynamicFeeTypes] = useState<Array<Record<string, any>>>([]);
  const [activeTab, setActiveTab] = useState<'studentData' | 'transactions'>('studentData');
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
        console.log('[ParentFees] AsyncStorage student data:', data);
        setStudentData(data);
      } catch {
        console.log('[ParentFees] Failed to load student data from AsyncStorage');
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
        console.log('[ParentFees] fetchFees studentData:', studentData);
        const [studentFeeRes, classRes, studentRes] = await Promise.allSettled([
          axios.get(
            `https://cleezoclass.com:4000/api/fees/${encodeURIComponent(String(studentData.username || ''))}`,
            {
              params: { schoolCode: studentData.schoolCode },
            }
          ),
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
        ]);

        if (!active) return;

        const studentFeePayload = studentFeeRes.status === 'fulfilled' ? studentFeeRes.value.data?.data || {} : {};
        const classFeeData = classRes.status === 'fulfilled' ? classRes.value.data?.feeDetail || {} : {};
        const studentFeeData = studentRes.status === 'fulfilled' ? studentRes.value.data?.feeDetails || {} : {};

        console.log('[ParentFees] studentFeeRes status:', studentFeeRes.status);
        console.log('[ParentFees] classRes status:', classRes.status);
        console.log('[ParentFees] studentRes status:', studentRes.status);
        console.log('[ParentFees] studentFeePayload:', studentFeePayload);
        console.log('[ParentFees] classFeeData:', classFeeData);
        console.log('[ParentFees] studentFeeData:', studentFeeData);

        const routeFeeData = {
          ...(studentFeePayload || {}),
          ...(studentFeePayload?.studentFeeDetails || {}),
        };
        const mergedFeeData = {
          ...mergeFeeData(classFeeData, studentFeeData),
          ...routeFeeData,
        };

        setFees(mergedFeeData);
      } catch {
        if (active) {
          showError('Fee Load Error', 'Unable to load fee details.');
          setFees(null);
        }
      }
    };

    const fetchPaymentDetails = async () => {
      try {
        if (!studentData?.studentId || !studentData?.schoolCode) return;
        const paymentApiUrl = `https://cleezoclass.com:4000/api/payment/${studentData.studentId}?schoolCode=${studentData.schoolCode}`;
        console.log('[ParentFees] paymentDetails API:', paymentApiUrl);
        console.log('[ParentFees] paymentDetails payload:', {
          studentId: studentData.studentId,
          schoolCode: studentData.schoolCode,
        });
        const res = await axios.get(
          paymentApiUrl
        );
        if (!active) return;
        console.log('[ParentFees] payment response:', res?.data?.payments || {});
        setPaymentDetails(res?.data?.payments || {});
      } catch {
        if (active) setPaymentDetails(null);
      }
    };

    const run = async () => {
      setLoading(true);
      await Promise.all([fetchFees(), fetchPaymentDetails()]);
      if (active) setLoading(false);
    };

    run();
    return () => {
      active = false;
    };
  }, [studentData?.class_name, studentData?.section, studentData?.schoolCode, studentData?.studentId, showError]);

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

  if (!fees) {
    return (
      <View style={embedded ? styles.embeddedShell : styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No fee data available.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack?.()}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const feeSource = {
    ...(fees || {}),
    ...(paymentDetails || {}),
    ...(paymentDetails?.discounts || {}),
  };
  console.log('[ParentFees] feeSource merged:', feeSource);
  console.log('[ParentFees] feeSource keys:', Object.keys(feeSource || {}));
  console.log('[ParentFees] fees state:', fees);
  console.log('[ParentFees] paymentDetails state:', paymentDetails);
  const backendFeeRows = buildFeeRowsFromBackend(paymentDetails);
  const summaryFeeRows = buildFeeRowsFromSummary(feeSource, dynamicFeeTypes);
  const dynamicFeeRows = buildDynamicFeeRows(feeSource);
  console.log('[ParentFees] backendFeeRows:', backendFeeRows);
  console.log('[ParentFees] summaryFeeRows:', summaryFeeRows);
  console.log('[ParentFees] dynamicFeeRows:', dynamicFeeRows);
  const finalAmount = Number(
    paymentDetails?.completeFee ??
      paymentDetails?.originalCompleteFee ??
      fees?.Final_Amount ??
      fees?.CompleteFee ??
      0
  );
  const webStyleRows = (() => {
    const payment = paymentDetails || {};
    const numeric = (value: any) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const rows = [
      {
        key: 'tuition-fee',
        label: 'Tuition Fee',
        amount: numeric(payment.completeFee || payment.originalCompleteFee || fees?.CompleteFee || 0),
        paid: numeric(payment.paidAmount),
        discount: numeric(payment.tuitionDiscount || payment.discounts?.tuitionDiscount),
        due: numeric(payment.tuitionRemaining),
      },
      {
        key: 'admission-fee',
        label: 'Admission Fee',
        amount: numeric(payment.admissionFee || payment.originalAdmissionFee),
        paid: numeric(payment.admissionPaid),
        discount: numeric(payment.admissionDiscount || payment.discounts?.admissionDiscount),
        due: numeric(payment.admissionRemaining),
      },
      {
        key: 'book-fee',
        label: 'Books Fee',
        amount: numeric(payment.bookFee || payment.originalBookFee),
        paid: numeric(payment.bookPaid),
        discount: numeric(payment.bookDiscount || payment.discounts?.bookDiscount || 0),
        due: numeric(payment.bookRemaining),
      },
      {
        key: 'uniform-fee',
        label: 'Uniform Fee',
        amount: numeric(payment.uniformFee || payment.originalUniformFee),
        paid: numeric(payment.uniformPaid),
        discount: numeric(payment.uniformDiscount || payment.discounts?.uniformDiscount || 0),
        due: numeric(payment.uniformRemaining),
      },
      {
        key: 'exam-fee',
        label: 'Exam Fee',
        amount: numeric(payment.examFee || payment.originalExamFee),
        paid: numeric(payment.examPaid),
        discount: numeric(payment.examDiscount || payment.discounts?.examDiscount || 0),
        due: numeric(payment.examRemaining),
      },
      {
        key: 'bus-fee',
        label: 'Bus Fee',
        amount: numeric(payment.busFee || payment.originalBusFee),
        paid: numeric(payment.busPaid),
        discount: numeric(payment.busDiscount || payment.discounts?.busDiscount),
        due: numeric(payment.busRemaining),
      },
      {
        key: 'other-fee',
        label: 'Other Fees',
        amount: numeric(payment.othersFee || payment.originalOthersFee),
        paid: numeric(payment.othersPaid),
        discount: numeric(payment.othersDiscount || payment.discounts?.othersDiscount || 0),
        due: numeric(payment.othersRemaining),
      },
      {
        key: 'residential-fee',
        label: 'Residential Fee',
        amount: numeric(payment.residentialFee || payment.originalResidentialFee),
        paid: numeric(payment.residentialPaid),
        discount: numeric(payment.residentialDiscount || payment.discounts?.residentialDiscount || 0),
        due: numeric(payment.residentialRemaining),
      },
    ];

    const dynamicRows: Array<{ key: string; label: string; amount: number; paid: number; discount: number; due: number }> = [];
    const dynamicDiscounts = payment.dynamicFeeDiscounts || {};
    const dynamicTotals = payment.dynamicFeeTotals || {};

    const addDynamicRow = (label: string, total: any, paid: any, discount: any) => {
      const amount = numeric(total);
      const paidAmount = numeric(paid);
      const discountAmount = numeric(discount);
      const dueAmount = Math.max(amount - paidAmount - discountAmount, 0);
      if (amount <= 0 && paidAmount <= 0 && discountAmount <= 0 && dueAmount <= 0) return;
      dynamicRows.push({
        key: normalizeFeeKey(label),
        label,
        amount,
        paid: paidAmount,
        discount: discountAmount,
        due: dueAmount,
      });
    };

    Object.entries(dynamicTotals).forEach(([key, total]) => {
      const label = formatFeeLabel(key);
      addDynamicRow(
        label,
        total,
        payment[`${key}_paid`] ?? payment[`${key}Paid`] ?? payment[`${key}_fee_paid`],
        payment[`${key}_discount`] ?? payment[`${key}Discount`] ?? dynamicDiscounts?.[key]
      );
    });

    if (Array.isArray(payment.feeBreakdown) && payment.feeBreakdown.length) {
      payment.feeBreakdown.forEach((row: any) => {
        const label = String(row?.label || row?.key || '').trim();
        if (!label) return;
        const amount = numeric(row?.total ?? row?.amount);
        const paidAmount = numeric(row?.paid);
        const discountAmount = numeric(row?.discount);
        const dueAmount = numeric(row?.due);
        const normalized = normalizeFeeKey(label);
        if (
          ['class_fee', 'tuition_fee', 'admission_fee', 'books_fee', 'uniform_fee', 'bus_fee', 'exam_fee', 'other_fee', 'residential_fee'].includes(normalized)
        ) {
          return;
        }
        if (amount <= 0 && paidAmount <= 0 && discountAmount <= 0 && dueAmount <= 0) return;
        dynamicRows.push({
          key: normalized || label,
          label,
          amount,
          paid: paidAmount,
          discount: discountAmount,
          due: dueAmount || Math.max(amount - paidAmount - discountAmount, 0),
        });
      });
    }

    const combined = [...rows, ...dynamicRows];
    const seen = new Set<string>();
    return combined.filter((row) => {
      const key = normalizeFeeKey(row.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return row.amount > 0 || row.paid > 0 || row.discount > 0 || row.due > 0;
    });
  })();

  const totalPaidAmount = webStyleRows.reduce((sum, row) => sum + row.paid, 0);
  const totalDiscount = webStyleRows.reduce((sum, row) => sum + row.discount, 0);
  const totalDue =
    Number(paymentDetails?.totalRemaining ?? paymentDetails?.totalDue ?? 0) ||
    Math.max(finalAmount - totalPaidAmount - totalDiscount, 0);

  console.log('[ParentFees] computed totals:', {
    finalAmount,
    totalPaid: totalPaidAmount,
    totalDue,
    fees,
    feeRowsCount: webStyleRows.length,
  });

  const studentProfile = {
    studentName: paymentDetails?.studentName || studentData?.name || '-',
    fatherName: paymentDetails?.father_name || studentData?.father_name || studentData?.fatherName || '-',
    mobile: paymentDetails?.phone_no || studentData?.phone_no || studentData?.mobile || studentData?.phoneNumber || '-',
    admissionNo: paymentDetails?.admission_no || studentData?.admission_no || studentData?.admissionNo || '-',
    gender: paymentDetails?.gender || studentData?.gender || '-',
    email: paymentDetails?.email || studentData?.email || '-',
  };

  const paymentRows = webStyleRows
    .map((row) => ({
      id: row.key,
      feeType: row.label,
      discount: row.discount,
      totalAmount: row.amount,
      paidAmount: row.paid,
      dueAmount: row.due,
      paymentDate: '-',
    }))
    .filter((row) => row.totalAmount > 0 || row.paidAmount > 0 || row.dueAmount > 0);

  const content = (
    <View style={embedded ? styles.embeddedContent : styles.content}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.webShell}>
        <View style={styles.webTopRow}>
          <View style={styles.webBrandBlock}>
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.webTitleBlock}>
            <Text style={styles.webTitle}>Fees</Text>
            <Text style={styles.webSubtitle}>
              {studentProfile.studentName} {studentData?.class_name || ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack?.()}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webTabRow}>
          <TouchableOpacity
            style={[styles.webTab, activeTab === 'studentData' && styles.webTabActive]}
            onPress={() => setActiveTab('studentData')}
          >
            <Text style={[styles.webTabText, activeTab === 'studentData' && styles.webTabTextActive]}>
              Student Data
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.webTab, activeTab === 'transactions' && styles.webTabActive]}
            onPress={() => setActiveTab('transactions')}
          >
            <Text style={[styles.webTabText, activeTab === 'transactions' && styles.webTabTextActive]}>
              Student Transactions
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'studentData' ? (
          <View style={styles.studentDataGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Student</Text>
              <Text style={styles.infoValue}>{studentProfile.studentName}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Father Name</Text>
              <Text style={styles.infoValue}>{studentProfile.fatherName}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Mobile Number</Text>
              <Text style={styles.infoValue}>{studentProfile.mobile}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Admission No</Text>
              <Text style={styles.infoValue}>{studentProfile.admissionNo}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue}>{studentProfile.gender}</Text>
            </View>
            <View style={styles.infoCardWide}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{studentProfile.email}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.transactionWrap}>
            <View style={styles.summaryBar}>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricLabel}>Total Fee</Text>
                <Text style={styles.summaryMetricValue}>{formatINR(finalAmount)}</Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricLabel}>Paid</Text>
                <Text style={styles.summaryMetricValue}>{formatINR(totalPaidAmount)}</Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricLabel}>Discount</Text>
                <Text style={styles.summaryMetricValue}>{formatINR(totalDiscount)}</Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryMetricLabel}>Due</Text>
                <Text style={styles.summaryMetricValue}>{formatINR(totalDue)}</Text>
              </View>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.thFee]}>Fee Type</Text>
                <Text style={styles.th}>Discount</Text>
                <Text style={styles.th}>Total</Text>
                <Text style={styles.th}>Paid</Text>
                <Text style={styles.th}>Due</Text>
                <Text style={styles.th}>Date</Text>
              </View>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.tableBody}
              >
                {paymentRows.length ? (
                  paymentRows.map((row) => (
                    <View key={row.id} style={styles.tableRow}>
                      <Text style={[styles.td, styles.tdFee]} numberOfLines={2}>
                        {row.feeType}
                      </Text>
                      <Text style={styles.td}>{formatINR(row.discount)}</Text>
                      <Text style={styles.td}>{formatINR(row.totalAmount)}</Text>
                      <Text style={styles.td}>{formatINR(row.paidAmount)}</Text>
                      <Text style={styles.td}>{formatINR(row.dueAmount)}</Text>
                      <Text style={styles.td}>{row.paymentDate}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyTableText}>No fee breakdown available.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  return embedded ? (
    <View style={styles.embeddedCard}>
      {content}
      <ParentFooter embedded={embedded} />
    </View>
  ) : (
    <SafeAreaView style={styles.safeArea}>
      {content}
      <ParentFooter />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F6F7' },
  content: { flex: 1, padding: 16, paddingBottom: 28 },
  embeddedContent: { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitleBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '800', color: '#111' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#666' },
  backBtn: { backgroundColor: '#404040', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  summaryCard: {
    backgroundColor: '#f6f6f7',
    borderRadius: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    padding: 18,
    marginBottom: 16,
  },
  embeddedSummaryCard: {
    padding: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryBlock: { flex: 1 },
  summaryLabel: { fontSize: 12, color: '#666', fontWeight: '700' },
  amount: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 6 },
  duePill: { marginTop: 14, backgroundColor: '#FFF2B3', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, alignSelf: 'flex-start' },
  dueText: { fontSize: 14, fontWeight: '800', color: '#111' },
  scrollArea: { flex: 1, minHeight: 260 },
  breakdownScroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 12,
  },
  sectionCard: {
    backgroundColor: '#f6f6f7',
    borderRadius: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    padding: 14,
    marginBottom: 12,
  },
  embeddedSectionCard: {
    padding: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 12 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  lineLabel: { fontSize: 13, color: '#333', fontWeight: '600' },
  lineValue: { fontSize: 13, color: '#111', fontWeight: '700' },
  feeCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
    padding: 12,
    marginBottom: 10,
  },
  feeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeCardTitle: { fontSize: 14, fontWeight: '800', color: '#111' },
  feeCardAmount: { fontSize: 14, fontWeight: '800', color: '#111' },
  feeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  feeMetaLabel: { fontSize: 12, color: '#666', fontWeight: '600' },
  feeMetaValue: { fontSize: 12, color: '#111', fontWeight: '700' },
  installmentCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderRadius: 14,    
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  installmentTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  installmentTitle: { fontSize: 14, fontWeight: '800', color: '#111' },
  installmentAmount: { fontSize: 14, fontWeight: '800', color: '#111' },
  installmentText: { fontSize: 12, color: '#555', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: '#555' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 6 },
  embeddedShell: { padding: 0 },
  embeddedHeader: { marginBottom: 12 },
  embeddedTitle: { fontSize: 22, fontWeight: '800', color: '#111' },
  logo: { width: 30, height: 30 },
  embeddedCard: { marginHorizontal: 0 },
  webShell: { flex: 1 },
  webTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  webBrandBlock: {
    width: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  webTitleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webTitle: { fontSize: 24, fontWeight: '800', color: '#111', textAlign: 'center' },
  webSubtitle: { marginTop: 4, fontSize: 13, color: '#666', textAlign: 'center' },
  webTabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  webTab: {
    borderWidth: 1,
    borderColor: '#D8D8DD',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  webTabActive: {
    backgroundColor: '#404040',
    borderColor: '#404040',
  },
  webTabText: { fontSize: 13, fontWeight: '700', color: '#222' },
  webTabTextActive: { color: '#fff' },
  studentDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoCard: {
    flexBasis: '31%',
    minWidth: 92,
    backgroundColor: '#FBF4F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6D6DA',
    padding: 12,
  },
  infoCardWide: {
    flexBasis: '64%',
    minWidth: 180,
    backgroundColor: '#FBF4F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6D6DA',
    padding: 12,
  },
  infoLabel: { fontSize: 12, color: '#777', marginBottom: 8, textAlign: 'center' },
  infoValue: { fontSize: 15, color: '#222', fontWeight: '800', textAlign: 'center' },
  transactionWrap: { flex: 1 },
  summaryBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  summaryMetric: {
    flexBasis: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E6EA',
    padding: 12,
  },
  summaryMetricLabel: { fontSize: 12, color: '#666', fontWeight: '700' },
  summaryMetricValue: { marginTop: 6, fontSize: 17, color: '#111', fontWeight: '800' },
  table: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E2E6',
    overflow: 'hidden',
    backgroundColor: '#fff',
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#FDECEF',
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
  thFee: { flex: 1.3, textAlign: 'left' },
  tableBody: {
    paddingBottom: 10,
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
  tdFee: { flex: 1.3, textAlign: 'left', fontWeight: '700' },
  emptyTableText: {
    textAlign: 'center',
    color: '#666',
    padding: 16,
  },
});

export default ParentFees;
