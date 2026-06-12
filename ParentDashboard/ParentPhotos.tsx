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

const ParentPhotos: React.FC<
  NativeStackScreenProps<RootStackParamList, 'ParentPhotos'> & { embedded?: boolean }
> = ({ embedded = false }) => {
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
    const fetchMedia = async () => {
      const schoolCode = await AsyncStorage.getItem('schoolCode');
      try {
        const response = await fetch(`http://162.215.210.38:3010/api/media?schoolCode=${schoolCode}`);
        const data = await response.json();
        setMedia(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setMedia([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, []);

  const groupedByEvent = media.reduce((acc: Record<string, any[]>, item: any) => {
    const eventName = item?.eventName || 'Untitled Event';
    if (!acc[eventName]) acc[eventName] = [];
    acc[eventName].push(item);
    return acc;
  }, {});

  const eventFolders = Object.keys(groupedByEvent).map((eventName) => ({
    eventName,
    items: groupedByEvent[eventName],
  }));

  const selectedItems = selectedEventName ? groupedByEvent[selectedEventName] || [] : [];
  const imageItems = selectedItems.filter((item: any) => !!item?.attachments);
  const totalImages = media.filter((item: any) => !!item?.attachments).length;

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
    if (ext.length > 5) return 'jpg';
    return ext;
  };

  const resolveAttachmentUrl = (uri: string) => {
    const raw = String(uri || '').trim();
    if (!raw) return '';
    if (raw.startsWith('data:')) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    const normalized = raw.startsWith('/') ? raw : `/${raw}`;
    return `http://162.215.210.38:3010${normalized}`;
  };

  const extensionFromMime = (mime: string) => {
    const normalized = String(mime || '').toLowerCase();
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('webp')) return 'webp';
    if (normalized.includes('gif')) return 'gif';
    if (normalized.includes('mp4')) return 'mp4';
    return 'bin';
  };

  const safeName = (value: string) =>
    String(value || 'photo')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

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
      if (!finalUrl) {
        Alert.alert('Download failed', 'Invalid image URL.');
        return;
      }

      const isDataUri = finalUrl.startsWith('data:');
      const dataUriMatch = finalUrl.match(/^data:([^;]+);base64,(.*)$/);
      const ext = isDataUri
        ? extensionFromMime(dataUriMatch?.[1] || '')
        : getFileExtension(finalUrl);
      const eventLabel = safeName(selectedEventName || 'event');
      const fileName = `${eventLabel}_${Date.now()}_${index}.${ext}`;

      const targets =
        Platform.OS === 'android'
          ? [RNFS.DownloadDirectoryPath, RNFS.ExternalDirectoryPath, RNFS.DocumentDirectoryPath]
          : [RNFS.DocumentDirectoryPath];

      let savedPath = '';
      let lastStatus = 0;

      for (const dir of targets) {
        if (!dir) continue;
        const targetPath = `${dir}/${fileName}`;
        try {
          if (isDataUri) {
            const base64Data = dataUriMatch?.[2] || '';
            if (!base64Data) throw new Error('Invalid base64 payload');
            await RNFS.writeFile(targetPath, base64Data, 'base64');
            lastStatus = 200;
            savedPath = targetPath;
            break;
          }

          const result = await RNFS.downloadFile({
            fromUrl: finalUrl,
            toFile: targetPath,
            background: false,
          }).promise;

          lastStatus = result?.statusCode || 0;
          if (lastStatus >= 200 && lastStatus < 300) {
            savedPath = targetPath;
            break;
          }
        } catch (innerError) {
          console.log('Download attempt failed for path:', targetPath, innerError);
        }
      }

      if (savedPath) {
        Alert.alert('Downloaded', `Saved to:\n${savedPath}`);
      } else {
        Alert.alert('Download failed', `Unable to save image (status ${lastStatus || 'unknown'}).`);
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Download failed', 'Unable to download image.');
    } finally {
      setDownloadingUri(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={baseStyles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#000" style={{ marginTop: 24 }} />
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
                {selectedEventName ? selectedEventName : `${eventFolders.length} albums • ${totalImages} images`}
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
                  <Text style={[photoStyles.summaryCardText, photoStyles.summaryCardTextLight]}>
                    Event albums
                  </Text>
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
                  <Text style={[photoStyles.summaryCardText, photoStyles.summaryCardTextLight]}>
                    Total uploads
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </LinearGradient>

          <View style={photoStyles.contentCard}>
            {!selectedEventName ? (
              <View style={photoStyles.folderSection}>
                <Text style={photoStyles.sectionTitle}>Event Albums</Text>
                {eventFolders.length === 0 ? (
                  <Text style={photoStyles.emptyText}>No photos found.</Text>
                ) : (
                  <View style={photoStyles.albumGrid}>
                    {eventFolders.map((folder) => {
                      const previews = folder.items
                        .filter((item: any) => !!item?.attachments)
                        .slice(0, 1);
                      return (
                        <TouchableOpacity
                          key={folder.eventName}
                          onPress={() => setSelectedEventName(folder.eventName)}
                          style={photoStyles.albumCard}
                        >
                          <View style={photoStyles.albumHeader}>
                            <View>
                              <Text style={photoStyles.albumTitle}>{folder.eventName}</Text>
                              <Text style={photoStyles.albumMeta}>{folder.items.length} image(s)</Text>
                            </View>
                            <View style={photoStyles.albumBadge}>
                              <Text style={photoStyles.albumBadgeText}>{folder.items.length}</Text>
                            </View>
                          </View>

                          <View style={photoStyles.albumPreviewRow}>
                            {previews.length > 0 ? (
                              <Image
                                source={{ uri: resolveAttachmentUrl(previews[0].attachments) }}
                                style={photoStyles.albumPreviewImage}
                              />
                            ) : (
                              <View style={[photoStyles.albumPreviewImage, photoStyles.albumPreviewEmpty]}>
                                <Text style={photoStyles.albumPreviewEmptyText}>No preview</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <View style={photoStyles.gallerySection}>
                <TouchableOpacity
                  onPress={() => setSelectedEventName(null)}
                  style={photoStyles.backButton}
                >
                  <Text style={photoStyles.backButtonText}> Back</Text>
                </TouchableOpacity>

                <Text style={photoStyles.galleryTitle}>{selectedEventName}</Text>
                {imageItems.length === 0 ? (
                  <Text style={photoStyles.emptyText}>No images in this event.</Text>
                ) : (
                  <FlatList
                    data={imageItems}
                    keyExtractor={(item: any, index: number) => `${item.id || 'img'}-${index}`}
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
                            source={{ uri: resolveAttachmentUrl(item.attachments) }}
                            style={photoStyles.imageThumb}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDownload(item.attachments, index)}
                          style={photoStyles.downloadButton}
                        >
                          <Text style={photoStyles.downloadButtonText}>
                            {downloadingUri === item.attachments ? 'Downloading...' : 'Download'}
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

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.88)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <FlatList
            key={`preview-${previewStartIndex}-${imageItems.length}`}
            data={imageItems}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={previewStartIndex}
            getItemLayout={(_, index) => ({
              length: width - 32,
              offset: (width - 32) * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const nextIndex = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
              setPreviewIndex(nextIndex);
            }}
            renderItem={({ item }) => (
              <View style={{ width: width - 32, alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  source={{ uri: resolveAttachmentUrl(item.attachments) }}
                  resizeMode="contain"
                  style={{ width: '100%', height: '75%', borderRadius: 8 }}
                />
              </View>
            )}
          />
          <Text style={{ color: '#fff', marginTop: 8, fontSize: 12 }}>
            Swipe left or right to view more photos ({previewIndex + 1}/{imageItems.length})
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() =>
                imageItems[previewIndex]?.attachments &&
                handleDownload(imageItems[previewIndex].attachments, previewIndex)
              }
              style={{ backgroundColor: '#2f4f88', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPreviewVisible(false)}
              style={{ backgroundColor: '#777', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ParentFooter/>
    </SafeAreaView>
  );
};

export default ParentPhotos;

const photoStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  page: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  embeddedPage: {
    paddingHorizontal: 0,
  },
  gradientSection: {
    marginTop: 0,
    marginHorizontal: -16,
    paddingTop: 16,
    paddingBottom: 0,
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
    color: '#666',
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  summaryCardLeft: {
    marginRight: 8,
  },
  summaryCardRight: {
    marginLeft: 8,
  },
  summaryCardContent: {
    flex: 1,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 14,
  },
  summaryCardLabel: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: '#191919',
    textAlign: 'right',
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '800',
    color: '#2F2F31',
    textAlign: 'right',
    marginBottom: 6,
  },
  summaryCardText: {
    fontSize: 12,
    lineHeight: 16,
    color: '#60646C',
    textAlign: 'right',
    fontWeight: '600',
  },
  summaryGradientTopRightIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  summaryCardLabelLight: {
    color: '#FFFFFF',
  },
  summaryCardValueLight: {
    color: '#FFFFFF',
  },
  summaryCardTextLight: {
    color: 'rgba(255,255,255,0.84)',
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E4EA',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    padding: 14,
    marginTop: -2,
  },
  folderSection: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 2,
    justifyContent: 'flex-start',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 12,
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  albumCard: {
    width: '90%',
    minHeight: 170,
    backgroundColor: '#F7F8FA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#6826df',
  },
  albumHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  albumTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#30343B',
    marginBottom: 4,
  },
  albumMeta: {
    fontSize: 11.5,
    color: '#7A7F89',
    fontWeight: '700',
  },
  albumBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#a171faff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  albumBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  albumPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 0,
    flex: 1,
    alignContent: 'flex-start',
  },
  albumPreviewImage: {
    borderRadius: 16,
    backgroundColor: '#DDE2EA',
    width: '100%',
    height: 94,
  },
  albumPreviewEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumPreviewEmptyText: {
    color: '#7A7F89',
    fontWeight: '700',
  },
  folderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#fff',
  },
  folderEmoji: {
    fontSize: 22,
  },
  folderTextBlock: {
    flex: 1,
    paddingRight: 8,
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    marginBottom: 2,
  },
  folderMeta: {
    color: '#666',
    fontSize: 12.5,
    fontWeight: '600',
  },
  folderThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  gallerySection: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 2,
    justifyContent: 'flex-start',
  },
  backButton: {
    backgroundColor: '#814de2ff',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  galleryTitle: {
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
    fontSize: 15,
  },
  emptyText: {
    paddingVertical: 18,
    color: '#666',
    textAlign: 'center',
  },
  imageColumn: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  imageCard: {
    width: (width - 74) / 3,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 4,
  },
  imageThumb: {
    width: '100%',
    height: 90,
    borderRadius: 6,
  },
  downloadButton: {
    marginTop: 6,
    borderRadius: 6,
    backgroundColor: '#2f4f88',
    paddingVertical: 4,
  },
  downloadButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
});
