import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';

const CHIEF_UPLOAD_BASE = 'https://cleezoclass.com:4000/CRM/public/uploads';

const decodeBase64Text = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const atobFn = (globalThis as any).atob;
    if (typeof atobFn === 'function') return atobFn(raw);
  } catch {}
  try {
    const bufferCtor = (globalThis as any).Buffer;
    if (bufferCtor?.from) return bufferCtor.from(raw, 'base64').toString('utf8');
  } catch {}
  return '';
};

const resolveChiefPhotoUri = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  const buildUploadUrl = (path: string) => {
    const cleanPath = String(path || '').trim().replace(/^\/+/, '');
    if (!cleanPath) return CHIEF_UPLOAD_BASE;
    const relativePath = cleanPath
      .replace(/^CRM\/public\/uploads\/?/i, '')
      .replace(/^uploads\/?/i, '')
      .replace(/^\/+/, '');
    return `${CHIEF_UPLOAD_BASE}/${relativePath}`;
  };

  if (raw.includes('CRM/public/uploads') || raw.startsWith('/uploads/') || raw.startsWith('uploads/')) {
    return buildUploadUrl(raw);
  }

  if (raw.startsWith('L3VwbG9hZHMv') || raw.startsWith('dXBsb2Fkcy8')) {
    const decodedPath = String(decodeBase64Text(raw) || '').trim();
    if (decodedPath.includes('CRM/public/uploads') || decodedPath.startsWith('/uploads/') || decodedPath.startsWith('uploads/')) {
      return buildUploadUrl(decodedPath);
    }
    if (decodedPath.startsWith('http://') || decodedPath.startsWith('https://')) return decodedPath;
  }

  return raw;
};

const ChiefFooterProfile: React.FC = () => {
  const [photoUri, setPhotoUri] = useState('');

  useEffect(() => {
    const loadPhoto = async () => {
      try {
        const [
          storedUserDetailsRaw,
          storedCurrentUserRaw,
          storedCurrentChiefRaw,
          storedPhotoUrl,
          storedPhoto,
        ] = await Promise.all([
          AsyncStorage.getItem('userDetails'),
          AsyncStorage.getItem('currentUser'),
          AsyncStorage.getItem('currentChief'),
          AsyncStorage.getItem('photoUrl'),
          AsyncStorage.getItem('photo'),
        ]);

        const storedUserDetails = storedUserDetailsRaw ? JSON.parse(storedUserDetailsRaw) : {};
        const storedCurrentUser = storedCurrentUserRaw ? JSON.parse(storedCurrentUserRaw) : {};
        const storedCurrentChief = storedCurrentChiefRaw ? JSON.parse(storedCurrentChiefRaw) : {};
        console.log('[ChiefFooterProfile] raw storage snapshot', {
          hasUserDetails: Boolean(storedUserDetailsRaw),
          hasCurrentUser: Boolean(storedCurrentUserRaw),
          hasCurrentChief: Boolean(storedCurrentChiefRaw),
          storedPhotoUrl: storedPhotoUrl || null,
          storedPhoto: storedPhoto || null,
          userDetailsKeys: Object.keys(storedUserDetails || {}),
          currentUserKeys: Object.keys(storedCurrentUser || {}),
          currentChiefKeys: Object.keys(storedCurrentChief || {}),
        });

        const storedResolved = resolveChiefPhotoUri(
          storedUserDetails.photoUrl ||
            storedUserDetails.photo ||
            storedUserDetails.profileImage ||
            storedUserDetails.profile_photo ||
            storedUserDetails.profilePhoto ||
            storedUserDetails.photo_path ||
            storedUserDetails.image ||
            storedUserDetails.imageUrl ||
            storedUserDetails.image_url ||
            storedUserDetails.picture ||
            storedUserDetails.pic ||
            storedUserDetails.avatar ||
            storedUserDetails.avatarUrl ||
            storedCurrentUser.photoUrl ||
            storedCurrentUser.photo ||
            storedCurrentUser.profileImage ||
            storedCurrentUser.profile_photo ||
            storedCurrentUser.image ||
            storedCurrentUser.imageUrl ||
            storedCurrentUser.image_url ||
            storedCurrentUser.picture ||
            storedCurrentUser.avatar ||
            storedCurrentUser.avatarUrl ||
            storedCurrentChief.photoUrl ||
            storedCurrentChief.photo ||
            storedCurrentChief.profileImage ||
            storedCurrentChief.profile_photo ||
            storedCurrentChief.image ||
            storedCurrentChief.imageUrl ||
            storedCurrentChief.image_url ||
            storedCurrentChief.picture ||
            storedCurrentChief.avatar ||
            storedCurrentChief.avatarUrl ||
            storedPhotoUrl ||
            storedPhoto ||
            '',
        );
        if (storedResolved) {
          console.log('[ChiefFooterProfile] resolved photo uri from storage', {
            resolved: storedResolved || null,
          });
          setPhotoUri(storedResolved);
          return;
        }

        const storedUsername =
          String(storedUserDetails.username || storedCurrentUser.username || storedCurrentChief.username || (await AsyncStorage.getItem('username')) || '').trim();
        const storedSchoolCode =
          String(storedUserDetails.schoolCode || storedCurrentUser.schoolCode || storedCurrentChief.schoolCode || (await AsyncStorage.getItem('schoolCode')) || '').trim();

        console.log('[ChiefFooterProfile] storage photo missing, trying API', {
          storedUsername: storedUsername || null,
          storedSchoolCode: storedSchoolCode || null,
        });

        if (!storedUsername || !storedSchoolCode) {
          setPhotoUri('');
          return;
        }

        const response = await axios.get(
          `https://cleezoclass.com:4000/api/api/user-info/${encodeURIComponent(storedUsername)}?schoolCode=${encodeURIComponent(storedSchoolCode)}`,
        );
        const apiPhoto = resolveChiefPhotoUri(
          response?.data?.photo ||
            response?.data?.photoUrl ||
            response?.data?.profileImage ||
            response?.data?.avatar ||
            response?.data?.avatarUrl ||
            '',
        );
        console.log('[ChiefFooterProfile] user-info response', {
          hasData: Boolean(response?.data),
          apiKeys: response?.data ? Object.keys(response.data) : [],
          apiPhoto: apiPhoto || null,
        });
        setPhotoUri(apiPhoto);
      } catch {
        console.log('[ChiefFooterProfile] failed to load chief photo');
        setPhotoUri('');
      }
    };

    void loadPhoto();
  }, []);

  if (!photoUri) {
    return <Ionicons name="person-outline" size={18} color="#B0B0B5" />;
  }

  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, overflow: 'hidden' }}>
      <Image source={{ uri: photoUri }} style={{ width: 22, height: 22, borderRadius: 11 }} resizeMode="cover" />
    </View>
  );
};

export default ChiefFooterProfile;
