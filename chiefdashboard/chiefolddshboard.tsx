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
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  ImageBackground,
  Animated,
  Modal,
  Alert,
  FlatList,
  TextInput,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Polyline, Line } from 'react-native-svg';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import ChiefHeader from './ChiefHeader';
import Footer from './ManagementFooter';
import FooterLogo from './Footerlogo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scaleFont = (size: number) => (SCREEN_WIDTH / 375) * size;
const FIXED_CARD_WIDTH = SCREEN_WIDTH * 0.92;

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
  const scrollRef = useRef<ScrollView>(null);
  const [scrollX, setScrollX] = useState(0);
  const [contentWidth, setContentWidth] = useState(1);
  const [layoutWidth, setLayoutWidth] = useState(SCREEN_WIDTH - 40);
  const ITEM_WIDTH = SCREEN_WIDTH * 0.85 + 10;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrollX(e.nativeEvent.contentOffset.x);

  const trackWidth = layoutWidth - 60;
  const thumbWidth =
    contentWidth > layoutWidth
      ? (layoutWidth / contentWidth) * trackWidth
      : trackWidth;
  const maxTranslate = trackWidth - thumbWidth;
  const translateX =
    contentWidth > layoutWidth
      ? (scrollX / (contentWidth - layoutWidth)) * maxTranslate
      : 0;

  const scrollBy = (direction: 'prev' | 'next') => {
    const currentIndex = Math.round(scrollX / ITEM_WIDTH);
    const nextIndex =
      direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    scrollRef.current?.scrollTo({ x: nextIndex * ITEM_WIDTH, animated: true });
  };

  return (
    <View style={styles.hContainer}>
      {title && <Text style={styles.hTitle}>{title}</Text>}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={w => setContentWidth(w)}
        onLayout={e => setLayoutWidth(e.nativeEvent.layout.width)}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        snapToAlignment="start"
        disableIntervalMomentum
      >
        <View style={styles.hRow}>{children}</View>
      </ScrollView>
      <View style={styles.scrollWrapper}>
        <TouchableOpacity onPress={() => scrollBy('prev')}>
          <Ionicons name="chevron-back" size={14} color="#000" />
        </TouchableOpacity>
        <View style={styles.scrollTrack}>
          <View
            style={[
              styles.scrollThumb,
              { width: thumbWidth, transform: [{ translateX }] },
            ]}
          />
        </View>
        <TouchableOpacity onPress={() => scrollBy('next')}>
          <Ionicons name="chevron-forward" size={14} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ------------------- Main Dashboard -------------------
const ChiefDashboard: React.FC<Props> = ({ route }) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { name } = route.params;
  const [showSummary, setShowSummary] = useState(false);
  const [summaryModalLoading, setSummaryModalLoading] = useState(false);
  const [branchSummaries, setBranchSummaries] = useState<BranchFeeSummary[]>(
    [],
  );

  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [chartData, setChartData] = useState<any[]>([]);
  const [finalPaid, setFinalPaid] = useState(0);
  const [finalUnpaid, setFinalUnpaid] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalDiscount: 0,
    totalPaid: 0,
    balance: 0,
  });
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

  const routineData = [
    {
      title: 'Academic \nStudents',
      image: require('./assets/StudentPerformance.png'),
      imageHeight: SCREEN_HEIGHT * 0.29,
      imageWidth: SCREEN_WIDTH * 0.65,
    },
    {
      title: 'Academic \nStaff',
      image: require('./assets/TeacherPerformance.png'),
      imageHeight: SCREEN_HEIGHT * 0.29,
      imageWidth: SCREEN_WIDTH * 0.65,
    },
    {
      title: 'Exam \nManagement',
      image: require('./assets/ExamManagement.png'),
      imageHeight: SCREEN_HEIGHT * 0.29,
      imageWidth: SCREEN_WIDTH * 0.65,
    },
    {
      title: 'Meetings',
      image: require('./assets/chat.png'),
      imageHeight: SCREEN_HEIGHT * 0.29,
      imageWidth: SCREEN_WIDTH * 0.65,
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

  useEffect(() => {
    const debugChiefProfileStorage = async () => {
      try {
        const [username, schoolCode, userDetailsRaw, photoUrl, photo] = await Promise.all([
          AsyncStorage.getItem('username'),
          AsyncStorage.getItem('schoolCode'),
          AsyncStorage.getItem('userDetails'),
          AsyncStorage.getItem('photoUrl'),
          AsyncStorage.getItem('photo'),
        ]);

        let userDetails: Record<string, any> = {};
        if (userDetailsRaw) {
          try {
            userDetails = JSON.parse(userDetailsRaw);
          } catch (error) {
            console.log('[chiefolddshboard] failed to parse userDetails', error);
          }
        }

        console.log('[chiefolddshboard] chief storage snapshot', {
          username: username || null,
          schoolCode: schoolCode || null,
          hasUserDetails: Boolean(userDetailsRaw),
          userDetailsKeys: Object.keys(userDetails || {}),
          storedPhotoUrl: photoUrl || null,
          storedPhoto: photo || null,
          userDetailsPhotoUrl: userDetails.photoUrl || null,
          userDetailsPhoto: userDetails.photo || null,
          userDetailsProfileImage: userDetails.profileImage || null,
          userDetailsAvatar: userDetails.avatar || null,
        });
      } catch (error) {
        console.log('[chiefolddshboard] chief storage snapshot failed', error);
      }
    };

    void debugChiefProfileStorage();
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

      const response = await axios.get(
        'https://cleezoclass.com:4000/api/fees-summary-ledgerData',
        { params: { schoolCode } },
      );

      if (response.data.success) {
        setSummary({
          totalAmount: Number(response.data.totalAmount) || 0,
          totalDiscount: Number(response.data.totalDiscount) || 0,
          totalPaid: Number(response.data.totalPaid) || 0,
          balance: Number(response.data.balance) || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  // ------------------- Fetch Fee Records -------------------
  const fetchFeeData = useCallback(async () => {
    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    try {
      setLoading(true);
      const schoolCode =
        (await AsyncStorage.getItem('schoolCode')) || 'CLEEZOCLASS';
      const url = `https://cleezoclass.com:4000/api/fee-records?type=AllFeesStatusReport&fromDate=${fromStr}&toDate=${toStr}&schoolCode=${schoolCode}`;
      const response = await axios.get(url);
      const fees = response.data || [];

      let paidTotal = 0;
      let unpaidTotal = 0;
      const grouped: Record<string, any> = {};

      fees.forEach((item: any) => {
        const paid = parseFloat(item.Total_Paid || 0);
        const expected = parseFloat(item.Total_Expected || 0);
        paidTotal += paid;
        const pending = Math.max(expected - paid, 0);
        unpaidTotal += pending;

        const dateValue =
          item.record_date && item.record_date !== 'NaN'
            ? item.record_date
            : null;
        if (!dateValue) return;

        const dateLabel = new Date(dateValue).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
        });
        if (!grouped[dateLabel])
          grouped[dateLabel] = { label: dateLabel, Paid: 0, Pending: 0 };
        grouped[dateLabel].Paid += paid;
        grouped[dateLabel].Pending += pending;
      });

      setChartData(Object.values(grouped));
      setFinalPaid(paidTotal);
      setFinalUnpaid(unpaidTotal);
    } catch (err) {
      console.error('Fee fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

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
      const schoolCode = await AsyncStorage.getItem('schoolCode');
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
    fetchTeacherLeaves();
  }, [currentDbName]);

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

  const navigateToPage = (title: string) => {
    if (title === 'Academic \nStudents')
      navigation.navigate('AcademicStudent' as any);
    else if (title === 'Academic \nStaff')
      navigation.navigate('AcademicTeacher' as any);
    else if (title === 'Exam \nManagement')
      navigation.navigate('ExamManagement' as any);
    else if (title === 'Meetings') navigation.navigate('Meetings' as any);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // ------------------- Chart Calculations -------------------
  const CHART_HEIGHT = 150;
  const CHART_WIDTH = SCREEN_WIDTH - 120;
  const maxVal =
    chartData.length > 0
      ? Math.max(...chartData.map(d => Math.max(d.Paid, d.Pending)), 1000)
      : 1000;
  const getY = (val: number) =>
    CHART_HEIGHT - 30 - (val / maxVal) * (CHART_HEIGHT - 40);
  const spacing =
    chartData.length > 1
      ? (CHART_WIDTH - 20) / (chartData.length - 1)
      : CHART_WIDTH / 2;

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f2' }}>
      <ScrollView contentContainerStyle={{ padding: 15 }}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Welcome, {name}</Text>

          <ChiefHeader />
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

        {/* Date Pickers */}
        <View style={styles.dateSideColumn}>
          <TouchableOpacity
            onPress={() => setShowFromPicker(true)}
            style={styles.miniDateBtn}
          >
            <Text style={styles.miniValue}>
              {fromDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowToPicker(true)}
            style={styles.miniDateBtn}
          >
            <Text style={styles.miniValue}>{toDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>
        {showFromPicker && (
          <DateTimePicker
            value={fromDate}
            mode="date"
            onChange={(e, d) => {
              setShowFromPicker(false);
              if (d) setFromDate(d);
            }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={toDate}
            mode="date"
            onChange={(e, d) => {
              setShowToPicker(false);
              if (d) setToDate(d);
            }}
          />
        )}

        {/* Fees Chart Section */}
        <HorizontalScrollWithScrollbar1 title="Commerce">
          <View style={[styles.sectionCard, { width: FIXED_CARD_WIDTH }]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={async () => {
                setShowSummary(true);
                await fetchAllBranchSummaries();
              }}
              style={styles.chartContainer}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.brandBlue} />
              ) : (
                <View style={{ flexDirection: 'row' }}>
                  <View style={styles.yAxis}>
                    {[1, 0.75, 0.5, 0.25, 0].map((p, i) => (
                      <Text key={i} style={styles.axisText}>
                        ₹{Math.round(maxVal * p)}
                      </Text>
                    ))}
                  </View>
                  <View>
                    <Svg height={CHART_HEIGHT} width={CHART_WIDTH}>
                      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                        <Line
                          key={i}
                          x1="0"
                          y1={getY(maxVal * p)}
                          x2={CHART_WIDTH}
                          y2={getY(maxVal * p)}
                          stroke={COLORS.gridLine}
                          strokeWidth="1"
                        />
                      ))}
                      <Polyline
                        points={chartData
                          .map((d, i) => `${i * spacing},${getY(d.Paid)}`)
                          .join(' ')}
                        fill="none"
                        stroke={COLORS.brandBlue}
                        strokeWidth="2.5"
                      />
                      <Polyline
                        points={chartData
                          .map((d, i) => `${i * spacing},${getY(d.Pending)}`)
                          .join(' ')}
                        fill="none"
                        stroke={COLORS.brandRed}
                        strokeWidth="2.5"
                      />
                    </Svg>
                    <View style={styles.xAxis}>
                      {chartData.map(
                        (d, i) =>
                          (i % Math.ceil(chartData.length / 4) === 0 ||
                            i === chartData.length - 1) && (
                            <Text
                              key={i}
                              style={[
                                styles.axisText,
                                {
                                  position: 'absolute',
                                  left: i * spacing - 10,
                                },
                              ]}
                            >
                              {d.label}
                            </Text>
                          ),
                      )}
                    </View>
                  </View>
                </View>
              )}
              <View style={styles.internalTotalRow}>
                <View style={styles.centerAlign}>
                  <Text style={styles.internalLabel}>Paid Amount</Text>
                  <Text
                    style={[styles.internalValue, { color: COLORS.brandBlue }]}
                  >
                    ₹{summary.totalPaid.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View
                  style={{
                    width: 1,
                    height: 20,
                    backgroundColor: 'rgba(0,0,0,0.1)',
                  }}
                />
                <View style={styles.centerAlign}>
                  <Text style={styles.internalLabel}>Unpaid Amount</Text>
                  <Text
                    style={[styles.internalValue, { color: COLORS.brandRed }]}
                  >
                    ₹{summary.balance.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

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
                            <View style={[styles.financeColumn,  { gap: 8 }]}>
                              <Text style={styles.subHeading}>INCOME</Text>
                              <MetricBadge label="Fees Paid Report" value={`₹${finalPaid.toLocaleString()}`} />
                              <MetricBadge label="Fees Unpaid Report" value={`₹${finalUnpaid.toLocaleString()}`} />
                              <MetricBadge label="Income Ledger" value={`₹${(finalPaid + finalUnpaid).toLocaleString()}`} />
                              <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Total Income</Text>
                                <Text style={[styles.totalValue, { color: COLORS.brandBlue }]}>₹{(finalPaid + finalUnpaid).toLocaleString()}</Text>
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
                                <Text style={[styles.totalValue, { color: COLORS.brandRed }]}>₹1,000</Text>
                              </View>
                            </View>
                          </View>
                        </View> */}
        </HorizontalScrollWithScrollbar1>

        <HorizontalScrollWithScrollbar1 title="Actions">
          <ImageBackground
            source={require('./assets/action.jpeg')}
            style={styles.actionCard}
            imageStyle={styles.actionImage}
          >
            <Text style={[styles.actionCardTitle, { color: '#fff' }]}>
              Leave Approval
            </Text>
            {leaves.length > 0 ? (
              <>
                <Text style={styles.actionText} numberOfLines={1}>
                  {leaves[0].teacher_name || 'Unknown'} |{' '}
                  {leaves[0].reason || 'No reason'}
                </Text>
                <View style={styles.compactRow}>
                  <Text style={styles.actionSubTextLight} numberOfLines={1}>
                    {formatDate(leaves[0].leave_start_date)}
                  </Text>
                  <View style={styles.compactBtnRow}>
                    <TouchableOpacity
                      style={[
                        styles.approveBtn,
                        { backgroundColor: '#4CAF50' },
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
                        { backgroundColor: '#F44336' },
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
            ) : (
              <Text style={styles.actionText} numberOfLines={1}>
                No pending leave approvals
              </Text>
            )}
          </ImageBackground>

          <ImageBackground
            source={require('./assets/action.jpeg')}
            style={styles.actionCard}
            imageStyle={styles.actionImage}
          >
            <Text style={[styles.actionCardTitle, { color: '#fff' }]}>
              Late Comers Info
            </Text>
            <Text style={styles.actionText} numberOfLines={1}>
              Month: {latecomers.length} | Top:{' '}
              {latecomers.length > 0
                ? latecomers[0]?.teacher_name || '-'
                : 'No latecomers found'}
            </Text>
          </ImageBackground>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={async () => {
              setShowDiscountModal(true);
              await fetchDiscountStudents();
            }}
          >
            <ImageBackground
              source={require('./assets/action.jpeg')}
              style={styles.actionCard}
              imageStyle={styles.actionImage}
            >
              <Text style={[styles.actionCardTitle, { color: '#fff' }]}>
                Discount Provided
              </Text>
              <Text style={styles.actionText} numberOfLines={1}>
                Total: ₹{discountTotalFromApi.toLocaleString('en-IN')} | Tap for
                list
              </Text>
            </ImageBackground>
          </TouchableOpacity>

          <ImageBackground
            source={require('./assets/action.jpeg')}
            style={styles.actionCard}
            imageStyle={styles.actionImage}
          >
            <Text style={[styles.actionCardTitle, { color: '#fff' }]}>
              Substitute Required
            </Text>
            <View style={styles.compactRow}>
              <Text style={styles.actionText} numberOfLines={1}>
                Absent: {absentTeachers.length}
              </Text>
              {absentTeachers.length > 0 && (
                <TouchableOpacity
                  style={[styles.approveBtn, { backgroundColor: '#404040' }]}
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
          </ImageBackground>
        </HorizontalScrollWithScrollbar1>

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
                <Text style={styles.discountModalTitle}>Assign Substitute</Text>
                <TouchableOpacity onPress={() => setShowSubstituteModal(false)}>
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

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
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

        {/* Routine Data Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10 }}
        >
          {routineData.map((item, index) => (
            <DashboardCard key={index} item={item} onPress={navigateToPage} />
          ))}
        </ScrollView>

        <View style={styles.footerWrapper}>
          <Footer />
        </View>
      </ScrollView>
      <View style={styles.footerWrapper1}>
        <FooterLogo />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#333' },
  subTitle: { fontSize: 14, color: '#666' },
  dateSideColumn: {
    flexDirection: 'row', // side by side
    justifyContent: 'flex-end', // 👈 push to right
    gap: 8,
    width: '100%',
    // important so it can move right
  },
  sectionHeader: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  miniDateBtn: {
    backgroundColor: '#404040',
    color: '#fff',
    padding: 6,
    borderRadius: 6,
    width: 110,
    elevation: 2,
  },
  miniLabel: { fontSize: 8, color: '#fff', fontWeight: 'bold' },
  miniValue: { fontSize: 11, color: '#fff', fontWeight: 'bold' },
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
  chartContainer: { height: 180, justifyContent: 'center' },
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
  actionText: { color: '#fff', fontSize: 10, fontWeight: '600', flex: 1 },
  actionSubText: {
    color: '#444',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  actionSubTextLight: { color: '#fff', fontSize: 9, marginTop: 1 },
  actionCard: {
    width: SCREEN_WIDTH * 0.88,
    height: 60,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
  },
  actionCardTitle: {
    color: '#222',
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 2,
  },
  compactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactBtnRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  approveBtn: {
    backgroundColor: '#404040',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  approveText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  scrollWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  scrollTrack: {
    flex: 1,
    height: 3,
    backgroundColor: '#ddd',
    borderRadius: 3,
    marginHorizontal: 10,
  },
  scrollThumb: { height: 3, backgroundColor: '#000', borderRadius: 3 },
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
  headerText: { fontSize: scaleFont(18), fontWeight: 'bold', color: '#000' },
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
  schoolName: { fontSize: 18, fontWeight: 'bold', marginRight: 10 },
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
  },

  branchTextActive: {
    color: '#000',
    fontWeight: '700',
  },
});

export default ChiefDashboard;
