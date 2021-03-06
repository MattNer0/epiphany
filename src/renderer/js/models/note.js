import fs from 'fs'
import path from 'path'
import encrypt from 'encryptjs'
import moment from 'moment'
import _ from 'lodash'
import arr from '../utils/arr'
import elosenv from '../utils/elosenv'
import utilFile from '../utils/file'
import opml from '../utils/opml'
import Model from './baseModel'

var Library
var Image

class Note extends Model {
	constructor(data) {
		super(data)

		this._ext = data.extension || '.md'

		this._name = data.name
		this._path = data.path
		if (data.folder || data.rack) {
			this.rack = data.rack || data.folder.rack
		} else {
			this.rack = null
		}
		this.folder = data.folder
		this.doc = null
		this._removed = false
		this._metadata = {}

		if (data.photo) {
			this._photo = path.basename(data.photo)
		}

		if (data.created_at && (typeof data.created_at === 'number' || data.created_at instanceof Date)) {
			this._metadata.createdAt = moment(data.created_at).format('YYYY-MM-DD HH:mm:ss')
		}

		if (data.updated_at && (typeof data.updated_at === 'number' || data.updated_at instanceof Date)) {
			this._metadata.updatedAt = moment(data.updated_at).format('YYYY-MM-DD HH:mm:ss')
		}

		if (data.favorite) {
			this._metadata.starred = 'true'
		}

		if (data.summary) {
			this._summary = data.summary
		} else {
			this._summary = ''
		}

		if (data.size) {
			this._size = data.size
		} else {
			this._size = 0
		}

		if (!data.body || data.body === '') {
			this._loadedBody = false
			this._body = ''
		} else {
			this.replaceBody(data.body)
		}
	}

	get updatedAt() {
		if (!this._metadata.updatedAt) {
			this.setUpdatedAt()
		}
		return moment(this._metadata.updatedAt)
	}

	set updatedAt(value) {
		this.setMetadata('updatedAt', value)
	}

	get createdAt() {
		return moment(this._metadata.createdAt)
	}

	set createdAt(value) {
		this.setMetadata('createdAt', value)
	}

	get starred() {
		return this._metadata.starred && this._metadata.starred === 'true'
	}

	set starred(value) {
		this.setMetadata('starred', String(value).toLowerCase())
	}

	get loaded() {
		return this._loadedBody
	}

	get data() {
		return _.assign(super.data, {
			body            : this._body,
			path            : this._path,
			extension       : this._ext,
			documentFilename: this.documentFilename,
			rack            : this.rack,
			folder          : this.folder
		})
	}

	get fileSize() {
		if (this._size) {
			if (this._size > 1024) {
				return {
					size: (this._size / 1024).toFixed(2),
					unit: 'KB'
				}
			}

			return {
				size: this._size,
				unit: 'Bytes'
			}
		}

		return null
	}

	get extension() {
		return this._ext
	}

	get isEncrypted() {
		return false
	}

	get isEncryptedNote() {
		return false
	}

	get isOutline() {
		return false
	}

	get properties() {
		return {
			lineCount: (this._body.match(/\n/g) || []).length,
			wordCount: this._body.replace(/\n/g, ' ').replace(/ +/g, ' ').split(' ').length,
			charCount: this._body.replace(/\W/g, '').length
		}
	}

