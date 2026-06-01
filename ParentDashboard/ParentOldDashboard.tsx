import React, { useState, useRef, useEffect, useCallback , useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  ImageBackground,
  Modal,
  Pressable,
  Alert,
  BackHandler,Image,TextInput,Button
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TeacherHeader from './ParentHeader';
import Footer from './ParentFooter';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import FooterLogo from './Footerlogo';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { ErrorContext } from './ErrorContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import DocumentPicker from 'react-native-document-picker';
import sendIcon from './icons/application.png'
import { Picker } from '@react-native-picker/picker';
import { BarChart } from "react-native-chart-kit";
import { useRoute } from '@react-navigation/native';
import ticketIcon from './icons/application.png'

const screenWidth = Dimensions.get("window").width;

// Define navigation prop type
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scaleFont = (size: number) => (SCREEN_WIDTH / 375) * size;

type Props = NativeStackScreenProps<RootStackParamList, 'ParentDashboard'>;

type HorizontalProps = {
  title?: string;
  children: React.ReactNode;
};

interface SummaryBox {
  type: 'class' | 'topic' | 'action';
  heading: string;
  className?: string;   // for type 'class'
  time?: string;        // for type 'class'
  topic?: string;       // for type 'topic'
  exam?: string;        // for type 'topic'
  label?: string;       // for type 'action'
  buttonText?: string;  // for type 'action'
  routeName?: string;   // ✅ add this for navigation
}


const summaryBoxes: SummaryBox[] = [
  { type: 'class', heading: 'Report', className: 'Class 6B', time: '10:00 AM', routeName: 'Events' },
  { type: 'topic', heading: 'HW & Res', topic: 'Algebra', exam: 'FA2', routeName: 'ParentHomework' },
  { type: 'class', heading: 'Time Table', className: 'Class 7A', time: '11:30 AM', routeName: 'ParentHomework' },
  { type: 'topic', heading: 'Livechat', topic: 'Photosynthesis', exam: 'FA1', routeName: 'ParentLiveChatTicket' },
  { type: 'action', heading: 'Ticket', label: 'Science', buttonText: 'Start', routeName: 'ParentLiveChatTicket' },
  { type: 'class', heading: 'Calender', className: 'Class 8C', time: '09:15 AM', routeName: 'ParentCalender' },
  { type: 'topic', heading: 'Photo', topic: 'Geometry', exam: 'SA1', routeName: 'ParentCalender' },
];


/* ---------------- Horizontal Scroll Component ---------------- */
const HorizontalScrollWithScrollbar: React.FC<HorizontalProps> = ({ title, children }) => {
  const scrollRef = useRef<ScrollView>(null);
  const [scrollX, setScrollX] = useState(0);
  const [contentWidth, setContentWidth] = useState(1);
  const [layoutWidth, setLayoutWidth] = useState(SCREEN_WIDTH - 40);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollX(e.nativeEvent.contentOffset.x);
  };

  // Reset scroll when children change (i.e., when tab changes)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: 0, animated: false });
      setScrollX(0);
    }
  }, [children]); // dependency: children

  // Calculate thumb width
  const trackWidth = layoutWidth - 60; // Space for icons
  const thumbWidth = contentWidth > layoutWidth 
    ? (layoutWidth / contentWidth) * trackWidth 
    : trackWidth;

  const maxTranslate = trackWidth - thumbWidth;
  const translateX = contentWidth > layoutWidth
    ? (scrollX / (contentWidth - layoutWidth)) * maxTranslate
    : 0;

  const scrollBy = (direction: 'prev' | 'next') => {
    if (!scrollRef.current) return;
    const offset = direction === 'next' ? scrollX + 150 : scrollX - 150;
    scrollRef.current.scrollTo({ x: offset, animated: true });
  };

  return (
    <View style={styles.hContainer}>
      {title ? <Text style={styles.hTitle}>{title}</Text> : null}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={w => setContentWidth(w)}
        onLayout={e => setLayoutWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.hRow}>{children}</View>
      </ScrollView>
    </View>
  );
};

