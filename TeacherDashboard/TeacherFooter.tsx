import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const logoImage = require('../assets/Cleezo.png');
const backArrowImage = require('../assets/Arrow.png');
const teacherPhotoUploadBase = 'https://cleezoclass.com:4000/CRM/public/uploads';

const decodeHexText = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return raw;

  try {
    const bufferCtor = (globalThis as any).Buffer;
    if (bufferCtor?.from) {
      return bufferCtor.from(hex, 'hex').toString('utf8');
    }
  } catch {}

  return raw;
};

const decodeBase64Text = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const atobFn = (globalThis as any).atob;
    if (typeof atobFn === 'function') {
      return atobFn(raw);
    }
  } catch {}

  try {
    const bufferCtor = (globalThis as any).Buffer;
    if (bufferCtor?.from) {
      return bufferCtor.from(raw, 'base64').toString('utf8');
    }
  } catch {}

  return '';
};

const resolveTeacherPhotoUri = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const decoded = decodeHexText(raw);
  const normalized = String(decoded || raw).trim();
  if (!normalized) return '';

  if (normalized.startsWith('data:image')) {
    const base64Part = normalized.split(',')[1] || '';
    const decodedPath = String(decodeBase64Text(base64Part) || '').trim();

    if (
      decodedPath.includes('CRM/public/uploads') ||
      decodedPath.startsWith('/uploads/') ||
      decodedPath.startsWith('uploads/')
    ) {
      const stripped = decodedPath.replace(/^\/+/, '');
      const relativePath = stripped
        .replace(/^CRM\/public\/uploads\/?/i, '')
        .replace(/^uploads\/?/i, '')
        .replace(/^\/+/, '');
      return `${teacherPhotoUploadBase}/${relativePath}`;
    }

    if (decodedPath.startsWith('http://') || decodedPath.startsWith('https://')) {
      return decodedPath;
    }

    return normalized;
  }

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  const stripped = normalized.replace(/^\/+/, '');
  if (stripped.includes('CRM/public/uploads') || stripped.startsWith('uploads/')) {
    const relativePath = stripped
      .replace(/^CRM\/public\/uploads\/?/i, '')
      .replace(/^uploads\/?/i, '')
      .replace(/^\/+/, '');
    return `${teacherPhotoUploadBase}/${relativePath}`;
  }

  return normalized;
};

type TeacherFooterProps = {
  addRoute?: string;
  homeRoute?: string;
  chatRoute?: string;
  profileRoute?: string;
};

const TeacherFooter: React.FC<TeacherFooterProps> = ({
  addRoute = 'TeacherHomework',
  homeRoute = 'TeacherDashboard',
  chatRoute = 'TeacherChatAndEvents',
  profileRoute = 'TeacherDashboard',
}) => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const routeParams = route?.params ?? {};
  const [teacherPhotoUri, setTeacherPhotoUri] = useState('');

  useEffect(() => {
    let active = true;

    const loadTeacherPhoto = async () => {
      try {
        const rawTeacherProfile = await AsyncStorage.getItem('teacherProfile');
        const parsedTeacherProfile = rawTeacherProfile ? JSON.parse(rawTeacherProfile) : null;
        const resolvedPhoto = resolveTeacherPhotoUri(
          parsedTeacherProfile?.photoUrl || parsedTeacherProfile?.photo || ''
        );

        if (active) {
          setTeacherPhotoUri(resolvedPhoto);
        }
      } catch {
        if (active) {
          setTeacherPhotoUri('');
        }
      }
    };

    void loadTeacherPhoto();

    return () => {
      active = false;
    };
  }, []);

  const navigateTo = (screenName: string, extraParams: Record<string, any> = {}) => {
    navigation.navigate(screenName, { ...routeParams, ...extraParams });
  };

  return (
    <View style={styles.footer}>
      <View style={styles.footerNav}>
        <Pressable style={styles.footerNavItem} onPress={() => navigation.goBack()}>
          <Image source={backArrowImage} style={styles.backIcon} resizeMode="contain" />
          <Text style={styles.footerNavLabel}>Back</Text>
        </Pressable>
        <Pressable style={styles.footerNavItem} onPress={() => navigateTo(homeRoute)}>
          <MaterialIcons name="home" size={22} color="#1F1F22" />
          <Text style={styles.footerNavLabel}>Home</Text>
        </Pressable>
        <Pressable
          style={styles.footerAddButton}
          onPress={() => navigateTo(addRoute)}
          accessibilityLabel="Open"
        >
          <MaterialIcons name="add" size={26} color="#FFFFFF" />
        </Pressable>
        <Pressable style={styles.footerNavItem} onPress={() => navigateTo(chatRoute)}>
          <MaterialIcons name="chat-bubble-outline" size={22} color="#1F1F22" />
          <Text style={styles.footerNavLabelMuted}>Chat</Text>
        </Pressable>
        <Pressable
          style={styles.footerNavItem}
          onPress={() =>
            navigateTo(profileRoute, { openProfilePanel: true })
          }
        >
          {teacherPhotoUri ? (
            <Image source={{ uri: teacherPhotoUri }} style={styles.footerProfilePhoto} resizeMode="cover" />
          ) : (
            <MaterialIcons name="person-outline" size={22} color="#1F1F22" />
          )}
          <Text style={styles.footerNavLabelMuted}>Profile</Text>
        </Pressable>
      </View>
      <View style={styles.footerBrandRow}>
        <Text style={styles.poweredBy}>Powered By</Text>
        <Image source={logoImage} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.homeIndicator} />
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    minHeight: 68,
    flexShrink: 0,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 0,
    backgroundColor: '#f6f6f7',
    borderTopWidth: 1,
    borderTopColor: '#ECECF0',
    elevation: 8,
  },
  footerNav: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  footerNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
  },
  footerProfilePhoto: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  footerNavLabel: {
    marginTop: 0,
    fontSize: 7,
    color: '#111111',
    fontWeight: '700',
  },
  footerNavLabelMuted: {
    marginTop: 0,
    fontSize: 7,
    color: '#B0B0B5',
    fontWeight: '700',
  },
  footerAddButton: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F14A40',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E53D33',
    marginBottom: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    marginBottom: 0,
  },
  homeIndicator: {
    alignSelf: 'center',
    width: 78,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#f13232ff',
    marginTop: -1,
    marginBottom: 0,
  },
  backIcon: {
    width: 22,
    height: 22,
  },
});

export default TeacherFooter;
