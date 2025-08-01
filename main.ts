import { App, ItemView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";

interface PluginSettings {
    animationDuration: number,
    showHeader: boolean,
    showScroll: boolean,
    showGraphControls: boolean,
    autoZenMode: boolean, 
    forceReadable: boolean,
    vignetteOpacity: number,
    vignetteScaleLinear: number,
    vignetteScaleRadial: number
}

const DEFAULT_SETTINGS: PluginSettings = {
    animationDuration: 2,
    showHeader: false,
    showScroll: false,
    showGraphControls: false,
    autoZenMode: false, 
    forceReadable: true, 
    vignetteOpacity: 0.75,
    vignetteScaleLinear: 20,
    vignetteScaleRadial: 75
}

export default class Prozen extends Plugin {
    settings: PluginSettings;
    private isInZenMode: boolean = false; 

    async onload() {
        await this.loadSettings();
        this.addCommand({
            id: "zenmode",
            name: "Zen mode",
            callback: this.fullscreenMode.bind(this),
        });
        this.addSettingTab(new ProzenSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on("editor-change", this.handleEditorChange.bind(this))
        );
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private handleEditorChange() {
        if (!this.settings.autoZenMode || this.isInZenMode) return;
        
        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf || activeLeaf.view.getViewType() === "empty") return;
        
        const editor = (this.app.workspace as any).activeEditor?.editor;
        if (editor && editor.getValue().trim().length > 0) {
            this.fullscreenMode();
            this.isInZenMode = true;
        }
    }

    fullscreenMode() {
		// Use ItemView for multiple view types (previously it was only MarkdownView)
		const leaf = this.app.workspace.getActiveViewOfType(ItemView)?.leaf;
        if (!leaf) return;
		// Don't trigger fullscreen mode when current leaf is empty.
		if (leaf.view.getViewType() === "empty") return;

        const root = document.documentElement
        root.style.setProperty('--fadeIn-duration', this.settings.animationDuration + 's')
        root.style.setProperty('--vignette-opacity', this.settings.vignetteOpacity + '%')
		root.style.setProperty('--vignette-scale-linear', this.settings.vignetteScaleLinear + '%')
        root.style.setProperty('--vignette-scale-radial', this.settings.vignetteScaleRadial + '%')
        
        const containerEl = (leaf as any).containerEl;

        if (!document.fullscreenElement) {
            containerEl.requestFullscreen();
            this.addStyles(leaf);
            this.isInZenMode = true;
        } else {
            document.exitFullscreen();
            this.removeStyles(leaf);
            this.isInZenMode = false;
        }
        
        containerEl.onfullscreenchange = () => {
            if (!document.fullscreenElement) {
                this.removeStyles(leaf);
                this.isInZenMode = false;
            }
        }
    }

    addStyles(leaf: WorkspaceLeaf) {
        const viewEl = (leaf.view as any).contentEl
        const header = (leaf.view as any).headerEl
        const isGraph = leaf.view.getViewType() === "graph"

        let graphControls: HTMLElement | undefined;
        if (isGraph) { graphControls = (leaf.view as any).dataEngine?.controlsEl}
        if (!this.settings.showScroll){ viewEl.classList.add("noscroll") }
        if (isGraph && !this.settings.showGraphControls && graphControls) { graphControls.classList.add("hide") }
        isGraph ? viewEl.classList.add("vignette-radial") : viewEl.classList.add("vignette-linear")
        if (!isGraph && this.settings.forceReadable) { (leaf.view as any).editMode?.editorEl?.classList.add("is-readable-line-width") }

        viewEl.classList.add("animate")
        this.settings.showHeader ? header.classList.add("animate") : header.classList.add("hide")
    }

    removeStyles(leaf: WorkspaceLeaf) {
        const viewEl = (leaf.view as any).contentEl
        const header = (leaf.view as any).headerEl
        const isGraph = leaf.view.getViewType() === "graph"

        let graphControls: HTMLElement;
        if (isGraph) {
            graphControls = (leaf.view as any).dataEngine?.controlsEl
            if (graphControls) {
                graphControls.classList.remove("animate", "hide")
            }
        } else if (!(this.app.vault as any).getConfig('readableLineLength')) {
            (leaf.view as any).editMode?.editorEl?.classList.remove("is-readable-line-width")
        }

        viewEl.classList.remove("vignette-linear", "vignette-radial", "animate", "noscroll")
        header.classList.remove("animate", "hide")
    }
}

class ProzenSettingTab extends PluginSettingTab {
    plugin: Prozen;

    constructor(app: App, plugin: Prozen) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

       	this.containerEl.createEl("h3", {
			text: "Vignette",
		})

// VIGNETTE OPACITY SETTING
		let vignetteOpacityNumber: HTMLDivElement;
		new Setting(containerEl)
			.setName('Opacity')
			.setDesc("Intensity of vignette's dimming effect. Set to 0 to turn vignetting off.")
			.addSlider((slider) => slider
				.setLimits(0.00,1,0.01)
				.setValue(this.plugin.settings.vignetteOpacity)
				.onChange(async (value) => {
					vignetteOpacityNumber.innerText = " " + value.toString();
					this.plugin.settings.vignetteOpacity = value;
					await this.plugin.saveSettings();
				}))
				.settingEl.createDiv("", (el: HTMLDivElement) => {
					vignetteOpacityNumber = el;
					el.style.minWidth = "2.0em";
					el.style.textAlign = "right";
					el.innerText = " " + this.plugin.settings.vignetteOpacity.toString();
				});

// VIGNETTE SCALE LINEAR SETTING
		let vignetteScaleLinearNumber: HTMLDivElement;
		new Setting(containerEl)
			.setName('Scale in text views')
			.setDesc("Determines how close to the screen's center vignetting spreads from both sides of the screen, as linear gradients.")
			.addSlider((slider) => slider
				.setLimits(5,50,5)
				.setValue(this.plugin.settings.vignetteScaleLinear)
				.onChange(async (value) => {
					vignetteScaleLinearNumber.innerText = " " + value.toString();
					this.plugin.settings.vignetteScaleLinear = value;
					await this.plugin.saveSettings();
				}))
				.settingEl.createDiv("", (el: HTMLDivElement) => {
					vignetteScaleLinearNumber = el;
					el.style.minWidth = "2.0em";
					el.style.textAlign = "right";
					el.innerText = " " + this.plugin.settings.vignetteScaleLinear.toString();
				});
// VIGNETTE SCALE RADIAL SETTING
		let vignetteScaleRadialNumber: HTMLDivElement;
		new Setting(containerEl)
			.setName('Scale in graph view')
			.setDesc("Determines how close to the screen's center vignetting spreads from borders of the screen, as a radial gradient.")
			.addSlider((slider) => slider
				.setLimits(5,100,5)
				.setValue(this.plugin.settings.vignetteScaleRadial)
				.onChange(async (value) => {
					vignetteScaleRadialNumber.innerText = " " + value.toString();
					this.plugin.settings.vignetteScaleRadial = value;
					await this.plugin.saveSettings();
				}))
				.settingEl.createDiv("", (el: HTMLDivElement) => {
					vignetteScaleRadialNumber = el;
					el.style.minWidth = "2.0em";
					el.style.textAlign = "right";
					el.innerText = " " + this.plugin.settings.vignetteScaleRadial.toString();
				});

		this.containerEl.createEl("h3", {
			text: "Animation",
		})
// CONTENT FADE-IN DURATION SETTING
		new Setting(containerEl)
			.setName('Fade-in duration')
			.setDesc('The duration (in seconds) of fade-in animation on entering Zen mode')
			.addText(text => text
				.setPlaceholder('1.2')
				.setValue(String(this.plugin.settings.animationDuration))
				.onChange(async (value) => {
					this.plugin.settings.animationDuration = Number(value)
					await this.plugin.saveSettings();
				}));

        this.containerEl.createEl("h3", {
            text: "Element Toggles",
        })

// SHOW HEADER TOGGLE SETTING
        new Setting(containerEl)
            .setName("Show header")
            .setDesc("Show the tab's header in Zen mode")
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.showHeader)
                .onChange(async (value) => {
                    this.plugin.settings.showHeader = value;
                    await this.plugin.saveSettings();
                })
            );

