import fs from 'fs'
import path from 'path'

import fileUtils from '../utils/file'

var Library

class Image {
	constructor (localURL, name, note) {
		if (typeof localURL === 'object') {
			var data = localURL
			this.localURL = null
			this.name = data.name
			this._path = data.path
			this._note = null
			return
		}

		if (!localURL.startsWith('epiphany://')) {
			throw new Error('Incorrect Image URL')
		}

		this.localURL = localURL
		this.name = name
		this._path = null
		this._note = note
	}

	makeFilePath() {
		var p = this.localURL.replace(/^epiphany:\/\//i, '')
		if (p.indexOf('.images/') === 0) {
			return path.join(Library.baseLibraryPath, p)
		}

		if (this._note) {
			var basePath = this._note.imagePath
			if (!basePath || basePath.length === 0) throw new Error('Invalid Base Path')
			return path.join(basePath, p)
		}

		return p
	}

	makeAbsolutePath() {
		return 'epiphany://' + encodeURI(this.makeFilePath())
	}

	static appendSuffix(filePath) {
		var c = 'abcdefghijklmnopqrstuvwxyz'
		var r = ''
		for (var i = 0; i < 8; i++) {
			r += c[Math.floor(Math.random() * c.length)]
		}
		var e = path.extname(filePath)
		if (e.length > 0) {
			return filePath.slice(0, -e.length) + '_' + r + e
		}
		return filePath + '_' + r
	}

	static fromClipboard(im, note) {
		var dirPath = path.join(Library.baseLibraryPath, '.images')
		if (note) {
			dirPath = note.imagePath
		}
		//create a name based on current date and save it.
		var d = new Date()
		var name = d.getFullYear().toString() + (d.getMonth()+1).toString() +
			d.getDate().toString() + '_' + d.getHours().toString() +
			d.getMinutes().toString() + d.getSeconds().toString() + '.png'

		try {
			fs.mkdirSync(dirPath)
		} catch (e) {
			// can't make dir
		}
		var savePath = path.join(dirPath, name)
		// check exists or not.
		try {
			var fd = fs.openSync(savePath, 'r')
			if (fd) {
				fs.close(fd)
			}
			name = this.appendSuffix(name)
			savePath = path.join(dirPath, name)
		} catch (e) {
			// if not exists
		}
		fs.writeFileSync(savePath, im.toPNG())
		return new this('epiphany://' + name, name)
	}

	static fromBinary(name, frompath, note) {
		var dirPath = path.join(Library.baseLibraryPath, '.images')
		if (note) {
			dirPath = note.imagePath
		}
		// try creating images dir.
		try {
			fs.mkdirSync(dirPath)
		} catch (e) {
			// can't make dir
		}
		var savePath = path.join(dirPath, name)
		// check exists or not.
		try {
			var fd = fs.openSync(savePath, 'r')
			if (fd) {
				fs.close(fd)
			}
			name = this.appendSuffix(name)
			savePath = path.join(dirPath, name)
		} catch (e) {
			// if not exists
		}

		if (frompath.indexOf('http') === 0) {
			name = fileUtils.getFileDataFromUrl(frompath).cleanname
			if (window && window.bus) {
				window.bus.$emit('download-file', {
					file  : frompath,
					folder: dirPath
				})
			}
		} else {
			fs.writeFileSync(savePath, fs.readFileSync(frompath))
		}
		return new this('epiphany://' + name, name)
	}
}

export default function(library) {
	Library = library
	return Image
};