const HorizontalScrollWithScrollbar1: React.FC<HorizontalProps> = ({ title, children }) => {
  const scrollRef = useRef<ScrollView>(null);
  const [scrollX, setScrollX] = useState(0);
  const [contentWidth, setContentWidth] = useState(1);
  const [layoutWidth, setLayoutWidth] = useState(SCREEN_WIDTH - 40);

  // We define the width of one "step". 
  // For your actions, it's SCREEN_WIDTH * 0.85 + 10 (margin)
  const ITEM_WIDTH = SCREEN_WIDTH * 0.85 + 10; 

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollX(e.nativeEvent.contentOffset.x);
  };

  const trackWidth = layoutWidth - 60;
  const thumbWidth = contentWidth > layoutWidth 
    ? (layoutWidth / contentWidth) * trackWidth 
    : trackWidth;

  const maxTranslate = trackWidth - thumbWidth;
  const translateX = contentWidth > layoutWidth
    ? (scrollX / (contentWidth - layoutWidth)) * maxTranslate
    : 0;

  const scrollBy = (direction: 'prev' | 'next') => {
    if (!scrollRef.current) return;
    
    // Calculate current index and move exactly one full item
    const currentIndex = Math.round(scrollX / ITEM_WIDTH);
    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    scrollRef.current.scrollTo({ 
      x: nextIndex * ITEM_WIDTH, 
      animated: true 
    });
  };

  return (
    <View style={styles.hContainer}>
      {title ? <Text style={styles.hTitle}>{title}</Text> : null}
      
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={w => setContentWidth(w)}
        onLayout={e => setLayoutWidth(e.nativeEvent.layout.width)}
        
        // 🔹 SNAP LOGIC START 🔹
        snapToInterval={ITEM_WIDTH} // The distance between items
        decelerationRate="fast"      // Makes it snap quickly
        snapToAlignment="start"      // Aligns the card to the left
        disableIntervalMomentum={true} // Ensures it only scrolls one item at a time
        // 🔹 SNAP LOGIC END 🔹
      >
        <View style={styles.hRow}>{children}</View>
      </ScrollView>

      {/* Fixed Scrollbar Row */}
      <View style={styles.scrollWrapper}>
        <TouchableOpacity onPress={() => scrollBy('prev')}>
          <Ionicons name="chevron-back" size={18} color="#766872" />
        </TouchableOpacity>
        
        <View style={styles.scrollTrack}>
          <View 
            style={[
              styles.scrollThumb, 
              { 
                width: thumbWidth, 
                transform: [{ translateX }],
                backgroundColor: '#000' // Always black for active scrollbar
              }
            ]} 
          />
        </View>

        <TouchableOpacity onPress={() => scrollBy('next')}>
          <Ionicons name="chevron-forward" size={18} color="#766872" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
/* ---------------- Main Dashboard ---------------- */
// ---------- Fees Records ----------

interface FeesData {
  [key: string]: any;
}

const FeesScreen: React.FC = () => {
  const [studentData, setStudentData] = useState<Record<string, any> | null>(null);
  const [fees, setFees] = useState<Record<string, any> | null>(null);
  const { showError } = useContext(ErrorContext);
  const [selectedFeeType, setSelectedFeeType] = useState('Admission Fee');
  const [submittedAmount, setSubmittedAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any> | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Online' | 'Cash+Online'>('Cash');

  // Fetch student data from AsyncStorage
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const keys = [
          "studentId",
          "username",
          "name",
          "class_name",
          "section",
          "schoolCode",
        ];
        const stores = await AsyncStorage.multiGet(keys);
        const data: Record<string, any> = {};
        stores.forEach(([key, value]) => { if (value) data[key] = value; });
        setStudentData(data);
      }
  catch (error: unknown) {
  showError(
    'Data Error',
    'Failed to load student information. Please restart the app.'
  );
}

    };
    fetchStudentData();
  }, []);

  // Fetch fees data
  useEffect(() => {
    if (!studentData?.class_name || !studentData?.section || !studentData?.schoolCode) return;

    const fetchFees = async () => {
      try {
        const defaultFees = {
          CompleteFee: 0,
          Admission_paid: 0,
          Paid_Amount: 0,
          books_paid: 0,
          uniform_paid: 0,
          bus_paid: 0,
          exam_paid: 0,
          others_paid: 0,
          Discount: 0,
        };

        const [classRes, studentRes] = await Promise.allSettled([
          axios.get("https://cleezoclass.com:4000/api/feeDetailsByClassSection", {
            params: {
              className: studentData.class_name,
              section: studentData.section,
              schoolCode: studentData.schoolCode,
            },
          }),
          axios.post("https://cleezoclass.com:4000/api/studentFees", {
            studentId: studentData.studentId,
            schoolCode: studentData.schoolCode,
          }),
        ]);

        const classFeeData = classRes.status === "fulfilled" ? classRes.value.data?.feeDetail || {} : {};
        const studentFeeData = studentRes.status === "fulfilled" ? studentRes.value.data?.feeDetails || {} : {};

        console.log('[FeesScreen] classRes status:', classRes.status);
        console.log('[FeesScreen] studentRes status:', studentRes.status);
        console.log('[FeesScreen] classFeeData:', classFeeData);
        console.log('[FeesScreen] studentFeeData:', studentFeeData);

        setFees({
          ...defaultFees,
          ...classFeeData,
          ...studentFeeData,
          CompleteFee: Number(classFeeData.CompleteFee) || 0,
        });
      } catch {
  showError(
    'Fee Load Error',
    'Unable to load fee details. Please try again.'
  );
  setFees(null);
}

    };

    fetchFees();
  }, [studentData]);

  useEffect(() => {
    if (!studentData?.studentId || !studentData?.schoolCode) return;

    const fetchPaymentDetails = async () => {
      try {
        const res = await axios.get(
          `https://cleezoclass.com:4000/api/payment/${studentData.studentId}?schoolCode=${studentData.schoolCode}`
        );
        const payments = res?.data?.payments || {};
        setPaymentDetails(payments);
        console.log('[FeesScreen] /api/payment payments:', payments);
      } catch (err: any) {
        console.log('[FeesScreen] /api/payment fetch error:', err?.response?.data || err?.message || err);
        setPaymentDetails(null);
      }
    };

    fetchPaymentDetails();
  }, [studentData?.studentId, studentData?.schoolCode]);

  if (!fees) return <Text style={{ padding: 20 }}>Loading fees...</Text>;

  const finalAmount = Number(fees?.Final_Amount ?? fees?.CompleteFee ?? 0);
  const totalPaid =
    Number(fees?.Paid_Amount ?? 0) +
    Number(fees?.Admission_paid ?? 0) +
    Number(fees?.books_paid ?? 0) +
    Number(fees?.uniform_paid ?? 0) +
    Number(fees?.bus_paid ?? 0) +
    Number(fees?.exam_paid ?? 0) +
    Number(fees?.others_paid ?? 0);
  const totalDue = Math.max(finalAmount - totalPaid, 0);
  const selectedInstallmentAmount = Number(
    fees?.Installment1_Amount ||
    fees?.Installment2_Amount ||
    fees?.Installment3_Amount ||
    fees?.Installment4_Amount ||
    fees?.Installment5_Amount ||
    0
  );

  const installments = [1, 2, 3, 4, 5].map((i) => {
    const total = Number(fees[`Installment${i}_Amount`] || 0);
    const paid = Number(fees[`Installment${i}_Paid`] || 0);
    return {
      label: `I-${i}`,
      total,
      paid: Math.min(paid, total),
      due: Math.max(total - paid, 0),
      deadline: fees[`Installment${i}_Deadline_Date`] || '-',
    };
  }).filter(item => item.total > 0);

  const maxValue = Math.max(...installments.map(i => i.total), 1);
  const currentDueDate = installments.find(i => i.due > 0)?.deadline || '-';

  const getFeeNumber = (...keys: string[]) => {
    if (!fees) return 0;
    const entries = Object.entries(fees).map(([k, v]) => [k.toLowerCase(), v] as const);
    for (const rawKey of keys) {
      const key = rawKey.toLowerCase();
      const matched = entries.find(([k]) => k === key);
      if (matched) {
        const num = Number(matched[1]);
        console.log('[FeesScreen] getFeeNumber match:', { key: rawKey, matchedKey: matched[0], rawValue: matched[1], num });
        if (Number.isFinite(num)) return num;
      }
    }
    console.log('[FeesScreen] getFeeNumber no-match:', keys, 'availableKeys:', entries.map(([k]) => k));
    return 0;
  };

  const apiPayment = paymentDetails || {};

  const feeTypeRows = [
    {
      label: 'Admission Fee',
      total: Number(apiPayment.admissionFee ?? getFeeNumber('Admission_fees', 'AdmissionFee', 'admission_fees', 'admissionfee')),
      paid: Number(apiPayment.admissionPaid ?? getFeeNumber('Admission_paid', 'admission_paid')),
      dueDate: currentDueDate,
    },
    {
      label: 'Tuition Fee',
      total: Number(apiPayment.completeFee ?? getFeeNumber('UpdatedCompleteFee', 'CompleteFee', 'Final_Amount', 'updatedcompletefee', 'completefee', 'final_amount')),
      paid: Number(apiPayment.paidAmount ?? getFeeNumber('Paid_Amount', 'paid_amount')),
      dueDate: currentDueDate,
    },
    {
      label: 'Bus Fee',
      total: Number(apiPayment.busFee ?? getFeeNumber('Bus_fees', 'BusFee', 'bus_fees', 'busfee')),
      paid: Number(apiPayment.busPaid ?? getFeeNumber('bus_paid')),
      dueDate: currentDueDate,
    },
    {
      label: 'Exam Fee',
      total: Number(apiPayment.examFee ?? getFeeNumber('Exam_fees', 'ExamFee', 'exam_fees', 'examfee')),
      paid: Number(apiPayment.examPaid ?? getFeeNumber('exam_paid')),
      dueDate: currentDueDate,
    },
    {
      label: 'Books Fee',
      total: Number(apiPayment.bookFee ?? getFeeNumber('Book_Fees', 'Books_fees', 'BookFee', 'book_fees', 'books_fees', 'bookfee')),
      paid: Number(apiPayment.bookPaid ?? getFeeNumber('books_paid')),
      dueDate: currentDueDate,
    },
    {
      label: 'Uniform Fee',
      total: Number(apiPayment.uniformFee ?? getFeeNumber('Uniform_fees', 'UniformFee', 'uniform_fees', 'uniformfee')),
      paid: Number(apiPayment.uniformPaid ?? getFeeNumber('uniform_paid')),
      dueDate: currentDueDate,
    },
    {
      label: 'Other Fees',
      total: Number(apiPayment.othersFee ?? getFeeNumber('Others', 'OtherFee', 'others', 'otherfee')),
      paid: Number(apiPayment.othersPaid ?? getFeeNumber('others_paid')),
      dueDate: currentDueDate,
    },
  ];

  const selectedFee = feeTypeRows.find((f) => f.label === selectedFeeType) || feeTypeRows[0];
  const selectedFeeDue = Math.max((selectedFee?.total || 0) - (selectedFee?.paid || 0), 0);
  const paidUnpaidChartData = {
    labels: ['Paid', 'Unpaid'],
    datasets: [
      {
        data: [Math.max(totalPaid, 0), Math.max(totalDue, 0)],
        colors: [
          (opacity = 1) => `rgba(46, 160, 67, ${opacity})`,
          (opacity = 1) => `rgba(217, 72, 72, ${opacity})`,
        ],
      },
    ],
  };
  console.log('[FeesScreen] feeTypeRows:', feeTypeRows);
  console.log('[FeesScreen] selectedFeeType:', selectedFeeType, 'selectedFee:', selectedFee, 'feesKeys:', Object.keys(fees || {}), 'paymentKeys:', Object.keys(apiPayment || {}));

  const handleSubmitFee = async () => {
    const paidAmount = Number(submittedAmount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      Alert.alert('Validation', 'Enter a valid submitted amount.');
      return;
    }
    if (!studentData?.class_name || !studentData?.section || !studentData?.schoolCode) {
      Alert.alert('Error', 'Student fee details missing.');
      return;
    }

    try {
      setSubmittingPayment(true);
      const feeTypeKeyMap: Record<string, 'admission' | 'tuition' | 'bus' | 'exam' | 'books' | 'uniform' | 'other'> = {
        'Admission Fee': 'admission',
        'Tuition Fee': 'tuition',
        'Bus Fee': 'bus',
        'Exam Fee': 'exam',
        'Books Fee': 'books',
        'Uniform Fee': 'uniform',
        'Other Fees': 'other',
      };
      const feeKey = feeTypeKeyMap[selectedFeeType] || 'tuition';

      const feeTypesPaid = {
        tuition: 0,
        books: 0,
        bus: 0,
        uniform: 0,
        exam: 0,
        admission: 0,
        other: 0,
      };
      feeTypesPaid[feeKey] = paidAmount;

      const payload = {
        studentName: studentData.name,
        className: studentData.class_name,
        sectionName: studentData.section,
        schoolCode: studentData.schoolCode,
        Paid_Amount: feeTypesPaid.tuition,
        books_paid: feeTypesPaid.books,
        bus_paid: feeTypesPaid.bus,
        uniform_paid: feeTypesPaid.uniform,
        exam_paid: feeTypesPaid.exam,
        admission_paid: feeTypesPaid.admission,
        others_paid: feeTypesPaid.other,
        tuition_paid_this_transaction: feeTypesPaid.tuition,
        tuition_installment_id: null,
        Discount: 0,
        paymentDate,
        receiptNumber: null,
        paymentMode,
        transactionId: '',
        adjustedInstallments: [],
        feeDescriptions: [
          {
            type: feeKey === 'other' ? 'other' : feeKey,
            amount: paidAmount,
            description: null,
            installmentId: null,
          },
        ],
        allowDuplicate: true,
      };

      console.log('[FeesScreen] handlePaymentSubmit payload:', payload);
      const res = await axios.post('https://cleezoclass.com:4000/pay-fee-detailsincome', payload);
      if (res.data?.success) {
        Alert.alert('Success', 'Fee submitted successfully.');
        setSubmittedAmount('');
        if (studentData?.studentId && studentData?.schoolCode) {
          const refresh = await axios.get(
            `https://cleezoclass.com:4000/api/payment/${studentData.studentId}?schoolCode=${studentData.schoolCode}`
          );
          setPaymentDetails(refresh?.data?.payments || {});
        }
      } else {
        Alert.alert('Failed', res.data?.message || 'Unable to submit fee.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Fee submit failed.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '600' }}>{studentData?.name || '-'}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600' }}>
          {studentData?.class_name || '-'} {studentData?.section || ''}
        </Text>
      </View>

      <View style={styles.feeFormRow}>
        <View style={styles.feeFormLeft}>
          <View style={styles.feeCompactRow}>
            <View style={[styles.dropdownContainer, styles.feeCompactCellDark]}>
              <Picker
                selectedValue={selectedFeeType}
                onValueChange={(v) => setSelectedFeeType(v)}
                dropdownIconColor="#fff"
                style={styles.feePickerText}
              >
                {feeTypeRows.map((item) => (
                  <Picker.Item key={item.label} label={item.label} value={item.label} />
                ))}
              </Picker>
            </View>
            <View style={[styles.dropdownContainer, styles.feeCompactCellDark]}>
              <Text style={styles.feeFieldValueText}>
                ₹ {(selectedFee?.total || selectedInstallmentAmount).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          <View style={styles.feeCompactRow}>
            <View style={[styles.dropdownContainer, styles.feeCompactCellDark]}>
              <Text style={styles.feeFieldValueText}>{currentDueDate}</Text>
            </View>
            <View style={[styles.dropdownContainer, styles.feeCompactCellLight]}>
              <TextInput
                value={submittedAmount}
                onChangeText={(txt) => setSubmittedAmount(txt.replace(/[^\d.]/g, ''))}
                keyboardType="numeric"
                placeholder="Paid Amount"
                placeholderTextColor="#888"
                style={styles.feeInputText}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity style={[styles.messageBtnTall, styles.feeSendBtnRight]} onPress={handleSubmitFee} disabled={submittingPayment}>
          <Image source={ticketIcon} style={[styles.iconImage, { tintColor: '#0088cc' }]} />
        </TouchableOpacity>
      </View>

      <View style={styles.feeGraphCard}>
        <Text style={styles.feeGraphTitle}>Paid vs Unpaid</Text>
        <BarChart
          data={paidUnpaidChartData}
          width={Math.max(Dimensions.get('window').width - 96, 220)}
          height={150}
          yAxisLabel="₹"
          fromZero
          withInnerLines={false}
          withHorizontalLabels
          showValuesOnTopOfBars
          withCustomBarColorFromData
          flatColor
          chartConfig={{
            backgroundColor: '#f2f2f2',
            backgroundGradientFrom: '#f2f2f2',
            backgroundGradientTo: '#f2f2f2',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(20, 20, 20, ${opacity})`,
            labelColor: () => '#000',
            propsForBackgroundLines: { strokeWidth: 0 },
            barPercentage: 0.55,
          }}
          style={{ borderRadius: 10, marginTop: 4 }}
        />
        <View style={styles.feeLegendRow}>
          <View style={styles.feeLegendItem}>
            <View style={[styles.feeLegendDot, { backgroundColor: '#2ea043' }]} />
            <Text style={styles.feeLegendText}>Paid: ₹ {totalPaid.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.feeLegendItem}>
            <View style={[styles.feeLegendDot, { backgroundColor: '#d94848' }]} />
            <Text style={styles.feeLegendText}>Unpaid: ₹ {totalDue.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>


      <TouchableOpacity style={{ alignSelf: 'center', marginTop: 10 }}>
        <Text style={{ color: '#2f4f88', textDecorationLine: 'underline', fontSize: 13 }}>
          View Statement
        </Text>
      </TouchableOpacity>
      <Text style={{ marginTop: 8, fontSize: 10, color: '#444', textAlign: 'center' }}>
        Next Due Date: {currentDueDate}
      </Text>
    </ScrollView>
  );
};


// ---------- Academic ----------
interface AcademicProps {
  studentData: Record<string, any>;
}

const AcademicPerformance: React.FC<AcademicProps> = ({ studentData }) => {
  const [performance, setPerformance] = useState<any[]>([]);
  const [testTypes, setTestTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useContext(ErrorContext);

  useEffect(() => {
    let isMounted = true;

    const fetchPerformance = async () => {
      setLoading(true);
      try {
        if (!studentData?.name || !studentData?.class_name || !studentData?.section) {
          setPerformance([]);
          setTestTypes([]);
          return;
        }

        const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
        const schoolCode = studentData?.schoolCode || storedSchoolCode || '';

        if (!schoolCode) {
          setPerformance([]);
          setTestTypes([]);
          return;
        }

        const payload = {
          name: studentData.name,
          class_name: studentData.class_name,
          section: studentData.section,
          schoolCode,
        };

        const res = await axios.post(
          'https://cleezoclass.com:4000/api/overall/academic-performance',
          payload
        );

        if (!isMounted) return;

        if (Array.isArray(res.data)) {
          setPerformance(res.data || []);
          setTestTypes([]);
        } else {
          setPerformance(Array.isArray(res.data?.performance) ? res.data.performance : []);
          setTestTypes(Array.isArray(res.data?.testTypes) ? res.data.testTypes : []);
        }
      } catch (error: unknown) {
        if (!isMounted) return;

        if (axios.isAxiosError(error)) {
          if (error.response) {
            showError(
              'Academic Performance Error',
              error.response.data?.message || 'Failed to fetch academic performance'
            );
          } else {
            showError(
              'Network Error',
              'Unable to connect to server. Please check your internet.'
            );
          }
        } else {
          showError(
            'Academic Performance Error',
            'Unexpected error occurred'
          );
        }
        setPerformance([]);
        setTestTypes([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPerformance();
    return () => {
      isMounted = false;
    };
  }, [studentData?.name, studentData?.class_name, studentData?.section, studentData?.schoolCode, showError]);


  if (loading) return <Text style={{ fontSize: 12 }}>Loading...</Text>;
  if (!performance.length) return <Text style={{ fontSize: 12 }}>No academic data.</Text>;

  const fallbackTermRows = [
    { label: 'FA1', key: 'FA1' },
    { label: 'FA2', key: 'FA2' },
    { label: 'SA1', key: 'SA1' },
    { label: 'FA3', key: 'FA3' },
    { label: 'FA4', key: 'FA4' },
    { label: 'SA2', key: 'SA2' },
  ];

  const termRows = (testTypes || []).length
    ? testTypes
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

  const termPercentage = (row: any) => {
    let obtained = 0;
    let total = 0;

    performance.forEach((subj) => {
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

    return total > 0 ? ((obtained / total) * 100).toFixed(2) : '0.00';
  };

  const overallPercentage = () => {
    let obtained = 0;
    let total = 0;

    performance.forEach((subj) => {
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

    return total > 0 ? ((obtained / total) * 100).toFixed(2) : '0.00';
  };

  const overallGrade = () => {
    const perc = Number(overallPercentage());
    if (perc >= 90) return 'A+';
    if (perc >= 80) return 'A';
    if (perc >= 70) return 'B+';
    if (perc >= 60) return 'B';
    if (perc >= 50) return 'C';
    return 'D';
  };

  const formatMark = (value: any) => {
    if (value === "-" || value === undefined || value === null) return "-";
    const num = parseFloat(value);
    return Number.isNaN(num) ? value : num % 1 === 0 ? num.toFixed(0) : num.toString();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, {marginLeft:-30}]}>
        {/* Left column: Overall */}
        <View style={styles.overallColumn}>
          <Text style={styles.grade}>{overallGrade()}</Text>
          <Text style={styles.overallPercent}>{overallPercentage()}%</Text>
        </View>

        {/* Right column: Term-wise breakdown */}
        <ScrollView style={styles.termColumn}>
          {termRows.map((row, r) => (
            <View key={r} style={styles.termRow}>
              <Text style={styles.termLabel}>{row.label}</Text>
              <View style={styles.subjectRow}>
                <Text style={styles.termPercent}>{termPercentage(row)}%</Text>
                {performance.map((subj, i) => {
                  const initial = (subj?.subject || '?').charAt(0).toUpperCase();
                  const mark = getMarkForRow(subj, row);
                  return (
                    <View key={i} style={styles.subjectMark}>
                      <Text style={{ fontSize: 9 }}><Text style={{ fontWeight: 'bold' }}>{initial}</Text>: {formatMark(mark)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

// ---------- Attendance ----------
interface AttendanceProps {
  studentData: Record<string, any>;
}

const Attendance: React.FC<AttendanceProps> = ({ studentData }) => {
  const navigation = useNavigation();
  const route = useRoute();   // ✅ ADD THIS

  const [children, setChildren] = useState<Child[]>([]);

  const routeParams: any = route?.params || {};
  const routeUsername = routeParams?.username || '';
  const routeName = routeParams?.name || '';
  const [usernameState, setUsername] = useState(studentData?.username || routeUsername || '');

  const [studentName, setStudentName] = useState(studentData?.name || routeName || '');

  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [schoolCode, setSchoolCode] = useState('');

  const [leaveType, setLeaveType] = useState('');
  const [reason, setReason] = useState('');
  const [leaveStartDate, setLeaveStartDate] = useState(new Date());
  const [leaveEndDate, setLeaveEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
const [leaveData, setLeaveData] = useState<any[]>([]);
const [chartData, setChartData] = useState<any>(null);

const normalizeValue = (v: any) => String(v || '').trim().toLowerCase();

const filterLeaveDataForSelectedStudent = (data: any[]) => {
  const selectedUsername = normalizeValue(usernameState || studentData?.username);
  const selectedName = normalizeValue(studentName || studentData?.name);
  const selectedClass = normalizeValue(className || studentData?.class_name);
  const selectedSection = normalizeValue(section || studentData?.section);

  return (Array.isArray(data) ? data : []).filter((item: any) => {
    const itemUsername = normalizeValue(item?.username);
    const itemName = normalizeValue(item?.student_name);
    const itemClass = normalizeValue(item?.class_name);
    const itemSection = normalizeValue(item?.section);

    const classSectionMatch = selectedClass && selectedSection
      ? itemClass === selectedClass && itemSection === selectedSection
      : true;

    // Prefer student identity match (name + class + section),
    // fallback to username when needed.
    const identityMatch = selectedName ? itemName === selectedName : false;
    const usernameMatch = selectedUsername ? itemUsername === selectedUsername : false;

    return (identityMatch && classSectionMatch) || (usernameMatch && classSectionMatch);
  });
};

const fetchLeaves = async () => {
  try {
    const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
    console.log("🏫 SchoolCode:", storedSchoolCode);

    const url = `http://162.215.210.38:3010/api/api/leave/all?schoolCode=${storedSchoolCode}`;
    console.log("🌐 URL:", url);

    const response = await fetch(url);
    console.log("📡 Status:", response.status);

    const data = await response.json();
    console.log("📦 API Data:", data);

    setLeaveData(Array.isArray(data) ? data : []);

  } catch (error) {
    console.log("❌ Fetch Error:", error);
  }
};

useEffect(() => {
  fetchLeaves();
}, []);
const generateChartData = (data: any) => {

  if (!Array.isArray(data)) {
    console.log("❌ Data is not array:", data);
    return;
  }

  const leaveCount: any = {};

  data.forEach((item: any) => {
    if (leaveCount[item.leave_type]) {
      leaveCount[item.leave_type]++;
    } else {
      leaveCount[item.leave_type] = 1;
    }
  });

  setChartData({
    labels: Object.keys(leaveCount),
    datasets: [
      {
        data: Object.values(leaveCount),
      },
    ],
  });
};

useEffect(() => {
  const filtered = filterLeaveDataForSelectedStudent(leaveData);
  generateChartData(filtered);
}, [leaveData, usernameState, studentName, className, section, studentData]);


useEffect(() => {
  const syncStudentContext = async () => {
    const selectedStudent = await AsyncStorage.getItem('currentStudent');
    if (selectedStudent) {
      try {
        const parsed = JSON.parse(selectedStudent);
        if (parsed?.username) setUsername(parsed.username);
        if (parsed?.name) setStudentName(parsed.name);
        if (parsed?.class_name) setClassName(parsed.class_name);
        if (parsed?.section) setSection(parsed.section);
      } catch {}
    }
  };
  syncStudentContext();
}, [studentData]);

useEffect(() => {
  const fetchStudentDetails = async () => {
    try {
      console.log("🚀 Fetching student details for:", routeName);

      const storedUsername = await AsyncStorage.getItem('username');
      const storedSchoolCode = await AsyncStorage.getItem('schoolCode');

      if (!storedUsername || !storedSchoolCode) {
        Alert.alert("Missing login details");
        return;
      }

      setSchoolCode(storedSchoolCode);

      const url = `http://162.215.210.38:3010/api/student-details?username=${storedUsername}&schoolCode=${storedSchoolCode}`;
      console.log("🌐 URL:", url);

      const response = await fetch(url);
      console.log("📡 Status:", response.status);

      const data = await response.json();
      console.log("📦 API Data:", data);

      if (Array.isArray(data) && data.length > 0) {

        const matchedChild = data.find(
          (child: any) => child.student_name === routeName
        );

        if (matchedChild) {
          console.log("✅ Matched Child:", matchedChild);

          setStudentName(matchedChild.student_name);
          setClassName(matchedChild.class_name);
          setSection(matchedChild.section);

        } else {
          console.log("❌ No matching child found");
          Alert.alert("Student not found");
        }

      } else {
        console.log("❌ Empty response");
        Alert.alert("No student records found");
      }

    } catch (error) {
      console.error("🔥 Error:", error);
      Alert.alert("Error loading student details");
    }
  };

  fetchStudentDetails();
}, [routeName]); // ✅ add name as dependency



  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // ✅ Submit Leave Request
  const handleLeaveRequest = async () => {
    if (!leaveType) {
      Alert.alert('Please select leave type');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Please enter the reason');
      return;
    }

    const resolvedUsername =
      usernameState ||
      studentData?.username ||
      (await AsyncStorage.getItem('username')) ||
      '';

    if (!resolvedUsername || resolvedUsername === 'undefined') {
      Alert.alert('Missing username', 'Please reselect the student and try again.');
      return;
    }
    if (!className || !section || !schoolCode) {
      Alert.alert('Missing student details', 'Class/section/schoolCode is missing. Please reselect student.');
      return;
    }

    const formData = new FormData();
    formData.append('username', resolvedUsername);
    formData.append('student_name', studentName);
    formData.append('class_name', className);
    formData.append('section', section);
    formData.append('start_date', formatDate(leaveStartDate));
    formData.append('end_date', formatDate(leaveEndDate));
    formData.append('reason', reason);
    formData.append('leave_type', leaveType);
    formData.append('schoolCode', schoolCode);

    try {
      const response = await fetch(
        'http://162.215.210.38:3010/api/student-leave-request',
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();

      if (result.success) {
        Alert.alert('Leave Request Submitted');
        setReason('');
        setLeaveType('');
        setLeaveStartDate(new Date());
        setLeaveEndDate(new Date());
      } else {
        Alert.alert('Submission failed');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('An error occurred');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 0 }}>

      {/* Student Info */}
      <View style={styles.studentRow}>
        <Text style={styles.infoText}>Username: {usernameState || studentData?.username || '-'}</Text>
        <Text style={styles.infoText}>Name: {studentName}</Text>
        <Text style={styles.infoText}>
          Class: {className} - {section}
        </Text>
      </View>
    <View style={[styles.messageLayout,{marginTop:'1%'}]}>
              <View style={styles.leftColumn3}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.dropdownContainer}
          onPress={() => setShowStartPicker(true)}
        >
          <Text style={styles.dateText}>
            {leaveStartDate.toDateString()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dropdownContainer}
          onPress={() => setShowEndPicker(true)}
        >
          <Text style={styles.dateText}>
            {leaveEndDate.toDateString()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={leaveStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) setLeaveStartDate(selectedDate);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={leaveEndDate}
          minimumDate={leaveStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) setLeaveEndDate(selectedDate);
          }}
        />
      )}

      {/* Leave Type + Reason + Send */}
<View style={styles.topRow}>

  {/* Leave Type Picker */}
  <View style={[styles.dropdownContainer, { marginTop: 10, justifyContent: 'center' }]}>
    <Picker
      selectedValue={leaveType}
      onValueChange={(itemValue) => setLeaveType(itemValue)}
      dropdownIconColor="#fff"
      style={{ color: "#fff" }}
    >
      <Picker.Item label="Select Leave Type" value="" />
      <Picker.Item label="Sick Leave" value="Sick Leave" />
      <Picker.Item label="Casual Leave" value="Casual Leave" />
      <Picker.Item label="Half Day" value="Half Day" />
    </Picker>
  </View>

  {/* Reason */}
  <TextInput
    style={[
      styles.dropdownContainer,
      { color: "#fff", marginTop: 10 }
    ]}
    placeholder="Reason"
    placeholderTextColor="#fff"
    value={reason}
    onChangeText={setReason}
  />

</View>

</View>
        {/* Single Send Icon */}
        <TouchableOpacity
          style={styles.messageBtnTall}
          onPress={handleLeaveRequest}
        >
          <Image
            source={sendIcon}
style={[styles.iconImage,{ tintColor: '#0088cc' }]}          />
        </TouchableOpacity>
</View>
{chartData && (   
  <BarChart
    data={chartData}
    width={Dimensions.get("window").width - 20}
    height={100}
    yAxisLabel=""
    yAxisSuffix=""
    chartConfig={{
      backgroundColor: "#f5f5f5",
      backgroundGradientFrom: "#f5f5f5",
      backgroundGradientTo: "#f5f5f5",
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // 🔴 RED bars
      labelColor: () => "#000", // black labels for white background
      barPercentage: 0.6,
      propsForBackgroundLines: {
        stroke: "#e3e3e3",
      },
    }}
    style={{
      marginVertical: 20,
      borderRadius: 16,
      alignSelf: "center",
    }}
  />
)}



    </ScrollView>
  );
};


