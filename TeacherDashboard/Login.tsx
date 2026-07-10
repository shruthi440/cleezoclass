import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import messaging from '@react-native-firebase/messaging';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

import { UserContext } from '../UserContext';
import { ThemeContext } from '../ThemeContext';
import {
  requestLocationPermission,
  startPersistentAttendanceTracking,
} from './AttendanceService';
import { ErrorContext } from './ErrorContext';

type RootStackParamList = {
  TeacherAdmissionDashboard: { username: string; name: string };
  ChiefDashboard: { username: string; name: string };
  AdminDashboard: undefined;
  AccountantDashboard: { username: string; name: string };
  ParentDashboard: { username: string; name: string };
  ParentDetails: { username: string; name: string };
  TeacherDashboard: { username: string; name: string };
  BusManagerDashboard: undefined;
  BusDashboard: undefined;
  BusDriverDashboard: undefined;
  ExcelUpload: undefined;
};

const TeacherLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const { setTeacherUsername } = useContext(UserContext);
  const { themeStyles } = useContext(ThemeContext);
const { showError } = useContext(ErrorContext);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const attendanceSchedulerRef = useRef<boolean>(false);

  /* ---------------- ATTENDANCE SCHEDULER ---------------- */
  const startAutomaticAttendanceTracking = useCallback(async () => {
    try {
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      const storedUsername = await AsyncStorage.getItem('username');
      const userType = await AsyncStorage.getItem('userType');

      if (userType !== 'teacher') return;

      if (!schoolCode || !storedUsername) {
        showError(
          'Configuration Error',
          'School code or username not found. Please login again.'
        );
        return;
      }

      if (attendanceSchedulerRef.current) return;

      console.log('🚀 Starting automatic attendance scheduler for:', storedUsername);
      await startPersistentAttendanceTracking();
      attendanceSchedulerRef.current = true;
    } catch (error: any) {
      showError(
        'Attendance Error',
        error?.message || 'Failed to start attendance scheduler'
      );
    }
  }, [showError]);

