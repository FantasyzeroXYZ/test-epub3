class EPUBReader {
    constructor() {
        this.currentBook = null;
        this.currentChapterIndex = 0;
        this.chapters = [];
        this.audioElements = {};
        this.smilData = {};
        this.isPlaying = false;
        this.currentAudio = null;
        this.currentHighlight = null;
        this.zip = null;
        this.resourceMap = new Map();
        this.currentSMILData = [];
        this.dictionaryButton = null;
        this.dictionaryModal = null;
        this.lastSelectionTime = 0;
        this.isAudioReady = false;
        this.isSelecting = false;
        this.dictionaryButtonTimeout = null;
        this.viewMode = 'scroll';
        this.currentSectionIndex = 0;
        this.sections = [];
        this.selectionToolbar = null;
        this.lookupWordBtn = null;
        this.selectedText = '';
        this.selectionTimeout = null;
        this.touchStartTime = 0;
        this.currentWordData = null;
        this.savedSelectionRange = null; // 添加保存的选择范围
        this.ankiConnected = false;
        this.currentModelFields = [];
        this.ankiSettings = {
            host: '127.0.0.1',
            port: 8765,
            deck: '',
            model: '',
            wordField: '',
            meaningField: '',
            sentenceField: '',
            audioField: '',
            tagsField: ''
        };
        
        this.initializeUI();
    }
    
    initializeUI() {
        // 主要UI元素
        this.sidebar = document.getElementById('sidebar');
        this.toggleSidebarBtn = document.getElementById('toggleSidebar');
        this.closeSidebarBtn = document.getElementById('closeSidebar');
        this.tocContainer = document.getElementById('tocContainer');
        this.bookTitle = document.getElementById('bookTitle');
        this.bookAuthor = document.getElementById('bookAuthor');
        this.pageContent = document.getElementById('pageContent');
        this.uploadContainer = document.getElementById('uploadContainer');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.currentPageSpan = document.getElementById('currentPage');
        this.totalPagesSpan = document.getElementById('totalPages');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.playerContainer = document.getElementById('playerContainer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progress = document.getElementById('progress');
        this.currentTimeSpan = document.getElementById('currentTime');
        this.durationSpan = document.getElementById('duration');
        this.playbackRateSelect = document.getElementById('playbackRate');
        this.swipeContainer = document.getElementById('swipeContainer');
        
        // 边缘点击区域
        this.leftEdgeTapArea = document.getElementById('leftEdgeTapArea');
        this.rightEdgeTapArea = document.getElementById('rightEdgeTapArea');
        
        // 设置相关元素
        this.toggleSettingsBtn = document.getElementById('toggleSettings');
        this.settingsSidebar = document.getElementById('settingsSidebar');
        this.closeSettingsBtn = document.getElementById('closeSettings');
        
        // 设置控件
        this.viewModeSelect = document.getElementById('viewMode');
        this.autoScroll = document.getElementById('autoScroll');
        this.fontSize = document.getElementById('fontSize');
        this.theme = document.getElementById('theme');
        this.autoPlay = document.getElementById('autoPlay');
        this.speechRate = document.getElementById('speechRate');
        this.offlineMode = document.getElementById('offlineMode');
        this.syncProgress = document.getElementById('syncProgress');
        this.exportDataBtn = document.getElementById('exportData');
        this.clearDataBtn = document.getElementById('clearData');
        
        // Anki设置控件
        this.testAnkiConnectionBtn = document.getElementById('testAnkiConnection');
        this.ankiHost = document.getElementById('ankiHost');
        this.ankiPort = document.getElementById('ankiPort');
        this.ankiDeck = document.getElementById('ankiDeck');
        this.ankiModel = document.getElementById('ankiModel');
        this.ankiWordField = document.getElementById('ankiWordField');
        this.ankiMeaningField = document.getElementById('ankiMeaningField');
        this.ankiSentenceField = document.getElementById('ankiSentenceField');
        this.ankiAudioField = document.getElementById('ankiAudioField');
        this.ankiTagsField = document.getElementById('ankiTagsField');
        this.saveAnkiSettingsBtn = document.getElementById('saveAnkiSettings');
        
        // 查词相关元素
        this.dictionaryModal = document.getElementById('dictionaryModal');
        this.dictionaryOverlay = document.getElementById('dictionaryOverlay');
        this.closeModalBtn = document.getElementById('closeModal');
        this.dictionaryContent = document.getElementById('dictionaryContent');
        this.dictionaryFooter = document.getElementById('dictionaryFooter');
        this.addToAnkiBtn = document.getElementById('addToAnkiBtn');

        // 选择工具栏
        this.selectionToolbar = document.getElementById('selectionToolbar');
        this.lookupWordBtn = document.getElementById('lookupWordBtn');
        this.highlightBtn = document.getElementById('highlightBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.shareBtn = document.getElementById('shareBtn');
        
        this.bindEvents();
        this.loadSettings();
        this.loadAnkiSettings();
        this.initializeSettingGroups();
    }
    
    bindEvents() {
        // 主要功能按钮事件
        this.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        this.closeSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        this.prevPageBtn.addEventListener('click', () => this.prevPage());
        this.nextPageBtn.addEventListener('click', () => this.nextPage());
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        
        // 设置按钮事件
        this.toggleSettingsBtn.addEventListener('click', () => this.toggleSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.toggleSettings());
        
        // 设置控件事件
        this.viewModeSelect.addEventListener('change', (e) => {
            this.switchViewMode(e.target.value);
            this.saveSettings();
        });
        this.autoScroll.addEventListener('change', () => this.saveSettings());
        this.fontSize.addEventListener('change', () => {
            this.saveSettings();
            this.applyFontSize();
        });
        this.theme.addEventListener('change', () => {
            this.saveSettings();
            this.applyTheme();
        });
        this.autoPlay.addEventListener('change', () => this.saveSettings());
        this.speechRate.addEventListener('change', () => this.saveSettings());
        this.offlineMode.addEventListener('change', () => this.saveSettings());
        this.syncProgress.addEventListener('change', () => this.saveSettings());
        this.exportDataBtn.addEventListener('click', () => this.exportData());
        this.clearDataBtn.addEventListener('click', () => this.clearData());
        
        // Anki设置事件
        this.testAnkiConnectionBtn.addEventListener('click', () => this.testAnkiConnection());
        this.saveAnkiSettingsBtn.addEventListener('click', () => this.saveAnkiSettings());
        
        // 上传区域事件
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // 音频控制事件
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.progressBar.addEventListener('click', (e) => this.seekAudio(e));
        this.playbackRateSelect.addEventListener('change', (e) => this.changePlaybackRate(e.target.value));
        
        // 边缘点击翻页事件
        this.leftEdgeTapArea.addEventListener('click', () => this.prevPage());
        this.rightEdgeTapArea.addEventListener('click', () => this.nextPage());
        
        // 查词相关事件
        this.closeModalBtn.addEventListener('click', () => this.hideDictionaryModal());
        this.dictionaryOverlay.addEventListener('click', () => this.hideDictionaryModal());
        this.addToAnkiBtn.addEventListener('click', () => this.addToAnki());

        // 工具栏按钮事件
        this.lookupWordBtn.addEventListener('click', () => this.lookupWord());
        this.highlightBtn.addEventListener('click', () => this.highlightText());
        this.copyBtn.addEventListener('click', () => this.copyText());
        this.shareBtn.addEventListener('click', () => this.shareText());

        // 文本选择事件处理
        this.bindSelectionEvents();

        // 牌组和模板选择事件
        this.ankiDeck.addEventListener('change', () => {
            this.ankiSettings.deck = this.ankiDeck.value;
            this.saveAnkiSettings();
        });

        this.ankiModel.addEventListener('change', async () => {
            this.ankiSettings.model = this.ankiModel.value;
            await this.loadModelFields(this.ankiModel.value);
            this.saveAnkiSettings();
        });

        // 字段选择事件
        const fieldSelectors = [
            this.ankiWordField, this.ankiMeaningField, 
            this.ankiSentenceField, this.ankiAudioField, this.ankiTagsField
        ];

        fieldSelectors.forEach(select => {
            select.addEventListener('change', () => this.saveAnkiSettings());
        });
        
        // 拖拽上传事件
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].name.endsWith('.epub')) {
                this.loadEPUB(files[0]);
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    // 初始化设置分组折叠功能
    initializeSettingGroups() {
        const groupHeaders = document.querySelectorAll('.setting-group-header');
        groupHeaders.forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
            });
            // 默认全部折叠
            header.classList.add('collapsed');
        });
    }

    // 键盘快捷键处理
    handleKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.prevPage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextPage();
                break;
            case ' ':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'Escape':
                this.hideDictionaryModal();
                this.hideSelectionToolbar();
                break;
        }
    }

    // 设置相关方法
    toggleSettings() {
        this.settingsSidebar.classList.toggle('open');
        
        if (this.settingsSidebar.classList.contains('open')) {
            this.sidebar.classList.remove('open');
        }
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('epubReaderSettings') || '{}');
        
        this.viewModeSelect.value = settings.viewMode || 'scroll';
        this.autoScroll.checked = settings.autoScroll || false;
        this.fontSize.value = settings.fontSize || 'medium';
        this.theme.value = settings.theme || 'light';
        this.autoPlay.checked = settings.autoPlay !== false;
        this.speechRate.value = settings.speechRate || '1';
        this.offlineMode.checked = settings.offlineMode || false;
        this.syncProgress.checked = settings.syncProgress !== false;
        
        this.applyFontSize();
        this.applyTheme();
        this.switchViewMode(this.viewModeSelect.value);
    }

    saveSettings() {
        const settings = {
            viewMode: this.viewModeSelect.value,
            autoScroll: this.autoScroll.checked,
            fontSize: this.fontSize.value,
            theme: this.theme.value,
            autoPlay: this.autoPlay.checked,
            speechRate: this.speechRate.value,
            offlineMode: this.offlineMode.checked,
            syncProgress: this.syncProgress.checked
        };
        
        localStorage.setItem('epubReaderSettings', JSON.stringify(settings));
    }

    applyFontSize() {
        const fontSize = this.fontSize.value;
        const sizes = {
            small: '0.9rem',
            medium: '1.1rem',
            large: '1.3rem',
            xlarge: '1.5rem'
        };
        
        document.documentElement.style.setProperty('--base-font-size', sizes[fontSize]);
        
        const pageContent = document.querySelector('.page-content');
        if (pageContent) {
            pageContent.style.fontSize = sizes[fontSize];
        }
    }

    applyTheme() {
        const theme = this.theme.value;
        const themes = {
            light: {
                '--primary-color': '#3498db',
                '--secondary-color': '#2c3e50',
                '--background-color': '#f5f5f5',
                '--text-color': '#333',
                '--border-color': '#ddd'
            },
            dark: {
                '--primary-color': '#3498db',
                '--secondary-color': '#34495e',
                '--background-color': '#1a1a1a',
                '--text-color': '#ecf0f1',
                '--border-color': '#34495e'
            },
            sepia: {
                '--primary-color': '#d35400',
                '--secondary-color': '#8b4513',
                '--background-color': '#f4ecd8',
                '--text-color': '#5c4b37',
                '--border-color': '#d2b48c'
            }
        };
        
        const themeColors = themes[theme];
        Object.keys(themeColors).forEach(key => {
            document.documentElement.style.setProperty(key, themeColors[key]);
        });
    }

    exportData() {
        const readingData = {
            currentBook: this.currentBook,
            currentChapterIndex: this.currentChapterIndex,
            settings: JSON.parse(localStorage.getItem('epubReaderSettings') || '{}')
        };
        
        const dataStr = JSON.stringify(readingData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'epub-reader-data.json';
        link.click();
        
        URL.revokeObjectURL(url);
        this.showToast('数据导出成功');
    }

    clearData() {
        if (confirm('确定要清除所有缓存数据吗？此操作不可撤销。')) {
            localStorage.removeItem('epubReaderSettings');
            localStorage.removeItem('epubReaderAnkiSettings');
            this.showToast('缓存数据已清除');
            location.reload();
        }
    }

    // Anki设置相关方法
    loadAnkiSettings() {
        const settings = JSON.parse(localStorage.getItem('epubReaderAnkiSettings') || '{}');
        this.ankiSettings = { ...this.ankiSettings, ...settings };
        
        this.ankiHost.value = this.ankiSettings.host;
        this.ankiPort.value = this.ankiSettings.port;
        this.ankiDeck.value = this.ankiSettings.deck;
        this.ankiModel.value = this.ankiSettings.model;
        
        this.restoreFieldSelections();
        
        if (this.ankiSettings.host && this.ankiSettings.port) {
            setTimeout(() => {
                this.testAnkiConnection().then(() => {
                    console.log('Anki连接测试完成');
                });
            }, 1000);
        }
    }

    saveAnkiSettings() {
        this.ankiSettings = {
            host: this.ankiHost.value,
            port: parseInt(this.ankiPort.value),
            deck: this.ankiDeck.value,
            model: this.ankiModel.value,
            wordField: this.ankiWordField.value,
            meaningField: this.ankiMeaningField.value,
            sentenceField: this.ankiSentenceField.value,
            audioField: this.ankiAudioField.value,
            tagsField: this.ankiTagsField.value
        };
        
        localStorage.setItem('epubReaderAnkiSettings', JSON.stringify(this.ankiSettings));
        this.showToast('Anki设置已保存');
    }

    async testAnkiConnection() {
        try {
            this.showToast('正在测试Anki连接...');
            
            const response = await fetch(`http://${this.ankiSettings.host}:${this.ankiSettings.port}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'version',
                    version: 6
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.result) {
                    this.ankiConnected = true;
                    this.showToast(`Anki连接成功，版本: ${data.result}`);
                    
                    await this.loadAnkiDecks();
                    await this.loadAnkiModels();
                    return true;
                }
            }
            throw new Error('AnkiConnect响应错误');
        } catch (error) {
            this.ankiConnected = false;
            this.showToast('Anki连接失败，请检查AnkiConnect插件');
            console.error('Anki连接错误:', error);
            return false;
        }
    }

    async loadAnkiDecks() {
        try {
            const decks = await this.ankiRequest('deckNames', {});
            console.log('加载到的牌组:', decks);
            
            const currentDeck = this.ankiDeck.value;
            
            this.ankiDeck.innerHTML = '<option value="">选择牌组</option>';
            decks.forEach(deck => {
                const option = document.createElement('option');
                option.value = deck;
                option.textContent = deck;
                this.ankiDeck.appendChild(option);
            });
            
            if (this.ankiSettings.deck && decks.includes(this.ankiSettings.deck)) {
                this.ankiDeck.value = this.ankiSettings.deck;
            } else if (currentDeck && decks.includes(currentDeck)) {
                this.ankiDeck.value = currentDeck;
            }
            
        } catch (error) {
            console.error('获取牌组列表错误:', error);
            this.showToast('获取牌组列表失败');
        }
    }

    async loadAnkiModels() {
        try {
            const models = await this.ankiRequest('modelNames', {});
            console.log('加载到的模板:', models);
            
            const currentModel = this.ankiModel.value;
            
            this.ankiModel.innerHTML = '<option value="">选择模板</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                this.ankiModel.appendChild(option);
            });
            
            if (this.ankiSettings.model && models.includes(this.ankiSettings.model)) {
                this.ankiModel.value = this.ankiSettings.model;
                await this.loadModelFields(this.ankiSettings.model);
            } else if (currentModel && models.includes(currentModel)) {
                this.ankiModel.value = currentModel;
                await this.loadModelFields(currentModel);
            } else if (models.length > 0) {
                this.ankiModel.value = models[0];
                await this.loadModelFields(models[0]);
            }
            
        } catch (error) {
            console.error('获取模型列表错误:', error);
            this.showToast('获取模板列表失败');
        }
    }

    async loadModelFields(modelName) {
        try {
            const fields = await this.ankiRequest('modelFieldNames', { 
                modelName: modelName 
            });
            
            console.log('加载到的字段:', fields);
            this.currentModelFields = fields;
            this.updateFieldSelectors(fields);
            
            if (!this.ankiSettings.wordField || !this.ankiSettings.sentenceField) {
                this.setDefaultFields(fields);
            }
            
        } catch (error) {
            console.error('获取模型字段错误:', error);
            this.showToast('获取字段列表失败');
        }
    }

    updateFieldSelectors(fields) {
        const fieldSelectors = [
            this.ankiWordField,
            this.ankiMeaningField,
            this.ankiSentenceField,
            this.ankiAudioField,
            this.ankiTagsField
        ];
        
        fieldSelectors.forEach(select => {
            select.innerHTML = '<option value="">选择字段</option>';
            fields.forEach(field => {
                const option = document.createElement('option');
                option.value = field;
                option.textContent = field;
                select.appendChild(option);
            });
        });
        
        this.restoreFieldSelections();
    }

    setDefaultFields(fields) {
        const fieldMap = fields.map(f => f.toLowerCase());
        
        if (!this.ankiSettings.wordField) {
            if (fieldMap.includes('word')) {
                this.ankiWordField.value = 'word';
            } else if (fieldMap.includes('front')) {
                this.ankiWordField.value = 'front';
            } else if (fields.length > 0) {
                this.ankiWordField.selectedIndex = 0;
            }
        }
        
        if (!this.ankiSettings.sentenceField) {
            if (fieldMap.includes('sentence')) {
                this.ankiSentenceField.value = 'sentence';
            } else if (fieldMap.includes('example')) {
                this.ankiSentenceField.value = 'example';
            } else if (fieldMap.includes('back')) {
                this.ankiSentenceField.value = 'back';
            } else if (fields.length > 1) {
                this.ankiSentenceField.selectedIndex = 1;
            }
        }
        
        if (!this.ankiSettings.meaningField) {
            if (fieldMap.includes('definition')) {
                this.ankiMeaningField.value = 'definition';
            } else if (fieldMap.includes('meaning')) {
                this.ankiMeaningField.value = 'meaning';
            } else if (fieldMap.includes('back')) {
                this.ankiMeaningField.value = 'back';
            } else if (fields.length > 2) {
                this.ankiMeaningField.selectedIndex = 2;
            }
        }
        
        if (!this.ankiSettings.audioField) {
            if (fieldMap.includes('audio')) {
                this.ankiAudioField.value = 'audio';
            } else if (fieldMap.includes('sound')) {
                this.ankiAudioField.value = 'sound';
            } else if (fields.length > 3) {
                this.ankiAudioField.selectedIndex = 3;
            }
        }
        
        if (!this.ankiSettings.tagsField) {
            if (fieldMap.includes('tags')) {
                this.ankiTagsField.value = 'tags';
            } else if (fields.length > 4) {
                this.ankiTagsField.selectedIndex = 4;
            }
        }
    }

    restoreFieldSelections() {
        if (this.ankiSettings.wordField) {
            this.ankiWordField.value = this.ankiSettings.wordField;
        }
        if (this.ankiSettings.meaningField) {
            this.ankiMeaningField.value = this.ankiSettings.meaningField;
        }
        if (this.ankiSettings.sentenceField) {
            this.ankiSentenceField.value = this.ankiSettings.sentenceField;
        }
        if (this.ankiSettings.audioField) {
            this.ankiAudioField.value = this.ankiSettings.audioField;
        }
        if (this.ankiSettings.tagsField) {
            this.ankiTagsField.value = this.ankiSettings.tagsField;
        }
    }

    async ankiRequest(action, params = {}) {
        const url = `http://${this.ankiSettings.host}:${this.ankiSettings.port}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: action,
                    version: 6,
                    params: params
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            return result.result;
        } catch (error) {
            console.error('Anki请求失败:', error);
            throw new Error(`Anki请求失败: ${error.message}`);
        }
    }

    async addToAnki() {
        // 检查连接状态
        if (!this.ankiConnected) {
            const connected = await this.testAnkiConnection();
            if (!connected) {
                this.showToast('请先连接Anki!');
                return;
            }
        }

        // 确保有选中的文本
        if (!this.selectedText) {
            this.showToast('没有选中的文本');
            return;
        }

        if (!this.currentWordData) {
            this.showToast('请先查询单词释义');
            return;
        }

        if (!this.ankiSettings.deck || !this.ankiSettings.model) {
            this.showToast('请先配置Anki牌组和模板!');
            return;
        }

        // 验证必要字段
        if (!this.ankiSettings.wordField || !this.ankiSettings.sentenceField) {
            this.showToast('请配置单词字段和句子字段!');
            return;
        }

        // 保存原始按钮状态
        const originalHTML = this.addToAnkiBtn.innerHTML;
        this.addToAnkiBtn.disabled = true;
        this.addToAnkiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 添加中...';

        try {
            // 恢复选择范围以确保音频处理能正常工作
            this.restoreSelection();
            
            await this.processAnkiCard();
            this.showToast('✅ 单词已成功添加到Anki!');
            this.hideDictionaryModal();
        } catch (error) {
            console.error('添加卡片失败:', error);
            this.showToast('❌ 添加失败: ' + error.message);
        } finally {
            this.addToAnkiBtn.disabled = false;
            this.addToAnkiBtn.innerHTML = originalHTML;
        }
    }

    async processAnkiCard() {
        const word = this.selectedText.trim();
        
        const sentence = this.getWordSentence(word);
        console.log('句子字段内容:', sentence);
        
        const definition = this.getWordDefinition();
        
        const note = {
            deckName: this.ankiSettings.deck,
            modelName: this.ankiSettings.model,
            fields: {
                [this.ankiSettings.wordField]: word,
                [this.ankiSettings.sentenceField]: sentence
            },
            options: { allowDuplicate: false },
            tags: ['epub-reader']
        };
        
        if (this.ankiSettings.meaningField && definition) {
            note.fields[this.ankiSettings.meaningField] = definition;
        }
        
        if (this.ankiSettings.tagsField) {
            note.fields[this.ankiSettings.tagsField] = 'epub-reader';
        }
        
        if (this.ankiSettings.audioField) {
            try {
                const audioFilename = await this.processAudioForWord(word);
                if (audioFilename) {
                    note.fields[this.ankiSettings.audioField] = `[sound:${audioFilename}]`;
                    console.log('音频字段设置:', audioFilename);
                }
            } catch (error) {
                console.error('音频处理失败:', error);
            }
        }
        
        console.log('准备添加到Anki的笔记:', note);
        
        await this.addCardToAnki(note);
    }

    getWordDefinition() {
        if (!this.currentWordData || !this.currentWordData.meanings) {
            return '暂无释义';
        }
        
        const meaning = this.currentWordData.meanings[0];
        if (!meaning) return '暂无释义';
        
        const definition = meaning.definitions[0]?.definition || '暂无释义';
        return `${meaning.partOfSpeech || ''} ${definition}`.trim();
    }

    getWordSentence(selectedText) {
        try {
            if (!this.savedSelectionRange) {
                return selectedText;
            }
            
            const range = this.savedSelectionRange;
            let elementWithId = range.startContainer.parentElement;
            
            // 向上查找有ID的元素
            while (elementWithId && !elementWithId.id && elementWithId.parentElement) {
                elementWithId = elementWithId.parentElement;
            }
            
            if (!elementWithId || !elementWithId.id) {
                return selectedText;
            }
            
            const elementId = elementWithId.id;
            
            // 在SMIL数据中查找对应的文本段
            const segment = this.currentSMILData.find(s => s.textId === elementId);
            if (!segment) {
                return selectedText;
            }
            
            // 直接从DOM中获取该ID元素的完整文本内容
            const textElement = document.getElementById(elementId);
            if (textElement) {
                const fullText = textElement.textContent || textElement.innerText;
                const cleanedText = this.cleanSentenceText(fullText);
                console.log('从SMIL获取的完整句子:', cleanedText);
                return cleanedText || selectedText;
            }
            
            return selectedText;
            
        } catch (error) {
            console.error('从SMIL获取句子失败:', error);
            return selectedText;
        }
    }

    cleanSentenceText(text) {
        return text
            .replace(/<[^>]*>/g, '') // 移除HTML标签
            .replace(/\s+/g, ' ') // 合并多余空格
            .replace(/[\r\n\t]/g, ' ') // 替换换行和制表符
            .replace(/^[^a-zA-Z]*/, '') // 移除开头的非字母字符
            .replace(/[^a-zA-Z0-9\.!?]*$/, '') // 移除结尾的非字母数字和标点
            .trim();
    }

    async processAudioForWord(word) {
        try {
            if (!this.currentAudio || !this.currentSMILData || this.currentSMILData.length === 0) {
                console.log('没有可用的音频数据');
                return null;
            }

            if (!this.savedSelectionRange) {
                console.log('没有保存的文本选择范围');
                return null;
            }
            
            const range = this.savedSelectionRange;
            let elementWithId = range.startContainer.parentElement;
            
            // 向上查找有ID的元素
            while (elementWithId && !elementWithId.id && elementWithId.parentElement) {
                elementWithId = elementWithId.parentElement;
            }
            
            if (!elementWithId || !elementWithId.id) {
                console.log('未找到带ID的文本元素');
                return null;
            }
            
            const elementId = elementWithId.id;
            console.log('查找音频段，元素ID:', elementId);
            
            // 精确匹配SMIL数据
            const segment = this.currentSMILData.find(s => s.textId === elementId);
            
            if (!segment) {
                console.log('未找到对应的音频段');
                console.log('可用的音频段ID:', this.currentSMILData.map(s => s.textId));
                return null;
            }
            
            console.log('找到精确匹配的音频段:', segment);
            
            // 获取音频Blob
            const audioBlob = await this.getAudioBlob(segment.audioSrc);
            if (!audioBlob) {
                console.log('无法获取音频Blob');
                return null;
            }
            
            console.log('获取到音频Blob，大小:', audioBlob.size);
            
            // 切割音频 - 使用SMIL中精确的时间段
            const audioClip = await this.generateAudioClip(audioBlob, segment.start, segment.end);
            if (!audioClip) {
                console.log('音频切割失败');
                return null;
            }
            
            // 存储到Anki
            const filename = this.generateAudioFileName(word);
            const storedName = await this.storeMediaFile(filename, audioClip);
            
            console.log('音频文件存储成功:', storedName);
            return storedName;
            
        } catch (error) {
            console.error('处理音频失败:', error);
            return null;
        }
    }

    // 获取当前播放音频的Blob
    async getCurrentAudioBlob() {
        try {
            if (!this.currentAudio || !this.currentAudio.src) {
                return null;
            }
            
            if (this.currentAudio.src.startsWith('blob:')) {
                const response = await fetch(this.currentAudio.src);
                return await response.blob();
            }
            
            return null;
        } catch (error) {
            console.error('获取当前音频Blob失败:', error);
            return null;
        }
    }

    // 获取音频时长
    async getAudioDuration(blob) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.addEventListener('loadedmetadata', () => {
                resolve(audio.duration);
            });
            audio.addEventListener('error', () => {
                resolve(0);
            });
            audio.src = URL.createObjectURL(blob);
        });
    }

    async generateAudioClip(audioBlob, startTime, endTime) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            const audioDuration = audioBuffer.duration;
            console.log('音频总时长:', audioDuration, 'SMIL时间范围:', startTime, '-', endTime);
            
            // 验证时间范围在音频范围内
            if (startTime >= audioDuration || endTime > audioDuration) {
                console.warn('SMIL时间范围超出音频长度，使用完整音频');
                return audioBlob;
            }
            
            if (startTime >= endTime) {
                console.warn('SMIL时间范围无效，使用完整音频');
                return audioBlob;
            }
            
            const sampleRate = audioBuffer.sampleRate;
            const startSample = Math.floor(startTime * sampleRate);
            const endSample = Math.floor(endTime * sampleRate);
            const frameCount = endSample - startSample;
            
            const newBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                frameCount,
                sampleRate
            );
            
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const oldData = audioBuffer.getChannelData(channel);
                const newData = newBuffer.getChannelData(channel);
                for (let i = 0; i < frameCount; i++) {
                    newData[i] = oldData[startSample + i];
                }
            }
            
            return this.bufferToWavBlob(newBuffer);
            
        } catch (error) {
            console.error('音频切割失败:', error);
            return audioBlob;
        }
    }

    bufferToWavBlob(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        
        const dataSize = length * blockAlign;
        
        const bufferArray = new ArrayBuffer(44 + dataSize);
        const view = new DataView(bufferArray);
        
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
        
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bytesPerSample * 8, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);
        
        const offset = 44;
        let index = 0;
        
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset + index, int16Sample, true);
                index += 2;
            }
        }
        
        return new Blob([bufferArray], { type: 'audio/wav' });
    }

    generateAudioFileName(word) {
        const cleanWord = word.replace(/[^a-z]/gi, '').toLowerCase() || 'audio';
        let fileName = `audio_${cleanWord}_${Date.now()}.wav`;
        fileName = fileName.replace(/[^\w.\-]/g, '_');
        return fileName;
    }

    async storeMediaFile(filename, blob) {
        try {
            const base64Data = await this.blobToBase64(blob);
            const pureBase64 = base64Data.split(',')[1];
            
            if (!pureBase64) {
                throw new Error('Base64数据转换失败');
            }
            
            const result = await this.ankiRequest('storeMediaFile', {
                filename: filename,
                data: pureBase64,
                deleteExisting: true
            });
            
            return result || filename;
            
        } catch (error) {
            console.error('存储媒体文件失败:', error);
            return null;
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    async addCardToAnki(note) {
        console.log('准备添加卡片到 Anki:', note);

        try {
            const result = await this.ankiRequest('addNote', { note });
            
            if (result) {
                console.log('✅ 卡片添加成功，ID:', result);
                return result;
            } else {
                console.warn('AnkiConnect 返回空结果，可能未创建卡片');
                throw new Error('卡片创建失败');
            }
            
        } catch (error) {
            if (error.message.includes('duplicate')) {
                console.warn('检测到重复卡片，跳过添加');
                throw new Error('已存在相同卡片');
            } else {
                console.error('添加卡片失败:', error);
                throw error;
            }
        }
    }

    async getAudioBlob(audioPath) {
        try {
            console.log('尝试获取音频Blob，路径:', audioPath);
            
            // 如果是blob URL，直接获取
            if (audioPath.startsWith('blob:')) {
                const response = await fetch(audioPath);
                return await response.blob();
            }
            
            // 先尝试直接匹配
            let blob = this.resourceMap.get(audioPath);
            if (blob) {
                console.log('直接匹配找到音频:', audioPath);
                return blob;
            }
            
            // 尝试各种可能的路径变体
            const possiblePaths = this.generateAudioPaths(audioPath);
            console.log('尝试的音频路径列表:', possiblePaths);
            
            for (const path of possiblePaths) {
                blob = this.resourceMap.get(path);
                if (blob) {
                    console.log('找到音频文件:', path);
                    return blob;
                }
            }
            
            // 如果还是没找到，尝试搜索包含文件名的资源
            const fileName = audioPath.split('/').pop();
            if (fileName) {
                for (const [path, blob] of this.resourceMap.entries()) {
                    if (path.includes(fileName)) {
                        console.log('通过文件名搜索找到音频:', path);
                        return blob;
                    }
                }
            }
            
            console.warn('无法找到音频文件:', audioPath);
            console.log('当前资源映射中的文件:', Array.from(this.resourceMap.keys()));
            return null;
            
        } catch (error) {
            console.error('获取音频Blob失败:', error);
            return null;
        }
    }

    generateAudioPaths(audioPath) {
        const paths = new Set();
        
        // 原始路径
        paths.add(audioPath);
        
        // 处理相对路径
        if (audioPath.startsWith('../')) {
            const normalized = audioPath.substring(3); // 移除 ../
            paths.add(normalized);
            paths.add('./' + normalized);
        }
        
        if (audioPath.startsWith('./')) {
            const normalized = audioPath.substring(2); // 移除 ./
            paths.add(normalized);
            paths.add('../' + normalized);
        }
        
        // 处理绝对路径
        if (audioPath.startsWith('/')) {
            const normalized = audioPath.substring(1); // 移除开头的 /
            paths.add(normalized);
            paths.add('./' + normalized);
            paths.add('../' + normalized);
        }
        
        // 添加各种组合
        paths.add(audioPath.replace(/^\.\.\//, ''));
        paths.add(audioPath.replace(/^\.\//, ''));
        paths.add(audioPath.replace(/^\//, ''));
        
        // 添加带Audio目录的路径
        if (!audioPath.includes('Audio/')) {
            paths.add('Audio/' + audioPath);
            paths.add('./Audio/' + audioPath);
            paths.add('../Audio/' + audioPath);
        }
        
        // 添加当前目录
        paths.add('./' + audioPath);
        paths.add('../' + audioPath);
        
        return Array.from(paths);
    }

    // 文本选择事件绑定
    bindSelectionEvents() {
        document.addEventListener('mousedown', (e) => {
            if (!this.selectionToolbar.contains(e.target)) {
                this.hideSelectionToolbar();
            }
        });
        
        document.addEventListener('touchstart', (e) => {
            if (!this.selectionToolbar.contains(e.target)) {
                this.hideSelectionToolbar();
            }
        });

        document.addEventListener('selectionchange', () => {
            this.handleSelectionChange();
        });

        const preventContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };

        this.readerContent = document.querySelector('.reader-content');
        if (this.readerContent) {
            this.readerContent.addEventListener('contextmenu', preventContextMenu);
            this.readerContent.addEventListener('touchstart', (e) => {
                this.touchStartTime = Date.now();
            });
            
            this.readerContent.addEventListener('touchend', (e) => {
                const touchDuration = Date.now() - this.touchStartTime;
                if (touchDuration > 500) {
                    setTimeout(() => {
                        this.handleSelectionChange();
                    }, 100);
                }
            });
        }

        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.reader-content') || 
                e.target.closest('.page-content') ||
                e.target.closest('.page-section')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });

        document.addEventListener('touchend', (e) => {
            setTimeout(() => {
                this.handleSelectionChange(e);
            }, 100);
        });

        document.addEventListener('mouseup', (e) => {
            this.handleSelectionChange(e);
        });
    }

    handleSelectionChange(e) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        console.log('选中的文本:', selectedText, '长度:', selectedText.length);
        
        if (this.selectionTimeout) {
            clearTimeout(this.selectionTimeout);
        }
        
        if (selectedText.length > 0 && selectedText.length < 100) {
            this.selectedText = selectedText;
            
            this.selectionTimeout = setTimeout(() => {
                this.showSelectionToolbar(selection);
                
                if (/Android/i.test(navigator.userAgent)) {
                    setTimeout(() => {
                        if (e) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }, 50);
                }
            }, 150);
        } else {
            this.hideSelectionToolbar();
        }
    }

    hideSelectionToolbar() {
        this.selectionToolbar.classList.remove('show');
        if (this.selectionTimeout) {
            clearTimeout(this.selectionTimeout);
            this.selectionTimeout = null;
        }
    }

    showSelectionToolbar(selection) {
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        if (rect.width === 0 && rect.height === 0) return;
        
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        const toolbarX = rect.left + rect.width / 2 + scrollX;
        const toolbarY = rect.top + scrollY;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const toolbarRect = this.selectionToolbar.getBoundingClientRect();
        
        let finalX = toolbarX - toolbarRect.width / 2;
        let finalY = toolbarY - toolbarRect.height - 10;
        
        if (finalX < 10) finalX = 10;
        if (finalX + toolbarRect.width > viewportWidth - 10) {
            finalX = viewportWidth - toolbarRect.width - 10;
        }
        
        if (finalY < 10) {
            finalY = toolbarY + rect.height + 10;
        }
        
        if (finalY + toolbarRect.height > viewportHeight - 10) {
            finalY = viewportHeight - toolbarRect.height - 10;
        }
        
        this.selectionToolbar.style.left = finalX + 'px';
        this.selectionToolbar.style.top = finalY + 'px';
        this.selectionToolbar.style.transform = 'translateY(-110%)';
        
        this.selectionToolbar.classList.add('show');
        
        console.log('显示自定义工具栏，选中文本:', this.selectedText, '位置:', finalX, finalY);
        
        // 保存选择范围
        this.saveCurrentSelection();
        
        if (/Android/i.test(navigator.userAgent)) {
            document.addEventListener('contextmenu', this.preventAndroidToolbar, { once: true });
        }
    }

    preventAndroidToolbar(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    lookupWord() {
        if (!this.selectedText) {
            // 如果没有保存的选中文本，尝试从当前选择中获取
            const selection = window.getSelection();
            this.selectedText = selection.toString().trim();
        }
        
        if (!this.selectedText) {
            this.showToast('请先选择文本');
            return;
        }
        
        this.hideSelectionToolbar();
        this.showDictionaryModal();
        
        // 不清除选择，保留选择状态用于后续处理
        // window.getSelection().removeAllRanges();
    }

    highlightText() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.className = 'highlight';
        span.style.backgroundColor = '#fff9c4';
        
        try {
            range.surroundContents(span);
            this.hideSelectionToolbar();
            window.getSelection().removeAllRanges();
            this.showToast('文本已高亮');
        } catch (e) {
            console.warn('无法高亮此选择:', e);
            this.showToast('无法高亮此文本');
        }
    }

    copyText() {
        if (!this.selectedText) return;
        
        navigator.clipboard.writeText(this.selectedText).then(() => {
            this.hideSelectionToolbar();
            window.getSelection().removeAllRanges();
            this.showToast('文本已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败:', err);
            const textArea = document.createElement('textarea');
            textArea.value = this.selectedText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('文本已复制到剪贴板');
        });
    }

    shareText() {
        if (!this.selectedText) return;
        
        if (navigator.share) {
            navigator.share({
                title: '分享文本',
                text: this.selectedText
            }).then(() => {
                this.hideSelectionToolbar();
                window.getSelection().removeAllRanges();
            }).catch(err => {
                console.error('分享失败:', err);
            });
        } else {
            this.copyText();
        }
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10001;
            font-size: 0.9rem;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }

    switchViewMode(mode) {
        if (this.viewMode === mode) return;
        
        this.viewMode = mode;
        
        if (this.currentChapterIndex !== undefined && this.chapters.length > 0) {
            this.loadChapter(this.currentChapterIndex);
        }
    }

    loadChapter(index) {
        if (index < 0 || index >= this.chapters.length) return;
        
        this.currentChapterIndex = index;
        const chapter = this.chapters[index];
        
        if (this.viewMode === 'scroll') {
            this.pageContent.innerHTML = chapter.content;
            this.pageContent.className = 'page-content scroll-mode';
            this.currentPageSpan.textContent = (index + 1).toString();
            this.totalPagesSpan.textContent = this.chapters.length;
        } else {
            this.splitChapterIntoPages(chapter.content);
            this.pageContent.className = 'page-content paged-mode';
            this.currentPageSpan.textContent = '1';
            this.totalPagesSpan.textContent = this.sections.length;
        }
        
        this.updateTOCHighlight();
        
        this.currentSMILData = chapter.audio ? chapter.audio.smilData || [] : [];
        this.bindDoubleClickEvents();
        
        this.bindSelectionEventsToNewContent();
        
        if (chapter.audio && chapter.audio.src) {
            this.prepareAudioPlayer(chapter);
        } else {
            this.playerContainer.style.display = 'none';
        }
        
        this.pageContent.scrollTop = 0;
    }

    bindSelectionEventsToNewContent() {
        const contentElements = this.pageContent.querySelectorAll('p, span, div, li, h1, h2, h3, h4, h5, h6');
        
        contentElements.forEach(element => {
            element.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
            
            element.addEventListener('touchstart', (e) => {
                this.touchStartTime = Date.now();
            });
            
            element.addEventListener('touchend', (e) => {
                const touchDuration = Date.now() - this.touchStartTime;
                if (touchDuration > 400) {
                    setTimeout(() => {
                        this.handleSelectionChange(e);
                    }, 100);
                }
            });
        });
    }

    splitChapterIntoPages(content) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        tempDiv.classList.add('epub-content');
        
        const container = this.pageContent;
        const containerHeight = container.offsetHeight - 40;
        const containerWidth = container.offsetWidth - 40;
        
        this.sections = [];
        
        const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, blockquote, pre, ul, ol, li');
        
        if (elements.length === 0) {
            this.sections.push(content);
        } else {
            let currentPage = [];
            let currentHeight = 0;
            
            for (let element of elements) {
                const elementHeight = this.simpleEstimateHeight(element, containerWidth);
                
                if (currentHeight > 0 && currentHeight + elementHeight > containerHeight) {
                    this.sections.push(currentPage.map(el => el.outerHTML).join(''));
                    currentPage = [];
                    currentHeight = 0;
                }
                
                currentPage.push(element.cloneNode(true));
                currentHeight += elementHeight;
                
                if (elementHeight > containerHeight && currentPage.length > 1) {
                    const lastElement = currentPage.pop();
                    this.sections.push(currentPage.map(el => el.outerHTML).join(''));
                    currentPage = [lastElement];
                    currentHeight = elementHeight;
                }
            }
            
            if (currentPage.length > 0) {
                this.sections.push(currentPage.map(el => el.outerHTML).join(''));
            }
        }
        
        if (this.sections.length === 0) {
            this.sections.push(content);
        }
        
        console.log('分页结果:', this.sections.length, '页');
        
        this.renderPagedContent();
        this.currentSectionIndex = 0;
        this.showSection(0);
    }

    simpleEstimateHeight(element, containerWidth) {
        const temp = document.createElement('div');
        temp.style.cssText = `
            position: absolute;
            left: -9999px;
            top: -9999px;
            width: ${containerWidth}px;
            padding: 20px;
            font-size: 1.1rem;
            line-height: 1.8;
        `;
        
        const clone = element.cloneNode(true);
        temp.appendChild(clone);
        document.body.appendChild(temp);
        
        const height = temp.offsetHeight;
        document.body.removeChild(temp);
        
        return height + 20;
    }

    renderPagedContent() {
        const pagedContainer = document.createElement('div');
        pagedContainer.className = 'paged-content';
        
        this.sections.forEach((sectionHtml, index) => {
            const section = document.createElement('div');
            section.className = 'page-section';
            section.innerHTML = sectionHtml;
            section.style.display = index === 0 ? 'block' : 'none';
            pagedContainer.appendChild(section);
        });
        
        this.pageContent.innerHTML = '';
        this.pageContent.appendChild(pagedContainer);
        
        console.log('渲染分页内容完成，共', this.sections.length, '页');
    }
    
    showSection(index) {
        const sections = this.pageContent.querySelectorAll('.page-section');
        sections.forEach((section, i) => {
            if (i === index) {
                section.classList.add('active');
                section.style.display = 'block';
            } else {
                section.classList.remove('active');
                section.style.display = 'none';
            }
        });
        this.currentSectionIndex = index;
        this.currentPageSpan.textContent = (index + 1).toString();
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('open');
        
        if (this.sidebar.classList.contains('open')) {
            this.settingsSidebar.classList.remove('open');
        }
    }
    
    prevPage() {
        if (this.viewMode === 'scroll') {
            if (this.currentChapterIndex > 0) {
                this.stopAllAudio();
                this.loadChapter(this.currentChapterIndex - 1);
            }
        } else {
            if (this.currentSectionIndex > 0) {
                this.showSection(this.currentSectionIndex - 1);
            } else if (this.currentChapterIndex > 0) {
                this.stopAllAudio();
                this.loadChapter(this.currentChapterIndex - 1);
            }
        }
    }
    
    nextPage() {
        if (this.viewMode === 'scroll') {
            if (this.currentChapterIndex < this.chapters.length - 1) {
                this.stopAllAudio();
                this.loadChapter(this.currentChapterIndex + 1);
            }
        } else {
            if (this.currentSectionIndex < this.sections.length - 1) {
                this.showSection(this.currentSectionIndex + 1);
            } else if (this.currentChapterIndex < this.chapters.length - 1) {
                this.stopAllAudio();
                this.loadChapter(this.currentChapterIndex + 1);
            }
        }
    }
    
    showDictionaryModal() {
        console.log('显示词典弹窗，选中文本:', this.selectedText);
        
        this.hideSelectionToolbar();
        
        // 不清除选择，保留选择状态
        // window.getSelection().removeAllRanges();
        
        this.dictionaryModal.classList.add('show');
        this.dictionaryOverlay.classList.add('show');
        this.dictionaryFooter.style.display = 'none';
        
        this.dictionaryContent.innerHTML = `
            <div class="loading">
                <div class="loader"></div>
                <p>查询 "${this.selectedText}"...</p>
            </div>
        `;
        
        // 保存当前选择范围，防止丢失
        this.saveCurrentSelection();
        
        this.fetchDictionaryData(this.selectedText)
            .then(result => {
                this.displayDictionaryResult(result);
                this.dictionaryFooter.style.display = 'block';
            })
            .catch(error => this.displayDictionaryError(error));
    }

    // 保存当前选择范围
    saveCurrentSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.savedSelectionRange = selection.getRangeAt(0).cloneRange();
        }
    }

    // 恢复选择范围
    restoreSelection() {
        if (this.savedSelectionRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedSelectionRange);
        }
    }
    
    async fetchDictionaryData(word) {
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            
            if (!response.ok) {
                throw new Error('未找到该词的释义');
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('词典API请求失败:', error);
            throw new Error('网络请求失败，请检查网络连接');
        }
    }
    
    displayDictionaryResult(data) {
        if (!data || data.length === 0) {
            this.dictionaryContent.innerHTML = `
                <div class="error">
                    <p>未找到"${this.selectedText}"的释义</p>
                </div>
            `;
            return;
        }
        
        const wordData = data[0];
        this.currentWordData = wordData;
        
        let html = `
            <div class="dictionary-result">
                <div class="dictionary-word">${wordData.word}</div>
        `;
        
        if (wordData.phonetic) {
            html += `<div class="phonetic">/${wordData.phonetic}/</div>`;
        }
        
        wordData.meanings.forEach(meaning => {
            html += `
                <div class="dictionary-definition">
                    <strong>${meaning.partOfSpeech}</strong><br>
            `;
            
            meaning.definitions.forEach((def, index) => {
                if (index < 3) {
                    html += `
                        <div style="margin: 8px 0;">
                            ${index + 1}. ${def.definition}
                    `;
                    if (def.example) {
                        html += `<div class="dictionary-example">例: ${def.example}</div>`;
                    }
                    html += `</div>`;
                }
            });
            
            html += `</div>`;
        });
        
        html += `</div>`;
        this.dictionaryContent.innerHTML = html;
    }
    
    displayDictionaryError(error) {
        this.dictionaryContent.innerHTML = `
            <div class="error">
                <p>查询失败: ${error.message}</p>
                <p>请检查网络连接或尝试其他单词</p>
            </div>
        `;
    }
    
    hideDictionaryModal() {
        this.dictionaryModal.classList.remove('show');
        this.dictionaryOverlay.classList.remove('show');
        this.dictionaryFooter.style.display = 'none';
        
        // 清除保存的选择范围
        this.savedSelectionRange = null;
        this.currentWordData = null;
        
        // 最终清除选择
        window.getSelection().removeAllRanges();
    }
    
    async safePlayAudio(audio) {
        try {
            await audio.play();
            return true;
        } catch (error) {
            console.warn('音频播放失败:', error);
            return false;
        }
    }
    
    stopAllAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶';
        this.clearHighlights();
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.epub')) {
            this.loadEPUB(file);
        }
    }
    
    async loadEPUB(file) {
        try {
            this.uploadArea.innerHTML = '<div class="loader"></div><p>正在解析EPUB文件...</p>';
            
            this.zip = await JSZip.loadAsync(file);
            await this.buildResourceMap();
            
            const containerContent = await this.getFileContent('META-INF/container.xml');
            const containerDoc = this.parseXML(containerContent);
            const rootfilePath = containerDoc.querySelector('rootfile').getAttribute('full-path');
            
            const opfContent = await this.getFileContent(rootfilePath);
            const opfDoc = this.parseXML(opfContent);
            
            const metadata = opfDoc.querySelector('metadata');
            const title = metadata.querySelector('dc\\:title, title')?.textContent || '未知标题';
            const creator = metadata.querySelector('dc\\:creator, creator')?.textContent || '未知作者';
            
            const manifest = this.parseManifest(opfDoc, rootfilePath);
            const readingOrder = this.parseSpine(opfDoc);
            
            this.chapters = await this.buildChapters(readingOrder, manifest, rootfilePath);
            
            if (this.chapters.length === 0) {
                throw new Error('未找到可读的章节内容');
            }
            
            this.currentBook = { title, author: creator };
            this.initializeBook();
            
        } catch (error) {
            console.error('加载EPUB文件失败:', error);
            this.uploadArea.innerHTML = `
                <div class="upload-icon">❌</div>
                <h3>加载失败</h3>
                <p>${error.message}</p>
                <button class="btn" onclick="location.reload()">重新上传</button>
            `;
        }
    }
    
    async buildResourceMap() {
        this.resourceMap.clear();
        const files = Object.keys(this.zip.files);
        
        console.log('EPUB文件列表:', files);
        
        for (const filePath of files) {
            if (!filePath.endsWith('/')) {
                try {
                    const file = this.zip.file(filePath);
                    if (file) {
                        const blob = await file.async('blob');
                        this.resourceMap.set(filePath, blob);
                        
                        // 添加标准化路径
                        const normalizedPath = filePath.replace(/^\.\//, '');
                        if (normalizedPath !== filePath) {
                            this.resourceMap.set(normalizedPath, blob);
                        }
                        
                        // 添加文件名作为键（用于搜索）
                        const fileName = filePath.split('/').pop();
                        if (fileName && !this.resourceMap.has(fileName)) {
                            this.resourceMap.set(fileName, blob);
                        }
                        
                        // 如果是音频文件，记录日志
                        if (filePath.match(/\.(mp3|wav|ogg|m4a)$/i)) {
                            console.log('找到音频文件:', filePath);
                        }
                    }
                } catch (e) {
                    console.warn(`无法加载资源: ${filePath}`, e);
                }
            }
        }
        
        console.log('资源映射构建完成，包含文件数量:', this.resourceMap.size);
    }
    
    async getFileContent(path) {
        const possiblePaths = [
            path,
            path.replace(/^\.\//, ''),
            './' + path,
            path.startsWith('/') ? path.substring(1) : path
        ];
        
        for (const tryPath of possiblePaths) {
            const file = this.zip.file(tryPath);
            if (file) {
                return await file.async('text');
            }
        }
        
        throw new Error(`文件不存在: ${path}`);
    }
    
    parseXML(content) {
        return new DOMParser().parseFromString(content, 'text/xml');
    }
    
    parseManifest(opfDoc, rootfilePath) {
        const manifest = {};
        const rootDir = rootfilePath.includes('/') 
            ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1)
            : '';
        
        const manifestItems = opfDoc.querySelectorAll('manifest item');
        manifestItems.forEach(item => {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            const mediaType = item.getAttribute('media-type');
            const mediaOverlay = item.getAttribute('media-overlay');
            
            let fullPath = href;
            if (rootDir && !href.startsWith('/') && !href.includes('://')) {
                fullPath = this.resolvePath(rootDir, href);
            }
            
            manifest[id] = {
                href: fullPath,
                mediaType,
                mediaOverlay
            };
        });
        
        return manifest;
    }
    
    resolvePath(base, relative) {
        if (relative.startsWith('/')) return relative.substring(1);
        
        const baseParts = base.split('/').filter(p => p);
        const relativeParts = relative.split('/').filter(p => p);
        
        for (const part of relativeParts) {
            if (part === '..') {
                baseParts.pop();
            } else if (part !== '.') {
                baseParts.push(part);
            }
        }
        
        return baseParts.join('/');
    }
    
    parseSpine(opfDoc) {
        const readingOrder = [];
        const spineItems = opfDoc.querySelectorAll('spine itemref');
        spineItems.forEach(item => {
            const idref = item.getAttribute('idref');
            readingOrder.push(idref);
        });
        return readingOrder;
    }
    
    async buildChapters(readingOrder, manifest, rootfilePath) {
        const chapters = [];
        
        for (const idref of readingOrder) {
            const item = manifest[idref];
            if (item && item.mediaType === 'application/xhtml+xml') {
                try {
                    const content = await this.loadHTMLContent(item.href);
                    const audioData = item.mediaOverlay 
                        ? await this.parseSMIL(manifest[item.mediaOverlay]?.href)
                        : null;
                    
                    const title = await this.extractChapterTitle(item.href) || `第${chapters.length + 1}章`;
                    
                    chapters.push({
                        id: idref,
                        title: title,
                        content: content,
                        audio: audioData,
                        basePath: this.getBasePath(item.href)
                    });
                } catch (e) {
                    console.warn(`无法加载章节: ${item.href}`, e);
                    chapters.push({
                        id: idref,
                        title: `第${chapters.length + 1}章`,
                        content: `<p>无法加载此章节: ${e.message}</p>`,
                        audio: null
                    });
                }
            }
        }
        
        return chapters;
    }
    
    async extractChapterTitle(href) {
        try {
            const content = await this.getFileContent(href);
            const doc = new DOMParser().parseFromString(content, 'text/html');
            const title = doc.querySelector('title')?.textContent || 
                         doc.querySelector('h1')?.textContent ||
                         doc.querySelector('h2')?.textContent;
            return title ? title.trim() : null;
        } catch (e) {
            return null;
        }
    }
    
    getBasePath(filePath) {
        return filePath.includes('/') 
            ? filePath.substring(0, filePath.lastIndexOf('/') + 1)
            : '';
    }
    
    async loadHTMLContent(href) {
        const content = await this.getFileContent(href);
        return this.processHTMLContent(content, this.getBasePath(href));
    }
    
    processHTMLContent(html, basePath) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        const images = doc.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('data:')) {
                const fullPath = this.resolvePath(basePath, src);
                const blob = this.resourceMap.get(fullPath);
                if (blob) {
                    const blobUrl = URL.createObjectURL(blob);
                    img.src = blobUrl;
                }
            }
        });
        
        const body = doc.body;
        body.classList.add('epub-content');
        
        return body.innerHTML;
    }
    
    handleDoubleClick(e) {
        console.log('双击事件:', e);
        
        this.stopAllAudio();
        
        if (!this.currentAudio || this.currentSMILData.length === 0) {
            console.log('没有音频或SMIL数据');
            return;
        }
        
        const targetElement = e.target;
        console.log('双击目标元素:', targetElement);
        
        let elementWithId = targetElement;
        while (elementWithId && !elementWithId.id && elementWithId.parentElement && elementWithId.parentElement !== this.pageContent) {
            elementWithId = elementWithId.parentElement;
        }
        
        const elementId = elementWithId.id;
        console.log('找到的元素ID:', elementId);
        
        if (!elementId) {
            console.log('元素没有ID');
            return;
        }
        
        const segment = this.currentSMILData.find(s => s.textId === elementId);
        console.log('找到的音频段:', segment);
        
        if (segment) {
            this.currentAudio.currentTime = segment.start;
            this.playAudio();
            
            this.clearHighlights();
            elementWithId.classList.add('highlight', 'active-highlight');
            this.currentHighlight = elementWithId;
            this.scrollToHighlight(elementWithId);
        } else {
            console.log('未找到对应的音频段');
        }
    }
    
    async parseSMIL(smilPath) {
        if (!smilPath) return null;
        
        try {
            const smilContent = await this.getFileContent(smilPath);
            const smilDoc = this.parseXML(smilContent);
            
            const audioElements = smilDoc.querySelectorAll('audio');
            if (audioElements.length > 0) {
                const audioSrc = audioElements[0].getAttribute('src');
                const basePath = this.getBasePath(smilPath);
                const fullAudioPath = this.resolvePath(basePath, audioSrc);
                
                const smilData = this.extractSMILData(smilDoc);
                
                return {
                    src: fullAudioPath,
                    smilData: smilData
                };
            }
        } catch (e) {
            console.warn('解析SMIL文件失败:', e);
        }
        
        return null;
    }
    
    extractSMILData(smilDoc) {
        const data = [];
        const pars = smilDoc.querySelectorAll('par');
        
        console.log('解析SMIL数据，找到段落数量:', pars.length);
        
        pars.forEach((par, index) => {
            const textElem = par.querySelector('text');
            const audioElem = par.querySelector('audio');
            
            if (textElem && audioElem) {
                const textSrc = textElem.getAttribute('src');
                const audioSrc = audioElem.getAttribute('src');
                const clipBegin = audioElem.getAttribute('clipBegin');
                const clipEnd = audioElem.getAttribute('clipEnd');
                
                if (textSrc) {
                    const textId = textSrc.includes('#') 
                        ? textSrc.split('#')[1] 
                        : textSrc;
                    
                    data.push({
                        textId: textId,
                        audioSrc: audioSrc,
                        start: this.parseTime(clipBegin),
                        end: this.parseTime(clipEnd),
                        index: index // 添加索引用于调试
                    });
                    
                    console.log(`SMIL段落 ${index}:`, {
                        textId: textId,
                        audioSrc: audioSrc,
                        timeRange: `${clipBegin} - ${clipEnd}`
                    });
                }
            }
        });
        
        data.sort((a, b) => a.start - b.start);
        console.log('SMIL数据解析完成，共', data.length, '个段落');
        return data;
    }
    
    parseTime(timeStr) {
        if (!timeStr) return 0;
        
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            if (parts.length === 3) {
                return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
            } else if (parts.length === 2) {
                return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
            }
        }
        
        return parseFloat(timeStr);
    }
    
    initializeBook() {
        this.uploadContainer.style.display = 'none';
        this.swipeContainer.style.display = 'block';
        this.pageContent.style.display = 'block';
        this.bookTitle.textContent = this.currentBook.title;
        this.bookAuthor.textContent = this.currentBook.author;
        this.totalPagesSpan.textContent = this.chapters.length;
        this.generateTOC();
        this.loadChapter(0);
    }
    
    generateTOC() {
        this.tocContainer.innerHTML = '';
        this.chapters.forEach((chapter, index) => {
            const tocItem = document.createElement('div');
            tocItem.className = 'toc-item';
            tocItem.textContent = chapter.title;
            tocItem.addEventListener('click', () => {
                this.stopAllAudio();
                this.loadChapter(index);
                if (window.innerWidth <= 768) {
                    this.toggleSidebar();
                }
            });
            this.tocContainer.appendChild(tocItem);
        });
    }
    
    bindDoubleClickEvents() {
        const oldElements = this.pageContent.querySelectorAll('[data-double-click]');
        oldElements.forEach(el => {
            el.removeEventListener('dblclick', this.handleDoubleClickBound);
        });
        
        const textElements = this.pageContent.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');
        console.log('找到的可双击元素数量:', textElements.length);
        
        this.handleDoubleClickBound = (e) => this.handleDoubleClick(e);
        
        textElements.forEach(element => {
            element.setAttribute('data-double-click', 'true');
            element.addEventListener('dblclick', this.handleDoubleClickBound);
        });
    }
    
    updateTOCHighlight() {
        const tocItems = document.querySelectorAll('.toc-item');
        tocItems.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentChapterIndex);
        });
    }
    
    async prepareAudioPlayer(chapter) {
        this.playerContainer.style.display = 'flex';
        
        if (!this.audioElements[chapter.id]) {
            try {
                const audioUrl = await this.createAudioFromZip(chapter.audio.src);
                console.log('创建音频URL:', audioUrl);
                
                const audio = new Audio(audioUrl);
                
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve);
                    audio.addEventListener('error', (e) => {
                        console.error('音频加载错误:', e);
                        reject(new Error(`音频加载失败: ${chapter.audio.src}`));
                    });
                    
                    // 超时处理
                    setTimeout(() => reject(new Error('音频加载超时')), 10000);
                });
                
                audio.addEventListener('timeupdate', () => {
                    this.updateProgress();
                    this.highlightCurrentText();
                });
                
                audio.addEventListener('loadedmetadata', () => {
                    console.log('音频时长:', audio.duration);
                    this.durationSpan.textContent = this.formatTime(audio.duration);
                });
                
                audio.addEventListener('ended', () => this.audioEnded());
                
                this.audioElements[chapter.id] = audio;
                this.currentAudio = audio;
                this.isAudioReady = true;
                
                console.log('音频播放器准备完成');
                
            } catch (error) {
                console.error('加载音频失败:', error);
                this.playerContainer.style.display = 'none';
                this.showToast('音频加载失败: ' + error.message);
                return;
            }
        } else {
            this.currentAudio = this.audioElements[chapter.id];
            this.isAudioReady = true;
        }
        
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶';
        this.progress.style.width = '0%';
        this.currentTimeSpan.textContent = '0:00';
        
        this.clearHighlights();
    }
    
    highlightCurrentText() {
        if (!this.currentAudio || this.currentSMILData.length === 0) return;
        
        const currentTime = this.currentAudio.currentTime;
        
        let currentSegment = null;
        for (const segment of this.currentSMILData) {
            if (currentTime >= segment.start && currentTime < segment.end) {
                currentSegment = segment;
                break;
            }
        }
        
        this.clearHighlights();
        
        if (currentSegment) {
            const element = document.getElementById(currentSegment.textId);
            if (element) {
                element.classList.add('highlight', 'active-highlight');
                this.currentHighlight = element;
                
                this.scrollToHighlight(element);
            }
        }
    }
    
    scrollToHighlight(element) {
        if (!element) return;
        
        const elementRect = element.getBoundingClientRect();
        const pageRect = this.pageContent.getBoundingClientRect();
        
        if (elementRect.top < pageRect.top || elementRect.bottom > pageRect.bottom) {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
        }
    }
    
    clearHighlights() {
        const highlights = this.pageContent.querySelectorAll('.highlight, .active-highlight');
        highlights.forEach(element => {
            element.classList.remove('highlight', 'active-highlight');
        });
        this.currentHighlight = null;
    }
    
    async createAudioFromZip(audioPath) {
        console.log('尝试创建音频URL，路径:', audioPath);
        
        const possiblePaths = this.generateAudioPaths(audioPath);
        
        for (const tryPath of possiblePaths) {
            const blob = this.resourceMap.get(tryPath);
            if (blob) {
                console.log('找到音频资源:', tryPath);
                return URL.createObjectURL(blob);
            }
        }
        
        // 如果没找到，尝试搜索文件名
        const fileName = audioPath.split('/').pop();
        if (fileName) {
            for (const [path, blob] of this.resourceMap.entries()) {
                if (path.includes(fileName)) {
                    console.log('通过文件名搜索找到音频:', path);
                    return URL.createObjectURL(blob);
                }
            }
        }
        
        console.error('音频文件不存在:', audioPath);
        console.log('可用的音频文件:', 
            Array.from(this.resourceMap.entries())
                .filter(([path, blob]) => path.match(/\.(mp3|wav|ogg|m4a)$/i))
                .map(([path]) => path)
        );
        
        throw new Error(`音频文件不存在: ${audioPath}`);
    }
    
    toggleAudio() {
        if (!this.currentAudio || !this.isAudioReady) return;
        this.isPlaying ? this.pauseAudio() : this.playAudio();
    }
    
    async playAudio() {
        if (!this.currentAudio || !this.isAudioReady) return;
        
        try {
            await this.safePlayAudio(this.currentAudio);
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸';
        } catch (error) {
            console.warn('播放失败:', error);
            this.isPlaying = false;
            this.playPauseBtn.textContent = '▶';
        }
    }
    
    pauseAudio() {
        if (!this.currentAudio) return;
        this.currentAudio.pause();
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶';
        this.clearHighlights();
    }
    
    togglePlayPause() {
        this.isPlaying ? this.pauseAudio() : this.playAudio();
    }
    
    updateProgress() {
        if (!this.currentAudio) return;
        const progress = (this.currentAudio.currentTime / this.currentAudio.duration) * 100;
        this.progress.style.width = `${progress}%`;
        this.currentTimeSpan.textContent = this.formatTime(this.currentAudio.currentTime);
    }
    
    seekAudio(e) {
        if (!this.currentAudio) return;
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.currentAudio.currentTime = percent * this.currentAudio.duration;
        
        this.highlightCurrentText();
    }
    
    changePlaybackRate(rate) {
        if (this.currentAudio) {
            this.currentAudio.playbackRate = parseFloat(rate);
        }
    }
    
    audioEnded() {
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶';
        this.progress.style.width = '0%';
        this.currentTimeSpan.textContent = '0:00';
        this.clearHighlights();
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    prevChapter() {
        if (this.currentChapterIndex > 0) {
            this.stopAllAudio();
            this.loadChapter(this.currentChapterIndex - 1);
        }
    }
    
    nextChapter() {
        if (this.currentChapterIndex < this.chapters.length - 1) {
            this.stopAllAudio();
            this.loadChapter(this.currentChapterIndex + 1);
        }
    }
}

// 初始化阅读器
document.addEventListener('DOMContentLoaded', () => {
    window.reader = new EPUBReader();
});