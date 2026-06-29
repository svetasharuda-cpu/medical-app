import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLang } from '../utils/LanguageContext';

const STORAGE_KEY = 'medications_v1';
const LOG_KEY = 'med_log_v1';
const { width } = Dimensions.get('window');

const DAY_NAMES_UA = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_FR = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const MED_COLORS = ['#1565C0', '#2E7D32', '#AD1457', '#E65100', '#6A1B9A', '#00838F', '#C62828'];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function get7Days() {
  const days = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function ScheduleScreen({ navigation }) {
  const { t, lang, toggleLang } = useLang();
  const [meds, setMeds] = useState([]);
  const [log, setLog] = useState({});
  const [tab, setTab] = useState('today');
  const days = get7Days();
  const today = todayKey();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const DAY_NAMES = lang === 'fr' ? DAY_NAMES_FR : DAY_NAMES_UA;

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(d => { if (d) setMeds(JSON.parse(d)); });
    AsyncStorage.getItem(LOG_KEY).then(d => { if (d) setLog(JSON.parse(d)); });
  }, []));

  const saveLog = async (updated) => {
    setLog(updated);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(updated));
  };

  const toggleLog = async (medId, dayStr, time) => {
    const key = `${dayStr}_${medId}_${time}`;
    const current = log[key];
    const next = current === 'taken' ? 'missed' : current === 'missed' ? undefined : 'taken';
    const updated = { ...log };
    if (next === undefined) delete updated[key];
    else updated[key] = next;
    await saveLog(updated);
  };

  const getLogStatus = (medId, dayStr, time) => log[`${dayStr}_${medId}_${time}`];

  const dotLabel = (status, isPast) => {
    if (status === 'taken') return '✅';
    if (status === 'missed') return '❌';
    if (isPast) return '❌';
    return '⏰';
  };

  const renderTimeline = () => {
    const medsWithTimes = meds.filter(m => m.times && m.times.length > 0);
    if (medsWithTimes.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t.noSchedule}</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.sectionLabel}>
          {new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        {HOURS.map(hour => {
          const entries = [];
          medsWithTimes.forEach((med, mi) => {
            (med.times || []).forEach(tv => {
              const [h] = tv.split(':').map(Number);
              if (h === hour) {
                const status = getLogStatus(med.id, today, tv);
                const isPast = timeToMinutes(tv) < nowMinutes;
                entries.push({ med, tv, status, isPast, colorIdx: mi % MED_COLORS.length });
              }
            });
          });

          return (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{String(hour).padStart(2, '0')}:00</Text>
              <View style={styles.hourLine} />
              <View style={styles.hourEntries}>
                {entries.map(({ med, tv, status, isPast, colorIdx }) => (
                  <TouchableOpacity
                    key={`${med.id}_${tv}`}
                    style={[styles.timeEntry, { borderLeftColor: MED_COLORS[colorIdx] }]}
                    onPress={() => toggleLog(med.id, today, tv)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.timeEntryTop}>
                      <Text style={styles.timeEntryTime}>{tv}</Text>
                      <Text style={styles.timeEntryEmoji}>{dotLabel(status, isPast)}</Text>
                    </View>
                    <Text style={[styles.timeEntryName, { color: MED_COLORS[colorIdx] }]}>{med.name}</Text>
                    {!!med.dosage && <Text style={styles.timeEntryDosage}>{med.dosage}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderWeekly = () => {
    const medsWithTimes = meds.filter(m => m.times && m.times.length > 0);
    if (medsWithTimes.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t.noSchedule}</Text>
        </View>
      );
    }

    const colW = Math.floor((width - 32 - 120) / 7);

    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.tableRow}>
          <View style={{ width: 120 }} />
          {days.map(d => {
            const isToday = dateKey(d) === today;
            return (
              <View key={dateKey(d)} style={[styles.dayHeader, { width: colW }, isToday && styles.dayHeaderToday]}>
                <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{DAY_NAMES[d.getDay()]}</Text>
                <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{d.getDate()}</Text>
              </View>
            );
          })}
        </View>

        {medsWithTimes.map((med, mi) => {
          const color = MED_COLORS[mi % MED_COLORS.length];
          return (
            <View key={med.id} style={styles.medBlock}>
              <View style={[styles.medLabelBar, { borderLeftColor: color }]}>
                <Text style={[styles.medLabelName, { color }]} numberOfLines={2}>{med.name}</Text>
                {!!med.dosage && <Text style={styles.medLabelDose}>{med.dosage}</Text>}
              </View>
              {(med.times || []).map(tv => (
                <View key={tv} style={styles.tableRow}>
                  <Text style={styles.timeCol}>{tv}</Text>
                  {days.map(d => {
                    const dayStr = dateKey(d);
                    const isPast = dayStr < today || (dayStr === today && timeToMinutes(tv) < nowMinutes);
                    const isFuture = dayStr > today || (dayStr === today && timeToMinutes(tv) >= nowMinutes);
                    const status = getLogStatus(med.id, dayStr, tv);
                    const bg = status === 'taken' ? '#E8F5E9' : status === 'missed' ? '#FFEBEE' : isPast ? '#FFEBEE' : isFuture ? '#FFF9C4' : '#f5f5f5';
                    const emoji = status === 'taken' ? '✅' : status === 'missed' ? '❌' : isPast ? '❌' : '⏰';
                    return (
                      <TouchableOpacity
                        key={dayStr}
                        style={[styles.cell, { width: colW, backgroundColor: bg }]}
                        onPress={() => toggleLog(med.id, dayStr, tv)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cellEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.legend}>
          {[['✅', t.taken], ['⏰', t.planned], ['❌', t.missed]].map(([e, l]) => (
            <View key={l} style={styles.legendItem}>
              <Text style={styles.legendEmoji}>{e}</Text>
              <Text style={styles.legendLabel}>{l}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const calcAdherence = () => {
    let total = 0, taken = 0;
    meds.forEach(med => {
      (med.times || []).forEach(tv => {
        days.forEach(d => {
          const dayStr = dateKey(d);
          const isPast = dayStr < today || (dayStr === today && timeToMinutes(tv) < nowMinutes);
          if (!isPast) return;
          total++;
          if (log[`${dayStr}_${med.id}_${tv}`] === 'taken') taken++;
        });
      });
    });
    if (total === 0) return null;
    return Math.round((taken / total) * 100);
  };

  const adherence = calcAdherence();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t.schedule}</Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{t.lang}</Text>
        </TouchableOpacity>
      </View>

      {adherence !== null && (
        <View style={[styles.adherenceBanner, { backgroundColor: adherence >= 80 ? '#E8F5E9' : adherence >= 50 ? '#FFF3E0' : '#FFEBEE' }]}>
          <Text style={styles.adherenceLabel}>{t.adherence} (7 {lang === 'fr' ? 'j' : 'дн'})</Text>
          <Text style={[styles.adherenceValue, { color: adherence >= 80 ? '#2E7D32' : adherence >= 50 ? '#E65100' : '#C62828' }]}>
            {adherence}%
          </Text>
        </View>
      )}

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'today' && styles.tabActive]} onPress={() => setTab('today')}>
          <Text style={[styles.tabText, tab === 'today' && styles.tabTextActive]}>{t.today}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'week' && styles.tabActive]} onPress={() => setTab('week')}>
          <Text style={[styles.tabText, tab === 'week' && styles.tabTextActive]}>{t.week}</Text>
        </TouchableOpacity>
      </View>

      {tab === 'today' ? renderTimeline() : renderWeekly()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 24, gap: 8 },
  backBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  langBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  langBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  adherenceBanner: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adherenceLabel: { fontSize: 17, color: '#555', fontWeight: '500' },
  adherenceValue: { fontSize: 28, fontWeight: '700' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#1565C0' },
  tabText: { fontSize: 17, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  sectionLabel: { fontSize: 18, fontWeight: '600', color: '#555', padding: 16, paddingBottom: 8 },
  hourRow: { flexDirection: 'row', paddingHorizontal: 16, minHeight: 32, alignItems: 'flex-start', marginBottom: 2 },
  hourLabel: { width: 48, fontSize: 14, color: '#aaa', paddingTop: 6 },
  hourLine: { width: 1, backgroundColor: '#ddd', marginHorizontal: 8, marginTop: 8, alignSelf: 'stretch' },
  hourEntries: { flex: 1, paddingBottom: 6, gap: 6 },
  timeEntry: { backgroundColor: '#fff', borderRadius: 10, padding: 10, borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  timeEntryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeEntryTime: { fontSize: 14, color: '#888' },
  timeEntryEmoji: { fontSize: 18 },
  timeEntryName: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  timeEntryDosage: { fontSize: 15, color: '#777', marginTop: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, color: '#888', textAlign: 'center', lineHeight: 28 },
  tableRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dayHeader: { alignItems: 'center', paddingVertical: 4 },
  dayHeaderToday: { backgroundColor: '#1565C0', borderRadius: 8 },
  dayName: { fontSize: 13, color: '#888' },
  dayNameToday: { color: '#fff' },
  dayNum: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  dayNumToday: { color: '#fff' },
  medBlock: { marginBottom: 12 },
  medLabelBar: { borderLeftWidth: 4, paddingLeft: 10, marginBottom: 6, paddingVertical: 2 },
  medLabelName: { fontSize: 17, fontWeight: '700' },
  medLabelDose: { fontSize: 14, color: '#888' },
  timeCol: { width: 120, fontSize: 15, color: '#555', paddingLeft: 14 },
  cell: { alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: 6, marginHorizontal: 1 },
  cellEmoji: { fontSize: 18 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendEmoji: { fontSize: 16 },
  legendLabel: { fontSize: 14, color: '#555' },
});
