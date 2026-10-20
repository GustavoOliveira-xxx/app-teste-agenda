import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import type { DateFormat, Occurrence, TimeFormat } from '@/models/types';
import { useAppTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { formatOccurrenceTime } from '@/utils/dates';

import { AppText } from './AppText';
import { Badge } from './Badge';
import { Icon } from './Icon';

export interface EventRowProps {
  occurrence: Occurrence;
  calendarName?: string;
  calendarColor?: string;
  timezone: string;
  timeFormat?: TimeFormat;
  dateFormat?: DateFormat;
  conflict?: boolean;
  onPress: (occurrence: Occurrence) => void;
}

/** Uma linha de evento nas listas do calendário. */
export const EventRow = memo(function EventRow({
  occurrence: occ,
  calendarName,
  calendarColor,
  timezone,
  timeFormat,
  dateFormat,
  conflict,
  onPress,
}: EventRowProps) {
  const { colors } = useAppTheme();
  const e = occ.event;
  const title = e.is_masked ? t('events.maskedTitle') : (occ.title ?? '');
  const cancelled = e.status === 'cancelled';
  const time = formatOccurrenceTime(occ, timezone, timeFormat, dateFormat);
  const color = e.color ?? calendarColor ?? colors.primary;

  const labels = [
    title,
    time,
    calendarName,
    occ.location,
    cancelled ? t('events.cancelledBadge') : null,
    occ.isRecurring ? t('events.recurring') : null,
    e.privacy === 'private' && !e.is_masked ? t('events.privateBadge') : null,
    e.privacy === 'busy' ? t('events.busyBadge') : null,
    e.privacy === 'participants' ? t('events.participantsBadge') : null,
    e.pending ? t('events.pendingBadge') : null,
    conflict ? t('calendarView.conflictBadge') : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => onPress(occ)}
      accessibilityRole="button"
      accessibilityLabel={labels.join(', ')}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: color, opacity: cancelled ? 0.4 : 1 }]} />
      <View style={styles.body}>
        <AppText variant="small" tone="muted">
          {time}
        </AppText>
        <AppText
          numberOfLines={2}
          style={[styles.title, cancelled && { textDecorationLine: 'line-through', color: colors.textMuted }]}
        >
          {title}
        </AppText>
        {(calendarName || occ.location) && (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {[calendarName, occ.location].filter(Boolean).join(' · ')}
          </AppText>
        )}
        <View style={styles.badges}>
          {cancelled && <Badge label={t('events.cancelledBadge')} tone="danger" />}
          {occ.isRecurring && <Badge label={t('events.recurring')} icon="repeat" />}
          {e.privacy === 'busy' && <Badge label={t('events.busyBadge')} icon="eye-off-outline" />}
          {!e.is_masked && e.privacy === 'private' && (
            <Badge label={t('events.privateBadge')} icon="lock-closed-outline" />
          )}
          {e.privacy === 'participants' && (
            <Badge label={t('events.participantsBadge')} icon="people-outline" />
          )}
          {e.pending && <Badge label={t('events.pendingBadge')} tone="warning" icon="cloud-upload-outline" />}
          {conflict && (
            <Badge label={t('calendarView.conflictBadge')} tone="warning" icon="warning-outline" />
          )}
        </View>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 16,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  bar: { width: 6, alignSelf: 'stretch' },
  body: { flex: 1, paddingVertical: spacing.sm, gap: 2 },
  title: { fontWeight: '600' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
});
