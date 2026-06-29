import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, Modal, TextInput, Alert, ScrollView, Image, Switch,
  ActivityIndicator, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';
import {
  scheduleNotificationsForMed, cancelNotificationsForMed,
  scheduleEndOfCourseReminder, cancelEndOfCourseReminder,
  requestPermissions,
} from '../utils/notifications';
import { useLang } from '../utils/LanguageContext';
import { MED_NAMES, DOSAGES } from '../utils/i18n';
import Dropdown from '../components/Dropdown';

const STORAGE_KEY = 'medications_v1';
const API_KEY_STORAGE = 'anthropic_api_key';
const EMPTY_FORM = {
  name: '', dosage: '', times: [], startDate: '', endDate: '',
  status: 'soon', remindersEnabled: true,
};

function todayStr() {
  return new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '.').slice(0, 10);
}

export default function MedicationsScreen({ navigation }) {
  const { t, lang, toggleLang } = useLang();

  const STATUS_CONFIG = {
    taken:  { color: '#2E7D32', bg: '#E8F5E9', label: t.statusTaken },
    soon:   { color: '#E65100', bg: '#FFF3E0', label: t.statusSoon },
    missed: { color: '#C62828', bg: '#FFEBEE', label: t.statusMissed },
  };

  const [meds, setMeds] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [receiptImage, setReceiptImage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newTime, setNewTime] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmClearTimer = useRef(null);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(d => { if (d) setMeds(JSON.parse(d)); });
    AsyncStorage.getItem(API_KEY_STORAGE).then(k => { if (k) setApiKey(k); });
  }, []));

  const saveApiKey = async () => {
    await AsyncStorage.setItem(API_KEY_STORAGE, apiKeyDraft.trim());
    setApiKey(apiKeyDraft.trim());
    setShowApiKeyInput(false);
  };

  const save = async (updated) => {
    setMeds(updated);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch (_) {}
  };

  const openAdd = () => {
    requestPermissions().catch(() => {});
    setForm({ ...EMPTY_FORM, startDate: todayStr() });
    setReceiptImage(null);
    setNewTime('');
    setShowApiKeyInput(!apiKey);
    setApiKeyDraft('');
    setAiFilled(false);
    setModalVisible(true);
  };

  const addTime = () => {
    const tv = newTime.trim();
    if (!/^\d{1,2}:\d{2}$/.test(tv)) { Alert.alert(t.timeFormatError); return; }
    const [h, m] = tv.split(':').map(Number);
    if (h > 23 || m > 59) { Alert.alert(t.timeInvalidError); return; }
    const padded = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (form.times.includes(padded)) { Alert.alert(t.timeDupError); return; }
    setForm(f => ({ ...f, times: [...f.times, padded].sort() }));
    setNewTime('');
  };

  const removeTime = (tv) => setForm(f => ({ ...f, times: f.times.filter(x => x !== tv) }));

  const addMed = async () => {
    if (saving) return;
    if (!form.name.trim()) { Alert.alert(t.nameRequired); return; }
    setSaving(true);
    const newMed = { id: Date.now().toString(), ...form, image: receiptImage };
    const updated = [...meds, newMed];
    await save(updated);
    setSaving(false);
    setModalVisible(false);
    try {
      if (form.remindersEnabled && form.times.length > 0) await scheduleNotificationsForMed(newMed);
      await scheduleEndOfCourseReminder(newMed);
    } catch (_) {}
  };

  const deleteMed = (id) => {
    Alert.alert(t.deleteConfirm, t.deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive', onPress: async () => {
          await cancelNotificationsForMed(id);
          await cancelEndOfCourseReminder(id);
          await save(meds.filter(m => m.id !== id));
        }
      },
    ]);
  };

  const cycleStatus = async (id) => {
    const order = ['soon', 'taken', 'missed'];
    const updated = meds.map(m => {
      if (m.id !== id) return m;
      return { ...m, status: order[(order.indexOf(m.status) + 1) % order.length] };
    });
    await save(updated);
  };

  const analyzeReceipt = async (contentBlock) => {
    const key = apiKey.trim();
    console.log('[AI] analyzeReceipt called, key present:', !!key, 'block type:', contentBlock?.type);
    if (!key) { setShowApiKeyInput(true); Alert.alert(t.apiKeyPrompt); return; }
    setAnalyzing(true);
    setAiFilled(false);
    try {
      const prompt =
        'This is a medical prescription or medication package. ' +
        'Extract the following fields and return ONLY a raw JSON object — no markdown, no explanation, no code fences:\n' +
        '{"name":"medication name","dosage":"dosage e.g. 500 mg","times":["08:00","20:00"],"startDate":"DD.MM.YYYY or empty","endDate":"DD.MM.YYYY or empty"}\n' +
        'Rules:\n' +
        '- "name": generic or brand name of the drug (translate to the prescription language if needed, keep original otherwise)\n' +
        '- "dosage": strength per dose (e.g. "500 mg", "1 tablet", "10 ml")\n' +
        '- "times": array of intake times in HH:MM 24-hour format; infer from instructions like "twice a day" → ["08:00","20:00"], "three times" → ["08:00","14:00","20:00"], "morning" → ["08:00"]\n' +
        '- "startDate" / "endDate": in DD.MM.YYYY format if present, otherwise empty string\n' +
        '- If a field cannot be determined, use an empty string (or empty array for times)\n' +
        'Return ONLY the JSON object, nothing else.';

      console.log('[AI] data length:', contentBlock?.source?.data?.length, 'media_type:', contentBlock?.source?.media_type);
      if (!contentBlock?.source?.data) {
        throw new Error('Image data could not be read — please try again');
      }

      const isPdfBlock = contentBlock.type === 'document';
      const reqHeaders = {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      };
      if (isPdfBlock) reqHeaders['anthropic-beta'] = 'pdfs-2024-09-25';

      const apiUrl = Platform.OS === 'web'
        ? '/api/anthropic'
        : 'https://api.anthropic.com/v1/messages';
      console.log('[AI] sending to', apiUrl, '— model: claude-haiku-4-5-20251001, isPdf:', isPdfBlock);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: [contentBlock, { type: 'text', text: prompt }],
          }],
        }),
      });

      console.log('[AI] response status:', response.status);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = (err && err.error && err.error.message) || ('HTTP ' + response.status);
        console.error('[AI] Anthropic error body:', JSON.stringify(err));
        throw new Error(msg);
      }

      const data = await response.json();
      console.log('[AI] response ok, content[0]:', JSON.stringify(data?.content?.[0])?.slice(0, 120));
      const raw = (data && data.content && data.content[0] && data.content[0].text) || '';

      // Strip markdown code fences if Claude wrapped the JSON
      const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse AI response');

      const parsed = JSON.parse(jsonMatch[0]);

      const validTimes = Array.isArray(parsed.times)
        ? parsed.times.filter(tv => /^\d{1,2}:\d{2}$/.test(tv)).sort()
        : [];

      setForm(f => ({
        ...f,
        name:      parsed.name      || f.name,
        dosage:    parsed.dosage    || f.dosage,
        times:     validTimes.length > 0 ? validTimes : f.times,
        startDate: parsed.startDate || f.startDate,
        endDate:   parsed.endDate   || f.endDate,
      }));
      setAiFilled(true);
    } catch (e) {
      console.error('[AI] caught error:', e?.message, e);
      Alert.alert(t.aiError, t.aiErrorMsg + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // On web, canvas-resize to ≤1024px and re-encode as JPEG at 0.7 quality.
  // maxWidth/maxHeight in ImagePicker are ignored by browsers, so this is the
  // only reliable way to keep the base64 payload under Vercel's 4.5 MB limit.
  const webCompressImage = (uri) =>
    new Promise((resolve, reject) => {
      console.log('[AI] webCompressImage: loading uri', uri?.slice(0, 60));
      const img = document.createElement('img');
      img.onload = () => {
        const MAX = 1024;
        let w = img.naturalWidth, h = img.naturalHeight;
        console.log('[AI] image natural size:', w, 'x', h);
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round((h * MAX) / w); w = MAX; }
          else { w = Math.round((w * MAX) / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        console.log('[AI] compressed to', w, 'x', h, '— base64 length:', b64?.length);
        resolve(b64);
      };
      img.onerror = (e) => { console.error('[AI] img load error', e); reject(e); };
      img.src = uri;
    });

  const webBlobToBase64 = (uri) =>
    fetch(uri).then(r => r.blob()).then(blob =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
    );

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert(t.camPermission); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true, maxWidth: 1024, maxHeight: 1024 });
    if (!r.canceled && r.assets && r.assets[0]) {
      const asset = r.assets[0];
      setReceiptImage(asset.uri);
      const data = Platform.OS === 'web'
        ? await webCompressImage(asset.uri)
        : (asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 }));
      await analyzeReceipt({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t.galleryPermission); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true, maxWidth: 1024, maxHeight: 1024 });
    if (!r.canceled && r.assets && r.assets[0]) {
      const asset = r.assets[0];
      setReceiptImage(asset.uri);
      const data = Platform.OS === 'web'
        ? await webCompressImage(asset.uri)
        : (asset.base64 || await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 }));
      await analyzeReceipt({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
    }
  };

  const pickFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      const isPdf = asset.mimeType === 'application/pdf' || asset.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const base64 = Platform.OS === 'web'
          ? await webBlobToBase64(asset.uri)
          : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        await analyzeReceipt({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
      } else {
        setReceiptImage(asset.uri);
        const data = Platform.OS === 'web'
          ? await webCompressImage(asset.uri)
          : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
        await analyzeReceipt({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
      }
    } catch (e) {
      Alert.alert(t.aiError, t.fileError + e.message);
    }
  };

  const renderMed = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.soon;
    const hasTimes = item.times && item.times.length > 0;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cfg.bg }]}
        onPress={() => cycleStatus(item.id)}
        onLongPress={() => deleteMed(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.medName}>{item.name}</Text>
          {!!item.dosage && <Text style={styles.medDetail}>💊 {item.dosage}</Text>}
          {hasTimes && <Text style={styles.medDetail}>🕐 {item.times.join('  •  ')}</Text>}
          {(!!item.startDate || !!item.endDate) && (
            <Text style={styles.medDetail}>📅 {item.startDate || ''}{item.endDate ? ` → ${item.endDate}` : ''}</Text>
          )}
          {item.remindersEnabled && hasTimes && (
            <Text style={styles.reminderBadge}>🔔 {t.reminderActive}</Text>
          )}
          <Text style={[styles.statusBadge, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        {item.image && <Image source={{ uri: item.image }} style={styles.thumb} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t.myMeds}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
            <Text style={styles.langBtnText}>{t.lang}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scheduleBtn} onPress={() => navigation.navigate('Schedule')}>
            <Text style={styles.scheduleBtnText}>📅</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.summaryBtn} onPress={() => navigation.navigate('Summary')}>
            <Text style={styles.scheduleBtnText}>📋</Text>
          </TouchableOpacity>
          {meds.length > 0 && !confirmClear && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => {
              setConfirmClear(true);
              clearTimeout(confirmClearTimer.current);
              confirmClearTimer.current = setTimeout(() => setConfirmClear(false), 4000);
            }}>
              <Text style={styles.clearBtnText}>🗑</Text>
            </TouchableOpacity>
          )}
          {confirmClear && (
            <TouchableOpacity style={styles.clearConfirmBtn} onPress={() => {
              clearTimeout(confirmClearTimer.current);
              setConfirmClear(false);
              save([]);
            }}>
              <Text style={styles.clearConfirmText}>{t.deleteAll}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {meds.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t.noMeds}</Text>
        </View>
      ) : (
        <FlatList
          data={meds}
          keyExtractor={i => i.id}
          renderItem={renderMed}
          contentContainerStyle={{ padding: 16, gap: 12 }}
        />
      )}
      <Text style={styles.hint}>{t.hint_meds}</Text>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{t.newMed}</Text>

            <Text style={styles.label}>{t.autoFill}</Text>
            {!apiKey && !showApiKeyInput && (
              <TouchableOpacity style={styles.apiKeyPrompt} onPress={() => { setApiKeyDraft(''); setShowApiKeyInput(true); }}>
                <Text style={styles.apiKeyPromptText}>{t.apiKeyPrompt}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.photoButtonsRow}>
              <TouchableOpacity style={styles.photoPickBtn} onPress={pickFromCamera} disabled={analyzing}>
                <Text style={styles.photoPickBtnText}>{t.camera}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoPickBtn} onPress={pickFromGallery} disabled={analyzing}>
                <Text style={styles.photoPickBtnText}>{t.gallery}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoPickBtn} onPress={pickFromFile} disabled={analyzing}>
                <Text style={styles.photoPickBtnText}>{t.file}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.apiKeyBtn, apiKey ? styles.apiKeyBtnActive : null]}
                onPress={() => { setApiKeyDraft(apiKey); setShowApiKeyInput(v => !v); }}
              >
                <Text style={styles.apiKeyBtnText}>{apiKey ? '🔑✓' : '🔑'}</Text>
              </TouchableOpacity>
            </View>

            {showApiKeyInput && (
              <View style={styles.apiKeyBox}>
                <Text style={styles.apiKeyLabel}>{t.apiKeyLabel}</Text>
                <Text style={styles.apiKeyHint}>{t.apiKeyHint}</Text>
                <TextInput
                  style={styles.apiKeyInput}
                  value={apiKeyDraft}
                  onChangeText={setApiKeyDraft}
                  placeholder="sk-ant-api03-..."
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.apiKeySaveBtn, !apiKeyDraft.trim() && { opacity: 0.5 }]}
                  onPress={saveApiKey}
                  disabled={!apiKeyDraft.trim()}
                >
                  <Text style={styles.apiKeySaveBtnText}>{t.apiKeySave}</Text>
                </TouchableOpacity>
                {apiKey ? (
                  <TouchableOpacity style={styles.apiKeyCancelBtn} onPress={() => setShowApiKeyInput(false)}>
                    <Text style={styles.apiKeyCancelText}>{t.cancel}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {analyzing && (
              <View style={styles.analyzingBox}>
                <ActivityIndicator size="large" color="#1565C0" />
                <Text style={styles.analyzingText}>{t.aiReading}</Text>
              </View>
            )}

            {aiFilled && !analyzing && (
              <View style={styles.aiFilledBanner}>
                <Text style={styles.aiFilledText}>{t.aiFilledSuccess || '✅ Дані заповнено з рецепту — перевірте та збережіть'}</Text>
              </View>
            )}

            {receiptImage && !analyzing && (
              <Image source={{ uri: receiptImage }} style={styles.previewImg} />
            )}

            <Text style={styles.label}>{t.medName}</Text>
            <Dropdown
              label={t.medName}
              value={form.name}
              onChange={v => setForm(f => ({ ...f, name: v }))}
              options={MED_NAMES[lang]}
              placeholder={t.medNamePlaceholder}
              borderColor="#1565C0"
              customLabel={t.custom}
            />

            <Text style={styles.label}>{t.dosage}</Text>
            <Dropdown
              label={t.dosage}
              value={form.dosage}
              onChange={v => setForm(f => ({ ...f, dosage: v }))}
              options={DOSAGES[lang]}
              placeholder={t.dosagePlaceholder}
              borderColor="#1565C0"
              customLabel={t.custom}
            />

            <Text style={styles.label}>{t.times}</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newTime}
                onChangeText={setNewTime}
                placeholder={t.timePlaceholder}
                keyboardType="numbers-and-punctuation"
                fontSize={18}
                onSubmitEditing={addTime}
              />
              <TouchableOpacity style={styles.addTimeBtn} onPress={addTime}>
                <Text style={styles.addTimeBtnText}>{t.addTime}</Text>
              </TouchableOpacity>
            </View>
            {form.times.length > 0 && (
              <View style={styles.timePills}>
                {form.times.map(tv => (
                  <TouchableOpacity key={tv} style={styles.timePill} onPress={() => removeTime(tv)}>
                    <Text style={styles.timePillText}>{tv}  ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>{t.startDate}</Text>
            <TextInput style={styles.input} value={form.startDate} onChangeText={tv => setForm(f => ({ ...f, startDate: tv }))} placeholder={t.datePlaceholder} keyboardType="numbers-and-punctuation" fontSize={18} />

            <Text style={styles.label}>{t.endDate}</Text>
            <TextInput style={styles.input} value={form.endDate} onChangeText={tv => setForm(f => ({ ...f, endDate: tv }))} placeholder={t.datePlaceholder} keyboardType="numbers-and-punctuation" fontSize={18} />

            <View style={styles.reminderRow}>
              <Text style={styles.reminderLabel}>{t.reminders}</Text>
              <Switch
                value={form.remindersEnabled}
                onValueChange={v => setForm(f => ({ ...f, remindersEnabled: v }))}
                trackColor={{ false: '#ccc', true: '#1565C0' }}
                thumbColor={form.remindersEnabled ? '#fff' : '#f4f3f4'}
              />
            </View>
            {form.remindersEnabled && form.times.length === 0 && (
              <Text style={styles.reminderNote}>{t.addReminderHint}</Text>
            )}

            <Text style={styles.label}>{t.status}</Text>
            <View style={styles.statusRow}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.statusChip, form.status === key && { backgroundColor: cfg.color }]}
                  onPress={() => setForm(f => ({ ...f, status: key }))}
                >
                  <Text style={[styles.statusChipText, form.status === key && { color: '#fff' }]}>{cfg.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={addMed}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>{t.save}</Text>
              }
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
  backBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 },
  backText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  headerRight: { flexDirection: 'row', gap: 8 },
  langBtn: { backgroundColor: '#1565C0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  langBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scheduleBtn: { backgroundColor: '#6A1B9A', borderRadius: 10, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  summaryBtn:  { backgroundColor: '#00838F', borderRadius: 10, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  scheduleBtnText: { fontSize: 20 },
  addBtn: { backgroundColor: '#2E7D32', borderRadius: 10, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 26, fontWeight: '400', lineHeight: 28 },
  card: { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'flex-start', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardLeft: { flex: 1 },
  medName: { fontSize: 20, fontWeight: '700', color: '#1A1A2E' },
  medDetail: { fontSize: 16, color: '#555', marginTop: 3 },
  reminderBadge: { fontSize: 14, color: '#1565C0', marginTop: 4 },
  statusBadge: { fontSize: 17, fontWeight: '600', marginTop: 6 },
  thumb: { width: 64, height: 64, borderRadius: 10, marginLeft: 12 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 20, color: '#555', textAlign: 'center', lineHeight: 32 },
  hint: { textAlign: 'center', fontSize: 13, color: '#888', padding: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 26, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  label: { fontSize: 17, color: '#555', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 2, borderColor: '#1565C0', borderRadius: 12, padding: 14, fontSize: 18, backgroundColor: '#FAFAFA' },
  timeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addTimeBtn: { backgroundColor: '#1565C0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center' },
  addTimeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  timePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  timePill: { backgroundColor: '#1565C0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  timePillText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, backgroundColor: '#F0F4FF', borderRadius: 12, padding: 14 },
  reminderLabel: { fontSize: 18, color: '#1A1A2E', fontWeight: '600' },
  reminderNote: { fontSize: 14, color: '#E65100', marginTop: 6 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statusChip: { borderWidth: 2, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  statusChipText: { fontSize: 16, color: '#333' },
  previewImg: { width: '100%', height: 160, borderRadius: 12, marginTop: 12 },
  saveBtn: { marginTop: 20, backgroundColor: '#1565C0', borderRadius: 12, padding: 18, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cancelBtn: { marginTop: 10, borderRadius: 12, padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontSize: 18 },
  photoButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  photoPickBtn: { flex: 1, backgroundColor: '#1565C0', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  photoPickBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  apiKeyBtn: { backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  apiKeyBtnActive: { backgroundColor: '#C8E6C9' },
  apiKeyBtnText: { fontSize: 20 },
  apiKeyBox: { marginTop: 12, backgroundColor: '#F0F4FF', borderRadius: 12, padding: 14 },
  apiKeyLabel: { fontSize: 14, color: '#555', marginBottom: 8 },
  apiKeyInput: { borderWidth: 2, borderColor: '#1565C0', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fff' },
  apiKeySaveBtn: { marginTop: 10, backgroundColor: '#2E7D32', borderRadius: 10, padding: 12, alignItems: 'center' },
  apiKeySaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  analyzingBox: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  analyzingText: { fontSize: 16, color: '#1565C0', fontWeight: '600' },
  clearBtn: { backgroundColor: '#C62828', borderRadius: 10, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  clearBtnText: { fontSize: 20 },
  clearConfirmBtn: { backgroundColor: '#C62828', borderRadius: 10, paddingHorizontal: 12, height: 44, justifyContent: 'center', alignItems: 'center' },
  clearConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  apiKeyPrompt: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F9A825' },
  apiKeyPromptText: { color: '#E65100', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  apiKeyHint: { fontSize: 13, color: '#888', marginBottom: 8 },
  apiKeyCancelBtn: { marginTop: 8, alignItems: 'center', padding: 8 },
  apiKeyCancelText: { color: '#888', fontSize: 15 },
  aiFilledBanner: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#2E7D32' },
  aiFilledText: { color: '#2E7D32', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
