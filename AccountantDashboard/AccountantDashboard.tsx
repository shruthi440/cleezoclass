import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountantDashboard'>;

type AccountantProfile = {
  username: string;
  name: string;
  designation: string;
  userType: string;
  schoolCode: string;
};

type AmountRecord = {
  id: string;
  amount: number;
  billType: string;
  className?: string;
  section?: string;
  feeType?: string;
  note: string;
  reference: string;
  source: string;
  imageUri?: string;
  createdAt: string;
  paymentDate?: string;
  username?: string;
  designation?: string;
  userType?: string;
  schoolCode?: string;
  ocrText?: string;
  synced?: boolean;
};

const LOCAL_HISTORY_PREFIX = '@accountant_amount_history:';
const BILL_API_BASE = 'http://162.215.210.38:3010/api';
const SAVE_ENDPOINT = `${BILL_API_BASE}/uploadbill`;
const HISTORY_ENDPOINT = `${BILL_API_BASE}/bills`;

const emptyProfile: AccountantProfile = {
  username: '',
  name: '',
  designation: '',
  userType: '',
  schoolCode: '',
};

const normalizeMoney = (value: unknown) => {
  const raw = String(value ?? '')
    .replace(/[₹,\s]/g, '')
    .replace(/[^0-9.]/g, '');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const stringifyOcr = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const normalizeBillType = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Other';

const inferBillTypeFromText = (text: string) => {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('electricity') || lowerText.includes('power')) return 'Electricity';
  if (lowerText.includes('transport') || lowerText.includes('bus')) return 'Transport';
  if (lowerText.includes('furniture') || lowerText.includes('chair') || lowerText.includes('table')) return 'Furniture';
  if (lowerText.includes('sports') || lowerText.includes('football') || lowerText.includes('cricket')) return 'Sports';
  if (lowerText.includes('water') || lowerText.includes('aqua')) return 'Water';
  if (lowerText.includes('fuel') || lowerText.includes('petrol') || lowerText.includes('diesel')) return 'Fuel';
  if (lowerText.includes('stationery') || lowerText.includes('pen') || lowerText.includes('pencil')) return 'Stationery';
  return '';
};

const extractClassNameFromText = (text: string) => {
  const match = text.match(/(?:class\s*(?:name)?\s*[:\-]?\s*)([^\n\r|]+)/i);
  return match?.[1]?.trim() || '';
};

const extractSectionFromText = (text: string) => {
  const match = text.match(/(?:section\s*[:\-]?\s*)([^\n\r|]+)/i);
  return match?.[1]?.trim() || '';
};

const extractAmountFromText = (text: string) => {
  const normalized = text.replace(/[,\s]/g, '');
  const matches = normalized.match(/(?:amount(?:due)?|total|nettotal|grandtotal|rs\.?|inr)?[:\-]?(?:₹)?(\d+(?:\.\d{1,2})?)/i);
  return matches?.[1] ? String(Number(matches[1])) : '';
};

const normalizeImageMimeType = (mimeType?: string) => {
  const type = String(mimeType || '').toLowerCase();
  if (type.includes('heic') || type.includes('heif')) return 'image/jpeg';
  if (type.startsWith('image/')) return type;
  return 'image/jpeg';
};

const buildDataUri = (asset?: Asset) => {
  if (!asset?.base64) return '';
  return `data:${normalizeImageMimeType(asset.type)};base64,${asset.base64}`;
};

const readBase64FromUri = async (uri?: string) => {
  if (!uri) return null;
  try {
    return await RNFS.readFile(uri, 'base64');
  } catch {
    return null;
  }
};

const resolveBase64 = async (asset?: Asset) => {
  if (asset?.base64) return asset.base64;
  return readBase64FromUri(asset?.uri);
};

