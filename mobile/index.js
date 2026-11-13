/*
 * 📘 PARA LA DEFENSA — mobile/index.js — punto de entrada: le dice a Expo que el componente principal es App (App.js).
 */
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
