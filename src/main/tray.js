import path from 'path'
import { Tray, Menu } from 'electron'

export default function(mainWindow, app) {

	const appIcon = new Tray(path.join(__static, 'tray.png'))
	const contextMenu = Menu.buildFromTemplate([{
		label: 'Show App',
		click: () => {
			mainWindow.show()
		}
	}, {
		label: 'Quit',
		click: () => {
			app.isQuiting = true
			app.quit()
		}
	}])
	appIcon.setToolTip('Epiphany')
	appIcon.setContextMenu(contextMenu)
	appIcon.on('click', function() {
		if (mainWindow === null) {
			app.exit()
			return
		}
		if (mainWindow.isVisible()) {
			mainWindow.hide()
		} else {
			mainWindow.show()
		}
	})

	return appIcon
}
