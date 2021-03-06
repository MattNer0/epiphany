import Vue from 'vue'
import VTooltip from 'v-tooltip'
import { ipcRenderer, remote } from 'electron'
import theme from './js/utils/theme'

// vue.js plugins
import componentTitleBar from './js/components/titleBar.vue'
import componentInputText from './js/components/popupInputText.vue'
import componentAbout from './js/components/popupAbout.vue'

Vue.use(VTooltip)

// not to accept image dropping and so on.
// electron will show local images without this.
document.addEventListener('dragover', (e) => {
	e.preventDefault()
})
document.addEventListener('drop', (e) => {
	e.preventDefault()
	e.stopPropagation()
})

// eslint-disable-next-line no-unused-vars
const vueApp = new Vue({
	el      : '#app',
	template: require('./html/popup.html'),
	data    : {
		currentTheme    : '',
		type            : '',
		title           : '',
		message         : '',
		libraryPath     : '',
		menuBar         : false,
		inputPlaceholder: '',
		inputDefault    : '',
		inputRequired   : true,
		inputButtons    : [],
		reduceToTray    : true,
		alphanumericOnly: false,
		closingCallback : null
	},
	components: {
		'titleBar' : componentTitleBar,
		'inputText': componentInputText,
		'about'    : componentAbout
	},
	computed: { },
	created() { },
	mounted() {
		ipcRenderer.on('open-popup', (event, data) => {
			if (!data) {
				this.closeWindow()
			}

			this.currentTheme = data.theme
			this.type = data.type
			this.title = data.title
			this.message = data.message ? data.message : ''
			this.closingCallback = null

			this.libraryPath = data.library ? data.library : ''

			switch (data.type) {
				case 'input-text':
					switch (data.form) {
						case 'note-url':
							this.inputRequired = true
							this.inputPlaceholder = 'https://...'
							this.inputDefault = ''
							this.inputButtons = [{
								label: 'Cancel',
								type : 'close'
							}, {
								label: 'Ok',
								type : 'submit',
								validate(data) {
									var expression = /[-a-zA-Z0-9@:%_+.~#?&=]{2,256}(\.[a-z]{2,4}|:\d+)\b(\/[-a-zA-Z0-9@:%_+.~#?&/=]*)?/gi
									var regex = new RegExp(expression)
									if (data.input_data.match(regex)) {
										return false
									}
									return 'input_data'
								},
								callback(data) {
									ipcRenderer.send('load-page', {
										url           : data.input_data,
										mode          : 'note-from-url',
										webpreferences: 'images=no',
										style         : { height: '10000px' }
									})
								}
							}]
							break
						case 'bucket-name':
							this.inputRequired = true
							this.inputPlaceholder = 'Bucket Name'
							this.inputDefault = data.bucket
							this.alphanumericOnly = true

							this.closingCallback = () => {
								ipcRenderer.send('bucket-rename', {
									name      : null,
									bucket_uid: data.bucket_uid
								})
							}

							this.inputButtons = [{
								label: 'Cancel',
								type : 'close'
							}, {
								label   : 'Ok',
								type    : 'submit',
								validate: (form) => {
									if (form.input_data.length > 0 && form.input_data.length < 128 && /^[\w\s]+$/.test(form.input_data)) {
										return false
									}
									return 'input_data'
								},
								callback: (form) => {
									ipcRenderer.send('bucket-rename', {
										name      : form.input_data,
										bucket_uid: data.bucket_uid
									})
								}
							}]
							break
						default:
							this.closeWindow()
					}
					break
			}
		})
	},
	methods: {
		closingWindow(quit) {
			if (quit) {
				remote.app.quit()
			} else {
				if (this.closingCallback && typeof this.closingCallback === 'function') {
					this.closingCallback()
				}
				this.closeWindow()
			}
		},
		inputSubmit() {
			this.closeWindow()
		},
		closeWindow() {
			var win = remote.getCurrentWindow()
			win.close()
		}
	},
	watch: {
		currentTheme() {
			if (this.currentTheme) theme.load(this.currentTheme)
		}
	}
})
