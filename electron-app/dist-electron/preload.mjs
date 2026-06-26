let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("api", {
	getModels: () => electron.ipcRenderer.invoke("get-models"),
	getResults: () => electron.ipcRenderer.invoke("get-results"),
	readCSV: (filename) => electron.ipcRenderer.invoke("read-csv", filename),
	runSimulation: (args) => electron.ipcRenderer.invoke("run-simulation", args),
	killSimulation: () => electron.ipcRenderer.invoke("kill-simulation"),
	onSimulationLog: (callback) => {
		const handler = (_event, log) => callback(log);
		electron.ipcRenderer.on("simulation-log", handler);
		return () => electron.ipcRenderer.off("simulation-log", handler);
	},
	onSimulationDone: (callback) => {
		const handler = (_event, code) => callback(code);
		electron.ipcRenderer.on("simulation-done", handler);
		return () => electron.ipcRenderer.off("simulation-done", handler);
	}
});
//#endregion
