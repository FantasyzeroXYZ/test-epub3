/**
 * EPUB 文件解析器 - 负责解析 EPUB 文件结构和内容
 * 扩展支持 EPUB3 音频和媒体覆盖
 */
class EPUBParser {
    constructor() {
        this.currentZip = null;
        this.manifest = new Map();
        this.sections = [];
        this.toc = [];
        this.audioData = new Map(); // 存储音频数据
        this.smilData = new Map(); // 存储SMIL同步数据
    }

    /**
     * 解析 EPUB 文件
     */
    async parse(arrayBuffer) {
        this.currentZip = await JSZip.loadAsync(arrayBuffer);
        
        const containerXml = await this.currentZip.file('META-INF/container.xml').async('text');
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, 'text/xml');
        const rootfile = containerDoc.querySelector('rootfile');
        const contentPath = rootfile.getAttribute('full-path');
        
        const contentOpf = await this.currentZip.file(contentPath).async('text');
        const contentDoc = parser.parseFromString(contentOpf, 'text/xml');
        
        const basePath = contentPath.split('/').slice(0, -1).join('/');
        const normalizedBasePath = basePath ? basePath + '/' : '';
        
        await this.parseManifest(contentDoc, normalizedBasePath);
        await this.parseSpine(contentDoc, normalizedBasePath);
        await this.parseTOC(contentDoc, normalizedBasePath);
        
        // 解析媒体覆盖和音频数据
        await this.parseMediaOverlays(contentDoc, normalizedBasePath);
        