const ParentDashboard: React.FC<Props> = ({ route }) => {
    const navigation = useNavigation<NavigationProp>(); // ✅ get navigation

  const { username , name} = route.params;
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'Academic' | 'Attendance' | 'Fees'>('Academic');
  const [studentData, setStudentData] = useState<any>(null);
  const [feesData, setFeesData] = useState<any>({});
  const [parentActions, setParentActions] = useState<any[]>([]);
      const { showError } = useContext(ErrorContext);

// ✅ BACK NAVIGATION LOGIC
useFocusEffect(
  useCallback(() => {
    const onBackPress = () => {
      navigation.navigate('ParentDetails' as any);
      return true; // Keeps the app from closing
    };

    // 1. Create the subscription
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    // 2. Use .remove() on the subscription itself
    return () => subscription.remove(); 
  }, [navigation])
);
  const [loading, setLoading] = useState(true); // Add a loading state

  useEffect(() => {
    loadCurrentStudent();
  }, []);

  const loadCurrentStudent = async () => {
    try {
      const stored = await AsyncStorage.getItem('currentStudent');
      if (stored) {
        const student = JSON.parse(stored);
        setStudentData(student);
      }
    }catch (error: unknown) {
  if (error instanceof Error) {
    showError('Load Error', error.message);
  } else {
    showError('Load Error', 'Failed to load student data');
  }
}
finally {
      setLoading(false); // Data fetching attempt finished
    }
  };

  useEffect(() => {
    const fetchParentActions = async () => {
      if (!studentData) return;

      const schoolCode = String(studentData.schoolCode || '');
      const className = String(studentData.class_name || '');
      const section = String(studentData.section || '');
      const studentId = String(
        studentData.id ||
        studentData.studentId ||
        studentData.student_id ||
        studentData.login_id ||
        ''
      );

      if (!schoolCode || !className || !section) return;

      try {
        const [classFeeRes, feesRes, requestsRes, homeworkRes] = await Promise.allSettled([
          axios.get('https://cleezoclass.com:4000/api/feeDetailsByClassSection', {
            params: {
              className,
              section,
              schoolCode,
            },
          }),
          studentId
            ? axios.post('https://cleezoclass.com:4000/api/studentFees', {
                studentId,
                schoolCode,
              })
            : Promise.resolve({ data: { feeDetails: {} } }),
          axios.get('http://162.215.210.38:3010/api/admin/requests', {
            params: { schoolCode },
          }),
          axios.get('http://162.215.210.38:3010/api/homework-lists', {
            params: { class_name: className, section, schoolCode },
          }),
        ]);

        // 1) Due Amount of Fees
        const classFeeDetails = classFeeRes.status === 'fulfilled'
          ? classFeeRes.value.data?.feeDetail || {}
          : {};
        const feeDetails = feesRes.status === 'fulfilled' ? feesRes.value.data?.feeDetails || {} : {};
        const getNum = (obj: any, keys: string[]) => {
          for (const key of keys) {
            const value = obj?.[key];
            if (value !== undefined && value !== null && value !== '') {
              const num = Number(value);
              if (!Number.isNaN(num)) return num;
            }
          }
          return 0;
        };

        const totalAmount =
          getNum(feeDetails, ['Final_Amount', 'CompleteFee', 'UpdatedCompleteFee']) ||
          getNum(classFeeDetails, ['CompleteFee', 'Final_Amount', 'UpdatedCompleteFee']);

        const totalPaid =
          getNum(feeDetails, ['Paid_Amount', 'paid_amount']) +
          getNum(feeDetails, ['Admission_paid', 'admission_paid']) +
          getNum(feeDetails, ['books_paid', 'Books_paid']) +
          getNum(feeDetails, ['uniform_paid', 'Uniform_paid']) +
          getNum(feeDetails, ['bus_paid', 'Bus_paid']) +
          getNum(feeDetails, ['exam_paid', 'Exam_paid']) +
          getNum(feeDetails, ['others_paid', 'Others_paid']);

        const dueAmount = Math.max(totalAmount - totalPaid, 0);

        // 2) Upcoming extra classes (approved)
        const requests = requestsRes.status === 'fulfilled' && Array.isArray(requestsRes.value.data)
          ? requestsRes.value.data
          : [];
        const toDateKey = (value: any) => {
          if (!value) return '';
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            return value.slice(0, 10);
          }
          const d = new Date(value);
          if (isNaN(d.getTime())) return '';
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };
        const todayKey = toDateKey(new Date());
        const lcClass = className.toLowerCase().trim();
        const lcSection = section.toLowerCase().trim();
        const upcomingExtra = requests.filter((r: any) => {
          const status = String(r?.status || '').toLowerCase() === 'approved';
          const requestClass = String(r?.class || '').toLowerCase().trim();
          const requestDateKey = toDateKey(r?.request_date);
          const validDate = !!requestDateKey && requestDateKey >= todayKey;
          const classMatch =
            requestClass === lcClass ||
            requestClass === `${lcClass}-${lcSection}` ||
            requestClass === `${lcClass}/${lcSection}` ||
            requestClass === `${lcClass} ${lcSection}`;
          return status && classMatch && validDate;
        });
        const nextExtraDate = upcomingExtra.length > 0
          ? new Date(
              upcomingExtra.sort(
                (a: any, b: any) => toDateKey(a.request_date).localeCompare(toDateKey(b.request_date))
              )[0].request_date
            ).toLocaleDateString()
          : null;

        // 3) Homework list
        const homeworkList = homeworkRes.status === 'fulfilled' && Array.isArray(homeworkRes.value.data)
          ? homeworkRes.value.data
          : [];
        const latestHomework = homeworkList.length > 0 ? homeworkList[0] : null;

        setParentActions([
          {
            id: 'fees-due',
            title: `Fees Due: ₹${dueAmount.toLocaleString('en-IN')}`,
            subtitle: dueAmount > 0 ? 'Tap to view fees' : 'No pending due',
            cta: 'View',
            onPress: () => setActiveTab('Fees'),
          },
          {
            id: 'upcoming-extra',
            title: `Upcoming Extra Classes: ${upcomingExtra.length}`,
            subtitle: nextExtraDate ? `Next: ${nextExtraDate}` : 'No upcoming extra class',
            cta: 'Open',
            onPress: () => navigation.navigate('ParentCalender'),
          },
          {
            id: 'homework-list',
            title: `Homework List: ${homeworkList.length}`,
            subtitle: latestHomework?.subject
              ? `Latest: ${latestHomework.subject}`
              : 'No homework available',
            cta: 'Open',
            onPress: () => navigation.navigate('ParentHomework'),
          },
        ]);
      } catch (error) {
        console.error('❌ Parent actions fetch error:', error);
      }
    };

    fetchParentActions();
  }, [studentData, navigation]);

  const getActiveTabTitle = () => {
    if (activeTab === 'Academic') return 'Academic';
    if (activeTab === 'Attendance') return 'Attendance';
    return 'Fees';
  };

