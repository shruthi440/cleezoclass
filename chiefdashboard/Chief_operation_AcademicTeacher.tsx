import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  Image,
  ImageBackground,
  StyleSheet,
  BackHandler,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ChiefFooterProfile from './ChiefFooterProfile';
import { globalStyles as styles } from '../styles';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
/* -------------------- TYPES -------------------- */
type TabType = 'Testperformance' | 'PerformanceGraph';
type AcademicTeacherNavigationProp = StackNavigationProp<
  RootStackParamList,
  'AcademicTeacher'
>;

interface Teacher {
  id: string;
  name: string;
  subject: string;
}

const chiefDashboardPalette = ['#F4EFEB', '#D1C7F9', '#C3BDFB'];
const chiefDashboardAccent = ['#E4D8FF', '#B58BFF', '#7C3AED'];

const AcademicTeacher: React.FC = () => {
  const backArrowImage = require('../assets/Arrow.png');
  const navigation = useNavigation<AcademicTeacherNavigationProp>();
  const route = useRoute<any>();
  // Tab state
  const [activeTab, setActiveTab] = useState<'syllabus' | 'test'>('syllabus');

  // Dropdown state
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // School code
  const [schoolCode, setSchoolCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleBackToChiefDashboard = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return true;
    }

    navigation.navigate('ChiefDashboard' as never);
    return true;
  }, [navigation]);

  // Load school code from AsyncStorage
  useEffect(() => {
    const loadSchoolCode = async () => {
      try {
        const storedCode = await AsyncStorage.getItem('schoolCode');
        setSchoolCode(storedCode);
      } catch (err) {
        console.error('Failed to load school code:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSchoolCode();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackToChiefDashboard,
    );

    return () => subscription.remove();
  }, [handleBackToChiefDashboard]);

  // Fetch teachers when schoolCode is loaded
  useEffect(() => {
    console.log('🔁 useEffect triggered for fetching teachers');
    console.log('📌 Current schoolCode:', schoolCode);

    if (!schoolCode) {
      console.warn('❌ No school code, skipping fetch');
      return;
    }

    const fetchTeachers = async () => {
      try {
        console.log('🌐 Fetching teachers from API...');
        const res = await axios.get<Teacher[]>(
          'https://cleezoclass.com:4000/teachers',
          {
            params: { schoolCode },
          },
        );

        console.log('✅ API response:', res.data);

        if (Array.isArray(res.data)) {
          setTeachers(res.data);
          console.log(`🎉 Loaded ${res.data.length} teachers`);
        } else {
          console.error('❌ Teachers API did not return an array');
        }
      } catch (err) {
        console.error('❌ Error fetching teachers:', err);
      }
    };

    fetchTeachers();
  }, [schoolCode]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.headerText}>Academics - Staff</Text>
          </View>

          <LinearGradient
            colors={chiefDashboardPalette}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={teacherStyles.heroCard}
          >
            <View style={teacherStyles.heroOverlay} />
            <Text style={teacherStyles.heroTitle}>Academic Staff</Text>
            <Text style={teacherStyles.heroSubtitle}>
              Clean overview of teacher load, attendance, and progress.
            </Text>

            <View style={teacherStyles.heroStatsRow}>
              <View style={teacherStyles.heroStatPill}>
                <Text style={teacherStyles.heroStatLabel}>Teachers</Text>
                <Text style={teacherStyles.heroStatValue}>{teachers.length}</Text>
              </View>
              <View style={teacherStyles.heroStatPill}>
                <Text style={teacherStyles.heroStatLabel}>Tab</Text>
                <Text style={teacherStyles.heroStatValue}>
                  {activeTab === 'syllabus' ? 'Syllabus' : 'Test'}
                </Text>
              </View>
              <View style={teacherStyles.heroStatPill}>
                <Text style={teacherStyles.heroStatLabel}>Status</Text>
                <Text style={teacherStyles.heroStatValue}>
                  {selectedTeacher ? 'Selected' : 'Pending'}
                </Text>
              </View>
            </View>

            <View style={teacherStyles.heroPickerWrap}>
              <Picker
                selectedValue={selectedTeacher?.id || ''}
                onValueChange={(itemValue: string) => {
                  const teacher = teachers.find(t => t.id === itemValue) || null;
                  setSelectedTeacher(teacher);
                }}
                style={teacherStyles.heroPicker}
                itemStyle={{ color: '#111827' }}
                dropdownIconColor="#4C1D95"
              >
                <Picker.Item label="Select Teacher" value="" enabled={false} />
                {teachers.map(teacher => (
                  <Picker.Item
                    key={teacher.id}
                    label={teacher.name}
                    value={teacher.id}
                  />
                ))}
              </Picker>
            </View>
          </LinearGradient>

          <View style={teacherStyles.summaryBand}>
            <View style={teacherStyles.summaryBandLeft}>
              <Text style={teacherStyles.summaryTitle}>Quick View</Text>
              <Text style={teacherStyles.summaryText}>
                Pick a teacher, then review attendance and performance in one place.
              </Text>
            </View>
            <View style={teacherStyles.summaryBandRight}>
              <TouchableOpacity
                onPress={() => setActiveTab('syllabus')}
                style={teacherStyles.summaryButtonDark}
              >
                <Text style={teacherStyles.summaryButtonTextDark}>Syllabus</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('test')}
                style={teacherStyles.summaryButtonLight}
              >
                <Text style={teacherStyles.summaryButtonTextLight}>Test View</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Layout */}
          <View style={styles.mainLayout}>
            {/* LEFT COLUMN: Attendance & Overall */}
            <View style={styles.leftColumn}>
              <LinearGradient
                colors={chiefDashboardAccent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={teacherStyles.metricCard}
              >
                <Text style={teacherStyles.metricLabel}>Attendance</Text>
                <Text style={teacherStyles.metricValue}>A</Text>
                <Text style={teacherStyles.metricPercent}>68%</Text>
                <TouchableOpacity>
                  <Text style={teacherStyles.metricLink}>View Report</Text>
                </TouchableOpacity>
              </LinearGradient>

              <LinearGradient
                colors={chiefDashboardPalette}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={teacherStyles.metricCard}
              >
                <Text style={teacherStyles.metricLabel}>Overall</Text>
                <Text style={teacherStyles.metricValue}>C+</Text>
                <Text style={teacherStyles.metricPercent}>68%</Text>
                <TouchableOpacity>
                  <Text style={teacherStyles.metricLink}>View Report</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Combined Card */}
            <View style={[styles.combinedCard, teacherStyles.combinedCardTint]}>
              <View style={styles.combinedSection}>
                <Text style={styles.cardTitle}>Progress Report</Text>
                <Text style={[styles.bigNum, { marginTop: -25 }]}>13</Text>
                <Text style={[styles.percentText]}>18% of total</Text>
                <TouchableOpacity>
                  <Text style={[styles.viewLink1, { marginTop: -5 }]}>
                    View List
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.combinedSection}>
                <Text style={[styles.cardTitle, { marginTop: 20 }]}>
                  Progress Report - Generated
                </Text>
                <Text style={[styles.bigNum, { marginTop: -38 }]}>114</Text>
                <Text style={styles.percentText}>68% of total</Text>
                <TouchableOpacity>
                  <Text style={styles.viewLink1}>View List</Text>
                </TouchableOpacity>
              </View>
            
            </View>
          </View>

          {/* Syllabus / Test Tabs */}

          <View style={styles.AccademicTeacher}>
            {/* Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                onPress={() => setActiveTab('syllabus')}
                style={[
                  styles.tab,
                  activeTab === 'syllabus' && styles.activeTabBackground, // active background
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'syllabus'
                      ? styles.activeTabText // white text for active
                      : styles.inactiveTabText, // black text for inactive
                  ]}
                >
                  Syllabus
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('test')}
                style={[
                  styles.tab,
                  activeTab === 'test' && styles.activeTabBackground,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'test'
                      ? styles.activeTabText
                      : styles.inactiveTabText,
                  ]}
                >
                  Test Performance
                </Text>
              </TouchableOpacity>
            </View>

            {/* Dashed line with symmetric notches */}
        

            {/* Content */}
            <View style={styles.syllabusContent}>
              <View style={styles.nameRow}>
                <Text style={styles.teacherName}>
                  {selectedTeacher ? selectedTeacher.name : 'Select a teacher'}
                </Text>
                <Text style={styles.classText}>
                  {selectedTeacher ? selectedTeacher.subject : ''}
                </Text>
              </View>

              <View style={styles.chartFrame}>
                <View style={styles.yAxis}>
                  {['dec', 'nov', 'oct', 'sep'].map(m => (
                    <Text key={m} style={styles.axisLabel}>
                      {m}
                    </Text>
                  ))}
                </View>
                <View style={styles.chartArea}>
                  <View style={styles.barPair}>
                    <View style={[styles.bar, styles.runBar, { height: 60 }]} />
                    <View style={[styles.bar, styles.lagBar, { height: 30 }]} />
                    <Text style={styles.barName}>6A</Text>
                  </View>
                  <View style={styles.barPair}>
                    <View style={[styles.bar, styles.runBar, { height: 30 }]} />
                    <View style={[styles.bar, styles.lagBar, { height: 60 }]} />
                    <Text style={styles.barName}>6B</Text>
                  </View>
                  <View style={styles.barPair}>
                    <View style={[styles.bar, styles.runBar, { height: 35 }]} />
                    <View style={[styles.bar, styles.lagBar, { height: 60 }]} />
                    <Text style={styles.barName}>7B</Text>
                  </View>
                </View>
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.box, styles.runBar]} />
                  <Text>Running</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.box, styles.lagBar]} />
                  <Text>Lagging</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity>
              <Text style={[styles.viewLink2, { marginTop: -30 }]}>
                View Report
              </Text>
            </TouchableOpacity>

            <View style={[styles.notchContainer4, { marginTop: '-1%' }]}>
              <View style={styles.leftNotch} />
              <View style={styles.dashedLine} />
              <View style={styles.rightNotch} />
            </View>
          </View>
        </View>
      </ScrollView>
      <View style={footerStyles.fixedFooter}>
        <LinearGradient
          colors={['#FFFFFF', '#FBFBFD', '#F4F1FF']}
          start={{ x: 0.08, y: 0.05 }}
          end={{ x: 0.95, y: 1 }}
          style={footerStyles.footerShell}
        >
          <View style={footerStyles.footerRow}>
            <TouchableOpacity
              style={footerStyles.footerItem}
              onPress={handleBackToChiefDashboard}
            >
              <Image source={backArrowImage} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text style={footerStyles.footerLabel}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={footerStyles.footerItem}
              onPress={() => navigation.navigate('ChiefDashboard' as never)}
            >
              <Ionicons name="home" size={18} color="#111" />
              <Text style={footerStyles.footerLabel}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={footerStyles.footerAddButton}
              onPress={() => navigation.navigate('ChiefDashboard' as never)}
            >
              <Text style={footerStyles.footerAddText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={footerStyles.footerItem}
              onPress={() => navigation.navigate('ChiefDashboard' as never)}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#B0B0B5" />
              <Text style={footerStyles.footerLabelMuted}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={footerStyles.footerItem}
              onPress={() => navigation.navigate('ChiefDashboard' as never)}
            >
              <ChiefFooterProfile />
              <Text style={footerStyles.footerLabelMuted}>Profile</Text>
            </TouchableOpacity>
          </View>
          <View style={footerStyles.footerBrandRow}>
            <Text style={footerStyles.poweredBy}>Powered By</Text>
            <ImageBackground
              source={require('../assets/Cleezo.png')}
              style={footerStyles.logo}
              resizeMode="contain"
            />
          </View>
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
};

