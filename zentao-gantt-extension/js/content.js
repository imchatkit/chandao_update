// 添加样式
const style = document.createElement('style');
style.textContent = `
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
    
    /* 状态标签样式 */
    .status-tag {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 12px;
        line-height: 1.5;
        font-weight: 500;
    }
    .status-wait {
        background-color: #838A95;
        color: #FFFFFF;
    }
    .status-doing {
        background-color: #006AF1;
        color: #FFFFFF;
    }
    .status-done {
        background-color: #0B8E36;
        color: #FFFFFF;
    }
    .status-closed {
        background-color: #991D1F;
        color: #FFFFFF;
    }
    .status-cancel {
        background-color: #6F1148;
        color: #FFFFFF;
    }
    .status-pause {
        background-color: #FFA500;
        color: #FFFFFF;
    }
`;
document.head.appendChild(style);

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

// 等待任务数据加载完成
function waitForTaskData(callback, maxAttempts = 50) {
    let attempts = 0;
    
    function check() {
        attempts++;
        log(`尝试查找任务数据 (${attempts}/${maxAttempts})`);

        // 首先检查主文档中的任务数据
        try {
            const mainTable = document.querySelector('#table-execution-task');
            if (mainTable) {
                const cells = mainTable.querySelectorAll('.dtable-cell[data-col="name"]');
                if (cells.length > 0) {
                    log(`在主文档中找到任务表格，包含 ${cells.length} 个任务`);
                    callback(document);
                    return;
                }
            }
        } catch (e) {
            log(`检查主文档时出错: ${e.message}`);
        }
        
        // 检查iframe
        const frames = [
            document.getElementById('appIframe-execution'),
            document.getElementById('appIframe-project')
        ].filter(Boolean);

        for (const frame of frames) {
            try {
                if (!frame.contentWindow || !frame.contentDocument) {
                    continue;
                }

                const frameDoc = frame.contentDocument;
                log(`检查iframe: ${frame.id}`);

                // 检查加载状态
                const loadingElement = frameDoc.querySelector('.loading');
                if (loadingElement && loadingElement.style.display !== 'none') {
                    log('任务数据正在加载中...');
                    continue;
                }

                // 检查任务表格
                const taskTable = frameDoc.querySelector('#table-execution-task');
                if (taskTable) {
                    const cells = taskTable.querySelectorAll('.dtable-cell[data-col="name"]');
                    if (cells.length > 0) {
                        log(`在iframe ${frame.id} 中找到任务表格，包含 ${cells.length} 个任务`);
                        callback(frameDoc);
                        return;
                    }
                }
            } catch (e) {
                log(`访问iframe ${frame.id} 时出错: ${e.message}`);
                continue;
            }
        }

        if (attempts < maxAttempts) {
            const delay = Math.min(200 * Math.pow(1.1, attempts), 1000);
            setTimeout(check, delay);
        } else {
            log('等待任务数据超时，尝试使用当前文档');
            callback(document);
        }
    }
    
    check();
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
        // 等待任务数据加载完成
        waitForTaskData((doc) => {
            log('任务数据已加载，开始初始化甘特图');
            initializeGanttChart(container, doc);
        });
    } else {
        log('未找到甘特图容器');
    }
}

// 初始化甘特图
function initializeGanttChart(container, doc) {
    log('初始化甘特图内容');
    
    // 获取任务数据
    const tasks = {
        data: []
    };

    try {
        // 首先尝试从Vue实例中获取数据
        const vueInstance = doc.querySelector('#table-execution-task')?.__vue__;
        if (vueInstance && vueInstance.data) {
            log('从Vue实例获取数据');
            tasks.data = extractTasksFromVueInstance(vueInstance);
        } else {
            // 尝试从window对象获取全局变量
            const windowTasks = doc.defaultView?.tasks || doc.defaultView?.window?.tasks;
            if (windowTasks && Array.isArray(windowTasks)) {
                log('从window对象获取任务数据');
                tasks.data = extractTasksFromWindowObject(windowTasks);
            } else {
                // 最后尝试从DOM中获取数据
                log('尝试从DOM中获取数据');
                tasks.data = extractTasksFromDOM(doc);
            }
        }

        log(`总共收集到 ${tasks.data.length} 个任务`);
        if (tasks.data.length > 0) {
            log('第一个任务示例：' + JSON.stringify(tasks.data[0]));
        }
    } catch (error) {
        log(`获取任务数据时出错: ${error.message}`);
    }

    // 如果没有找到任务数据，添加示例数据
    if (tasks.data.length === 0) {
        tasks.data = createSampleTasks();
        log('使用示例数据进行测试');
    }

    try {
        initializeGanttConfig(container, tasks);
    } catch (error) {
        log(`初始化甘特图配置时出错: ${error.message}`);
    }
}

