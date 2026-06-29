import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const STORAGE_KEY = 'wellbeing_v1';

export default function WellbeingScreen({ navigation }) {
  const { t, toggleLang } = useLang();
  const [records, setRecords] = useState([]);
  const [mood, setMood] = useState(null);
  const [pressure, setPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [notes, setNotes] = useState('');

  const MOODS = [
    { emoji: '😊', labelKey: 'moodGood',    value: 'good' },
    { emoji: '😐', labelKey: 'moodOkay',    value: 'okay' },
    { emoji: '😔', labelKey: 'moodBad',     value: 'bad' },
    { emoji: '😣', labelKey: 'moodTerrible',value: 'terrible' },
  ];

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(d => { if (d) setRecords(JSON.parse(d)); });
  }, []);

  const save = async () => {
    if (!mood) { Alert.alert(t.chooseWellbeing); return; }
    const rec = {
      id: Date.now().toString(),
      date: new Date().toLocaleString('uk-UA'),
      mood, pressure, pulse, notes,
    };
    const updated = [rec, ...records];
    setRecords(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setMood(null); setPressure(''); setPulse(''); setNotes('');
    Alert.alert(t.saved);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t.wellbeing}</Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{t.lang}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>{t.howFeel}</Text>
        <View style={styles.moodRow}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m.value}
              style={[styles.moodBtn, mood === m.value && styles.moodBtnActive]}
              onPress={() => setMood(m.value)}
            >
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
              <Text style={styles.moodLabel}>{t[m.labelKey]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>{t.pressure}</Text>
            <TextInput style={styles.input} value={pressure} onChangeText={setPressure} placeholder={t.pressurePh} keyboardType="numbers-and-punctuation" fontSize={18} />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>{t.pulse}</Text>
            <TextInput style={styles.input} value={pulse} onChangeText={setPulse} placeholder={t.pulsePh} keyboardType="number-pad" fontSize={18} />
          </View>
        </View>

        <Text style={styles.label}>{t.wellNotes}</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t.wellNotesPh}
          multiline
          fontSize={18}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>{t.saveRecord}</Text>
        </TouchableOpacity>

        {records.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t.history}</Text>
            {records.slice(0, 5).map(r => {
              const moodCfg = MOODS.find(m => m.value === r.mood);
              return (
                <View key={r.id} style={styles.recordCard}>
                  <Text style={styles.recordDate}>{r.date}</Text>
                  <Text style={styles.recordMood}>{moodCfg?.emoji} {moodCfg ? t[moodCfg.labelKey] : r.mood}</Text>
                  {!!r.pressure && <Text style={styles.recordDetail}>{t.pressure}: {r.pressure}</Text>}
                  {!!r.pulse    && <Text style={styles.recordDetail}>{t.pulse}: {r.pulse}</Text>}
                  {!!r.notes    && <Text style={styles.recordDetail}>📝 {r.notes}</Text>}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 24, gap: 8 },
  backBtn: { backgroundColor: '#AD1457', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  langBtn: { backgroundColor: '#AD1457', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  langBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  container: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginTop: 20, marginBottom: 12 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodBtn: { flex: 1, minWidth: 140, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#ddd', elevation: 1 },
  moodBtnActive: { borderColor: '#AD1457', backgroundColor: '#FCE4EC' },
  moodEmoji: { fontSize: 36 },
  moodLabel: { fontSize: 17, color: '#333', marginTop: 4, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { fontSize: 17, color: '#555', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 2, borderColor: '#AD1457', borderRadius: 12, padding: 14, backgroundColor: '#fff' },
  saveBtn: { marginTop: 20, backgroundColor: '#AD1457', borderRadius: 12, padding: 18, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  recordCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 10, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#AD1457' },
  recordDate: { fontSize: 14, color: '#888' },
  recordMood: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  recordDetail: { fontSize: 17, color: '#555', marginTop: 4 },
});
