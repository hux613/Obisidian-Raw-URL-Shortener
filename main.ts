import { App, Editor, EditorPosition, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Notice, Plugin, requestUrl } from 'obsidian';

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
}

export default class URLshortener extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		// Configure resources needed by the plugin.
		// runs whenever the user starts using the plugin in Obsidian. 
		// This is where you'll configure most of the plugin's capabilities.
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, view) => {
				const link = this.getLinkAtPosition(editor);
				if (link) {
					menu.addItem((item) =>
						item
						.setTitle('Shorten URL')
						.setIcon('send') 
						.onClick(() => {
							this.callApi(link)
							.then((shortenedUrl) => {
								new Notice('Shortened URL');
								if (shortenedUrl) {
									this.replaceUrlInEditor(shortenedUrl.trim());
								}
							})
						})
					)
				}
			})
		);
	
		// This adds a settings tab so the user can configure various aspects of the plugin
		// this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	private getLinkAtPosition(editor: Editor): string | null {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const token = editor.getClickableTokenAt(cursor);

		// If Obsidian detects a clickable link token
		if (token && token.type?.includes('url') ) {
			return token.linktext || token.text || null;
		}

		// Fallback: simple regex check around cursor (less reliable)
		const linkRegex = /(https?:\/\/[^\s\)]+|\[\[([^\|\]]+)(?:\|[^\]]+)?\]\])/g;
		let match;
		while ((match = linkRegex.exec(line)) !== null) {
			if (cursor.ch >= match.index && cursor.ch <= match.index + match[0].length) {
				if (match[0].startsWith('http')) return match[0];
			}
		}

		return null;
	}

	private async callApi(url: string) : Promise<string | null> {
		try {
			// Ensure it starts with http/https
			if (!url.startsWith('http')) {
				url = 'https://' + longUrl;
			}

			const encodedUrl = encodeURIComponent(url);
			const apiUrl = `https://is.gd/create.php?format=simple&url=${encodedUrl}`;
			const response = await requestUrl(apiUrl);
			const textToInsert = response.text.trim();
		
			if (textToInsert.startsWith('Error:')) {
				throw new Error(text);
			}
			return textToInsert;

		} catch (error) {
			console.error('Failed to shorten URL:', error);
			new Notice('URL shortening failed: ' + (error.message || error));
			return null;
		}
	}
	private replaceUrlInEditor(textToInsert: string) {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = activeView.editor;
		const cursor = editor.getCursor();
		const linkRange = this.getLinkRangeAtPosition(editor, cursor);
		if (linkRange) {
			// Precise replacement of the markdown link
			editor.replaceRange(textToInsert, linkRange.from, linkRange.to);
		} else {
			// Fallback: just replace at cursor (e.g., in Reading mode or if detection failed)
			editor.replaceRange(textToInsert, cursor);
		}

		const newCursorPos: CodeMirror.Position = {
    		line: linkRange.from.line, 
   			ch: textToInsert.length 
  		};		
		editor.setCursor(newCursorPos)
		editor.focus();
	}
	private getLinkRangeAtPosition(
		editor: CodeMirror.Editor,
		pos: CodeMirror.Position
	): { from: CodeMirror.Position; to: CodeMirror.Position } | null {
		const line = editor.getLine(pos.line);

		// Try clickable token first (most accurate)
		// @ts-ignore – getClickableTokenAt is undocumented but stable
		const token = (editor as any).getClickableTokenAt?.(pos);
		if (token && (token.type?.includes('url') || token.type?.includes('link'))) {
			// Find the full markdown syntax around it
			const linkRegex = /(\[([^\]]*)\]\(([^)]+)\)|(https?:\/\/[^\s\)]+)|\[\[([^\|\]]+)(?:\|([^\]]+))?\]\])/;
			const offset = editor.posToOffset(pos);
			const lineStartOffset = offset - pos.ch;

			let match;
			const fullRegex = new RegExp(linkRegex.source, 'g');
			while ((match = fullRegex.exec(line)) !== null) {
			const matchStart = lineStartOffset + match.index;
			const matchEnd = matchStart + match[0].length;

			if (offset >= matchStart && offset <= matchEnd) {
				const from = editor.offsetToPos(matchStart);
				const to = editor.offsetToPos(matchEnd);
				return { from, to };
			}
			}
		}
	}
	
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

