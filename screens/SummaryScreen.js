import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, Share, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLang } from '../utils/LanguageContext';

const STORAGE_KEY = 'medications_v1';
const LOG_KEY = 'med_log_v1';

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function toISO(str) {
  if (!str) return '';
  const p = str.split('.');
  if (p.length !== 3) return '';
  return `${p[2]}-${p[1]}-${p[0]}`;
}

function isActiveMedOnDate(med, isoDate) {
  const start = toISO(med.startDate);
  const end   = toISO(med.endDate);
  if (start && isoDate < start) return false;
  if (end   && isoDate > end)   return false;
  return true;
}

export default function SummaryScreen({ navigation }) {
  const { t, toggleLang } = useLang();
  const [meds, setMeds] = useState([]);
  const [log, setLog]   = useState({});
  const [dateInput, setDateInput] = useState(todayStr());

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(d => { if (d) setMeds(JSON.parse(d)); });
    AsyncStorage.getItem(LOG_KEY).then(d => { if (d) setLog(JSON.parse(d)); });
  }, []));

  const isoDate    = toISO(dateInput.trim());
  const validDate  = /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
  const activeMeds = validDate ? meds.filter(m => isActiveMedOnDate(m, isoDate)) : [];

  const buildPlainText = () => {
    if (activeMeds.length === 0) {
      return `${t.reportTitle} ${dateInput}\n\n${t.noActiveMeds}`;
    }
    const lines = [`${t.reportTitle} ${dateInput}`, '═'.repeat(36), ''];
    activeMeds.forEach((med, i) => {
      lines.push(`${i + 1}. ${med.name.toUpperCase()}`);
      if (med.dosage) lines.push(`   ${t.dosageLabel} ${med.dosage}`);
      if (med.times && med.times.length > 0) {
        const timeDetails = med.times.map(tv => {
          const status = log[`${isoDate}_${med.id}_${tv}`];
          const label = status === 'taken' ? t.taken : status === 'missed' ? t.missed : t.planned;
          return `     ${tv} — ${label}`;
        });
        lines.push(...timeDetails);
      }
      if (med.startDate || med.endDate) {
        lines.push(`   ${t.courseLabel} ${med.startDate || '?'} → ${med.endDate || '∞'}`);
      }
      lines.push('');
    });
    lines.push('─'.repeat(36));
    return lines.join('\n');
  };

  const handleShare = async () => {
    if (!validDate) { Alert.alert(t.dateError); return; }
    const text = buildPlainText();
    try { await Share.share({ message: text, title: `${t.summary} ${dateInput}` }); } catch (_) {}
  };

  const dotColor = (medId, time) => {
    const s = log[`${isoDate}_${medId}_${time}`];
    if (s === 'taken')  return '#2E7D32';
    if (s === 'missed') return '#C62828';
    return '#E65100';
  };
  const dotLabel = (medId, time) => {
    const s = log[`${isoDate}_${medId}_${time}`];
    if (s === 'taken')  return '✅';
    if (s === 'missed') return '❌';
    return '⏰';
  };
  const statusWord = (medId, time) => {
    const s = log[`${isoDate}_${medId}_${time}`];
    if (s === 'taken')  return t.taken;
    if (s === 'missed') return t.missed;
    return t.planned;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t.summary}</Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{t.lang}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>{t.send}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>{t.reportDate}</Text>
        <TextInput
          style={styles.dateInput}
          value={dateInput}
          onChangeText={setDateInput}
          placeholder={t.datePlaceholder}
          keyboardType="numbers-and-punctuation"
          fontSize={22}
        />

        {!validDate && dateInput.length > 0 && (
          <Text style={styles.errorText}>{t.dateError}</Text>
        )}

        {validDate && (
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>{t.reportTitle}</Text>
            <Text style={styles.reportDate}>{dateInput.trim()}</Text>
            <Text style={styles.reportCount}>
              {activeMeds.length === 0 ? t.noActiveMeds : `${t.activeMeds}${activeMeds.length}`}
            </Text>
          </View>
        )}

        {activeMeds.map((med, i) => (
          <View key={med.id} style={styles.medCard}>
            <View style={styles.medCardHeader}>
              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{i + 1}</Text>
              </View>
              <Text style={styles.medName}>{med.name}</Text>
            </View>

            {!!med.dosage && (
              <View style={styles.row}>
                <Text style={styles.rowIcon}>💊</Text>
                <Text style={styles.rowText}>{t.dosageLabel} <Text style={styles.rowValue}>{med.dosage}</Text></Text>
              </View>
            )}

            {med.times && med.times.length > 0 && (
              <View style={styles.timesSection}>
                <Text style={styles.timesLabel}>{t.intakeSchedule}</Text>
                {med.times.map(tv => (
                  <View key={tv} style={styles.timeRow}>
                    <Text style={styles.timeText}>{tv}</Text>
                    <Text style={styles.timeStatus}>{dotLabel(med.id, tv)}</Text>
                    <View style={[styles.statusDot, { backgroundColor: dotColor(med.id, tv) }]} />
                    <Text style={[styles.statusWord, { color: dotColor(med.id, tv) }]}>{statusWord(med.id, tv)}</Text>
                  </View>
                ))}
              </View>
            )}

            {(!!med.startDate || !!med.endDate) && (
              <View style={styles.row}>
                <Text style={styles.rowIcon}>📅</Text>
                <Text style={styles.rowText}>
                  {t.courseLabel}{' '}
                  <Text style={styles.rowValue}>{med.startDate || '?'} → {med.endDate || '∞'}</Text>
                </Text>
              </View>
            )}

            {med.remindersEnabled && med.times?.length > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowIcon}>🔔</Text>
                <Text style={styles.rowText}>{t.reminderActive}</Text>
              </View>
            )}
          </View>
        ))}

        {validDate && activeMeds.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.noActiveOnDate}</Text>
          </View>
        )}

        {validDate && activeMeds.length > 0 && (
          <TouchableOpacity style={styles.shareBig} onPress={handleShare}>
            <Text style={styles.shareBigText}>{t.sendDoctor}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 24, gap: 8 },
  backBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  langBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  langBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  shareBtn: { backgroundColor: '#6A1B9A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  container: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 17, color: '#555', marginBottom: 8 },
  dateInput: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#1565C0', borderRadius: 14, padding: 16, fontSize: 22, textAlign: 'center', fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  errorText: { color: '#C62828', fontSize: 15, textAlign: 'center', marginBottom: 8 },
  reportHeader: { backgroundColor: '#1565C0', borderRadius: 16, padding: 20, alignItems: 'center', marginVertical: 16 },
  reportTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  reportDate: { fontSize: 30, fontWeight: '700', color: '#fff', marginTop: 4 },
  reportCount: { fontSize: 17, color: '#B3C6E7', marginTop: 6 },
  medCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, borderLeftWidth: 5, borderLeftColor: '#1565C0' },
  medCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  indexBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center' },
  indexText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  medName: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  rowIcon: { fontSize: 18 },
  rowText: { fontSize: 17, color: '#555' },
  rowValue: { fontWeight: '600', color: '#1A1A2E' },
  timesSection: { marginTop: 10, backgroundColor: '#F0F4FF', borderRadius: 10, padding: 12 },
  timesLabel: { fontSize: 16, color: '#555', fontWeight: '600', marginBottom: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  timeText: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', width: 60 },
  timeStatus: { fontSize: 20 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusWord: { fontSize: 16, fontWeight: '600' },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#888', textAlign: 'center' },
  shareBig: { backgroundColor: '#6A1B9A', borderRadius: 14, padding: 20, alignItems: 'center', marginTop: 8 },
  shareBigText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
