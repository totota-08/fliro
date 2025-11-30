import settings from './settings.json'
import packageInfo from '../../package.json'

const appName = settings.appName || packageInfo.name || 'App'
const appVersion = packageInfo.version || settings.version || ''

export { appName, appVersion }
