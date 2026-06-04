import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import Header from '../ChiefHeader';

import { globalStyles as styles } from '../teacherStyles';
import TeacherFooter from './TeacherFooter';

const BASE_URL = 'https://cleezoclass.com:4000';

type Lead = {
  id: number;
  grade: string;
  date: string;
  time: string;
  status: string;
  full_name: string;
  counselling_required: string;
};

const TeacherChatAndEvents = ({ route }: any) => {
  const { name } = route.params;

  // MODAL STATES
  const [showModal, setShowModal] = useState(false);
  const [reportType, setReportType] = useState<'total' | 'tests' | 'counselling'>('total');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [leadDetails, setLeadDetails] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
const [teacherDecision, setTeacherDecision] = useState<'Accept' | 'Reject' | null>(null);
const [reason, setReason] = useState('');

  // DASHBOARD STATES
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'tests' | 'counselling'>('tests');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    totalParticipations: 0,
    converted: 0,
    scheduledTests: 0,
    scheduledCounselling: 0,
    upcoming: { grade: 'N/A', date: 'N/A' },
  });
  const [leadsList, setLeadsList] = useState<Lead[]>([]);

  // FETCH DASHBOARD DATA
  const fetchDashboardData = async () => {
    try {
      const code = await AsyncStorage.getItem('schoolCode');
      if (!code) {
        Alert.alert('Error', 'School code not found. Please login again.');
        return;
      }
      setSchoolCode(code);

      const [summaryRes, listRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/api/admission-summary`, { params: { schoolCode: code } }),
        axios.get(`${BASE_URL}/api/api/leads-list`, { params: { schoolCode: code } }),
      ]);

      setSummary(summaryRes.data);
      setLeadsList(listRes.data);
    } catch (err) {
      console.error('Fetch Error:', err);
      Alert.alert('Error', 'Unable to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // OPEN SINGLE LEAD DETAILS
  const openLeadPopup = async (leadId: number) => {
    try {
      setDetailLoading(true);
      setShowModal(true);
      setSelectedLeadId(leadId);

      const code = await AsyncStorage.getItem('schoolCode');
      const res = await axios.get(`${BASE_URL}/api/api/lead-details/${leadId}`, {
        params: { schoolCode: code },
      });
      setLeadDetails(res.data);
    } catch (err) {
      Alert.alert('Error', 'Unable to load lead details');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0088cc" />
        <Text style={{ marginTop: 10 }}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.container}>

          {/* HEADER */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerText, { fontSize: 22 }]}>CleezoLeadX</Text>
              <Text style={{ color: '#888' }}>{name}</Text>
            </View>
            <Header />
          </View>

          {/* DASHBOARD CARDS */}
          <View style={styles.mainLayout}>

            {/* LEFT COLUMN */}
            <View style={styles.leftColumn}>
              {/* TOTAL PARTICIPATIONS */}
              <View style={styles.smallCard}>
                <Text style={styles.cardTitle}>Total Participations</Text>
                <Text style={styles.bigGradeBlack}>{summary.totalParticipations}</Text>
                <Text style={styles.percentTextBlack}>{summary.converted} Converted</Text>
                <TouchableOpacity onPress={() => { setReportType('total'); setLeadDetails(null); setShowModal(true); }}>
                  <Text style={styles.viewLinkBlue}>View Report</Text>
                </TouchableOpacity>
              </View>

              {/* UPCOMING TEST */}
              <View style={[styles.smallCard, { backgroundColor: '#ff6b81' }]}>
                <Text style={styles.cardTitleBlack}>Upcoming Test</Text>
                <Text style={[styles.bigGradeBlack, { fontSize: 22 }]}>{summary.upcoming.grade}</Text>
                <Text style={styles.percentTextBlack}>{summary.upcoming.date}</Text>
              </View>
            </View>

            {/* RIGHT COLUMN */}
            <View style={styles.combinedCard}>
              {/* SCHEDULED TESTS */}
              <View style={styles.combinedSection}>
                <Text style={styles.cardTitle}>Scheduled Tests</Text>
                <Text style={styles.bigGradeBlack}>{summary.scheduledTests}</Text>
                <TouchableOpacity onPress={() => { setReportType('tests'); setLeadDetails(null); setShowModal(true); }}>
                  <Text style={styles.viewLinkBlue}>View Report</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.notchContainer}>
                <View style={styles.leftNotch} />
                <View style={styles.dashedLine} />
                <View style={styles.rightNotch} />
              </View>

              {/* SCHEDULED COUNSELLING */}
              <View style={styles.combinedSection}>
                <Text style={styles.cardTitle}>Scheduled Counselling</Text>
                <Text style={styles.bigGradeBlack}>{summary.scheduledCounselling}</Text>
                <TouchableOpacity onPress={() => { setReportType('counselling'); setLeadDetails(null); setShowModal(true); }}>
                  <Text style={styles.viewLinkBlue}>View Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* TABS */}
          <View style={styles.syllabusContainer1}>
 <View style={[styles.buttonRow1, { marginTop: 10 }]}>         
              <TouchableOpacity
                style={[styles.submitBtn1, { backgroundColor: selectedTab === 'tests' ? '#404040' : '#e0e0e0' }]}
                onPress={() => setSelectedTab('tests')}
              >
                <Text style={[styles.submitBtnText, { color: selectedTab === 'tests' ? '#fff' : '#000' }]}>Tests</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn1, { backgroundColor: selectedTab === 'counselling' ? '#404040' : '#e0e0e0' }]}
                onPress={() => setSelectedTab('counselling')}
              >
                <Text style={[styles.submitBtnText, { color: selectedTab === 'counselling' ? '#fff' : '#000' }]}>Counselling</Text>
              </TouchableOpacity>
            </View>
               <View style={[styles.notchContainer3, {marginTop:20}]}>
                                  <View style={styles.leftNotch} />
                                  <View style={styles.dashedLine} />
                                  <View style={styles.rightNotch} />
                                </View>
         
          </View>

          {/* FOOTERS */}

        </View>

        {/* MODAL */}
        <Modal visible={showModal} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, maxHeight: '85%' }}>
              {/* HEADER */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {leadDetails ? 'Lead Details' :
                    reportType === 'total' ? 'All Participants' :
                      reportType === 'tests' ? 'Test Reports' :
                        'Counselling Reports'}
                </Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Text style={{ color: 'red', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* CONTENT */}
              <ScrollView style={{ marginTop: 15 }}>
                {detailLoading ? (
                  <ActivityIndicator size="large" />
                ) : leadDetails ? (
                  /* SINGLE LEAD DETAILS */
                  [
                    ['Name', leadDetails.full_name],
                    ['Mobile', leadDetails.mobile_number],
                    ['Email', leadDetails.email_id],
                    ['Admission For', leadDetails.lead_admission_for],
                    ['Reg No', leadDetails.reg_no],
                    ['Ticket No', leadDetails.ticket_no],
                    ['Test Date', leadDetails.test_date],
                    ['Test Time', leadDetails.test_time],
                    ['Test Score', `${leadDetails.test_score || '-'} / ${leadDetails.total_marks || '-'}`],
                    ['Test Status', leadDetails.test_status],
                    ['Counselling Required', leadDetails.counselling_required],
                    ['Counselling Date', leadDetails.counselling_date],
                    ['Teacher', leadDetails.assigned_teacher_name],
                    ['Remarks', leadDetails.remarks],
                  ].map(([label, value], i) => (
                    <View key={i} style={{ marginBottom: 10 }}>
                      <Text style={{ fontWeight: '600' }}>{label}</Text>
                      <Text>{value || 'N/A'}</Text>
                    </View>
                  ))
                ) : (
                  /* REPORT LIST */
                  leadsList
                    .filter(lead => {
                      if (reportType === 'tests') return lead.date; // test leads only
                      if (reportType === 'counselling') return lead.counselling_required === 'Yes'; // counselling leads
                      return true; // total
                    })
                    .map(lead => (
                      <TouchableOpacity
                        key={lead.id}
                        onPress={() => openLeadPopup(lead.id)}
                        style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                      >
                        <Text style={{ fontWeight: '600' }}>{lead.full_name}</Text>
                        <Text>{lead.date}  {lead.time}</Text>
                        <Text style={{ color: '#0088cc' }}>{lead.status}</Text>
                      </TouchableOpacity>
                    ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </ScrollView>
      <TeacherFooter />

    </SafeAreaView>
  );
};

export default TeacherChatAndEvents;
