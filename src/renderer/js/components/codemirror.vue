<template lang="pug">
	.codemirror-div
</template>

<script>
import path from 'path'
import _ from 'lodash'

import { Image } from '../models'
import elosenv from '../utils/elosenv'

import electron from 'electron'
const { remote, shell, clipboard } = electron
const { Menu, MenuItem } = remote

import { copyText, cutText, pasteText, selectAllText } from '../codemirror/elutils'

const IMAGE_TAG_TEMP = _.template('![<%- filename %>](<%- fileurl %>)\n')

import CodeMirror from 'codemirror'

require('codemirror/addon/search/searchcursor')
require('codemirror/addon/search/matchesonscrollbar')
require('../codemirror/piledsearch')
require('codemirror/addon/edit/closebrackets')
require('codemirror/addon/mode/overlay')
require('../codemirror/placeholder')
require('codemirror/mode/xml/xml')
require('codemirror/mode/markdown/markdown')
require('codemirror/mode/gfm/gfm')
require('codemirror/mode/rst/rst')
require('../codemirror/epiphanyMode')
require('codemirror/mode/python/python')
require('codemirror/mode/javascript/javascript')
require('codemirror/mode/coffeescript/coffeescript')
require('codemirror/mode/pug/pug')
require('codemirror/mode/css/css')
require('codemirror/mode/htmlmixed/htmlmixed')
require('codemirror/mode/clike/clike')
require('codemirror/mode/http/http')
require('codemirror/mode/ruby/ruby')
require('codemirror/mode/lua/lua')
require('codemirror/mode/go/go')
require('codemirror/mode/php/php')
require('codemirror/mode/perl/perl')
require('codemirror/mode/swift/swift')
require('codemirror/mode/go/go')
require('codemirror/mode/sql/sql')
require('codemirror/mode/yaml/yaml')
require('codemirror/mode/shell/shell')
require('codemirror/mode/commonlisp/commonlisp')
require('codemirror/mode/clojure/clojure')
require('codemirror/mode/meta')
require('../codemirror/piledmap')

