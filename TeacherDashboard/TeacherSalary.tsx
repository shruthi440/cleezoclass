import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { globalStyles as styles, attendanceStyles as ui } from '../teacherStyles';
import TeacherFooter from './TeacherFooter';
import TeacherSummaryCard from './TeacherSummaryCard';
import { heightPercentageToDP as hp } from 'react-native-responsive-screen';
import LinearGradient from 'react-native-linear-gradient';
/* ---------------- TYPES ---------------- */
type RootStackParamList = {
  TeacherSalary: {
    username?: string;
    className?: string;
    section?: string;
    name?: string;
  };
};

interface Teacher {
  id: number;
  name: string;
  class?: string;
}

interface Attendance {
  id: number;
  username: string;
  date: string;
  status: string;
  entry_time?: string;
  exit_time?: string;
}

interface MonthlySalaryData {
  base_salary: number;
  deductions: number;
  bonuses: number;
  final_salary: number;
  status: string;
  payment_date?: string;
  salary_month?: string;
  hra: number;
  pf: number;
  professional_tax: number;
  mediclaim: number;
  salary_type: string;
}

const TeacherSalary: React.FC<
  NativeStackScreenProps<RootStackParamList, 'TeacherSalary'>
> = ({ route }) => {
  const { name: routeName, username } = route.params || {};
  const RNHTMLtoPDF = require('react-native-html-to-pdf').default;

  // State for teacher name
  const [name, setName] = useState(routeName || '');

  const MONTHS = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
  ];

  const currentMonthIndex = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[currentMonthIndex]);
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [monthlySalaryData, setMonthlySalaryData] = useState<MonthlySalaryData | null>(null);
  const [presentDays, setPresentDays] = useState(0);
  const [lateHours, setLateHours] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'deductions' | 'takehome' | 'attendance' | 'overtime' | null>(null);

  const summaryCards = useMemo(
    () => [
      {
        title: 'Deductions',
        subtitle: monthlySalaryData ? `₹${monthlySalaryData.deductions}` : 'No data',
        footer: monthlySalaryData
          ? `PF ₹${monthlySalaryData.pf} • Tax ₹${monthlySalaryData.professional_tax} • Mediclaim ₹${monthlySalaryData.mediclaim}`
          : 'Select a month to load deductions',
        icon: 'remove-circle-outline',
        background: '#D7E8C9',
      },
      {
        title: 'Take Home',
        subtitle: monthlySalaryData ? `₹${monthlySalaryData.final_salary}` : 'No data',
        footer: monthlySalaryData
          ? `${monthlySalaryData.salary_month || 'Current month'} • ${monthlySalaryData.status || 'Pending'}`
          : 'Select a month to load take-home',
        icon: 'cash-outline',
        background: '#F2EE9E',
      },
    ],
    [monthlySalaryData]
  );

  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Fetch teacher name if not provided
  useEffect(() => {
    if (!routeName && isMounted) {
      const fetchTeacherName = async () => {
        try {
          // Try to fetch from AsyncStorage
          const teacherName = await AsyncStorage.getItem('teacherName');
          if (teacherName && isMounted) {
            setName(teacherName);
          } else {
            // If not in AsyncStorage, try to fetch from API
            const schoolCode = await AsyncStorage.getItem('schoolCode');
            if (schoolCode && isMounted) {
              const res = await axios.get('https://cleezoclass.com:4000/teachers', { params: { schoolCode } });
              if (Array.isArray(res.data) && res.data.length > 0 && isMounted) {
                // Assuming the first teacher is the logged-in teacher
                // You may need to adjust this logic based on your app
                setName(res.data[0].name);
              } else if (isMounted) {
                console.error('No teachers found in API response.');
                Alert.alert('Error', 'No teachers found.');
              }
            } else if (isMounted) {
              console.error('School code not found in AsyncStorage.');
              Alert.alert('Error', 'School code not found.');
            }
          }
        } catch (err) {
          console.error('Failed to fetch teacher name:', err);
          if (isMounted) Alert.alert('Error', 'Failed to fetch teacher name.');
        }
      };
      fetchTeacherName();
    }
  }, [routeName]);

  useEffect(() => {
    const loadSchoolCode = async () => {
      try {
        const storedCode = await AsyncStorage.getItem('schoolCode');
        if (isMounted) setSchoolCode(storedCode);
      } catch (err) {
        console.error('Failed to load school code:', err);
      }
    };
    loadSchoolCode();
  }, []);

  useEffect(() => {
    if (!schoolCode || !isMounted || !name) return;
    const fetchTeachers = async () => {
      try {
        console.log("Fetching teachers list...");
        const res = await axios.get('https://cleezoclass.com:4000/teachers', { params: { schoolCode } });
        console.log("Teachers API response:", res.data);
        if (Array.isArray(res.data) && isMounted) {
          const loggedInTeacher = res.data.find(t => t.name === name);
          if (loggedInTeacher && isMounted) {
            setSelectedTeacherId(loggedInTeacher.id);
            fetchSalaryAndAttendance(loggedInTeacher.id, MONTHS[currentMonthIndex]);
          } else if (isMounted) {
            console.error("Logged-in teacher not found in the list.");
            Alert.alert("Info", "Your teacher profile was not found.");
          }
        }
      } catch (err) {
        console.error('Error fetching teachers:', err);
      }
    };
    fetchTeachers();
  }, [schoolCode, name]);

  const fetchSalaryAndAttendance = async (teacherId: number, month: string) => {
    if (!isMounted) return;
    try {
      console.log(`Fetching salary and attendance for teacher ${teacherId}, month ${month}`);
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      if (!schoolCode) {
        console.error("School code not found in AsyncStorage");
        return;
      }

      setLoading(true);
      const year = new Date().getFullYear();
      const apiMonth = MONTHS.indexOf(month) + 1;

      // Fetch calculated salary
      console.log("Fetching calculated salary...");
      const calcSalaryRes = await fetch(`https://cleezoclass.com:4000/calculated-salary/${teacherId}?schoolCode=${schoolCode}&month=${month}`);
      const calcSalaryData = await calcSalaryRes.json();
      console.log("Calculated Salary Data:", calcSalaryData);

      // Fetch salary details
      console.log("Fetching salary details...");
      const salaryApiRes = await fetch(`https://cleezoclass.com:4000/api/salary/${teacherId}?schoolCode=${schoolCode}&month=${apiMonth}&year=${year}`);
      const salaryApiData = await salaryApiRes.json();
      console.log("Salary API Data:", salaryApiData);

      const deductions = Number(salaryApiData.pf || 0) + Number(salaryApiData.professional_tax || 0) + Number(salaryApiData.mediclaim || 0);

      if (isMounted) {
        setMonthlySalaryData({
          base_salary: Number(salaryApiData.salary_amount || 0),
          pf: Number(salaryApiData.pf || 0),
          professional_tax: Number(salaryApiData.professional_tax || 0),
          mediclaim: Number(salaryApiData.mediclaim || 0),
          hra: Number(salaryApiData.hra || 0),
          bonuses: Number(salaryApiData.bonuses || 0),
          deductions,
          final_salary: Number(calcSalaryData.final_salary),
          status: calcSalaryData.status,
          salary_type: salaryApiData.salary_type || "monthly",
          salary_month: month,
          payment_date: calcSalaryData.payment_date,
        });
      }

      // Fetch attendance
      console.log("Fetching attendance...");
      const attendanceRes = await fetch(`https://cleezoclass.com:4000/api/payroll/${teacherId}?schoolCode=${schoolCode}`);
      const attendanceRaw: any = await attendanceRes.json();
      console.log("Attendance Raw Response:", attendanceRaw);

      if (!Array.isArray(attendanceRaw)) {
        console.error("Attendance API did not return an array:", attendanceRaw);
        if (isMounted) {
          Alert.alert("Info", "Attendance data is not available or invalid.");
          setAttendanceData([]);
          setPresentDays(0);
          setLateHours(0);
        }
        return;
      }

      const monthIndex = MONTHS.indexOf(month);
      const filteredAttendance = attendanceRaw.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === monthIndex && d.getFullYear() === year;
      });
      console.log("Filtered Attendance:", filteredAttendance);

      let present = 0, lateMinutes = 0;
      const officeTime = new Date("1970-01-01T09:00:00");

      filteredAttendance.forEach(a => {
        if (a.status?.toLowerCase() === "present") {
          present++;
          if (a.entry_time) {
            const inTime = new Date(`1970-01-01T${a.entry_time}`);
            if (inTime > officeTime) lateMinutes += (inTime.getTime() - officeTime.getTime()) / 60000;
          }
        }
      });

      if (isMounted) {
        setAttendanceData(filteredAttendance);
        setPresentDays(present);
        setLateHours(lateMinutes / 60);
      }
      console.log("Present Days:", present, "Late Hours:", lateMinutes / 60);

    } catch (err) {
      console.error("Payroll fetch failed:", err);
      if (isMounted) Alert.alert("Info", "Salary data not available for this selection.");
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  const handleMonthChange = (month: string) => {
    if (isMounted) {
      setSelectedMonth(month);
      if (selectedTeacherId) fetchSalaryAndAttendance(selectedTeacherId, month);
    }
  };

  const generatePDF = async () => {
    if (!monthlySalaryData || !isMounted) {
      Alert.alert('Error', 'No salary data available to generate PDF.');
      return;
    }
    const htmlContent = `
      <h2>Salary Receipt - ${monthlySalaryData.salary_month}</h2>
      <p>Base Salary: ₹${monthlySalaryData.base_salary}</p>
      <p>HRA: ₹${monthlySalaryData.hra}</p>
      <p>PF: ₹${monthlySalaryData.pf}</p>
      <p>Deductions: ₹${monthlySalaryData.deductions}</p>
      <h3>Take Home: ₹${monthlySalaryData.final_salary}</h3>
    `;
    try {
      const file = await RNHTMLtoPDF.convert({
        html: htmlContent,
        fileName: `Salary_Receipt_${monthlySalaryData.salary_month}`,
        directory: 'Documents',
      });
      Alert.alert('Success', `PDF saved to: ${file.filePath}`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  const toggleModal = (type: 'deductions' | 'takehome' | 'attendance' | 'overtime') => {
    if (isMounted) {
      setModalType(type);
      setIsModalVisible(true);
    }
  };

  const renderModalContent = () => {
    if (!monthlySalaryData && modalType !== 'attendance' && modalType !== 'overtime') return (
      <View>
        <Text style={styles.receiptTitle}>No Data Available</Text>
        <Text>Salary data is not available for this selection.</Text>
      </View>
    );

    switch (modalType) {
      case 'deductions':
        return (
          <View>
            <Text style={styles.receiptTitle}>Deduction Breakdown</Text>
            <View style={styles.receiptRowContainer}><Text>PF</Text><Text>₹{monthlySalaryData?.pf || 'N/A'}</Text></View>
            <View style={styles.receiptRowContainer}><Text>Prof. Tax</Text><Text>₹{monthlySalaryData?.professional_tax || 'N/A'}</Text></View>
            <View style={styles.receiptRowContainer}><Text>Mediclaim</Text><Text>₹{monthlySalaryData?.mediclaim || 'N/A'}</Text></View>
          </View>
        );
      case 'takehome':
        return (
          <View>
            <Text style={styles.receiptTitle}>Take Home Calculation</Text>
            <View style={styles.receiptRowContainer}><Text>Base Salary</Text><Text>₹{monthlySalaryData?.base_salary || 'N/A'}</Text></View>
            <View style={styles.receiptRowContainer}><Text>HRA (+)</Text><Text>₹{monthlySalaryData?.hra || 'N/A'}</Text></View>
            <View style={styles.receiptRowContainer}><Text>Bonuses (+)</Text><Text>₹{monthlySalaryData?.bonuses || 'N/A'}</Text></View>
            <View style={styles.receiptRowContainer}><Text>Deductions (-)</Text><Text>₹{monthlySalaryData?.deductions || 'N/A'}</Text></View>
            <View style={[styles.receiptRowContainer, { borderTopWidth: 1, marginTop: 10 }]}>
              <Text style={{ fontWeight: 'bold' }}>Total</Text>
              <Text style={{ fontWeight: 'bold' }}>₹{monthlySalaryData?.final_salary || 'N/A'}</Text>
            </View>
          </View>
        );
      case 'attendance':
        return (
          <View>
            <Text style={styles.receiptTitle}>Attendance Logs</Text>
            {attendanceData.length > 0 ? (
              attendanceData.map((item, index) => {
                const formattedDate = new Date(item.date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                const statusText = item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase() : 'N/A';
                const statusColor = statusText.toLowerCase() === 'present' ? 'green' : 'red';
                return (
                  <View key={index} style={styles.receiptRowContainer}>
                    <Text>{formattedDate}</Text>
                    <Text style={{ color: statusColor }}>{statusText}</Text>
                  </View>
                );
              })
            ) : (
              <Text>No attendance data available.</Text>
            )}
          </View>
        );
      case 'overtime':
        return (
          <View>
            <Text style={styles.receiptTitle}>Late Entry Logs</Text>
            {attendanceData.filter(a => a.entry_time && new Date(`1970-01-01T${a.entry_time}`) > new Date("1970-01-01T09:00:00")).length > 0 ? (
              attendanceData
                .filter(a => a.entry_time && new Date(`1970-01-01T${a.entry_time}`) > new Date("1970-01-01T09:00:00"))
                .map((item, index) => {
                  const formattedDate = new Date(item.date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const entryTime = new Date(`1970-01-01T${item.entry_time}`).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });
                  return (
                    <View key={index} style={styles.receiptRowContainer}>
                      <Text>{formattedDate}</Text>
                      <Text style={{ color: 'orange' }}>In: {entryTime}</Text>
                    </View>
                  );
                })
            ) : (
              <Text>No late entries found.</Text>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[ui.page, { paddingBottom: hp('18%') }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={local.container}>
            <LinearGradient
                                            pointerEvents="none"
                                            colors={['#d2c2eeff', '#d2c2eeff', '#d2c2eeff']}
                                            start={{ x: 0.05, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.dashboardTopGradient}
                                          >
          <View style={local.summaryRow}>
            {summaryCards.map((card, index) => (
              <TeacherSummaryCard
                key={`${card.title}-${index}`}
                style={[
                  local.summaryCard,
                  index === 0 ? local.summaryCardLeft : local.summaryCardRight,
                ]}
              >
                <View style={local.summaryCardText}>
                  <View style={local.summaryCardTitleRow}>
                    <Text style={local.summaryCardNumber} numberOfLines={1} ellipsizeMode="tail">
                      {card.title}
                    </Text>
                    <Text style={local.summaryCardSubtitle} numberOfLines={1} ellipsizeMode="tail">
                      {card.subtitle}
                    </Text>
                  </View>
                  <Text style={local.summaryCardFooter} numberOfLines={2} ellipsizeMode="tail">
                    {card.footer}
                  </Text>
                </View>
                <View style={local.summaryCardIconWrap}>
                  <Ionicons name={card.icon as any} size={28} color="#4C4C4C" />
                </View>
              </TeacherSummaryCard>
            ))}
          </View>
</LinearGradient>
          <View style={ui.card}>
            <Text style={ui.cardLabel}>Salary Month</Text>
            <View style={ui.dropdownShell}>
              <View style={styles.dropdownContainer}>
                <Picker
                  selectedValue={selectedMonth}
                  onValueChange={(value) => handleMonthChange(value)}
                  style={{ color: '#111827' }}
                  dropdownIconColor="#111827"
                >
                  {MONTHS.map(month => <Picker.Item key={month} label={month} value={month} />)}
                </Picker>
              </View>
            </View>
          </View>

          <View style={ui.card}>
            <Text style={ui.cardLabel}>Salary Overview</Text>
            <View style={ui.actionsRow}>
              <View style={ui.secondaryButton}>
                <Text style={ui.secondaryButtonText}>Deductions: ₹{monthlySalaryData ? monthlySalaryData.deductions : 'N/A'}</Text>
              </View>
              <View style={ui.primaryButton}>
                <Text style={ui.primaryButtonText}>Take Home: ₹{monthlySalaryData ? monthlySalaryData.final_salary : 'N/A'}</Text>
              </View>
            </View>
            <View style={ui.actionsRow}>
              <TouchableOpacity style={ui.secondaryButton} onPress={() => toggleModal('deductions')}>
                <Text style={ui.secondaryButtonText}>View Deduction Report</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ui.primaryButton} onPress={() => toggleModal('takehome')}>
                <Text style={ui.primaryButtonText}>View Take Home</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={ui.card}>
            <Text style={ui.cardLabel}>Salary Report</Text>
            <ScrollView
              style={local.innerScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={local.innerScrollContent}
            >
              <View style={local.receiptBlock}>
                <Text style={styles.receiptTitle}>Salary Receipt - {monthlySalaryData ? monthlySalaryData.salary_month : 'No Data'}</Text>
                {monthlySalaryData ? (
                  <>
                    <View style={styles.receiptRowContainer}>
                      <Text style={styles.receiptLabel}>Base Salary:</Text>
                      <Text style={styles.receiptValue}>₹{monthlySalaryData.base_salary}</Text>
                    </View>
                    <View style={styles.receiptRowContainer}>
                      <Text style={styles.receiptLabel}>HRA:</Text>
                      <Text style={styles.receiptValue}>₹{monthlySalaryData.hra}</Text>
                    </View>
                    <View style={styles.receiptRowContainer}>
                      <Text style={styles.receiptLabel}>PF:</Text>
                      <Text style={styles.receiptValue}>₹{monthlySalaryData.pf}</Text>
                    </View>
                    <View style={styles.receiptRowContainer}>
                      <Text style={styles.receiptLabel}>Professional Tax:</Text>
                      <Text style={styles.receiptValue}>₹{monthlySalaryData.professional_tax}</Text>
                    </View>
                    <View style={styles.receiptRowContainer}>
                      <Text style={styles.receiptLabel}>Mediclaim:</Text>
                      <Text style={styles.receiptValue}>₹{monthlySalaryData.mediclaim}</Text>
                    </View>
                    <View style={styles.receiptRowContainer}>
                      <Text style={styles.receiptLabel}>Bonuses:</Text>
                      <Text style={styles.receiptValue}>₹{monthlySalaryData.bonuses}</Text>
                    </View>
                    <View style={styles.receiptRowContainer}>
                      <Text style={styles.receiptLabel}>Deductions:</Text>
                      <Text style={styles.receiptValue}>₹{monthlySalaryData.deductions}</Text>
                    </View>
                    <View style={styles.receiptRowContainer}>
                      <Text style={[styles.receiptLabel, { fontWeight: 'bold' }]}>Take Home:</Text>
                      <Text style={[styles.receiptValue, { fontWeight: 'bold' }]}>₹{monthlySalaryData.final_salary}</Text>
                    </View>
                    {monthlySalaryData.payment_date && (
                      <View style={styles.receiptRowContainer}>
                        <Text style={styles.receiptLabel}>Payment Date:</Text>
                        <Text style={styles.receiptValue}>
                          {new Date(monthlySalaryData.payment_date).toLocaleDateString('en-GB')}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.receiptLabel}>No salary data available for this selection.</Text>
                )}
              </View>
            </ScrollView>
          </View>

          <View style={ui.card}>
            <Text style={ui.cardLabel}>Attendance Summary</Text>
            <View style={ui.gridCard}>
              <ScrollView
                style={ui.gridScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                <View style={local.summaryStack}>
                  <Text style={local.summaryText}>{presentDays} Present Days</Text>
                  <Text style={local.summaryTextSecondary}>Total {attendanceData.length} Days</Text>
                  <TouchableOpacity onPress={() => toggleModal('attendance')}>
                    <Text style={local.summaryLink}>View Attendance Report</Text>
                  </TouchableOpacity>
                </View>

                <View style={local.summaryStack}>
                  <Text style={local.summaryText}>Over Time</Text>
                  <Text style={local.summaryTextSecondary}>{lateHours.toFixed(2)} hrs late</Text>
                  <TouchableOpacity onPress={() => toggleModal('overtime')}>
                    <Text style={local.summaryLink}>View Late Logs</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* POPULATED MODAL */}
      <Modal
        transparent
        visible={isModalVisible}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', width: '90%', maxHeight: '70%', borderRadius: 15, padding: 20 }}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {renderModalContent()}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setIsModalVisible(false)}
              style={{ marginTop: 20, backgroundColor: '#000', padding: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <TeacherFooter />
    </SafeAreaView>
  );
};

const local = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
    marginBottom: 12,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  summaryCardLeft: {
    marginRight: 4,
  },
  summaryCardRight: {
    marginLeft: 4,
  },
  summaryCardText: {
    flex: 1,
    paddingRight: 8,
  },
  summaryCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  summaryCardNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginRight: 4,
  },
  summaryCardSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#252525',
    lineHeight: 18,
  },
  summaryCardFooter: {
    marginTop: 20,
    fontSize: 12.5,
    fontWeight: '500',
    color: '#2B2B2B',
  },
  summaryCardIconWrap: {
    width: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 2,
  },
  summaryStack: {
    paddingVertical: 10,
  },
  summaryText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#171717',
    textAlign: 'center',
  },
  summaryTextSecondary: {
    fontSize: 12,
    color: '#5E5E62',
    textAlign: 'center',
    marginTop: 4,
  },
  summaryLink: {
    textAlign: 'center',
    marginTop: 6,
    color: '#0A3D62',
    fontWeight: '700',
  },
  receiptBlock: {
    paddingBottom: 8,
  },
  innerScroll: {
    maxHeight: 360,
  },
  innerScrollContent: {
    paddingBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: '90%',
    maxHeight: '70%',
    borderRadius: 15,
    padding: 20,
  },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default TeacherSalary;
