import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';
import { SPECIALTIES } from '../utils/i18n';
import Dropdown from '../components/Dropdown';

const STORAGE_KEY = 'doctor_visits_v1';

export default function DoctorScreen({ navigation }) {
  const { t, lang, toggleLang } = useLang();
  const [visits, setVisits] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ doctorName: '', specialty: '', date: '', time: '', address: '', notes: '' });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) setVisits(JSON.parse(data));
    });
  }, []);

  const save = async (updated) => {
    setVisits(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addVisit = async () => {
    if (!form.doctorName.trim()) { Alert.alert(t.doctorName.replace(' *', '')); return; }
    if (!form.date.trim()) { Alert.alert(t.date.replace(' *', '')); return; }
    await save([{ id: Date.now().toString(), ...form }, ...visits]);
    setModalVisible(false);
    setForm({ doctorName: '', specialty: '', date: '', time: '', address: '', notes: '' });
  };

  const deleteVisit = (id) => {
    Alert.alert(t.deleteConfirm, t.deleteVisit, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => save(visits.filter(v => v.id !== id)) },
    ]);
  };

  const isUpcoming = (dateStr) => {
    try {
      const [d, m, y] = dateStr.split('.').map(Number);
      return new Date(y, m - 1, d) >= new Date(new Date().setHours(0, 0, 0, 0));
    } catch { return true; }
  };

  const renderVisit = ({ item }) => {
    const upcoming = isUpcoming(item.date);
    return (
      <TouchableOpacity style={[styles.card, !upcoming && styles.cardPast]} onLongPress={() => deleteVisit(item.id)} activeOpacity={0.85}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>{item.date}</Text>
          {!!item.time && <Text style={styles.timeText}>{item.time}</Text>}
          {upcoming
            ? <Text style={styles.upcomingBadge}>{t.upcoming}</Text>
            : <Text style={styles.pastBadge}>{t.past}</Text>
          }
        </View>
        <View style={styles.divider} />
        <View style={styles.infoBlock}>
          <Text style={styles.doctorName}>{item.doctorName}</Text>
          {!!item.specialty && <Text style={styles.detail}>🩺 {item.specialty}</Text>}
          {!!item.address   && <Text style={styles.detail}>📍 {item.address}</Text>}
          {!!item.notes     && <Text style={styles.detail}>📝 {item.notes}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t.doctor}</Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{t.lang}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>{t.add}</Text>
        </TouchableOpacity>
      </View>

      {visits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t.noVisits}</Text>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={i => i.id}
          renderItem={renderVisit}
          contentContainerStyle={{ padding: 16, gap: 12 }}
        />
      )}
      <Text style={styles.hint}>{t.hint_holdDelete}</Text>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{t.newVisit}</Text>

            <Text style={styles.label}>{t.doctorName}</Text>
            <TextInput style={styles.input} value={form.doctorName} onChangeText={v => setForm(p => ({ ...p, doctorName: v }))} placeholder={t.doctorNamePh} fontSize={18} />

            <Text style={styles.label}>{t.specialty}</Text>
            <Dropdown
              label={t.specialty}
              value={form.specialty}
              onChange={v => setForm(p => ({ ...p, specialty: v }))}
              options={SPECIALTIES[lang]}
              placeholder={t.specialtyPh}
              borderColor="#2E7D32"
              customLabel={t.custom}
            />

            <Text style={styles.label}>{t.date}</Text>
            <TextInput style={styles.input} value={form.date} onChangeText={v => setForm(p => ({ ...p, date: v }))} placeholder={t.datePlaceholder} fontSize={18} keyboardType="numbers-and-punctuation" />

            <Text style={styles.label}>{t.time}</Text>
            <TextInput style={styles.input} value={form.time} onChangeText={v => setForm(p => ({ ...p, time: v }))} placeholder={t.timeDoctorPh} fontSize={18} />

            <Text style={styles.label}>{t.address}</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={v => setForm(p => ({ ...p, address: v }))} placeholder={t.addressPh} fontSize={18} />

            <Text style={styles.label}>{t.notes}</Text>
            <TextInput style={styles.input} value={form.notes} onChangeText={v => setForm(p => ({ ...p, notes: v }))} placeholder={t.notesPh} fontSize={18} />

            <TouchableOpacity style={styles.saveBtn} onPress={addVisit}>
              <Text style={styles.saveBtnText}>{t.save}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>{t.cancel}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 24, gap: 8 },
  backBtn: { backgroundColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  langBtn: { backgroundColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  langBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  addBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  addBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', gap: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, borderLeftWidth: 5, borderLeftColor: '#1565C0' },
  cardPast: { opacity: 0.7, borderLeftColor: '#aaa' },
  dateBlock: { width: 90, alignItems: 'center', justifyContent: 'center' },
  dateText: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  timeText: { fontSize: 20, fontWeight: '700', color: '#1565C0', marginTop: 4 },
  upcomingBadge: { fontSize: 13, color: '#2E7D32', fontWeight: '600', marginTop: 6, textAlign: 'center' },
  pastBadge: { fontSize: 13, color: '#888', fontWeight: '600', marginTop: 6 },
  divider: { width: 1, backgroundColor: '#E0E0E0' },
  infoBlock: { flex: 1 },
  doctorName: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  detail: { fontSize: 17, color: '#555', marginTop: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 20, color: '#555', textAlign: 'center', lineHeight: 32 },
  hint: { textAlign: 'center', fontSize: 14, color: '#888', padding: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 26, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  label: { fontSize: 17, color: '#555', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 2, borderColor: '#2E7D32', borderRadius: 12, padding: 14, fontSize: 18 },
  saveBtn: { marginTop: 24, backgroundColor: '#2E7D32', borderRadius: 12, padding: 18, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cancelBtn: { marginTop: 10, borderRadius: 12, padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontSize: 18 },
});