        return {
            manifest: this.manifest,
            sections: this.sections,
            toc: this.toc,
            basePath: normalizedBasePath,
            audioData: this.audioData,
            smilData: this.smilData
        };
    }

    /**
     * 解析 EPUB 清单文件
     */
    async parseManifest(contentDoc, basePath) {
        const manifestItems = contentDoc.querySelectorAll('manifest item');
        this.manifest = new Map();

        for (const item of manifestItems) {
            const id = item.getAttribute('id');
            const href = item.getAttribute('href');
            const mediaType = item.getAttribute('media-type');
            const mediaOverlay = item.getAttribute('media-overlay');
            
            const decodedHref = decodeURIComponent(href);
            const fullPath = basePath + decodedHref;
            
            this.manifest.set(id, {
                href: fullPath,
                mediaType: mediaType,
                originalHref: href,
                mediaOverlay: mediaOverlay
            });
        }
    }

    /**
     * 解析 EPUB 脊柱 - 修复音频关联时序
     */
    async parseSpine(contentDoc, basePath) {
        const spine = contentDoc.querySelector('spine');
        const itemrefs = spine.querySelectorAll('itemref');
        
        this.sections = [];
        
        for (const itemref of itemrefs) {
            const idref = itemref.getAttribute('idref');
            const item = this.manifest.get(idref);
            
            if (item && (item.mediaType === 'application/xhtml+xml' || 
                        item.mediaType === 'text/html' ||
                        item.href.endsWith('.xhtml') || 
                        item.href.endsWith('.html'))) {
                
                // 先创建基础section，音频数据在parseMediaOverlays中关联
                this.sections.push(item);
            }
        }
        
        console.log('解析脊柱完成，章节数量:', this.sections.length);
    }


    /**
     * 处理多HTML文件章节
     */
    processMultiHTMLChapter(item, idref) {
        // 添加媒体覆盖信息
        if (item.mediaOverlay) {
            const overlayItem = this.manifest.get(item.mediaOverlay);
            if (overlayItem) {
                item.mediaOverlayData = overlayItem;
                
                // 直接关联音频数据
                const smilData = this.smilData.get(overlayItem.href);
                if (smilData) {
                    item.audio = smilData;
                    console.log(`章节 ${idref} 关联音频数据:`, smilData.audioSrc);
                } else {
                    console.warn(`章节 ${idref} 未找到对应的SMIL数据:`, overlayItem.href);
                    // 尝试其他方式查找SMIL数据
                    this.tryFindSmilData(item);
                }
            } else {
                console.warn(`章节 ${idref} 的媒体覆盖项未找到:`, item.mediaOverlay);
                // 尝试通过文件名查找音频
                this.tryFindAudioByFilename(item);
            }
        } else {
            console.log(`章节 ${idref} 没有媒体覆盖属性`);
            // 尝试通过文件名查找音频
            this.tryFindAudioByFilename(item);
        }
        
        this.sections.push(item);
    }

    /**
     * 尝试通过其他方式查找SMIL数据
     */
    tryFindSmilData(section) {
        // 尝试通过章节文件名匹配SMIL文件
        const chapterName = section.href.split('/').pop().replace('.html', '').replace('.xhtml', '');
        
        console.log('尝试查找SMIL数据:', chapterName);
        
        for (const [smilPath, smilData] of this.smilData.entries()) {
            const smilName = smilPath.split('/').pop().replace('.smil', '');
            
            if (smilPath.includes(chapterName) || chapterName.includes(smilName)) {
                section.audio = smilData;
                console.log(`通过文件名匹配找到SMIL数据: ${section.href} -> ${smilData.audioSrc}`);
                return true;
            }
        }
        
        // 如果没有找到，尝试基于数字匹配
        const chapterNumber = chapterName.match(/\d+/);
        if (chapterNumber) {
            for (const [smilPath, smilData] of this.smilData.entries()) {
                if (smilPath.includes(chapterNumber[0])) {
                    section.audio = smilData;
                    console.log(`通过数字匹配找到SMIL数据: ${section.href} -> ${smilData.audioSrc}`);
                    return true;
                }
            }
        }
        
        console.log(`未找到章节 ${chapterName} 的SMIL数据`);
        return false;
    }

    /**
     * 尝试通过文件名匹配查找音频
     */
    tryFindAudioByFilename(section) {
        const chapterName = section.href.split('/').pop().replace('.html', '').replace('.xhtml', '');
        
        console.log('尝试通过文件名匹配音频:', chapterName);
        
        // 查找对应的SMIL文件
        for (const [smilPath, smilData] of this.smilData.entries()) {
            const smilName = smilPath.split('/').pop().replace('.smil', '');
            
            if (smilPath.includes(chapterName) || chapterName.includes(smilName)) {
                section.audio = smilData;
                console.log(`通过文件名匹配找到音频: ${section.href} -> ${smilData.audioSrc}`);
                return true;
            }
        }
        
        // 如果没有找到，尝试基于数字匹配
        const chapterNumber = chapterName.match(/\d+/);
        if (chapterNumber) {
            for (const [smilPath, smilData] of this.smilData.entries()) {
                if (smilPath.includes(chapterNumber[0])) {
                    section.audio = smilData;
                    console.log(`通过数字匹配找到音频: ${section.href} -> ${smilData.audioSrc}`);
                    return true;
                }
            }
        }
        
        console.log(`未找到章节 ${chapterName} 的音频文件`);
        return false;
    }


    /**
     * 处理单个HTML文件中的多个章节
     */
    async processSingleHTMLChapter(item, idref) {
        // 如果是第一个HTML文件，解析其中的章节结构
        if (this.sections.length === 0) {
            try {
                const content = await this.currentZip.file(item.href).async('text');
                const chapters = this.extractChaptersFromSingleHTML(content, item.href);
                
                // 为每个章节创建虚拟section
                chapters.forEach((chapter, index) => {
                    const virtualSection = {
                        ...item,
                        href: item.href,
                        virtualChapter: true,
                        chapterId: chapter.id,
                        chapterTitle: chapter.title,
                        startElement: chapter.startElement,
                        endElement: chapter.endElement,
                        originalId: idref + '_' + index
                    };
                    
                    // 关联音频数据
                    this.associateAudioWithChapter(virtualSection, chapter.id);
                    
                    this.sections.push(virtualSection);
                });
                
                console.log(`在单个HTML中创建了 ${chapters.length} 个虚拟章节`);
            } catch (error) {
                console.error('处理单个HTML章节失败:', error);
                // 如果失败，回退到普通处理
                this.processMultiHTMLChapter(item, idref);
            }
        }
    }

    /**
     * 为章节关联音频数据
     */
    associateAudioWithChapter(section, chapterId) {
        console.log(`为章节 ${chapterId} 关联音频数据`);
        
        // 查找匹配的SMIL数据
        for (const [smilPath, smilData] of this.smilData.entries()) {
            if (smilPath.includes(chapterId) || this.doesSmilMatchChapter(smilData, chapterId)) {
                section.audio = smilData;
                console.log(`章节 ${chapterId} 关联音频: ${smilData.audioSrc}`);
                return true;
            }
        }
        
        // 如果没有精确匹配，尝试基于文件名匹配
        const chapterNumber = chapterId.match(/\d+/);
        if (chapterNumber) {
            for (const [smilPath, smilData] of this.smilData.entries()) {
                if (smilPath.includes(chapterNumber[0])) {
                    section.audio = smilData;
                    console.log(`通过数字匹配章节 ${chapterId} -> 音频: ${smilData.audioSrc}`);
                    return true;
                }
            }
        }
        
        // 尝试通用匹配
        if (this.tryFindAudioByFilename(section)) {
            return true;
        }
        
        console.log(`未找到章节 ${chapterId} 的音频数据`);
        return false;
    }

    /**
     * 检查SMIL数据是否匹配章节
     */
    doesSmilMatchChapter(smilData, chapterId) {
        // 检查SMIL中的文本元素是否包含章节ID
        if (smilData.syncData && smilData.syncData.length > 0) {
            const firstSync = smilData.syncData[0];
            return firstSync.textId && firstSync.textId.includes(chapterId);
        }
        return false;
    }

    /**
     * 从单个HTML中提取章节结构
     */
    extractChaptersFromSingleHTML(content, baseHref) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const chapters = [];
        
        // 查找所有可能的章节标记
        // 1. 通过标题标签 (h1, h2, h3)
        const headings = doc.querySelectorAll('h1, h2, h3, h4, [class*="chapter"], [id*="chapter"]');
        
        // 2. 通过特定的类名或ID模式
        const chapterElements = doc.querySelectorAll('[id^="chapter"], [class*="chapter"]');
        
        console.log('在单个HTML中找到的章节标记:', {
            headings: headings.length,
            chapterElements: chapterElements.length
        });
        
        // 处理标题作为章节分隔
        Array.from(headings).forEach((heading, index) => {
            const id = heading.id || `chapter-${index + 1}`;
            const title = heading.textContent.trim();
            
            chapters.push({
                id: id,
                title: title,
                startElement: heading,
                level: heading.tagName
            });
            
            console.log(`发现章节: ${title} (ID: ${id})`);
        });
        
        // 如果没有找到章节标记，创建默认章节
        if (chapters.length === 0) {
            console.log('未找到章节标记，创建默认章节');
            chapters.push({
                id: 'default-chapter',
                title: '全文',
                startElement: doc.body.firstElementChild,
                level: 'h1'
            });
        }
        
        return chapters;
    }

    /**
     * 解析媒体覆盖和音频数据 - 修复关联逻辑
     */
    async parseMediaOverlays(contentDoc, basePath) {
        try {
            console.log('开始解析媒体覆盖...');
            
            // 查找所有SMIL文件（媒体覆盖）
            const smilItems = Array.from(this.manifest.entries())
                .filter(([id, item]) => item.mediaType === 'application/smil+xml');
            
            console.log('找到SMIL文件:', smilItems.length);
            
            for (const [id, item] of smilItems) {
                await this.parseSMILFile(item.href, basePath);
            }
            
            // 关联章节和音频数据 - 修复关联逻辑
            console.log('开始关联章节和音频数据...');
            let audioCount = 0;
            
            for (const section of this.sections) {
                if (section.mediaOverlay) {
                    const overlayItem = this.manifest.get(section.mediaOverlay);
                    if (overlayItem) {
                        const smilData = this.smilData.get(overlayItem.href);
                        if (smilData) {
                            section.audio = smilData;
                            audioCount++;
                            console.log(`关联成功: ${section.href} -> ${smilData.audioSrc}`);
                        } else {
                            console.warn(`未找到SMIL数据: ${overlayItem.href}`);
                        }
                    }
                }
            }
            
            console.log(`音频数据关联完成: ${audioCount}/${this.sections.length} 个章节有音频`);
            
        } catch (error) {
            console.warn('解析媒体覆盖失败:', error);
        }
    }

    /**
     * 解析SMIL文件 - 修复路径解析
     */
    async parseSMILFile(smilPath, basePath) {
        try {
            console.log('解析SMIL文件:', smilPath);
            const smilContent = await this.currentZip.file(smilPath).async('text');
            const parser = new DOMParser();
            const smilDoc = parser.parseFromString(smilContent, 'text/xml');
            
            const audioElements = smilDoc.querySelectorAll('audio');
            if (audioElements.length === 0) {
                console.warn('SMIL文件中没有音频元素:', smilPath);
                return;
            }
            
            // 获取音频文件路径 - 修复路径解析
            const firstAudio = audioElements[0];
            const audioSrc = firstAudio.getAttribute('src');
            
            if (!audioSrc) {
                console.warn('SMIL文件中音频元素没有src属性:', smilPath);
                return;
            }
            
            // 正确解析音频路径
            const fullAudioPath = this.resolveAudioPath(smilPath, audioSrc);
            console.log('解析音频路径:', { smilPath, audioSrc, fullAudioPath });
            
            // 解析文本-音频同步数据
            const syncData = this.extractSyncData(smilDoc);
            
            this.smilData.set(smilPath, {
                audioSrc: fullAudioPath,
                syncData: syncData,
                smilPath: smilPath
            });
            
            console.log(`解析SMIL文件成功: ${smilPath}`, {
                audioSrc: fullAudioPath,
                syncPoints: syncData.length
            });
            
        } catch (error) {
            console.warn(`解析SMIL文件失败: ${smilPath}`, error);
        }
    }

    /**
     * 正确解析音频路径
     */
    resolveAudioPath(smilPath, audioSrc) {
        if (!audioSrc) return '';
        
        console.log('解析音频路径:', { smilPath, audioSrc });
        
        // 处理相对路径
        if (audioSrc.startsWith('../')) {
            // 获取SMIL文件所在目录
            const smilDir = smilPath.substring(0, smilPath.lastIndexOf('/') + 1);
            // 解析相对路径
            const relativePath = audioSrc.substring(3); // 移除 ../
            const result = smilDir + relativePath;
            console.log('相对路径解析结果:', result);
            return result;
        }
        
        if (audioSrc.startsWith('./')) {
            const smilDir = smilPath.substring(0, smilPath.lastIndexOf('/') + 1);
            const relativePath = audioSrc.substring(2); // 移除 ./
            const result = smilDir + relativePath;
            console.log('相对路径解析结果:', result);
            return result;
        }
        
        // 如果是绝对路径，移除开头的斜杠
        if (audioSrc.startsWith('/')) {
            const result = audioSrc.substring(1);
            console.log('绝对路径解析结果:', result);
            return result;
        }
        
        // 默认情况下，相对于SMIL文件所在目录
        const smilDir = smilPath.substring(0, smilPath.lastIndexOf('/') + 1);
        const result = smilDir + audioSrc;
        console.log('默认路径解析结果:', result);
        return result;
    }

    /**
     * 解析路径
     */
    resolvePath(basePath, currentPath, relativePath) {
        if (!relativePath) return '';
        
        if (relativePath.startsWith('/')) {
            return relativePath.substring(1);
        }
        
        const currentDir = currentPath.includes('/') 
            ? currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
            : '';
        
        const fullPath = basePath + currentDir + relativePath;
        return fullPath.replace(/\/\//g, '/');
    }

    /**
     * 提取同步数据
     */
    extractSyncData(smilDoc) {
        const syncData = [];
        const parElements = smilDoc.querySelectorAll('par');
        
        parElements.forEach((par, index) => {
            const textElem = par.querySelector('text');
            const audioElem = par.querySelector('audio');
            
            if (textElem && audioElem) {
                const textSrc = textElem.getAttribute('src');
                const audioSrc = audioElem.getAttribute('src');
                const clipBegin = audioElem.getAttribute('clipBegin');
                const clipEnd = audioElem.getAttribute('clipEnd');
                
                if (textSrc && audioSrc) {
                    // 提取文本元素ID
                    const textId = textSrc.includes('#') 
                        ? textSrc.split('#')[1] 
                        : textSrc.split('.')[0];
                    
                    syncData.push({
                        textId: textId,
                        audioSrc: audioSrc,
                        start: this.parseSMILTime(clipBegin),
                        end: this.parseSMILTime(clipEnd),
                        index: index
                    });
                }
            }
        });
        
        // 按开始时间排序
        syncData.sort((a, b) => a.start - b.start);
        return syncData;
    }

    /**
     * 解析SMIL时间格式
     */
    parseSMILTime(timeStr) {
        if (!timeStr) return 0;
        
        // 处理格式: 小时:分钟:秒.毫秒
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            let seconds = 0;
            
            if (parts.length === 3) {
                seconds = parseFloat(parts[0]) * 3600 + 
                         parseFloat(parts[1]) * 60 + 
                         parseFloat(parts[2]);
            } else if (parts.length === 2) {
                seconds = parseFloat(parts[0]) * 60 + 
                         parseFloat(parts[1]);
            }
            
            return seconds;
        }
        
        // 处理纯秒数格式
        return parseFloat(timeStr);
    }

    /**
     * 解析目录信息
     */
    async parseTOC(contentDoc, basePath) {
        const spine = contentDoc.querySelector('spine');
        const tocId = spine.getAttribute('toc');
        
        if (tocId) {
            const tocItem = this.manifest.get(tocId);
            if (tocItem && tocItem.mediaType === 'application/x-dtbncx+xml') {
                await this.parseNCX(tocItem.href);
            } else {
                await this.parseNav(contentDoc, basePath);
            }
        } else {
            await this.parseNav(contentDoc, basePath);
        }
    }

    /**
     * 解析 NCX 格式的目录文件
     */
    async parseNCX(ncxPath) {
        try {
            const ncxContent = await this.currentZip.file(ncxPath).async('text');
            const parser = new DOMParser();
            const ncxDoc = parser.parseFromString(ncxContent, 'text/xml');
            const navPoints = ncxDoc.querySelectorAll('navPoint');
            
            this.toc = [];
            navPoints.forEach(navPoint => {
                const label = navPoint.querySelector('text')?.textContent || '';
                const src = navPoint.querySelector('content')?.getAttribute('src') || '';
                const playOrder = parseInt(navPoint.getAttribute('playOrder') || '0');
                
                if (label && src) {
                    this.toc.push({
                        label,
                        src,
                        playOrder
                    });
                }
            });
            
            this.toc.sort((a, b) => a.playOrder - b.playOrder);
        } catch (error) {
            console.warn('解析NCX目录失败:', error);
        }
    }

    /**
     * 解析 NAV 格式的目录文件
     */
    async parseNav(contentDoc, basePath) {
        try {
            const navItems = contentDoc.querySelectorAll('nav li a');
            this.toc = [];
            
            navItems.forEach((navItem, index) => {
                const label = navItem.textContent || '';
                const src = navItem.getAttribute('href') || '';
                
                if (label && src) {
                    this.toc.push({
                        label,
                        src: basePath + src,
                        playOrder: index
                    });
                }
            });
        } catch (error) {
            console.warn('解析nav目录失败:', error);
        }
    }

    /**
     * 获取章节内容
     */
    async getSectionContent(sectionIndex) {
        const section = this.sections[sectionIndex];
        const content = await this.currentZip.file(section.href).async('text');
        
        // 如果章节有音频数据，处理内容以支持高亮
        if (section.audio) {
            return this.processAudioContent(content, section.audio.syncData);
        }
        
        return content;
    }

    /**
     * 处理音频内容 - 增强ID处理
     */
    processAudioContent(content, syncData) {
        if (!syncData || syncData.length === 0) return content;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        console.log('处理音频内容，同步数据数量:', syncData.length);
        
        // 为每个同步文本元素添加ID和类
        syncData.forEach((syncPoint, index) => {
            let element = doc.getElementById(syncPoint.textId);
            
            // 如果通过ID找不到，尝试通过其他方式查找
            if (!element) {
                // 尝试查找包含该ID作为部分属性的元素
                element = doc.querySelector(`[id*="${syncPoint.textId}"]`);
            }
            
            if (!element) {
                // 尝试通过数据属性查找
                element = doc.querySelector(`[data-id="${syncPoint.textId}"]`);
            }
            
            if (element) {
                element.classList.add('audio-sync-text');
                element.setAttribute('data-audio-sync', syncPoint.textId);
                element.setAttribute('data-audio-index', index);
                element.setAttribute('data-audio-src', syncPoint.audioSrc);
                element.setAttribute('data-audio-start', syncPoint.start);
                element.setAttribute('data-audio-end', syncPoint.end);
                
                // 添加调试信息
                if (index < 5) { // 只记录前5个用于调试
                    console.log('找到同步文本元素:', {
                        textId: syncPoint.textId,
                        audioSrc: syncPoint.audioSrc,
                        start: syncPoint.start,
                        end: syncPoint.end,
                        element: element.tagName,
                        text: element.textContent?.substring(0, 50) + '...'
                    });
                }
            } else {
                if (index < 5) { // 只记录前5个未找到的用于调试
                    console.warn('未找到同步文本元素:', syncPoint.textId);
                }
            }
        });
        
        // 记录找到的同步元素数量
        const foundElements = doc.querySelectorAll('.audio-sync-text').length;
        console.log(`音频同步处理完成: 找到 ${foundElements}/${syncData.length} 个同步元素`);
        
        return doc.body.innerHTML;
    }

    /**
     * 获取音频Blob - 增强路径查找
     */
    async getAudioBlob(audioPath) {
        try {
            console.log('查找音频文件:', audioPath);
            
            // 首先尝试直接路径
            let audioFile = this.currentZip.file(audioPath);
            if (audioFile) {
                console.log('找到音频文件 (直接路径):', audioPath);
                const blob = await audioFile.async('blob');
                console.log('音频文件信息:', {
                    path: audioPath,
                    size: blob.size,
                    type: blob.type,
                    estimatedDuration: this.estimateAudioDuration(blob.size)
                });
                return blob;
            }
            
            // 尝试各种可能的路径变体
            const possiblePaths = this.generateAudioSearchPaths(audioPath);
            console.log('尝试搜索路径:', possiblePaths);
            
            for (const path of possiblePaths) {
                audioFile = this.currentZip.file(path);
                if (audioFile) {
                    console.log('找到音频文件 (搜索路径):', path);
                    const blob = await audioFile.async('blob');
                    console.log('音频文件信息:', {
                        path: path,
                        size: blob.size,
                        type: blob.type,
                        estimatedDuration: this.estimateAudioDuration(blob.size)
                    });
                    return blob;
                }
            }
            
            // 如果还是没找到，尝试搜索相似文件名
            const fileName = audioPath.split('/').pop();
            if (fileName) {
                const allFiles = Object.keys(this.currentZip.files);
                console.log('所有文件数量:', allFiles.length);
                
                // 查找所有音频文件
                const audioFiles = allFiles.filter(file => 
                    file.match(/\.(mp3|mp4|wav|ogg|m4a)$/i)
                );
                
                console.log('所有音频文件:', audioFiles);
                
                // 查找文件名相似的音频文件
                const baseName = fileName.replace('.mp4', '').replace(/\d+/g, '');
                const similarFiles = audioFiles.filter(file => 
                    file.includes(baseName)
                );
                
                console.log('相似音频文件:', similarFiles);
                
                for (const filePath of similarFiles) {
                    audioFile = this.currentZip.file(filePath);
                    if (audioFile) {
                        console.log('通过相似文件名找到音频:', filePath);
                        const blob = await audioFile.async('blob');
                        console.log('音频文件信息:', {
                            path: filePath,
                            size: blob.size,
                            type: blob.type,
                            estimatedDuration: this.estimateAudioDuration(blob.size)
                        });
                        return blob;
                    }
                }
            }
            
            console.warn('无法找到音频文件:', audioPath);
            return null;
            
        } catch (error) {
            console.error('获取音频Blob失败:', error);
            return null;
        }
    }

    /**
     * 估算音频时长（粗略估算）
     */
    estimateAudioDuration(fileSize) {
        // 基于MP4音频的粗略估算（128kbps ≈ 16KB/s）
        const durationInSeconds = fileSize / 16000;
        return `${durationInSeconds.toFixed(1)}秒`;
    }

    /**
     * 生成音频搜索路径
     */
    generateAudioSearchPaths(originalPath) {
        const paths = new Set();
        
        // 原始路径
        paths.add(originalPath);
        
        // 尝试不同的路径组合
        const pathParts = originalPath.split('/');
        
        // 移除开头的 OEBPS/ 如果存在
        if (originalPath.startsWith('OEBPS/')) {
            const withoutOEBPS = originalPath.substring(6);
            paths.add(withoutOEBPS);
        }
        
        // 尝试 Audio/ 目录
        const fileName = pathParts[pathParts.length - 1];
        paths.add('Audio/' + fileName);
        paths.add('OEBPS/Audio/' + fileName);
        
        // 尝试 MediaOverlays/Audio/ 目录
        paths.add('MediaOverlays/Audio/' + fileName);
        paths.add('OEBPS/MediaOverlays/Audio/' + fileName);
        
        // 相对路径变体
        paths.add('./' + originalPath);
        paths.add('../' + originalPath);
        
        // 移除开头的 ../
        if (originalPath.startsWith('../')) {
            paths.add(originalPath.substring(3));
        }
        
        // 尝试根目录
        paths.add(fileName);
        
        console.log('生成的搜索路径:', Array.from(paths));
        return Array.from(paths);
    }

}

