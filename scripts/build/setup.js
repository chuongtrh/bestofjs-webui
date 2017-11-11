const path = require('path')
const packageJson = require(path.join(process.cwd(), 'package.json'))

process.env.VERSION = packageJson.version
process.env.GITHUB_URL = packageJson.repository.url
