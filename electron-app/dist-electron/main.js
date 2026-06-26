import { BrowserWindow, app, ipcMain } from "electron";
import path, { join } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { spawn } from "node:child_process";
//#region electron/main.ts
app.disableHardwareAcceleration();
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var processRoot = path.join(__dirname, "../../");
var mainWindow = null;
var currentSimulation = null;
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: join(__dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true,
			webSecurity: false
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
		mainWindow.webContents.openDevTools();
	} else mainWindow.loadFile(join(__dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
ipcMain.handle("get-models", async () => {
	const modelsDir = path.join(processRoot, "models");
	if (!fs.existsSync(modelsDir)) return [];
	const files = fs.readdirSync(modelsDir, { recursive: true }).filter((f) => typeof f === "string" && f.includes("ppomodel"));
	const models = [];
	for (const file of files) {
		const fullPath = path.join(modelsDir, file);
		const stats = fs.statSync(fullPath);
		if (stats.isFile()) {
			const parts = file.split(path.sep);
			let wave_type = "unknown";
			let sea_state = "unknown";
			let ent_coef = "unknown";
			if (parts.length >= 3) {
				wave_type = parts[0];
				sea_state = parts[1];
				ent_coef = parts[2].replace("simulation_", "");
			}
			models.push({
				id: file.replace(/\\/g, "/"),
				name: path.basename(file),
				path: fullPath,
				size: stats.size,
				date: stats.mtime.toISOString(),
				wave_type,
				sea_state,
				ent_coef
			});
		}
	}
	return models;
});
ipcMain.handle("get-results", async () => {
	const resultsDir = path.join(processRoot, "results");
	if (!fs.existsSync(resultsDir)) return [];
	const files = fs.readdirSync(resultsDir, { recursive: true }).filter((f) => typeof f === "string" && f.endsWith(".csv"));
	const results = [];
	for (const file of files) {
		const fullPath = path.join(resultsDir, file);
		const stats = fs.statSync(fullPath);
		if (stats.isFile()) {
			const mode = file.includes("train") ? "train" : file.includes("test") ? "test" : "final";
			let plotPath = fullPath.replace(`${path.sep}data${path.sep}`, `${path.sep}plot${path.sep}`).replace(".csv", ".png");
			if (!fs.existsSync(plotPath)) plotPath = fullPath.replace(".csv", ".png");
			let plotUrl = null;
			if (fs.existsSync(plotPath)) plotUrl = `file://${plotPath.replace(/\\/g, "/")}`;
			results.push({
				filename: file.replace(/\\/g, "/"),
				date: stats.mtime.toISOString(),
				mode,
				plotUrl
			});
		}
	}
	results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	return results;
});
ipcMain.handle("read-csv", async (_, filename) => {
	const fullPath = path.join(processRoot, "results", filename);
	if (!fs.existsSync(fullPath)) throw new Error("File not found");
	return fs.readFileSync(fullPath, "utf-8");
});
ipcMain.handle("run-simulation", async (event, args) => {
	if (currentSimulation) throw new Error("Simulation already running");
	return new Promise((resolve, reject) => {
		const venvPath = path.join(processRoot, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
		const pythonExe = fs.existsSync(venvPath) ? venvPath : process.platform === "win32" ? "python" : "python3";
		const cmdArgs = [
			"run.py",
			"--mode",
			args.mode,
			"--control",
			args.control,
			"--type",
			args.type,
			"--sea-state",
			args.sea_state.toString()
		];
		if (args.mixed) cmdArgs.push("--mixed");
		if (args.regular) cmdArgs.push("--regular");
		if (args.sim_time) cmdArgs.push("--sim-time", args.sim_time.toString());
		if (args.save) cmdArgs.push("--save");
		if (args.retrain) cmdArgs.push("--retrain");
		if (args.model_id) {
			const modelPath = path.join(processRoot, "models", args.model_id);
			cmdArgs.push("--model-path", modelPath);
		}
		if (args.batch_size) cmdArgs.push("--batch-size", args.batch_size.toString());
		if (args.entropy_coef) cmdArgs.push("--entropy-coef", args.entropy_coef.toString());
		currentSimulation = spawn(pythonExe, cmdArgs, {
			cwd: processRoot,
			env: {
				...process.env,
				MPLBACKEND: "Agg"
			}
		});
		currentSimulation.stdout?.on("data", (data) => {
			mainWindow?.webContents.send("simulation-log", data.toString());
		});
		currentSimulation.stderr?.on("data", (data) => {
			mainWindow?.webContents.send("simulation-log", `ERROR: ${data.toString()}`);
		});
		currentSimulation.on("close", (code) => {
			currentSimulation = null;
			mainWindow?.webContents.send("simulation-done", code);
			resolve(code);
		});
		currentSimulation.on("error", (err) => {
			currentSimulation = null;
			reject(err);
		});
	});
});
ipcMain.handle("kill-simulation", async () => {
	if (currentSimulation) {
		currentSimulation.kill();
		currentSimulation = null;
		return true;
	}
	return false;
});
//#endregion
export {};