/**
 * 内容渲染器 - 负责将内容渲染到页面并处理资源
 * 扩展支持音频高亮和交互
 */
class ContentRenderer {
    constructor(containerElement, zip) {
        this.containerElement = containerElement;
        this.currentZip = zip;
        this.imagesCache = new Map();
        this.audioCache = new Map();
        this.fontSize = 16;
        this.currentAudio = null;
        this.isPlaying = false;
        this.currentHighlight = null;
        this.syncData = [];
    }

    /**
     * 设置字体大小
     */
    setFontSize(size) {
        this.fontSize = size;
        this.containerElement.style.fontSize = `${size}px`;
    }

    /**
     * 渲染章节内容 - 支持虚拟章节
     */
    async renderSection(content, section, audioData = null) {
        if (!content) {
            this.containerElement.innerHTML = this.createMessageHTML('无内容');
            return;
        }
        
        // 在单个HTML模式下，我们可能需要处理虚拟章节的高亮
        const cleanedContent = this.cleanContent(content, section.href);
        this.containerElement.innerHTML = cleanedContent;
        
        await this.processImages(this.containerElement, section);
        this.processInternalLinks(this.containerElement);
        
        // 处理音频高亮
        const finalAudioData = audioData || section.audio;
        if (finalAudioData && finalAudioData.syncData) {
            this.syncData = finalAudioData.syncData;
            this.setupAudioHighlighting(finalAudioData);
        } else {
            this.syncData = [];
        }
        
        // 如果是虚拟章节，标记当前活动章节
        if (section.virtualChapter) {
            this.markActiveVirtualChapter(section);
        }
        
        return cleanedContent;
    }

    /**
     * 标记活动的虚拟章节
     */
    markActiveVirtualChapter(activeSection) {
        // 清除之前的高亮
        const previousActive = this.containerElement.querySelector('.active-virtual-chapter');
        if (previousActive) {
            previousActive.classList.remove('active-virtual-chapter');
        }
        
        // 高亮当前章节
        if (activeSection.startElement) {
            activeSection.startElement.classList.add('active-virtual-chapter');
        } else {
            const element = document.getElementById(activeSection.chapterId);
            if (element) {
                element.classList.add('active-virtual-chapter');
            }
        }
    }

    /**
     * 设置音频高亮 - 增强功能
     */
    setupAudioHighlighting(audioData) {
        // 清除现有高亮
        this.clearHighlights();
        
        // 为可同步文本添加点击事件
        const syncElements = this.containerElement.querySelectorAll('.audio-sync-text, [data-audio-sync]');
        console.log('设置音频高亮，找到元素:', syncElements.length);
        
        if (syncElements.length === 0) {
            console.warn('未找到音频同步元素，尝试查找其他可能的选择器');
            // 尝试其他可能的选择器
            const allElements = this.containerElement.querySelectorAll('p, span, div');
            console.log('总元素数量:', allElements.length);
        }
        
        syncElements.forEach((element, index) => {
            element.classList.add('audio-highlight');
            element.style.cursor = 'pointer';
            
            // 添加悬停效果
            element.addEventListener('mouseenter', () => {
                if (!element.classList.contains('active')) {
                    element.style.backgroundColor = '#fff9c4';
                }
            });
            
            element.addEventListener('mouseleave', () => {
                if (!element.classList.contains('active')) {
                    element.style.backgroundColor = '';
                }
            });
            
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('点击音频文本:', {
                    textId: element.id || element.getAttribute('data-audio-sync'),
                    text: element.textContent?.substring(0, 50)
                });
                this.handleTextClick(element);
            });
        });
        
        console.log('音频高亮设置完成');
    }

    /**
     * 处理文本点击
     */
    async handleTextClick(element) {
        const textId = element.id || element.getAttribute('data-audio-sync');
        const audioSrc = element.getAttribute('data-audio-src');
        const startTime = element.getAttribute('data-audio-start');
        const endTime = element.getAttribute('data-audio-end');
        
        if (!textId) return;
        
        // 从syncData中查找完整的同步点信息
        const syncPoint = this.syncData.find(point => point.textId === textId);
        if (!syncPoint) {
            console.warn('未找到同步点:', textId);
            return;
        }
        
        console.log('点击音频文本:', {
            textId: textId,
            audioSrc: syncPoint.audioSrc,
            start: syncPoint.start,
            end: syncPoint.end,
            text: element.textContent?.substring(0, 50)
        });
        
        // 高亮当前文本
        this.highlightText(element);
        
        // 播放对应音频
        if (this.onPlayAudio) {
            this.onPlayAudio(syncPoint);
        }
    }

    /**
     * 高亮文本
     */
    highlightText(element) {
        this.clearHighlights();
        element.classList.add('active');
        this.currentHighlight = element;
        
        // 滚动到高亮文本
        this.scrollToElement(element);
    }

    /**
     * 清除高亮
     */
    clearHighlights() {
        const highlights = this.containerElement.querySelectorAll('.audio-highlight.active');
        highlights.forEach(element => {
            element.classList.remove('active');
        });
        this.currentHighlight = null;
    }

    /**
     * 滚动到元素
     */
    scrollToElement(element) {
        const container = this.containerElement.parentElement;
        if (!container) return;
        
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
            });
        }
    }

    /**
     * 根据时间高亮文本 - 修复高亮逻辑
     */
    highlightByTime(currentTime) {
        if (this.syncData.length === 0) return;
        
        // 找到当前时间对应的文本段
        let currentSyncPoint = null;
        
        for (const point of this.syncData) {
            if (currentTime >= point.start && currentTime < point.end) {
                currentSyncPoint = point;
                break;
            }
        }
        
        // 如果没有精确匹配，找最接近的
        if (!currentSyncPoint) {
            // 找开始时间最接近当前时间的
            currentSyncPoint = this.syncData.reduce((prev, curr) => {
                return Math.abs(curr.start - currentTime) < Math.abs(prev.start - currentTime) ? curr : prev;
            });
        }
        
        if (currentSyncPoint) {
            const element = this.containerElement.querySelector(`[data-audio-sync="${currentSyncPoint.textId}"]`);
            if (element && element !== this.currentHighlight) {
                this.highlightText(element);
                
                // 记录高亮信息用于调试
                console.log('音频高亮:', {
                    time: currentTime.toFixed(2),
                    textId: currentSyncPoint.textId,
                    start: currentSyncPoint.start,
                    end: currentSyncPoint.end,
                    text: element.textContent?.substring(0, 30) + '...'
                });
            }
        } else if (this.currentHighlight) {
            // 如果没有找到对应的同步点，清除高亮
            this.clearHighlights();
        }
    }

    /**
     * 创建消息 HTML
     */
    createMessageHTML(message) {
        return `
            <div class="no-content">
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * 清理内容，移除不需要的元素和样式
     */
    cleanContent(content, baseHref) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        // 清理不需要的元素
        const unwantedTags = ['script', 'style', 'link', 'meta', 'nav'];
        unwantedTags.forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });
        
        // 移除所有样式和类，但保留基本结构
        doc.querySelectorAll('*').forEach(el => {
            el.removeAttribute('style');
            const classes = el.className.split(' ').filter(cls => 
                cls !== 'audio-highlight' && 
                cls !== 'audio-sync-text' &&
                !cls.startsWith('user-highlight')
            );
            el.className = classes.join(' ');
            el.removeAttribute('id');
        });
        
        return doc.body.innerHTML;
    }

    /**
     * 处理图片资源
     */
    async processImages(container, section) {
        const images = container.querySelectorAll('img');
        
        for (const img of images) {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                try {
                    const basePath = section.href.split('/').slice(0, -1).join('/');
                    const fullImagePath = basePath ? basePath + '/' + src : src;
                    
                    console.log('加载图片:', { src, basePath, fullImagePath });
                    
                    if (this.imagesCache.has(fullImagePath)) {
                        img.src = this.imagesCache.get(fullImagePath);
                        continue;
                    }
                    
                    const imageFile = this.currentZip.file(fullImagePath);
                    if (imageFile) {
                        const blob = await imageFile.async('blob');
                        const blobUrl = URL.createObjectURL(blob);
                        img.src = blobUrl;
                        this.imagesCache.set(fullImagePath, blobUrl);
                        console.log('图片加载成功:', fullImagePath);
                    } else {
                        console.warn('图片文件未找到:', fullImagePath);
                        // 设置占位符
                        img.alt = img.alt || '图片加载失败';
                        img.style.backgroundColor = '#f0f0f0';
                    }
                } catch (error) {
                    console.error('加载图片失败:', error);
                    img.alt = img.alt || '图片加载失败';
                    img.style.backgroundColor = '#f0f0f0';
                }
            }
            
            // 确保图片适应容器
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
        }
    }

    /**
     * 处理内部链接
     */
    processInternalLinks(container) {
        container.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleInternalLink(href);
                });
            }
        });
    }

    /**
     * 处理内部链接点击事件
     */
    handleInternalLink(href) {
        if (this.onInternalLinkClick) {
            this.onInternalLinkClick(href);
        }
    }

    /**
     * 添加用户高亮
     */
    addUserHighlight(range) {
        try {
            const span = document.createElement('span');
            span.className = 'user-highlight';
            span.style.backgroundColor = 'rgba(255, 235, 59, 0.3)';
            range.surroundContents(span);
            return span;
        } catch (error) {
            console.warn('无法添加高亮:', error);
            return null;
        }
    }

    /**
     * 移除用户高亮
     */
    removeUserHighlight(element) {
        if (element && element.parentNode) {
            const parent = element.parentNode;
            while (element.firstChild) {
                parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
        }
    }
}

/**
 * Multi-column 分页管理器
 */
class MultiColumnPaginator {
    constructor(contentWrapper, adaptiveContent, bookContainer) {
        this.contentWrapper = contentWrapper;
        this.adaptiveContent = adaptiveContent;
        this.bookContainer = bookContainer;
        this.columnGap = 80;
        this.columnWidth = 0;
        this.currentPage = 0;
        this.totalPages = 1;
        this.currentSection = 0;
        this.totalSections = 0;
        this.fontSize = 16;
    }

    /**
     * 设置字体大小
     */
    setFontSize(size) {
        this.fontSize = size;
        this.adaptiveContent.style.fontSize = `${size}px`;
    }

    /**
     * 重新分页
     */
    rePaginate() {
        // 先隐藏内容避免闪烁
        this.adaptiveContent.style.visibility = 'hidden';
        
        // 先重置所有样式
        this.resetStyles();
        
        const pageViewRect = this.bookContainer.getBoundingClientRect();
        const horizontalPadding = 40 * 2;
        
        // 计算列宽
        this.columnWidth = pageViewRect.width - horizontalPadding;
        
        if (this.columnWidth <= 0) {
            console.warn("阅读区域尺寸异常，无法进行排版。");
            this.adaptiveContent.style.visibility = 'visible';
            return;
        }

        // 设置多列布局
        this.adaptiveContent.style.columnWidth = `${this.columnWidth}px`;
        this.adaptiveContent.style.columnGap = `${this.columnGap}px`;
        this.adaptiveContent.style.columnFill = 'auto';
        this.adaptiveContent.style.width = '100%';
        this.adaptiveContent.style.height = 'auto';

        // 临时禁用多列布局来测量内容
        this.adaptiveContent.style.columnWidth = 'auto';
        this.adaptiveContent.style.width = 'auto';
        
        requestAnimationFrame(() => {
            // 测量单列内容宽度
            const singleColumnWidth = this.adaptiveContent.scrollWidth;
            console.log('单列内容宽度:', singleColumnWidth);
            
            // 恢复多列布局
            this.adaptiveContent.style.columnWidth = `${this.columnWidth}px`;
            this.adaptiveContent.style.width = '100%';

            requestAnimationFrame(() => {
                // 现在测量多列布局下的总宽度
                const multiColumnWidth = this.adaptiveContent.scrollWidth;
                console.log('多列总宽度:', multiColumnWidth, '列宽:', this.columnWidth);
                
                // 计算实际列数
                const pageStep = this.columnWidth + this.columnGap;
                this.totalPages = Math.max(1, Math.ceil(multiColumnWidth / pageStep));
                
                console.log('计算页数:', this.totalPages, '步长:', pageStep, '多列宽度:', multiColumnWidth);
                
                // 设置包装器宽度
                const totalWrapperWidth = this.totalPages * pageStep;
                this.contentWrapper.style.width = `${totalWrapperWidth}px`;
                
                console.log('包装器宽度:', totalWrapperWidth);
                
                // 确保当前页有效
                if (this.currentPage >= this.totalPages) {
                    this.currentPage = Math.max(0, this.totalPages - 1);
                }
                
                // 应用当前页位置
                this.applyCurrentPage(false);
                
                // 显示内容
                this.adaptiveContent.style.visibility = 'visible';
                
                if (this.onPageChange) {
                    this.onPageChange(this.currentPage, this.totalPages, this.currentSection, this.totalSections);
                }
            });
        });
    }

    /**
     * 重置样式
     */
    resetStyles() {
        this.contentWrapper.style.transform = 'translateX(0px)';
        this.contentWrapper.style.transition = 'none';
        this.contentWrapper.style.width = 'auto';
        this.adaptiveContent.style.columnWidth = 'auto';
        this.adaptiveContent.style.columnGap = 'normal';
        this.adaptiveContent.style.width = 'auto';
        this.adaptiveContent.style.height = 'auto';
    }

    /**
     * 应用当前页位置
     */
    applyCurrentPage(animated = true) {
        if (this.currentPage < 0 || this.currentPage >= this.totalPages) {
            return;
        }

        const pageStep = this.columnWidth + this.columnGap;
        const translateX = this.currentPage * pageStep;
        
        console.log(`定位到第${this.currentPage + 1}页, 偏移量: ${translateX}px`);
        
        // 使用更平滑的动画
        this.contentWrapper.style.transition = animated ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
        this.contentWrapper.style.transform = `translateX(-${translateX}px)`;
        
        // 强制重绘
        this.contentWrapper.offsetHeight;
    }

    /**
     * 跳转到指定页面
     */
    goToPage(pageIndex, animated = true) {
        if (pageIndex < 0 || pageIndex >= this.totalPages) {
            console.warn('页面索引超出范围:', pageIndex);
            return false;
        }

        console.log(`跳转: ${this.currentPage + 1} -> ${pageIndex + 1}`);
        this.currentPage = pageIndex;
        this.applyCurrentPage(animated);
        
        if (this.onPageChange) {
            this.onPageChange(this.currentPage, this.totalPages, this.currentSection, this.totalSections);
        }
        
        return true;
    }

    /**
     * 下一页
     */
    nextPage() {
        if (this.currentPage < this.totalPages - 1) {
            return this.goToPage(this.currentPage + 1);
        }
        console.log('已是最后一页');
        return false;
    }

    /**
     * 上一页
     */
    previousPage() {
        if (this.currentPage > 0) {
            return this.goToPage(this.currentPage - 1);
        }
        console.log('已是第一页');
        return false;
    }

    /**
     * 设置章节信息
     */
    setSectionInfo(currentSection, totalSections) {
        this.currentSection = currentSection;
        this.totalSections = totalSections;
    }
}

/**
 * Anki 连接器 - 负责与 AnkiConnect 通信
 */
class AnkiConnector {
    constructor() {
        this.host = '127.0.0.1';
        this.port = 8765;
        this.connected = false;
        this.settings = {
            deck: '',
            model: '',
            wordField: '',
            meaningField: '',
            sentenceField: '',
            audioField: '',
            tagsField: ''
        };
    }

    /**
     * 加载设置
     */
    loadSettings() {
        const saved = localStorage.getItem('ankiSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        
        const connSettings = localStorage.getItem('ankiConnection');
        if (connSettings) {
            const conn = JSON.parse(connSettings);
            this.host = conn.host || '127.0.0.1';
            this.port = conn.port || 8765;
        }
    }

    /**
     * 保存设置
     */
    saveSettings() {
        localStorage.setItem('ankiSettings', JSON.stringify(this.settings));
        localStorage.setItem('ankiConnection', JSON.stringify({
            host: this.host,
            port: this.port
        }));
    }

    /**
     * 测试连接
     */
    async testConnection() {
        try {
            const response = await this.request('version', {});
            this.connected = true;
            return { success: true, version: response };
        } catch (error) {
            this.connected = false;
            return { success: false, error: error.message };
        }
    }

    /**
     * 发送请求到 AnkiConnect
     */
    async request(action, params = {}) {
        const url = `http://${this.host}:${this.port}`;
        
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

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            return data.result;
        } catch (error) {
            console.error('AnkiConnect request failed:', error);
            throw new Error(`连接失败: ${error.message}`);
        }
    }

    /**
     * 获取牌组列表
     */
    async getDecks() {
        return await this.request('deckNames');
    }

    /**
     * 获取模板列表
     */
    async getModels() {
        return await this.request('modelNames');
    }

    /**
     * 获取模板字段
     */
    async getModelFields(modelName) {
        return await this.request('modelFieldNames', { modelName });
    }

    /**
     * 添加卡片
     */
    async addNote(note) {
        return await this.request('addNote', { note });
    }

    /**
     * 存储媒体文件
     */
    async storeMediaFile(filename, data) {
        return await this.request('storeMediaFile', {
            filename: filename,
            data: data
        });
    }

    /**
     * 创建 Anki 笔记
     */
    createNote(fields, tags = []) {
        return {
            deckName: this.settings.deck,
            modelName: this.settings.model,
            fields: fields,
            tags: tags,
            options: {
                allowDuplicate: false,
                duplicateScope: 'deck'
            }
        };
    }
}

