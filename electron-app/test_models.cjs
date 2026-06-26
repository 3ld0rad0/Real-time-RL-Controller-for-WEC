const path = require('path')
const fs = require('fs')
const { globSync } = require('glob')

const processRoot = path.join(__dirname, '../')
const modelsDir = path.join(processRoot, 'models')

console.log('modelsDir:', modelsDir)
const files = globSync('**/ppomodel*', { cwd: modelsDir })
console.log('files found:', files)

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
console.log('models parsed:', models)
