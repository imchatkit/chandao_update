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

    // 在文件开头添加日期处理函数
    function formatDate(dateStr, isEndDate = false) {
        // 如果日期为空，返回合适的默认值
        if (!dateStr || dateStr.trim() === '') {
            const today = new Date();
            if (isEndDate) {
                // 如果是结束日期，默认设置为7天后
                today.setDate(today.getDate() + 7);
            }
            return today.toISOString().split('T')[0];
        }
        
        // 如果是"今日"，返回当前日期
        if (dateStr === '今日') {
            return new Date().toISOString().split('T')[0];
        }
        
        // 处理 YYYY-MM-DD 格式
        const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
        if (match) {
            return dateStr;
        }
        
        try {
            // 尝试解析日期
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            log(`日期解析错误: ${e.message}`);
        }
        
        // 如果无法解析，返回当前日期或7天后
        const fallbackDate = new Date();
        if (isEndDate) {
            fallbackDate.setDate(fallbackDate.getDate() + 7);
        }
        return fallbackDate.toISOString().split('T')[0];
    }

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
            display: none;
        }
        #log-toggle-btn {
            position: fixed;
            bottom: 10px;
            right: 320px;
            padding: 6px 12px;
            background-color: #006af1;
            color: #fff;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            z-index: 9999;
            font-size: 12px;
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
        .gantt-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: none;
        }
        .gantt-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            height: 80%;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 10001;
            display: flex;
            flex-direction: column;
        }
        .gantt-modal-header {
            padding: 15px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .gantt-modal-title {
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }
        .gantt-modal-close {
            cursor: pointer;
            font-size: 20px;
            color: #666;
            border: none;
            background: none;
            padding: 5px;
        }
        .gantt-modal-body {
            flex: 1;
            padding: 15px;
            overflow: auto;
        }
        #gantt-container {
            width: 100%;
            height: 100%;
            background: white;
        }
    `);

    // 创建日志面板
    function createLogPanel() {
        const panel = document.createElement('div');
        panel.id = 'gantt-log-panel';
        document.body.appendChild(panel);
        
        // 创建日志开关按钮
        if (!document.getElementById('log-toggle-btn')) {
            createLogToggleButton();
        }
        
        return panel;
    }

    // 创建日志开关按钮
    function createLogToggleButton() {
        const button = document.createElement('button');
        button.id = 'log-toggle-btn';
        button.textContent = '显示日志';
        button.onclick = function() {
            const panel = document.getElementById('gantt-log-panel');
            if (panel) {
                const isVisible = panel.style.display === 'block';
                panel.style.display = isVisible ? 'none' : 'block';
                button.textContent = isVisible ? '显示日志' : '隐藏日志';
            }
        };
        document.body.appendChild(button);
        return button;
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
        
        // 查找或创建弹出窗口
        let modal = document.querySelector('.gantt-modal-overlay');
        if (!modal) {
            // 创建遮罩层
            modal = document.createElement('div');
            modal.className = 'gantt-modal-overlay';
            
            // 创建弹出窗口
            const modalContent = document.createElement('div');
            modalContent.className = 'gantt-modal';
            
            // 创建头部
            const header = document.createElement('div');
            header.className = 'gantt-modal-header';
            
            const title = document.createElement('div');
            title.className = 'gantt-modal-title';
            title.textContent = '任务甘特图';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'gantt-modal-close';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = function() {
                modal.style.display = 'none';
            };
            
            header.appendChild(title);
            header.appendChild(closeBtn);
            
            // 创建内容区域
            const body = document.createElement('div');
            body.className = 'gantt-modal-body';
            
            // 创建甘特图容器
            const container = document.createElement('div');
            container.id = 'gantt-container';
            
            body.appendChild(container);
            modalContent.appendChild(header);
            modalContent.appendChild(body);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
        }
        
        // 显示弹出窗口
        modal.style.display = 'block';
        
        // 初始化甘特图
        const container = document.getElementById('gantt-container');
        if (container) {
            // 查找任务数据所在的文档
            let taskDoc = document;
            const frames = Array.from(document.querySelectorAll('iframe'));
            for (const frame of frames) {
                try {
                    const frameDoc = frame.contentDocument || frame.contentWindow.document;
                    if (frameDoc.querySelector('.dtable-cell[data-col="name"]')) {
                        taskDoc = frameDoc;
                        break;
                    }
                } catch (e) {
                    log(`无法访问iframe: ${e.message}`);
                }
            }
            
            initializeGanttChart(container, taskDoc);
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
        const taskTable = doc.querySelector('.dtable');
        if (!taskTable) {
            log('未找到任务表格');
            return;
        }

        // 获取所有任务行
        const taskCells = doc.querySelectorAll('.dtable-cell[data-col="name"]');
        log(`找到任务单元格数量: ${taskCells.length}`);

        if (!taskCells || taskCells.length === 0) {
            log('未找到任务单元格');
            return;
        }

        // 创建任务映射表
        const taskMap = new Map();

        // 收集所有任务
        taskCells.forEach((nameCell, index) => {
            try {
                const rowId = nameCell.getAttribute('data-row');
                if (!rowId) {
                    log(`第 ${index + 1} 个单元格没有行ID`);
                    return;
                }

                const nameLink = nameCell.querySelector('a');
                if (!nameLink) {
                    log(`任务 ${rowId} 没有找到名称链接`);
                    return;
                }
                
                const name = nameLink.textContent.trim();
                const id = rowId;
                
                // 检查是否为子任务（但不影响显示）
                const isChild = nameCell.querySelector('.dtable-cell-html span.label') !== null;
                log(`任务 ${id} - ${name} ${isChild ? '是' : '不是'}子任务`);
                
                // 查找日期和进度信息
                const estStartedCell = doc.querySelector(`.dtable-cell[data-row="${id}"][data-col="estStarted"]`);
                const deadlineCell = doc.querySelector(`.dtable-cell[data-row="${id}"][data-col="deadline"]`);
                const progressCell = doc.querySelector(`.dtable-cell[data-row="${id}"][data-col="progress"] text`);
                const statusCell = doc.querySelector(`.dtable-cell[data-row="${id}"][data-col="status"]`);
                
                const estStarted = estStartedCell ? estStartedCell.textContent.trim() : '';
                const deadline = deadlineCell ? deadlineCell.textContent.trim() : '';
                const progress = progressCell ? (parseInt(progressCell.textContent) / 100) : 0;
                const status = statusCell ? statusCell.textContent.trim() : '';
                
                log(`任务 ${id} 原始数据: 开始=${estStarted}, 结束=${deadline}, 状态=${status}`);
                
                // 根据任务状态设置默认日期
                let startDate = formatDate(estStarted, false);
                let endDate = formatDate(deadline, true);
                
                // 如果没有日期，根据状态设置默认值
                if (!estStarted && !deadline) {
                    const today = new Date();
                    if (status === '已完成' || status === '已关闭') {
                        // 已完成的任务默认设置为今天结束
                        startDate = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
                        endDate = new Date().toISOString().split('T')[0];
                    } else if (status === '进行中') {
                        // 进行中的任务从今天开始，持续7天
                        startDate = new Date().toISOString().split('T')[0];
                        endDate = new Date(today.setDate(today.getDate() + 7)).toISOString().split('T')[0];
                    } else {
                        // 其他状态的���务从明天开始，持续7天
                        const tomorrow = new Date(today.setDate(today.getDate() + 1));
                        startDate = tomorrow.toISOString().split('T')[0];
                        endDate = new Date(tomorrow.setDate(tomorrow.getDate() + 7)).toISOString().split('T')[0];
                    }
                }
                
                // 创建任务对象
                const task = {
                    id: id,
                    text: name,
                    start_date: startDate,
                    end_date: endDate,
                    progress: progress,
                    open: true,
                    status: status // 添加状态字段
                };
                
                log(`任务 ${id} 最终日期: 开始=${task.start_date}, 结束=${task.end_date}`);
                
                // 确保结束日期不早于开始日期
                if (task.end_date < task.start_date) {
                    const startDate = new Date(task.start_date);
                    startDate.setDate(startDate.getDate() + 7);
                    task.end_date = startDate.toISOString().split('T')[0];
                    log(`调整任务 ${id} 的结束日期: ${task.end_date}`);
                }
                
                taskMap.set(id, task);
                log(`成功添加任务: ${name}, ID: ${id}, 开始: ${task.start_date}, 结束: ${task.end_date}, 进度: ${progress}`);
            } catch (error) {
                log(`处理任务数据时出错: ${error.message}, 堆栈: ${error.stack}`);
            }
        });

        // 将任务添加到数据数组
        taskMap.forEach(task => {
            tasks.data.push(task);
        });

        log(`总共处理了 ${tasks.data.length} 个任务`);
        log('任务数据详情：' + JSON.stringify(tasks.data, null, 2));
        
        if (tasks.data.length === 0) {
            log('警告：没有找到任何任务数据');
            return;
        }

        try {
            log('开始配置甘特图');
            
            // 配置甘特图
            gantt.config.xml_date = "%Y-%m-%d";
            gantt.config.date_format = "%Y-%m-%d";
            gantt.config.date_grid = "%Y-%m-%d";
            
            // 优化显示配置
            gantt.config.scale_height = 50;
            gantt.config.row_height = 28;            // 减小行高以显示更多任务
            gantt.config.task_height = 16;           // 减小任务高度
            gantt.config.min_column_width = 30;      // 减小最小列宽
            gantt.config.scale_unit = "day";         // 设置时间刻度单位为天
            gantt.config.date_scale = "%d";          // 日期格式
            gantt.config.subscales = [
                {unit: "month", step: 1, date: "%Y年%m月"}
            ];
            
            // 启用智能渲染以提高性能
            gantt.config.smart_rendering = true;
            gantt.config.smart_scales = true;
            
            // 设置滚动选项
            gantt.config.scroll_size = 10;           // 滚动条大小
            gantt.config.autosize = "y";             // 自动调整高度
            gantt.config.fit_tasks = true;           // 自动适应任务
            gantt.config.show_progress = true;       // 显示进度
            gantt.config.show_task_cells = true;     // 显示任务单元格
            gantt.config.show_links = false;         // 不显示任务链接线
            gantt.config.show_markers = true;        // 显示标记
            gantt.config.drag_progress = false;      // 禁止拖动进度条
            gantt.config.drag_move = false;          // 禁止拖动移动
            gantt.config.drag_resize = false;        // 禁止拖动调整大小
            gantt.config.readonly = true;            // 只读模式
            
            // 设置中文
            gantt.i18n.setLocale({
                date: {
                    month_full: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
                    month_short: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
                    day_full: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
                    day_short: ["日", "一", "二", "三", "四", "五", "六"]
                }
            });
            
            // 配置列显示
            gantt.config.columns = [
                {name: "text", label: "任务名称", tree: true, width: 300, resize: true},
                {name: "start_date", label: "开始时间", align: "center", width: 100, resize: true},
                {name: "end_date", label: "结束时间", align: "center", width: 100, resize: true},
                {name: "progress", label: "进度", align: "center", width: 80, resize: true, template: function(obj) {
                    return Math.round(obj.progress * 100) + "%";
                }},
                {name: "status", label: "状态", align: "center", width: 80, resize: true}
            ];

            // 设置任务模板，根据状态显示不同颜色
            gantt.templates.task_class = function(start, end, task) {
                switch(task.status) {
                    case '已完成':
                    case '已关闭':
                        return 'completed-task';
                    case '进行中':
                        return 'in-progress-task';
                    case '未开始':
                        return 'not-started-task';
                    default:
                        return '';
                }
            };

            // 添加自定义样式
            const customStyles = `
                .completed-task .gantt_task_progress {
                    background: #4CAF50;
                }
                .completed-task .gantt_task_line {
                    background-color: #81C784;
                }
                .in-progress-task .gantt_task_progress {
                    background: #2196F3;
                }
                .in-progress-task .gantt_task_line {
                    background-color: #64B5F6;
                }
                .not-started-task .gantt_task_progress {
                    background: #FFC107;
                }
                .not-started-task .gantt_task_line {
                    background-color: #FFD54F;
                }
            `;
            
            const styleElement = document.createElement('style');
            styleElement.textContent = customStyles;
            document.head.appendChild(styleElement);
            
            log('初始化甘特图');
            gantt.clearAll(); // 清除现有数据
            gantt.init(container);
            
            log('解析任务数据');
            gantt.parse(tasks);
            log('甘特图初始化成功，数据已加载');
            
            // 调整视图
            try {
                log('尝试调整甘特图视图');
                gantt.render();
                gantt.showDate(new Date()); // 显示当前日期
                gantt.expandAll(); // 展开所有任务
                
                // 设置滚动区域高度
                const ganttDataArea = container.querySelector('.gantt_data_area');
                if (ganttDataArea) {
                    ganttDataArea.style.height = Math.min(tasks.data.length * gantt.config.row_height + 50, 800) + 'px';
                    ganttDataArea.style.overflowY = 'auto';
                }
                
                log('重新渲染甘特图完成');
            } catch (viewError) {
                log(`调整视图时出错: ${viewError.message}`);
            }
        } catch (error) {
            log(`甘特图初始化失败: ${error.message}, 堆栈: ${error.stack}`);
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

        setTimeout(() => {
            let toolbar = document.querySelector('#actionBar');
            
            // 如果在主文档中没找到，则查找所有 iframe
            if (!toolbar) {
                const frames = Array.from(document.querySelectorAll('iframe'));
                for (const frame of frames) {
                    try {
                        const frameDoc = frame.contentDocument || frame.contentWindow.document;
                        toolbar = frameDoc.querySelector('#actionBar');
                        if (toolbar) {
                            log('在iframe中找到工具栏');
                            break;
                        }
                    } catch (e) {
                        log(`无法访问iframe: ${e.message}`);
                    }
                }
            }

            if (toolbar) {
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
                log('未找到工具栏');
            }
        }, 1000);
    }

    // 启动脚本
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();