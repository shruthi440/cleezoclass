import React, { useContext , useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  StatusBar,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeContext } from '../ThemeContext';
import { globalStyles as styles } from '../inner';
import { createAppStyles } from '../App.styles';
;
import axios from 'axios';
import { StackedBarChart } from "react-native-chart-kit";
import { ErrorContext } from '../ErrorContext';
import ParentFooter from './ParentFooter';

/* ---------------- TYPES ---------------- */


const FeesScreen: React.FC = () => {
  const [studentData, setStudentData] = useState<Record<string, any> | null>(null);
  const [fees, setFees] = useState<Record<string, any> | null>(null);

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
      } catch (err) {
        console.error(err);
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

        setFees({
          ...defaultFees,
          ...studentFeeData,
          CompleteFee: Number(classFeeData.CompleteFee) || 0,
        });
      } catch (err) {
        console.error(err);
        setFees(null);
      }
    };

    fetchFees();
  }, [studentData]);

  if (!fees) {
    return <Text style={{ padding: 20 }}>Loading fees...</Text>;
  }

  // Fee calculations
  const finalAmount = Number(fees?.Final_Amount ?? fees?.CompleteFee ?? 0);
  const totalPaid =
    Number(fees?.Paid_Amount ?? 0) +
    Number(fees?.Admission_paid ?? 0) +
    Number(fees?.books_paid ?? 0) +
    Number(fees?.uniform_paid ?? 0) +
    Number(fees?.bus_paid ?? 0) +
    Number(fees?.exam_paid ?? 0) +
    Number(fees?.others_paid ?? 0);
  const totalDue = finalAmount - totalPaid;

  // Prepare installment data
  const installments = [1, 2, 3, 4, 5].map((i) => {
    const total = Number(fees[`Installment${i}_Amount`] || 0);
    const paid = Number(fees[`Installment${i}_Paid`] || 0);
    const deadline = fees[`Installment${i}_Deadline_Date`];
    const paidDate = fees[`Installment${i}_PaidDate`];

    let onTime = paid, late = 0;
    if (paidDate && deadline && new Date(paidDate) > new Date(deadline)) {
      late = paid;
      onTime = 0;
    }

    return { onTime, late };
  }).reverse();

const chartData = {
  labels: ["I-5","I-4","I-3","I-2","I-1"],
  legend: ["OnTime","Late"],
  data: installments.map(inst => [
    Number(inst.onTime) || 0,
    Number(inst.late) || 0,
  ]),
  barColors: ["#92ded0","#92aaff"],
};


  return (
    <ScrollView style={{ flex: 1, padding: 12 }}>
<View style={{ marginBottom: 16 }}>
  {/* Row 1 */}
  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
    <Text style={{ fontSize: 10 }}>Admission Fee: ₹ {fees.Admission_paid}</Text>
    <Text style={{ fontSize: 10 }}>Tuition Fee: ₹ {fees.Paid_Amount}</Text>
    <Text style={{ fontSize: 10 }}>Bus Fee: ₹ {fees.bus_paid}</Text>
  </View>

  {/* Row 2 */}
  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
    <Text style={{ fontSize: 10 }}>
      Uniform + Books: ₹ {Number(fees.uniform_paid) + Number(fees.books_paid)}
    </Text>
    <Text style={{ fontSize: 10 }}>Discount: ₹ {fees.Discount}</Text>
    <Text style={{ fontSize: 10 }}>Other Fee: ₹ {fees.others_paid}</Text>
  </View>
</View>



 
      {/* Installments Chart */}
<View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: -20 }}>
  {/* Installments Chart */}
  <View style={{ flex: 2 }}>
    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
      <StackedBarChart
    data={chartData}
    width={chartData.labels.length * 60} // width per bar
    height={160}
    chartConfig={{
      backgroundGradientFrom: "#f0f0f0",
      backgroundGradientTo: "#f0f0f0",
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
      barPercentage: 0.4, // ✅ less than 1 adds space between bars
    }}
    style={{ marginVertical: 8, }}
    hideLegend={false}
  />
    </ScrollView>
  </View>

  {/* Circular Total Due */}
  <View style={{
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  }}>
    <View style={{
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 6,
      marginLeft:10,
      borderColor: "#ccc",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <Text style={{ fontSize: 12, fontWeight: "bold", textAlign: "center" }}>Total Due</Text>
      <Text style={{ fontSize: 16, fontWeight: "bold", color: "red", marginTop: 4, textAlign: "center" }}>
        ₹ {totalDue.toFixed(2)}
      </Text>
    </View>
  </View>
</View>

    </ScrollView>
  );
};

/* ---------------- COMPONENT ---------------- */
interface AcademicProps {
  studentData: Record<string, any>;
}

