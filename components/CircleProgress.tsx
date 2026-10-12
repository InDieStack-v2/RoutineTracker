import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type ProgressCircleProps = {
  progressPercent: number;
  displayText: string;
  textColor?: string;
  size?: number;
};

export const ProgressCircle = ({
  progressPercent,
  displayText,
  textColor,
  size = 32,
}: ProgressCircleProps) => {
  const strokeWidth = Math.max(2, size * 0.1);
  const radius = size / 2;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const percent = Math.max(
    0,
    Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0),
  );
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg height={size} width={size}>
        <Circle
          stroke="#f3f4f6"
          fill="none"
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          strokeWidth={strokeWidth}
        />
        {percent > 0 ? (
          <Circle
            stroke="#8882e7"
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
        ) : null}
      </Svg>
      <View style={styles.textContainer}>
        <Text
          style={{
            fontSize: Math.max(10, Math.round(size * 0.34)),
            fontWeight: '600',
            color: textColor ?? '#4b5563',
          }}
        >
          {displayText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProgressCircle;
