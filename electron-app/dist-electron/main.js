import { BrowserWindow as e, app as t, dialog as n, ipcMain as r } from "electron";
import i, { join as a } from "node:path";
import { fileURLToPath as o } from "node:url";
import s from "node:fs";
import { spawn as c } from "node:child_process";
//#region electron/main.ts
t.disableHardwareAcceleration();
var l = i.dirname(o(import.meta.url)), u = i.join(l, "../../"), d = null, f = null;
function p() {
	d = new e({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: a(l, "preload.mjs"),
			nodeIntegration: !1,
			contextIsolation: !0,
			webSecurity: !1
		}
	}), process.env.VITE_DEV_SERVER_URL ? (d.loadURL(process.env.VITE_DEV_SERVER_URL), d.webContents.openDevTools()) : d.loadFile(a(l, "../dist/index.html"));
}
t.whenReady().then(() => {
	p(), t.on("activate", () => {
		e.getAllWindows().length === 0 && p();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
}), r.handle("get-models", async () => {
	let e = i.join(u, "models");
	if (!s.existsSync(e)) return [];
	let t = s.readdirSync(e, { recursive: !0 }).filter((e) => typeof e == "string" && e.includes("ppomodel")), n = [];
	for (let r of t) {
		let t = i.join(e, r), a = s.statSync(t);
		if (a.isFile()) {
			let e = r.split(i.sep), o = "unknown", s = "unknown", c = "unknown";
			e.length >= 3 && (o = e[0], s = e[1], c = e[2].replace("simulation_", "")), n.push({
				id: r.replace(/\\/g, "/"),
				name: i.basename(r),
				path: t,
				size: a.size,
				date: a.mtime.toISOString(),
				wave_type: o,
				sea_state: s,
				ent_coef: c
			});
		}
	}
	return n;
}), r.handle("get-results", async () => {
	let e = i.join(u, "results");
	if (!s.existsSync(e)) return [];
	let t = s.readdirSync(e, { recursive: !0 }).filter((e) => typeof e == "string" && e.endsWith(".csv")), n = {};
	for (let r of t) {
		let t = r.replace(/\\/g, "/"), a = i.join(e, r), o = s.statSync(a);
		if (!o.isFile()) continue;
		let c = t, l = "main";
		t.endsWith("_energy_absorbed.csv") ? (c = t.replace("_energy_absorbed.csv", ""), l = "energy") : t.endsWith("_reward.csv") ? (c = t.replace("_reward.csv", ""), l = "reward") : t.endsWith(".csv") && (c = t.replace(".csv", ""), l = "main"), n[c] || (n[c] = {
			id: c,
			displayName: i.basename(c),
			date: o.mtime.toISOString(),
			mode: c.includes("train") ? "train" : c.includes("test") ? "test" : "final",
			plotUrl: null,
			files: {}
		}), n[c].files[l] = t, l === "main" && (n[c].date = o.mtime.toISOString());
	}
	let r = [];
	for (let t of Object.keys(n)) {
		let a = n[t], o = i.join(e, `${t}.png`);
		s.existsSync(o) || (o = i.join(e, t.replace("/data/", "/plot/") + ".png")), s.existsSync(o) && (a.plotUrl = `file://${o.replace(/\\/g, "/")}`), a.files.main && r.push(a);
	}
	return r.sort((e, t) => new Date(t.date).getTime() - new Date(e.date).getTime()), r;
}), r.handle("download-result-file", async (e, t) => {
	let r = i.join(u, "results", t);
	if (!s.existsSync(r)) throw Error("Source file not found");
	let a = i.basename(t), o = await n.showSaveDialog(d, {
		title: "Save Result CSV File",
		defaultPath: a,
		filters: [{
			name: "CSV File (.csv)",
			extensions: ["csv"]
		}]
	});
	return o.canceled || !o.filePath ? !1 : (s.copyFileSync(r, o.filePath), !0);
}), r.handle("read-csv", async (e, t) => {
	let n = i.join(u, "results", t);
	if (!s.existsSync(n)) throw Error("File not found");
	return s.readFileSync(n, "utf-8");
}), r.handle("run-simulation", async (e, t) => {
	if (f) throw Error("Simulation already running");
	return new Promise((e, n) => {
		let r = i.join(u, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python"), a = s.existsSync(r) ? r : process.platform === "win32" ? "python" : "python3", o = t.type === "sim" ? "rl" : "baseline", l = "latching";
		t.control === "reactive" ? l = "linear" : (t.control === "latching" || t.control === "none") && (l = "latching");
		let p = [
			"run.py",
			"--mode",
			t.mode,
			"--control",
			o,
			"--type",
			l,
			"--sea-state",
			t.sea_state.toString()
		];
		if (t.mixed && p.push("--mixed"), t.regular && p.push("--regular"), t.sim_time && p.push("--sim-time", t.sim_time.toString()), t.save && p.push("--save"), t.retrain && p.push("--retrain"), t.model_id) {
			let e = i.isAbsolute(t.model_id) ? t.model_id : i.join(u, "models", t.model_id);
			p.push("--model-path", e);
		}
		t.batch_size && p.push("--batch-size", t.batch_size.toString()), t.entropy_coef && p.push("--entropy-coef", t.entropy_coef.toString()), f = c(a, p, {
			cwd: u,
			env: {
				...process.env,
				MPLBACKEND: "Agg"
			}
		}), f.stdout?.on("data", (e) => {
			let t = e.toString().split("\n"), n = [];
			for (let e of t) {
				let t = e.match(/\[PROGRESS\]\s+(\d+)/);
				if (t) {
					let e = parseInt(t[1], 10);
					d?.webContents.send("simulation-progress", e);
				} else n.push(e);
			}
			n.length > 0 && d?.webContents.send("simulation-log", n.join("\n"));
		}), f.stderr?.on("data", (e) => {
			d?.webContents.send("simulation-log", `ERROR: ${e.toString()}`);
		}), f.on("close", (t) => {
			f = null, d?.webContents.send("simulation-done", t), e(t);
		}), f.on("error", (e) => {
			f = null, n(e);
		});
	});
}), r.handle("kill-simulation", async () => f ? (f.kill(), f = null, !0) : !1), r.handle("get-config", async () => {
	let e = i.join(u, "src", "config", "config.json");
	if (!s.existsSync(e)) throw Error("Config file not found");
	let t = s.readFileSync(e, "utf-8");
	return JSON.parse(t);
}), r.handle("save-config", async (e, t) => {
	let n = i.join(u, "src", "config", "config.json");
	return s.writeFileSync(n, JSON.stringify(t, null, 2), "utf-8"), !0;
}), r.handle("select-model-file", async () => {
	let e = await n.showOpenDialog(d, {
		title: "Select PPO Model File",
		properties: ["openFile"],
		filters: [{
			name: "PPO Model (.zip)",
			extensions: ["zip"]
		}, {
			name: "All Files",
			extensions: ["*"]
		}]
	});
	return e.canceled || e.filePaths.length === 0 ? null : e.filePaths[0];
});
//#endregion
export {};