const renderCard = (item: any, idx: number) => (
  <TouchableOpacity
    key={idx}
    style={[styles.smallCard1, { width: SCREEN_WIDTH * 0.75 }]}
    onPress={() => Alert.alert(item.title)} // Card tap
  >
    <Text style={styles.cardTitle}>{item.title}</Text>

    <ImageBackground
      source={item.image}
      resizeMode="cover"
      style={[
        styles.cardImageBg,
        {
          width: item.imageWidth,
          height: item.imageHeight,
        },
      ]}
    />

    {/* Plus icon */}
    <TouchableOpacity
      style={styles.plusIconBadge}
    >
      <Text style={styles.plusText}>+</Text>
    </TouchableOpacity>
  </TouchableOpacity>
);




  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Welcome, {name}</Text>
          <TeacherHeader />
        </View>

        {/* ---------------- Tabs ---------------- */}




    

        {/* ---------------- Action Scroll ---------------- */}

        {/* ---------------- Tab Content ---------------- */}
    

        {/* ---------------- Info Boxes ---------------- */}
<HorizontalScrollWithScrollbar>
  {summaryBoxes.map((box, index) => (
    <TouchableOpacity
      key={index}
      style={styles.infoBox}
      onPress={() => {
        if (box.routeName) {
          navigation.navigate(box.routeName as never);
        }
      }}
    >
      <Text style={styles.boxHeading}>{box.heading}</Text>

      {box.type === 'class' && (
        <>
          <Text style={styles.boxLine}>{box.className}</Text>
          <Text style={styles.boxLine1}>{box.time}</Text>
        
        </>
      )}

      {box.type === 'topic' && (
        <>
          <Text style={styles.boxLine}>{box.exam}</Text>
          <Text style={styles.boxLine1}>{box.topic}</Text>
        </>
      )}

      {box.type === 'action' && (
        <>
          <Text style={styles.boxLine}>{box.label}</Text>
          <TouchableOpacity style={styles.selectBtn}>
            <Text style={styles.selectBtnText}>{box.buttonText}</Text>
          </TouchableOpacity>
        </>
      )}
    </TouchableOpacity>
  ))}
