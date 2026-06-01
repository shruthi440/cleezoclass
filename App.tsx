import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, Text, View } from 'react-native';
import {
  NavigationContainer,
  NavigationProp,
  useNavigation,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { getApps } from '@react-native-firebase/app';
import notifee, { AndroidImportance } from '@notifee/react-native';

import { ThemeProvider } from './ThemeContext';
import { UserProvider } from './UserContext';
import { ErrorProvider } from './ErrorContext';
import { NextClassProvider } from './NextClassContext';
import { TeacherTimetableProvider } from './Modalcontext';
import TeacherLogin from './TeacherDashboard/Login';
import TeacherAdmissionDashboard from './TeacherDashboard/DashboardScreen';
import TeacherDashboard from './TeacherDashboard/TeacherDashboard';
import TeacherAttendance from './TeacherDashboard/TeacherAttendance';
import TeacherBehaviour from './TeacherDashboard/TeacherBehaviour';
import TeacherTimetable from './TeacherDashboard/TeacherTimetable';
import TeacherEventMediaUpload from './TeacherDashboard/TeacherEventMediaUpload';
import TeacherTickets from './TeacherDashboard/TeacherTickets';
import TeacherSalary from './TeacherDashboard/TeacherSalary';
import TeacherCalender from './TeacherDashboard/TeacherCalender';
import TeacherDetails from './TeacherDashboard/TeacherDetails';
import TeacherHomework from './TeacherDashboard/TeacherHomework';
import TopicOfDay from './TeacherDashboard/TopicOfDay';
import TeacherHomeworkUpload from './TeacherDashboard/TeacherHomeworkupload';
import TeacherQuestionPaperGeneration from './TeacherDashboard/TeacherQuestionPaperGeneration';
import TeacherLeaveRequest from './TeacherDashboard/TeacherLeaveRequest';
import TeacherChatAndEvents from './TeacherDashboard/TeacherChatAndEvents';
import TeacherCounselling from './TeacherDashboard/Teacher_Councelling';
import TeacherModuleSummary from './TeacherDashboard/TeacherModuleSummary';
import ParentDashboard from './ParentDashboard/ParentDashboard';
import ParentAcademic from './ParentDashboard/ParentAcademic';
import ParentAttendance from './ParentDashboard/ParentAttendance';
import ParentFees from './ParentDashboard/ParentFees';
import ParentHomework from './ParentDashboard/ParentHomwork';
import ParentTimetable from './ParentDashboard/ParentTimetable';
import ParentCalender from './ParentDashboard/ParentCalender';
import ParentPhotos from './ParentDashboard/ParentPhotos';
import ParentLiveChatTicket from './ParentDashboard/ParentLiveChatTicket';
import ParentHomepage from './ParentDashboard/parentEvents';
import AdminDashboard from './AdminDashboard';
import ChiefDashboard from './chiefdashboard/ChiefDashboard';
import AcademicStudent from './chiefdashboard/Chief_operation_AcademicStudent';
import AcademicTeacher from './chiefdashboard/Chief_operation_AcademicTeacher';
import ExamManagement from './chiefdashboard/Chief_operation_ExamManagement';
import Meetings from './chiefdashboard/Chief_operation_Meetings';
import ChiefAttendanceAndPayroll from './chiefdashboard/ChiefAttendanceAndPayroll';
import ParentStudentIconManagement from './ParentDashboard/ParentDetails';
import AccountantDashboard from './AccountantDashboard/AccountantDashboard';
import BusManagerDashboard from './BusManagerDashboard';

type RootStackParamList = {
  TeacherLogin: undefined;
  TeacherDashboard: { username?: string; name?: string } | undefined;
  TeacherModuleSummary: { username?: string; name?: string; moduleLabel?: string } | undefined;
  TeacherAdmissionDashboard: { username?: string; name?: string } | undefined;
  TeacherAttendance: { username?: string; name?: string } | undefined;
  TeacherBehaviour: { username?: string; name?: string } | undefined;
  TeacherTimetable: { username?: string; name?: string } | undefined;
  TeacherEventMediaUpload: { username?: string; name?: string } | undefined;
  TeacherTickets: { username?: string; name?: string } | undefined;
  TeacherSalary: { username?: string; name?: string } | undefined;
  TeacherCalender: { username?: string; name?: string } | undefined;
  TeacherDetails: { username?: string; name?: string } | undefined;
  TeacherHomework: { username?: string; name?: string } | undefined;
  TopicOfDay: { username?: string; name?: string } | undefined;
  TeacherHomeworkUpload: { username?: string; name?: string } | undefined;
  TeacherQuestionPaperGeneration: { username?: string; name?: string } | undefined;
  TeacherLeaveRequest: { username?: string; name?: string } | undefined;
  TeacherChatAndEvents: { username?: string; name?: string } | undefined;
  TeacherCounselling: { username?: string; name?: string } | undefined;
  ParentDetails: { username?: string; name?: string } | undefined;
  ParentDashboard: { username?: string; name?: string } | undefined;
  ParentAcademic: { username?: string; name?: string } | undefined;
  ParentAttendance: { username?: string; name?: string } | undefined;
  ParentFees: { username?: string; name?: string } | undefined;
  ParentHomework: { username?: string; name?: string } | undefined;
  ParentTimetable: { username?: string; name?: string } | undefined;
  ParentCalender: { username?: string; name?: string } | undefined;
  ParentPhotos: { username?: string; name?: string } | undefined;
  ParentLiveChatTicket: { username?: string; name?: string } | undefined;
  ParentHomepage: { username?: string; name?: string } | undefined;
  AdminDashboard: undefined;
  AccountantDashboard: { username?: string; name?: string } | undefined;
  ChiefDashboard: { username?: string; name?: string } | undefined;
  BusManagerDashboard: undefined;
  AcademicStudent: undefined;
  AcademicTeacher: undefined;
  ExamManagement: undefined;
  Meetings: undefined;
  ChiefAttendanceAndPayroll: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const DEFAULT_NOTIFICATION_CHANNEL_ID = 'default-channel-id';

const PlaceholderScreen: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: '#F6F6F7',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
    >
      <StatusBar barStyle="dark-content" />
      <View
        style={{
          width: '100%',
          maxWidth: 360,
          borderRadius: 24,
          backgroundColor: '#FFFFFF',
          padding: 24,
          borderWidth: 1,
          borderColor: '#E5E5E7',
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111' }}>
          {title}
        </Text>
        <Text style={{ marginTop: 10, fontSize: 14, color: '#555', lineHeight: 20 }}>
          {subtitle}
        </Text>
        <Text
          onPress={() => navigation.navigate('TeacherLogin')}
          style={{
            marginTop: 18,
            fontSize: 14,
            fontWeight: '700',
            color: '#24385f',
          }}
        >
          Back to Login
        </Text>
      </View>
    </SafeAreaView>
  );
};

const PushNotificationBootstrap = () => {
  useEffect(() => {
    let unsubscribeOnMessage: (() => void) | undefined;

    const setupPushNotifications = async () => {
      try {
        await notifee.createChannel({
          id: DEFAULT_NOTIFICATION_CHANNEL_ID,
          name: 'Default Channel',
          description: 'For local push notifications',
          importance: AndroidImportance.HIGH,
          vibration: true,
        });

        if (!getApps().length) {
          return;
        }

        const authStatus = await messaging().requestPermission();
        const isAuthorized =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (isAuthorized) {
          const token = await messaging().getToken();
          if (token) {
            await AsyncStorage.setItem('fcmToken', token);
          }
        }

        unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
          const title = remoteMessage.notification?.title || 'Cleezo Class';
          const body = String(
            remoteMessage.notification?.body ||
              remoteMessage.data?.body ||
              'You have a new notification.'
          );

          await notifee.displayNotification({
            title,
            body,
            android: {
              channelId: DEFAULT_NOTIFICATION_CHANNEL_ID,
              pressAction: { id: 'default' },
            },
          });
        });
      } catch (error) {
        console.error('Push notification setup failed:', error);
      }
    };

    setupPushNotifications();

    return () => {
      if (unsubscribeOnMessage) {
        unsubscribeOnMessage();
      }
    };
  }, []);

  return null;
};