function countWords(text) {
	text = text.replace(/\[[\w\s]+?\]/g, ' ').replace(/[^\w\-’'"_]/g, ' ').replace(/[\s\r\n]+/g, ' ').replace(/\s\W\s/g, ' ')
	const words = text.split(' ').filter((str) => {
		return str.length > 0
	})
	return words.length
}

function countLineBreaks(text) {
	const lines = text.split('\n')
	return lines.length
}

export default {
	name: 'codemirror',
	data() {
		return {
			cm        : null,
			imageRegex: /!\[(.*)\]\((.+\.(jpg|jpeg|png|gif|svg))(\s("|')(.*)("|')\s?)?\)/gi,
			widgets   : []
		}
	},
	mounted() {
		this.newCodemirrorInstance()
		window.bus.$on('codemirror-undo', this.commandUndo)
		window.bus.$on('codemirror-redo', this.commandRedo)
		window.bus.$on('codemirror-cut', this.commandCut)
		window.bus.$on('codemirror-copy', this.commandCopy)
		window.bus.$on('codemirror-paste', this.commandPaste)
		window.bus.$on('codemirror-find', this.commandFind)
		window.bus.$on('codemirror-bold', this.commandBold)
		window.bus.$on('codemirror-italic', this.commandItalic)
		window.bus.$on('codemirror-strike', this.commandStrike)
	},
	beforeDestroy() {
		window.bus.$off('codemirror-undo', this.commandUndo)
		window.bus.$off('codemirror-redo', this.commandRedo)
		window.bus.$off('codemirror-cut', this.commandCut)
		window.bus.$off('codemirror-copy', this.commandCopy)
		window.bus.$off('codemirror-paste', this.commandPaste)
		window.bus.$off('codemirror-find', this.commandFind)
		window.bus.$off('codemirror-bold', this.commandBold)
		window.bus.$off('codemirror-italic', this.commandItalic)
		window.bus.$off('codemirror-strike', this.commandStrike)
	},
	computed: {
		note() {
			return this.$store.state.library.selectedNote
		},
		search: {
			get() {
				return this.$store.state.editor.search
			}
		},
		isPreview: {
			get() {
				return this.$store.state.options.isPreview
			}
		},
		isFullScreen: {
			get() {
				return this.$store.state.options.isFullScreen
			}
		},
		useMonospace: {
			get() {
				return this.$store.state.options.useMonospace
			}
		}
	},
	methods: {
		newCodemirrorInstance() {
			this.$store.commit('editor/resetEditor')
			this.$store.commit('editor/resetSearch')

			let extraKeys
			if (elosenv.isDarwin()) {
				extraKeys = {
					'Cmd-B'      : () => { this.commandBold() },
					'Cmd-I'      : () => { this.commandItalic() },
					'Cmd-V'      : () => { pasteText(cm, this.note) },
					'Shift-Cmd-V': () => { window.bus.$emit('toggle-preview') },
					'Alt-P'      : () => { window.bus.$emit('toggle-preview') },
					'Alt-V'      : () => { window.bus.$emit('toggle-preview') },
					'Shift-Cmd-A': () => { this.uploadFile() }
				}
			} else {
				extraKeys = {
					'Ctrl-B'      : () => { this.commandBold() },
					'Ctrl-I'      : () => { this.commandItalic() },
					'Ctrl-V'      : () => { pasteText(cm, this.note) },
					'Shift-Ctrl-V': () => { window.bus.$emit('toggle-preview') },
					'Alt-P'       : () => { window.bus.$emit('toggle-preview') },
					'Alt-V'       : () => { window.bus.$emit('toggle-preview') },
					'Shift-Ctrl-A': () => { this.uploadFile() }
				}
			}

			var cm = CodeMirror(this.$el, {
				mode              : 'epiphanymode',
				lineNumbers       : false,
				lineWrapping      : true,
				theme             : 'default',
				keyMap            : 'piledmap',
				extraKeys         : extraKeys,
				indentUnit        : 4,
				smartIndent       : true,
				tabSize           : 4,
				indentWithTabs    : true,
				cursorBlinkRate   : 540,
				addModeClass      : true,
				autoCloseBrackets : true,
				scrollbarStyle    : 'native',
				cursorScrollMargin: 10,
				placeholder       : '',
				value             : this.note ? new CodeMirror.Doc(this.note.body, 'epiphanymode') : undefined
			})
			this.cm = cm
			this.$root.codeMirror = cm

			cm.on('change', this.updateNoteBody)
			cm.on('blur', this.updateNoteBeforeSaving)

			cm.on('drop', (cm, event) => {
				if (event.dataTransfer.files.length > 0) {
					var p = cm.coordsChar({ top: event.y, left: event.x })
					cm.setCursor(p)
					this.uploadFiles(cm, event.dataTransfer.files)
				} else {
					return true
				}
			})

			var isLinkState = (type) => {
				if (!type) {
					return false
				}
				var types = type.split(' ')
				return (_.includes(types, 'link') ||
						_.includes(types, 'epy-link-href') ||
						_.includes(types, 'link')) && !_.includes(types, 'epy-formatting')
			}
			cm.on('contextmenu', (cm, event) => {
				// Makidng timeout Cause codemirror's contextmenu handler using setTimeout on 50ms or so.
				setTimeout(() => {
					var menu = new Menu()

					menu.append(new MenuItem({
						label      : 'Cut',
						accelerator: 'CmdOrCtrl+X',
						click      : () => { cutText(cm) }
					}))

					menu.append(new MenuItem({
						label      : 'Copy',
						accelerator: 'CmdOrCtrl+C',
						click      : () => { copyText(cm) }
					}))

					menu.append(new MenuItem({
						label      : 'Paste',
						accelerator: 'CmdOrCtrl+V',
						click      : () => { pasteText(cm, this.note) }
					}))

					menu.append(new MenuItem({ type: 'separator' }))
					menu.append(new MenuItem({
						label      : 'Select All',
						accelerator: 'CmdOrCtrl+A',
						click      : () => { selectAllText(cm) }
					}))

					menu.append(new MenuItem({ type: 'separator' }))
					menu.append(new MenuItem({
						label      : 'Insert Image',
						accelerator: 'Shift+CmdOrCtrl+A',
						click      : () => { this.uploadFile() }
					}))

					var c = cm.getCursor()
					var token = cm.getTokenAt(c, true)
					if (isLinkState(token.type)) {
						var s = cm.getRange({ line: c.line, ch: token.start < 2 ? token.start : token.start-2 }, { line: c.line, ch: token.state.overlayPos || token.end })
						s = s.replace(/^\W+/, '')
						s = s.replace(/^s:\/\//, 'https://')
						s = s.replace(/^p:\/\//, 'http://')
						s = s.replace(/\)$/, '')

						menu.append(new MenuItem({ type: 'separator' }))
						menu.append(new MenuItem({
							label: 'Copy Link',
							click: () => { clipboard.writeText(s) }
						}))
						menu.append(new MenuItem({
							label: 'Open Link In Browser',
							click: () => {
								shell.openExternal(s)
							}
						}))
					}
					menu.append(new MenuItem({ type: 'separator' }))
					menu.append(new MenuItem({
						label      : 'Toggle Preview',
						accelerator: 'Alt+P',
						click      : () => { window.bus.$emit('toggle-preview') }
					}))
					menu.popup()
				}, 90)
			})
			cm.on('cursorActivity', (cm, event) => {
				var sel = cm.getSelection()
				var c = cm.getCursor()
				this.$store.commit('editor/cursorPositon', { row: c.line, column: c.ch })
				this.$store.commit('editor/cursorSelection', sel)
				if (sel.length === 0) {
					this.$store.commit('editor/editorWordsCount', countWords(cm.getValue()))
					this.$store.commit('editor/editorLineBreaks', 0)
				} else {
					this.$store.commit('editor/editorWordsCount', countWords(sel))
					this.$store.commit('editor/editorLineBreaks', countLineBreaks(sel))
				}
			})

			cm.on('swapDoc', (cm, oldDoc) => {
				this.$store.commit('editor/editorWordsCount', countWords(cm.getValue()))
			})

			cm.on('renderLine', (cm, line, elem) => {
				let found = false
				for (let i = 0; i < this.widgets.length; ++i) {
					const widget = this.widgets[i]
					if (widget.line === line) {
						found = true
						this.validateInlinePreview(i, line.text)
						break
					}
				}
				if (!found) {
					this.imageRegex.lastIndex = 0
					this.$nextTick(() => {
						this.addInlinePreview(line.text, this.cm.getLineNumber(line))
					})
				}
			})

			if (this.useMonospace) {
				this.$el.classList.add('codemirror-monospace')
			}

			this.initFooter()
			this.runSearch()
			this.$nextTick(() => {
				this.initInlinePreview()
			})
		},
		commandUndo() {
			this.cm.execCommand('undo')
		},
		commandRedo() {
			this.cm.execCommand('redo')
		},
		commandCut() {
			cutText(this.cm)
		},
		commandCopy() {
			copyText(this.cm)
		},
		commandPaste() {
			pasteText(this.cm, this.note)
		},
		commandFind() {
			this.cm.execCommand('findPersistent')
		},
		commandBold() {
			if (!this.cm) return
			let cursor = this.cm.getCursor()
			const selection = this.cm.getSelection()
			if (selection.length > 0) {
				this.cm.replaceSelection('**' + selection + '**')
				cursor = this.cm.getCursor()
				this.cm.doc.setCursor({
					line: cursor.line,
					ch  : cursor.ch-2
				})
			} else {
				if (cursor.ch === 0) {
					if (this.cm.doc.getLine(cursor.line).length > 0) {
						this.cm.doc.replaceRange('**', cursor)
					} else {
						this.cm.doc.replaceRange('****', cursor)
					}
				} else {
					this.cm.doc.replaceRange('**', cursor)
				}

				this.cm.doc.setCursor({
					line: cursor.line,
					ch  : cursor.ch+2
				})
			}
			this.cm.focus()
		},
		commandItalic() {
			if (!this.cm) return
			let cursor = this.cm.getCursor()
			const selection = this.cm.getSelection()
			if (selection.length > 0) {
				this.cm.replaceSelection('*' + selection + '*')
				cursor = this.cm.getCursor()
				this.cm.doc.setCursor({
					line: cursor.line,
					ch  : cursor.ch-1
				})
			} else {
				if (cursor.ch === 0) {
					if (this.cm.doc.getLine(cursor.line).length > 0) {
						this.cm.doc.replaceRange('*', cursor)
					} else {
						this.cm.doc.replaceRange('**', cursor)
					}
				} else {
					this.cm.doc.replaceRange('*', cursor)
				}

				this.cm.doc.setCursor({
					line: cursor.line,
					ch  : cursor.ch+1
				})
			}
			this.cm.focus()
		},
		commandStrike() {
			if (!this.cm) return
			let cursor = this.cm.getCursor()
			const selection = this.cm.getSelection()
			if (selection.length > 0) {
				this.cm.replaceSelection('~~' + selection + '~~')
				cursor = this.cm.getCursor()
				this.cm.doc.setCursor({
					line: cursor.line,
					ch  : cursor.ch-2
				})
			} else {
				if (cursor.ch === 0) {
					if (this.cm.doc.getLine(cursor.line).length > 0) {
						this.cm.doc.replaceRange('~~', cursor)
					} else {
						this.cm.doc.replaceRange('~~~~', cursor)
					}
				} else {
					this.cm.doc.replaceRange('~~', cursor)
				}

				this.cm.doc.setCursor({
					line: cursor.line,
					ch  : cursor.ch+2
				})
			}
			this.cm.focus()
		},
		initFooter() {
			this.$store.commit('editor/resetEditor')
			this.$store.commit('editor/resetSearch')
			this.$store.commit('editor/editorWordsCount', countWords(this.cm.getValue()))

			this.cm.execCommand('closePersistent')
		},
		inlinePreviewCleanUrl(match) {
			return 'epiphany://' + path.join(this.note.imagePath, match[2].replace(/^epiphany:\/\//i, ''))
		},
		validateInlinePreview(index, text) {
			this.imageRegex.lastIndex = 0
			const match = this.imageRegex.exec(text)
			if (match === null) {
				this.$nextTick(() => {
					this.cm.removeLineWidget(this.widgets[index])
					this.widgets.splice(index, 1)
				})
			} else {
				try {
					const img = this.widgets[index].node.children[0]
					img.src = this.inlinePreviewCleanUrl(match)
				} catch (e) {
					console.error(e)
				}
			}
		},
		addInlinePreview(line, index) {
			let match
			while ((match = this.imageRegex.exec(line)) !== null) {
				const url = match[2]
				if (url.startsWith('epiphany://')) {
					const msg = document.createElement('div')
					const img = msg.appendChild(document.createElement('img'))
					msg.classList.add('image-widget')
					img.src = this.inlinePreviewCleanUrl(match)
					img.draggable = false
					img.addEventListener('click', () => {
						this.$root.openImg(img.src)
					})
					//msg.onclick = 'appVue.openImg(\''+img.src+'\'); return false;'
					this.widgets.push(this.cm.addLineWidget(index, msg, { coverGutter: false, noHScroll: false }))
				}
			}
		},
		removeInlinePreview() {
			for (let i = 0; i < this.widgets.length; ++i) {
				this.cm.removeLineWidget(this.widgets[i])
			}
			this.widgets.length = 0
		},
		initInlinePreview() {
			this.removeInlinePreview()
			const lines = this.cm.getValue().split('\n')
			lines.forEach((line, index) => {
				this.addInlinePreview(line, index)
			})
		},
		uploadFile() {
			remote.dialog.showOpenDialog({
				title  : 'Attach Image',
				filters: [{
					name      : 'Markdown',
					extensions: [
						'png', 'jpeg', 'jpg', 'bmp',
						'gif', 'tif', 'ico'
					]
				}],
				properties: ['openFile', 'multiSelections']
			})
				.then(result => {
					if (result.canceled || !result.filePaths) {
						return
					}

					const files = result.filePaths.map((notePath) => {
						var name = path.basename(notePath)
						return { name: name, path: notePath }
					})
					this.uploadFiles(this.cm, files)
				})
				.catch(err => {
					console.error(err)
				})
		},
		uploadFiles(cm, files) {
			files = Array.prototype.slice.call(files, 0, 5)
			_.forEach(files, (f) => {
				try {
					var image = Image.fromBinary(f.name, f.path, this.note)
				} catch (e) {
					this.$message('error', 'Failed to load and save image', 5000)
					console.error(e)
					return
				}
				cm.doc.replaceRange(
					IMAGE_TAG_TEMP({ filename: f.name, fileurl: image.localURL }),
					cm.doc.getCursor()
				)
				this.$message('info', 'Image saved')
			})
		},
		updateNoteBody: _.debounce(function () {
			if (this.note) {
				this.note.body = this.cm.getValue()
			}
		}, 1000, {
			leading : true,
			trailing: true,
			maxWait : 5000
		}
		),
		updateNoteBeforeSaving() {
			this.note.body = this.cm.getValue()
		},
		runSearch() {
			if (this.note && this.search && this.search.length > 1) {
				this.$nextTick(() => {
					CodeMirror.commands.setSearch(this.cm, this.search.toLowerCase())
				})
			} else {
				CodeMirror.commands.undoSearch(this.cm)
			}
		},
		refreshCM() {
			this.cm.refresh()
		},
		refreshNoteBody() {
			var doc
			if (this.note.body) {
				doc = new CodeMirror.Doc(this.note.body, 'epiphanymode')
			}
			this.note.doc = doc
			if (doc) {
				if (doc.cm) doc.cm = null
				this.cm.swapDoc(doc)
			}
		}
	},
	watch: {
		isFullScreen() {
			if (this.cm) {
				this.$nextTick(() => {
					setTimeout(() => {
						this.refreshCM()
						this.cm.focus()
					}, 300)
				})
			}
		},
		isPreview() {
			if (!this.isPreview) {
				this.$nextTick(() => {
					this.refreshCM()
					this.cm.focus()
				})
			}
		},
		note(value) {
			if (!value || !value.title || !this.cm) return

			this.cm.scrollTo(0, 0)
			this.cm.getDoc().setValue(value.body)
			this.cm.getDoc().clearHistory()
			this.initFooter()
			this.runSearch()
		},
		search() {
			this.runSearch()
		},
		useMonospace() {
			if (this.useMonospace) {
				this.$el.classList.add('codemirror-monospace')
			} else {
				this.$el.classList.remove('codemirror-monospace')
			}
		}
	}
}
</script>
