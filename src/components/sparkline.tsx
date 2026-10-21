import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * Minimal line chart for grade and GPA trends. Values are plotted in order (one point per
 * recorded change), with an optional dashed reference line (e.g. 90 for an A).
 */
export function Sparkline({
  values,
  height = 64,
  reference,
  color,
}: {
  values: number[];
  height?: number;
  reference?: number;
  color?: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const stroke = color ?? theme.tint;
  const pad = 4;
  const all = reference !== undefined ? [...values, reference] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (values.length - 1));
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  return (
    <View onLayout={onLayout} style={{ height }} accessibilityLabel={`Trend from ${values[0]?.toFixed(2)} to ${values.at(-1)?.toFixed(2)}`}>
      {width > 0 && values.length > 0 ? (
        <Svg width={width} height={height}>
          {reference !== undefined ? (
            <Line x1={0} x2={width} y1={y(reference)} y2={y(reference)} stroke={theme.border} strokeDasharray="4 4" />
          ) : null}
          {values.length > 1 ? (
            <Polyline
              points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ) : null}
          <Circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill={stroke} />
        </Svg>
      ) : null}
    </View>
  );
}