/**
 * 用户界面管理器 - 适配新的UI结构
 */
class UIManager {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
    }

    /**
     * 初始化界面元素
     */
    initializeElements() {
        // 主要UI元素
        this.epubFileInput = document.getElementById('epubFile');
        this.menuToggle = document.getElementById('menuToggle');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.toggleSettings = document.getElementById('toggleSettings');
        this.closeSidebar = document.getElementById('closeSidebar');
        this.sidebar = document.getElementById('sidebar');
        this.tocContainer = document.getElementById('tocContainer');
        this.bookTitle = document.getElementById('bookTitle');
        this.bookAuthor = document.getElementById('bookAuthor');
        
        // 页面控制元素
        this.prevPage = document.getElementById('prevPage');
        this.nextPage = document.getElementById('nextPage');
        this.currentPageSpan = document.getElementById('currentPage');
        this.totalPagesSpan = document.getElementById('totalPages');
        
        // 音频播放器元素
        this.playerContainer = document.getElementById('playerContainer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progress = document.getElementById('progress');
        this.currentTimeSpan = document.getElementById('currentTime');
        this.durationSpan = document.getElementById('duration');
        this.playbackRateSelect = document.getElementById('playbackRate');
        
        // 设置侧边栏元素
        this.settingsSidebar = document.getElementById('settingsSidebar');
        this.closeSettings = document.getElementById('closeSettings');
        
        // Anki设置元素
        this.testAnkiConnection = document.getElementById('testAnkiConnection');
        this.ankiHost = document.getElementById('ankiHost');
        this.ankiPort = document.getElementById('ankiPort');
        this.ankiDeck = document.getElementById('ankiDeck');
        this.ankiModel = document.getElementById('ankiModel');
        this.ankiWordField = document.getElementById('ankiWordField');
        this.ankiMeaningField = document.getElementById('ankiMeaningField');
        this.ankiSentenceField = document.getElementById('ankiSentenceField');
        this.ankiAudioField = document.getElementById('ankiAudioField');
        this.ankiTagsField = document.getElementById('ankiTagsField');
        this.saveAnkiSettings = document.getElementById('saveAnkiSettings');
        
        // 词典弹窗元素
        this.dictionaryModal = document.getElementById('dictionaryModal');
        this.closeDictionary = document.getElementById('closeDictionary');
        this.closeDictionaryBtn = document.getElementById('closeDictionaryBtn');
        this.dictionaryContent = document.getElementById('dictionaryContent');
        this.dictionaryFooter = document.getElementById('dictionaryFooter');
        this.addToAnkiBtn = document.getElementById('addToAnkiBtn');
        
        // 选择工具栏元素
        this.selectionToolbar = document.getElementById('selectionToolbar');
        this.lookupWordBtn = document.getElementById('lookupWordBtn');
        this.highlightBtn = document.getElementById('highlightBtn');
        this.addToAnkiQuickBtn = document.getElementById('addToAnkiQuickBtn');
        this.copyBtn = document.getElementById('copyBtn');
        
        // 遮罩层和加载指示器
        this.overlay = document.getElementById('overlay');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        
        // Multi-column 相关元素
        this.contentWrapper = document.getElementById('contentWrapper');
        this.adaptiveContent = document.getElementById('adaptiveContent');
        this.bookContainer = document.getElementById('bookContainer');
        
        // 翻页区域
        this.prevSwipeArea = document.getElementById('prevSwipeArea');
        this.nextSwipeArea = document.getElementById('nextSwipeArea');
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 禁用浏览器默认选择行为
        this.disableBrowserSelection();
        
        // 主要功能按钮事件
        this.menuToggle.addEventListener('click', () => this.toggleSidebar());
        this.uploadBtn.addEventListener('click', () => this.epubFileInput.click());
        this.toggleSettings.addEventListener('click', () => this.toggleSettingsSidebar());
        this.closeSidebar.addEventListener('click', () => this.toggleSidebar());
        this.closeSettings.addEventListener('click', () => this.toggleSettingsSidebar());
        
        // 绑定翻页按钮事件
        this.prevPage.addEventListener('click', () => {
            if (this.onPreviousPage) this.onPreviousPage();
        });
        
        this.nextPage.addEventListener('click', () => {
            if (this.onNextPage) this.onNextPage();
        });
        
        // 绑定翻页区域点击事件
        this.prevSwipeArea.addEventListener('click', () => {
            if (this.onPreviousPage) this.onPreviousPage();
        });
        
        this.nextSwipeArea.addEventListener('click', () => {
            if (this.onNextPage) this.onNextPage();
        });
        
        // 音频控制事件
        this.playPauseBtn.addEventListener('click', () => {
            if (this.onPlayPause) this.onPlayPause();
        });
        
        this.progressBar.addEventListener('click', (e) => {
            if (this.onSeekAudio) this.onSeekAudio(e);
        });
        
        this.playbackRateSelect.addEventListener('change', (e) => {
            if (this.onPlaybackRateChange) this.onPlaybackRateChange(e.target.value);
        });
        
        // Anki设置事件
        this.testAnkiConnection.addEventListener('click', () => {
            if (this.onTestAnkiConnection) this.onTestAnkiConnection();
        });
        this.saveAnkiSettings.addEventListener('click', () => {
            if (this.onSaveAnkiSettings) this.onSaveAnkiSettings();
        });
        
        // 词典弹窗事件
        this.closeDictionary.addEventListener('click', () => this.hideDictionaryModal());
        this.closeDictionaryBtn.addEventListener('click', () => this.hideDictionaryModal());
        this.addToAnkiBtn.addEventListener('click', () => {
            if (this.onAddToAnki) this.onAddToAnki();
        });
        
        // 工具栏按钮事件
        this.lookupWordBtn.addEventListener('click', () => {
            if (this.onLookupWord) this.onLookupWord();
        });
        
        this.highlightBtn.addEventListener('click', () => {
            if (this.onHighlightText) this.onHighlightText();
        });
        
        this.addToAnkiQuickBtn.addEventListener('click', () => {
            if (this.onQuickAddToAnki) this.onQuickAddToAnki();
        });
        
        this.copyBtn.addEventListener('click', () => {
            if (this.onCopyText) this.onCopyText();
        });
        
        // 遮罩层点击事件 - 修复PC端点击问题
        this.overlay.addEventListener('click', () => {
            this.hideSidebar();
            this.hideSettingsSidebar();
            this.hideDictionaryModal();
        });
        
        // 设置分组折叠功能
        this.setupSettingGroups();
        
        this.setupSwipeEvents();
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        window.addEventListener('resize', () => {
            if (this.onResize) this.onResize();
        });
        
        // 文本选择事件
        document.addEventListener('selectionchange', () => {
            setTimeout(() => this.handleSelectionChange(), 100);
        });
    }

    /**
     * 禁用浏览器默认选择行为
     */
    disableBrowserSelection() {
        // 禁用浏览器默认上下文菜单
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.adaptive-content')) {
                e.preventDefault();
            }
        });

        // 修复移动端滑动问题
        this.fixMobileScroll();
    }

    /**
     * 修复移动端滑动问题
     */
    fixMobileScroll() {
        const tocContainer = document.getElementById('tocContainer');
        const settingsContent = document.querySelector('.settings-content');
        
        if (tocContainer) {
            tocContainer.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            });
            
            tocContainer.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            });
        }
        
        if (settingsContent) {
            settingsContent.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            });
            
            settingsContent.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            });
        }
    }

    /**
     * 设置设置分组折叠功能
     */
    setupSettingGroups() {
        const groupHeaders = document.querySelectorAll('.setting-group-header');
        groupHeaders.forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
            });
        });
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '加载中...') {
        if (this.loadingIndicator) {
            const messageElement = this.loadingIndicator.querySelector('p');
            if (messageElement) {
                messageElement.textContent = message;
            }
            this.loadingIndicator.style.display = 'flex';
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    /**
     * 显示内容区域的加载状态
     */
    showContentLoading(message = '加载中...') {
        if (this.adaptiveContent) {
            this.adaptiveContent.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    /**
     * 设置滑动手势事件
     */
    setupSwipeEvents() {
        let startX = 0;
        let startY = 0;
        let isSwiping = false;

        const handleStart = (e) => {
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            isSwiping = true;
        };

        const handleMove = (e) => {
            if (!isSwiping) return;
            e.preventDefault();
        };

        const handleEnd = (e) => {
            if (!isSwiping) return;
            
            const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            this.handleSwipe(startX, endX, startY, endY);
            isSwiping = false;
        };

        // 触摸事件
        document.addEventListener('touchstart', handleStart, { passive: false });
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);
        
        // 鼠标事件
        document.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
    }

    /**
     * 处理滑动手势
     */
    handleSwipe(startX, endX, startY, endY) {
        const swipeThreshold = 50;
        const diffX = startX - endX;
        const diffY = startY - endY;

        // 只有水平滑动距离大于垂直滑动距离时才触发翻页
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
            if (diffX > 0) {
                // 向左滑动 - 下一页
                if (this.onNextPage) this.onNextPage();
            } else {
                // 向右滑动 - 上一页
                if (this.onPreviousPage) this.onPreviousPage();
            }
        }
    }

    /**
     * 处理键盘按键
     */
    handleKeyPress(e) {
        if (this.sidebar.classList.contains('open') || 
            this.settingsSidebar.classList.contains('open')) return;

        switch(e.key) {
            case 'ArrowLeft': 
                if (this.onPreviousPage) this.onPreviousPage(); 
                break;
            case 'ArrowRight': 
                if (this.onNextPage) this.onNextPage(); 
                break;
            case 'Escape': 
                this.hideSidebar();
                this.hideSettingsSidebar();
                this.hideDictionaryModal();
                break;
            case '-': 
                if (this.onFontDecrease) this.onFontDecrease(); 
                break;
            case '=': 
                if (this.onFontIncrease) this.onFontIncrease(); 
                break;
            case '0': 
                if (this.onFontReset) this.onFontReset(); 
                break;
            case ' ': 
                e.preventDefault();
                if (this.onPlayPause) this.onPlayPause();
                break;
        }
    }

    /**
     * 处理文本选择变化
     */
    handleSelectionChange() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 0 && selectedText.length < 100) {
            this.showSelectionToolbar(selection);
        } else {
            this.hideSelectionToolbar();
        }
    }

    /**
     * 显示选择工具栏 - 修复位置问题
     */
    showSelectionToolbar(selection) {
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        if (rect.width === 0 && rect.height === 0) return;
        
        // 计算工具栏位置，增加距离避免太靠近文本
        const toolbarHeight = 50;
        const toolbarWidth = this.selectionToolbar.offsetWidth;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let toolbarX = rect.left + window.scrollX + rect.width / 2;
        let toolbarY = rect.top + window.scrollY - toolbarHeight - 15; // 增加15px距离
        
        // 边界检查
        if (toolbarX + toolbarWidth > viewportWidth) {
            toolbarX = viewportWidth - toolbarWidth - 10;
        }
        
        if (toolbarX < 10) {
            toolbarX = 10;
        }
        
        if (toolbarY < 10) {
            toolbarY = rect.bottom + window.scrollY + 15; // 如果上方空间不够，显示在下方
        }
        
        this.selectionToolbar.style.left = toolbarX + 'px';
        this.selectionToolbar.style.top = toolbarY + 'px';
        this.selectionToolbar.classList.add('show');
    }

    /**
     * 隐藏选择工具栏
     */
    hideSelectionToolbar() {
        this.selectionToolbar.classList.remove('show');
    }

    /**
     * 渲染目录 - 支持虚拟章节
     */
    renderTOC(toc, sections, onTocItemClick) {
        this.tocContainer.innerHTML = '';
        
        if (this.singleHTMLMode && sections.length > 0) {
            // 单个HTML模式：使用虚拟章节作为目录
            console.log('渲染虚拟章节目录，数量:', sections.length);
            
            sections.forEach((section, index) => {
                if (section.virtualChapter) {
                    const tocItem = document.createElement('div');
                    tocItem.className = 'toc-item level-1';
                    tocItem.textContent = section.chapterTitle || `章节 ${index + 1}`;
                    tocItem.setAttribute('data-chapter-id', section.chapterId);
                    
                    tocItem.addEventListener('click', () => {
                        onTocItemClick({
                            id: section.chapterId,
                            title: section.chapterTitle,
                            section: section
                        });
                        this.hideSidebar();
                    });
                    
                    this.tocContainer.appendChild(tocItem);
                }
            });
        } else if (toc.length === 0) {
            // 正常的多HTML文件但没有TOC
            sections.forEach((section, index) => {
                const tocItem = document.createElement('div');
                tocItem.className = 'toc-item level-1';
                tocItem.textContent = `章节 ${index + 1}`;
                tocItem.addEventListener('click', () => {
                    onTocItemClick(index);
                    this.hideSidebar();
                });
                this.tocContainer.appendChild(tocItem);
            });
        } else {
            // 正常的TOC渲染
            toc.forEach((item, index) => {
                const tocItem = document.createElement('div');
                tocItem.className = 'toc-item level-1';
                tocItem.textContent = item.label;
                tocItem.addEventListener('click', () => {
                    onTocItemClick(item);
                    this.hideSidebar();
                });
                this.tocContainer.appendChild(tocItem);
            });
        }
    }

    /**
     * 更新页面信息显示
     */
    updatePageInfo(currentSection, totalSections, currentPage, totalPages) {
        this.currentPageSpan.textContent = currentPage + 1;
        this.totalPagesSpan.textContent = totalPages;
    }

    /**
     * 更新书籍信息
     */
    updateBookInfo(title, author) {
        if (this.bookTitle) {
            this.bookTitle.textContent = title || 'EPUB 阅读器';
        }
        if (this.bookAuthor) {
            this.bookAuthor.textContent = author || '请上传EPUB文件';
        }
    }

    /**
     * 显示音频播放器
     */
    showAudioPlayer() {
        if (this.playerContainer) {
            this.playerContainer.style.display = 'block';
            console.log('音频播放器已显示');
        } else {
            console.warn('音频播放器元素未找到');
        }
    }

    /**
     * 隐藏音频播放器
     */
    hideAudioPlayer() {
        if (this.playerContainer) {
            this.playerContainer.style.display = 'none';
            console.log('音频播放器已隐藏');
        }
    }

    /**
     * 更新音频进度
     */
    updateAudioProgress(progress, currentTime, duration) {
        if (this.progress) {
            this.progress.style.width = `${progress}%`;
        }
        if (this.currentTimeSpan) {
            this.currentTimeSpan.textContent = this.formatTime(currentTime);
        }
        if (this.durationSpan) {
            this.durationSpan.textContent = this.formatTime(duration);
        }
    }

    /**
     * 更新播放按钮状态
     */
    updatePlayButton(playing) {
        if (this.playPauseBtn) {
            if (playing) {
                this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            } else {
                this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        }
    }

    /**
     * 格式化时间
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    /**
     * 切换侧边栏
     */
    toggleSidebar() {
        this.sidebar.classList.toggle('open');
        this.overlay.classList.toggle('show', this.sidebar.classList.contains('open'));
        if (this.sidebar.classList.contains('open')) {
            this.settingsSidebar.classList.remove('open');
        }
    }

    /**
     * 隐藏侧边栏
     */
    hideSidebar() {
        this.sidebar.classList.remove('open');
        this.overlay.classList.remove('show');
    }

    /**
     * 切换设置面板
     */
    toggleSettingsSidebar() {
        this.settingsSidebar.classList.toggle('open');
        this.overlay.classList.toggle('show', this.settingsSidebar.classList.contains('open'));
        if (this.settingsSidebar.classList.contains('open')) {
            this.sidebar.classList.remove('open');
        }
    }

    /**
     * 隐藏设置面板
     */
    hideSettingsSidebar() {
        this.settingsSidebar.classList.remove('open');
        this.overlay.classList.remove('show');
    }

    /**
     * 显示词典弹窗
     */
    showDictionaryModal() {
        this.dictionaryModal.classList.add('show');
        this.overlay.classList.add('show');
    }

    /**
     * 隐藏词典弹窗
     */
    hideDictionaryModal() {
        this.dictionaryModal.classList.remove('show');
        this.overlay.classList.remove('show');
    }

    /**
     * 更新词典内容
     */
    updateDictionaryContent(html) {
        this.dictionaryContent.innerHTML = html;
    }

    /**
     * 显示Anki按钮
     */
    showAnkiButton() {
        this.dictionaryFooter.style.display = 'block';
    }

    /**
     * 隐藏Anki按钮
     */
    hideAnkiButton() {
        this.dictionaryFooter.style.display = 'none';
    }

    /**
     * 更新Anki设置字段
     */
    updateAnkiFields(decks, models, fields) {
        // 更新牌组选择
        if (this.ankiDeck) {
            this.ankiDeck.innerHTML = '<option value="">选择牌组</option>';
            decks.forEach(deck => {
                const option = document.createElement('option');
                option.value = deck;
                option.textContent = deck;
                this.ankiDeck.appendChild(option);
            });
        }

        // 更新模板选择
        if (this.ankiModel) {
            this.ankiModel.innerHTML = '<option value="">选择模板</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                this.ankiModel.appendChild(option);
            });
        }

        // 更新字段选择
        const fieldSelects = [
            this.ankiWordField,
            this.ankiMeaningField,
            this.ankiSentenceField,
            this.ankiAudioField,
            this.ankiTagsField
        ];

        fieldSelects.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">选择字段</option>';
                fields.forEach(field => {
                    const option = document.createElement('option');
                    option.value = field;
                    option.textContent = field;
                    select.appendChild(option);
                });
            }
        });
    }

    /**
     * 加载Anki设置
     */
    loadAnkiSettings(settings) {
        if (this.ankiHost) this.ankiHost.value = settings.host || '127.0.0.1';
        if (this.ankiPort) this.ankiPort.value = settings.port || 8765;
        if (this.ankiDeck) this.ankiDeck.value = settings.deck || '';
        if (this.ankiModel) this.ankiModel.value = settings.model || '';
        if (this.ankiWordField) this.ankiWordField.value = settings.wordField || '';
        if (this.ankiMeaningField) this.ankiMeaningField.value = settings.meaningField || '';
        if (this.ankiSentenceField) this.ankiSentenceField.value = settings.sentenceField || '';
        if (this.ankiAudioField) this.ankiAudioField.value = settings.audioField || '';
        if (this.ankiTagsField) this.ankiTagsField.value = settings.tagsField || '';
    }

    /**
     * 获取Anki设置
     */
    getAnkiSettings() {
        return {
            host: this.ankiHost ? this.ankiHost.value : '127.0.0.1',
            port: this.ankiPort ? parseInt(this.ankiPort.value) : 8765,
            deck: this.ankiDeck ? this.ankiDeck.value : '',
            model: this.ankiModel ? this.ankiModel.value : '',
            wordField: this.ankiWordField ? this.ankiWordField.value : '',
            meaningField: this.ankiMeaningField ? this.ankiMeaningField.value : '',
            sentenceField: this.ankiSentenceField ? this.ankiSentenceField.value : '',
            audioField: this.ankiAudioField ? this.ankiAudioField.value : '',
            tagsField: this.ankiTagsField ? this.ankiTagsField.value : ''
        };
    }

    /**
     * 显示Toast消息
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    /**
     * 获取文件输入元素
     */
    getFileInput() {
        return this.epubFileInput;
    }

    /**
     * 获取 Multi-column 相关元素
     */
    getMultiColumnElements() {
        return {
            contentWrapper: this.contentWrapper,
            adaptiveContent: this.adaptiveContent,
            bookContainer: this.bookContainer
        };
    }
}