// SHOW SCROLLBAR TOGGLE SETTING
        new Setting(containerEl)
            .setName("Show scrollbar")
            .setDesc("Show the scrollbar in Zen mode. If it is hidden, scrolling is still available with mousewheel, arrows, touchpad, etc.")
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.showScroll)
                .onChange(async (value) => {
                    this.plugin.settings.showScroll = value;
                    await this.plugin.saveSettings();
                })
            );

// SHOW GRAPH CONTROLS SETTING
        new Setting(containerEl)
            .setName("Show graph controls")
            .setDesc("Show the graph view's controls in Zen mode")
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.showGraphControls)
                .onChange(async (value) => {
                    this.plugin.settings.showGraphControls = value;
                    await this.plugin.saveSettings();
                })
            );


        this.containerEl.createEl("h3", {
            text: "Misc",
        })

		// AUTO ZEN MODE SETTING 
        new Setting(containerEl)
            .setName("Auto zen mode")
            .setDesc("Automatically enter zen mode when you begin typing in a document. ")
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.autoZenMode)
                .onChange(async (value) => {
                    this.plugin.settings.autoZenMode = value;
                    await this.plugin.saveSettings();
                })
            );

        // FORCE READABLE SETTING
        new Setting(containerEl)
            .setName("Force content centering")
            .setDesc("Center text content in Zen mode, even if in regular view it takes all of the screen's width (ignore 'Editor -> Readable line length' being off in Zen mode)")
            .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.forceReadable)
                .onChange(async (value) => {
                    this.plugin.settings.forceReadable = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}