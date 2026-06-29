import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from './utils/LanguageContext';

import HomeScreen from './screens/HomeScreen';
import MedicationsScreen from './screens/MedicationsScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import SummaryScreen from './screens/SummaryScreen';
import DoctorScreen from './screens/DoctorScreen';
import WellbeingScreen from './screens/WellbeingScreen';
import ContactsScreen from './screens/ContactsScreen';

if (Platform.OS !== 'web') {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

const Stack = createStackNavigator();

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const Notifications = require('expo-notifications');
    const sub = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => sub.remove();
  }, []);

  return (
    <LanguageProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Medications" component={MedicationsScreen} />
          <Stack.Screen name="Schedule" component={ScheduleScreen} />
          <Stack.Screen name="Summary" component={SummaryScreen} />
          <Stack.Screen name="Doctor" component={DoctorScreen} />
          <Stack.Screen name="Wellbeing" component={WellbeingScreen} />
          <Stack.Screen name="Contacts" component={ContactsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </LanguageProvider>
  );
}