// 从Vue实例中提取任务数据
function extractTasksFromVueInstance(vueInstance) {
    const tasks = [];
    try {
        vueInstance.data.forEach((task, index) => {
            const ganttTask = {
                id: task.id || `task-${index}`,
                text: task.name || task.text || '',
                start_date: formatDate(task.estStarted || task.begin || task.startDate || '', false),
                end_date: formatDate(task.deadline || task.end || task.endDate || '', true),
                progress: calculateProgress(task.progress || task.completed || 0),
                open: true,
                status: task.status || task.state || '',
                assignedTo: task.assignedToRealName || task.assignedTo || task.owner || '-'
            };
            if (ganttTask.text) {
                tasks.push(ganttTask);
                log(`从Vue实例成功添加任务: ${ganttTask.text}`);
            }
        });
    } catch (error) {
        log(`从Vue实例提取数据时出错: ${error.message}`);
    }
    return tasks;
}

// 从window对象中提取任务数据
function extractTasksFromWindowObject(windowTasks) {
    const tasks = [];
    try {
        windowTasks.forEach((task, index) => {
            const ganttTask = {
                id: task.id || `task-${index}`,
                text: task.name || task.title || task.text || '',
                start_date: formatDate(task.startDate || task.start || task.beginDate || '', false),
                end_date: formatDate(task.endDate || task.end || task.deadline || '', true),
                progress: calculateProgress(task.progress || task.completed || 0),
                open: true,
                status: task.status || task.state || '',
                assignedTo: task.assignedTo || task.owner || task.responsible || '-'
            };
            if (ganttTask.text) {
                tasks.push(ganttTask);
                log(`从window对象成功添加任务: ${ganttTask.text}`);
            }
        });
    } catch (error) {
        log(`从window对象提取数据时出错: ${error.message}`);
    }
    return tasks;
}

// 从DOM中提取任务数据
function extractTasksFromDOM(doc) {
    const tasks = [];
    try {
        // 使用新的选择器直接获取任务单元格
        const taskCells = doc.querySelectorAll('#table-execution-task .dtable-cell[data-col="name"]');
        
        if (taskCells.length > 0) {
            log(`找到 ${taskCells.length} 个任务单元格`);
            
            taskCells.forEach(nameCell => {
                const rowId = nameCell.getAttribute('data-row');
                if (!rowId) return;

                // 获取任务名称
                const nameLink = nameCell.querySelector('.dtable-cell-content a');
                if (!nameLink) return;

                // 获取状态单元格 - 使用更精确的选择器
                const statusCell = doc.querySelector(`#table-execution-task .dtable-block.dtable-body .dtable-cells.dtable-scroll-center [data-row="${rowId}"][data-col="status"]`);
                
                // 获取其他数据
                const container = nameCell.closest('.dtable-cells-container') || doc.querySelector('.dtable-cells-container');
                if (!container) return;

                const assignedToCell = container.querySelector(`[data-col="assignedTo"][data-row="${rowId}"] .dtable-cell-content span`);
                const estStartedCell = container.querySelector(`[data-col="estStarted"][data-row="${rowId}"] .dtable-cell-content`);
                const deadlineCell = container.querySelector(`[data-col="deadline"][data-row="${rowId}"] .dtable-cell-content`);
                const progressCell = container.querySelector(`[data-col="progress"][data-row="${rowId}"] text`);

                // 获取状态值
                let status = '';
                if (statusCell) {
                    const statusSpan = statusCell.querySelector('.dtable-cell-content span');
                    if (statusSpan) {
                        // 从class名称中提取状态
                        const statusClass = Array.from(statusSpan.classList)
                            .find(className => className.startsWith('status-'));
                        if (statusClass) {
                            status = statusClass.replace('status-', '');
                            log(`从class获取到状态: ${status} (来自 ${statusSpan.className})`);
                        } else {
                            // 如果没有找到status-类，直接使用文本内容
                            status = statusSpan.textContent.trim();
                            log(`从文本获取到状态: ${status}`);
                        }
                    }
                }

                const task = {
                    id: rowId,
                    text: nameLink.textContent.trim(),
                    start_date: formatDate(estStartedCell ? estStartedCell.textContent.trim() : '', false),
                    end_date: formatDate(deadlineCell ? deadlineCell.textContent.trim() : '', true),
                    progress: progressCell ? parseInt(progressCell.textContent.trim()) / 100 : 0,
                    open: true,
                    status: status,
                    assignedTo: assignedToCell ? assignedToCell.textContent.trim() : '-'
                };

                tasks.push(task);
                log(`成功添加任务: ${task.text}, 状态: ${task.status}`);
            });
        }

        if (tasks.length === 0) {
            log('未找到任何任务数据，将使用示例数据');
        }
    } catch (error) {
        log(`从DOM提取数据时出错: ${error.message}`);
    }
    return tasks;
}