/**
 * 主阅读器类
 */
class EPUBReader {
    constructor() {
        this.currentSection = 0;
        this.sections = [];
        this.toc = [];
        this.isLoading = false;
        this.currentZip = null;
        this.fontSize = 16;
        
        // 音频相关属性
        this.currentAudio = null;
        this.isPlaying = false;
        this.currentAudioData = null;
        this.syncData = [];
        
        // Anki相关属性
        this.anki = new AnkiConnector();
        this.selectedText = '';
        this.currentWordData = null;
        this.savedSelectionRange = null;
        
        // 检查依赖
        if (typeof JSZip === 'undefined') {
            console.error('JSZip库未正确加载');
            this.showError('JSZip库加载失败，请检查网络连接或刷新页面');
            return;
        }
        
        // 初始化各个组件
        this.parser = new EPUBParser();
        this.uiManager = new UIManager(); // 这里会自动调用 setupEventListeners()
        
        // 初始化 Multi-column 分页器
        const multiColumnElements = this.uiManager.getMultiColumnElements();
        this.paginator = new MultiColumnPaginator(
            multiColumnElements.contentWrapper,
            multiColumnElements.adaptiveContent,
            multiColumnElements.bookContainer
        );
        
        this.renderer = new ContentRenderer(multiColumnElements.adaptiveContent);
        
        this.initialize();
    }

