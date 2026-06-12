import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Ionicons from 'react-native-vector-icons/Ionicons';
import TeacherFooter from './TeacherFooter';

const LIVE_CHAT_BASE = 'http://162.215.210.38:3010/LiveChat';
const CHAT_REQUESTS_BASE = 'https://cleezoclass.com:4000/api';

type ChatRole = 'parent' | 'teacher';

type ChatContact = {
  name: string;
  role?: string;
  className?: string;
  section?: string;
};

type ChatMessage = {
  sender: string;
  contact: string;
  text: string;
  timestamp?: string;
  classname?: string;
  section?: string;
  schoolCode?: string;
};

type LiveChatPanelProps = {
  role: ChatRole;
  embedded?: boolean;
  routeName?: string;
  routeUsername?: string;
};

const blockedWords = [
  'waste fello',
  'useless fello',
  'idiot',
  'fool',
  'bloody',
  'stupid',
  'nonsense',
  'dumb',
  'donkey',
  'mental',
  'rascal',
  'cheap fellow',
  'moron',
];

const normalize = (value: unknown) => String(value || '').trim();

const formatMessageTime = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const dedupeContacts = (contacts: ChatContact[]) => {
  const seen = new Set<string>();
  const deduplicated = contacts.filter((contact) => {
    const key = normalize(contact.name).toLowerCase();
    if (!key || seen.has(key)) {
      console.log('[DEBUG] Duplicate or empty contact skipped:', contact);
      return false;
    }
    seen.add(key);
    return true;
  });
  console.log('[DEBUG] Deduplicated contacts:', deduplicated);
  return deduplicated;
};

const containsBlockedWord = (text: string) => {
  const lowered = text.toLowerCase();
  return blockedWords.some((word) => lowered.includes(word.toLowerCase()));
};