// 从DOM元素中提取单个任务数据
function extractTaskFromElement(element, index) {
    try {
        // 尝试多种方式获取任务名称
        const nameSelectors = [
            '.dtable-cell[data-col="name"] a',
            '.dtable-cell[data-col="name"]',
            'td[data-col="name"] a',
            'td[data-col="name"]',
            '.c-name a',
            '.c-name'
        ];

        let taskName = '';
        for (const selector of nameSelectors) {
            const nameElement = element.querySelector(selector);
            if (nameElement) {
                taskName = nameElement.textContent.trim();
                break;
            }
        }

        if (!taskName) {
            return null;
        }

        // 获取任务ID
        const id = element.getAttribute('data-id') || 
                  element.getAttribute('data-row') || 
                  element.getAttribute('data-value') || 
                  `task-${index}`;

        // 获取其他任务属性
        const dates = extractDatesFromElement(element);
        const progress = extractProgressFromElement(element);
        const status = extractStatusFromElement(element);
        const assignedTo = extractAssignedToFromElement(element);

        return {
            id: id,
            text: taskName,
            start_date: dates.start_date,
            end_date: dates.end_date,
            progress: progress,
            open: true,
            status: status,
            assignedTo: assignedTo
        };
    } catch (error) {
        log(`提取任务元素数据时出错: ${error.message}`);
        return null;
    }
}

// 从元素中提取日期信息
function extractDatesFromElement(element) {
    const dateSelectors = {
        start: [
            '.dtable-cell[data-col="estStarted"]',
            'td[data-col="estStarted"]',
            '.c-estStarted',
            '.dtable-cell[data-col="begin"]',
            'td[data-col="begin"]',
            '.c-begin'
        ],
        end: [
            '.dtable-cell[data-col="deadline"]',
            'td[data-col="deadline"]',
            '.c-deadline',
            '.dtable-cell[data-col="end"]',
            'td[data-col="end"]',
            '.c-end'
        ]
    };

    let startDate = '', endDate = '';

    for (const selector of dateSelectors.start) {
        const element = element.querySelector(selector);
        if (element) {
            startDate = element.textContent.trim();
            break;
        }
    }

    for (const selector of dateSelectors.end) {
        const element = element.querySelector(selector);
        if (element) {
            endDate = element.textContent.trim();
            break;
        }
    }

    return {
        start_date: formatDate(startDate, false),
        end_date: formatDate(endDate, true)
    };
}

// 从元素中提取进度信息
function extractProgressFromElement(element) {
    const progressSelectors = [
        '.dtable-cell[data-col="progress"]',
        'td[data-col="progress"]',
        '.c-progress'
    ];

    for (const selector of progressSelectors) {
        const progressElement = element.querySelector(selector);
        if (progressElement) {
            const progressText = progressElement.textContent.trim();
            const progress = parseInt(progressText) || 0;
            return progress / 100;
        }
    }

    return 0;
}

