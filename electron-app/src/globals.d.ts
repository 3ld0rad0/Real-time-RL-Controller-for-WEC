export { }

declare global {
  interface Window {
    api: {
      getModels: () => Promise<any[]>
      getResults: () => Promise<any[]>
      readCSV: (filename: string) => Promise<string>
      runSimulation: (args: any) => Promise<number>
      killSimulation: () => Promise<boolean>
      getConfig: () => Promise<any>
      saveConfig: (newConfig: any) => Promise<boolean>
      selectModelFile: () => Promise<string | null>
      uploadModel: () => Promise<{ success: boolean; fileName: string } | null>
      downloadResultFile: (filename: string) => Promise<boolean>
      onSimulationLog: (callback: (log: string) => void) => () => void
      onSimulationDone: (callback: (code: number) => void) => () => void
      onSimulationProgress: (callback: (percent: number) => void) => () => void
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      onWindowMaximized: (callback: (isMaximized: boolean) => void) => () => void
    }
  }
}
