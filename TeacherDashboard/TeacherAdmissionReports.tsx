import React from 'react';
import { View } from 'react-native';
import DashboardScreen from './DashboardScreen';
import TeacherFooter from './TeacherFooter';

const TeacherAdmissionReports: React.FC = () => {
  return (
    <View style={{ flex: 1 }}>
      <DashboardScreen showFooter={false} />
      <TeacherFooter
        homeRoute="TeacherAdmissionDashboard"
        addRoute="TeacherAdmissionRegister"
        chatRoute="TeacherChatAndEvents"
        profileRoute="TeacherDashboard"
      />
    </View>
  );
};

export default TeacherAdmissionReports;