const LiveChatPanel: React.FC<LiveChatPanelProps> = ({
  role,
  embedded = false,
  routeName = '',
  routeUsername = '',
}) => {
  const scrollRef = useRef<ScrollView | null>(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [identityName, setIdentityName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentSection, setStudentSection] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const roleLabel = role === 'teacher' ? 'Teacher Live Chat' : 'Parent Live Chat';
  const counterpartLabel = role === 'teacher' ? 'parents' : 'teachers';

  const selectedTitle = useMemo(
    () => selectedContact?.name || `Select ${role === 'teacher' ? 'a parent' : 'a teacher'}`,
    [role, selectedContact]
  );

  const loadProfile = useCallback(async () => {
    try {
      setLoadingProfile(true);
      console.log('[DEBUG] Loading profile...');
      const keys = ['username', 'name', 'schoolCode', 'class_name', 'section', 'studentId'];
      const stores = await AsyncStorage.multiGet(keys);
      const stored = stores.reduce<Record<string, string>>((acc, [key, value]) => {
        if (value) acc[key] = value;
        return acc;
      }, {});

      const nextSchoolCode = normalize(stored.schoolCode);
      const nextUsername = normalize(routeUsername || stored.username || stored.studentId);
      let nextName = normalize(routeName || stored.name || stored.username);
      let nextClass = normalize(stored.class_name);
      let nextSection = normalize(stored.section);

      if (role === 'parent' && nextUsername && nextSchoolCode && (!nextName || !nextClass)) {
        try {
          console.log('[DEBUG] Fetching student details for parent:', { nextUsername, nextSchoolCode });
          const response = await axios.get(`${LIVE_CHAT_BASE}/studentname`, {
            params: { username: nextUsername, schoolCode: nextSchoolCode },
          });
          console.log('[DEBUG] Student details response:', response.data);
          nextName = normalize(response.data?.name || nextName);
          nextClass = normalize(response.data?.class_name || nextClass);
          nextSection = normalize(response.data?.section || nextSection);
        } catch (error) {
          console.error('[ERROR] Failed to fetch student details:', error);
        }
      }

      console.log('[DEBUG] Profile loaded:', { nextSchoolCode, nextName, nextClass, nextSection });
      setSchoolCode(nextSchoolCode);
      setIdentityName(nextName);
      setStudentClass(nextClass);
      setStudentSection(nextSection);
    } finally {
      setLoadingProfile(false);
    }
  }, [role, routeName, routeUsername]);

const loadContacts = useCallback(async () => {
  if (!schoolCode || !identityName) {
    console.log('[DEBUG] Skipping contacts fetch: missing schoolCode or identityName');
    return;
  }

  try {
    setLoadingContacts(true);
    console.log('[DEBUG] Fetching contacts for:', { schoolCode, identityName, role, studentClass });

    if (role === 'parent') {
      if (!studentClass) {
        console.log('[DEBUG] No student class found. Skipping contacts fetch.');
        setContacts([]);
        return;
      }

      const response = await axios.get(`${LIVE_CHAT_BASE}/contacts`, {
        params: { class_name: studentClass, schoolCode },
      });
      console.log('[DEBUG] Raw contacts response (parent):', response.data);

      // Handle the new response format
      const contactsData = response.data.data || response.data;
      const nextContacts = Array.isArray(contactsData)
        ? contactsData.map((contact: any) => ({
            name: normalize(contact.name),
            role: normalize(contact.role || 'Teacher'),
          }))
        : [];
      console.log('[DEBUG] Processed contacts (parent):', nextContacts);
      setContacts(dedupeContacts(nextContacts));
      return;
    }
    // Rest of the teacher logic...
  } catch (error) {
    console.error('[ERROR] Failed to load contacts:', error);
    setContacts([]);
  } finally {
    setLoadingContacts(false);
  }
}, [identityName, role, schoolCode, studentClass]);
  const loadMessages = useCallback(
    async (contact = selectedContact, quiet = false) => {
      if (!contact || !schoolCode || !identityName) {
        console.log('[DEBUG] Skipping messages fetch: missing contact, schoolCode, or identityName');
        return;
      }

      try {
        if (!quiet) setLoadingMessages(true);
        console.log('[DEBUG] Fetching messages for contact:', contact.name);
        const response = await axios.get(
          `${LIVE_CHAT_BASE}/messages/${encodeURIComponent(identityName)}/${encodeURIComponent(contact.name)}/${encodeURIComponent(schoolCode)}`
        );
        console.log('[DEBUG] Messages response:', response.data);
        setMessages(Array.isArray(response.data) ? response.data : []);
      } catch (error: any) {
        console.error('[ERROR] Failed to load messages:', error);
        if (error?.response?.status === 404) {
          setMessages([]);
        }
      } finally {
        if (!quiet) setLoadingMessages(false);
      }
    },
    [identityName, schoolCode, selectedContact]
  );

  const refreshAll = useCallback(async () => {
    console.log('[DEBUG] Refreshing contacts and messages...');
    setRefreshing(true);
    await Promise.all([loadContacts(), loadMessages(selectedContact, true)]);
    setRefreshing(false);
  }, [loadContacts, loadMessages, selectedContact]);

  const openContact = useCallback(
    async (contact: ChatContact) => {
      console.log('[DEBUG] Opening contact:', contact);
      setSelectedContact(contact);
      setMessages([]);
      await loadMessages(contact);
    },
    [loadMessages]
  );

  const sendMessage = useCallback(async () => {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || !selectedContact || !schoolCode || !identityName || sending) {
      console.log('[DEBUG] Skipping send: missing data or already sending');
      return;
    }

    if (containsBlockedWord(trimmedMessage)) {
      console.log('[DEBUG] Blocked word detected in message');
      Alert.alert('Inappropriate Message', 'Please avoid using disrespectful words.');
      return;
    }

    const payload = {
      contact: selectedContact.name,
      sender: identityName,
      text: trimmedMessage,
      classname: selectedContact.className || studentClass || '',
      section: selectedContact.section || studentSection || '',
      schoolCode,
    };
    console.log('[DEBUG] Sending message payload:', payload);

    try {
      setSending(true);
      const response = await axios.post(`${LIVE_CHAT_BASE}/messagess`, payload);
      console.log('[DEBUG] Message sent response:', response.data);
      setMessages((previous) => [...previous, response.data || { ...payload, timestamp: new Date().toISOString() }]);
      setMessageText('');
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch (error: any) {
      console.error('[ERROR] Failed to send message:', error);
      Alert.alert('Message failed', error?.response?.data?.error || 'Unable to send message right now.');
    } finally {
      setSending(false);
    }
  }, [identityName, messageText, schoolCode, selectedContact, sending, studentClass, studentSection]);

  useEffect(() => {
    console.log('[DEBUG] Loading profile on mount...');
    loadProfile().catch(() => undefined);
  }, [loadProfile]);

  useEffect(() => {
    console.log('[DEBUG] Loading contacts on dependency change...');
    loadContacts().catch(() => undefined);
  }, [loadContacts]);

  useEffect(() => {
    if (!selectedContact) return;
    console.log('[DEBUG] Setting up auto-refresh for messages...');
    const timer = setInterval(() => {
      loadMessages(selectedContact, true).catch(() => undefined);
    }, 5000);

    return () => {
      console.log('[DEBUG] Clearing auto-refresh timer...');
      clearInterval(timer);
    };
  }, [loadMessages, selectedContact]);

  if (loadingProfile) {
    return (
      <View style={[chatStyles.centerState, embedded && chatStyles.embeddedCenterState]}>
        <ActivityIndicator color="#6D2DE1" />
        <Text style={chatStyles.centerStateText}>Loading chat profile...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[chatStyles.shell, embedded && chatStyles.embeddedShell, { marginBottom: 60 }]}>
        <View style={chatStyles.contentRow}>
          <View style={chatStyles.contactsCard}>
            <View style={chatStyles.sectionHeader}>
              <Text style={chatStyles.sectionTitle}>{role === 'teacher' ? 'Parents' : 'Teachers'}</Text>
              <TouchableOpacity onPress={refreshAll} style={chatStyles.iconButton}>
                <Ionicons name="refresh" size={17} color="#1F1F22" />
              </TouchableOpacity>
            </View>

            {loadingContacts ? (
              <ActivityIndicator color="#6D2DE1" style={chatStyles.loader} />
            ) : contacts.length === 0 ? (
              <Text style={chatStyles.emptyText}>
                {role === 'teacher'
                  ? 'No approved parent chats or previous conversations found.'
                  : 'No teacher contacts found for this class.'}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chatStyles.contactStrip}>
                {console.log('[DEBUG] Rendering contacts:', contacts)}
                {contacts.map((contact) => {
                  const active = selectedContact?.name === contact.name;
                  return (
                    <TouchableOpacity
                      key={contact.name}
                      style={[chatStyles.contactChip, active && chatStyles.contactChipActive]}
                      onPress={() => openContact(contact)}
                    >
                      <View style={[chatStyles.avatar, active && chatStyles.avatarActive]}>
                        <Text style={[chatStyles.avatarText, active && chatStyles.avatarTextActive]}>
                          {contact.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[chatStyles.contactName, active && chatStyles.contactNameActive]} numberOfLines={1}>
                        {contact.name}
                      </Text>
                      {contact.role ? (
                        <Text style={[chatStyles.contactRole, active && chatStyles.contactRoleActive]} numberOfLines={1}>
                          {contact.role}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View style={chatStyles.chatCard}>
            <View style={chatStyles.chatHeader}>
              <TouchableOpacity
                style={[chatStyles.backButton, !selectedContact && chatStyles.backButtonDisabled]}
                onPress={() => setSelectedContact(null)}
                disabled={!selectedContact}
              >
                <Ionicons name="chevron-back" size={18} color={selectedContact ? '#1F1F22' : '#B8BBC4'} />
              </TouchableOpacity>
              <View style={chatStyles.chatHeaderText}>
                <Text style={chatStyles.chatTitle} numberOfLines={1}>{selectedTitle}</Text>
                <Text style={chatStyles.chatSubtitle}>
                  {selectedContact ? 'Auto-refreshes every few seconds' : 'Tap a contact above'}
                </Text>
              </View>
            </View>

            {!selectedContact ? (
              <View style={chatStyles.emptyChatState}>
                <Ionicons name="chatbubble-ellipses-outline" size={34} color="#B8BBC4" />
                <Text style={chatStyles.emptyText}>Select a contact to view messages.</Text>
              </View>
            ) : loadingMessages ? (
              <View style={chatStyles.emptyChatState}>
                <ActivityIndicator color="#6D2DE1" />
                <Text style={chatStyles.emptyText}>Loading messages...</Text>
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                style={chatStyles.messageList}
                contentContainerStyle={chatStyles.messageListContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.length === 0 ? (
                  <Text style={chatStyles.emptyText}>No messages yet. Say hello.</Text>
                ) : (
                  messages.map((message, index) => {
                    const isMine = normalize(message.sender) === identityName;
                    return (
                      <View key={`${message.timestamp || index}-${index}`} style={[chatStyles.messageRow, isMine && chatStyles.messageRowMine]}>
                        <View style={[chatStyles.bubble, isMine ? chatStyles.bubbleMine : chatStyles.bubbleTheirs]}>
                          <Text style={[chatStyles.bubbleText, isMine && chatStyles.bubbleTextMine]}>{message.text}</Text>
                        </View>
                        <Text style={[chatStyles.timestamp, isMine && chatStyles.timestampMine]}>
                          {formatMessageTime(message.timestamp)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            <View style={chatStyles.inputRow}>
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder={selectedContact ? 'Type your message...' : 'Select a contact first'}
                placeholderTextColor="#9CA3AF"
                style={chatStyles.input}
                editable={Boolean(selectedContact) && !sending}
                multiline
              />
              <TouchableOpacity
                style={[chatStyles.sendButton, (!selectedContact || sending || !messageText.trim()) && chatStyles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!selectedContact || sending || !messageText.trim()}
              >
                {sending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      <TeacherFooter />
    </View>
  );
};

const chatStyles = StyleSheet.create({
  shell: {
    flex: 1,
    gap: 14,
  },
  embeddedShell: {
    minHeight: 560,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  embeddedCenterState: {
    minHeight: 420,
  },
  centerStateText: {
    color: '#5F6672',
    fontWeight: '700',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9ECF2',
    padding: 16,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6D2DE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#5F6672',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  contentRow: {
    flex: 1,
    gap: 12,
  },
  contactsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9ECF2',
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4F6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    paddingVertical: 20,
  },
  contactStrip: {
    gap: 10,
    paddingRight: 8,
  },
  contactChip: {
    width: 132,
    minHeight: 104,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6E9F0',
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  contactChipActive: {
    backgroundColor: '#6D2DE1',
    borderColor: '#6D2DE1',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ECE7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  avatarText: {
    color: '#6D2DE1',
    fontWeight: '900',
  },
  avatarTextActive: {
    color: '#FFFFFF',
  },
  contactName: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
  },
  contactNameActive: {
    color: '#FFFFFF',
  },
  contactRole: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
  },
  contactRoleActive: {
    color: 'rgba(255,255,255,0.82)',
  },
  chatCard: {
    flex: 1,
    minHeight: 430,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9ECF2',
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonDisabled: {
    opacity: 0.5,
  },
  chatHeaderText: {
    flex: 1,
  },
  chatTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  chatSubtitle: {
    color: '#7A7F87',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  emptyChatState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  messageList: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  messageListContent: {
    padding: 14,
    gap: 10,
    flexGrow: 1,
  },
  messageRow: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
  },
  messageRowMine: {
    alignSelf: 'flex-end',
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  bubbleMine: {
    backgroundColor: '#6D2DE1',
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E9F0',
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  timestamp: {
    color: '#8A909A',
    fontSize: 10,
    marginTop: 4,
    marginLeft: 6,
    fontWeight: '700',
  },
  timestampMine: {
    textAlign: 'right',
    marginRight: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0E4EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#F8FAFC',
    fontWeight: '600',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6D2DE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});

export default LiveChatPanel;