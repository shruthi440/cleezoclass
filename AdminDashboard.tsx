import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import { createAppStyles } from './App.styles';

type IconKind = 'material' | 'fontawesome';

type AdminDashboardProps = {
  navigation?: never;
  route?: never;
};

interface TeacherRequest {
  id: number;
  teacher_name: string;
  class: string;
  request_date: string;
  address_request: number;
  reason: string;
  status: string;
}

interface PendingUpload {
  upload_id: number;
  name_of_event: string;
  uploader_name: string;
  uploader_designation: string;
  mime_type: string;
  attached_file_base64?: string | null;
  created_at?: string;
}

interface LeaveRequest {
  id: number;
  teacher_name?: string;
  reason?: string;
  leave_start_date?: string;
  leave_end_date?: string;
  status?: string;
  designation?: string;
  teacher_id?: number | string;
}

const API_BASE = 'http://162.215.210.38:3010/api';
const heroImage: ImageSourcePropType = require('./assets/dashboard.png');
const logoImage: ImageSourcePropType = require('./assets/Cleezo.png');

const topChips = ['Requests', 'Uploads', 'Leave'];
const backArrowImage: ImageSourcePropType = require('./assets/Arrow.png');

const renderIcon = (kind: IconKind, name: string, color: string, size: number) => {
  if (kind === 'fontawesome') {
    return <FontAwesome name={name} size={size} color={color} />;
  }
  return <MaterialIcons name={name} size={size} color={color} />;
};

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const styles = createAppStyles({ phoneWidth, phoneHeight });
  const cardHeight = Math.max(300, Math.floor(phoneHeight * 0.48));
  const innerListMaxHeight = Math.max(200, Math.floor(phoneHeight * 0.3));
  const scrollRef = useRef<ScrollView | null>(null);
  const modulePanelOffset = useRef(0);

  const [schoolCode, setSchoolCode] = useState('CLEEZOCLASS');
  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingUploadId, setProcessingUploadId] = useState<number | null>(null);
  const [processingLeaveId, setProcessingLeaveId] = useState<number | null>(null);
  const [requestLoadError, setRequestLoadError] = useState('');
  const [leaveLoadError, setLeaveLoadError] = useState('');
  const [pendingLoadError, setPendingLoadError] = useState('');
  const [selectedChip, setSelectedChip] = useState<'Overview' | 'Requests' | 'Uploads' | 'Leave'>('Requests');
  const [showAdminDetails, setShowAdminDetails] = useState(false);
  const [adminProfile, setAdminProfile] = useState({
    username: '',
    name: '',
    designation: '',
    userType: '',
    schoolCode: '',
  });

  // Load school code from AsyncStorage
  const loadSchoolCode = async () => {
    const code = await AsyncStorage.getItem('schoolCode');
    if (code) setSchoolCode(code);
  };

  // Load admin profile from AsyncStorage
  const loadAdminProfile = async () => {
    try {
      const storedUserDetailsRaw = await AsyncStorage.getItem('userDetails');
      const storedUserDetails = storedUserDetailsRaw ? JSON.parse(storedUserDetailsRaw) : {};
      const storedUsername = await AsyncStorage.getItem('username');
      const storedName = await AsyncStorage.getItem('name');
      const storedDesignation = await AsyncStorage.getItem('designation');
      const storedUserType = await AsyncStorage.getItem('userType');
      const storedSchoolCode = await AsyncStorage.getItem('schoolCode');

      setAdminProfile({
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
      });
    } catch (error) {
      console.error('[AdminDashboard] loadAdminProfile error:', error);
    }
  };

  // Fetch teacher requests
  const fetchRequests = async (code: string) => {
    try {
      const res = await axios.get(`${API_BASE}/admin/requests`, { params: { schoolCode: code } });
      console.log('[AdminDashboard] fetchRequests response:', res.data);
      setRequests(Array.isArray(res.data) ? res.data : []);
      setRequestLoadError('');
    } catch (err: any) {
      console.log('[AdminDashboard] fetchRequests error:', err?.response?.data || err?.message);
      setRequests([]);
      setRequestLoadError('Teacher requests could not be loaded.');
    }
  };

  // Fetch pending uploads
  const fetchPendingUploads = async (code: string) => {
    try {
      const res = await axios.get(`${API_BASE}/get-pending-uploads`, { params: { schoolCode: code } });
      console.log('[AdminDashboard] fetchPendingUploads response:', res.data);
      setPendingUploads(Array.isArray(res.data?.pendingUploads) ? res.data.pendingUploads : []);
      setPendingLoadError('');
    } catch (err: any) {
      console.log('[AdminDashboard] fetchPendingUploads error:', err?.response?.data || err?.message);
      setPendingUploads([]);
      setPendingLoadError('Pending uploads could not be loaded.');
    }
  };

  // Fetch leave requests
  const fetchLeaves = async (code: string) => {
    try {
      const res = await axios.get(`${API_BASE}/leave/pending`, { params: { schoolCode: code } });
      console.log('[AdminDashboard] fetchLeaves response:', res.data);
      setLeaves(Array.isArray(res.data) ? res.data : []);
      setLeaveLoadError('');
    } catch (err: any) {
      console.log('[AdminDashboard] fetchLeaves error:', err?.response?.data || err?.message);
      setLeaves([]);
      setLeaveLoadError('Leave approvals could not be loaded.');
    }
  };

  // Load dashboard data
  const loadDashboard = async () => {
    setLoading(true);
    const code = (await AsyncStorage.getItem('schoolCode')) || schoolCode;
    if (code) setSchoolCode(code);

    try {
      await Promise.allSettled([
        fetchRequests(code || schoolCode),
        fetchPendingUploads(code || schoolCode),
        fetchLeaves(code || schoolCode),
      ]);
    } catch (error) {
      console.error('[AdminDashboard] loadDashboard error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  // Load initial data
  useEffect(() => {
    loadSchoolCode();
    loadAdminProfile();
  }, []);

  // Reload data when screen is focused
  useEffect(() => {
    if (!isFocused) return;
    loadDashboard();
  }, [isFocused]);

  // Handle request approval/rejection
  const handleRequestAction = async (requestId: number, action: 'approved' | 'rejected') => {
    try {
      const res = await axios.post(`${API_BASE}/admin/request/update`, {
        schoolCode,
        requestId,
        action,
      });
      Alert.alert('Success', res.data?.message || 'Updated successfully');
      await loadDashboard();
    } catch (error) {
      console.error('[AdminDashboard] handleRequestAction error:', error);
      Alert.alert('Error', 'Failed to update request');
    }
  };

  // Handle upload approval/rejection
  const handleUploadAction = async (uploadId: number, action: 'approved' | 'rejected') => {
    try {
      setProcessingUploadId(uploadId);
      const res = await axios.post(`${API_BASE}/approve-upload`, {
        upload_id: uploadId,
        action,
        schoolCode,
      });
      Alert.alert('Success', res.data?.message || 'Action completed');
      await loadDashboard();
    } catch (error) {
      console.error('[AdminDashboard] handleUploadAction error:', error);
      Alert.alert('Error', 'Failed to process upload');
    } finally {
      setProcessingUploadId(null);
    }
  };

  // Handle leave approval/rejection
  const handleLeaveAction = async (leaveId: number, action: 'approved' | 'rejected') => {
    try {
      setProcessingLeaveId(leaveId);
      const res = await axios.post(`${API_BASE}/leave/update-status`, {
        leaveId,
        status: action,
        schoolCode,
      });
      Alert.alert('Success', res.data?.message || 'Leave updated successfully');
      await loadDashboard();
    } catch (error: any) {
      console.error('[AdminDashboard] handleLeaveAction error:', error?.response?.data || error?.message);
      Alert.alert('Error', 'Failed to update leave request');
    } finally {
      setProcessingLeaveId(null);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      setShowAdminDetails(false);
      await AsyncStorage.multiRemove([
        'userType',
        'username',
        'name',
        'schoolCode',
        'designation',
        'lastScreen',
        'userDetails',
        'fcmToken',
      ]);
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    } catch (error) {
      console.error('[AdminDashboard] Logout failed:', error);
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
    }
  };

  // Overview cards data
  const overviewCards = useMemo(
    () => [
      {
        title: String(requests.length),
        subtitle: 'Teacher Requests',
        footer: requests.some(item => item.status === 'pending') ? 'Pending approval' : 'All reviewed',
        icon: 'assignment',
        kind: 'material' as const,
        background: '#D7E7CD',
      },
      {
        title: String(pendingUploads.length),
        subtitle: 'Media Uploads',
        footer: pendingUploads.length ? 'Awaiting review' : 'All clear',
        icon: 'photo-library',
        kind: 'material' as const,
        background: '#F0EE96',
      },
      {
        title: String(leaves.length),
        subtitle: 'Leave Approvals',
        footer: leaves.some(item => String(item.status || '').toLowerCase() === 'pending')
          ? 'Needs attention'
          : 'All reviewed',
        icon: 'assignment',
        kind: 'material' as const,
        background: '#D7E7CD',
      },
    ],
    [leaves, pendingUploads.length, requests]
  );

  const pendingRequests = requests.filter(item => item.status === 'pending');
  const latestRequests = useMemo(() => requests, [requests]);
  const latestUploads = useMemo(() => pendingUploads, [pendingUploads]);
  const latestLeaves = useMemo(() => leaves, [leaves]);

  // Handle chip selection
  const selectChip = (chip: 'Overview' | 'Requests' | 'Uploads' | 'Leave') => {
    setSelectedChip(chip);
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, modulePanelOffset.current - 12),
        animated: true,
      });
    }, 60);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.phoneFrame}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#000"
            />
          }
        >
          <View style={styles.toolbar}>
            <View style={styles.toolbarSpacer} />
            <Pressable  onPress={loadDashboard}>
              <MaterialIcons name="refresh" size={18} color="#333" />
            </Pressable>
           
          </View>

          <View style={styles.chipStickyHeader}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              {topChips.map((chip, index) => {
                const active = selectedChip === chip;
                return (
                  <Pressable
                    key={chip}
                    hitSlop={8}
                    onPress={() => selectChip(chip as typeof selectedChip)}
                    style={[
                      styles.chip,
                      index !== topChips.length - 1 && styles.chipSpacing,
                      active ? styles.chipActive : styles.chipInactive,
                    ]}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                      {chip}
                    </Text>
                  </Pressable>
                  
                );
              })}
                 <Pressable style={[styles.chip]}  onPress={loadDashboard}>
              <MaterialIcons name="refresh" size={18} color="#333" />
            </Pressable>
            </ScrollView>
          </View>

          <View style={styles.homeSection}>
            <View style={styles.heroCard}>
              <View style={styles.heroGlow} />
              <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
            </View>

            <Text style={styles.sectionTitle}>Admin Dashboard</Text>

     
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusCardsRow}>
              {overviewCards.map((card, index) => (
                <View
                  key={card.subtitle}
                  style={[
                    styles.statusCard,
                    index === 0 ? styles.statusCardLeft : styles.statusCardRight,
                    { backgroundColor: card.background },
                  ]}
                >
                  <View style={local.statusCardText}>
                    <Text style={local.statusNumber}>{card.title}</Text>
                    <Text style={local.statusSubtitle}>{card.subtitle}</Text>
                    <Text style={local.statusFooter}>{card.footer}</Text>
                  </View>
                  <View style={local.statusIconWrap}>
                    {renderIcon(card.kind, card.icon, '#4C4C4C', 28)}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View
            style={styles.modulePanel}
            onLayout={event => {
              modulePanelOffset.current = event.nativeEvent.layout.y;
            }}
          >
            {selectedChip === 'Overview' && (
              <View style={[local.sectionCard, { minHeight: Math.floor(phoneHeight * 0.24) }]}>
                <Text style={local.sectionCardTitle}>Overview</Text>
                <Text style={local.sectionCardText}>
                  Review the latest teacher requests and media uploads from one place.
                </Text>
                <View style={local.smallSummaryRow}>
                  <View style={local.smallSummaryPill}>
                    <Text style={local.smallSummaryValue}>{pendingRequests.length}</Text>
                    <Text style={local.smallSummaryLabel}>Pending Requests</Text>
                  </View>
                  <View style={local.smallSummaryPill}>
                    <Text style={local.smallSummaryValue}>{pendingUploads.length}</Text>
                    <Text style={local.smallSummaryLabel}>Pending Uploads</Text>
                  </View>
                </View>
              </View>
            )}

            {selectedChip === 'Requests' && (
              <View style={local.cardStack}>
                <View style={[local.sectionCard, { minHeight: cardHeight }]}>
                  <Text style={local.sectionCardTitle}>Teacher Requests ({requests.length})</Text>
                  {!!requestLoadError && <Text style={local.errorText}>{requestLoadError}</Text>}
                  {latestRequests.length === 0 ? (
                    <Text style={local.emptyText}>No requests found.</Text>
                  ) : (
                    <ScrollView
                      style={[local.innerScroll, { maxHeight: innerListMaxHeight }]}
                      contentContainerStyle={local.innerScrollContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {latestRequests.map(item => (
                        <View key={item.id} style={local.listCard}>
                          <Text style={local.itemTitle}>{item.teacher_name}</Text>
                          <Text style={local.itemMeta}>Class: {item.class}</Text>
                          <Text style={local.itemMeta}>Date: {item.request_date}</Text>
                          {item.reason ? <Text style={local.itemMeta}>Reason: {item.reason}</Text> : null}
                          <Text style={local.itemMeta}>Status: {item.status}</Text>

                          {item.status === 'pending' && (
                            <View style={local.actionRow}>
                              <TouchableOpacity
                                style={[local.actionBtn, local.approveBtn]}
                                onPress={() => handleRequestAction(item.id, 'approved')}
                              >
                                <Text style={local.actionText}>Approve</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[local.actionBtn, local.rejectBtn]}
                                onPress={() => handleRequestAction(item.id, 'rejected')}
                              >
                                <Text style={local.actionText}>Reject</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={[local.sectionCard, { minHeight: cardHeight }]}>
                  <Text style={local.sectionCardTitle}>Media Uploads ({pendingUploads.length})</Text>
                  {!!pendingLoadError && <Text style={local.errorText}>{pendingLoadError}</Text>}
                  {latestUploads.length === 0 ? (
                    <Text style={local.emptyText}>No pending uploads.</Text>
                  ) : (
                    <ScrollView
                      style={[local.innerScroll, { maxHeight: Math.max(180, Math.floor(phoneHeight * 0.28)) }]}
                      contentContainerStyle={local.innerScrollContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {latestUploads.map(item => (
                        <View key={item.upload_id} style={local.listCard}>
                          <Text style={local.itemTitle}>{item.name_of_event || 'Event Upload'}</Text>
                          <Text style={local.itemMeta}>
                            By: {item.uploader_name} ({item.uploader_designation})
                          </Text>
                          <Text style={local.itemMeta}>Type: {item.mime_type || 'Unknown'}</Text>
                          {item.created_at ? (
                            <Text style={local.itemMeta}>Date: {new Date(item.created_at).toLocaleString()}</Text>
                          ) : null}

                          {item.mime_type?.startsWith('image/') && item.attached_file_base64 ? (
                            <Image
                              source={{ uri: `data:${item.mime_type};base64,${item.attached_file_base64}` }}
                              style={local.preview}
                            />
                          ) : null}

                          <View style={local.actionRow}>
                            <TouchableOpacity
                              style={[local.actionBtn, local.approveBtn]}
                              disabled={processingUploadId === item.upload_id}
                              onPress={() => handleUploadAction(item.upload_id, 'approved')}
                            >
                              <Text style={local.actionText}>Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[local.actionBtn, local.rejectBtn]}
                              disabled={processingUploadId === item.upload_id}
                              onPress={() => handleUploadAction(item.upload_id, 'rejected')}
                            >
                              <Text style={local.actionText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={[local.sectionCard, { minHeight: cardHeight }]}>
                  <Text style={local.sectionCardTitle}>Leave Approvals ({leaves.length})</Text>
                  {!!leaveLoadError && <Text style={local.errorText}>{leaveLoadError}</Text>}
                  {latestLeaves.length === 0 ? (
                    <Text style={local.emptyText}>No leave approvals found.</Text>
                  ) : (
                    <ScrollView
                      style={[local.innerScroll, { maxHeight: innerListMaxHeight }]}
                      contentContainerStyle={local.innerScrollContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                    >
                      {latestLeaves.map(item => {
                        const status = String(item.status || 'pending').toLowerCase();
                        const start = item.leave_start_date ? new Date(item.leave_start_date) : null;
                        const end = item.leave_end_date ? new Date(item.leave_end_date) : null;
                        const isPending = status === 'pending';

                        return (
                          <View key={item.id} style={local.listCard}>
                            <Text style={local.itemTitle}>{item.teacher_name || 'Unknown Teacher'}</Text>
                            <Text style={local.itemMeta}>Designation: {item.designation || '-'}</Text>
                            <Text style={local.itemMeta}>Reason: {item.reason || '-'}</Text>
                            <Text style={local.itemMeta}>
                              Date: {start ? start.toLocaleDateString() : '-'} to {end ? end.toLocaleDateString() : '-'}
                            </Text>
                            <Text style={local.itemMeta}>Status: {item.status || 'pending'}</Text>

                            {isPending && (
                              <View style={local.actionRow}>
                                <TouchableOpacity
                                  style={[local.actionBtn, local.approveBtn]}
                                  disabled={processingLeaveId === item.id}
                                  onPress={() => handleLeaveAction(item.id, 'approved')}
                                >
                                  <Text style={local.actionText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[local.actionBtn, local.rejectBtn]}
                                  disabled={processingLeaveId === item.id}
                                  onPress={() => handleLeaveAction(item.id, 'rejected')}
                                >
                                  <Text style={local.actionText}>Reject</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </View>
            )}

            {selectedChip === 'Leave' && (
              <View style={[local.sectionCard, { minHeight: cardHeight }]}>
                <Text style={local.sectionCardTitle}>Leave Approvals ({leaves.length})</Text>
                {!!leaveLoadError && <Text style={local.errorText}>{leaveLoadError}</Text>}
                {latestLeaves.length === 0 ? (
                  <Text style={local.emptyText}>No leave approvals found.</Text>
                ) : (
                  <ScrollView
                    style={[local.innerScroll, { maxHeight: innerListMaxHeight }]}
                    contentContainerStyle={local.innerScrollContent}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {latestLeaves.map(item => {
                      const status = String(item.status || 'pending').toLowerCase();
                      const start = item.leave_start_date ? new Date(item.leave_start_date) : null;
                      const end = item.leave_end_date ? new Date(item.leave_end_date) : null;
                      const isPending = status === 'pending';

                      return (
                        <View key={item.id} style={local.listCard}>
                          <Text style={local.itemTitle}>{item.teacher_name || 'Unknown Teacher'}</Text>
                          <Text style={local.itemMeta}>Designation: {item.designation || '-'}</Text>
                          <Text style={local.itemMeta}>Reason: {item.reason || '-'}</Text>
                          <Text style={local.itemMeta}>
                            Date: {start ? start.toLocaleDateString() : '-'} to {end ? end.toLocaleDateString() : '-'}
                          </Text>
                          <Text style={local.itemMeta}>Status: {item.status || 'pending'}</Text>

                          {isPending && (
                            <View style={local.actionRow}>
                              <TouchableOpacity
                                style={[local.actionBtn, local.approveBtn]}
                                disabled={processingLeaveId === item.id}
                                onPress={() => handleLeaveAction(item.id, 'approved')}
                              >
                                <Text style={local.actionText}>Approve</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[local.actionBtn, local.rejectBtn]}
                                disabled={processingLeaveId === item.id}
                                onPress={() => handleLeaveAction(item.id, 'rejected')}
                              >
                                <Text style={local.actionText}>Reject</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {selectedChip === 'Uploads' && (
              <View style={[local.sectionCard, { minHeight: cardHeight }]}>
                <Text style={local.sectionCardTitle}>Pending Media Uploads ({pendingUploads.length})</Text>
                {!!pendingLoadError && <Text style={local.errorText}>{pendingLoadError}</Text>}
                {latestUploads.length === 0 ? (
                  <Text style={local.emptyText}>No pending uploads.</Text>
                ) : (
                  <ScrollView
                    style={[local.innerScroll, { maxHeight: innerListMaxHeight }]}
                    contentContainerStyle={local.innerScrollContent}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {latestUploads.map(item => (
                      <View key={item.upload_id} style={local.listCard}>
                        <Text style={local.itemTitle}>{item.name_of_event || 'Event Upload'}</Text>
                        <Text style={local.itemMeta}>
                          By: {item.uploader_name} ({item.uploader_designation})
                        </Text>
                        <Text style={local.itemMeta}>Type: {item.mime_type || 'Unknown'}</Text>
                        {item.created_at ? (
                          <Text style={local.itemMeta}>Date: {new Date(item.created_at).toLocaleString()}</Text>
                        ) : null}

                        {item.mime_type?.startsWith('image/') && item.attached_file_base64 ? (
                          <Image
                            source={{ uri: `data:${item.mime_type};base64,${item.attached_file_base64}` }}
                            style={local.preview}
                          />
                        ) : null}

                        <View style={local.actionRow}>
                          <TouchableOpacity
                            style={[local.actionBtn, local.approveBtn]}
                            disabled={processingUploadId === item.upload_id}
                            onPress={() => handleUploadAction(item.upload_id, 'approved')}
                          >
                            <Text style={local.actionText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[local.actionBtn, local.rejectBtn]}
                            disabled={processingUploadId === item.upload_id}
                            onPress={() => handleUploadAction(item.upload_id, 'rejected')}
                          >
                            <Text style={local.actionText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Admin Details Popup */}
        {showAdminDetails && (
          <View style={styles.overlay}>
            <View style={styles.teacherPopupCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.teacherHeaderRow}>
                  <View style={styles.teacherAvatar}>
                    <Text style={styles.teacherAvatarText}>
                      {(adminProfile.name || adminProfile.username || 'A')
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.teacherHeaderText}>
                    <Text style={styles.teacherTitle}>Admin Details</Text>
                    <Text style={styles.teacherSubtitle}>
                      {adminProfile.name || 'Admin profile'}
                    </Text>
                  </View>
                </View>

                <View style={styles.teacherDetailsList}>
                  {[
                    { label: 'Name', value: adminProfile.name || '-' },
                    { label: 'Username', value: adminProfile.username || '-' },
                    { label: 'Designation', value: adminProfile.designation || '-' },
                    { label: 'User Type', value: adminProfile.userType || '-' },
                    { label: 'School Code', value: adminProfile.schoolCode || '-' },
                  ].map((item) => (
                    <View key={item.label} style={styles.teacherDetailRow}>
                      <Text style={styles.teacherDetailLabel}>{item.label}</Text>
                      <Text style={styles.teacherDetailValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.teacherActions}>
                  <Pressable
                    style={[
                      styles.popupButton,
                      styles.popupButtonSecondary,
                      styles.teacherActionButton,
                    ]}
                    onPress={() => setShowAdminDetails(false)}
                  >
                    <Text style={[styles.popupButtonText, styles.popupButtonTextSecondary]}>
                      Close
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.popupButton, styles.teacherLogoutButton]}
                  onPress={handleLogout}
                >
                  <Text style={styles.teacherLogoutText}>Logout</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerNav}>
            <Pressable style={styles.footerNavItem} onPress={() => navigation.goBack()}>
              <Image source={backArrowImage} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text style={styles.footerNavLabel}>Back</Text>
            </Pressable>
            <Pressable style={styles.footerNavItem} onPress={() => setSelectedChip('Overview')}>
              <MaterialIcons name="home" size={22} color="#111111" />
              <Text style={styles.footerNavLabel}>Home</Text>
            </Pressable>
            <Pressable style={styles.footerAddButton} onPress={loadDashboard}>
              <MaterialIcons name="add" size={26} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.footerNavItem} onPress={() => setSelectedChip('Requests')}>
              <MaterialIcons name="chat-bubble-outline" size={22} color="#C2C2C7" />
              <Text style={styles.footerNavLabelMuted}>Chat</Text>
            </Pressable>
            <Pressable style={styles.footerNavItem} onPress={() => setShowAdminDetails(true)}>
              <MaterialIcons name="person-outline" size={22} color="#C2C2C7" />
              <Text style={styles.footerNavLabelMuted}>Profile</Text>
            </Pressable>
          </View>
          <View style={styles.footerBrandRow}>
            <Text style={styles.poweredBy}>Powered By</Text>
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.homeIndicator} />
        </View>
      </View>
    </View>
  );
};

const local = {
  logo: {
    width: 26,
    height: 26,
  },
  loaderWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 8,
    color: '#1F1F22',
    fontWeight: '600',
  },
  statusCardText: {
    flex: 1,
    paddingRight: 8,
  },
  statusNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
    lineHeight: 28,
  },
  statusSubtitle: {
    marginTop: 4,
    color: '#222',
    fontWeight: '700',
    fontSize: 12,
  },
  statusFooter: {
    marginTop: 8,
    color: '#444',
    fontSize: 11,
    fontWeight: '600',
  },
  statusIconWrap: {
    width: 30,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  sectionCard: {
    backgroundColor: '#f6f6f7',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    marginBottom: 14,
    flexGrow: 1,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#131313',
    marginBottom: 8,
  },
  sectionCardText: {
    color: '#4B4B51',
    lineHeight: 20,
    fontSize: 13,
  },
  smallSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  smallSummaryPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E5EA',
    backgroundColor: '#F8F8FA',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  smallSummaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
  },
  smallSummaryLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#4D4D53',
    textAlign: 'center',
  },
  cardStack: {
    gap: 14,
  },
  listCard: {
    backgroundColor: '#FAFAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EBF0',
    padding: 12,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#555A62',
    fontSize: 12.5,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#2e7d32',
  },
  rejectBtn: {
    backgroundColor: '#c62828',
  },
  actionText: {
    color: '#fff',
    fontWeight: '800',
  },
  preview: {
    marginTop: 8,
    width: '100%',
    height: 140,
    borderRadius: 10,
  },
  emptyText: {
    color: '#6B7280',
    fontStyle: 'italic',
  },
  errorText: {
    color: '#c62828',
    marginBottom: 8,
    fontWeight: '700',
  },
  innerScroll: {
    width: '100%',
  },
  innerScrollContent: {
    paddingBottom: 4,
  },
} as const;

export default AdminDashboard;  