	get metadataregex() {
		return (/^(([+-]{3,}\n)|([a-z]+)\s?[:=]\s+['"]?([\w\W\s]+?)['"]?\s*\n(?=(\w+\s?[:=])|\n|([+-]{3,}\n)?))\n*/gmiy)
	}

	get metadata() {
		return this._metadata
	}

	get metadataKeys() {
		return Object.keys(this._metadata)
	}

	set metadata(newValue) {
		this._metadata = newValue
		var str = '+++\n'
		Object.keys(newValue).forEach((key) => {
			if (newValue[key]) str += key + ' = "' + newValue[key] + '"\n'
		})
		this._body = str + '+++\n\n' + this.bodyWithoutMetadata
	}

	set path(newValue) {
		if (!this._path || newValue !== this._path) {
			try {
				utilFile.deleteFile(this._path)
			} catch (e) {
				console.error(e)
			}

			var imageFolderPath = this.imagePath

			// what if new folder already exists?
			if (imageFolderPath && imageFolderPath.length > 1 && fs.existsSync(imageFolderPath)) {
				utilFile.moveFolderRecursiveSync(
					imageFolderPath,
					path.dirname(newValue),
					'.' + path.basename(newValue, path.extname(newValue))
				)
			}

			this._path = newValue
		}
	}

	get path() {
		if (this._path && (this._removed || fs.existsSync(this._path))) {
			return this._path
		}
		var newPath = path.join(
			this.folder.path,
			this.documentFilename
		) + this._ext
		return newPath
	}

	get imagePath() {
		if (this._path) {
			return path.join(path.dirname(this._path), '.' + path.basename(this._path, path.extname(this._path)))
		}
		return ''
	}

	get relativePath() {
		return this.path.replace(Library.baseLibraryPath + '/', '')
	}

	get documentFilename() {
		return this.title ? utilFile.cleanFileName(this.title) : ''
	}

	get body() {
		return this._body
	}

	set body(newValue) {
		if (newValue !== this._body) {
			if (!this._metadata.createdAt) this._metadata.createdAt = moment().format('YYYY-MM-DD HH:mm:ss')
			this.setUpdatedAt()
			this._body = newValue
		}
	}

	get bodyWithoutMetadata() {
		return this._body.replace(this.metadataregex, '').replace(/^\n+/, '')
	}

	get bodyWithoutTitle() {
		if (this._body) {
			return this.cleanPreviewBody(this.splitTitleFromBody().body)
		}
		return ''
	}

	get bodyPreview() {
		let str = this.bodyWithoutTitle
		if (str === '' && this._summary) {
			return this._summary.slice(0, 300)
		}
		str = str.replace(/^\[source\]\(.+\)\n$/img, '')
		str = str.replace(/\[!\[\]\([^)]+\)\]\([^)]+\)/ig, '')
		str = str.replace(/!?\[([^\]]+)\]\([^)]+\)/ig, '$1')
		str = str.replace(/^!\[\]\([^)]+\)$/igm, '')
		str = str.replace(/\n+/g, '\n')
		return str.slice(0, 300)
	}

	get title() {
		if (this.body) {
			return this.splitTitleFromBody().title || this._name
		}
		return this._name
	}

	set title(newValue) {
		this._name = newValue
	}

	get bodyWithDataURL() {
		var body = this.body

		body = body.replace(
			/!\[(.*?)]\((epiphany:\/\/.*?)\)/mg,
			(match, p1, p2) => {
				var dataURL
				try {
					dataURL = new Image(p2, path.basename(p2), this).makeAbsolutePath()
				} catch (e) {
					elosenv.console.warn(e)
					return match
				}
				return '![' + p1 + '](' + dataURL + ')'
			}
		)

		body = body.replace(
			/^\[([\w\d]+)]:\s(epiphany:\/\/.*?)$/mg,
			(match, p1, p2) => {
				var dataURL
				try {
					dataURL = new Image(p2, path.basename(p2), this).makeAbsolutePath()
				} catch (e) {
					elosenv.console.warn(e)
					return match
				}
				return '[' + p1 + ']: ' + dataURL
			}
		)
		return body
	}

	get bodyWithMetadata() {
		if (this._body) {
			var str = '+++\n'

			if (this.createdAt.valueOf() === 0) {
				this._metadata.createdAt = this._metadata.updatedAt
			}

			Object.keys(this._metadata).forEach((key) => {
				if (Array.isArray(this._metadata[key]) && this._metadata[key].length > 0) {
					str += key + ' = "' + this._metadata[key].join(', ') + '"\n'
				} else if (this._metadata[key]) str += key + ' = "' + this._metadata[key] + '"\n'
			})
			return str + '+++\n\n' + this._body.replace(/[\t ]?(\r\n|\r|\n)/g, '\n')
		}
		return ''
	}

	get img() {
		var dataUrl
		if (this._photo) {
			try {
				dataUrl = new Image('epiphany://' + this._photo, this._photo, this).makeAbsolutePath()
			} catch (e) {
				dataUrl = null
			}
			if (dataUrl) return dataUrl
		}
		if (this._body) {
			var matched = (/(https?|epiphany):\/\/[-a-zA-Z0-9@:%_+.~#?&/\\=]+?\.(png|jpeg|jpg|gif)/).exec(this.body)
			if (!matched) {
				return null
			} else if (matched[1] === 'http' || matched[1] === 'https') {
				return matched[0]
			}
			try {
				dataUrl = new Image(matched[0], path.basename(matched[0]), this).makeAbsolutePath()
			} catch (e) {
				dataUrl = null
			}
			return dataUrl
		}
		return null
	}

	get imgPath() {
		if (this._body) {
			var matched = (/(https?|epiphany):\/\/([-a-zA-Z0-9@:%_+.~#?&/\\=]+?\.(png|jpeg|jpg|gif))/).exec(this.body)
			if (!matched) {
				return null
			} else if (matched[1] === 'http' || matched[1] === 'https') {
				return matched[0]
			} else {
				return matched[2]
			}
		}
		return null
	}

	toJSON() {
		return {
			extension: this._ext,
			name     : this._name,
			body     : this._body,
			path     : this._path,
			folder   : this.folder.path,
			rack     : this.rack.path
		}
	}

	downloadImages() {
		let createdDir = true
		const imageFormats = ['.png', '.jpg', '.gif', '.bmp']

		const urlDownloads = []
		const replacedStrings = []

		if (!fs.existsSync(this.imagePath)) {
			createdDir = false
		}

		this.body = this.body.replace(
			/!\[([^\]]*?)]\((https?:\/\/.*?)\)/img,
			(match, p1, p2) => {
				const fileData = utilFile.getFileDataFromUrl(p2)
				if (fileData.extname && imageFormats.indexOf(fileData.extname) >= 0) {
					if (!createdDir) {
						try {
							fs.mkdirSync(this.imagePath)
						} catch (e) {
							// directory exists
						}
						createdDir = true
					}
					const newStr = '![' + p1 + '](epiphany://' + fileData.cleanname + ')'
					try {
						if (urlDownloads.indexOf(p2) === -1) {
							urlDownloads.push(p2)
							replacedStrings.push({
								original: match,
								new     : newStr
							})
						}
					} catch (e) {
						elosenv.console.warn(e)
						return match
					}

					return newStr
				}
				return match
			}
		)

		this.body = this.body.replace(
			/^\[(\d+)\]:\s(https?:\/\/.*?$)/img,
			(match, p1, p2) => {
				const fileData = utilFile.getFileDataFromUrl(p2)
				if (fileData.extname && imageFormats.indexOf(fileData.extname) >= 0) {
					if (!createdDir) {
						try {
							fs.mkdirSync(this.imagePath)
						} catch (e) {
							// directory exists
						}
						createdDir = true
					}
					const newStr = '[' + p1 + ']: epiphany://' + fileData.cleanname
					try {
						if (urlDownloads.indexOf(p2) === -1) {
							urlDownloads.push(p2)
							replacedStrings.push({
								original: match,
								new     : newStr
							})
						}
					} catch (e) {
						elosenv.console.warn(e)
						return match
					}

					return newStr
				}
				return match
			}
		)

		if (urlDownloads.length > 0) {
			this.setMetadata('urls', urlDownloads)
			if (window && window.bus) {
				window.bus.$emit('download-files', {
					files   : urlDownloads,
					replaced: replacedStrings,
					note    : this.path,
					folder  : this.imagePath
				})
			}
		}
	}

	setMetadata(key, value) {
		if (key) this._metadata[key] = value
	}

	isFolder(f) {
		return this.folder.uid === f.uid
	}

	isRack(r) {
		return this.folder.rack.uid === r.uid
	}

	parseMetadata() {
		const re = this.metadataregex
		const metadata = {}
		let m

		function cleanMatch(m) {
			if (!m) return m
			const newM = []
			for (var i = 1; i < m.length; i++) {
				if (m[i]) {
					newM.push(m[i])
				}
			}
			return newM
		}

		const firstMeta = this._body.match(re)
		if (firstMeta && this._body.indexOf(firstMeta[0]) === 0) {
			do {
				m = re.exec(this._body)
				m = cleanMatch(m)
				try {
					if (m && m[1].match(/^\+\+\++/)) {
						// +++
					} else if (m) {
						m[2] = m[2].replace(/\s+/g, ' ')
						if (m[1] === 'updatedAt' || m[1] === 'createdAt') {
							metadata[m[1]] = moment(m[2]).format('YYYY-MM-DD HH:mm:ss')
						} else if (m[1] === 'urls') {
							metadata[m[1]] = m[2].split(', ')
						} else {
							metadata[m[1]] = m[2]
						}
					}
				} catch (e) {
					elosenv.console.warn(e)
				}
			} while (m)
			this._metadata = metadata
			this._body = this.bodyWithoutMetadata
		}

		if (!this._metadata.createdAt || !this._metadata.updatedAt) {
			this.initializeCreationDate()
		}
	}

	loadBody() {
		if (this._loadedBody) return false

		if (fs.existsSync(this.path)) {
			const content = fs.readFileSync(this.path).toString()
			if (content && content !== this._body) {
				this.replaceBody(content)
			}
			this._loadedBody = true
			return true
		}

		return false
	}

	replaceBody(newBody) {
		this._body = newBody

		if (!this.isEncryptedNote && !this.isOutline) {
			this.parseMetadata()
			this.downloadImages()
		}
		this._loadedBody = true
	}

	getObjectDB(library) {
		var photoPath = this.imgPath
		if (photoPath) {
			photoPath = path.join(this.imagePath, photoPath)
		}

		var finalNote = {
			name      : this.title,
			photo     : photoPath ? path.relative(library, photoPath) : null,
			summary   : this.bodyPreview,
			favorite  : this.starred,
			path      : path.relative(library, this._path),
			created_at: this.createdAt.valueOf(),
			updated_at: this.updatedAt.valueOf(),
			library   : library
		}

		if (finalNote.created_at === 0) {
			finalNote.created_at = moment().valueOf()
		}

		if (finalNote.updated_at === 0) {
			finalNote.updated_at = moment().valueOf()
		}

		return finalNote
	}

	initializeCreationDate() {
		var noteStat = fs.statSync(this._path)
		if (noteStat) {
			if (!this._metadata.createdAt) {
				this._metadata.createdAt = moment(noteStat.birthtime).format('YYYY-MM-DD HH:mm:ss')
			}
			if (!this._metadata.updatedAt) {
				this._metadata.updatedAt = moment(noteStat.mtime).format('YYYY-MM-DD HH:mm:ss')
			}
		}
		this.saveModel()
	}

	update(data) {
		super.update(data)
		this._body = data.body
	}

	splitTitleFromBody() {
		var ret
		var lines = this.bodyWithoutMetadata.split('\n')
		lines.forEach((row, index) => {
			if (ret) {
				return
			}
			if (row.length > 0) {
				ret = {
					title: _.trimStart(row, '# '),
					meta : this._metadata,
					body : lines.slice(0, index).concat(lines.splice(index + 1)).join('\n')
				}
			}
		})

		if (ret) return ret

		return {
			title: '',
			meta : this._metadata,
			body : this.body
		}
	}

	cleanPreviewBody(text) {
		text = text.replace(/^\n/, '')
		text = text.replace(/\* \[ \]/g, '* ')
		text = text.replace(/\* \[x\]/g, '* ')
		return text
	}

	setUpdatedAt() {
		this._metadata.updatedAt = moment().format('YYYY-MM-DD HH:mm:ss')
	}

	saveData() {
		if (this._removed) return null

		var body = this.bodyWithMetadata
		if (this.isEncryptedNote) {
			if (this._encrypted) return { error: 'Encrypted' }
			body = this.encrypt()
		}

		var outerFolder
		if (this.rack && this.folder) {
			outerFolder = this.folder.path
		} else {
			outerFolder = path.dirname(this._path)
		}

		if (this.documentFilename) {
			var newPath = path.join(outerFolder, this.documentFilename) + this._ext

			if (body.length === 0) {
				return {
					'path'        : newPath,
					'oldpath'     : this._path,
					'extension'   : this._ext,
					'filename'    : this.documentFilename,
					'folder'      : outerFolder,
					'photogallery': this.imagePath,
					'body'        : ''
				}
			}

			return {
				'path'        : newPath,
				'oldpath'     : this._path,
				'extension'   : this._ext,
				'filename'    : this.documentFilename,
				'folder'      : outerFolder,
				'photogallery': this.imagePath,
				'body'        : body
			}
		}

		return null
	}

	saveModel() {
		const saveData = this.saveData()
		if (saveData === null) return
		let { body, path: newPath, folder: outerFolder, filename: documentFilename, photogallery } = saveData
		try {
			// new path
			if (newPath !== this._path) {
				var num = 1
				while (num > 0) {
					if (fs.existsSync(newPath)) {
						if (body && body !== fs.readFileSync(newPath).toString()) {
							newPath = path.join(outerFolder, documentFilename) + num + this._ext
						} else {
							newPath = null
							break
						}
						num++
					} else {
						break
					}
				}

				if (newPath) {
					fs.writeFileSync(newPath, body)
					utilFile.moveFolderRecursiveSync(
						photogallery,
						path.dirname(newPath),
						'.' + path.basename(newPath, path.extname(newPath))
					)
					this.path = newPath
					return { saved: true }
				}
				return { saved: false }
			}

			// same path
			if (!fs.existsSync(newPath) || (body.length > 0 && body !== fs.readFileSync(newPath).toString())) {
				fs.writeFileSync(newPath, body)
				this.path = newPath
				return { saved: true }
			}
			return { saved: false }
		} catch (e) {
			elosenv.console.warn('Couldn\'t save the note. Permission Error')
			return {
				error: 'Permission Error',
				path : newPath
			}
		}
	}

	remove() {
		if (this._removed) {
			return false
		} else {
			// move images to trash bin
			var imgDir = this.imagePath
			if (imgDir) utilFile.deleteFolderRecursive(imgDir)
			utilFile.deleteFile(this._path)
			this._body = ''
			this._summary = ''
			this._removed = true
			return true
		}
	}

	static latestUpdatedNote(notes) {
		return _.max(notes, function(n) {
			return n.updatedAt
		})
	}

	static beforeNote(notes, note, property) {
		var sorted = arr.sortBy(notes, property)
		var before = sorted[sorted.indexOf(note)+1]
		if (!before) {
			// the note was latest one;
			return sorted.slice(-2)[0]
		}
		return before
	}

	static newEmptyNote(folder) {
		if (folder) {
			return new Note({
				name  : 'NewNote',
				body  : '',
				path  : '',
				folder: folder
			})
		}
		return false
	}
}

class EncryptedNote extends Note {
	constructor(data) {
		super(data)
		this._ext = '.mdencrypted'
		this._encrypted = true
		this._secretkey = null
		this._descrypted_title = ''
	}

	get isEncrypted() {
		return this._encrypted
	}

	get isEncryptedNote() {
		return true
	}

	get title() {
		return this._descrypted_title || this._name
	}

	get verifyString() {
		return 'sQhjzdTyiedGjqoCSbtft25da6W2zTpN22dH3wvKSzwxZNTfVV'
	}

	decrypt(secretkey) {
		if (!secretkey && !this._secretkey) return { error: 'Secret Key missing' }

		if (this._encrypted) {
			if (secretkey) this._secretkey = secretkey
			if (this._body && this._body.length > 0) {
				var descryptedBody = encrypt.decrypt(this._body, this._secretkey, 256)
				if (descryptedBody.indexOf(this.verifyString) === 0) {
					descryptedBody = descryptedBody.replace(this.verifyString, '')
					this._body = descryptedBody
					this._descrypted_title = this.splitTitleFromBody().title
				} else {
					this._secretkey = null
					return { error: 'Secret Key was not correct' }
				}
			}
			this._encrypted = false
			return true
		}

		return { error: 'Note was not encrypted' }
	}

	encrypt(secretkey) {
		if (this._encrypted) {
			return this._body
		} else if (this._body && this._body.length > 0) {
			this._descrypted_title = this.splitTitleFromBody().title
			if (secretkey) this._secretkey = secretkey
			var encryptBody = encrypt.encrypt(this.verifyString+this._body, this._secretkey, 256)
			return encryptBody
		}
		return ''
	}

	static newEmptyNote(folder) {
		if (folder) {
			return new EncryptedNote({
				name  : 'NewNote',
				body  : '',
				path  : '',
				folder: folder
			})
		}
		return false
	}
}

class Outline extends Note {
	constructor(data) {
		super(data)
		this._ext = '.opml'
		this._nodes = data.nodes ? data.nodes : []
		this._snapshots = []

		if (this._loadedBody) {
			this.parseOutlineBody()
		}
	}

	get title() {
		return this._name
	}

	set title(value) {
		this._name = value
	}

	get metadata() {
		return this._metadata
	}

	set metadata(newValue) {
		this._metadata = newValue
	}

	set nodes(newValue) {
		this._nodes = newValue
	}

	get nodes() {
		return this._nodes
	}

	get isOutline() {
		return true
	}

	get bodyWithoutMetadata() {
		var bodyString = ''

		// only preview first level of the outline if length is greater than 1
		for (var i = 0; i < this._nodes.length; i++) {
			bodyString += '- ' + this._nodes[i].title + '\n' + this._nodes[i].prettifyBody(1)
			if (i < this._nodes.length - 1) bodyString += '\n'
		}
		return bodyString.trim()
	}

	get bodyWithMetadata() {
		return this._body
	}

	downloadImages() {}

	splitTitleFromBody() {
		return {
			title: this._name,
			meta : this._metadata,
			body : this.bodyWithoutMetadata
		}
	}

	get properties() {
		var nodesNumber = 0
		for (var i=0; i<this._nodes.length; i++) {
			nodesNumber += this._nodes[i].countNodes()
		}
		return {
			nodeCount: nodesNumber
		}
	}

	parseOutlineBody() {
		opml.parseFile(this._body, this)
	}

	compileOutlineBody() {
		return opml.stringify(this._name, this._metadata, this._nodes)
	}

	saveData() {
		if (this._removed) return null

		var body = this.compileOutlineBody()

		var activeNodes = this._nodes.filter(function(obj) {
			return obj.title && obj.title !== ''
		})

		var outerFolder
		if (this.rack && this.folder) {
			outerFolder = path.join(Library.baseLibraryPath, this.rack.data.fsName, this.folder.data.fsName)
		} else {
			outerFolder = path.dirname(this._path)
		}

		if (this.documentFilename) {
			var newPath = path.join(outerFolder, this.documentFilename) + this._ext

			if (activeNodes.length === 0) {
				return {
					'path'     : newPath,
					'oldpath'  : this._path,
					'extension': this._ext,
					'filename' : this.documentFilename,
					'folder'   : outerFolder,
					'body'     : ''
				}
			}

			return {
				'path'     : newPath,
				'oldpath'  : this._path,
				'extension': this._ext,
				'filename' : this.documentFilename,
				'folder'   : outerFolder,
				'body'     : body
			}
		}

		return null
	}

	saveModel() {
		const saveData = this.saveData()
		if (saveData === null) return
		let { body, path: newPath, folder: outerFolder, filename: documentFilename } = saveData
		try {
			if (newPath !== this._path) {
				var num = 1
				while (num > 0) {
					if (fs.existsSync(newPath)) {
						if (body && body !== fs.readFileSync(newPath).toString()) {
							newPath = path.join(outerFolder, documentFilename) + num + this._ext
						} else {
							newPath = null
							break
						}
						num++
					} else {
						break
					}
				}

				if (newPath) {
					fs.writeFileSync(newPath, body)
					this.path = newPath
					if (this._body) this._snapshots.push(this._body)
					this._body = body
					return { saved: true }
				}
				return { saved: false }
			}

			if (!fs.existsSync(newPath) || (body.length > 0 && body !== fs.readFileSync(newPath).toString())) {
				fs.writeFileSync(newPath, body)
				this.path = newPath
				if (this._body) this._snapshots.push(this._body)
				this._body = body
				return { saved: true }
			}
			return { saved: false }
		} catch (e) {
			elosenv.console.warn('Couldn\'t save the note. Permission Error')
			return {
				error: 'Permission Error',
				path : newPath
			}
		}
	}

	newEmptyNode(previusNode, mod) {
		var n = new OutNode({
			outline: this,
			title  : '',
			content: ''
		})
		if (!mod) mod = 0
		if (previusNode && typeof previusNode === 'boolean') {
			this._nodes.splice(0, 0, n)
		} else if (previusNode) {
			var i = this._nodes.indexOf(previusNode)
			this._nodes.splice(i+1+mod, 0, n)
		} else {
			this._nodes.push(n)
		}
		return n
	}

	addChild(child, previus) {
		if (previus) {
			var i = this._nodes.indexOf(previus)
			this._nodes.splice(i+1, 0, child)
		} else {
			this._nodes.push(child)
		}
		child.parentNode.removeNode(child)
		child.parent = undefined
	}

	removeNode(node) {
		var i = this._nodes.indexOf(node)
		this._nodes.splice(i, 1)
		if (i > 0) return this._nodes[i-1]
	}

	newNode(node) {
		if (node instanceof OutNode) {
			this._nodes.push(node)
		}
	}

	generateNewNode(title, content, children) {
		var newNode = new OutNode({
			outline : this,
			title   : title,
			content : content,
			children: children
		})
		if (children && children.length > 0) newNode.updateChildrens()
		return newNode
	}

	static newEmptyOutline(folder) {
		if (folder) {
			var out = new Outline({
				name  : 'NewOutline',
				body  : '',
				path  : '',
				folder: folder
			})
			out.newEmptyNode()
			return out
		}
		return false
	}
}

class OutNode extends Model {
	constructor(data) {
		super(data)
		this._outline = data.outline
		this._parent_node = data.parent
		this._title = data.title
		this._content = data.content
		this._children = data.children ? data.children : []
	}

	get title() {
		return this._title
	}

	set title(newValue) {
		this._title = newValue
	}

	get content() {
		return this._content
	}

	set content(newValue) {
		this._content = newValue
	}

	get children() {
		return this._children
	}

	getChildAt(num) {
		return this._children[num]
	}

	updateChildrens() {
		for (var i=0; i<this._children.length; i++) {
			this._children[i].parent = this
		}
	}

	set parent(newValue) {
		this._parent_node = newValue
	}

	get parent() {
		return this._parent_node
	}

	get parentNode() {
		return this._parent_node || this._outline
	}

	get outline() {
		return this._outline
	}

	prettifyBody(nestLevel) {
		var bodyString = ''

		// only preview first level of the outline if length is greater than 1
		for (var i = 0; i < this._children.length; i++) {
			bodyString += Array(nestLevel+1).join('\t') + '- ' + this._children[i].title
			if (this._children[i].content) {
				bodyString += '\n' + Array(nestLevel+1).join('\t') + '  '
				bodyString += this._children[i].content.replace(/\n/g, '\n'+Array(nestLevel+1).join('\t')+ '  ')
			}
			var nestedString = this._children[i].prettifyBody(nestLevel+1)
			if (nestedString) bodyString += '\n' + nestedString
			if (i < this._children.length - 1) bodyString += '\n'
		}
		return bodyString.replace(/[\s\r\n]+$/, '')
	}

	countNodes() {
		var nodesNumber = 1
		for (var i=0; i<this._children.length; i++) {
			nodesNumber += this.getChildAt(i).countNodes()
		}
		return nodesNumber
	}

	newEmptyNode(previusNode, mod) {
		var n = new OutNode({
			outline: this._outline,
			parent : this,
			title  : '',
			content: ''
		})
		if (!mod) mod = 0
		if (previusNode && typeof previusNode === 'boolean') {
			this._children.splice(0, 0, n)
		} else if (previusNode) {
			var i = this._children.indexOf(previusNode)
			this._children.splice(i+1+mod, 0, n)
		} else {
			this._children.push(n)
		}
		return n
	}

	addChild(child, previus) {
		if (previus) {
			var i = this._children.indexOf(previus)
			this._children.splice(i+1, 0, child)
		} else {
			this._children.push(child)
		}
		child.parentNode.removeNode(child)
		child.parent = this
	}

	removeNode(node) {
		var i = this._children.indexOf(node)
		this._children.splice(i, 1)
		if (i > 0) return this._children[i-1]
		return this
	}

	static newEmptyNode(outline, parent) {
		if (outline) {
			return new OutNode({
				outline: outline,
				parent : parent,
				title  : '',
				content: '',
				icon   : ''
			})
		}
		return false
	}
}

import ImageBldr from './image'

export default function(library) {
	Library = library
	Image = ImageBldr(library)
	return {
		Note         : Note,
		EncryptedNote: EncryptedNote,
		Outline      : Outline,
		OutNode      : OutNode
	}
}