</HorizontalScrollWithScrollbar>

        <HorizontalScrollWithScrollbar1>
          {parentActions.map(action => (
            <TouchableOpacity
              key={action.id}
              onPress={() => { setSelectedAction(action); setModalVisible(true); }}
              style={{ width: SCREEN_WIDTH * 0.9, marginRight: 10 }}
            >
              <ImageBackground source={require('./assets/action.jpeg')} style={styles.actionBg} imageStyle={styles.actionImage}>
                <View style={styles.actionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionText} numberOfLines={1}>{action.title}</Text>
                    <Text style={[styles.actionText, { fontSize: 10, marginTop: 4 }]} numberOfLines={1}>
                      {action.subtitle}
                    </Text>
                  </View>
                  <View style={styles.approveBtn}><Text style={styles.approveText}>{action.cta || 'Open'}</Text></View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </HorizontalScrollWithScrollbar1>

   <View style={styles.syllabusContainer1}>
<View style={styles.syllabusContent}>
 <View style={styles.buttonRow1}>
  {['Academic', 'Attendance', 'Fees'].map(tab => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        key={tab}
        style={[
          styles.submitBtn1,
          {
            width: 90,
            backgroundColor: isActive ? '#404040' : 'transparent', // black if active
          }
        ]}
        onPress={() => setActiveTab(tab as any)}
      >
        <Text
          style={{
            color: isActive ? '#fff' : '#000',  // white if active, black if inactive
            fontSize: 14,
            fontWeight: isActive ? '700' : '400',
          }}
        >
          {tab}
        </Text>

        {/* Bottom indicator line */}
        <View
          style={{
            height: 2,
            width: '100%',
            marginTop: 4,
          }}
        />
      </TouchableOpacity>
    );
  })}
</View>
  <View style={{ height: '64%', marginTop: 10 }}>
          {activeTab === 'Academic' && <AcademicPerformance studentData={studentData} />}
          {activeTab === 'Attendance' && <Attendance studentData={studentData} />}
{activeTab === 'Fees' && <FeesScreen />}
        </View>

            {/* NOTCH */}
            <View style={styles.notchContainer3}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine} />
              <View style={styles.rightNotch} />
            </View>

            {/* GRID CONTAINER (EMPTY) */}
         

            {/* BOTTOM NOTCH */}
  <View style={[styles.notchContainer4,{marginTop:'15%'}]}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine} />
              <View style={styles.rightNotch} />
            </View>

            {/* FOOTER NOTES (EMPTY) */}
            <View style={styles.footerWrapper} >

            <Footer />
          </View>
          </View>
        
                           </View>
                             
      </ScrollView>

      {/* Modal remains the same */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Parent Action</Text>
            <Text style={styles.modalMessage}>{selectedAction?.title}</Text>
            {selectedAction?.subtitle ? (
              <Text style={styles.modalMessage}>{selectedAction.subtitle}</Text>
            ) : null}
            <View style={styles.modalButtonRow}>
              <Pressable style={[styles.modalBtn, styles.rejectBtn]} onPress={() => setModalVisible(false)}><Text style={styles.modalBtnText}>Close</Text></Pressable>
              <Pressable
                style={[styles.modalBtn, styles.approveBtnModal]}
                onPress={() => {
                  setModalVisible(false);
                  selectedAction?.onPress?.();
                }}
              >
                <Text style={styles.modalBtnText}>{selectedAction?.cta || 'Open'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
       <View style={styles.footerWrapper1}>
                           <FooterLogo /></View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flex: 1, padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerText: { fontSize: scaleFont(18), fontWeight: 'bold', color: '#000' },
  tabItem: { width: 140, marginRight: 10 },
  subHeading: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  activeLine: { marginTop: 4, height: 3, width: '100%', borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginVertical: 10 },
  fixedBoxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  smallCard: { backgroundColor: '#fff', borderRadius: 20, padding: 12, width: '48%', borderWidth: 2, borderColor: '#000', elevation: 4 },
  cardTitle: { fontSize: scaleFont(12), fontWeight: 'bold', color: '#000' },
  cardTitleBlack: { fontSize: scaleFont(11), fontWeight: 'bold' },
  bigGradeBlack: { fontSize: scaleFont(26), fontWeight: 'bold', textAlign: 'right' },
  percentTextBlack: { fontSize: scaleFont(11), textAlign: 'right' },
  viewLinkBlue: { fontSize: 11, color: '#0a3d62', fontWeight: '600' },
  viewLinkBlack: { fontSize: 12, color: '#000' },
  plusIconBadge: { position: 'absolute', bottom: 10, left: 10, paddingHorizontal: 20, backgroundColor: '#ff6b6b', borderRadius: 20, elevation: 5 },
  plusText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  hContainer: { marginBottom: 20 },
  hRow: { flexDirection: 'row' },
    header: { fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  content: { flexDirection: 'row', gap: 10, height: '100%' },
  scrollWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  scrollTrack: { flex: 1, height: 3, backgroundColor: '#ddd', borderRadius: 3, marginHorizontal: 10, overflow: 'hidden' },
  scrollThumb: { height: 3, backgroundColor: '#000', borderRadius: 3 },
  actionBg: { padding: 16, borderRadius: 12, overflow: 'hidden', width: '100%' },
  actionImage: { borderRadius: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  approveBtn: { backgroundColor: '#404040', paddingVertical: 4, paddingHorizontal: 12,marginRight:17, borderRadius: 20, borderWidth: 1, borderColor: '#FF6B6B' },
  approveText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  infoBox: { backgroundColor: '#fff', borderRadius: 20, padding: 10, width: SCREEN_WIDTH * 0.22,height: SCREEN_WIDTH * 0.22, marginRight: 10, borderWidth: 2, borderColor: '#000', alignItems: 'center', elevation:12 },
  boxHeading: { fontSize: 10, fontWeight: 'bold', color: '#555' },
  boxLine: { fontSize: 13, fontWeight: 'bold', color: '#000' },
  boxLine1: { fontSize: 10, color: '#666' },
  selectBtn: { backgroundColor: '#69aff0', paddingHorizontal: 10, borderRadius: 5, marginTop: 5 },
  selectBtnText: { color: '#fff', fontSize: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '85%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalMessage: { marginVertical: 15, color: '#666' },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtn: { width: '45%', padding: 12, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#e74c3c' },
  approveBtnModal: { backgroundColor: '#2ecc71' },
  modalBtnText: { color: '#fff', fontWeight: 'bold' },
    hTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 0},
  cardImageBg: { width: 280,  minHeight: SCREEN_HEIGHT * 0.29, position: 'absolute', right: -4, top: -25 },
  smallCard1: { backgroundColor: '#fff', borderRadius: 20, padding: 12, minHeight: SCREEN_HEIGHT * 0.25, borderWidth: 2, borderColor: '#000', marginRight: 15 },
  syllabusContainer1: { 
    backgroundColor: '#F2F2F2',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    marginHorizontal: 10,
    marginTop: 5,
    height: SCREEN_HEIGHT * 0.58,
  },
  syllabusContent: { flex: 1, padding: 15 },
  selectBtn1: {
  borderWidth: 2,
  borderColor: '#000',
  borderRadius: 15,
  paddingVertical: 6,
  paddingHorizontal: 30,
  width: '40%',
  alignItems: 'center',
  marginRight: 5,            // ⬅️ gap between buttons
},
submitBtn1: {
  alignItems: 'center',
  paddingVertical: 4,   // removed extra padding
  paddingHorizontal: 0, // removed extra padding
  marginLeft: 0,   
  
    borderRadius: 12,
    backgroundColor: '#404040',
    height: hp('4%'),
    width: wp('30%'), // Dynamic width
    justifyContent: 'center',     // removed margin
},
buttonRow1: {
  flexDirection: 'row',
  justifyContent: 'space-around', // evenly spaces buttons
  marginVertical: 10,
  gap:2
}

 ,
  averageColumn: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  avgNumber: { fontSize: 12, fontWeight: 'bold' },
  avgLabel: { fontSize: 10, fontWeight: '500', textAlign: 'center' },
  monthlyColumn: { flex: 1, marginRight:-25 , marginLeft:-20},
  monthCard: { marginBottom: 10, padding: 5, borderRadius: 4 },
  monthTitle: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayCount: { width: 40, fontSize: 10, fontWeight: '500' },
  circlesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  circle: { width: 6, height: 6, borderRadius: 3 },
  notchContainer4: { 
position: 'absolute',
  left: 0,
  right: 0,
  top: '62%',              // or bottom: 0 if you want at bottom
  transform: [{ translateY: -20 }],
  height: 40,
  zIndex: 10,
  flexDirection: 'row',
  justifyContent: 'space-between',
  pointerEvents: 'none',
    alignItems: 'center',    // 🔑 centers children vertically

}
,notchContainer3: {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '16%',              // or bottom: 0 if you want at bottom
  transform: [{ translateY: -20 }],
  height: 40,
  zIndex: 10,
  flexDirection: 'row',
  justifyContent: 'space-between',
  pointerEvents: 'none',
    alignItems: 'center',    // 🔑 centers children vertically

},
leftNotch: {
  width: 22,
  height: 40,
  backgroundColor: '#F2F2F2',

  borderTopRightRadius: 25,
  borderBottomRightRadius: 25,

  // ONLY curve outline
  borderTopWidth: 2,
  borderBottomWidth: 2,
  borderRightWidth: 2,
  borderColor: '#000',

  position: 'absolute',
  left: -3,
  zIndex: 3,
},
rightNotch: {
  width: 22,
  height: 40,
  backgroundColor: '#F2F2F2',

  borderTopLeftRadius: 25,
  borderBottomLeftRadius: 25,

  borderTopWidth: 2,
  borderBottomWidth: 2,
  borderLeftWidth: 2,
  borderColor: '#000',

  position: 'absolute',
  right: -3,
  zIndex: 3,
},
studentRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 15,
  paddingTop:30
},
infoText: {
  fontSize: 14,
  fontWeight: "600",
},

  dashedLine: { 
    flex: 1, 
    borderBottomWidth: 1.5, 
    borderColor: '#000', 
    borderStyle: 'dashed', 
  },  gridScrollContent: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  paddingHorizontal: 10,
}
  ,gridContainer: {
  height: 260,           // ✅ FIXED HEIGHT (adjust as needed)
  borderRadius: 12,
  backgroundColor: '#F2F2F2',
  paddingVertical: 10,
},
messageLayout: {
  flexDirection: 'row',
  alignItems: 'stretch',   // 👈 makes icon match height of left column
  marginTop: 10,
},
messageBtnTall: {
  width: 60,
  height: 70,          // taller look
  backgroundColor: '#F2F2F2',
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 10,
  elevation: 4,
  borderColor:'#F06292',
  borderWidth:2,
  marginTop:'4%'
},
leftColumn3: {
  flex: 1,
  justifyContent: 'flex-start',
},
uploadText: {
  color: '#fff',
  marginLeft: 8,
  fontSize: 12,
  fontWeight: '600',
},
 studentInfo: {
    marginBottom: 10,
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  classInfo: {
    fontSize: 12,
    color: '#666',
  },
  feesTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feeGraphCard: {
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
  },
  feeGraphTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  feeLegendRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  feeLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feeLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  feeLegendText: {
    fontSize: 10,
    color: '#222',
    fontWeight: '600',
    textAlign: 'center',
  },
  feeFormRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 6,
    marginBottom: 8,
  },
  feeFormLeft: {
    flex: 1,
    marginRight: 10,
  },
  feeCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeCompactCellDark: {
    width: '48.5%',
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  feeCompactCellLight: {
    width: '48.5%',
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#fff',
  },
  feeFieldValueText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    width: '100%',
  },
  feePickerText: {
    color: '#fff',
    fontSize: 12,
    width: '100%',
  },
  feeInputText: {
    color: '#000',
    width: '100%',
    textAlign: 'center',
    fontSize: 12,
  },
  feeSendBtnRight: {
    marginLeft: 0,
    marginTop: 0,
    alignSelf: 'center',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
    width: '60%',
  },
  dropdownText: {
    fontSize: 12,
  },
  amountBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
    width: '35%',
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 12,
  },
  dueDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  dueDateLabel: {
    fontSize: 12,
  },
  dueDateBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
    width: '35%',
    alignItems: 'flex-end',
  },
  dueDateText: {
    fontSize: 12,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
  },
  totalDueCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  totalDueLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  totalDueAmount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'red',
    marginTop: 4,
  },
  viewStatementButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  viewStatementText: {
    fontSize: 12,
  },