export default AcademicTeacher;

const footerStyles = StyleSheet.create({
  fixedFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  footerShell: {
    borderRadius: 40,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: 'visible',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  footerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  footerLabel: {
    marginTop: 0,
    fontSize: 7,
    color: '#111111',
    fontWeight: '700',
  },
  footerLabelMuted: {
    marginTop: 0,
    fontSize: 7,
    color: '#B0B0B5',
    fontWeight: '700',
  },
  footerAddButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F14A40',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: '#FFF',
    marginTop: -34,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  footerAddText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginTop: -2,
  },
  poweredBy: {
    fontSize: 7.5,
    color: '#8A8A8A',
    fontWeight: '500',
    marginRight: 4,
  },
  logo: {
    width: 42,
    height: 26,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
});

const teacherStyles = StyleSheet.create({
  heroCard: {
    borderRadius: 28,
    marginTop: 12,
    marginBottom: 14,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#4B4B55',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
    fontWeight: '600',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroStatPill: {
    flexGrow: 1,
    minWidth: 92,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroStatLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroStatValue: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  heroPickerWrap: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  heroPicker: {
    color: '#111827',
    height: 50,
  },
  summaryBand: {
    marginTop: 6,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EAF0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryBandLeft: { flex: 1 },
  summaryBandRight: { gap: 8, alignItems: 'flex-end' },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
  },
  summaryText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  summaryButtonDark: {
    backgroundColor: '#4C1D95',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  summaryButtonLight: {
    backgroundColor: '#EDE9FE',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  summaryButtonTextDark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  summaryButtonTextLight: {
    color: '#4C1D95',
    fontSize: 11,
    fontWeight: '800',
  },
  metricCard: {
    width: '100%',
    minHeight: 120,
    borderRadius: 22,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: 'hidden',
  },
  metricLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metricValue: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 8,
    letterSpacing: -0.6,
  },
  metricPercent: {
    color: '#4B4B55',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  metricLink: {
    color: '#4C1D95',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
  },
  cardTintLight: {
    backgroundColor: 'rgba(212, 203, 251, 0.35)',
    borderRadius: 22,
  },
  cardTintDark: {
    backgroundColor: 'rgba(228, 216, 255, 0.55)',
    borderRadius: 22,
  },
  combinedCardTint: {
    backgroundColor: 'rgba(244, 239, 235, 0.9)',
  },
});
