import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, TextInput, Modal, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const COLORS = {
  primary: '#1565C0',
  background: '#F0F4FF',
  card: '#FFFFFF',
  text: '#1A1A2E',
  subtext: '#555',
  green: '#2E7D32',
  orange: '#E65100',
  red: '#C62828',
};

const NAV_SCREENS = [
  { key: 'navMeds',      screen: 'Medications', color: '#1565C0' },
  { key: 'navDoctor',    screen: 'Doctor',      color: '#2E7D32' },
  { key: 'navWellbeing', screen: 'Wellbeing',   color: '#AD1457' },
  { key: 'navContacts',  screen: 'Contacts',    color: '#E65100' },
];

export default function HomeScreen({ navigation }) {
  const { t, toggleLang } = useLang();
  const [userName, setUserName] = useState('');
  const [editing, setEditing] = useState(false);
  const [inputName, setInputName] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('userName').then(name => {
      if (name) setUserName(name);
      else setEditing(true);
    });
  }, []);

  const saveName = async () => {
    const trimmed = inputName.trim();
    if (!trimmed) { Alert.alert(t.nameError); return; }
    await AsyncStorage.setItem('userName', trimmed);
    setUserName(trimmed);
    setEditing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t.greetingMorning;
    if (h < 18) return t.greetingDay;
    return t.greetingEvening;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greeting()},</Text>
              <TouchableOpacity onPress={() => { setInputName(userName); setEditing(true); }}>
                <Text style={styles.name}>{userName || t.namePlaceholder} ✏️</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
              <Text style={styles.langBtnText}>{t.langOther}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.grid}>
          {NAV_SCREENS.map(btn => (
            <TouchableOpacity
              key={btn.screen}
              style={[styles.navBtn, { backgroundColor: btn.color }]}
              onPress={() => navigation.navigate(btn.screen)}
              activeOpacity={0.8}
            >
              <Text style={styles.navBtnText}>{t[btn.key]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
      </ScrollView>

      <Modal visible={editing} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t.namePrompt}</Text>
            <TextInput
              style={styles.input}
              value={inputName}
              onChangeText={setInputName}
              placeholder={t.nameInputPlaceholder}
              fontSize={20}
              autoFocus
            />
            <TouchableOpacity style={styles.modalBtn} onPress={saveName}>
              <Text style={styles.modalBtnText}>{t.save}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 20, paddingTop: 40 },
  header: { marginBottom: 32 },
  greetingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  greeting: { fontSize: 26, color: COLORS.subtext, fontWeight: '400' },
  name: { fontSize: 32, color: COLORS.primary, fontWeight: '700', marginTop: 4 },
  langBtn: {
    backgroundColor: COLORS.primary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginTop: 4,
    alignSelf: 'flex-start',
  },
  langBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  grid: { gap: 16 },
  navBtn: {
    height: 80, borderRadius: 16, justifyContent: 'center',
    alignItems: 'center', elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  navBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  dateText: { marginTop: 36, textAlign: 'center', fontSize: 17, color: COLORS.subtext },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 28 },
  modalTitle: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  input: {
    borderWidth: 2, borderColor: COLORS.primary, borderRadius: 12,
    padding: 14, fontSize: 20, marginBottom: 20,
  },
  modalBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
