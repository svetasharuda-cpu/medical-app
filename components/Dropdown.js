import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  FlatList, TextInput,
} from 'react-native';

export default function Dropdown({ label, value, onChange, options, placeholder, borderColor, customLabel }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState('');

  const handleSelect = (item) => {
    onChange(item);
    setOpen(false);
    setCustom(false);
  };

  const handleCustomConfirm = () => {
    if (draft.trim()) onChange(draft.trim());
    setOpen(false);
    setCustom(false);
    setDraft('');
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.trigger, { borderColor: borderColor || '#1565C0' }]}
        onPress={() => { setOpen(true); setCustom(false); setDraft(''); }}
        activeOpacity={0.8}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {value || placeholder || label}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            {!custom ? (
              <>
                <Text style={styles.sheetTitle}>{label}</Text>
                <FlatList
                  data={options}
                  keyExtractor={(item, i) => `${item}_${i}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.option} onPress={() => handleSelect(item)}>
                      <Text style={[styles.optionText, item === value && styles.optionSelected]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  style={{ maxHeight: 320 }}
                  keyboardShouldPersistTaps="handled"
                />
                <TouchableOpacity style={styles.customBtn} onPress={() => setCustom(true)}>
                  <Text style={styles.customBtnText}>{customLabel || '✏️ Enter manually'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>{label}</Text>
                <TextInput
                  style={styles.customInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={placeholder}
                  autoFocus
                  fontSize={18}
                />
                <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: borderColor || '#1565C0' }]} onPress={handleCustomConfirm}>
                  <Text style={styles.confirmBtnText}>OK</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 2, borderRadius: 12, padding: 14,
    backgroundColor: '#FAFAFA', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  triggerText: { fontSize: 18, color: '#1A1A2E', flex: 1 },
  placeholder: { color: '#aaa' },
  arrow: { fontSize: 18, color: '#888', marginLeft: 8 },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },
  option: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  optionText: { fontSize: 18, color: '#333' },
  optionSelected: { color: '#1565C0', fontWeight: '700' },
  customBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 12 },
  customBtnText: { fontSize: 16, color: '#1565C0', fontWeight: '600' },
  customInput: {
    borderWidth: 2, borderColor: '#1565C0', borderRadius: 12,
    padding: 14, fontSize: 18, marginBottom: 14,
  },
  confirmBtn: { borderRadius: 12, padding: 16, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
