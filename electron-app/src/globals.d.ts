export { }

declare global {
  interface Window {
    api: {
      getModels: () => Promise<any[]>
      deleteModel: (modelId: string) => Promise<boolean>
      getResults: () => Promise<any[]>
      deleteResultRun: (runId: string) => Promise<boolean>
      readCSV: (filename: string) => Promise<string>
      runSimulation: (args: any) => Promise<{ code: number; latestRunId: string | null }>
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
      copyModelFile: (filePath: string) => Promise<{ success: boolean; fileName: string } | null>
      getHomeDir: () => Promise<string>
      listDirectory: (dirPath: string) => Promise<{
        currentPath: string
        parentPath: string | null
        directories: Array<{ name: string; path: string; isDirectory: boolean }>
        files: Array<{ name: string; path: string; size: number; isDirectory: boolean }>
      } | null>
    }
  }
}
