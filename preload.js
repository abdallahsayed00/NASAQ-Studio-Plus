'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nasaq', {
  ps: (op, params) => ipcRenderer.invoke('ps', op, params),
  authRegister: (payload) => ipcRenderer.invoke('auth:register', payload),
  authLogin: (payload) => ipcRenderer.invoke('auth:login', payload),
  authStatus: () => ipcRenderer.invoke('auth:status'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  copy: (text) => ipcRenderer.invoke('copy', text),
  setOnTop: (on) => ipcRenderer.invoke('ontop', on),
  assetsDir: () => ipcRenderer.invoke('assetsDir'),
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  importTemplates: () => ipcRenderer.invoke('templates:import'),
  removeTemplate: (name) => ipcRenderer.invoke('templates:remove', name)
});
