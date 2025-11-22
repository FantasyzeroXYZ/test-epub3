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
        this.viewMode = 'scroll'; // 'scroll' 或 'paged'
        this.currentSectionIndex = 0;
        this.sections = [];
        this.selectionToolbar = null;
        this.lookupWordBtn = null;
        this.selectedText = '';
        this.selectionTimeout = null;
        this.touchStartTime = 0;
        this.currentWordData = null;
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

    // 设置相关方法
    toggleSettings() {
        this.settingsSidebar.classList.toggle('open');
        
        // 如果打开设置，关闭目录
        if (this.settingsSidebar.classList.contains('open')) {
            this.sidebar.classList.remove('open');
        }
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('epubReaderSettings') || '{}');
        
        // 应用设置到控件
        this.viewModeSelect.value = settings.viewMode || 'scroll';
        this.autoScroll.checked = settings.autoScroll || false;
        this.fontSize.value = settings.fontSize || 'medium';
        this.theme.value = settings.theme || 'light';
        this.autoPlay.checked = settings.autoPlay !== false; // 默认开启
        this.speechRate.value = settings.speechRate || '1';
        this.offlineMode.checked = settings.offlineMode || false;
        this.syncProgress.checked = settings.syncProgress !== false; // 默认开启
        
        // 应用设置到界面
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

    // Anki设置相关方法
    loadAnkiSettings() {
        const settings = JSON.parse(localStorage.getItem('epubReaderAnkiSettings') || '{}');
        this.ankiSettings = { ...this.ankiSettings, ...settings };
        
        // 应用到控件
        this.ankiHost.value = this.ankiSettings.host;
        this.ankiPort.value = this.ankiSettings.port;
        this.ankiDeck.value = this.ankiSettings.deck;
        this.ankiModel.value = this.ankiSettings.model;
        
        // 如果已设置连接信息，自动测试连接并加载数据
        if (this.ankiSettings.host && this.ankiSettings.port) {
            // 延迟执行，确保UI先加载完成
            setTimeout(() => {
                this.testAnkiConnection().then(() => {
                    // 连接成功后恢复字段选择
                    this.restoreFieldSelections();
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
            const result = await this.ankiRequest('version', {});
            if (result) {
                this.showToast(`Anki连接成功，版本: ${result}`);
                // 连接成功后自动加载牌组
                await this.loadAnkiDecks();
            }
        } catch (error) {
            this.showToast('Anki连接失败，请检查AnkiConnect插件');
            console.error('Anki连接错误:', error);
        }
    }

    async loadAnkiDecks() {
        try {
            const decks = await this.ankiRequest('deckNames', {});
            console.log('加载到的牌组:', decks);
            
            this.ankiDeck.innerHTML = '<option value="">选择牌组</option>';
            decks.forEach(deck => {
                const option = document.createElement('option');
                option.value = deck;
                option.textContent = deck;
                this.ankiDeck.appendChild(option);
            });
            
            // 如果有保存的牌组设置，自动选择
            if (this.ankiSettings.deck) {
                this.ankiDeck.value = this.ankiSettings.deck;
            }
            
            // 牌组选择变化时加载模板
            this.ankiDeck.addEventListener('change', () => {
                if (this.ankiDeck.value) {
                    this.loadAnkiModels();
                } else {
                    this.clearAnkiModelAndFields();
                }
            });
            
        } catch (error) {
            console.error('加载牌组失败:', error);
            this.showToast('加载牌组失败');
        }
    }

    async loadAnkiModels() {
        try {
            const models = await this.ankiRequest('modelNames', {});
            console.log('加载到的模板:', models);
            
            this.ankiModel.innerHTML = '<option value="">选择模板</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                this.ankiModel.appendChild(option);
            });
            
            // 如果有保存的模板设置，自动选择
            if (this.ankiSettings.model) {
                this.ankiModel.value = this.ankiSettings.model;
            }
            
            // 模板选择变化时加载字段
            this.ankiModel.addEventListener('change', () => {
                if (this.ankiModel.value) {
                    this.loadAnkiFields();
                } else {
                    this.clearAnkiFields();
                }
            });
            
            // 如果当前已选择模板，立即加载字段
            if (this.ankiModel.value) {
                await this.loadAnkiFields();
            }
            
        } catch (error) {
            console.error('加载模板失败:', error);
            this.showToast('加载模板失败');
        }
    }

    async loadAnkiFields() {
        try {
            if (!this.ankiModel.value) {
                this.clearAnkiFields();
                return;
            }
            
            const fields = await this.ankiRequest('modelFieldNames', { 
                modelName: this.ankiModel.value 
            });
            
            console.log('加载到的字段:', fields);
            
            this.clearAnkiFields();
            
            // 为所有字段选择框填充选项
            fields.forEach(field => {
                this.addFieldOption(this.ankiWordField, field);
                this.addFieldOption(this.ankiMeaningField, field);
                this.addFieldOption(this.ankiSentenceField, field);
                this.addFieldOption(this.ankiAudioField, field);
                this.addFieldOption(this.ankiTagsField, field);
            });
            
            // 恢复保存的字段设置
            this.restoreFieldSelections();
            
        } catch (error) {
            console.error('加载字段失败:', error);
            this.showToast('加载字段失败');
            this.clearAnkiFields();
        }
    }

    // 辅助方法：添加字段选项
    addFieldOption(selectElement, fieldName) {
        const option = document.createElement('option');
        option.value = fieldName;
        option.textContent = fieldName;
        selectElement.appendChild(option);
    }

    // 辅助方法：清空模板和字段
    clearAnkiModelAndFields() {
        this.ankiModel.innerHTML = '<option value="">选择模板</option>';
        this.clearAnkiFields();
    }

    // 辅助方法：清空所有字段选择框
    clearAnkiFields() {
        const fields = [
            this.ankiWordField,
            this.ankiMeaningField,
            this.ankiSentenceField,
            this.ankiAudioField,
            this.ankiTagsField
        ];
        
        fields.forEach(field => {
            field.innerHTML = '<option value="">选择字段</option>';
        });
    }

    // 辅助方法：恢复字段选择
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

    async ankiRequest(action, params) {
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
        if (!this.currentWordData || !this.selectedText) {
            this.showToast('没有可添加的单词数据');
            return;
        }

        if (!this.ankiSettings.deck || !this.ankiSettings.model) {
            this.showToast('请先配置Anki牌组和模板');
            return;
        }

        try {
            // 构建笔记数据
            const fields = {};
            
            if (this.ankiSettings.wordField) {
                fields[this.ankiSettings.wordField] = this.selectedText;
            }
            
            if (this.ankiSettings.meaningField && this.currentWordData.meanings) {
                const meaning = this.currentWordData.meanings[0];
                if (meaning) {
                    fields[this.ankiSettings.meaningField] = meaning.definitions[0]?.definition || '';
                }
            }
            
            if (this.ankiSettings.sentenceField) {
                // 这里可以获取当前句子，简化实现使用选中文本
                fields[this.ankiSettings.sentenceField] = this.selectedText;
            }
            
            if (this.ankiSettings.tagsField) {
                fields[this.ankiSettings.tagsField] = 'epub-reader';
            }
            
            const note = {
                deckName: this.ankiSettings.deck,
                modelName: this.ankiSettings.model,
                fields: fields,
                tags: ['epub-reader']
            };
            
            const result = await this.ankiRequest('addNote', { note });
            
            if (result) {
                this.showToast('单词已添加到Anki');
                this.hideDictionaryModal();
            } else {
                this.showToast('添加失败，请检查字段映射');
            }
            
        } catch (error) {
            console.error('添加Anki笔记失败:', error);
            this.showToast('添加失败: ' + error.message);
        }
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
        
        // 更新页面内容的字体大小
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
        // 导出阅读数据
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
            // 可以添加更多清理逻辑
            this.showToast('缓存数据已清除');
            location.reload(); // 重新加载页面应用默认设置
        }
    }

    // 文本选择事件绑定
    bindSelectionEvents() {
        // 点击页面其他地方隐藏工具栏
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

        // 文本选择变化事件
        document.addEventListener('selectionchange', () => {
            this.handleSelectionChange();
        });

        // 阻止阅读区域的长按默认行为
        const preventContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };

        // 为阅读区域添加事件监听器
        this.readerContent = document.querySelector('.reader-content');
        if (this.readerContent) {
            this.readerContent.addEventListener('contextmenu', preventContextMenu);
            this.readerContent.addEventListener('touchstart', (e) => {
                // 标记触摸开始，用于后续处理
                this.touchStartTime = Date.now();
            });
            
            this.readerContent.addEventListener('touchend', (e) => {
                // 处理长按后的选择
                const touchDuration = Date.now() - this.touchStartTime;
                if (touchDuration > 500) {
                    setTimeout(() => {
                        this.handleSelectionChange();
                    }, 100);
                }
            });
        }

        // 全局阻止长按默认行为
        document.addEventListener('contextmenu', (e) => {
            // 只在阅读区域允许文本选择
            if (e.target.closest('.reader-content') || 
                e.target.closest('.page-content') ||
                e.target.closest('.page-section')) {
                // 在阅读区域内，允许选择但阻止默认工具栏
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });

        // 触摸结束事件 - 用于移动端
        document.addEventListener('touchend', (e) => {
            // 延迟处理，确保文本选择完成
            setTimeout(() => {
                this.handleSelectionChange(e);
            }, 100);
        });

        // 鼠标弹起事件 - 用于桌面端
        document.addEventListener('mouseup', (e) => {
            this.handleSelectionChange(e);
        });
    }

    // 选择变化处理方法
    handleSelectionChange(e) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        console.log('选中的文本:', selectedText, '长度:', selectedText.length);
        
        // 清除之前的定时器
        if (this.selectionTimeout) {
            clearTimeout(this.selectionTimeout);
        }
        
        if (selectedText.length > 0 && selectedText.length < 100) {
            this.selectedText = selectedText;
            
            // 延迟显示工具栏，确保选择完成
            this.selectionTimeout = setTimeout(() => {
                this.showSelectionToolbar(selection);
                
                // 在安卓端，主动清除选择以防止原生工具栏出现
                if (/Android/i.test(navigator.userAgent)) {
                    setTimeout(() => {
                        // 不清除选择，因为我们想要显示自定义工具栏
                        // 但阻止默认行为
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
        
        // 计算工具栏位置（在选择文本上方）
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        const toolbarX = rect.left + rect.width / 2 + scrollX;
        const toolbarY = rect.top + scrollY;
        
        // 确保工具栏在可视区域内
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const toolbarRect = this.selectionToolbar.getBoundingClientRect();
        
        let finalX = toolbarX - toolbarRect.width / 2;
        let finalY = toolbarY - toolbarRect.height - 10;
        
        // 边界检查 - 防止超出屏幕
        if (finalX < 10) finalX = 10;
        if (finalX + toolbarRect.width > viewportWidth - 10) {
            finalX = viewportWidth - toolbarRect.width - 10;
        }
        
        // 如果上方空间不够，显示在选中文本下方
        if (finalY < 10) {
            finalY = toolbarY + rect.height + 10;
        }
        
        // 确保工具栏不会超出屏幕底部
        if (finalY + toolbarRect.height > viewportHeight - 10) {
            finalY = viewportHeight - toolbarRect.height - 10;
        }
        
        // 应用位置
        this.selectionToolbar.style.left = finalX + 'px';
        this.selectionToolbar.style.top = finalY + 'px';
        this.selectionToolbar.style.transform = 'translateY(-110%)';
        
        this.selectionToolbar.classList.add('show');
        
        console.log('显示自定义工具栏，选中文本:', this.selectedText, '位置:', finalX, finalY);
        
        // 在安卓端，额外阻止默认行为
        if (/Android/i.test(navigator.userAgent)) {
            document.addEventListener('contextmenu', this.preventAndroidToolbar, { once: true });
        }
    }

    // 专门阻止安卓工具栏的方法
    preventAndroidToolbar(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    // 工具栏按钮功能
    lookupWord() {
        if (!this.selectedText) return;
        
        this.hideSelectionToolbar();
        this.showDictionaryModal();
        
        // 清除选择
        window.getSelection().removeAllRanges();
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
            // 降级方案
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
            // 降级处理
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
        
        // 重新加载当前章节
        if (this.currentChapterIndex !== undefined && this.chapters.length > 0) {
            this.loadChapter(this.currentChapterIndex);
        }
    }

    loadChapter(index) {
        if (index < 0 || index >= this.chapters.length) return;
        
        this.currentChapterIndex = index;
        const chapter = this.chapters[index];
        
        if (this.viewMode === 'scroll') {
            // 滚动模式 - 显示完整章节内容
            this.pageContent.innerHTML = chapter.content;
            this.pageContent.className = 'page-content scroll-mode';
            this.currentPageSpan.textContent = (index + 1).toString();
            this.totalPagesSpan.textContent = this.chapters.length;
        } else {
            // 分页模式 - 将章节内容分割成多个页面
            this.splitChapterIntoPages(chapter.content);
            this.pageContent.className = 'page-content paged-mode';
            this.currentPageSpan.textContent = '1';
            this.totalPagesSpan.textContent = this.sections.length;
        }
        
        this.updateTOCHighlight();
        
        this.currentSMILData = chapter.audio ? chapter.audio.smilData || [] : [];
        this.bindDoubleClickEvents();
        
        // 重新绑定选择事件到新内容
        this.bindSelectionEventsToNewContent();
        
        if (chapter.audio && chapter.audio.src) {
            this.prepareAudioPlayer(chapter);
        } else {
            this.playerContainer.style.display = 'none';
        }
        
        this.pageContent.scrollTop = 0;
    }

    // 为新加载的内容绑定选择事件
    bindSelectionEventsToNewContent() {
        const contentElements = this.pageContent.querySelectorAll('p, span, div, li, h1, h2, h3, h4, h5, h6');
        
        contentElements.forEach(element => {
            // 阻止长按默认行为
            element.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            });
            
            // 触摸事件处理
            element.addEventListener('touchstart', (e) => {
                this.touchStartTime = Date.now();
            });
            
            element.addEventListener('touchend', (e) => {
                const touchDuration = Date.now() - this.touchStartTime;
                if (touchDuration > 400) { // 长按
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
        
        // 获取阅读区域尺寸
        const container = this.pageContent;
        const containerHeight = container.offsetHeight - 40; // 减去padding
        const containerWidth = container.offsetWidth - 40;
        
        this.sections = [];
        
        // 简单分页：按段落分割
        const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, blockquote, pre, ul, ol, li');
        
        if (elements.length === 0) {
            // 如果没有找到段落元素，直接使用原始内容
            this.sections.push(content);
        } else {
            let currentPage = [];
            let currentHeight = 0;
            
            for (let element of elements) {
                // 估算元素高度
                const elementHeight = this.simpleEstimateHeight(element, containerWidth);
                
                // 如果当前页已经有内容且加上这个元素会超出，就创建新页
                if (currentHeight > 0 && currentHeight + elementHeight > containerHeight) {
                    this.sections.push(currentPage.map(el => el.outerHTML).join(''));
                    currentPage = [];
                    currentHeight = 0;
                }
                
                currentPage.push(element.cloneNode(true));
                currentHeight += elementHeight;
                
                // 如果单个元素就超过页面高度，强制分页
                if (elementHeight > containerHeight && currentPage.length > 1) {
                    const lastElement = currentPage.pop();
                    this.sections.push(currentPage.map(el => el.outerHTML).join(''));
                    currentPage = [lastElement];
                    currentHeight = elementHeight;
                }
            }
            
            // 添加最后一页
            if (currentPage.length > 0) {
                this.sections.push(currentPage.map(el => el.outerHTML).join(''));
            }
        }
        
        // 如果分页失败，回退到单页显示
        if (this.sections.length === 0) {
            this.sections.push(content);
        }
        
        console.log('分页结果:', this.sections.length, '页');
        
        // 显示分页内容
        this.renderPagedContent();
        this.currentSectionIndex = 0;
        this.showSection(0);
    }

    simpleEstimateHeight(element, containerWidth) {
        // 创建临时元素来测量高度
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
        
        // 添加一些边距
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
        
        // 如果打开目录，关闭设置
        if (this.sidebar.classList.contains('open')) {
            this.settingsSidebar.classList.remove('open');
        }
    }
    
    prevPage() {
        if (this.viewMode === 'scroll') {
            // 滚动模式 - 切换到上一章
            if (this.currentChapterIndex > 0) {
                this.stopAllAudio();
                this.loadChapter(this.currentChapterIndex - 1);
            }
        } else {
            // 分页模式 - 切换到上一页或上一章
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
            // 滚动模式 - 切换到下一章
            if (this.currentChapterIndex < this.chapters.length - 1) {
                this.stopAllAudio();
                this.loadChapter(this.currentChapterIndex + 1);
            }
        } else {
            // 分页模式 - 切换到下一页或下一章
            if (this.currentSectionIndex < this.sections.length - 1) {
                this.showSection(this.currentSectionIndex + 1);
            } else if (this.currentChapterIndex < this.chapters.length - 1) {
                this.stopAllAudio();
                this.loadChapter(this.currentChapterIndex + 1);
            }
        }
    }
    
    showDictionaryModal() {
        console.log('显示词典弹窗:', this.selectedText);
        
        this.hideSelectionToolbar();
        
        // 清除文本选择
        window.getSelection().removeAllRanges();
        
        this.dictionaryModal.classList.add('show');
        this.dictionaryOverlay.classList.add('show');
        this.dictionaryFooter.style.display = 'none';
        
        // 显示加载状态
        this.dictionaryContent.innerHTML = `
            <div class="loading">
                <div class="loader"></div>
                <p>查询 "${this.selectedText}"...</p>
            </div>
        `;
        
        // 查询词典
        this.fetchDictionaryData(this.selectedText)
            .then(result => {
                this.displayDictionaryResult(result);
                this.dictionaryFooter.style.display = 'block';
            })
            .catch(error => this.displayDictionaryError(error));
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
        window.getSelection().removeAllRanges();
        this.currentWordData = null;
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
        
        for (const filePath of files) {
            if (!filePath.endsWith('/')) {
                try {
                    const file = this.zip.file(filePath);
                    if (file) {
                        const blob = await file.async('blob');
                        this.resourceMap.set(filePath, blob);
                        const normalizedPath = filePath.replace(/^\.\//, '');
                        if (normalizedPath !== filePath) {
                            this.resourceMap.set(normalizedPath, blob);
                        }
                    }
                } catch (e) {
                    console.warn(`无法加载资源: ${filePath}`, e);
                }
            }
        }
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
                    
                    // 获取章节标题
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
        
        // 添加自适应样式类
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
        
        pars.forEach(par => {
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
                        end: this.parseTime(clipEnd)
                    });
                }
            }
        });
        
        data.sort((a, b) => a.start - b.start);
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
                const audio = new Audio(audioUrl);
                
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', resolve);
                    audio.addEventListener('error', reject);
                });
                
                audio.addEventListener('timeupdate', () => {
                    this.updateProgress();
                    this.highlightCurrentText();
                });
                
                audio.addEventListener('loadedmetadata', () => {
                    this.durationSpan.textContent = this.formatTime(audio.duration);
                });
                
                audio.addEventListener('ended', () => this.audioEnded());
                
                this.audioElements[chapter.id] = audio;
                this.currentAudio = audio;
                this.isAudioReady = true;
            } catch (error) {
                console.error('加载音频失败:', error);
                this.playerContainer.style.display = 'none';
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
        const possiblePaths = [
            audioPath,
            audioPath.replace(/^\.\//, ''),
            './' + audioPath,
            audioPath.startsWith('/') ? audioPath.substring(1) : audioPath
        ];
        
        for (const tryPath of possiblePaths) {
            const blob = this.resourceMap.get(tryPath);
            if (blob) {
                return URL.createObjectURL(blob);
            }
        }
        
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