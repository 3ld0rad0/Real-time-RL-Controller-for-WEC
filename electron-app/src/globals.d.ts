export {}

declare global {
  interface Window {
    api: {
      getModels: () => Promise<any[]>
      getResults: () => Promise<any[]>
      readCSV: (filename: string) => Promise<string>
      runSimulation: (args: any) => Promise<number>
      killSimulation: () => Promise<boolean>
      onSimulationLog: (callback: (log: string) => void) => () => void
      onSimulationDone: (callback: (code: number) => void) => () => void
    }
  }
}
