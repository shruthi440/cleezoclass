import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import LinearGradient from 'react-native-linear-gradient';

import { RootStackParamList } from '../types';
import { globalStyles as baseStyles } from '../inner';
import { createAppStyles } from '../App.styles';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ParentFooter from './ParentFooter';

const { width } = Dimensions.get('window');

type ParentPhotosProps = NativeStackScreenProps<RootStackParamList, 'ParentPhotos'> & {
  embedded?: boolean;
};

// Frontend utility helper to normalize class names for safe client-side validation
const normalizeClassName = (rawClass: string): string => {
  if (!rawClass) return '';
  return String(rawClass)
    .toLowerCase()
    .replace(/class/g, '')
    .replace(/\s+/g, '')
    .trim();
};

const ParentPhotos: React.FC<ParentPhotosProps> = ({ route, embedded = false }) => {
  const { class_name, className } = route.params || {};
  const rawStudentClass = class_name || className || '';
  const studentClass = String(rawStudentClass).trim();

  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventName, setSelectedEventName] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [downloadingUri, setDownloadingUri] = useState<string | null>(null);
  
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
  const phoneWidth = Math.min(Math.max(windowWidth - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(windowHeight - 24, 720), 860);
  const appStyles = createAppStyles({ phoneWidth, phoneHeight });

  useEffect(() => {
const fetchFilteredMedia = async () => {
  const schoolCode = await AsyncStorage.getItem('schoolCode');
  if (!schoolCode) {
    setMedia([]);
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    // Skip class_name filter if studentClass is "all"
    const classFilter = studentClass === 'all' ? '' : `&class_name=${encodeURIComponent(studentClass)}`;
    const url = `http://162.215.210.38:3010/api/media?schoolCode=${schoolCode}${classFilter}`;

    const response = await fetch(url);
    const data = await response.json();

    if (Array.isArray(data)) {
      setMedia(data);
    } else {
      setMedia([]);
    }
  } catch (e) {
    console.error('Error fetching media:', e);
    setMedia([]);
  } finally {
    setLoading(false);
  }
};

    fetchFilteredMedia();
  }, [studentClass]);

  // Convert state groups cleanly into the folder dataset layout array
const eventFolders = media.map((event: any) => ({
  eventName: studentClass === 'all'
    ? `${event.class_name || 'General'} - ${event.eventName || 'General Events'}`
    : event.eventName || 'General Events',
  photos: Array.isArray(event.photos) ? event.photos : [],
  class_name: event.class_name || 'General',
}));

  // Track currently expanded sub-album list data arrays
  const selectedFolder = eventFolders.find(f => f.eventName === selectedEventName);
  const imageItems = selectedFolder ? selectedFolder.photos : [];
  
  // Calculate total images loaded across all structural albums
  const totalImages = eventFolders.reduce((sum, f) => sum + f.photos.length, 0);

  const askStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Number(Platform.Version) >= 33) return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const getFileExtension = (uri: string) => {
    const cleaned = uri.split('?')[0];
    const ext = cleaned.split('.').pop()?.toLowerCase() || 'jpg';
    return ext.length > 5 ? 'jpg' : ext;
  };

  const resolveAttachmentUrl = (uri: string) => {
    const raw = String(uri || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:') || /^https?:\/\//i.test(raw)) return raw;
    return `http://162.215.210.38:3010${raw.startsWith('/') ? raw : `/${raw}`}`;
  };

  const handleDownload = async (uri: string, index: number) => {
    if (!uri) return;
    try {
      const hasPermission = await askStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission needed', 'Please allow storage permission to download images.');
        return;
      }

      setDownloadingUri(uri);
      const finalUrl = resolveAttachmentUrl(uri);
      const fileName = `Photo_${Date.now()}_${index}.${getFileExtension(finalUrl)}`;
      const targetPath = `${Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath}/${fileName}`;

      const result = await RNFS.downloadFile({
        fromUrl: finalUrl,
        toFile: targetPath,
        background: false,
      }).promise;

      if (result?.statusCode >= 200 && result?.statusCode < 300) {
        Alert.alert('Downloaded', `Saved to Gallery/Downloads folder.`);
      } else {
        Alert.alert('Download failed', 'Could not save file to disk.');
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Download failed', 'Unable to complete asset download.');
    } finally {
      setDownloadingUri(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={baseStyles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#6826df" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={baseStyles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={baseStyles.scrollView} contentContainerStyle={photoStyles.scrollContent} nestedScrollEnabled>
        <LinearGradient
          colors={['#0D3F66', '#BFD7FA', '#F6F8FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={photoStyles.gradientSection}
        >
          <View style={photoStyles.headerBlock}>
            <Text style={photoStyles.pageTitle}>Photos</Text>
         <Text style={photoStyles.pageSubtitle}>
  {selectedEventName
    ? selectedEventName
    : studentClass === 'all'
      ? 'All Classes • School Feed'
      : `Class Feed • ${studentClass || 'General Shared'}`}
</Text>
          </View>

          <View style={photoStyles.summaryRow}>
            <LinearGradient
              colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
              start={{ x: 0.05, y: 0.05 }}
              end={{ x: 0.95, y: 0.95 }}
              style={[appStyles.dashboardGridCard, photoStyles.summaryCardLeft]}
            >
              <View style={photoStyles.summaryGradientTopRightIcon}>
                <MaterialIcons name="photo-library" size={24} color="#FFFFFF" />
              </View>
              <View style={photoStyles.summaryCardContent}>
                <Text style={[photoStyles.summaryCardLabel, photoStyles.summaryCardLabelLight]}>Folders</Text>
                <Text style={[photoStyles.summaryCardValue, photoStyles.summaryCardValueLight]}>
                  {eventFolders.length}
                </Text>
                <Text style={[photoStyles.summaryCardText, photoStyles.summaryCardTextLight]}>Event albums</Text>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={['#D7C5FF', '#A670EE', '#6D2DE1']}
              start={{ x: 0.05, y: 0.05 }}
              end={{ x: 0.95, y: 0.95 }}
              style={[appStyles.dashboardGridCard, photoStyles.summaryCardRight]}
            >
              <View style={photoStyles.summaryGradientTopRightIcon}>
                <MaterialIcons name="image" size={24} color="#FFFFFF" />
              </View>
              <View style={photoStyles.summaryCardContent}>
                <Text style={[photoStyles.summaryCardLabel, photoStyles.summaryCardLabelLight]}>Images</Text>
                <Text style={[photoStyles.summaryCardValue, photoStyles.summaryCardValueLight]}>
                  {totalImages}
                </Text>
                <Text style={[photoStyles.summaryCardText, photoStyles.summaryCardTextLight]}>Total uploads</Text>
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>

        <View style={photoStyles.contentCard}>
          {!selectedEventName ? (
            <View style={photoStyles.folderSection}>
              <Text style={photoStyles.sectionTitle}>Event Albums</Text>
              {eventFolders.length === 0 ? (
                <Text style={photoStyles.emptyText}>No photos uploaded for your class yet.</Text>
              ) : (
                <View style={photoStyles.albumGrid}>
                  {eventFolders.map((folder) => (
                    <TouchableOpacity
                      key={folder.eventName}
                      onPress={() => setSelectedEventName(folder.eventName)}
                      style={photoStyles.albumCard}
                    >
                      <View style={photoStyles.albumHeader}>
                        <View style={{ flex: 1, paddingRight: 4 }}>
                          <Text style={photoStyles.albumTitle} numberOfLines={2}>{folder.eventName}</Text>
                          <Text style={photoStyles.albumMeta}>{folder.photos.length} photo(s)</Text>
                        </View>
                        <View style={photoStyles.albumBadge}>
                          <Text style={photoStyles.albumBadgeText}>{folder.photos.length}</Text>
                        </View>
                      </View>

                      <View style={photoStyles.albumPreviewRow}>
                        {folder.photos.length > 0 ? (
                          <Image
                            source={{ uri: resolveAttachmentUrl(folder.photos[0]) }}
                            style={photoStyles.albumPreviewImage}
                          />
                        ) : (
                          <View style={[photoStyles.albumPreviewImage, photoStyles.albumPreviewEmpty]}>
                            <Text style={photoStyles.albumPreviewEmptyText}>No preview</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={photoStyles.gallerySection}>
              <TouchableOpacity onPress={() => setSelectedEventName(null)} style={photoStyles.backButton}>
                <Text style={photoStyles.backButtonText}>← Back to Albums</Text>
              </TouchableOpacity>

              <Text style={photoStyles.galleryTitle}>{selectedEventName}</Text>
              {imageItems.length === 0 ? (
                <Text style={photoStyles.emptyText}>No images in this event.</Text>
              ) : (
                <FlatList
                  data={imageItems}
                  keyExtractor={(item, index) => `img-${index}`}
                  numColumns={3}
                  scrollEnabled={false}
                  columnWrapperStyle={photoStyles.imageColumn}
                  renderItem={({ item, index }) => (
                    <View style={photoStyles.imageCard}>
                      <TouchableOpacity
                        onPress={() => {
                          setPreviewStartIndex(index);
                          setPreviewIndex(index);
                          setPreviewVisible(true);
                        }}
                      >
                        <Image
                          source={{ uri: resolveAttachmentUrl(item) }}
                          style={photoStyles.imageThumb}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDownload(item, index)}
                        style={photoStyles.downloadButton}
                      >
                        <Text style={photoStyles.downloadButtonText}>
                          {downloadingUri === item ? 'Saving...' : 'Download'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Lightbox Preview Modal */}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={photoStyles.modalBackground}>
          <FlatList
            data={imageItems}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={previewStartIndex}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={(e) => {
              const nextIndex = Math.round(e.nativeEvent.contentOffset.x / width);
              setPreviewIndex(nextIndex);
            }}
            renderItem={({ item }) => (
              <View style={{ width: width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                <Image
                  source={{ uri: resolveAttachmentUrl(item) }}
                  resizeMode="contain"
                  style={{ width: '100%', height: '70%', borderRadius: 8 }}
                />
              </View>
            )}
          />
          <Text style={{ color: '#fff', marginTop: 8, fontSize: 13 }}>
            Image {previewIndex + 1} of {imageItems.length}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => imageItems[previewIndex] && handleDownload(imageItems[previewIndex], previewIndex)}
              style={{ backgroundColor: '#2f4f88', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPreviewVisible(false)}
              style={{ backgroundColor: '#777', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ParentFooter />
    </SafeAreaView>
  );
};

const photoStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  gradientSection: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerBlock: {
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  summaryCardLeft: {
    marginRight: 6,
    flex: 1,
  },
  summaryCardRight: {
    marginLeft: 6,
    flex: 1,
  },
  summaryCardContent: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  summaryCardLabel: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryCardText: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryGradientTopRightIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  summaryCardLabelLight: { color: '#FFFFFF' },
  summaryCardValueLight: { color: '#FFFFFF' },
  summaryCardTextLight: { color: 'rgba(255,255,255,0.8)' },
  contentCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E4EA',
    padding: 14,
    marginHorizontal: 12,
    marginTop: -10,
  },
  folderSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 14,
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  albumCard: {
    width: '48%',
    minHeight: 160,
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#6826df',
  },
  albumHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  albumTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#333',
  },
  albumMeta: {
    fontSize: 11,
    color: '#777',
    fontWeight: '600',
    marginTop: 2,
  },
  albumBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#814de2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  albumBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
  },
  albumPreviewRow: {
    width: '100%',
    height: 90,
    marginTop: 'auto',
  },
  albumPreviewImage: {
    borderRadius: 10,
    backgroundColor: '#DDE2EA',
    width: '100%',
    height: '100%',
  },
  albumPreviewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumPreviewEmptyText: {
    color: '#7A7F89',
    fontWeight: '700',
    fontSize: 11,
  },
  gallerySection: {
    flex: 1,
  },
  backButton: {
    backgroundColor: '#814de2',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  galleryTitle: {
    fontWeight: '800',
    color: '#111',
    marginBottom: 12,
    fontSize: 16,
  },
  emptyText: {
    paddingVertical: 30,
    color: '#777',
    textAlign: 'center',
    fontSize: 14,
  },
  imageColumn: {
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  imageCard: {
    width: (width - 64) / 3,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    padding: 4,
  },
  imageThumb: {
    width: '100%',
    height: 85,
    borderRadius: 6,
  },
  downloadButton: {
    marginTop: 4,
    borderRadius: 4,
    backgroundColor: '#2f4f88',
    paddingVertical: 4,
  },
  downloadButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  }
});

export default ParentPhotos;