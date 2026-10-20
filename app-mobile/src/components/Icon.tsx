import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Ícone decorativo (o texto ao lado é que descreve a ação para leitores de tela). */
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
