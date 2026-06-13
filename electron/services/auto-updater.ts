import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'

// TODO: Phase 2 - 完整自動更新流程（需要設定 publish 配置和更新伺服器）
export class AutoUpdateService {
  private mainWindow: BrowserWindow | null = null
  private checking = false

  init(win: BrowserWindow) {
    this.mainWindow = win

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('checking-for-update', () => {
      this.mainWindow?.webContents.send('update-status', { state: 'checking' })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.mainWindow?.webContents.send('update-status', {
        state: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.mainWindow?.webContents.send('update-status', { state: 'not-available' })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.mainWindow?.webContents.send('update-status', {
        state: 'downloading',
        percent: Math.round(progress.percent),
      })
    })

    autoUpdater.on('update-downloaded', () => {
      this.mainWindow?.webContents.send('update-status', { state: 'downloaded' })
    })

    autoUpdater.on('error', (err) => {
      this.mainWindow?.webContents.send('update-status', {
        state: 'error',
        message: err.message,
      })
      this.checking = false
    })
  }

  async checkForUpdates() {
    if (this.checking) return { success: false, error: 'Already checking' }
    this.checking = true
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    } finally {
      this.checking = false
    }
  }

  async downloadUpdate() {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  quitAndInstall() {
    autoUpdater.quitAndInstall()
  }
}

export const autoUpdateService = new AutoUpdateService()
