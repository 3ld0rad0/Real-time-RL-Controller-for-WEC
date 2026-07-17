import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, ChildProcess } from 'node:child_process'
import os from 'node:os'

// Disable hardware acceleration for VM/headless compatibility
app.disableHardwareAcceleration()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const processRoot = path.join(__dirname, '../../') // Root of Real-time-RL-Controller-for-WEC

let mainWindow: BrowserWindow | null = null
let currentSimulation: ChildProcess | null = null
let isMaximized = false
let previousBounds: { x: number; y: number; width: number; height: number } | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // For loading local file:// images easily
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers for Custom Title Bar Window Controls (Manual layout setting for Linux support)
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (!mainWindow) return
  if (isMaximized) {
    if (previousBounds) {
      mainWindow.setBounds(previousBounds)
    } else {
      mainWindow.setSize(1200, 800)
      mainWindow.center()
    }
    isMaximized = false
    mainWindow.webContents.send('window-maximized-state', false)
  } else {
    previousBounds = mainWindow.getBounds()
    const primaryDisplay = screen.getPrimaryDisplay()
    const { x, y, width, height } = primaryDisplay.workArea
    mainWindow.setBounds({ x, y, width, height })
    isMaximized = true
    mainWindow.webContents.send('window-maximized-state', true)
  }
})

ipcMain.on('window-close', () => {
  mainWindow?.close()
})

