import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { RootStackParamList } from '../types';

type ParentFooterProps = {
  embedded?: boolean;
};
const logoImage = require('../assets/Cleezo.png');
const backArrowImage: ImageSourcePropType = require('../assets/Arrow.png');

const ParentFooter: React.FC<ParentFooterProps> = ({ embedded = false }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (embedded) {
    return null;
  }

  return (
    <View style={styles.footer}>
      <View style={styles.footerNav}>
        <Pressable style={styles.footerNavItem} onPress={() => navigation.canGoBack() && navigation.goBack()}>
          <Image source={backArrowImage} style={styles.backIcon} resizeMode="contain" />
          <Text style={styles.footerNavLabel}>Back</Text>
        </Pressable>
        <Pressable style={styles.footerNavItem} onPress={() => navigation.navigate('ParentDashboard')}>
<Ionicons name="home-outline" size={22} color="#1F1F22" />                  <Text style={styles.footerNavLabel}>Home</Text>
        </Pressable>
        <Pressable style={styles.footerAddButton} onPress={() => navigation.navigate('ParentLiveChatTicket')}>
          <MaterialIcons name="add" size={26} color="#FFFFFF" />
        </Pressable>
        <Pressable style={styles.footerNavItem} onPress={() => navigation.navigate('ParentMessage')}>
          <MaterialIcons name="chat-bubble-outline" size={22} color="#1F1F22" />
          <Text style={styles.footerNavLabelMuted}>Chat</Text>
        </Pressable>
        <Pressable style={styles.footerNavItem} onPress={() => navigation.navigate('ParentDetails')}>
          <MaterialIcons name="person-outline" size={22} color="#1F1F22" />
          <Text style={styles.footerNavLabelMuted}>Profile</Text>
        </Pressable>
      </View>
      <View style={styles.footerBrandRow}>
        <Text style={styles.poweredBy}>Powered By</Text>
        <Image source={logoImage} style={styles.logo} resizeMode="contain" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E7EAF0',
    paddingTop: 8,
    paddingBottom: 8,
  },
  footerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  footerNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  backIcon: {
    width: 22,
    height: 22,
  },
  footerNavLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F1F22',
    marginTop: 2,
  },
  footerNavLabelMuted: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B3B3BB',
    marginTop: 2,
  },
  footerAddButton: {
    width: 52,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F44F45',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  poweredBy: {
    color: '#8B8B93',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
  },
  logo: {
    width: 62,
      height: 46,
  },
});

export default ParentFooter;