const AcademicPerformance: React.FC<AcademicProps> = ({ studentData }) => {
  const [performance, setPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        if (!studentData?.name || !studentData?.class_name || !studentData?.section) {
          console.warn("Missing studentData fields");
          setLoading(false);
          return;
        }

        const res = await axios.post(
          "https://cleezoclass.com:4000/api/overall/academic-performance",
          {
            name: studentData.name, // must match DB
            class_name: studentData.class_name,
            section: studentData.section,
            schoolCode: studentData.schoolCode,
          }
        );

        const normalizedPerformance = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
        setPerformance(normalizedPerformance);
      } catch (err) {
        console.error("Error fetching academic performance:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [studentData]);

  if (loading) return <Text style={{ fontSize: 12 }}>Loading...</Text>;
  if (!performance.length) return <Text style={{ fontSize: 12 }}>No academic data.</Text>;

  // Term percentage calculation
  const termPercentage = (termIndex: number, isSA = false) => {
    let obtained = 0;
    let total = 0;

    performance.forEach((subj) => {
      const mark = isSA ? subj.SA?.[termIndex] : subj.FA?.[termIndex];
      if (mark !== null && mark !== undefined) {
        obtained += Number(mark);
        total += isSA ? 80 : 20;
      }
    });

    return total > 0 ? ((obtained / total) * 100).toFixed(2) : "0.00";
  };

const overallPercentage = () => {
  let obtained = 0;
  let total = 0;

  performance.forEach((subj: any) => {
    subj.FA?.forEach((mark: number | null) => {
      if (mark != null) {
        obtained += Number(mark);
        total += 20;
      }
    });

    subj.SA?.forEach((mark: number | null) => {
      if (mark != null) {
        obtained += Number(mark);
        total += 80;
      }
    });
  });

  return total > 0 ? ((obtained / total) * 100).toFixed(2) : "0.00";
};

  const overallGrade = () => {
    const perc = Number(overallPercentage());
    if (perc >= 90) return "A+";
    if (perc >= 80) return "A";
    if (perc >= 70) return "B+";
    if (perc >= 60) return "B";
    if (perc >= 50) return "C";
    return "D";
  };

  const termRows = [
    { label: "FA1", index: 0, type: "FA" },
    { label: "FA2", index: 1, type: "FA" },
    { label: "SA1", index: 0, type: "SA" },
    { label: "FA3", index: 2, type: "FA" },
    { label: "FA4", index: 3, type: "FA" },
    { label: "SA2", index: 1, type: "SA" },
  ];

  const formatMark = (value: any) => {
    if (value === "-" || value === undefined || value === null) return "-";
    const num = parseFloat(value);
    return Number.isNaN(num) ? value : num % 1 === 0 ? num.toFixed(0) : num.toString();
  };

  return (
    <View style={styles.container}>
    
    </View>
  );
};

const ParentLiveChatTicket: React.FC<
  NativeStackScreenProps<RootStackParamList, 'ParentLiveChatTicket'>
  & { embedded?: boolean }
> = ({ route, navigation, embedded = false }) => {
  const { themeStyles } = useContext(ThemeContext);
const [studentData, setStudentData] = useState<any>(null);
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const appStyles = createAppStyles({ phoneWidth, phoneHeight });

useEffect(() => {
  const loadStudent = async () => {
    const keys = [
      'studentId',
      'name',
      'class_name',
      'section',
      'schoolCode',
    ];

    const stores = await AsyncStorage.multiGet(keys);
    const data: any = {};
    stores.forEach(([k, v]) => v && (data[k] = v));

    setStudentData(data);
  };

  loadStudent();
}, []);

  const embeddedHeight = Math.max(phoneHeight * 0.78, 620);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView style={styles.scrollView} nestedScrollEnabled>
        <View style={embedded ? [styles.container, { padding: 0 }] : styles.container}>
          
        
          <View style={[styles.syllabusContainertwo, embedded && { height: embeddedHeight }]}>
       
            <View
              style={[
                styles.gridContainer,
                embedded
                  ? { height: '100%', overflow: 'hidden', paddingBottom: 0 }
                  : undefined,
              ]}
            >
              <View style={{ padding: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>Live Chat</Text>
                <Text style={{ marginTop: 8, fontSize: 14, color: '#444', lineHeight: 20 }}>
                  Start a conversation with the school from this dedicated page.
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 16,
                    borderRadius: 14,
                    backgroundColor: '#6D2DE1',
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                  onPress={() => navigation.navigate('ParentMessage', route.params)}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Open Messages</Text>
                </TouchableOpacity>
              </View>
            </View>
       
          </View>
        </View>
      </ScrollView>
      <ParentFooter embedded={embedded} />

    </SafeAreaView>
  );
};

export default ParentLiveChatTicket;