    /**
     * 初始化阅读器
     */
    initialize() {
        this.bindUIEvents();
        this.anki.loadSettings();
        this.uiManager.loadAnkiSettings(this.anki.settings);
        
        const fileInput = this.uiManager.getFileInput();
        fileInput.addEventListener('change', (e) => this.loadEPUB(e));
        
        console.log('EPUB阅读器初始化完成');
    }

    /**
     * 绑定 UI 事件处理程序
     */
    bindUIEvents() {
        // 绑定翻页事件
        this.uiManager.onPreviousPage = () => this.previousPage();
        this.uiManager.onNextPage = () => this.nextPage();
        
        // 绑定字体调整事件
        this.uiManager.onFontDecrease = () => this.adjustFontSize(-1);
        this.uiManager.onFontReset = () => this.resetFontSize();
        this.uiManager.onFontIncrease = () => this.adjustFontSize(1);
        
        // 绑定音频控制事件
        this.uiManager.onPlayPause = () => this.togglePlayPause();
        this.uiManager.onSeekAudio = (e) => this.seekAudio(e);
        this.uiManager.onPlaybackRateChange = (rate) => this.changePlaybackRate(rate);
        
        // 绑定窗口调整大小事件
        this.uiManager.onResize = () => this.handleResize();
        
        // 绑定内部链接点击事件
        this.renderer.onInternalLinkClick = (href) => this.handleInternalLink(href);
        
        // 绑定音频相关事件
        this.renderer.onAudioReady = (audioData) => this.prepareAudioPlayer(audioData);
        this.renderer.onPlayAudio = (syncPoint) => this.playAudioSegment(syncPoint);
        
        // 绑定目录项点击事件
        this.uiManager.onTocItemClick = (item) => this.handleTocItemClick(item);
        
        // 绑定分页器页面变化事件
        this.paginator.onPageChange = (currentPage, totalPages, currentSection, totalSections) => {
            this.uiManager.updatePageInfo(currentSection, totalSections, currentPage, totalPages);
        };
        
        // 绑定Anki事件
        this.uiManager.onTestAnkiConnection = () => this.testAnkiConnection();
        this.uiManager.onSaveAnkiSettings = () => this.saveAnkiSettings();
        this.uiManager.onAddToAnki = () => this.addToAnki();
        this.uiManager.onLookupWord = () => this.lookupWord();
        this.uiManager.onHighlightText = () => this.highlightText();
        this.uiManager.onQuickAddToAnki = () => this.quickAddToAnki();
        this.uiManager.onCopyText = () => this.copyText();
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const errorHTML = `
            <div class="no-content" style="color: #e74c3c;">
                <h1>❌ 加载失败</h1>
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    刷新页面
                </button>
            </div>
        `;
        
        if (this.uiManager.adaptiveContent) {
            this.uiManager.adaptiveContent.innerHTML = errorHTML;
        }
    }