const askToEnableLocation = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Location Permission Required',
        'Cleezo Class collects location data to verify your proximity to the campus and automate your check-in and attendance logging, even when the app is closed or not in use. This data is purely used for your attendance tracking and is never shared with third parties.',
        [
          {
            text: 'Deny',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Agree & Continue',
            onPress: async () => {
              const granted = await requestLocationPermission();
              if (granted) {
                await AsyncStorage.setItem('attendanceTrackingEnabled', 'true');
              }
              resolve(granted);
            },
          },
        ],
        { cancelable: false }
      );
    });
  }, []);
  /* ---------------- AUTO LOGIN ---------------- */

  const autoLogin = useCallback(async () => {
    try {
      const storedUser = await AsyncStorage.getItem('username');
      const storedName = await AsyncStorage.getItem('name');
      const userType = await AsyncStorage.getItem('userType');
      const lastScreen = await AsyncStorage.getItem('lastScreen');
      const designation = (await AsyncStorage.getItem('designation'))?.toLowerCase().trim();
      const safeName = storedName || '';

      const isAdminRole = designation === 'admin';
      const isAccountantRole = userType === 'management' && designation === 'accountant';
      const isBusManagerRole =
        userType === 'management' && (designation === 'bus manager' || designation === 'busmanager');
      const isBusDriverRole =
        designation === 'bus driver' || designation === 'busdriver' || designation === 'driver';
      const isChiefRole = userType === 'management' && designation === 'superadmin';

      if (storedUser && userType) {
        if (userType === 'teacher') {
          const teacherScreen: 'TeacherDashboard' | 'TeacherAdmissionDashboard' =
            lastScreen === 'TeacherDashboard'
              ? 'TeacherDashboard'
              : 'TeacherDashboard';
          navigation.reset({
            index: 0,
            routes: [{ name: teacherScreen, params: { username: storedUser, name: safeName } }],
          });
          return;
        }

        if (userType === 'student') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'ParentDashboard', params: { username: storedUser, name: safeName } }],
          });
          return;
        }

        if (isChiefRole) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'ChiefDashboard', params: { username: storedUser, name: safeName } }],
          });
          return;
        }

        if (isAccountantRole) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'AccountantDashboard', params: { username: storedUser, name: safeName } }],
          });
          return;
        }

        if (isBusManagerRole) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'BusDashboard' }],
          });
          return;
        }

        if (isBusDriverRole) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'BusDriverDashboard' }],
          });
          return;
        }

        if ((userType === 'management' || userType === 'marketing') && isAdminRole) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'AdminDashboard' }],
          });
          return;
        }
      }
    } catch (error: any) {
      showError(
        'Auto Login Failed',
        error?.message || 'Something went wrong during auto login'
      );
    }
  }, [navigation, showError]);

  /* ---------------- LOGIN HANDLER ---------------- */

  const getAvailablePushToken = async () => {
    const storedToken = await AsyncStorage.getItem('fcmToken');
    if (storedToken) return storedToken;

    const authStatus = await messaging().requestPermission();
    const isAuthorized =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!isAuthorized) {
      console.warn('Push token sync skipped: notification permission not granted');
      return null;
    }

    const token = await messaging().getToken();
    if (token) {
      await AsyncStorage.setItem('fcmToken', token);
    }
    return token || null;
  };


  const storePushToken = async (
    loginUsername: string,
    pushToken: string,
    userType: string,
    schoolCode: string,
    className?: string,
  ) => {
    try {
      const payload = {
        username: loginUsername,
        pushToken,
        push_token: pushToken,
        userType,
        schoolCode,
        className,
      };

      console.log('Sending push token:', {
        username: loginUsername,
        userType,
        schoolCode,
        className,
        tokenLength: pushToken.length,
      });

      const response = await axios.post('http://162.215.210.38:3010/api/store-push-tok', payload);
      console.log('📤 Push token sent to server:', response.data);
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        (error.request
          ? 'Unable to connect to server while syncing push token'
          : error?.message || 'Unexpected error occurred while syncing push token');

      console.warn('Push token sync skipped:', message);
    }
  };


  const handleLogin = async () => {
    if (!username || !password) {
      showError('Error', 'Please enter username and password');
      return;
    }

    try {
      console.log('LOGIN_TOTAL start');

      const response = await axios.post(
        'http://162.215.210.38:3010/api/login-credentials',
        { username, password },
        { timeout: 10000 }
      );

      const data = response.data;
      if (!data.success) {
        if (data.code === 'ACCOUNT_DISABLED') {
          showError(
            'Account Disabled',
            data.message || 'This account is disabled. Please contact your school administrator.'
          );
        } else {
          showError(
            'Login Failed',
            data.message || 'Please enter valid credentials'
          );
        }
        return;
      }

      // ✅ Store user info in AsyncStorage
      const userType = String(data.userType || data.user_type || '').trim().toLowerCase();
      if (!userType) {
        showError(
          'Login Failed',
          'User type is missing from the server response. Please contact support.'
        );
        return;
      }

      const schoolCode = String(data.schoolCode || data.school_code || data.schoolcode || '').trim();
      const normalizedDesignation = String(data.designation || '').toLowerCase().trim();
      const designationKey = normalizedDesignation.replace(/[\s_-]+/g, '');
      const isAdminRole = designationKey === 'admin';
      const isAccountantRole = userType === 'management' && designationKey === 'accountant';
      const isBusManagerRole =
        userType === 'management' &&
        designationKey === 'busmanager';
      const isBusDriverRole = designationKey === 'busdriver' || designationKey === 'driver';
      const isChiefRole = userType === 'management' && designationKey === 'superadmin';
      let nextScreen: string = 'TeacherDashboard';
      if (userType === 'student') {
        nextScreen = 'ParentDetails';
      } else if (isChiefRole) {
        nextScreen = 'ChiefDashboard';
      } else if (isAccountantRole) {
        nextScreen = 'AccountantDashboard';
      } else if (isBusManagerRole) {
        nextScreen = 'BusDashboard';
      } else if (isBusDriverRole) {
        nextScreen = 'BusDriverDashboard';
      } else if (isAdminRole) {
        nextScreen = 'AdminDashboard';
      } else if (userType === 'teacher') {
        nextScreen = 'TeacherDashboard';
      }

      await AsyncStorage.multiSet([
        ['userType', userType],
        ['username', username],
        ['name', data.name || ''],
        ['schoolCode', schoolCode],
        ['designation', data.designation || ''],
        ['userDetails', JSON.stringify(data)],
        ['lastScreen', nextScreen],
      ]);

      setTeacherUsername(username);

      // Decide dashboard navigation    
      if (userType === 'teacher') {
        const granted = await askToEnableLocation();
        if (granted) {
          await AsyncStorage.setItem('attendanceTrackingEnabled', 'true');
          await startPersistentAttendanceTracking();
          attendanceSchedulerRef.current = true;
        } else {
          await AsyncStorage.setItem('attendanceTrackingEnabled', 'false');
          showError(
            'Location Permission',
            'Location access is needed to track teacher attendance automatically.'
          );
        }

        navigation.replace('TeacherDashboard', { username, name: data.name });
      } else if (userType === 'student') {
        navigation.replace('ParentDetails', { username, name: data.name });
      } else if (isChiefRole) {
        navigation.replace('ChiefDashboard', { username, name: data.name });
      } else if (isAccountantRole) {
        navigation.replace('ExcelUpload');
      } else if (isBusManagerRole) {
        navigation.replace('BusDashboard');
      } else if (isBusDriverRole) {
        navigation.replace('BusDriverDashboard');
      } else if ((userType === 'management' || userType === 'marketing') && isAdminRole) {
        navigation.replace('AdminDashboard');
      } else {
        // If management but not superadmin, block access
        showError('Access Denied', 'Your account does not have dashboard access.');
        return;
      }

      // Sync push token asynchronously
      setTimeout(async () => {
        try {
          const finalToken = await getAvailablePushToken();
          if (!finalToken) {
            console.warn('⚠️ FCM token unavailable, push token sync skipped');
            return;
          }

          await storePushToken(
            username,
            finalToken,
            userType,
            schoolCode,
            data.class_name
          );

          console.log('✅ Background tasks done');
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.warn('Background push token task skipped:', error.message);
          } else {
            console.warn('Background push token task skipped');
          }
        }
      }, 0);

      console.log('LOGIN_TOTAL end');
    } catch (err: any) {
  console.error('Login Error:', err);

  if (err.response) {
    const { message, code } = err.response.data || {};

    if (code === 'ACCOUNT_DISABLED') {
      showError(
        'Account Disabled',
        message ||
          'This account is disabled. Please contact your school administrator.'
      );
      return;
    }

    if (err.response.status === 401) {
      showError(
        'Login Failed',
        message || 'Incorrect username or password'
      );
      return;
    }

    if (err.response.status === 403) {
      showError(
        'Access Denied',
        message || 'You are not authorized to access this application.'
      );
      return;
    }

    if (err.response.status === 400) {
      showError(
        'Validation Error',
        message || 'Please enter username and password'
      );
      return;
    }

    showError(
      'Login Failed',
      message || 'An error occurred while logging in'
    );
  } else if (err.request) {
    showError(
      'Network Error',
      'Server not reachable. Check your internet connection.'
    );
  } else {
    showError(
      'Error',
      err.message || 'An unexpected error occurred'
    );
  }
}
  };


  /* ---------------- USE EFFECTS ---------------- */

  useEffect(() => {
    autoLogin();
  }, [autoLogin]);
  /* --------------------------------------------------
     UI (UNCHANGED)
  -------------------------------------------------- */
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* HEADER */}
        <View style={styles.headerRow}>
          <Image source={require('../assets/Cleezo.png')} style={styles.logo} />
        </View>

        {/* 🔶 OUTER WRAPPER */}
        <View style={styles.syllabusOuterWrapper}>

          {/* 🔶 ORANGE CIRCLES (OUTSIDE) */}
          <View style={styles.orangeCircleTopLeft} />
          <View style={styles.orangeCircleBottomRight} />

          {/* MAIN CONTAINER */}
             <View style={styles.syllabusContainer1}>
                    <View style={styles.syllabusContent}>
          
                      <Text style={styles.signin}>Sign-in</Text>
                     <View style={styles.notchContainer3}>
                        <View style={styles.leftNotch} />
                        <View style={styles.dashedLine} />
                        <View style={styles.rightNotch1} />
                      </View>
                      {/* INPUTS */}
                      <View style={styles.inputContainer}>
                        <TextInput
                          placeholder="Username"
                          placeholderTextColor={themeStyles.inputBorderColor}
                          value={username}
                          onChangeText={setUsername}
                          style={[styles.input, { color: themeStyles.textColor }]}
                        />
          
                        <View style={styles.passwordWrapper}>
                          <TextInput
                            placeholder="Password"
                            placeholderTextColor={themeStyles.inputBorderColor}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            style={[styles.passwordInput, { color: themeStyles.textColor }]}
                          />
                          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons
                              name={showPassword ? 'eye-off' : 'eye'}
                              size={22}
                              color={themeStyles.textColor}
                            />
                          </TouchableOpacity>
                        </View>
          
                        {/* IMAGE + LOGIN (NO GAP) */}
                        <View style={styles.mainContainer}>
                          <View style={styles.leftContainer}>
                            <Image
                              source={require('../assets/Attendance.png')}
                              style={styles.image}
                              resizeMode="contain"
                            />
                          </View>
          
                      <View style={styles.rightContainer}>
                             <TouchableOpacity style={styles.buttonContainer} onPress={handleLogin}>
                                    <Text style={styles.buttonText}>Log In</Text>
                                  </TouchableOpacity>
                
                                  <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => setModalVisible(true)}>
                                    <Text style={styles.forgotPasswordText}>Forgot Password</Text>
                                  </TouchableOpacity>
                          </View>
                                     
                        </View>
                      </View>
          
            <View style={styles.loginImageWrapper}>
            <Image
              source={require('../assets/Cleezo.png')}
              style={styles.loginImage}
              resizeMode="contain"
            />
          </View>
          
           <View style={styles.notchContainer4}>
                        <View style={styles.leftNotch1} />
                        <View style={styles.dashedLine} />
                        <View style={styles.rightNotch} />
                      </View>
          
          
          
                    </View>
                  </View>
          

        </View>

      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forgot Password</Text>
            <Text style={styles.modalText}>
              Please contact your school admin or support team to reset your password.
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
container: {
  flex: 1,
  flexDirection: 'column',padding:'6%'
},

  /* HEADER */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop:hp('10%'),
    flex:2
  },
  logo: { width: 220, height: 220, marginRight: 10 },
  headerText: { fontSize: 28, fontWeight: 'bold', color:'#1d2255ff' },
  loginImageWrapper: {
  flex: 1,                 // 🔑 takes remaining space
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 10,
},
  forgotPasswordButton: { marginTop: 0, paddingLeft: 10, height: hp('7%') },
  forgotPasswordText: { color: '#404040', fontWeight: 300, fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#404040',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: '800',
  },