// 从元素中提取状态信息
function extractStatusFromElement(element) {
    const statusSelectors = [
        '.dtable-cell[data-col="status"]',
        'td[data-col="status"]',
        '.c-status'
    ];

    for (const selector of statusSelectors) {
        const statusElement = element.querySelector(selector);
        if (statusElement) {
            return statusElement.textContent.trim();
        }
    }

    return '';
}

// 从元素中提取指派人信息
function extractAssignedToFromElement(element) {
    const assignedToSelectors = [
        '.dtable-cell[data-col="assignedTo"]',
        'td[data-col="assignedTo"]',
        '.c-assignedTo'
    ];

    for (const selector of assignedToSelectors) {
        const assignedToElement = element.querySelector(selector);
        if (assignedToElement) {
            return assignedToElement.textContent.trim() || '-';
        }
    }

    return '-';
}

// 计算进度值
function calculateProgress(progress) {
    if (typeof progress === 'string') {
        progress = parseInt(progress);
    }
    return isNaN(progress) ? 0 : progress / 100;
}

// 创建示例任务数据
function createSampleTasks() {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    
    return [{
        id: '1',
        text: '示例任务 1 - 页面中未找到真实数据',
        start_date: today.toISOString().split('T')[0],
        end_date: tomorrow.toISOString().split('T')[0],
        progress: 0.5,
        open: true,
        status: 'doing',
        assignedTo: '测试用户'
    }, {
        id: '2',
        text: '示例任务 2 - 请添加专用断点进行调试',
        start_date: tomorrow.toISOString().split('T')[0],
        end_date: nextWeek.toISOString().split('T')[0],
        progress: 0.2,
        open: true,
        status: 'wait',
        assignedTo: '测试用户'
    }];
}

// 初始化甘特图配置
function initializeGanttConfig(container, tasks) {
    log('开始配置甘特图');
    
    // 配置甘特图
    gantt.config.xml_date = "%Y-%m-%d";
    gantt.config.date_format = "%Y-%m-%d";
    gantt.config.date_grid = "%Y-%m-%d";
    
    // 优化显示配置
    gantt.config.row_height = 28;
    gantt.config.task_height = 16;
    gantt.config.min_column_width = 30;

    // 使用新版本的时间刻度配置
    gantt.config.scales = [
        {
            unit: "month",
            step: 1,
            format: "%Y年%m月"
        },
        {
            unit: "day",
            step: 1,
            format: "%d"
        }
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

    log('初始化甘特图');
    gantt.clearAll(); // 清除现有数据
    gantt.init(container);
    
    // 设置甘特图自适应容器大小
    gantt.setSizes();
    window.addEventListener('resize', function() {
        gantt.setSizes();
    });

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
}

// 格式化日期
function formatDate(dateStr, isEndDate = false) {
    if (!dateStr || dateStr.trim() === '') {
        const today = new Date();
        if (isEndDate) {
            today.setDate(today.getDate() + 7);
        }
        return today.toISOString().split('T')[0];
    }
    
    if (dateStr === '今日') {
        return new Date().toISOString().split('T')[0];
    }
    if (dateStr === '昨日') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    const dateMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dateMatch) {
        const [_, year, month, day] = dateMatch;
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }

    try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (e) {
        log(`日期解析错误: ${e.message}`);
    }
    
    const fallbackDate = new Date();
    if (isEndDate) {
        fallbackDate.setDate(fallbackDate.getDate() + 7);
    }
    return fallbackDate.toISOString().split('T')[0];
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
            waitForElement('#actionBar', (toolbar) => {
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
                }
            });
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
            if (shouldInit) {
                waitForElement('#actionBar', (toolbar) => {
                    const button = createGanttButton();
                    if (button) {
                        const existingButton = toolbar.querySelector('#gantt-chart-btn');
                        if (!existingButton) {
                            const firstChild = toolbar.firstChild;
                            if (firstChild) {
                                toolbar.insertBefore(button, firstChild);
                            } else {
                                toolbar.appendChild(button);
                            }
                            log('按钮已添加到工具栏');
                        }
                    }
                });
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

// 启动脚本
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
} 