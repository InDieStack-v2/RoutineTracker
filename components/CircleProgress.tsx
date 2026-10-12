import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type ProgressCircleProps = {
  progressPercent: number;
  displayText: string;
  textColor?: string;
};

export const ProgressCircle = ({ progressPercent, displayText, textColor }: ProgressCircleProps) => {
  const radius = 20;
  const strokeWidth = 3;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <View style={styles.container}>
      <Svg height={radius * 2} width={radius * 2}>
        <Circle
          stroke="#eeeeee"
          fill="none"
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke="#877cd4"
          fill="none"
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${radius} ${radius})`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={{...styles.text, color: textColor ?? 'black'}}>{displayText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ProgressCircle;