const App = () => {
  return (
    <ThemeProvider>
      <UserProvider>
        <ErrorProvider>
          <NextClassProvider>
            <TeacherTimetableProvider>
              <NavigationContainer>
                <PushNotificationBootstrap />
                <Stack.Navigator
                  initialRouteName="TeacherLogin"
                  screenOptions={{ headerShown: false }}
                >
                  <Stack.Screen name="TeacherLogin" component={TeacherLogin} />
                  <Stack.Screen
                    name="TeacherAdmissionDashboard"
                    component={TeacherAdmissionDashboard}
                  />
                  <Stack.Screen
                    name="TeacherDashboard"
                    component={TeacherDashboard}
                  />
                  <Stack.Screen
                    name="TeacherModuleSummary"
                    component={TeacherModuleSummary}
                  />
                  <Stack.Screen
                    name="ParentDashboard"
                    component={ParentDashboard}
                  />
                  <Stack.Screen
                    name="ParentAcademic"
                    component={ParentAcademic as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ParentAttendance"
                    component={ParentAttendance as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ParentFees"
                    component={ParentFees as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ParentHomework"
                    component={ParentHomework as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ParentTimetable"
                    component={ParentTimetable as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ParentCalender"
                    component={ParentCalender as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ParentPhotos"
                    component={ParentPhotos as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ParentLiveChatTicket"
                    component={ParentLiveChatTicket as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ParentHomepage"
                    component={ParentHomepage as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherAttendance"
                    component={TeacherAttendance as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherBehaviour"
                    component={TeacherBehaviour as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherTimetable"
                    component={TeacherTimetable as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherEventMediaUpload"
                    component={TeacherEventMediaUpload as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherTickets"
                    component={TeacherTickets as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherSalary"
                    component={TeacherSalary as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherCalender"
                    component={TeacherCalender as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherDetails"
                    component={TeacherDetails as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherHomework"
                    component={TeacherHomework as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TopicOfDay"
                    component={TopicOfDay as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherHomeworkUpload"
                    component={TeacherHomeworkUpload as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherQuestionPaperGeneration"
                    component={TeacherQuestionPaperGeneration as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherLeaveRequest"
                    component={TeacherLeaveRequest as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherChatAndEvents"
                    component={TeacherChatAndEvents as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="TeacherCounselling"
                    component={TeacherCounselling as React.ComponentType<any>}
                  />
<Stack.Screen
                    name="ParentDetails"
                    component={ParentStudentIconManagement }
                  />
                  <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
                  <Stack.Screen
                    name="AccountantDashboard"
                    component={AccountantDashboard as React.ComponentType<any>}
                  />
                  <Stack.Screen name="ChiefDashboard" component={ChiefDashboard} />
                  <Stack.Screen
                    name="BusManagerDashboard"
                    component={BusManagerDashboard as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="AcademicStudent"
                    component={AcademicStudent as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="AcademicTeacher"
                    component={AcademicTeacher as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ExamManagement"
                    component={ExamManagement as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="Meetings"
                    component={Meetings as React.ComponentType<any>}
                  />
                  <Stack.Screen
                    name="ChiefAttendanceAndPayroll"
                    component={ChiefAttendanceAndPayroll as React.ComponentType<any>}
                  />

                  
                </Stack.Navigator>
              </NavigationContainer>
            </TeacherTimetableProvider>
          </NextClassProvider>
        </ErrorProvider>
      </UserProvider>
    </ThemeProvider>
  );
};

export default App;
