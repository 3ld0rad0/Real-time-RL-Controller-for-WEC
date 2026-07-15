import { BrowserWindow as e, app as t, dialog as n, ipcMain as r, screen as i } from "electron";
import a, { join as o } from "node:path";
import { fileURLToPath as s } from "node:url";
import c from "node:fs";
import { spawn as l } from "node:child_process";
//#region electron/main.ts
t.disableHardwareAcceleration();
var u = a.dirname(s(import.meta.url)), d = a.join(u, "../../"), f = null, p = null, m = !1, h = null;
function g() {
	f = new e({
		width: 1200,
		height: 800,
		frame: !1,
		webPreferences: {
			preload: o(u, "preload.mjs"),
			nodeIntegration: !1,
			contextIsolation: !0,
			webSecurity: !1
		}
	}), process.env.VITE_DEV_SERVER_URL ? (f.loadURL(process.env.VITE_DEV_SERVER_URL), f.webContents.openDevTools()) : f.loadFile(o(u, "../dist/index.html"));
}
t.whenReady().then(() => {
	g(), t.on("activate", () => {
		e.getAllWindows().length === 0 && g();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
}), r.on("window-minimize", () => {
	f?.minimize();
}), r.on("window-maximize", () => {
	if (f) if (m) h ? f.setBounds(h) : (f.setSize(1200, 800), f.center()), m = !1, f.webContents.send("window-maximized-state", !1);
	else {
		h = f.getBounds();
		let { x: e, y: t, width: n, height: r } = i.getPrimaryDisplay().workArea;
		f.setBounds({
			x: e,
			y: t,
			width: n,
			height: r
		}), m = !0, f.webContents.send("window-maximized-state", !0);
	}
}), r.on("window-close", () => {
	f?.close();
}), r.handle("get-models", async () => {
	let e = a.join(d, "models");
	if (!c.existsSync(e)) return [];
	let t = c.readdirSync(e, { recursive: !0 }).filter((e) => typeof e == "string" && e.includes("ppomodel")), n = [];
	for (let r of t) {
		let t = a.join(e, r), i = c.statSync(t);
		if (i.isFile()) {
			let e = r.split(a.sep), o = "unknown", s = "unknown", c = "unknown";
			e.length >= 3 && (o = e[0], s = e[1], c = e[2].replace("simulation_", "")), n.push({
				id: r.replace(/\\/g, "/"),
				name: a.basename(r),
				path: t,
				size: i.size,
				date: i.mtime.toISOString(),
				wave_type: o,
				sea_state: s,
				ent_coef: c
			});
		}
	}
	return n;
}), r.handle("get-results", async () => {
	let e = a.join(d, "results");
	if (!c.existsSync(e)) return [];
	let t = c.readdirSync(e, { recursive: !0 }).filter((e) => typeof e == "string" && e.endsWith(".csv")), n = {};
	for (let r of t) {
		let t = r.replace(/\\/g, "/"), i = a.join(e, r), o = c.statSync(i);
		if (!o.isFile()) continue;
		let s = t, l = "main";
		t.endsWith("_energy_absorbed.csv") ? (s = t.replace("_energy_absorbed.csv", ""), l = "energy") : t.endsWith("_reward.csv") ? (s = t.replace("_reward.csv", ""), l = "reward") : t.endsWith(".csv") && (s = t.replace(".csv", ""), l = "main"), n[s] || (n[s] = {
			id: s,
			displayName: a.basename(s),
			date: o.mtime.toISOString(),
			mode: s.includes("train") ? "train" : s.includes("test") ? "test" : "final",
			plotUrl: null,
			files: {}
		}), n[s].files[l] = t, l === "main" && (n[s].date = o.mtime.toISOString());
	}
	let r = [];
	for (let t of Object.keys(n)) {
		let i = n[t], o = a.join(e, `${t}.png`);
		c.existsSync(o) || (o = a.join(e, t.replace("/data/", "/plot/") + ".png")), c.existsSync(o) && (i.plotUrl = `file://${o.replace(/\\/g, "/")}`), i.files.main && r.push(i);
	}
	return r.sort((e, t) => new Date(t.date).getTime() - new Date(e.date).getTime()), r;
}), r.handle("download-result-file", async (e, t) => {
	let r = a.join(d, "results", t);
	if (!c.existsSync(r)) throw Error("Source file not found");
	let i = a.basename(t), o = await n.showSaveDialog(f, {
		title: "Save Result CSV File",
		defaultPath: i,
		filters: [{
			name: "CSV File (.csv)",
			extensions: ["csv"]
		}]
	});
	return o.canceled || !o.filePath ? !1 : (c.copyFileSync(r, o.filePath), !0);
}), r.handle("read-csv", async (e, t) => {
	let n = a.join(d, "results", t);
	if (!c.existsSync(n)) throw Error("File not found");
	return c.readFileSync(n, "utf-8");
}), r.handle("run-simulation", async (e, t) => {
	if (p) throw Error("Simulation already running");
	return new Promise((e, n) => {
		let r = a.join(d, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python"), i = c.existsSync(r) ? r : process.platform === "win32" ? "python" : "python3", o = t.type === "sim" ? "rl" : "baseline", s = "latching";
		t.control === "reactive" ? s = "linear" : (t.control === "latching" || t.control === "none") && (s = "latching");
		let u = [
			"run.py",
			"--mode",
			t.mode,
			"--control",
			o,
			"--type",
			s,
			"--sea-state",
			t.sea_state.toString()
		];
		if (t.mixed && u.push("--mixed"), t.regular && u.push("--regular"), t.sim_time && u.push("--sim-time", t.sim_time.toString()), t.save && u.push("--save"), t.retrain && u.push("--retrain"), t.model_id) {
			let e = a.isAbsolute(t.model_id) ? t.model_id : a.join(d, "models", t.model_id);
			u.push("--model-path", e);
		}
		t.batch_size && u.push("--batch-size", t.batch_size.toString()), t.entropy_coef && u.push("--entropy-coef", t.entropy_coef.toString()), p = l(i, u, {
			cwd: d,
			env: {
				...process.env,
				MPLBACKEND: "Agg"
			}
		}), p.stdout?.on("data", (e) => {
			let t = e.toString().split("\n"), n = [];
			for (let e of t) {
				let t = e.match(/\[PROGRESS\]\s+(\d+)/);
				if (t) {
					let e = parseInt(t[1], 10);
					f?.webContents.send("simulation-progress", e);
				} else n.push(e);
			}
			n.length > 0 && f?.webContents.send("simulation-log", n.join("\n"));
		}), p.stderr?.on("data", (e) => {
			f?.webContents.send("simulation-log", `ERROR: ${e.toString()}`);
		}), p.on("close", (t) => {
			p = null, f?.webContents.send("simulation-done", t), e(t);
		}), p.on("error", (e) => {
			p = null, n(e);
		});
	});
}), r.handle("kill-simulation", async () => p ? (p.kill(), p = null, !0) : !1), r.handle("get-config", async () => {
	let e = a.join(d, "src", "config", "config.json");
	if (!c.existsSync(e)) throw Error("Config file not found");
	let t = c.readFileSync(e, "utf-8");
	return JSON.parse(t);
}), r.handle("save-config", async (e, t) => {
	let n = a.join(d, "src", "config", "config.json");
	return c.writeFileSync(n, JSON.stringify(t, null, 2), "utf-8"), !0;
}), r.handle("select-model-file", async () => {
	let e = await n.showOpenDialog(f, {
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
}), r.handle("upload-model", async () => {
	let e = await n.showOpenDialog(f, {
		title: "Upload External PPO Model File",
		properties: ["openFile"],
		filters: [{
			name: "PPO Model (.zip)",
			extensions: ["zip"]
		}]
	});
	if (e.canceled || e.filePaths.length === 0) return null;
	let t = e.filePaths[0], r = a.join(d, "models"), i = Date.now(), o = a.basename(t, ".zip"), s = a.join(r, "uploaded", "sea_state_unknown", `simulation_uploaded_${o}_${i}`);
	c.existsSync(s) || c.mkdirSync(s, { recursive: !0 });
	let l = a.join(s, `ppomodel_${o}.zip`);
	return c.copyFileSync(t, l), {
		success: !0,
		fileName: a.basename(l)
	};
});
//#endregion
export {};
