// Editor de repetição (eventos, tarefas, lembretes e hábitos): atalhos
// prontos e o modo personalizado (intervalo, dias, término).
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { strings, t } from '@/i18n';
import { spacing } from '@/theme/tokens';
import { addDaysToKey } from '@/utils/dates';
import {
  describeRule,
  presetToRule,
  ruleToPreset,
  WEEKDAY_CODES,
  type Frequency,
  type RecurrencePreset,
  type RecurrenceRule,
} from '@/utils/recurrence';

import { AppText } from './AppText';
import { Card } from './Card';
import { Chip } from './Chip';
import { DateTimeField } from './DateTimeField';
import { SelectField } from './SelectField';
import { TextField } from './TextField';

export function RecurrenceEditor({
  rule,
  startDate,
  onChange,
  error,
  simple,
}: {
  rule: RecurrenceRule | null;
  startDate: string;
  onChange: (rule: RecurrenceRule | null) => void;
  error?: string;
  /** Só intervalo e unidade (repetição contada a partir da conclusão). */
  simple?: boolean;
}) {
  const r = strings.recurrence;
  const preset = ruleToPreset(rule, startDate);
  const [custom, setCustom] = useState(preset === 'custom');
  // Contando a partir da conclusão não há dias fixos: só intervalo e unidade.
  const plain = (r: RecurrenceRule | null) =>
    r && simple ? { ...r, byDay: [], byMonthDay: null, until: null, count: null } : r;
  const choose = (value: RecurrencePreset) => {
    if (value === 'custom') {
      setCustom(true);
      onChange(plain(rule ?? presetToRule(simple ? 'daily' : 'weekly', startDate)));
    } else {
      setCustom(false);
      onChange(plain(presetToRule(value, startDate)));
    }
  };
  const end: 'never' | 'until' | 'count' = rule?.until ? 'until' : rule?.count ? 'count' : 'never';

  return (
    <View style={styles.gap}>
      <SelectField<RecurrencePreset>
        label={t('events.repeat')}
        value={custom ? 'custom' : preset}
        onChange={choose}
        options={(['none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom'] as const).map(
          (p) => ({
            value: p,
            label: r[p],
          }),
        )}
      />
      {rule && custom && (
        <Card>
          <SelectField<Frequency>
            label={r.frequency}
            value={rule.freq}
            onChange={(freq) =>
              onChange({ ...rule, freq, byDay: freq === 'WEEKLY' ? rule.byDay : [], byMonthDay: null })
            }
            options={[
              { value: 'DAILY', label: r.unitDays },
              { value: 'WEEKLY', label: r.unitWeeks },
              { value: 'MONTHLY', label: r.unitMonths },
              { value: 'YEARLY', label: r.unitYears },
            ]}
          />
          <TextField
            label={r.interval}
            value={String(rule.interval)}
            keyboardType="number-pad"
            onChangeText={(v) =>
              onChange({ ...rule, interval: Math.max(1, Math.min(99, Number(v.replace(/\D/g, '')) || 1)) })
            }
          />
          {rule.freq === 'WEEKLY' && !simple && (
            <View style={styles.gap}>
              <AppText variant="label">{r.weekdaysLabel}</AppText>
              <View style={styles.chips}>
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                  const code = WEEKDAY_CODES[wd];
                  const selected = rule.byDay.includes(code);
                  return (
                    <Chip
                      key={code}
                      label={strings.weekdays.short[wd]}
                      accessibilityLabel={strings.weekdays.long[wd]}
                      selected={selected}
                      onPress={() =>
                        onChange({
                          ...rule,
                          byDay: selected ? rule.byDay.filter((d) => d !== code) : [...rule.byDay, code],
                        })
                      }
                    />
                  );
                })}
              </View>
            </View>
          )}
          {rule.freq === 'MONTHLY' && !simple && Number(startDate.slice(8)) > 28 && (
            <AppText variant="small" tone="muted">
              {r.month31Note}
            </AppText>
          )}
          {!simple && (
            <SelectField<'never' | 'until' | 'count'>
              label={r.endLabel}
              value={end}
              onChange={(v) =>
                onChange({
                  ...rule,
                  until: v === 'until' ? (rule.until ?? addDaysToKey(startDate, 90)) : null,
                  count: v === 'count' ? (rule.count ?? 10) : null,
                })
              }
              options={[
                { value: 'never', label: r.endNever },
                { value: 'until', label: r.endUntil },
                { value: 'count', label: r.endCount },
              ]}
            />
          )}
          {!simple && end === 'until' && rule.until && (
            <DateTimeField
              mode="date"
              label={r.endUntil}
              value={rule.until}
              onChange={(v) => onChange({ ...rule, until: v })}
            />
          )}
          {!simple && end === 'count' && (
            <TextField
              label={r.endCount}
              value={String(rule.count ?? '')}
              keyboardType="number-pad"
              onChangeText={(v) =>
                onChange({ ...rule, count: Math.min(999, Number(v.replace(/\D/g, '')) || 1) })
              }
            />
          )}
        </Card>
      )}
      {rule && (
        <AppText variant="small" tone="muted">
          {describeRule(rule, startDate)}
        </AppText>
      )}
      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
