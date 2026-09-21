import { contextBridge, ipcRenderer } from 'electron'
import type { AionBridge, HotkeyAction } from '../src/core/bridge'

// Implementa AionBridge do outro lado. Se um nome mudar aqui, mude em
// src/core/bridge.ts junto: são as duas metades do mesmo contrato.
const bridge: AionBridge = {
  loadProgress: () => ipcRenderer.invoke('aion:loadProgress'),
  saveProgress: (progress) => ipcRenderer.invoke('aion:saveProgress', progress),
  loadSettings: () => ipcRenderer.invoke('aion:loadSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('aion:saveSettings', settings),
  setOpacity: (value) => ipcRenderer.send('aion:setOpacity', value),
  setClickThrough: (enabled) => ipcRenderer.send('aion:setClickThrough', enabled),
  setMapOpen: (open) => ipcRenderer.send('aion:setMapOpen', open),
  minimize: () => ipcRenderer.send('aion:minimize'),
  close: () => ipcRenderer.send('aion:close'),
  onHotkey: (callback) => {
    ipcRenderer.on('aion:hotkey', (_event, action: HotkeyAction) => callback(action))
  },
}

contextBridge.exposeInMainWorld('aion', bridge)
