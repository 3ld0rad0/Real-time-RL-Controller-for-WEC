let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("api", {
	getModels: () => electron.ipcRenderer.invoke("get-models"),
	deleteModel: (modelId) => electron.ipcRenderer.invoke("delete-model", modelId),
	getResults: () => electron.ipcRenderer.invoke("get-results"),
	deleteResultRun: (runId) => electron.ipcRenderer.invoke("delete-result-run", runId),
	readCSV: (filename) => electron.ipcRenderer.invoke("read-csv", filename),
	runSimulation: (args) => electron.ipcRenderer.invoke("run-simulation", args),
	killSimulation: () => electron.ipcRenderer.invoke("kill-simulation"),
	getConfig: () => electron.ipcRenderer.invoke("get-config"),
	saveConfig: (newConfig) => electron.ipcRenderer.invoke("save-config", newConfig),
	selectModelFile: () => electron.ipcRenderer.invoke("select-model-file"),
	uploadModel: () => electron.ipcRenderer.invoke("upload-model"),
	downloadResultFile: (filename) => electron.ipcRenderer.invoke("download-result-file", filename),
	onSimulationLog: (callback) => {
		const handler = (_event, log) => callback(log);
		electron.ipcRenderer.on("simulation-log", handler);
		return () => electron.ipcRenderer.off("simulation-log", handler);
	},
	onSimulationDone: (callback) => {
		const handler = (_event, code) => callback(code);
		electron.ipcRenderer.on("simulation-done", handler);
		return () => electron.ipcRenderer.off("simulation-done", handler);
	},
	onSimulationProgress: (callback) => {
		const handler = (_event, percent) => callback(percent);
		electron.ipcRenderer.on("simulation-progress", handler);
		return () => electron.ipcRenderer.off("simulation-progress", handler);
	},
	minimizeWindow: () => electron.ipcRenderer.send("window-minimize"),
	maximizeWindow: () => electron.ipcRenderer.send("window-maximize"),
	closeWindow: () => electron.ipcRenderer.send("window-close"),
	onWindowMaximized: (callback) => {
		const handler = (_event, isMaximized) => callback(isMaximized);
		electron.ipcRenderer.on("window-maximized-state", handler);
		return () => electron.ipcRenderer.off("window-maximized-state", handler);
	},
	copyModelFile: (filePath) => electron.ipcRenderer.invoke("copy-model-file", filePath),
	getHomeDir: () => electron.ipcRenderer.invoke("get-home-dir"),
	listDirectory: (dirPath) => electron.ipcRenderer.invoke("list-directory", dirPath)
});
//#endregion