messageBtn: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: '#0088CC', // Telegram blue
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 4,
},

messageIcon: {
  color: '#F2F2F2',
  fontSize: 20,
},
  iconImage: { width: 40, height: 40, resizeMode: 'contain' },

gridContainer1: {
  height: 160,           // ✅ FIXED HEIGHT (adjust as needed)
  borderRadius: 12,
  backgroundColor: '#F2F2F2',
  paddingVertical: 10,
},
  footerWrapper: {
    position: 'absolute',
    bottom: 5,   // ✅ 30px from bottom
    left: 0,
    right: 0,
  },
   footerWrapper1: {
   position: 'absolute',
    bottom: hp('-1%'), // 1% from the very bottom of the screen
    left: 0,
    right: 0,
    alignItems: 'center', // Centers children horizontally
    justifyContent: 'center',
    zIndex: 99, // Ensures it stays above all other content
  },
  overallColumn: { width: 70, justifyContent: 'center', alignItems: 'flex-start' },
  grade: { fontSize: 28, fontWeight: 'bold' },
  overallPercent: { fontSize: 20 },
  termColumn: { flex: 1, marginRight:-40 },
  termRow: { marginBottom: 5 },
    dropdownContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    backgroundColor: '#404040',
    height: hp('4%'),
    width: wp('30%'), // Dynamic width
    justifyContent: 'center',
  },topRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 10,
},
dateText: {
  color: '#fff',
  marginLeft: 6,
  fontSize: 12,
},
  termLabel: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginBottom: 2 },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  termPercent: { fontSize: 9, fontWeight: 'bold', marginRight: 4 },
  subjectMark: { borderWidth: 1, borderColor: '#ccc', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 4, minWidth: 35, alignItems: 'center' },
});

export default ParentDashboard;
