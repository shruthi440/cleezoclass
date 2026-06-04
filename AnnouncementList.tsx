import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const API_BASE_URL = 'http://162.215.210.38:3010/api';

type Announcement = {
  id: number;
  title: string;
  category?: string | null;
  announcement_date?: string | null;
  description?: string | null;
  audioUrl?: string | null;
  audio_filename?: string | null;
  created_at?: string | null;
};

type AnnouncementListProps = {
  audience: 'Teacher' | 'Parent';
};

const formatDisplayDate = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return 'No date';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.split('T')[0] || raw;

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const AnnouncementList: React.FC<AnnouncementListProps> = ({ audience }) => {
  const [schoolCode, setSchoolCode] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadAnnouncements = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const storedSchoolCode = String(await AsyncStorage.getItem('schoolCode') || '').trim();
      setSchoolCode(storedSchoolCode);

      if (!storedSchoolCode) {
        setAnnouncements([]);
        setErrorMessage('School code is missing.');
        return;
      }

      console.log(`[${audience}Announcements] loading`, {
        schoolCode: storedSchoolCode,
      });

      const response = await axios.get(`${API_BASE_URL}/announcements`, {
        params: {
          schoolCode: storedSchoolCode,
          limit: 50,
        },
      });

      const nextAnnouncements = Array.isArray(response.data?.announcements)
        ? response.data.announcements
        : [];

      console.log(`[${audience}Announcements] loaded`, {
        count: nextAnnouncements.length,
      });

      setAnnouncements(nextAnnouncements);
      setErrorMessage('');
    } catch (error: any) {
      console.log(
        `[${audience}Announcements] load failed`,
        error?.response?.data || error?.message,
      );
      setAnnouncements([]);
      setErrorMessage(
        error?.response?.data?.message || 'Announcements could not be loaded.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [audience]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const openAudio = async (audioUrl?: string | null) => {
    const url = String(audioUrl || '').trim();
    if (!url) return;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Audio', 'No app is available to open this audio file.');
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert('Audio', 'Unable to open this audio file.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAnnouncements(true)}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Announcements</Text>
           
          </View>
          <Pressable style={styles.refreshButton} onPress={() => loadAnnouncements(true)}>
            <MaterialIcons name="refresh" size={20} color="#111827" />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#111827" />
            <Text style={styles.centerText}>Loading announcements...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centerBox}>
            <MaterialIcons name="campaign" size={32} color="#6B7280" />
            <Text style={styles.centerText}>{errorMessage}</Text>
          </View>
        ) : announcements.length === 0 ? (
          <View style={styles.centerBox}>
            <MaterialIcons name="campaign" size={32} color="#6B7280" />
            <Text style={styles.centerText}>No announcements yet.</Text>
          </View>
        ) : (
          <View style={styles.cardStack}>
            {announcements.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.category || 'General'}</Text>
                  </View>
                  <Text style={styles.dateText}>
                    {formatDisplayDate(item.announcement_date)}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {!!item.description && (
                  <Text style={styles.description}>{item.description}</Text>
                )}
                {!!item.audioUrl && (
                  <Pressable style={styles.audioButton} onPress={() => openAudio(item.audioUrl)}>
                    <MaterialIcons name="volume-up" size={18} color="#FFFFFF" />
                    <Text style={styles.audioButtonText}>Open Audio</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 18, paddingBottom: 34 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  title: { color: '#111827', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 13, fontWeight: '600', marginTop: 3 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  centerBox: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  centerText: { color: '#6B7280', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  cardStack: { gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  badgeText: { color: '#3730A3', fontSize: 12, fontWeight: '800' },
  dateText: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  cardTitle: { color: '#111827', fontSize: 17, fontWeight: '800' },
  description: { color: '#374151', fontSize: 14, lineHeight: 20, marginTop: 8 },
  audioButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  audioButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});

export default AnnouncementList;
