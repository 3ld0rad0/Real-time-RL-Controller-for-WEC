import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getModels: () => ipcRenderer.invoke('get-models'),
  getResults: () => ipcRenderer.invoke('get-results'),
  readCSV: (filename: string) => ipcRenderer.invoke('read-csv', filename),
  runSimulation: (args: any) => ipcRenderer.invoke('run-simulation', args),
  killSimulation: () => ipcRenderer.invoke('kill-simulation'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (newConfig: any) => ipcRenderer.invoke('save-config', newConfig),
  selectModelFile: () => ipcRenderer.invoke('select-model-file'),
  uploadModel: () => ipcRenderer.invoke('upload-model'),
  downloadResultFile: (filename: string) => ipcRenderer.invoke('download-result-file', filename),
  onSimulationLog: (callback: (log: string) => void) => {
    const handler = (_event: any, log: string) => callback(log)
    ipcRenderer.on('simulation-log', handler)
    return () => ipcRenderer.off('simulation-log', handler)
  },
  onSimulationDone: (callback: (code: number) => void) => {
    const handler = (_event: any, code: number) => callback(code)
    ipcRenderer.on('simulation-done', handler)
    return () => ipcRenderer.off('simulation-done', handler)
  },
  onSimulationProgress: (callback: (percent: number) => void) => {
    const handler = (_event: any, percent: number) => callback(percent)
    ipcRenderer.on('simulation-progress', handler)
    return () => ipcRenderer.off('simulation-progress', handler)
  }
})
