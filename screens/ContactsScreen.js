import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, Modal, TextInput, Alert, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';
import { RELATIONS } from '../utils/i18n';
import Dropdown from '../components/Dropdown';

const STORAGE_KEY = 'contacts_v1';

export default function ContactsScreen({ navigation }) {
  const { t, lang, toggleLang } = useLang();
  const [contacts, setContacts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', relation: '' });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(d => { if (d) setContacts(JSON.parse(d)); });
  }, []);

  const save = async (updated) => {
    setContacts(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addContact = async () => {
    if (!form.name.trim()) { Alert.alert(t.nameRequired2); return; }
    if (!form.phone.trim()) { Alert.alert(t.phoneRequired); return; }
    await save([{ id: Date.now().toString(), ...form }, ...contacts]);
    setModalVisible(false);
    setForm({ name: '', phone: '', relation: '' });
  };

  const callContact = (phone) => {
    const url = `tel:${phone.replace(/\s/g, '')}`;
    Linking.canOpenURL(url).then(ok => {
      if (ok) Linking.openURL(url);
    });
  };

  const deleteContact = (id) => {
    Alert.alert(t.deleteConfirm, t.deleteContact, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => save(contacts.filter(c => c.id !== id)) },
    ]);
  };

  const renderContact = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.contactName}>{item.name}</Text>
        {!!item.relation && <Text style={styles.relation}>{item.relation}</Text>}
        <Text style={styles.phone}>{item.phone}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.callBtn} onPress={() => callContact(item.phone)}>
          <Text style={styles.callBtnText}>{t.call}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteContact(item.id)}>
          <Text style={styles.deleteBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t.contacts}</Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
          <Text style={styles.langBtnText}>{t.lang}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>{t.add}</Text>
        </TouchableOpacity>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t.noContacts}</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={i => i.id}
          renderItem={renderContact}
          contentContainerStyle={{ padding: 16, gap: 12 }}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t.newContact}</Text>

            <Text style={styles.label}>{t.contactName}</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder={t.contactNamePh} fontSize={18} />

            <Text style={styles.label}>{t.relation}</Text>
            <Dropdown
              label={t.relation}
              value={form.relation}
              onChange={v => setForm(p => ({ ...p, relation: v }))}
              options={RELATIONS[lang]}
              placeholder={t.relationPh}
              borderColor="#E65100"
              customLabel={t.custom}
            />

            <Text style={styles.label}>{t.phone}</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={v => setForm(p => ({ ...p, phone: v }))} placeholder={t.phonePh} keyboardType="phone-pad" fontSize={18} />

            <TouchableOpacity style={styles.saveBtn} onPress={addContact}>
              <Text style={styles.saveBtnText}>{t.save}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4FF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 24, gap: 8 },
  backBtn: { backgroundColor: '#E65100', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  langBtn: { backgroundColor: '#E65100', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  langBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  addBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  addBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E65100', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, color: '#fff', fontWeight: '700' },
  info: { flex: 1 },
  contactName: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  relation: { fontSize: 17, color: '#888', marginTop: 2 },
  phone: { fontSize: 17, color: '#1565C0', marginTop: 4, fontWeight: '600' },
  actions: { alignItems: 'flex-end', gap: 8 },
  callBtn: { backgroundColor: '#2E7D32', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  callBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 22 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 20, color: '#555', textAlign: 'center', lineHeight: 32 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 26, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  label: { fontSize: 17, color: '#555', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 2, borderColor: '#E65100', borderRadius: 12, padding: 14, fontSize: 18 },
  saveBtn: { marginTop: 24, backgroundColor: '#E65100', borderRadius: 12, padding: 18, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cancelBtn: { marginTop: 10, borderRadius: 12, padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontSize: 18 },
});
