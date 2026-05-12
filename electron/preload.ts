import { contextBridge, ipcRenderer } from 'electron';
import type {
  APP_GET_INFO_CHANNEL as APP_GET_INFO_CHANNEL_TYPE,
  AppInfo,
  ScholaApi,
} from '../src/lib/contracts/app.types';

const APP_GET_INFO_CHANNEL: typeof APP_GET_INFO_CHANNEL_TYPE = 'app:get-info';

const scholaApi: ScholaApi = Object.freeze({
  app: Object.freeze({
    getInfo: () => ipcRenderer.invoke(APP_GET_INFO_CHANNEL) as Promise<AppInfo>,
  }),
});

contextBridge.exposeInMainWorld('schola', scholaApi);