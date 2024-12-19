// ==UserScript==
// @name         禅道甘特图插件
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  在禅道执行页面添加甘特图展示
// @author       Your Name
// @match        http://192.168.110.9:90/**
// @grant        GM_addStyle
// @grant        unsafeWindow
// @require      https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.js
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = true;
    let ajaxRequestCount = 0;
    let lastRequestTime = 0;
    let initializationTimer = null;
    const INITIALIZATION_DELAY = 1000; // 等待1秒后初始化
    const QUIET_PERIOD = 500; // 500ms内没有新请求就认为加载完成
    let isInitialized = false; // 添加初始化标志

    // 添加固定的日志面板样式
    GM_addStyle(`
        #gantt-log-panel {
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 300px;
            height: 200px;
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 10px;
            font-size: 12px;
            overflow-y: auto;
            z-index: 9999;
            display: block;
        }
        #gantt-chart-btn {
            margin-left: 10px;
            padding: 6px 12px;
            color: #fff;
            background-color: #006af1;
            border-radius: 3px;
            border: none;
            cursor: pointer;
        }
        #gantt-container {
            width: 100%;
            height: 600px;
            margin-top: 20px;
            background: white;
            border: 1px solid #ddd;
        }
    `);

    // 创建日志面板
    function createLogPanel() {
        const panel = document.createElement('div');
        panel.id = 'gantt-log-panel';
        document.body.appendChild(panel);
        return panel;
    }

    // 改进的日志函数
    function log(message) {
        if (!DEBUG) return;

        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;

        console.log('[甘特图插件]', logMessage);

        let panel = document.getElementById('gantt-log-panel');
        if (!panel) {
            panel = createLogPanel();
        }

        const logLine = document.createElement('div');
        logLine.textContent = logMessage;
        panel.appendChild(logLine);
        panel.scrollTop = panel.scrollHeight;
    }

    // 等待元素出现
    function waitForElement(selector, callback, maxAttempts = 50) {
        let attempts = 0;

        function check() {
            attempts++;
            log(`尝试查找元素 ${selector} (${attempts}/${maxAttempts})`);

            // 首先检查主文档的工具栏
            const mainToolbar = document.querySelector('#actionBar');
            if (mainToolbar) {
                log('在主文档中找到工具栏');
                callback(mainToolbar);
                return;
            }

            // 检查所有iframe
            const frames = Array.from(document.querySelectorAll('iframe'));
            for (const frame of frames) {
                try {
                    const frameDoc = frame.contentDocument || frame.contentWindow.document;
                    log('检查iframe中的工具栏');

                    // 检查iframe中的工具栏
                    const frameToolbar = frameDoc.querySelector('#actionBar');
                    if (frameToolbar) {
                        log('在iframe中找到工具栏');
                        callback(frameToolbar);
                        return;
                    }
                } catch (e) {
                    log(`无法访问iframe: ${e.message}`);
                }
            }

            if (attempts < maxAttempts) {
                setTimeout(check, 200);
            } else {
                log('未能找到工具栏');
            }
        }

        check();
    }

    // 创建甘特图按钮
    function createGanttButton() {
        log('尝试创建甘特图按钮');

        // 创建按钮
        const button = document.createElement('button');
        button.id = 'gantt-chart-btn';
        button.type = 'button';
        button.className = 'toolbar-item ghost btn btn-default';
        button.innerHTML = '<i class="icon icon-bar-chart"></i><span class="text">甘特图</span>';

        // 绑定点击事件
        button.onclick = function() {
            log('甘特图按钮被点击');
            toggleGanttChart();
        };

        log('甘特图按钮已创建');
        return button;
    }

    // 切换甘特图显示
    function toggleGanttChart() {
        log('切换甘特图显示');
        
        // 查找所有 iframe
        const frames = Array.from(document.querySelectorAll('iframe'));
        let container = null;
        let frameDoc = null;
        
        // 首先在主文档中查找
        container = document.getElementById('gantt-container');
        
        // 如果主文档中没有找到，则在 iframe 中查找
        if (!container) {
            for (const frame of frames) {
                try {
                    frameDoc = frame.contentDocument || frame.contentWindow.document;
                    container = frameDoc.getElementById('gantt-container');
                    if (container) {
                        log('在iframe中找到甘特图容器');
                        break;
                    }
                } catch (e) {
                    log(`无法访问iframe: ${e.message}`);
                }
            }
        }

        if (container) {
            if (container.style.display === 'none') {
                container.style.display = 'block';
                // 显示时初始化甘特图
                initializeGanttChart(container, frameDoc || document);
            } else {
                container.style.display = 'none';
            }
        } else {
            log('未找到甘特图容器');
        }
    }

    // 修改 initializeGanttChart 函数
    function initializeGanttChart(container, doc) {
        log('初始化甘特图内容');
        
        // 获取任务数据
        const tasks = {
            data: []
        };
        
        // 从表格中获取任务数据
        const taskCells = doc.querySelectorAll('.dtable-cell[data-col="name"]');
        if (!taskCells || taskCells.length === 0) {
            log('未找到任务单元格');
            return;
        }

        log(`找到 ${taskCells.length} 个任务单元格`);

        taskCells.forEach((cell) => {
            try {
                const row = cell.closest('.dtable-row');
                if (!row) return;

                const id = row.getAttribute('data-id');
                if (!id) return;

                const nameLink = cell.querySelector('a');
                const name = nameLink ? nameLink.textContent.trim() : '';

                const estStartedCell = doc.querySelector(`.dtable-cell[data-row="${id}"][data-col="estStarted"]`);
                const deadlineCell = doc.querySelector(`.dtable-cell[data-row="${id}"][data-col="deadline"]`);
                const progressCell = doc.querySelector(`.dtable-cell[data-row="${id}"][data-col="progress"]`);

                const estStarted = estStartedCell ? estStartedCell.textContent.trim() : '';
                const deadline = deadlineCell ? deadlineCell.textContent.trim() : '';
                let progress = 0;

                if (progressCell) {
                    const progressText = progressCell.querySelector('text');
                    if (progressText) {
                        progress = parseInt(progressText.textContent) / 100;
                    }
                }

                const taskData = {
                    id: id,
                    text: name || `Task ${id}`,
                    start_date: estStarted || new Date().toISOString().split('T')[0],
                    end_date: deadline || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
                    progress: progress,
                    open: true
                };

                tasks.data.push(taskData);
                log(`添加任务: ${taskData.text}, 开始: ${taskData.start_date}, 结束: ${taskData.end_date}, 进度: ${taskData.progress}`);
            } catch (error) {
                log(`处理任务行时出错: ${error.message}`);
            }
        });

        log(`处理完成 ${tasks.data.length} 个任务数据`);

        // 配置甘特图
        gantt.config.date_format = "%Y-%m-%d";
        gantt.config.scale_height = 50;
        gantt.config.row_height = 30;
        gantt.config.min_column_width = 40;
        gantt.config.scales = [
            {unit: "month", step: 1, format: "%Y年 %m月"},
            {unit: "day", step: 1, format: "%d日"}
        ];

        // 设置中文
        gantt.i18n.setLocale({
            date: {
                month_full: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
                month_short: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
                day_full: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
                day_short: ["日", "一", "二", "三", "四", "五", "六"]
            }
        });

        // 配置甘特图显示
        gantt.config.columns = [
            {name: "text", label: "任务名称", tree: true, width: 200},
            {name: "start_date", label: "开始时间", align: "center", width: 100},
            {name: "end_date", label: "结束时间", align: "center", width: 100},
            {name: "progress", label: "进度", align: "center", width: 80, template: function(obj) {
                return Math.round(obj.progress * 100) + "%";
            }}
        ];

        // 初始化甘特图
        try {
            gantt.init(container);
            gantt.parse(tasks);
            log('甘特图初始化成功');
        } catch (error) {
            log(`甘特图初始化失败: ${error.message}`);
        }
    }

    // 检查是否应该初始化
    function shouldInitialize() {
        const url = window.location.href;
        const params = new URLSearchParams(window.location.search);
        let module = params.get('m');
        let method = params.get('f');
        
        // 处理跳转页面的情况
        const openParam = params.get('open');
        if (openParam) {
            try {
                // 解码 base64 参数
                const decodedUrl = atob(openParam);
                const targetParams = new URLSearchParams(decodedUrl.split('?')[1]);
                module = targetParams.get('m') || module;
                method = targetParams.get('f') || method;
            } catch (e) {
                log(`解析open参数失败: ${e.message}`);
            }
        }

        log(`当前URL: ${url}`);
        log(`实际模块: ${module}, 实际方法: ${method}`);

        // 只在执行和项目模块的任务列表页面初始化
        const validModules = ['execution', 'project'];
        const validMethods = ['task', 'browse', 'view'];

        if (!validModules.includes(module)) {
            log(`当前模块 ${module} 不需要初始化甘特图`);
            return false;
        }

        if (method && !validMethods.includes(method)) {
            log(`当前方法 ${method} 不需要初始化甘特图`);
            return false;
        }

        log('当前页面需要初始化甘特图');
        return true;
    }

    // 主函数
    function main() {
        log('脚本开始执行');

        // 只在需要的页面设置监听器
        if (shouldInitialize()) {
            // 初始尝试
            setTimeout(() => {
                if (!isInitialized) {
                    log('执行初始化');
                    initGantt();
                    isInitialized = true;
                }
            }, 1000);

            // 监听页面变化
            const observer = new MutationObserver((mutations) => {
                let shouldInit = false;
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' &&
                        (mutation.target.id === 'mainContent' ||
                         mutation.target.className?.includes('main-actions'))) {
                        shouldInit = true;
                        break;
                    }
                }
                if (shouldInit && !isInitialized) {
                    log('检测到页面变化，重新初始化');
                    initGantt();
                    isInitialized = true;
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            log('DOM监听器已设置');
        } else {
            log('当前页面不需要初始化甘特图');
        }
    }

    // 修改 initGantt 函数
    function initGantt() {
        log('开始初始化甘特图');

        // 等待页面完全加载
        setTimeout(() => {
            // 首先尝试在主文档中查找
            let toolbar = document.querySelector('#actionBar');
            let mainContent = document.querySelector('#mainContent');

            // 如果在主文档中没找到，则查找所有 iframe
            if (!toolbar || !mainContent) {
                const frames = Array.from(document.querySelectorAll('iframe'));
                for (const frame of frames) {
                    try {
                        const frameDoc = frame.contentDocument || frame.contentWindow.document;
                        toolbar = frameDoc.querySelector('#actionBar');
                        mainContent = frameDoc.querySelector('#mainContent');
                        if (toolbar && mainContent) {
                            log('在iframe中找到工具栏和主内容区');
                            break;
                        }
                    } catch (e) {
                        log(`无法访问iframe: ${e.message}`);
                    }
                }
            }

            if (toolbar && mainContent) {
                const button = createGanttButton();
                if (button) {
                    // 检查是否已经添加过按钮
                    const existingButton = toolbar.querySelector('#gantt-chart-btn');
                    if (existingButton) {
                        log('按钮已存在于当前文档中');
                        return;
                    }

                    // 将按钮添加到工具栏的第一个位置
                    const firstChild = toolbar.firstChild;
                    if (firstChild) {
                        toolbar.insertBefore(button, firstChild);
                    } else {
                        toolbar.appendChild(button);
                    }
                    log('按钮已添加到工具栏');

                    // 创建甘特图容器
                    let container = mainContent.querySelector('#gantt-container');
                    if (!container) {
                        container = document.createElement('div');
                        container.id = 'gantt-container';
                        container.style.display = 'none';

                        // 将容器插入到mainContent的开头
                        mainContent.insertBefore(container, mainContent.firstChild);
                        log('甘特图容器已创建并添加到页面');
                    }

                    // 加载甘特图样式
                    if (!document.querySelector('link[href*="dhtmlxgantt.css"]')) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.css';
                        document.head.appendChild(link);
                        log('甘特图样式已加载');
                    }
                }
            } else {
                log('未找到工具栏或主内容区');
            }
        }, 1000); // 等待1秒确保页面加载完成
    }

    // 启动脚本
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();