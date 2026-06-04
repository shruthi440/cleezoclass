import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
};

const summaryGradientColors = ['#D7C5FF', '#A670EE', '#6D2DE1'] as const;

const TeacherSummaryCard: React.FC<Props> = ({ children, style, onPress }) => {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper onPress={onPress} style={[styles.outer, style]}>
      <LinearGradient
        colors={[...summaryGradientColors]}
        start={{ x: 0.05, y: 0.05 }}
        end={{ x: 0.95, y: 0.95 }}
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  outer: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  gradient: {
    flex: 1,
    width: '100%',
    minHeight: 92,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
});

export default TeacherSummaryCard;