loginImage: {
  width: wp('87%'),            // 🔑 responsive
  height: hp('18%'), 
      bottom: -2,   // ✅ 30px from bottom
        // 🔑 stays inside container
},
notchContainer4: { 
position: 'absolute',
  left: 0,
  right: 0,
  top: '76%',              // or bottom: 0 if you want at bottom
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
  top: '11%',              // or bottom: 0 if you want at bottom
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
  backgroundColor: '#FF6B6B',

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
leftNotch1: {
  width: 22,
  height: 40,
  backgroundColor: '#f0f0f0',

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
  footerWrapper: {
    position: 'absolute',
    bottom: 5,   // ✅ 30px from bottom
    left: 0,
    right: 0,
  },
rightNotch: {
  width: 22,
  height: 40,
  backgroundColor: '#FF6B6B',

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
rightNotch1: {
  width: 22,
  height: 40,
  backgroundColor: '#f0f0f0',

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

  dashedLine: { 
    flex: 1, 
    borderBottomWidth: 1.5, 
    borderColor: '#000', 
    borderStyle: 'dashed', 
  },

  

  leftContainer: {
    flex: 1,
  },

  rightContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  mainContainer: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
    height:hp('19%')
  },
  image: {
    width: 120,
    height: 120,
      marginRight: 8, 

  },
 image1: {
    width: 340,
    height: 480,
  },
  loginButton: {
    backgroundColor: '#404040',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },

  loginText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  /* 🔶 OUTER RELATIVE WRAPPER */
  syllabusOuterWrapper: {
    position: 'relative',
    alignItems: 'center',
    marginVertical: 30,
    marginTop:hp('4%'),
    flex:7
  },

  /* MAIN CONTAINER */
  syllabusContainer1: {
    width: '100%',
    height: height * 0.58,
    backgroundColor: '#F2F2F2',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    zIndex: 2, // 🔑 ABOVE CIRCLES
  },

  syllabusContent: { flex: 1, padding: 20 },

  /* 🔶 ORANGE CIRCLES */
  orangeCircleTopLeft: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FF6B6B',
    top: -40,
    left: -90,
    zIndex: 0,
  },

  orangeCircleBottomRight: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FF6B6B',
    bottom: -40,
    right: -90,
    zIndex: 0,
  },

  signin: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  inputContainer: { alignItems: 'center' },

  input: {
    width: 280,
    height: hp('5%'),
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginBottom: 10,
    paddingHorizontal: 10,
  },

  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 280,
    height: hp('5%'),
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
  },

  passwordInput: { flex: 1 },



  sideImage: { width: 120, height: 120, marginRight: 15 },

  buttonContainer: {
    width: wp('34%'),
    height: hp('4%'),
    backgroundColor: '#404040',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },

  buttonText: { color: '#fff', fontWeight: 'bold' },

});

export default TeacherLogin;