const AccountantDashboard: React.FC<Props> = ({ navigation }) => {
  const [profile, setProfile] = useState<AccountantProfile>(emptyProfile);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan');
  const [accessDenied, setAccessDenied] = useState(false);
  const [history, setHistory] = useState<AmountRecord[]>([]);
  const [billType, setBillType] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [receiptImageUri, setReceiptImageUri] = useState('');
  const [receiptImageDataUri, setReceiptImageDataUri] = useState('');
  const [extractingText, setExtractingText] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const localHistoryKey = useMemo(() => {
    const code = profile.schoolCode || 'default';
    return `${LOCAL_HISTORY_PREFIX}${code}`;
  }, [profile.schoolCode]);

  const loadProfile = useCallback(async () => {
    try {
      setLoadingProfile(true);
      const storedUserDetailsRaw = await AsyncStorage.getItem('userDetails');
      const storedUserDetails = storedUserDetailsRaw ? JSON.parse(storedUserDetailsRaw) : {};
      const storedUsername = await AsyncStorage.getItem('username');
      const storedName = await AsyncStorage.getItem('name');
      const storedDesignation = await AsyncStorage.getItem('designation');
      const storedUserType = await AsyncStorage.getItem('userType');
      const storedSchoolCode = await AsyncStorage.getItem('schoolCode');

      const nextProfile: AccountantProfile = {
        username:
          storedUserDetails.username ||
          storedUserDetails.user_name ||
          storedUsername ||
          '',
        name:
          storedUserDetails.name ||
          storedUserDetails.teacher_name ||
          storedName ||
          '',
        designation:
          storedUserDetails.designation ||
          storedDesignation ||
          storedUserDetails.role ||
          '',
        userType: String(storedUserDetails.userType || storedUserType || ''),
        schoolCode: String(storedUserDetails.schoolCode || storedSchoolCode || ''),
      };

      setProfile(nextProfile);
      setAccessDenied(
        !(nextProfile.userType === 'management' &&
          String(nextProfile.designation || '').toLowerCase().trim() === 'accountant')
      );
    } catch (error) {
      console.error('[AccountantDashboard] loadProfile error:', error);
      setAccessDenied(true);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const loadLocalHistory = useCallback(async (key: string) => {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const persistLocalHistory = useCallback(async (key: string, rows: AmountRecord[]) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(rows.slice(0, 100)));
    } catch (error) {
      console.error('[AccountantDashboard] persistLocalHistory error:', error);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!profile.schoolCode) return;
    try {
      setLoadingHistory(true);
      const response = await axios.get(`${HISTORY_ENDPOINT}/${profile.schoolCode}`, { timeout: 30000 });

      const serverRows = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data?.rows)
            ? response.data.rows
            : Array.isArray(response.data?.bills)
              ? response.data.bills
              : [];

      const mapped: AmountRecord[] = serverRows.map((row: any, index: number) => ({
        id: String(row.id ?? row.amount_id ?? row.payment_id ?? `${Date.now()}-${index}`),
        amount: Number(row.amount ?? row.total_amount ?? row.totalAmount ?? 0),
        billType: String(row.bill_type ?? row.billType ?? row.fee_type ?? row.feeType ?? row.type ?? 'other'),
        className: String(row.class_name ?? row.className ?? row.class ?? row.FeeClass ?? ''),
        section: String(row.section ?? row.sectionName ?? row.FeeSection ?? ''),
        feeType: String(row.fee_type ?? row.feeType ?? row.bill_type ?? row.billType ?? row.type ?? 'other'),
        note: String(row.note ?? row.remarks ?? row.description ?? ''),
        reference: String(row.reference ?? row.receipt_no ?? row.transaction_no ?? row.bill_no ?? row.id ?? ''),
        source: String(row.source ?? row.scanned_from ?? 'server'),
        imageUri: row.imageUri || row.image_url || row.photo_url || row.image_path || '',
        createdAt: String(row.createdAt ?? row.created_at ?? row.date ?? new Date().toISOString()),
        paymentDate: String(row.date ?? row.paid_date ?? row.payment_date ?? ''),
        username: row.username ? String(row.username) : profile.username,
        designation: row.designation ? String(row.designation) : profile.designation,
        userType: row.userType ? String(row.userType) : profile.userType,
        schoolCode: row.schoolCode ? String(row.schoolCode) : profile.schoolCode,
        ocrText: stringifyOcr(row.ocrText ?? row.ocr_text ?? row.raw_data ?? row.description ?? ''),
        synced: true,
      }));

      setHistory(mapped);
      await persistLocalHistory(localHistoryKey, mapped);
    } catch (error) {
      console.warn('[AccountantDashboard] server history load failed, using local cache', error);
      const localRows = await loadLocalHistory(localHistoryKey);
      setHistory(localRows);
    } finally {
      setLoadingHistory(false);
    }
  }, [loadLocalHistory, localHistoryKey, persistLocalHistory, profile.designation, profile.schoolCode, profile.userType, profile.username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile.schoolCode) return;
    loadHistory();
  }, [loadHistory, profile.schoolCode]);

  const handlePickedImage = useCallback(async (asset?: Asset) => {
    if (!asset) return;
    setReceiptImageUri(asset.uri || '');
    const base64 = await resolveBase64(asset);
    const dataUri = base64 ? `data:${normalizeImageMimeType(asset.type)};base64,${base64}` : buildDataUri(asset);
    setReceiptImageDataUri(dataUri);

    if (!dataUri) return;
    const storedSchoolCode = await AsyncStorage.getItem('schoolCode');
    const storedUserDetailsRaw = await AsyncStorage.getItem('userDetails');
    let storedUserDetails: Record<string, any> = {};
    if (storedUserDetailsRaw) {
      try {
        storedUserDetails = JSON.parse(storedUserDetailsRaw);
      } catch (parseError) {
        console.warn('[AccountantDashboard] Failed to parse userDetails during OCR lookup', parseError);
      }
    }
    const resolvedSchoolCode =
      profile.schoolCode ||
      storedSchoolCode ||
      String(storedUserDetails.schoolCode || '').trim();

    if (!resolvedSchoolCode) {
      console.warn('[AccountantDashboard] OCR skipped: missing schoolCode', {
        profileSchoolCode: profile.schoolCode,
        storedSchoolCode,
        userDetailsSchoolCode: storedUserDetails.schoolCode,
      });
      Alert.alert(
        'Missing school code',
        'We could not load the school code yet. Please wait a moment and try again.'
      );
      return;
    }

    try {
      setExtractingText(true);
      console.log('[AccountantDashboard] OCR request', {
        schoolCode: resolvedSchoolCode,
        imageLength: dataUri.length,
        hasImage: Boolean(dataUri),
      });
      const response = await axios.post(
        `${BILL_API_BASE}/extract-text`,
        { image: dataUri, schoolCode: resolvedSchoolCode },
        {
          timeout: 60000,
          params: { schoolCode: resolvedSchoolCode },
        }
      );

      console.log('[AccountantDashboard] OCR response', {
        status: response.status,
        keys: Object.keys(response.data || {}),
      });

      const extractedText = String(response.data?.text || response.data?.rawText || '');
      const extractedAmount = response.data?.amount ?? extractAmountFromText(extractedText);
      const extractedBillType =
        response.data?.billType
          ? normalizeBillType(response.data.billType)
          : response.data?.feeType
            ? normalizeBillType(response.data.feeType)
            : inferBillTypeFromText(extractedText);
      const extractedClassName =
        String(response.data?.className || response.data?.class_name || '').trim() ||
        extractClassNameFromText(extractedText);
      const extractedSection =
        String(response.data?.section || '').trim() ||
        extractSectionFromText(extractedText);

      if (extractedAmount !== null && extractedAmount !== undefined && String(extractedAmount).trim() !== '') {
        setAmount(String(extractedAmount));
      }
      if (extractedBillType) {
        setBillType(extractedBillType);
      }
      if (extractedClassName) {
        setClassName(extractedClassName);
      }
      if (extractedSection) {
        setSection(extractedSection);
      }

      if (!extractedText) {
        Alert.alert('Scan complete', 'Image attached, but no readable text was found.');
      }
    } catch (error) {
      const err = error as any;
      console.warn('[AccountantDashboard] OCR extraction failed:', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      Alert.alert(
        'Scan failed',
        err?.response?.data?.message ||
          err?.message ||
          'The image was attached, but OCR could not retrieve text from it. You can still type the values manually.'
      );
    } finally {
      setExtractingText(false);
    }
  }, []);

  const requestCameraPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;

    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
      title: 'Camera permission',
      message: 'Camera access is required to attach a receipt image.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });

    if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

    Alert.alert('Permission required', 'Please enable camera permission in app settings.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
    return false;
  }, []);

  const openCamera = useCallback(async () => {
    const granted = await requestCameraPermission();
    if (!granted) return;

    launchCamera(
      {
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.7,
        cameraType: 'back',
        saveToPhotos: false,
        maxWidth: 1600,
        maxHeight: 1600,
        assetRepresentationMode: 'compatible',
      },
      async response => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Camera error', response.errorMessage || 'Unable to open camera');
          return;
        }
        await handlePickedImage(response.assets?.[0]);
      }
    );
  }, [handlePickedImage, requestCameraPermission]);

  const openGallery = useCallback(() => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
        selectionLimit: 1,
        maxWidth: 1800,
        maxHeight: 1800,
        assetRepresentationMode: 'compatible',
      },
      async response => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Gallery error', response.errorMessage || 'Unable to open gallery');
          return;
        }
        await handlePickedImage(response.assets?.[0]);
      }
    );
  }, [handlePickedImage]);

  const saveToLocalCache = useCallback(
    async (record: AmountRecord) => {
      const current = await loadLocalHistory(localHistoryKey);
      const next = [record, ...current.filter(item => item.id !== record.id)];
      setHistory(next);
      await persistLocalHistory(localHistoryKey, next);
    },
    [loadLocalHistory, localHistoryKey, persistLocalHistory]
  );

  const currentReceipt = useMemo(
    () => ({
      billType: normalizeBillType(billType || 'other'),
      className: className.trim(),
      section: section.trim(),
      amount: normalizeMoney(amount) ?? 0,
      note: note.trim(),
      ocrText: `Class: ${className.trim()} | Section: ${section.trim()} | Fee Type: ${normalizeBillType(billType || 'other')} | Amount: ${normalizeMoney(amount) ?? 0}`,
    }),
    [amount, billType, className, section, note]
  );

  const buildReceiptHtml = useCallback(() => {
    const schoolName = profile.name || profile.schoolCode || 'School Name';
    const paidAmount = currentReceipt.amount;
    const dueAmount = 0;
    const escapeHtml = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const rows = [
      ['Class', currentReceipt.className || '-'],
      ['Section', currentReceipt.section || '-'],
      ['Fee Type', currentReceipt.billType],
      ['Note', currentReceipt.note || '-'],
    ];

    const rowMarkup = rows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:8px;border:1px solid #222;font-size:12px;font-weight:700;width:34%">${escapeHtml(label)}</td>
            <td style="padding:8px;border:1px solid #222;font-size:12px;">${escapeHtml(value || '-')}</td>
          </tr>`
      )
      .join('');

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
            .wrap { border: 1px solid #333; padding: 14px; }
            .title { text-align: center; font-size: 20px; font-weight: 800; margin: 0; }
            .subtitle { text-align: center; font-size: 11px; margin: 4px 0 14px; }
            .meta { margin-top: 12px; border-collapse: collapse; width: 100%; }
            .summary { display: flex; justify-content: space-between; margin-top: 16px; font-weight: 700; }
            .amount { font-size: 18px; }
            .note { margin-top: 16px; font-size: 11px; color: #555; text-align: center; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <h1 class="title">${schoolName}</h1>
            <div class="subtitle">ACCOUNTANT RECEIPT</div>
            <table class="meta">${rowMarkup}</table>
            <div class="summary">
              <div class="amount">Total Paid: ${formatINR(paidAmount)}</div>
              <div class="amount">Total Due: ${formatINR(dueAmount)}</div>
            </div>
    <div class="note">Entry Summary: ${escapeHtml(currentReceipt.ocrText || '')}</div>
          </div>
        </body>
      </html>
    `;
  }, [currentReceipt.amount, currentReceipt.billType, currentReceipt.className, currentReceipt.note, currentReceipt.ocrText, currentReceipt.section, profile.name, profile.schoolCode]);

  const exportReceiptPdf = useCallback(async () => {
    if (!profile.schoolCode) {
      Alert.alert('Missing profile', 'Please sign in again so we can export the receipt.');
      return;
    }

    try {
      const RNHTMLtoPDF = require('react-native-html-to-pdf').default;
      const file = await RNHTMLtoPDF.convert({
        html: buildReceiptHtml(),
        fileName: `Accountant_Receipt_${Date.now()}`,
        directory: 'Documents',
      });
      if (file?.filePath) {
        Alert.alert('Exported', `Receipt PDF saved to:\n${file.filePath}`);
      } else {
        Alert.alert('Exported', 'Receipt PDF was generated.');
      }
    } catch (error) {
      console.error('[AccountantDashboard] exportReceiptPdf error:', error);
      Alert.alert('Export failed', 'Unable to generate the receipt PDF.');
    }
  }, [buildReceiptHtml, profile.schoolCode]);

  const shareReceipt = useCallback(async () => {
    try {
      await Share.share({
        message: [
          'Accountant Receipt',
          `Bill Type: ${currentReceipt.billType}`,
          `Amount: ${formatINR(currentReceipt.amount)}`,
          `Class: ${currentReceipt.className || '-'}`,
          `Section: ${currentReceipt.section || '-'}`,
        ].join('\n'),
      });
    } catch (error) {
      console.error('[AccountantDashboard] shareReceipt error:', error);
    }
  }, [currentReceipt]);

  const handleSave = async () => {
    const amountValue = normalizeMoney(amount);
    if (amountValue === null || amountValue < 0) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }

    if (!className.trim() || !section.trim()) {
      Alert.alert('Validation', 'Please enter both class name and section.');
      return;
    }

    if (!String(billType || '').trim()) {
      Alert.alert('Validation', 'Please enter a fee type.');
      return;
    }

    if (!profile.schoolCode || !profile.username) {
      Alert.alert('Missing profile', 'Please sign in again so we can save the record.');
      return;
    }

    const record: AmountRecord = {
      id: `${Date.now()}`,
      amount: amountValue,
      billType: normalizeBillType(billType || 'other'),
      className: className.trim(),
      section: section.trim(),
      feeType: normalizeBillType(billType || 'other'),
      note: note.trim(),
      reference: '',
      source: receiptImageUri ? 'image-attached' : 'manual',
      createdAt: new Date().toISOString(),
      username: profile.username,
      designation: profile.designation,
      userType: profile.userType,
      schoolCode: profile.schoolCode,
      ocrText: `Class: ${className.trim()} | Section: ${section.trim()} | Fee Type: ${normalizeBillType(billType || 'other')} | Amount: ${amountValue}`,
      imageUri: receiptImageUri || undefined,
      synced: false,
    };

    try {
      setSaving(true);
      console.log('[AccountantDashboard] save start', {
        schoolCode: profile.schoolCode,
        username: profile.username,
        billType: record.feeType || record.billType || 'other',
        amount: record.amount,
        hasImage: Boolean(receiptImageDataUri),
        imageLength: receiptImageDataUri?.length || 0,
        className: record.className,
        section: record.section,
        noteLength: record.note.length,
      });
      await axios.post(
        SAVE_ENDPOINT,
        {
          schoolCode: profile.schoolCode,
          billType: record.feeType || record.billType || 'other',
          customBillType: record.feeType || record.billType || 'other',
          amount: record.amount,
          description: record.note,
          image: receiptImageDataUri || undefined,
        },
        { timeout: 30000 }
      );
      console.log('[AccountantDashboard] save success', {
        schoolCode: profile.schoolCode,
        billType: record.feeType || record.billType || 'other',
      });

      const savedRecord = { ...record, synced: true };
      await saveToLocalCache(savedRecord);
      Alert.alert('Saved', 'Amount saved successfully.');
      setAmount('');
      setNote('');
      setClassName('');
      setSection('');
      setBillType('');
      setReceiptImageUri('');
      setReceiptImageDataUri('');
      setShowPreviewModal(false);
      await loadHistory();
    } catch (error: any) {
      console.warn('[AccountantDashboard] server save failed', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      await saveToLocalCache(record);
      Alert.alert(
        'Saved locally',
        error?.response?.data?.message ||
          'The server could not be reached, so the amount was stored on this device for now.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([
      'username',
      'name',
      'designation',
      'userType',
      'schoolCode',
      'userDetails',
      'lastScreen',
    ]);
    navigation.reset({
      index: 0,
      routes: [{ name: 'TeacherLogin' }],
    });
  };

  const summaryCards = useMemo(
    () => [
      {
        title: 'Accountant',
        subtitle: profile.name || 'Signed in',
        footer: profile.designation || 'designation missing',
        background: '#D7E7CD',
      },
      {
        title: 'Saved Amounts',
        subtitle: String(history.length),
        footer: loadingHistory ? 'Loading history' : 'Ready to review',
        background: '#F0EE96',
      },
    ],
    [history.length, loadingHistory, profile.designation, profile.name]
  );

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1F3A5F" />
        </View>
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centered}>
          <View style={styles.accessCard}>
            <Text style={styles.accessTitle}>Access denied</Text>
            <Text style={styles.accessText}>
              This screen is for management users with the accountant designation.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleLogout}>
              <Text style={styles.primaryButtonText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Accountant Dashboard</Text>
            <Text style={styles.subtitle}>Enter fee details and save them to the income database.</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          {summaryCards.map(card => (
            <View key={card.title} style={[styles.summaryCard, { backgroundColor: card.background }]}>
              <Text style={styles.summaryTitle}>{card.title}</Text>
              <Text style={styles.summarySubtitle}>{card.subtitle}</Text>
              <Text style={styles.summaryFooter}>{card.footer}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'scan' && styles.tabButtonActive]}
            onPress={() => setActiveTab('scan')}
          >
            <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'scan' ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Fee Entry</Text>
            <Text style={styles.cardHint}>
                  Enter the class, section, fee type, and amount. Scanned text will try to fill the fields automatically.
                </Text>
              </View>
              <TouchableOpacity style={styles.previewButton} onPress={() => setShowPreviewModal(true)}>
                <Text style={styles.previewButtonText}>Open preview</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGrid}>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={openCamera}>
                  <Text style={styles.actionButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={openGallery}>
                  <Text style={styles.actionButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>Class Name</Text>
                <TextInput
                  style={styles.input}
                  value={className}
                  onChangeText={setClassName}
                  placeholder="Class 1 / Nursery / 7"
                  placeholderTextColor="#7C7C80"
                />
              </View>
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>Section</Text>
                <TextInput
                  style={styles.input}
                  value={section}
                  onChangeText={setSection}
                  placeholder="A / B / C"
                  placeholderTextColor="#7C7C80"
                />
              </View>
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>Fee Type</Text>
                <TextInput
                  style={styles.input}
                  value={billType}
                  onChangeText={setBillType}
                  placeholder="Electricity / Sports / Other"
                  placeholderTextColor="#7C7C80"
                />
              </View>
            </View>

            {receiptImageUri ? <Image source={{ uri: receiptImageUri }} style={styles.previewImage} /> : null}
            {extractingText ? <ActivityIndicator size="small" color="#1F3A5F" /> : null}

            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Amount"
              placeholderTextColor="#7C7C80"
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={note}
              onChangeText={setNote}
              placeholder="Note"
              placeholderTextColor="#7C7C80"
              multiline
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save to database'}</Text>
            </TouchableOpacity>

            {currentReceipt.ocrText ? (
              <View style={styles.ocrBox}>
                <Text style={styles.ocrLabel}>Entry summary</Text>
                <Text style={styles.ocrText}>{currentReceipt.ocrText}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.historyHeader}>
              <Text style={styles.cardTitle}>Saved records</Text>
              <TouchableOpacity onPress={loadHistory}>
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <ActivityIndicator size="small" color="#1F3A5F" />
            ) : history.length === 0 ? (
              <Text style={styles.emptyText}>No records saved yet.</Text>
            ) : (
              history.map(item => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyTopRow}>
                    <Text style={styles.historyAmount}>₹{item.amount.toFixed(2)}</Text>
                    <Text style={styles.historyDate}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.historyMeta}>
                    {item.className ? `${item.className} • ` : ''}
                    {item.section ? `${item.section} • ` : ''}
                    {item.feeType ? `${normalizeBillType(item.feeType)} • ` : item.billType ? `${normalizeBillType(item.billType)} • ` : ''}
                    {item.note || ''}
                  </Text>
                  <Text style={styles.historyMeta}>{item.source}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showPreviewModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTopRow}>
              <View style={styles.modalPill}>
                <Text style={styles.modalPillText}>Fee: {currentReceipt.billType}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowPreviewModal(false)}>
                <Text style={styles.closeButtonText}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewMetaCard}>
            <View style={styles.previewMetaRow}>
                  <View style={styles.previewMetaItem}>
                    <Text style={styles.previewMetaLabel}>Fee Type</Text>
                    <Text style={styles.previewMetaValue}>{currentReceipt.billType}</Text>
                  </View>
                  <View style={styles.previewMetaItem}>
                    <Text style={styles.previewMetaLabel}>Class</Text>
                    <Text style={styles.previewMetaValue}>{currentReceipt.className || '-'}</Text>
                  </View>
                  <View style={styles.previewMetaItem}>
                    <Text style={styles.previewMetaLabel}>Section</Text>
                    <Text style={styles.previewMetaValue}>{currentReceipt.section || '-'}</Text>
                  </View>
                  <View style={styles.previewMetaItem}>
                    <Text style={styles.previewMetaLabel}>Note</Text>
                    <Text style={styles.previewMetaValue}>{currentReceipt.note || '-'}</Text>
                </View>
              </View>
            </View>

            <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewScrollContent}>
              <View style={styles.receiptPaper}>
                <Text style={styles.receiptSchoolName}>{profile.name || 'School Name'}</Text>
                <Text style={styles.receiptTitle}>FEES RECEIPT</Text>

                <View style={styles.receiptTable}>
                  <View style={styles.receiptTableRow}>
                    <Text style={styles.receiptTableLabel}>Fee Type</Text>
                    <Text style={styles.receiptTableValue}>{currentReceipt.billType}</Text>
                  </View>
                  <View style={styles.receiptTableRow}>
                    <Text style={styles.receiptTableLabel}>Class</Text>
                    <Text style={styles.receiptTableValue}>{currentReceipt.className || '-'}</Text>
                  </View>
                  <View style={styles.receiptTableRow}>
                    <Text style={styles.receiptTableLabel}>Section</Text>
                    <Text style={styles.receiptTableValue}>{currentReceipt.section || '-'}</Text>
                  </View>
                  <View style={styles.receiptTableRow}>
                    <Text style={styles.receiptTableLabel}>Note</Text>
                    <Text style={styles.receiptTableValue}>{currentReceipt.note || '-'}</Text>
                  </View>
                </View>

                <View style={styles.receiptAmountPanel}>
                  <Text style={styles.receiptAmountLabel}>Amount</Text>
                  <Text style={styles.receiptAmountValue}>{formatINR(currentReceipt.amount)}</Text>
                </View>

                <View style={styles.receiptActionsRow}>
                  <TouchableOpacity style={styles.modalActionButton} onPress={shareReceipt}>
                    <Text style={styles.modalActionButtonText}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalActionButton} onPress={exportReceiptPdf}>
                    <Text style={styles.modalActionButtonText}>Print</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.ocrBox}>
                  <Text style={styles.ocrLabel}>Entry summary</Text>
                  <Text style={styles.ocrText}>
                    {currentReceipt.ocrText || 'No entry summary yet.'}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accessTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#101828',
  },
  accessText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#475467',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  brand: {
    fontSize: 28,
    fontWeight: '900',
    color: '#101828',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#475467',
    maxWidth: 260,
  },
  logoutButton: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    minHeight: 114,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#101828',
  },
  summarySubtitle: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '900',
    color: '#101828',
  },
  summaryFooter: {
    marginTop: 8,
    fontSize: 12,
    color: '#344054',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  tabText: {
    fontWeight: '700',
    color: '#344054',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101828',
  },
  cardHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#475467',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonText: {
    fontWeight: '800',
    color: '#101828',
  },
  previewButton: {
    backgroundColor: '#101828',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  fieldGrid: {
    gap: 10,
    marginBottom: 6,
  },
  fieldItem: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#344054',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginBottom: 14,
    backgroundColor: '#E5E7EB',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#101828',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#1F3A5F',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  ocrBox: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ocrLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#344054',
    marginBottom: 6,
  },
  ocrText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475467',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.58)',
    padding: 16,
    justifyContent: 'center',
  },
  modalSheet: {
    backgroundColor: '#F8FAFC',
    borderRadius: 26,
    padding: 16,
    maxHeight: '92%',
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  modalPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#101828',
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FF251A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  previewMetaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    padding: 14,
    marginBottom: 14,
  },
  previewMetaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  previewMetaItem: {
    flexGrow: 1,
    minWidth: '30%',
  },
  previewMetaLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: '#667085',
    fontWeight: '700',
  },
  previewMetaValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#101828',
  },
  previewScroll: {
    maxHeight: 560,
  },
  previewScrollContent: {
    paddingBottom: 8,
  },
  receiptPaper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    padding: 16,
  },
  receiptSchoolName: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
    color: '#1D4ED8',
  },
  receiptTitle: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
    color: '#111827',
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#111827',
    paddingVertical: 6,
  },
  receiptTable: {
    borderWidth: 1,
    borderColor: '#111827',
  },
  receiptTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  receiptTableLabel: {
    width: '35%',
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  receiptTableValue: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    color: '#111827',
  },
  receiptAmountPanel: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptAmountLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#344054',
  },
  receiptAmountValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#101828',
  },
  receiptActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  modalActionButton: {
    flex: 1,
    backgroundColor: '#101828',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F3A5F',
  },
  emptyText: {
    fontSize: 13,
    color: '#667085',
  },
  historyItem: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 14,
    marginBottom: 12,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#101828',
  },
  historyDate: {
    fontSize: 11,
    color: '#667085',
  },
  historyMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#475467',
  },
});

export default AccountantDashboard;