    /**
     * 加载 EPUB 文件
     */
    async loadEPUB(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // 显示加载状态
            this.uiManager.showLoading('正在解析EPUB文件...');
            
            const arrayBuffer = await file.arrayBuffer();
            await this.parseEPUB(arrayBuffer);
        } catch (error) {
            console.error('加载EPUB失败:', error);
            this.uiManager.showToast('加载EPUB文件失败，请检查文件格式', 'error');
            this.showError(`加载失败: ${error.message}`);
        } finally {
            // 隐藏加载状态
            this.uiManager.hideLoading();
        }
    }

    /**
     * 解析 EPUB 文件
     */
    async parseEPUB(arrayBuffer) {
        const result = await this.parser.parse(arrayBuffer);
        this.manifest = result.manifest;
        this.sections = result.sections;
        this.toc = result.toc;
        this.currentZip = this.parser.currentZip;
        
        this.renderer.currentZip = this.currentZip;
        
        if (this.sections.length > 0) {
            this.currentSection = 0;
            this.uiManager.renderTOC(this.toc, this.sections, this.handleTocItemClick.bind(this));
            await this.renderCurrentSection();
        }
    }

    /**
     * 渲染当前章节
     */
    async renderCurrentSection() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        await this.loadAndRenderSection(this.currentSection);
        this.isLoading = false;
    }

    /**
     * 加载并渲染章节内容
     */
    async loadAndRenderSection(sectionIndex) {
        try {
            const section = this.sections[sectionIndex];
            console.log(`正在加载章节: ${section.href}, 章节索引: ${sectionIndex}`);
            console.log('章节完整信息:', section);
            
            const content = await this.parser.getSectionContent(sectionIndex);
            const audioData = section.audio;
            
            console.log('章节音频数据:', audioData);
            console.log('章节媒体覆盖属性:', section.mediaOverlay);
            console.log('章节媒体覆盖数据:', section.mediaOverlayData);
            
            // 渲染内容
            await this.renderer.renderSection(content, section, audioData);
            
            // 如果有音频数据，准备音频播放器
            if (audioData && audioData.audioSrc) {
                console.log('章节有音频数据，准备音频播放器');
                await this.prepareAudioPlayer(audioData);
            } else {
                console.log('章节没有音频数据，隐藏音频播放器');
                console.log('可能的原因:');
                console.log('- 章节没有 media-overlay 属性');
                console.log('- 媒体覆盖文件未找到');
                console.log('- 音频文件路径解析失败');
                this.uiManager.hideAudioPlayer();
            }
            
            // 重置分页器到第一页
            this.paginator.currentPage = 0;
            console.log(`切换到章节 ${sectionIndex + 1}, 重置页数为 0`);
            
            // 设置分页器字体大小和章节信息
            this.paginator.setFontSize(this.fontSize);
            this.paginator.setSectionInfo(this.currentSection, this.sections.length);
            
            // 重新分页
            this.paginator.rePaginate();
            
        } catch (error) {
            console.error('加载章节失败:', error);
            this.renderer.renderSection(null, this.sections[sectionIndex]);
        }
    }

    /**
     * 准备音频播放器 - 修复音频播放器显示和路径问题
     */
    async prepareAudioPlayer(audioData) {
        try {
            console.log('准备音频播放器:', audioData);
            
            if (!audioData || !audioData.audioSrc) {
                console.warn('音频数据不完整:', audioData);
                return;
            }
            
            // 显示音频播放器
            this.uiManager.showAudioPlayer();
            this.currentAudioData = audioData;
            this.syncData = audioData.syncData || [];
            
            console.log('开始获取音频Blob:', audioData.audioSrc);
            
            // 获取音频Blob
            const audioBlob = await this.parser.getAudioBlob(audioData.audioSrc);
            if (!audioBlob) {
                throw new Error('无法加载音频文件: ' + audioData.audioSrc);
            }
            
            console.log('音频Blob加载成功, 类型:', audioBlob.type, '大小:', audioBlob.size);
            
            // 创建音频对象
            const audioUrl = URL.createObjectURL(audioBlob);
            this.currentAudio = new Audio(audioUrl);
            
            // 设置音频事件监听 - 添加这行
            this.setupAudioEvents();
            
            // 等待音频可以播放
            await this.waitForAudioReady();
            
            console.log('音频播放器准备完成');
            
        } catch (error) {
            console.error('准备音频播放器失败:', error);
            this.handleAudioError(error, audioData);
        }
    }

    /**
     * 处理音频错误
     */
    handleAudioError(error, audioData) {
        this.uiManager.showToast('音频加载失败: ' + error.message, 'error');
        this.uiManager.hideAudioPlayer();
        
        // 显示详细的错误信息
        this.showAudioError(error.message, audioData);
    }

    /**
     * 等待音频准备就绪
     */
    async waitForAudioReady() {
        return new Promise((resolve, reject) => {
            const canPlayHandler = () => {
                console.log('音频可以播放，准备状态:', this.currentAudio.readyState);
                this.currentAudio.removeEventListener('canplaythrough', canPlayHandler);
                resolve();
            };
            
            const errorHandler = (e) => {
                console.error('音频加载错误:', e, this.currentAudio.error);
                this.currentAudio.removeEventListener('error', errorHandler);
                reject(new Error('音频无法播放: ' + (this.currentAudio.error?.message || e.message)));
            };
            
            this.currentAudio.addEventListener('canplaythrough', canPlayHandler);
            this.currentAudio.addEventListener('error', errorHandler);
            
            // 超时处理
            setTimeout(() => {
                this.currentAudio.removeEventListener('canplaythrough', canPlayHandler);
                this.currentAudio.removeEventListener('error', errorHandler);
                reject(new Error('音频加载超时，当前状态: ' + this.currentAudio.readyState));
            }, 15000);
        });
    }

    /**
     * 设置音频事件监听 - 修复事件处理
     */
    setupAudioEvents() {
        this.currentAudio.addEventListener('loadedmetadata', () => {
            console.log('音频元数据加载完成, 时长:', this.currentAudio.duration, '状态:', this.currentAudio.readyState);
            this.uiManager.updateAudioProgress(0, 0, this.currentAudio.duration);
            this.uiManager.showToast('音频加载完成', 'success');
        });
        
        this.currentAudio.addEventListener('canplay', () => {
            console.log('音频可以播放, 状态:', this.currentAudio.readyState);
        });
        
        this.currentAudio.addEventListener('canplaythrough', () => {
            console.log('音频可以流畅播放, 状态:', this.currentAudio.readyState);
        });
        
        this.currentAudio.addEventListener('timeupdate', () => {
            this.updateAudioProgress();
            // 实时高亮文本
            if (this.renderer && this.renderer.highlightByTime) {
                this.renderer.highlightByTime(this.currentAudio.currentTime);
            }
        });
        
        this.currentAudio.addEventListener('ended', () => {
            console.log('音频播放结束');
            this.isPlaying = false;
            this.uiManager.updatePlayButton(false);
            if (this.renderer) {
                this.renderer.clearHighlights();
            }
        });
        
        this.currentAudio.addEventListener('error', (e) => {
            console.error('音频播放错误:', e);
            console.error('音频错误详情:', this.currentAudio.error);
            this.uiManager.showToast('音频播放失败: ' + (this.currentAudio.error?.message || '未知错误'), 'error');
        });
        
        this.currentAudio.addEventListener('waiting', () => {
            console.log('音频等待数据加载...');
        });
        
        this.currentAudio.addEventListener('playing', () => {
            console.log('音频开始播放');
        });
    }

    /**
     * 显示音频错误信息
     */
    showAudioError(message, audioData) {
        const errorHTML = `
            <div style="background: #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 4px; font-size: 14px;">
                <strong>音频加载提示:</strong>
                <p>${message}</p>
                <details style="margin-top: 5px;">
                    <summary>详细信息</summary>
                    <div style="font-family: monospace; font-size: 12px; margin-top: 5px;">
                        音频路径: ${audioData?.audioSrc || '未知'}<br>
                        同步点数量: ${audioData?.syncData?.length || 0}<br>
                        文件格式: ${audioData?.audioSrc?.split('.').pop() || '未知'}
                    </div>
                </details>
            </div>
        `;
        
        // 在内容区域顶部显示错误信息
        const existingError = this.renderer.containerElement.querySelector('.audio-error');
        if (existingError) {
            existingError.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'audio-error';
        errorDiv.innerHTML = errorHTML;
        this.renderer.containerElement.insertBefore(errorDiv, this.renderer.containerElement.firstChild);
    }


    /**
     * 播放音频片段 - 修复播放逻辑
     */
    async playAudioSegment(syncPoint) {
        console.log('播放音频片段:', syncPoint);
        
        try {
            // 检查是否需要切换音频文件
            if (this.shouldSwitchAudio(syncPoint)) {
                console.log('需要切换到新音频文件:', syncPoint.audioSrc);
                await this.switchAudioFile(syncPoint);
            }
            
            // 设置播放位置
            if (this.currentAudio) {
                console.log(`设置播放位置: ${syncPoint.start}s, 当前音频时长: ${this.currentAudio.duration}`);
                this.currentAudio.currentTime = syncPoint.start;
                
                await this.playAudio();
                this.uiManager.showToast('开始播放', 'success');
            } else {
                this.uiManager.showToast('音频未准备好', 'warning');
            }
        } catch (error) {
            console.error('播放音频失败:', error);
            this.uiManager.showToast('播放失败: ' + error.message, 'error');
        }
    }

    /**
     * 切换到新的音频文件
     */
    async switchAudioFile(syncPoint) {
        try {
            console.log('切换到新音频文件:', syncPoint.audioSrc);
            
            // 解析完整的音频路径
            const fullAudioPath = this.resolveAudioPath(this.currentAudioData.smilPath, syncPoint.audioSrc);
            console.log('完整音频路径:', fullAudioPath);
            
            // 获取新的音频Blob
            const audioBlob = await this.parser.getAudioBlob(fullAudioPath);
            if (!audioBlob) {
                throw new Error('无法加载音频文件: ' + fullAudioPath);
            }
            
            console.log('新音频文件加载成功, 大小:', audioBlob.size);
            
            // 清理旧的音频资源
            if (this.currentAudio) {
                this.currentAudio.pause();
                if (this.currentAudio.src) {
                    URL.revokeObjectURL(this.currentAudio.src);
                }
            }
            
            // 创建新的音频对象
            const audioUrl = URL.createObjectURL(audioBlob);
            this.currentAudio = new Audio(audioUrl);
            
            // 更新当前音频数据
            this.currentAudioData = {
                ...this.currentAudioData,
                audioSrc: fullAudioPath
            };
            
            // 设置音频事件监听
            this.setupAudioEvents();
            
            // 等待新音频加载
            await this.waitForAudioReady();
            
            console.log('音频文件切换完成');
            
        } catch (error) {
            console.error('切换音频文件失败:', error);
            throw error;
        }
    }

    /**
     * 解析音频路径 - 修复路径解析
     */
    resolveAudioPath(smilPath, audioSrc) {
        if (!audioSrc) return '';
        
        console.log('解析音频路径:', { smilPath, audioSrc });
        
        // 处理相对路径
        if (audioSrc.startsWith('../')) {
            // 获取SMIL文件所在目录
            const smilDir = smilPath.substring(0, smilPath.lastIndexOf('/') + 1);
            // 解析相对路径
            const relativePath = audioSrc.substring(3); // 移除 ../
            const result = smilDir + relativePath;
            console.log('相对路径解析结果:', result);
            return result;
        }
        
        if (audioSrc.startsWith('./')) {
            const smilDir = smilPath.substring(0, smilPath.lastIndexOf('/') + 1);
            const relativePath = audioSrc.substring(2); // 移除 ./
            const result = smilDir + relativePath;
            console.log('相对路径解析结果:', result);
            return result;
        }
        
        // 如果是绝对路径，移除开头的斜杠
        if (audioSrc.startsWith('/')) {
            const result = audioSrc.substring(1);
            console.log('绝对路径解析结果:', result);
            return result;
        }
        
        // 默认情况下，相对于SMIL文件所在目录
        const smilDir = smilPath.substring(0, smilPath.lastIndexOf('/') + 1);
        const result = smilDir + audioSrc;
        console.log('默认路径解析结果:', result);
        return result;
    }


    /**
     * 检查是否需要切换音频文件
     */
    shouldSwitchAudio(syncPoint) {
        if (!this.currentAudioData) return true;
        
        // 如果当前音频文件与目标音频文件不同，需要切换
        const currentAudioSrc = this.currentAudioData.audioSrc;
        
        // 使用当前音频数据的smilPath来解析目标音频路径
        const targetAudioSrc = this.resolveAudioPath(this.currentAudioData.smilPath, syncPoint.audioSrc);
        
        console.log('音频文件检查:', {
            current: currentAudioSrc,
            target: targetAudioSrc,
            needsSwitch: currentAudioSrc !== targetAudioSrc
        });
        
        return currentAudioSrc !== targetAudioSrc;
    }

    /**
     * 播放音频 - 修复状态检测
     */
    async playAudio() {
        if (!this.currentAudio) {
            console.warn('没有可用的音频对象');
            this.uiManager.showToast('没有可用的音频', 'warning');
            return;
        }
        
        try {
            // 检查音频状态
            console.log('音频状态检查:', {
                readyState: this.currentAudio.readyState,
                networkState: this.currentAudio.networkState,
                error: this.currentAudio.error
            });
            
            // readyState 说明:
            // 0 = HAVE_NOTHING - 没有信息
            // 1 = HAVE_METADATA - 元数据就绪
            // 2 = HAVE_CURRENT_DATA - 当前帧数据就绪，但不足以播放
            // 3 = HAVE_FUTURE_DATA - 当前及至少下一帧数据就绪
            // 4 = HAVE_ENOUGH_DATA - 足够数据可以流畅播放
            
            if (this.currentAudio.readyState >= 1) {
                // 至少有元数据，可以尝试播放
                console.log('开始播放音频，时长:', this.currentAudio.duration);
                await this.currentAudio.play();
                this.isPlaying = true;
                this.uiManager.updatePlayButton(true);
                console.log('音频播放开始');
            } else {
                console.warn('音频仍在加载中，准备状态:', this.currentAudio.readyState);
                this.uiManager.showToast('音频仍在加载中...', 'info');
                
                // 等待音频加载
                await new Promise((resolve, reject) => {
                    const canPlayHandler = () => {
                        this.currentAudio.removeEventListener('canplay', canPlayHandler);
                        resolve();
                    };
                    
                    this.currentAudio.addEventListener('canplay', canPlayHandler);
                    
                    setTimeout(() => {
                        this.currentAudio.removeEventListener('canplay', canPlayHandler);
                        reject(new Error('音频加载超时'));
                    }, 5000);
                });
                
                // 重新尝试播放
                await this.currentAudio.play();
                this.isPlaying = true;
                this.uiManager.updatePlayButton(true);
            }
            
        } catch (error) {
            console.error('播放音频失败:', error);
            this.isPlaying = false;
            this.uiManager.updatePlayButton(false);
            
            // 提供更具体的错误信息
            let errorMessage = '播放失败';
            if (error.name === 'NotAllowedError') {
                errorMessage = '播放被浏览器阻止，请点击页面任意位置后重试';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = '不支持的音频格式';
            } else {
                errorMessage = `播放失败: ${error.message}`;
            }
            
            this.uiManager.showToast(errorMessage, 'error');
        }
    }

    /**
     * 暂停音频
     */
    pauseAudio() {
        if (!this.currentAudio) return;
        
        this.currentAudio.pause();
        this.isPlaying = false;
        this.uiManager.updatePlayButton(false);
    }

    /**
     * 切换播放/暂停
     */
    togglePlayPause() {
        if (this.isPlaying) {
            this.pauseAudio();
        } else {
            this.playAudio();
        }
    }

    /**
     * 更新音频进度
     */
    updateAudioProgress() {
        if (!this.currentAudio) return;
        
        const progress = (this.currentAudio.currentTime / this.currentAudio.duration) * 100;
        this.uiManager.updateAudioProgress(progress, this.currentAudio.currentTime, this.currentAudio.duration);
    }

    /**
     * 跳转音频进度
     */
    seekAudio(e) {
        if (!this.currentAudio) return;
        
        const rect = this.uiManager.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.currentAudio.currentTime = percent * this.currentAudio.duration;
    }

    /**
     * 改变播放速度
     */
    changePlaybackRate(rate) {
        if (this.currentAudio) {
            this.currentAudio.playbackRate = parseFloat(rate);
        }
    }

    /**
     * 调整字体大小
     */
    adjustFontSize(delta) {
        const oldFontSize = this.fontSize;
        this.fontSize = Math.max(12, Math.min(24, this.fontSize + delta));
        
        if (oldFontSize !== this.fontSize) {
            console.log(`字体大小从 ${oldFontSize} 调整为 ${this.fontSize}`);
            this.renderer.setFontSize(this.fontSize);
            this.paginator.setFontSize(this.fontSize);
            this.paginator.rePaginate();
        }
    }

    /**
     * 重置字体大小
     */
    resetFontSize() {
        if (this.fontSize !== 16) {
            console.log('重置字体大小');
            this.fontSize = 16;
            this.renderer.setFontSize(this.fontSize);
            this.paginator.setFontSize(this.fontSize);
            this.paginator.rePaginate();
        }
    }

    /**
     * 处理窗口大小改变
     */
    handleResize() {
        if (this.sections.length > 0) {
            console.log('窗口大小改变，重新分页...');
            setTimeout(() => this.paginator.rePaginate(), 200);
        }
    }

    /**
     * 处理内部链接
     */
    handleInternalLink(href) {
        const targetHref = href.split('#')[0];
        const sectionIndex = this.sections.findIndex(section => 
            section.href === targetHref || section.href.endsWith(targetHref)
        );
        
        if (sectionIndex !== -1) {
            this.jumpToSection(sectionIndex);
        }
    }

    /**
     * 处理目录项点击
     */
    handleTocItemClick(item) {
        if (this.singleHTMLMode) {
            // 单个HTML模式下的跳转
            this.jumpToVirtualChapter(item);
        } else {
            // 正常的多HTML文件跳转
            if (typeof item === 'number') {
                this.jumpToSection(item);
            } else {
                this.jumpToTOCItem(item);
            }
        }
    }

    /**
     * 跳转到虚拟章节（单个HTML模式）
     */
    async jumpToVirtualChapter(chapterInfo) {
        if (this.singleHTMLMode && this.sections.length > 0) {
            // 找到对应的虚拟章节
            const targetSection = this.sections.find(s => 
                s.chapterId === chapterInfo.id || s.originalId === chapterInfo.id
            );
            
            if (targetSection) {
                console.log(`跳转到虚拟章节: ${targetSection.chapterTitle}`);
                
                // 加载主HTML内容
                await this.loadAndRenderSection(0); // 加载第一个section（主HTML）
                
                // 滚动到对应章节
                this.scrollToVirtualChapter(targetSection);
                
                // 准备对应的音频
                if (targetSection.audio) {
                    await this.prepareAudioPlayer(targetSection.audio);
                }
            }
        }
    }

    /**
     * 滚动到虚拟章节
     */
    scrollToVirtualChapter(section) {
        if (section.startElement) {
            // 如果已经有DOM元素引用，直接滚动
            section.startElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        } else {
            // 通过ID查找元素并滚动
            const element = document.getElementById(section.chapterId);
            if (element) {
                element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        }
    }

    /**
     * 跳转到目录项
     */
    async jumpToTOCItem(tocItem) {
        const src = tocItem.src.split('#')[0];
        const sectionIndex = this.sections.findIndex(section => 
            section.href === src || section.href.endsWith(src)
        );
        
        if (sectionIndex !== -1) {
            this.currentSection = sectionIndex;
            await this.renderCurrentSection();
        }
    }

    /**
     * 跳转到指定章节
     */
    jumpToSection(sectionIndex) {
        if (sectionIndex >= 0 && sectionIndex < this.sections.length) {
            console.log(`跳转到章节: ${sectionIndex + 1}, 当前章节: ${this.currentSection + 1}`);
            this.currentSection = sectionIndex;
            this.renderCurrentSection();
        }
    }

    /**
     * 下一页
     */
    nextPage() {
        console.log('下一页被触发, 当前页:', this.paginator.currentPage + 1, '总页数:', this.paginator.totalPages);
        if (!this.paginator.nextPage()) {
            // 当前章节的最后一页，跳到下一章节的第一页
            if (this.currentSection < this.sections.length - 1) {
                console.log('切换到下一章节');
                this.currentSection++;
                this.renderCurrentSection();
            } else {
                console.log('已经是最后一页');
            }
        }
    }

    /**
     * 上一页
     */
    previousPage() {
        console.log('上一页被触发, 当前页:', this.paginator.currentPage + 1, '总页数:', this.paginator.totalPages);
        if (!this.paginator.previousPage()) {
            // 当前章节的第一页，跳到上一章节的最后一页
            if (this.currentSection > 0) {
                console.log('切换到上一章节');
                this.currentSection--;
                this.renderCurrentSection().then(() => {
                    // 跳转到上一章节的最后一页
                    this.paginator.goToPage(this.paginator.totalPages - 1);
                });
            } else {
                console.log('已经是第一页');
            }
        }
    }

    /**
     * 测试Anki连接
     */
    async testAnkiConnection() {
        this.uiManager.showToast('正在测试Anki连接...', 'info');
        
        const result = await this.anki.testConnection();
        if (result.success) {
            this.uiManager.showToast(`Anki连接成功! 版本: ${result.version}`, 'success');
            
            // 加载牌组和模板
            try {
                const decks = await this.anki.getDecks();
                const models = await this.anki.getModels();
                let fields = [];
                
                if (models.length > 0) {
                    fields = await this.anki.getModelFields(models[0]);
                }
                
                this.uiManager.updateAnkiFields(decks, models, fields);
            } catch (error) {
                console.error('加载Anki数据失败:', error);
                this.uiManager.showToast('加载Anki数据失败', 'error');
            }
        } else {
            this.uiManager.showToast(`Anki连接失败: ${result.error}`, 'error');
        }
    }

    /**
     * 保存Anki设置
     */
    saveAnkiSettings() {
        const settings = this.uiManager.getAnkiSettings();
        this.anki.settings = settings;
        this.anki.host = settings.host;
        this.anki.port = settings.port;
        this.anki.saveSettings();
        
        this.uiManager.showToast('Anki设置已保存', 'success');
    }

    /**
     * 查询单词
     */
    async lookupWord() {
        const selection = window.getSelection();
        this.selectedText = selection.toString().trim();
        
        if (!this.selectedText) {
            this.uiManager.showToast('请先选择文本', 'warning');
            return;
        }
        
        this.uiManager.showDictionaryModal();
        this.uiManager.updateDictionaryContent(`
            <div class="loading">
                <div class="loader"></div>
                <p>查询 "${this.selectedText}"...</p>
            </div>
        `);
        
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(this.selectedText)}`);
            
            if (!response.ok) {
                throw new Error('未找到该词的释义');
            }
            
            const data = await response.json();
            this.currentWordData = data[0];
            this.displayDictionaryResult(data[0]);
            this.uiManager.showAnkiButton();
            
        } catch (error) {
            console.error('词典查询失败:', error);
            this.displayDictionaryError(error);
        }
    }

    /**
     * 显示词典结果
     */
    displayDictionaryResult(wordData) {
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
        this.uiManager.updateDictionaryContent(html);
    }

    /**
     * 显示词典错误
     */
    displayDictionaryError(error) {
        this.uiManager.updateDictionaryContent(`
            <div class="error">
                <p>查询失败: ${error.message}</p>
                <p>请检查网络连接或尝试其他单词</p>
            </div>
        `);
    }

    /**
     * 添加到Anki
     */
    async addToAnki() {
        if (!this.selectedText || !this.currentWordData) {
            this.uiManager.showToast('请先查询单词释义', 'warning');
            return;
        }
        
        if (!this.anki.connected) {
            const result = await this.anki.testConnection();
            if (!result.success) {
                this.uiManager.showToast('请先连接Anki', 'error');
                return;
            }
        }
        
        if (!this.anki.settings.deck || !this.anki.settings.model) {
            this.uiManager.showToast('请先配置Anki牌组和模板', 'warning');
            return;
        }
        
        try {
            this.uiManager.showToast('正在创建Anki卡片...', 'info');
            
            const fields = {
                [this.anki.settings.wordField]: this.selectedText
            };
            
            // 添加释义
            if (this.anki.settings.meaningField && this.currentWordData.meanings) {
                const meaning = this.currentWordData.meanings[0];
                if (meaning) {
                    const definition = meaning.definitions[0]?.definition || '暂无释义';
                    fields[this.anki.settings.meaningField] = `${meaning.partOfSpeech || ''} ${definition}`.trim();
                }
            }
            
            // 添加例句
            if (this.anki.settings.sentenceField) {
                // 这里可以添加获取当前句子的逻辑
                fields[this.anki.settings.sentenceField] = this.selectedText;
            }
            
            // 添加音频
            if (this.anki.settings.audioField && this.currentAudio) {
                try {
                    const audioClip = await this.createAudioClip(this.selectedText);
                    if (audioClip) {
                        const filename = `audio_${this.selectedText}_${Date.now()}.mp3`;
                        const base64Data = await this.blobToBase64(audioClip);
                        const stored = await this.anki.storeMediaFile(filename, base64Data.split(',')[1]);
                        
                        if (stored) {
                            fields[this.anki.settings.audioField] = `[sound:${filename}]`;
                        }
                    }
                } catch (error) {
                    console.warn('添加音频失败:', error);
                }
            }
            
            // 添加标签
            if (this.anki.settings.tagsField) {
                fields[this.anki.settings.tagsField] = 'epub-reader';
            }
            
            const note = this.anki.createNote(fields, ['epub-reader']);
            const result = await this.anki.addNote(note);
            
            this.uiManager.showToast('卡片已成功添加到Anki!', 'success');
            this.uiManager.hideDictionaryModal();
            
        } catch (error) {
            console.error('添加Anki卡片失败:', error);
            this.uiManager.showToast(`添加失败: ${error.message}`, 'error');
        }
    }

    /**
     * 快速添加到Anki
     */
    async quickAddToAnki() {
        const selection = window.getSelection();
        this.selectedText = selection.toString().trim();
        
        if (!this.selectedText) {
            this.uiManager.showToast('请先选择文本', 'warning');
            return;
        }
        
        await this.addToAnki();
    }

    /**
     * 高亮文本
     */
    highlightText() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const highlight = this.renderer.addUserHighlight(range);
        
        if (highlight) {
            this.uiManager.showToast('文本已高亮', 'success');
            this.uiManager.hideSelectionToolbar();
            selection.removeAllRanges();
        } else {
            this.uiManager.showToast('无法高亮此文本', 'error');
        }
    }

    /**
     * 复制文本
     */
    copyText() {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            this.uiManager.showToast('文本已复制', 'success');
            this.uiManager.hideSelectionToolbar();
            selection.removeAllRanges();
        }).catch(() => {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.uiManager.showToast('文本已复制', 'success');
            this.uiManager.hideSelectionToolbar();
            selection.removeAllRanges();
        });
    }

    /**
     * 创建音频片段
     */
    async createAudioClip(word) {
        // 这里可以实现从当前音频中提取对应单词的音频片段
        // 由于复杂度较高，这里返回null，实际使用时需要根据SMIL数据实现
        return null;
    }

    /**
     * Blob转Base64
     */
    blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }
}

// 初始化阅读器
document.addEventListener('DOMContentLoaded', () => {
    // 检查JSZip是否加载
    if (typeof JSZip === 'undefined') {
        console.error('JSZip未加载');
        const adaptiveContent = document.getElementById('adaptiveContent');
        if (adaptiveContent) {
            adaptiveContent.innerHTML = `
                <div class="no-content" style="color: #e74c3c;">
                    <h1>❌ 依赖库加载失败</h1>
                    <p>JSZip库未能正确加载，请检查网络连接并刷新页面</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        刷新页面
                    </button>
                </div>
            `;
        }
        return;
    }
    
    // 初始化阅读器
    new EPUBReader();
});