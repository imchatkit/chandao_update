// ==UserScript==
// @name         禅道甘特图插件
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  在禅道执行页面添加甘特图展示
// @author       何威 邮箱hwe1233@163.com
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
    const INITIALIZATION_DELAY = 300; // 等待300ms后初始化
    const QUIET_PERIOD = 200; // 200ms内没有新请求就认为加载完成
    let isInitialized = false; // 添加初始化标志

    // 修改日期处理函数
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
        
        // 处理特殊日期文本
        if (dateStr === '今日') {
            return new Date().toISOString().split('T')[0];
        }
        if (dateStr === '昨日') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday.toISOString().split('T')[0];
        }

        // 处理禅道的日期格式（例如：2023-12-19）
        const dateMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (dateMatch) {
            const [_, year, month, day] = dateMatch;
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        }

        // 处理其他可能的日期格式
        try {
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
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: none;
        }
        .gantt-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: white;
            z-index: 10001;
            display: flex;
            flex-direction: column;
        }
        .gantt-modal-header {
            padding: 5px 15px;
            background: #f5f5f5;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .gantt-modal-title {
            font-size: 15px;
            font-weight: bold;
            color: #333;
        }
        .gantt-modal-close {
            padding: 5px 10px;
            font-size: 16px;
            color: #666;
            background: #e0e0e0;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .gantt-modal-close:hover {
            background: #d0d0d0;
        }
        .gantt-modal-body {
            flex: 1;
            height: calc(100vh - 50px);
            overflow: auto;
            padding: 10px;
        }
        #gantt-container {
            width: 100%;
            height: 100%;
            background: white;
        }
        .gantt-modal-body::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .gantt-modal-body::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        .gantt-modal-body::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        .gantt-modal-body::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
        .gantt_hor_scroll {
            height: 12px !important;
        }
        .gantt_hor_scroll::-webkit-scrollbar {
            height: 8px;
        }
        .gantt_hor_scroll::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        .gantt_hor_scroll::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }
        .gantt_hor_scroll::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
        /* 任务链接样式 */
        .gantt-task-link {
            color: #006af1;
            text-decoration: none;
            transition: color 0.2s;
        }

        .gantt-task-link:hover {
            color: #0056b3;
            text-decoration: underline;
        }

        /* 防止链接点击时关闭模态框 */
        .gantt_tree_content {
            pointer-events: all;
        }

        .gantt_row {
            cursor: default;
        }

        /* 状态标签样式 */
        .status-tag {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            color: #fff;
            display: inline-block;
            line-height: 1.4;
        }
        
        .status-wait {
            background-color: #FFC107;
        }
        
        .status-doing {
            background-color: #2196F3;
        }
        
        .status-done {
            background-color: #4CAF50;
        }
        
        .status-closed {
            background-color: #9E9E9E;
        }
        
        .status-cancel {
            background-color: #F44336;
        }
        
        .status-pause {
            background-color: #FF9800;
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

            // 添加 ESC 键监听
            const handleEsc = (event) => {
                if (event.key === 'Escape' && modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            };

            // 添加关闭事件处理
            const closeModal = () => {
                modal.style.display = 'none';
                document.removeEventListener('keydown', handleEsc);
            };

            // 更新关闭按钮点击事件
            closeBtn.onclick = closeModal;

            // 当模态框显示时添加 ESC 监听
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && 
                        mutation.attributeName === 'style') {
                        if (modal.style.display === 'block') {
                            document.addEventListener('keydown', handleEsc);
                        } else {
                            document.removeEventListener('keydown', handleEsc);
                        }
                    }
                });
            });
            
            observer.observe(modal, {
                attributes: true
            });
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

        // 获取dtable实例
        let dtable = null;
        try {
            // 首先尝试在主文档中查找
            dtable = window.zui?.DTable?.query('#table-execution-task');
            log('主文档中查找dtable: ' + (dtable ? '成功' : '失败'));

            // 如果在主文档中没找到，尝试在所有iframe中查找
            if (!dtable) {
                const frames = Array.from(document.querySelectorAll('iframe'));
                for (const frame of frames) {
                    try {
                        const frameWindow = frame.contentWindow;
                        if (frameWindow && frameWindow.zui && frameWindow.zui.DTable) {
                            dtable = frameWindow.zui.DTable.query('#table-execution-task');
                            if (dtable) {
                                log('在iframe中找到dtable');
                                break;
                            }
                        }
                    } catch (e) {
                        log(`无法访问iframe: ${e.message}`);
                    }
                }
            }
        } catch (e) {
            log(`获取dtable实例时出错: ${e.message}`);
        }

        if (!dtable) {
            log('未找到任务表格，尝试从DOM获取数据');
            // 尝试从DOM获取数据
            const taskRows = doc.querySelectorAll('.dtable-row');
            log(`从DOM找到任务行数量: ${taskRows.length}`);

            taskRows.forEach((row, index) => {
                try {
                    const nameCell = row.querySelector('.dtable-cell[data-col="name"]');
                    const name = nameCell?.querySelector('a')?.textContent?.trim();
                    const id = row.getAttribute('data-id');
                    const estStartedCell = row.querySelector('.dtable-cell[data-col="estStarted"]');
                    const deadlineCell = row.querySelector('.dtable-cell[data-col="deadline"]');
                    const progressCell = row.querySelector('.dtable-cell[data-col="progress"]');
                    const statusCell = row.querySelector('.dtable-cell[data-col="status"]');

                    if (name && id) {
                        const ganttTask = {
                            id: id,
                            text: name,
                            start_date: formatDate(estStartedCell?.textContent?.trim() || '', false),
                            end_date: formatDate(deadlineCell?.textContent?.trim() || '', true),
                            progress: progressCell ? (parseInt(progressCell.textContent) / 100) : 0,
                            open: true,
                            status: statusCell?.textContent?.trim() || ''
                        };
                        tasks.data.push(ganttTask);
                        log(`成功添加任务: ${name}`);
                    }
                } catch (error) {
                    log(`处理任务行时出错: ${error.message}`);
                }
            });
        } else {
            // 从dtable获取数据
            log('成功获取dtable实例，开始处理数据');
            try {
                // 检查dtable的数据结构
                log('dtable结构：', JSON.stringify({
                    hasLayout: !!dtable.layout,
                    hasData: !!dtable.data,
                    hasOptions: !!dtable.options
                }));

                let allTasks = [];
                
                // 尝试不同的方式获取任务数据
                if (dtable.layout?.allRows) {
                    allTasks = dtable.layout.allRows;
                    log('从layout.allRows获取数据');
                } else if (dtable.data?.dataList) {
                    allTasks = dtable.data.dataList;
                    log('从data.dataList获取数据');
                } else if (dtable.options?.data) {
                    allTasks = dtable.options.data;
                    log('从options.data获取数据');
                } else if (Array.isArray(dtable.data)) {
                    allTasks = dtable.data;
                    log('从data数组获取数据');
                }

                log(`找到任务总数: ${allTasks.length}`);

                allTasks.forEach((row, index) => {
                    try {
                        const task = row.data || row;
                        if (!task) {
                            log(`第 ${index + 1} 个任务数据为空`);
                            return;
                        }

                        // 记录任务数据结构以便调试
                        if (index === 0) {
                            log('任务数据结构示例：' + JSON.stringify(task));
                        }

                        // 处理日期
                        const startDate = formatDate(task.estStarted || task.openedDate || task.begin || '', false);
                        const endDate = formatDate(task.deadline || task.end || '', true);

                        // 创建任务对象
                        const ganttTask = {
                            id: task.id,
                            text: task.name,
                            start_date: startDate,
                            end_date: endDate,
                            progress: task.progress || 0,
                            open: true,
                            status: task.status,
                            assignedTo: task.assignedToRealName || task.realname || task.assignedTo || '-',
                        };

                        tasks.data.push(ganttTask);
                        log(`成功添加任务: ${task.name}`);
                    } catch (error) {
                        log(`处理任务行时出错: ${error.message}`);
                    }
                });
            } catch (error) {
                log(`处理dtable数据时出错: ${error.message}`);
                log('dtable实例：', dtable);
            }
        }

        log(`总共收集到 ${tasks.data.length} 个任务`);
        if (tasks.data.length > 0) {
            log('第一个任务示例：' + JSON.stringify(tasks.data[0]));
        }

        try {
            log('开始配置甘特图');
            
            // 配置甘特图
            gantt.config.xml_date = "%Y-%m-%d";
            gantt.config.date_format = "%Y-%m-%d";
            gantt.config.date_grid = "%Y-%m-%d";
            
            // 优化显示配置
            gantt.config.scale_height = 50;
            gantt.config.row_height = 28;
            gantt.config.task_height = 16;
            gantt.config.min_column_width = 30;
            gantt.config.scale_unit = "day";
            gantt.config.date_scale = "%d";
            gantt.config.subscales = [
                {unit: "month", step: 1, date: "%Y年%m月"}
            ];
            
            // 启用智能渲染以提高性能
            gantt.config.smart_rendering = true;
            gantt.config.smart_scales = true;
            
            // 设置滚动选项
            gantt.config.scroll_size = 8;
            gantt.config.autosize = "y";
            gantt.config.fit_tasks = true;
            gantt.config.show_progress = true;
            gantt.config.show_task_cells = true;
            gantt.config.show_links = false;
            gantt.config.show_markers = true;
            gantt.config.drag_progress = false;
            gantt.config.drag_move = false;
            gantt.config.drag_resize = false;
            gantt.config.readonly = true;
            
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
                {
                    name: "text", 
                    label: "任务名称 ▼", 
                    tree: true, 
                    width: 300, 
                    resize: true,
                    sort: true,
                    template: function(task) {
                        const baseUrl = window.location.origin;
                        const taskUrl = `${baseUrl}/index.php?m=task&f=view&taskID=${task.id}`;
                        return `<a href="${taskUrl}" class="gantt-task-link" target="_blank" title="${task.text}">${task.text}</a>`;
                    }
                },
                {
                    name: "start_date", 
                    label: "开始时间 ▼", 
                    align: "center", 
                    width: 100, 
                    resize: true,
                    sort: true
                },
                {
                    name: "end_date", 
                    label: "结束时间 ▼", 
                    align: "center", 
                    width: 100, 
                    resize: true,
                    sort: true
                },
                {
                    name: "assignedTo", 
                    label: "指派给 ▼", 
                    align: "center", 
                    width: 80, 
                    resize: true,
                    sort: true,
                    template: function(task) {
                        if (!task.assignedTo || task.assignedTo === '-') {
                            return '<span style="color: #999;">未指派</span>';
                        }
                        return `<span class="assigned-user">${task.assignedTo}</span>`;
                    }
                },
                {
                    name: "progress", 
                    label: "进度 ▼", 
                    align: "center", 
                    width: 80, 
                    resize: true,
                    sort: true,
                    template: function(obj) {
                        return Math.round(obj.progress * 100) + "%";
                    }
                },
                {
                    name: "status", 
                    label: "状态 ▼", 
                    align: "center", 
                    width: 80, 
                    resize: true,
                    sort: true,
                    template: function(task) {
                        const statusMap = {
                            'wait': '<span class="status-tag status-wait">未开始</span>',
                            'doing': '<span class="status-tag status-doing">进行中</span>',
                            'done': '<span class="status-tag status-done">已完成</span>',
                            'closed': '<span class="status-tag status-closed">已关闭</span>',
                            'cancel': '<span class="status-tag status-cancel">已取消</span>',
                            'pause': '<span class="status-tag status-pause">已暂停</span>'
                        };
                        return statusMap[task.status] || task.status;
                    }
                }
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
            
            // 设置甘特图自适应容器大小
            gantt.setSizes();
            window.addEventListener('resize', function() {
                gantt.setSizes();
            });

            // 在显示模态框时触发一次重新计算大小
            const modalOverlay = document.querySelector('.gantt-modal-overlay');
            if (modalOverlay) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && 
                            mutation.attributeName === 'style' && 
                            modalOverlay.style.display === 'block') {
                            gantt.setSizes();
                        }
                    });
                });
                
                observer.observe(modalOverlay, {
                    attributes: true
                });
            }
            
            log('解析任务数据');
            gantt.parse(tasks);
            log('甘特图初始化成功，数据已加载');
            
            // 调整视图
            try {
                log('尝试调整甘特图视图');
                gantt.render();
                gantt.showDate(new Date()); // 显示当前日期
                
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

            // 在配置甘特图部分添加滚动相关配置
            gantt.config.scroll_size = 8; // 设置滚动条大小
            gantt.config.show_chart = true;
            gantt.config.show_grid = true;
            gantt.config.autosize = "y";
            gantt.config.autoscroll = true;
            gantt.config.grid_elastic_columns = true; // 允许列宽自适应

            // 设置水平滚动速度
            gantt.config.wheel_scroll_sensitivity = 50;

            // 允许鼠标滚轮进行水平滚动
            gantt.attachEvent("onGanttScroll", function(left, top) {
                log(`甘特图滚动: left=${left}, top=${top}`);
            });

            // 添加任务点击事件处理
            gantt.attachEvent("onTaskClick", function(id, e) {
                // 阻止事件冒泡，防止关闭模态框
                e.stopPropagation();
                
                // 如果点击的是链接，让链接自己处理
                if (e.target.classList.contains('gantt-task-link')) {
                    return true;
                }
                
                // 如果点击的是其他区域，可以添加其他处理逻辑
                return true;
            });

            // 添加双击事件处理（可选）
            gantt.attachEvent("onTaskDblClick", function(id, e) {
                e.stopPropagation();
                const task = gantt.getTask(id);
                const baseUrl = window.location.origin;
                const taskUrl = `${baseUrl}/index.php?m=task&f=view&taskID=${task.id}`;
                window.open(taskUrl, '_blank');
                return false; // 阻止默认行为
            });

            // 修改 onGridHeaderClick 事件处理
            gantt.attachEvent("onGridHeaderClick", function(name, e) {
                const column = gantt.getGridColumn(name);
                if (!column) return;

                const header = e.target.closest(".gantt_grid_head_cell");
                if (!header) return;

                // 获取所有可能的值（从原始任务数据中获取）
                const values = new Set();
                tasks.data.forEach(task => {
                    let value = task[name];
                    if (name === "progress") {
                        value = Math.round(task.progress * 100) + "%";
                    } else if (name === "status") {
                        const statusMap = {
                            'wait': '未开始',
                            'doing': '进行中',
                            'done': '已完成',
                            'closed': '已关闭',
                            'cancel': '已取消',
                            'pause': '已暂停'
                        };
                        value = statusMap[value] || value;
                    } else if (name === "assignedTo") {
                        value = task.assignedTo || '未指派';
                    }
                    if (value) values.add(value);
                });

                const filterContainer = document.createElement("div");
                filterContainer.className = "column-filter-container";
                filterContainer.innerHTML = `
                    <div class="filter-list">
                        <div class="filter-item">
                            <label><input type="checkbox" value="" checked> 全部</label>
                        </div>
                        ${Array.from(values).map(value => `
                            <div class="filter-item">
                                <label><input type="checkbox" value="${value}"> ${value}</label>
                            </div>
                        `).join("")}
                    </div>
                    <div class="filter-actions">
                        <button class="apply-filter">确定</button>
                        <button class="cancel-filter">取消</button>
                    </div>
                `;

                // 定位筛选框
                const rect = header.getBoundingClientRect();
                filterContainer.style.position = "absolute";
                filterContainer.style.top = rect.bottom + "px";
                filterContainer.style.left = rect.left + "px";
                filterContainer.style.zIndex = "100000";
                document.body.appendChild(filterContainer);

                // 处理全选/取消全选
                const allCheckbox = filterContainer.querySelector('input[value=""]');
                const otherCheckboxes = filterContainer.querySelectorAll('input[type="checkbox"]:not([value=""])');
                
                allCheckbox.addEventListener('change', function() {
                    otherCheckboxes.forEach(cb => {
                        cb.checked = this.checked;
                    });
                });

                // 确定按钮点击事件
                filterContainer.querySelector('.apply-filter').addEventListener('click', () => {
                    const selectedValues = new Set();
                    otherCheckboxes.forEach(cb => {
                        if (cb.checked) {
                            selectedValues.add(cb.value);
                        }
                    });

                    // 筛选任务
                    gantt.clearAll();
                    const filteredTasks = tasks.data.filter(task => {
                        let value = task[name];
                        if (name === "progress") {
                            value = Math.round(task.progress * 100) + "%";
                        } else if (name === "status") {
                            const statusMap = {
                                'wait': '未开始',
                                'doing': '进行中',
                                'done': '已完成',
                                'closed': '已关闭',
                                'cancel': '已取消',
                                'pause': '已暂停'
                            };
                            value = statusMap[value] || value;
                        } else if (name === "assignedTo") {
                            value = task.assignedTo || '未指派';
                        }
                        return allCheckbox.checked || selectedValues.has(value);
                    });
                    gantt.parse({data: filteredTasks});
                    filterContainer.remove();
                });

                // 取消按钮点击事件
                filterContainer.querySelector('.cancel-filter').addEventListener('click', () => {
                    filterContainer.remove();
                });

                // 点击其他地方关闭筛选框
                document.addEventListener('click', function closeFilter(e) {
                    if (!filterContainer.contains(e.target) && !header.contains(e.target)) {
                        filterContainer.remove();
                        document.removeEventListener('click', closeFilter);
                    }
                });
            });

        } catch (error) {
            log(`甘特图初始化失败: ${error.message}, 堆栈: ${error.stack}`);
        }
    }

    // 查是否应该初始化
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

    // 在文件开头添加 initFilters 函数定义
    function initFilters(ganttInstance, tasks) {
        try {
            // 配置列筛选
            gantt.config.columns = [
                {
                    name: "text", 
                    label: "任务名称", 
                    tree: true, 
                    width: 300, 
                    resize: true,
                    sort: true,
                    template: function(task) {
                        const baseUrl = window.location.origin;
                        const taskUrl = `${baseUrl}/index.php?m=task&f=view&taskID=${task.id}`;
                        return `<a href="${taskUrl}" class="gantt-task-link" target="_blank" title="${task.text}">${task.text}</a>`;
                    }
                },
                {
                    name: "start_date", 
                    label: "开始时间", 
                    align: "center", 
                    width: 100, 
                    resize: true,
                    sort: true
                },
                {
                    name: "end_date", 
                    label: "结束时间", 
                    align: "center", 
                    width: 100, 
                    resize: true,
                    sort: true
                },
                {
                    name: "assignedTo", 
                    label: "指派给", 
                    align: "center", 
                    width: 80, 
                    resize: true,
                    sort: true,
                    template: function(task) {
                        if (!task.assignedTo || task.assignedTo === '-') {
                            return '<span style="color: #999;">未指派</span>';
                        }
                        return `<span class="assigned-user">${task.assignedTo}</span>`;
                    }
                },
                {
                    name: "progress", 
                    label: "进度", 
                    align: "center", 
                    width: 80, 
                    resize: true,
                    sort: true,
                    template: function(obj) {
                        return Math.round(obj.progress * 100) + "%";
                    }
                },
                {
                    name: "status", 
                    label: "状态", 
                    align: "center", 
                    width: 80, 
                    resize: true,
                    sort: true,
                    template: function(task) {
                        const statusMap = {
                            'wait': '<span class="status-tag status-wait">未开始</span>',
                            'doing': '<span class="status-tag status-doing">进行中</span>',
                            'done': '<span class="status-tag status-done">已完成</span>',
                            'closed': '<span class="status-tag status-closed">已关闭</span>',
                            'cancel': '<span class="status-tag status-cancel">已取消</span>',
                            'pause': '<span class="status-tag status-pause">已暂停</span>'
                        };
                        return statusMap[task.status] || task.status;
                    }
                }
            ];

            // 启用列筛选
            gantt.config.grid_width = 600;
            gantt.config.show_grid = true;
            gantt.config.grid_resize = true;
            gantt.config.grid_elastic_columns = true;

            // 添加列头筛选器
            gantt.attachEvent("onGridHeaderClick", function(name, e) {
                const column = gantt.getGridColumn(name);
                if (!column) return;

                const header = e.target.closest(".gantt_grid_head_cell");
                if (!header) return;

                // 获取所有可能的值（从原始任务数据中获取）
                const values = new Set();
                tasks.data.forEach(task => {
                    let value = task[name];
                    if (name === "progress") {
                        value = Math.round(task.progress * 100) + "%";
                    } else if (name === "status") {
                        const statusMap = {
                            'wait': '未开始',
                            'doing': '进行中',
                            'done': '已完成',
                            'closed': '已关闭',
                            'cancel': '已取消',
                            'pause': '已暂停'
                        };
                        value = statusMap[value] || value;
                    } else if (name === "assignedTo") {
                        value = task.assignedTo || '未指派';
                    }
                    if (value) values.add(value);
                });

                const filterContainer = document.createElement("div");
                filterContainer.className = "column-filter-container";
                filterContainer.innerHTML = `
                    <div class="filter-list">
                        <div class="filter-item">
                            <label><input type="checkbox" value="" checked> 全部</label>
                        </div>
                        ${Array.from(values).map(value => `
                            <div class="filter-item">
                                <label><input type="checkbox" value="${value}"> ${value}</label>
                            </div>
                        `).join("")}
                    </div>
                    <div class="filter-actions">
                        <button class="apply-filter">确定</button>
                        <button class="cancel-filter">取消</button>
                    </div>
                `;

                // 定位筛选框
                const rect = header.getBoundingClientRect();
                filterContainer.style.position = "absolute";
                filterContainer.style.top = rect.bottom + "px";
                filterContainer.style.left = rect.left + "px";
                filterContainer.style.zIndex = "100000";
                document.body.appendChild(filterContainer);

                // 处理全选/取消全选
                const allCheckbox = filterContainer.querySelector('input[value=""]');
                const otherCheckboxes = filterContainer.querySelectorAll('input[type="checkbox"]:not([value=""])');
                
                allCheckbox.addEventListener('change', function() {
                    otherCheckboxes.forEach(cb => {
                        cb.checked = this.checked;
                    });
                });

                // 确定按钮点击事件
                filterContainer.querySelector('.apply-filter').addEventListener('click', () => {
                    const selectedValues = new Set();
                    otherCheckboxes.forEach(cb => {
                        if (cb.checked) {
                            selectedValues.add(cb.value);
                        }
                    });

                    // 筛选任务
                    gantt.clearAll();
                    const filteredTasks = tasks.data.filter(task => {
                        if (checkboxes[0].checked) return true; // "全部"被选中
                        return selectedValues.has(task[name]);
                    });
                    gantt.parse({data: filteredTasks});
                    filterContainer.remove();
                });

                // 取消按钮点击事件
                filterContainer.querySelector('.cancel-filter').addEventListener('click', () => {
                    filterContainer.remove();
                });

                // 点击其他地方关闭筛选框
                document.addEventListener('click', function closeFilter(e) {
                    if (!filterContainer.contains(e.target) && !header.contains(e.target)) {
                        filterContainer.remove();
                        document.removeEventListener('click', closeFilter);
                    }
                });
            });

        } catch (error) {
            log(`初始化过滤器失败: ${error.message}`);
        }
    }

    // 添加筛选器样式
    GM_addStyle(`
        .column-filter-container {
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 8px;
            z-index: 100000;
            max-height: 300px;
            overflow-y: auto;
        }
        .filter-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 8px;
        }
        .filter-item {
            white-space: nowrap;
            padding: 2px 4px;
        }
        .filter-item:hover {
            background: #f5f5f5;
        }
        .filter-item label {
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
        }
        .filter-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding-top: 8px;
            border-top: 1px solid #eee;
        }
        .apply-filter, .cancel-filter {
            padding: 4px 12px;
            border-radius: 3px;
            border: 1px solid #ddd;
            cursor: pointer;
        }
        .apply-filter {
            background: #006af1;
            color: white;
            border-color: #006af1;
        }
        .apply-filter:hover {
            background: #0056b3;
        }
        .cancel-filter {
            background: white;
        }
        .cancel-filter:hover {
            background: #f5f5f5;
        }
    `);

    // 启动脚本
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();