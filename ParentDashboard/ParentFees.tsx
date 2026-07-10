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

type BackendFeeBreakdown = {
  key: string;
  label: string;
  total: number;
  paid: number;
  discount: number;
  remaining: number;
  scope: string;
};

type BackendPaymentResponse = {
  payments: {
    studentName: string;
    class: string;
    section: string;
    dynamicFeeBreakdown: BackendFeeBreakdown[];
    totalFee: number;
    totalPaid: number;
    totalDiscount: number;
    totalRemaining: number;
  };
};

type StudentDiscountData = {
  id: string;
  name: string;
  totalDiscount: number;
  totalPaid: number;
  totalDue: number;
  totalFee: number;
  feeDiscounts: Record<string, number>;
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

const normalizeComparable = (value: any) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const ParentFees: React.FC<FeesViewProps> = ({ navigation, embedded = false }) => {
  const { height, width } = useWindowDimensions();
  const appStyles = useMemo(
    () => createAppStyles({ phoneWidth: width, phoneHeight: height }),
    [height, width]
  );
  const [studentData, setStudentData] = useState<Record<string, any> | null>(null);
  const [classFeeSource, setClassFeeSource] = useState<Record<string, any> | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<BackendPaymentResponse | null>(null);
  const [feeApiSummary, setFeeApiSummary] = useState<Record<string, any> | null>(null);
  const [dynamicFeeTypes, setDynamicFeeTypes] = useState<DynamicFeeType[]>([]);
  const [studentsWithDiscounts, setStudentsWithDiscounts] = useState<StudentDiscountData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { showError } = React.useContext(ErrorContext);

  // Fetch student data
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const keys = ['studentId', 'username', 'name', 'class_name', 'section', 'schoolCode'];
        const stores = await AsyncStorage.multiGet(keys);
        const data: Record<string, any> = {};
        stores.forEach(([key, value]) => {
          if (value) data[key] = value;
        });
        console.log('[ParentFees] Student Data:', data);
        setStudentData(data);
      } catch {
        showError('Data Error', 'Failed to load student information.');
      }
    };

    fetchStudentData();
  }, [showError]);

  // Fetch dynamic fee types
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
        const feeTypes = rows
          .filter((item: Record<string, any>) => String(item?.feeName || item?.feesType || '').trim() !== '')
          .map((item: Record<string, any>) => ({
            id: item?.id,
            feeName: item?.feeName || '',
            feesType: item?.feesType || '',
            scope: item?.scope || '',
            frequency: item?.frequency || '',
            installments: item?.installments || 1,
            columnBase: normalizeFeeKey(item?.columnBase || item?.feeName || item?.feesType || ''),
          }));
        console.log('[ParentFees] Dynamic Fee Types:', feeTypes);
        setDynamicFeeTypes(feeTypes);
      } catch {
        if (active) setDynamicFeeTypes([]);
      }
    };

    fetchDynamicFeeTypes();
    return () => {
      active = false;
    };
  }, [studentData?.schoolCode]);

  // Fetch fees and payment details
  useEffect(() => {
    let active = true;

    const fetchFees = async () => {
      try {
        if (!studentData?.class_name || !studentData?.section || !studentData?.schoolCode) return;

        const [feeApiRes, classRes, studentRes, paymentRes, feeStructureRes] = await Promise.allSettled([
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
        const paymentPayload = paymentRes.status === 'fulfilled' ? paymentRes.value.data : null;
        const feeStructureData =
          feeStructureRes.status === 'fulfilled'
            ? feeStructureRes.value.data?.feeStructure || feeStructureRes.value.data?.feeDetail || {}
            : {};
        const fallbackClassFeeData =
          classRes.status === 'fulfilled'
            ? classRes.value.data?.feeDetail || classRes.value.data?.feeStructure || {}
            : {};

        console.log('[ParentFees] Payment Payload:', paymentPayload);
        setClassFeeSource(Object.keys(feeStructureData || {}).length ? feeStructureData : fallbackClassFeeData || null);
        setPaymentDetails(paymentPayload || null);
        setFeeApiSummary(feeApiPayload || null);
      } catch (error) {
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

  // Fetch discounts from studentsNameAccountant API
  useEffect(() => {
    let active = true;

    const fetchStudentsNameAccountant = async () => {
      try {
        if (!studentData?.class_name || !studentData?.section || !studentData?.schoolCode) return;

        console.log('[ParentFees] Fetching discounts for:', {
          className: studentData.class_name,
          section: studentData.section,
          schoolCode: studentData.schoolCode,
        });

        const res = await axios.get(
          `https://cleezoclass.com:4000/api/studentsNameAccountant/${encodeURIComponent(studentData.class_name)}`,
          {
            params: {
              schoolCode: studentData.schoolCode,
              section: studentData.section,
            },
          }
        );

        if (!active) return;

        console.log('[ParentFees] Raw Discount Response:', res.data);

        if (res.data?.students) {
          const dynamicFeeBases = dynamicFeeTypes.map((type) => type.columnBase || '');
          const studentsWithDiscountsData = res.data.students.map((student: any) => {
            const feeDiscounts: Record<string, number> = {};
            dynamicFeeBases.forEach((base) => {
              const discountKey = `${base}_discount`;
              if (student[discountKey] !== undefined) {
                feeDiscounts[base] = toNumber(student[discountKey]);
              }
            });
            const studentDiscountData: StudentDiscountData = {
              id: String(student.id || ''),
              name: student.name,
              totalDiscount: toNumber(student.total_discount || 0),
              totalPaid: toNumber(student.total_paid || 0),
              totalDue: toNumber(student.total_due || 0),
              totalFee: toNumber(student.total_fee || 0),
              feeDiscounts,
            };
            console.log('[ParentFees] Processed Discounts for Student:', studentDiscountData);
            return studentDiscountData;
          });

          setStudentsWithDiscounts(studentsWithDiscountsData);
        }
      } catch (error) {
        if (active) {
          console.error('[ParentFees] Discount Fetch Error:', error);
          showError('Discount Load Error', 'Unable to load student discounts.');
        }
      }
    };

    fetchStudentsNameAccountant();
    return () => {
      active = false;
    };
  }, [studentData?.class_name, studentData?.section, studentData?.schoolCode, showError, dynamicFeeTypes]);

const currentStudentDiscountData = useMemo(() => {
  if (!studentsWithDiscounts?.length || !studentData) return null;

  const currentId = normalizeComparable(studentData.studentId || studentData.id);
  const currentNameCandidates = [
    studentData.name,
    paymentDetails?.payments?.studentName,
    studentData.username,
  ]
    .map(normalizeComparable)
    .filter(Boolean);

  return (
    studentsWithDiscounts.find((student) => currentId && normalizeComparable(student.id) === currentId) ||
    studentsWithDiscounts.find((student) => currentNameCandidates.includes(normalizeComparable(student.name))) ||
    null
  );
}, [paymentDetails?.payments?.studentName, studentData, studentsWithDiscounts]);

const feeRows: FeeRow[] = useMemo(() => {
  if (paymentDetails?.payments?.dynamicFeeBreakdown?.length && currentStudentDiscountData) {
    const feeBreakdown = paymentDetails.payments.dynamicFeeBreakdown;
    const studentsDiscountData = currentStudentDiscountData;

    // Log for debugging
    console.log('[DEBUG] FeeBreakdown Keys:', feeBreakdown.map(f => f.key));
    console.log('[DEBUG] FeeDiscounts:', studentsDiscountData.feeDiscounts);
    console.log('[DEBUG] Matched Student Discount Data:', studentsDiscountData);

    return feeBreakdown.map((fee: BackendFeeBreakdown) => {
      // Use ONLY the discount from feeDiscounts (ignore fee.discount from feeBreakdown)
      const discountKey = normalizeFeeKey(fee.key || fee.label || '');
      const discount =
        studentsDiscountData.feeDiscounts[fee.key] ??
        studentsDiscountData.feeDiscounts[discountKey] ??
        0;

      console.log(`[DEBUG] Fee Key: ${fee.key}, Discount Applied: ${discount}`);

      const grossTotal = toNumber(fee.total || 0);
      const paid = toNumber(fee.paid || 0);
      const discountedTotal = Math.max(grossTotal - discount, 0);
      const due = discountedTotal - paid;

      return {
        key: fee.key || fee.label || Math.random().toString(),
        label: fee.label || fee.key || 'Unknown Fee',
        amount: discountedTotal,
        paid,
        discount: discount, // Use ONLY feeDiscounts
        due: Math.max(due, 0),
        paymentDate: '-',
      };
    });
  }
  return [];
}, [paymentDetails, currentStudentDiscountData]);
console.log('[DEBUG] Dynamic Fee Types ColumnBase:', dynamicFeeTypes.map(t => t.columnBase));
console.log('[DEBUG] FeeDiscounts Keys:', Object.keys(currentStudentDiscountData?.feeDiscounts || {}));
console.log('[DEBUG] FeeBreakdown Keys:', paymentDetails?.payments?.dynamicFeeBreakdown.map(f => f.key));
console.log('[DEBUG] FeeDiscounts:', currentStudentDiscountData?.feeDiscounts);
console.log('[DEBUG] FeeBreakdown:', paymentDetails?.payments?.dynamicFeeBreakdown);
  // Recalculate summary values from feeRows
  const summaryTotalFee = useMemo(() => {
    const total = feeRows.reduce((sum, row) => sum + row.amount, 0);
    console.log('[ParentFees] Summary Total Fee:', total);
    return total;
  }, [feeRows]);

  const summaryPaid = useMemo(() => {
    const paid = feeRows.reduce((sum, row) => sum + row.paid, 0);
    console.log('[ParentFees] Summary Paid:', paid);
    return paid;
  }, [feeRows]);

const summaryDiscount = useMemo(() => {
  const discount = feeRows.reduce((sum, row) => sum + row.discount, 0);
  console.log('[DEBUG] Summary Discount:', discount);
  return discount;
}, [feeRows]);
const summaryDue = useMemo(() => {
  const due = feeRows.reduce((sum, row) => sum + row.due, 0);
  console.log('[DEBUG] Summary Due:', due);
  return due;
}, [feeRows]);

  const feeChartMax = Math.max(summaryTotalFee, summaryPaid + summaryDue, 1);

  // Student profile
  const studentProfile = useMemo(
    () => ({
      studentName: paymentDetails?.payments?.studentName || studentData?.name || '-',
      fatherName: studentData?.father_name || studentData?.fatherName || '-',
      mobile: studentData?.phone_no || studentData?.mobile || studentData?.phoneNumber || '-',
      admissionNo: studentData?.admission_no || studentData?.admissionNo || '-',
      gender: studentData?.gender || '-',
      email: studentData?.email || '-',
    }),
    [paymentDetails, studentData]
  );

  // Table columns
  const tableColumns = useMemo(() => [
    { key: 'label' as const, header: 'Fee Type', style: styles.tdFee, headerStyle: styles.thFee, numberOfLines: 2 },
    { key: 'discount' as const, header: 'Discount' },
    { key: 'amount' as const, header: 'Total' },
    { key: 'paid' as const, header: 'Paid' },
    { key: 'due' as const, header: 'Due' },
  ], []);

  // Table header
  const TableHeader = () => (
    <View style={styles.tableHeader}>
      {tableColumns.map((col) => (
        <Text key={String(col.key)} style={[styles.th, col.headerStyle]}>
          {col.header}
        </Text>
      ))}
    </View>
  );

  // Table row
  const TableRow = ({ row }: { row: FeeRow }) => (
    <View key={row.key} style={styles.tableRow}>
      {tableColumns.map((col) => {
        const value = row[col.key];
        const displayValue = typeof value === 'number' ? formatINR(value) : String(value || '-');
        return (
          <Text
            key={`${row.key}-${String(col.key)}`}
            style={[styles.td, col.style]}
            numberOfLines={col.numberOfLines}
          >
            {displayValue}
          </Text>
        );
      })}
    </View>
  );

  // Loading state
  if (loading || !studentData) {
    return (
      <View style={embedded ? styles.embeddedShell : styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Main content
  const content = (
    <View style={embedded ? styles.embeddedContent : styles.content}>
      <StatusBar barStyle="light-content" backgroundColor="#0D3F66" translucent={false} />

      <LinearGradient colors={['#0D3F66', '#BFD7FA', '#F6F8FC']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.feeGradientSection}>
        {!embedded && (
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.headerBrand}>
              <Image source={logoImage} style={styles.logo} />
            </View>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.title}>Fees</Text>
              <Text style={styles.subtitle}>Student Fee Details</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>
        )}

        <View style={styles.feeGraphSection}>
          <View style={styles.feeGraphTitleRow}>
            <Text style={styles.feeGraphTitle}>Fee Status</Text>
            <Text style={styles.feeGraphSubtitle}>Paid vs Remaining</Text>
          </View>

          <View style={styles.feeLegendRow}>
            <View style={styles.feeLegendItem}>
              <View style={[styles.feeLegendDot, { backgroundColor: '#2EE59D' }]} />
              <Text style={styles.feeLegendText}>Paid</Text>
            </View>
            <View style={styles.feeLegendItem}>
              <View style={[styles.feeLegendDot, { backgroundColor: '#F36B79' }]} />
              <Text style={styles.feeLegendText}>Remaining</Text>
            </View>
          </View>

          <View style={styles.feeChartCard}>
            <View style={styles.feeChartGrid}>
              {[
                { label: 'Paid', value: summaryPaid, color: '#2EE59D' },
                { label: 'Remaining', value: summaryDue, color: '#F36B79' },
              ].map((item) => {
                const heightPct = `${Math.max(6, (item.value / feeChartMax) * 100)}%`;
                return (
                  <View key={item.label} style={styles.feeChartItem}>
                    <Text style={styles.feeChartValue}>{formatINR(item.value)}</Text>
                    <View style={styles.feeChartBarTrack}>
                      <View style={[styles.feeChartBarFill, { height: heightPct, backgroundColor: item.color }]} />
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
                <View style={styles.row}>
                  <View style={styles.itemContainer}>
                    <Text style={styles.summaryGradientLabel}>Discount</Text>
                    <Text style={styles.summaryGradientValue} numberOfLines={1} adjustsFontSizeToFit>
                      {formatINR(summaryDiscount)}
                    </Text>
                  </View>
                  <View style={styles.itemContainer}>
                    <Text style={styles.summaryGradientLabel}>Total</Text>
                    <Text style={styles.summaryGradientValue} numberOfLines={1} adjustsFontSizeToFit>
                      {formatINR(summaryTotalFee)}
                    </Text>
                  </View>
                </View>
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
                <View style={styles.row}>
                  <View style={styles.itemContainer}>
                    <Text style={styles.summaryGradientLabel}>Due</Text>
                    <Text style={styles.summaryGradientValue} numberOfLines={1} adjustsFontSizeToFit>
                      {formatINR(summaryDue)}
                    </Text>
                  </View>
                  <View style={styles.itemContainer}>
                    <Text style={styles.summaryGradientLabel}>Paid</Text>
                    <Text style={styles.summaryGradientValue} numberOfLines={1} adjustsFontSizeToFit>
                      {formatINR(summaryPaid)}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tableCard}>
            <TableHeader />
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={styles.tableBody}>
              {feeRows.length ? feeRows.map((row) => <TableRow key={row.key} row={row} />) : (
                <Text style={styles.emptyText}>No data available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
      <ParentFooter />
    </View>
  );

  return embedded ? (
    <View style={styles.embeddedCard}>{content}</View>
  ) : (
    <SafeAreaView style={styles.safeArea}>{content}</SafeAreaView>
  );
};

// Styles (unchanged)
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
  feeGraphSection: { paddingTop: 4 },
  feeGraphTitleRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  feeGraphTitle: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#111' },
  feeGraphSubtitle: { marginTop: 4, fontSize: 12, color: '#666', fontWeight: '600', textAlign: 'left' },
  feeLegendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  feeLegendItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  itemContainer: { flex: 1, alignItems: 'center' },
  feeLegendDot: { width: 10, height: 10, borderRadius: 999, marginRight: 6 },
  feeLegendText: { fontSize: 12, color: '#333', fontWeight: '700' },
  feeChartCard: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feeChartGrid: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', minHeight: 120 },
  feeChartBarTrack: {
    width: '32%',
    height: 100,
    backgroundColor: 'rgba(17,24,39,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  feeChartItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 8 },
  feeChartValue: { color: '#111', fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  feeChartBarFill: { width: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, minHeight: 10 },
  feeChartLabel: { color: '#333', fontSize: 13, fontWeight: '700', marginTop: 8 },
  studentDataWrap: { paddingBottom: 8 },
  transactionWrap: { flex: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryGradientCard: {
    flex: 1,
    minHeight: 150,
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
  summaryGradientLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.86)', textAlign: 'right' },
  summaryGradientValue: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', textAlign: 'right' },
  tableCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E2E6',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f6f6f7', paddingVertical: 10, paddingHorizontal: 8 },
  th: { flex: 1, fontSize: 11, fontWeight: '800', color: '#111', textAlign: 'center' },
  thFee: { flex: 1.25, textAlign: 'left' },
  tableBody: { paddingBottom: 12 },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8EC',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
  },
  td: { flex: 1, fontSize: 11, color: '#222', textAlign: 'center' },
  tdFee: { flex: 1.25, textAlign: 'left', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: '#555' },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 6, padding: 14 },
});

export default ParentFees;
