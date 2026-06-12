import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';

import LiveChatPanel from '../TeacherDashboard/LiveChatPanel';
import { RootStackParamList } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentMessage'>;

const ParentMessage: React.FC<Props> = ({ navigation, route }) => (
  <SafeAreaView style={styles.screen}>
    <StatusBar barStyle="dark-content" />
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={22} color="#1F1F22" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Messages</Text>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => navigation.navigate('ParentDashboard', route.params)}
      >
        <Ionicons name="home-outline" size={21} color="#1F1F22" />
      </TouchableOpacity>
    </View>
    <View style={styles.content}>
      <LiveChatPanel
        role="parent"
        routeName={route.params?.name}
        routeUsername={route.params?.username}
      />
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F8' },
  header: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECF2',
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6F8',
  },
  headerTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  content: { flex: 1, padding: 12 },
});

export default ParentMessage;
