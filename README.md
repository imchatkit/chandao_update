# 禅道甘特图插件

一个用于禅道项目管理系统的浏览器插件，为任务列表页面添加甘特图展示功能。

gitHUb地址：https://github.com/imchatkit/chandao_update


# 浏览器插件版本:

详细安装和使用说明请查看[浏览器插件版本说明](zentao-gantt-extension/README.md)

1. 下载本插件的最新版本
2. 打开浏览器，进入扩展程序页面（chrome://extensions/）
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本插件的目录
6. 选择本项目的\zentao-gantt-extension\目录即可


## 新增功能

### 1. 列筛选功能
- 支持点击列头进行筛选
- 支持多选筛选条件
- 提供全选/取消全选功能
- 实时预览筛选结果
- 支持确定/取消操作

### 2. 日期处理优化
- 支持"今日"、"昨日"等特殊日期格式
- 自动转换为标准日期格式
- 智能处理无效日期

### 3. 性能优化
- 缩短初始化等待时间(300ms)
- 减少数据加载等待时间(200ms)
- 优化数据处理逻辑

## 功能特点

- 在禅道任务列表页面添加甘特图按钮
- 全屏展示项目任务甘特图
- 支持任务进度、状态的可视化展示
- 任务名称支持点击跳转到详情页
- 支持鼠标滚轮和滚动条导航
- 支持ESC键快速关闭甘特图
- 自适应布局，支持窗口大小调整
- 任务状态颜色区分：
  - 已完成：绿色
  - 进行中：蓝色
  - 未开始：黄色
  - 已关闭：灰色
  - 已取消：红色
  - 已暂停：橙色
- 任务信息展示：
  - 任务名称（可点击跳转）
  - 开始/结束时间
  - 指派人（带颜色标识）
  - 进度百分比
  - 状态（彩色标签）

## 安装步骤

1. 首先安装 Tampermonkey (篡改猴) 浏览器扩展
   - [Chrome 网上应用店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox 附加组件](https://addons.mozilla.org/zh-CN/firefox/addon/tampermonkey/)
   - [Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. 安装完成后，点击浏览器右上角的 Tampermonkey 图标，选择"添加新脚本"

3. 将本脚本的完整代码复制粘贴到编辑器中

4. 修改脚本头部的 @match 配置，改为你的禅道系统地址：

```javascript
// @match        http://192.168.110.9:90/**
```

5. 按 Ctrl+S 保存脚本

## 使用说明

1. 访问禅道系统的任务列表页面
   - 支持的页面：执行和项目模块的任务列表页面
   - URL格式示例：`http://192.168.110.9:90/index.php?m=execution&f=task`

2. 在页面顶部工具栏找到"甘特图"按钮

3. 点击按钮打开甘特图视图
   - 支持鼠标滚轮上下滚动
   - 支持拖动滚动条导航
   - 可以点击任务名称跳转到详情页
   - 按ESC键或点击右上角关闭按钮可关闭甘特图
   - 双击任务行可打开任务详情

4. 甘特图中的任务信息
   - 任务名称：可点击跳转到详情页
   - 开始时间：显示任务计划开始时间
   - 结束时间：显示任务计划结束时间
   - 指派给：显示任务负责人（未指派显示灰色提示）
   - 进度百分比：显示当前任务完成进度
   - 任务状态：彩色标签显示当前状态
   - 时间轴上的任务条（颜色表示不同状态）

### 新增功能使用说明

1. 列筛选功能：
   - 点击列头的"▼"图标打开筛选面板
   - 勾选需要显示的选项
   - 使用全选/取消全选快速操作
   - 点击"确定"应用筛选，"取消"关闭面板
   - 筛选条件为临时性，刷新页面后重置

## 注意事项

1. 确保浏览器已安装并启用 Tampermonkey 扩展
2. 脚本仅在配置的禅道系统地址下生效
3. 需要禅道系统的任务列表页面正确加载
4. 如遇到问题，可以：
   - 检查控制台日志
   - 刷新页面重试
   - 确认禅道系统地址配置是否正确
   - 确认网络连接是否正常

## 调试模式

脚本内置调试模式，可以通过以下方式查看日志：
1. 点击页面右下角的"显示日志"按钮，查看运行日志
2. 打开浏览器控制台（F12），查看详细日志输出
3. 日志包含：
   - 初始化过程
   - 数据加载状态
   - 错误信息
   - 用户操作记录

## 兼容性

- 浏览器支持：
  - Chrome 88+
  - Firefox 78+
  - Edge 88+
- 禅道版本要求：
  - 支持任务列表功能的版本
  - 推荐使用禅道16.5+版本
- 建议使用最新版本的浏览器以获得最佳体验

## 更新日志

### v0.9 (2024-01)
- 初始版本发布
- 实现基础甘特图功能
- 添加任务状态颜色区分
- 支持任务详情链接
- 添加全屏显示支持
- 添加ESC快捷键支持
- 优化滚动条体验
- 添加调试日志功能
- 新增指派人显示
- 优化状态显示样式
- 添加双击打开任务功能
- 新增列筛选功能
- 优化日期处理逻辑
- 提升性能和加载速度

## 开发计划

未来版本计划添加的功能：
1. 支持任务筛选和搜索
2. 支持自定义颜色主题
3. 添加更多快捷键支持
4. 优化性能和加载速度
5. 支持导出甘特图
6. 添加更多视图选项

## 许可证

MIT License

## 贡献指南

欢迎提交问题反馈和功能建议，也欢迎提交代码贡献。

## 作者

- 作者：何威
- 邮箱：hwei1233@163.com

## 致谢

- DHTMLX Gantt：提供甘特图基础组件
- Tampermonkey：提供用户脚本支持
- 禅道：开源项目管理系统