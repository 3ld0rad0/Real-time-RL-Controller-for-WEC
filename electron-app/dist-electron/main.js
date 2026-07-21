import { BrowserWindow as e, app as t, dialog as n, ipcMain as r, screen as i } from "electron";
import a, { join as o } from "node:path";
import { fileURLToPath as s } from "node:url";
import c from "node:fs";
import { spawn as l } from "node:child_process";
import u from "node:os";
//#region electron/main.ts
t.disableHardwareAcceleration();
var d = a.dirname(s(import.meta.url)), f = a.join(d, "../../"), p = null, m = null, h = !1, g = null;
function _() {
	p = new e({
		width: 1200,
		height: 800,
		frame: !1,
		webPreferences: {
			preload: o(d, "preload.mjs"),
			nodeIntegration: !1,
			contextIsolation: !0,
			webSecurity: !1
		}
	}), process.env.VITE_DEV_SERVER_URL ? (p.loadURL(process.env.VITE_DEV_SERVER_URL), p.webContents.openDevTools()) : p.loadFile(o(d, "../dist/index.html"));
}
t.whenReady().then(() => {
	_(), t.on("activate", () => {
		e.getAllWindows().length === 0 && _();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
}), r.on("window-minimize", () => {
	p?.minimize();
}), r.on("window-maximize", () => {
	if (p) if (h) g ? p.setBounds(g) : (p.setSize(1200, 800), p.center()), h = !1, p.webContents.send("window-maximized-state", !1);
	else {
		g = p.getBounds();
		let { x: e, y: t, width: n, height: r } = i.getPrimaryDisplay().workArea;
		p.setBounds({
			x: e,
			y: t,
			width: n,
			height: r
		}), h = !0, p.webContents.send("window-maximized-state", !0);
	}
}), r.on("window-close", () => {
	p?.close();
}), r.handle("get-models", async () => {
	let e = a.join(f, "models");
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
});
async function v() {
	let e = a.join(f, "results");
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
}
r.handle("get-results", async () => v()), r.handle("download-result-file", async (e, t) => {
	let r = a.join(f, "results", t);
	if (!c.existsSync(r)) throw Error("Source file not found");
	let i = a.basename(t), o = await n.showSaveDialog(p, {
		title: "Save Result CSV File",
		defaultPath: i,
		filters: [{
			name: "CSV File (.csv)",
			extensions: ["csv"]
		}]
	});
	return o.canceled || !o.filePath ? !1 : (c.copyFileSync(r, o.filePath), !0);
}), r.handle("read-csv", async (e, t) => {
	let n = a.join(f, "results", t);
	if (!c.existsSync(n)) throw Error("File not found");
	return c.readFileSync(n, "utf-8");
}), r.handle("delete-result-run", async (e, t) => {
	let n = a.join(f, "results"), r = t, i = [
		a.join(n, `${r}.csv`),
		a.join(n, `${r}_energy_absorbed.csv`),
		a.join(n, `${r}_reward.csv`),
		a.join(n, `${r}.png`),
		a.join(n, r.replace("/data/", "/plot/") + ".png"),
		a.join(n, `${r}_energy_absorbed.png`),
		a.join(n, r.replace("/data/", "/plot/") + "_energy_absorbed.png"),
		a.join(n, `${r}_reward.png`),
		a.join(n, r.replace("/data/", "/plot/") + "_reward.png")
	], o = !1;
	for (let e of i) if (c.existsSync(e)) try {
		c.unlinkSync(e), o = !0;
	} catch (t) {
		console.error(`Failed to delete file: ${e}`, t);
	}
	return o;
}), r.handle("delete-model", async (e, t) => {
	let n = a.join(f, "models"), r = a.join(n, t);
	if (c.existsSync(r)) try {
		c.unlinkSync(r);
		let e = a.dirname(r);
		for (; e !== n && e.startsWith(n) && c.readdirSync(e).length === 0;) c.rmdirSync(e), e = a.dirname(e);
		return !0;
	} catch (e) {
		throw console.error(`Failed to delete model file: ${r}`, e), e;
	}
	return !1;
}), r.handle("run-simulation", async (e, t) => {
	if (m) throw Error("Simulation already running");
	return new Promise((e, n) => {
		let r = a.join(f, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python"), i = c.existsSync(r) ? r : process.platform === "win32" ? "python" : "python3", o = t.type === "sim" ? "rl" : "baseline", s = "latching";
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
		if (t.mixed && u.push("--mixed"), t.regular && u.push("--regular"), t.sim_time && u.push("--sim-time", t.sim_time.toString()), t.save && u.push("--save"), t.retrain && u.push("--retrain"), t.run_name && u.push("--run-name", t.run_name.toString()), t.model_id) {
			let e = a.isAbsolute(t.model_id) ? t.model_id : a.join(f, "models", t.model_id);
			u.push("--model-path", e);
		}
		t.batch_size && u.push("--batch-size", t.batch_size.toString()), t.entropy_coef && u.push("--entropy-coef", t.entropy_coef.toString()), m = l(i, u, {
			cwd: f,
			env: {
				...process.env,
				MPLBACKEND: "Agg"
			}
		}), m.stdout?.on("data", (e) => {
			let t = e.toString().split("\n"), n = [];
			for (let e of t) {
				let t = e.match(/\[PROGRESS\]\s+(\d+)/);
				if (t) {
					let e = parseInt(t[1], 10);
					p?.webContents.send("simulation-progress", e);
				} else n.push(e);
			}
			n.length > 0 && p?.webContents.send("simulation-log", n.join("\n"));
		}), m.stderr?.on("data", (e) => {
			p?.webContents.send("simulation-log", `ERROR: ${e.toString()}`);
		}), m.on("close", async (t) => {
			m = null, p?.webContents.send("simulation-done", t);
			let n = null;
			try {
				let e = await v();
				e.length > 0 && (n = e[0].id);
			} catch (e) {
				console.error("Error finding latest run ID after simulation close", e);
			}
			e({
				code: t,
				latestRunId: n
			});
		}), m.on("error", (e) => {
			m = null, n(e);
		});
	});
}), r.handle("kill-simulation", async () => m ? (m.kill(), m = null, !0) : !1), r.handle("get-config", async () => {
	let e = a.join(f, "src", "config", "config.json");
	if (!c.existsSync(e)) throw Error("Config file not found");
	let t = c.readFileSync(e, "utf-8");
	return JSON.parse(t);
}), r.handle("save-config", async (e, t) => {
	let n = a.join(f, "src", "config", "config.json");
	return c.writeFileSync(n, JSON.stringify(t, null, 2), "utf-8"), !0;
}), r.handle("select-model-file", async () => {
	let e = await n.showOpenDialog(p, {
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
	let e = await n.showOpenDialog(p, {
		title: "Upload External PPO Model File",
		properties: ["openFile"],
		filters: [{
			name: "PPO Model (.zip)",
			extensions: ["zip"]
		}]
	});
	if (e.canceled || e.filePaths.length === 0) return null;
	let t = e.filePaths[0], r = a.join(f, "models"), i = Date.now(), o = a.basename(t, ".zip"), s = a.join(r, "uploaded", "sea_state_unknown", `simulation_uploaded_${o}_${i}`);
	c.existsSync(s) || c.mkdirSync(s, { recursive: !0 });
	let l = a.join(s, `ppomodel_${o}.zip`);
	return c.copyFileSync(t, l), {
		success: !0,
		fileName: a.basename(l)
	};
}), r.handle("copy-model-file", async (e, t) => {
	if (!c.existsSync(t)) return null;
	let n = a.join(f, "models"), r = Date.now(), i = a.basename(t, ".zip"), o = a.join(n, "uploaded", "sea_state_unknown", `simulation_uploaded_${i}_${r}`);
	c.existsSync(o) || c.mkdirSync(o, { recursive: !0 });
	let s = a.join(o, `ppomodel_${i}.zip`);
	return c.copyFileSync(t, s), {
		success: !0,
		fileName: a.basename(s)
	};
}), r.handle("get-home-dir", () => u.homedir()), r.handle("list-directory", async (e, t) => {
	try {
		let e = t ? a.resolve(t) : u.homedir(), n = await c.promises.readdir(e, { withFileTypes: !0 }), r = [], i = [];
		for (let t of n) {
			if (t.name.startsWith(".")) continue;
			let n = a.join(e, t.name);
			try {
				let e = await c.promises.stat(n);
				t.isDirectory() ? r.push({
					name: t.name,
					path: n,
					isDirectory: !0
				}) : t.isFile() && t.name.endsWith(".zip") && i.push({
					name: t.name,
					path: n,
					size: e.size,
					isDirectory: !1
				});
			} catch {}
		}
		return r.sort((e, t) => e.name.localeCompare(t.name)), i.sort((e, t) => e.name.localeCompare(t.name)), {
			currentPath: e,
			parentPath: e === "/" || e === a.parse(e).root ? null : a.dirname(e),
			directories: r,
			files: i
		};
	} catch (e) {
		return console.error("Failed to list directory:", e), null;
	}
});
//#endregion
export {};
