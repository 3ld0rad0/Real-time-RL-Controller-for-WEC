import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getModels: () => ipcRenderer.invoke('get-models'),
  getResults: () => ipcRenderer.invoke('get-results'),
  readCSV: (filename: string) => ipcRenderer.invoke('read-csv', filename),
  runSimulation: (args: any) => ipcRenderer.invoke('run-simulation', args),
  killSimulation: () => ipcRenderer.invoke('kill-simulation'),
  onSimulationLog: (callback: (log: string) => void) => {
    const handler = (_event: any, log: string) => callback(log)
    ipcRenderer.on('simulation-log', handler)
    return () => ipcRenderer.off('simulation-log', handler)
  },
  onSimulationDone: (callback: (code: number) => void) => {
    const handler = (_event: any, code: number) => callback(code)
    ipcRenderer.on('simulation-done', handler)
    return () => ipcRenderer.off('simulation-done', handler)
  }
})