ipcMain.handle('get-models', async () => {
  const modelsDir = path.join(processRoot, 'models')
  if (!fs.existsSync(modelsDir)) return []

  const files = fs.readdirSync(modelsDir, { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.includes('ppomodel'))

  const models = []

  for (const file of files) {
    const fullPath = path.join(modelsDir, file)
    const stats = fs.statSync(fullPath)
    if (stats.isFile()) {
      const parts = file.split(path.sep)
      let wave_type = 'unknown'
      let sea_state = 'unknown'
      let ent_coef = 'unknown'

      if (parts.length >= 3) {
        wave_type = parts[0]
        sea_state = parts[1]
        ent_coef = parts[2].replace('simulation_', '')
      }

      models.push({
        id: file.replace(/\\/g, '/'),
        name: path.basename(file),
        path: fullPath,
        size: stats.size,
        date: stats.mtime.toISOString(),
        wave_type,
        sea_state,
        ent_coef
      })
    }
  }
  return models
})

async function getResultsInternal() {
  const resultsDir = path.join(processRoot, 'results')
  if (!fs.existsSync(resultsDir)) return []

  const files = fs.readdirSync(resultsDir, { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.csv'))

  const runsMap: Record<string, any> = {}

  for (const file of files) {
    const relativePath = file.replace(/\\/g, '/')
    const fullPath = path.join(resultsDir, file)
    const stats = fs.statSync(fullPath)
    
    if (!stats.isFile()) continue

    let base = relativePath
    let fileType: 'main' | 'energy' | 'reward' = 'main'

    if (relativePath.endsWith('_energy_absorbed.csv')) {
      base = relativePath.replace('_energy_absorbed.csv', '')
      fileType = 'energy'
    } else if (relativePath.endsWith('_reward.csv')) {
      base = relativePath.replace('_reward.csv', '')
      fileType = 'reward'
    } else if (relativePath.endsWith('.csv')) {
      base = relativePath.replace('.csv', '')
      fileType = 'main'
    }

    if (!runsMap[base]) {
      runsMap[base] = {
        id: base,
        displayName: path.basename(base),
        date: stats.mtime.toISOString(),
        mode: base.includes('train') ? 'train' : base.includes('test') ? 'test' : 'final',
        plotUrl: null,
        files: {}
      }
    }

    runsMap[base].files[fileType] = relativePath

    // If it's the main file, use its modified date as the primary timestamp
    if (fileType === 'main') {
      runsMap[base].date = stats.mtime.toISOString()
    }
  }

  const results = []

  for (const base of Object.keys(runsMap)) {
    const run = runsMap[base]

    // Verify if static plot image (.png) exists for this base
    let plotPath = path.join(resultsDir, `${base}.png`)
    if (!fs.existsSync(plotPath)) {
      // Check in sibling folders like data/ -> plot/
      plotPath = path.join(resultsDir, base.replace('/data/', '/plot/') + '.png')
    }

    if (fs.existsSync(plotPath)) {
      run.plotUrl = `file://${plotPath.replace(/\\/g, '/')}`
    }

    // Only include runs that have at least a main CSV file
    if (run.files.main) {
      results.push(run)
    }
  }
  
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return results
}

ipcMain.handle('get-results', async () => {
  return getResultsInternal()
})

ipcMain.handle('download-result-file', async (_, filename) => {
  const sourcePath = path.join(processRoot, 'results', filename)
  if (!fs.existsSync(sourcePath)) throw new Error('Source file not found')

  const defaultName = path.basename(filename)
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Result CSV File',
    defaultPath: defaultName,
    filters: [
      { name: 'CSV File (.csv)', extensions: ['csv'] }
    ]
  })

  if (result.canceled || !result.filePath) {
    return false
  }

  fs.copyFileSync(sourcePath, result.filePath)
  return true
})

ipcMain.handle('read-csv', async (_, filename) => {
  const fullPath = path.join(processRoot, 'results', filename)
  if (!fs.existsSync(fullPath)) throw new Error('File not found')

  const content = fs.readFileSync(fullPath, 'utf-8')
  return content
})

ipcMain.handle('run-simulation', async (event, args) => {
  if (currentSimulation) {
    throw new Error('Simulation already running')
  }

  return new Promise((resolve, reject) => {
    // Detect python
    const venvPath = path.join(processRoot, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python')
    const pythonExe = fs.existsSync(venvPath) ? venvPath : (process.platform === 'win32' ? 'python' : 'python3')

    // Map UI inputs (control/type) to python runner CLI args
    const controlArg = args.type === 'sim' ? 'rl' : 'baseline';

    let typeArg = 'latching';
    if (args.control === 'reactive') {
      typeArg = 'linear';
    } else if (args.control === 'latching') {
      typeArg = 'latching';
    } else if (args.control === 'none') {
      typeArg = 'latching'; // Default fallback
    }

    const cmdArgs = ['run.py', '--mode', args.mode, '--control', controlArg, '--type', typeArg, '--sea-state', args.sea_state.toString()]

    if (args.mixed) cmdArgs.push('--mixed')
    if (args.regular) cmdArgs.push('--regular')
    if (args.sim_time) cmdArgs.push('--sim-time', args.sim_time.toString())
    if (args.save) cmdArgs.push('--save')
    if (args.retrain) cmdArgs.push('--retrain')
    if (args.run_name) cmdArgs.push('--run-name', args.run_name.toString())

    if (args.model_id) {
      const modelPath = path.isAbsolute(args.model_id)
        ? args.model_id
        : path.join(processRoot, 'models', args.model_id)
      cmdArgs.push('--model-path', modelPath)
    }

    if (args.batch_size) cmdArgs.push('--batch-size', args.batch_size.toString())
    if (args.entropy_coef) cmdArgs.push('--entropy-coef', args.entropy_coef.toString())

    currentSimulation = spawn(pythonExe, cmdArgs, {
      cwd: processRoot,
      env: { ...process.env, MPLBACKEND: 'Agg' }
    })

    currentSimulation.stdout?.on('data', (data) => {
      const output = data.toString()
      const lines = output.split('\n')
      const filteredLines: string[] = []

      for (const line of lines) {
        const progressMatch = line.match(/\[PROGRESS\]\s+(\d+)/)
        if (progressMatch) {
          const percent = parseInt(progressMatch[1], 10)
          mainWindow?.webContents.send('simulation-progress', percent)
        } else {
          filteredLines.push(line)
        }
      }

      if (filteredLines.length > 0) {
        mainWindow?.webContents.send('simulation-log', filteredLines.join('\n'))
      }
    })

    currentSimulation.stderr?.on('data', (data) => {
      mainWindow?.webContents.send('simulation-log', `ERROR: ${data.toString()}`)
    })

    currentSimulation.on('close', async (code) => {
      currentSimulation = null
      mainWindow?.webContents.send('simulation-done', code)
      
      let latestRunId: string | null = null
      try {
        const results = await getResultsInternal()
        if (results.length > 0) {
          latestRunId = results[0].id
        }
      } catch (err) {
        console.error("Error finding latest run ID after simulation close", err)
      }
      
      resolve({ code, latestRunId })
    })

    currentSimulation.on('error', (err) => {
      currentSimulation = null
      reject(err)
    })
  })
})

ipcMain.handle('kill-simulation', async () => {
  if (currentSimulation) {
    currentSimulation.kill()
    currentSimulation = null
    return true
  }
  return false
})

ipcMain.handle('get-config', async () => {
  const configPath = path.join(processRoot, 'src', 'config', 'config.json')
  if (!fs.existsSync(configPath)) {
    throw new Error('Config file not found')
  }
  const content = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(content)
})

ipcMain.handle('save-config', async (_, newConfig) => {
  const configPath = path.join(processRoot, 'src', 'config', 'config.json')
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8')
  return true
})

ipcMain.handle('select-model-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select PPO Model File',
    properties: ['openFile'],
    filters: [
      { name: 'PPO Model (.zip)', extensions: ['zip'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('upload-model', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Upload External PPO Model File',
    properties: ['openFile'],
    filters: [
      { name: 'PPO Model (.zip)', extensions: ['zip'] }
    ]
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const sourcePath = result.filePaths[0]
  const modelsDir = path.join(processRoot, 'models')
  
  const timestamp = Date.now()
  const baseName = path.basename(sourcePath, '.zip')
  // We place it in models/uploaded/sea_state_unknown/simulation_uploaded_[name]_[timestamp]
  const targetSubdir = path.join(modelsDir, 'uploaded', 'sea_state_unknown', `simulation_uploaded_${baseName}_${timestamp}`)
  
  if (!fs.existsSync(targetSubdir)) {
    fs.mkdirSync(targetSubdir, { recursive: true })
  }

  const targetPath = path.join(targetSubdir, `ppomodel_${baseName}.zip`)
  fs.copyFileSync(sourcePath, targetPath)

  return {
    success: true,
    fileName: path.basename(targetPath)
  }
})

ipcMain.handle('copy-model-file', async (event, sourcePath) => {
  if (!fs.existsSync(sourcePath)) {
    return null
  }
  const modelsDir = path.join(processRoot, 'models')
  
  const timestamp = Date.now()
  const baseName = path.basename(sourcePath, '.zip')
  const targetSubdir = path.join(modelsDir, 'uploaded', 'sea_state_unknown', `simulation_uploaded_${baseName}_${timestamp}`)
  
  if (!fs.existsSync(targetSubdir)) {
    fs.mkdirSync(targetSubdir, { recursive: true })
  }

  const targetPath = path.join(targetSubdir, `ppomodel_${baseName}.zip`)
  fs.copyFileSync(sourcePath, targetPath)

  return {
    success: true,
    fileName: path.basename(targetPath)
  }
})

ipcMain.handle('get-home-dir', () => os.homedir())

ipcMain.handle('list-directory', async (event, targetPath) => {
  try {
    const resolvedPath = targetPath ? path.resolve(targetPath) : os.homedir()
    const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true })
    
    const directories = []
    const files = []
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      
      const fullPath = path.join(resolvedPath, entry.name)
      try {
        const stats = await fs.promises.stat(fullPath)
        
        if (entry.isDirectory()) {
          directories.push({
            name: entry.name,
            path: fullPath,
            isDirectory: true
          })
        } else if (entry.isFile() && entry.name.endsWith('.zip')) {
          files.push({
            name: entry.name,
            path: fullPath,
            size: stats.size,
            isDirectory: false
          })
        }
      } catch {
        // Skip entry if permission denied
      }
    }
    
    directories.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))
    
    return {
      currentPath: resolvedPath,
      parentPath: resolvedPath === '/' || resolvedPath === path.parse(resolvedPath).root ? null : path.dirname(resolvedPath),
      directories,
      files
    }
  } catch (err) {
    console.error('Failed to list directory:', err)
    return null
  }
})


