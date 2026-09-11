import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PARTICIPANT_GENRES, labelForGenre } from './genres';
import type { ParticipantFilterModel } from './use-participant-filter';

function summary(genres: readonly Parameters<typeof labelForGenre>[0][], from: number, to: number): string {
  return `${genres.length ? genres.map(labelForGenre).join(', ') : 'Any genre'}; ${from}–${to}`;
}

export function ParticipantFilterForm({ model }: { model: ParticipantFilterModel }) {
  const progress = `${model.filterCompletedCount} of ${model.requiredVoterCount} filters collected`;
  if (model.filtersComplete) return <View style={styles.section}>
    <Text accessibilityLiveRegion="polite">{progress}</Text>
    <Text accessibilityRole="header">All filters collected. Feature 005 is next.</Text>
    {model.accepted
      ? <Text>Your filters: {summary(model.accepted.genres, model.accepted.releaseYearFrom, model.accepted.releaseYearTo)}</Text>
      : model.recovery === 'error' ? <>
        <Text accessibilityLiveRegion="polite">{model.message}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry filter recovery" onPress={model.retryRecovery} style={styles.control}>
          <Text>Retry filter recovery</Text>
        </Pressable>
      </> : <Text accessibilityLiveRegion="polite">Loading your filters…</Text>}
  </View>;

  if (model.recovery === 'loading') return <View style={styles.section}>
    <Text>{progress}</Text><Text accessibilityLiveRegion="polite">Loading your filters…</Text>
  </View>;
  if (model.recovery === 'error' && !model.draft) return <View style={styles.section}>
    <Text>{progress}</Text><Text accessibilityLiveRegion="polite">{model.message}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Retry filter recovery" onPress={model.retryRecovery} style={styles.control}>
      <Text>Retry filter recovery</Text>
    </Pressable>
  </View>;
  if (!model.draft) return <View style={styles.section}><Text>{progress}</Text></View>;

  return <View style={styles.section}>
    <Text accessibilityLiveRegion="polite">{progress}</Text>
    {model.accepted && <Text>Saved filters: {summary(model.accepted.genres,
      model.accepted.releaseYearFrom, model.accepted.releaseYearTo)}</Text>}
    {model.recovery === 'saved' && <Text>Your filters are saved. Waiting for the other voters.</Text>}
    <Text accessibilityRole="header">Choose your filters</Text>
    <Text>{model.draft.genres.length === 0 ? 'Any genre' : 'Selected genres'}</Text>
    <View accessibilityRole="list" style={styles.genreList}>
      {PARTICIPANT_GENRES.map(({ value, label }) => {
        const selected = model.draft!.genres.includes(value);
        return <Pressable key={value} accessibilityRole="checkbox" accessibilityLabel={label}
          accessibilityState={{ checked: selected, disabled: !model.canSave }} disabled={!model.canSave}
          onPress={() => model.toggleGenre(value)} style={[styles.control, selected && styles.selected]}>
          <Text>{label}</Text>
        </Pressable>;
      })}
    </View>
    <TextInput accessibilityLabel="Release year from" value={model.draft.releaseYearFrom}
      onChangeText={model.setReleaseYearFrom} editable={model.canSave} inputMode="numeric"
      returnKeyType="next" style={styles.input} />
    <TextInput accessibilityLabel="Release year to" value={model.draft.releaseYearTo}
      onChangeText={model.setReleaseYearTo} editable={model.canSave} inputMode="numeric"
      returnKeyType="done" style={styles.input} />
    {model.message && <Text accessibilityLiveRegion="polite">{model.message}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Save filters" disabled={!model.canSave}
      accessibilityState={{ disabled: !model.canSave }} onPress={model.save} style={styles.control}>
      <Text>{model.submission === 'submitting' ? 'Saving…' : 'Save filters'}</Text>
    </Pressable>
    {model.submission === 'error' && <Pressable accessibilityRole="button" accessibilityLabel="Retry saving filters"
      onPress={model.retrySave} style={styles.control}><Text>Retry saving filters</Text></Pressable>}
    {model.submission === 'error' && <Pressable accessibilityRole="button" accessibilityLabel="Recover filters"
      onPress={model.retryRecovery} style={styles.control}><Text>Recover filters</Text></Pressable>}
    {model.accepted && <Pressable accessibilityRole="button" accessibilityLabel="Reset unsaved filters"
      disabled={!model.canSave} onPress={model.resetDraft} style={styles.control}><Text>Reset to saved filters</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 12, width: '100%' },
  genreList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  control: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#767676', borderRadius: 8 },
  selected: { backgroundColor: '#DCE8FF', borderColor: '#2457A7' },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#767676', borderRadius: 8, paddingHorizontal: 12 },
});
