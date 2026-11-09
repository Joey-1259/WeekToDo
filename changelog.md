## v2.9.0
Nov 9, 2026

### 重点事项 · 全屏编辑
- 全屏编辑固定为宽屏：标题和正文从同一左边线铺满窗口，去掉「标准宽度」切换，右上角只保留「Esc 退出」提示
- 顶部标签栏可切换已分栏的文档（⌘⇧[ / ⌘⇧]），切换前自动保存，不再闪现底层页面
- 全新目录侧栏：在树上直接新建、改名、移动、删除；单击打开，⌘单击固定为标签，双击改名；支持右键菜单、「移动到…」搜索、⌘P 搜索和方向键导航；⌘⇧\ 隐藏后，鼠标移到左边缘可以浮出

### 编辑器
- 新增「添加附件」（/ 菜单或直接拖入文件）：只记录文件在本机的位置，不复制文件。点击在 Finder 中显示，也可以直接打开、复制路径、重新定位；文件被移走时提示「找不到文件」；可执行类文件不会被直接运行
- 标题支持 H1–H6，输入 #### 等 Markdown 语法会自动识别；任意标题都能折叠所在章节（⌘.）
- 输入 @ 插入日期：今天、明天、本周五，或 @1105、@+3 等写法
- 图片可以 ⌘C 复制、一键下载；选中图片只显示一个工具栏
- / 菜单支持模糊搜索：输入「3」能找到「标题 3」，输入拼音首字母「glk」能找到「高亮块」；分栏和全屏同时打开时不再弹出两个菜单
- 修复 2016.01.01 回车后被当成序号、续写成 2016.2. 的问题

### 思维导图
- 极简卡片：只保留画布，鼠标悬停时显示全屏编辑和删除，双击进入编辑
- 可以直接在文档里调整大小：拖左右手柄改宽度（吸附 25%–100%，按住 ⌥ 关闭吸附），拖底部手柄改高度（160–960px），双击手柄还原

### 文件目录
- 拖拽重写：拖到目录上表示移入，拖到文档的上半或下半表示排在它前面或后面，鼠标旁边会提示「移入「…」」「排在「…」之前」；悬停在折叠的目录上 0.6 秒会自动展开，靠近边缘自动滚动，按 Esc 取消，移动后 5 秒内可以撤销

### 数据安全
- 完整备份在同一个数据库事务里读取所有数据，各模块是同一时刻的快照
- 备份附带 SHA-256 校验码；导出后显示回执（各模块条数和校验码），设置页显示上次导出时间
- 导入前先显示备份时间、版本、校验结果和各模块条数；文件被改动过会拒绝导入，现有数据不受影响；旧版备份仍然可以导入

### 问题修复
- 打开菜单、弹层或图片预览时按 Esc，只关闭最上面一层，不会误关全屏
- 修复切换文档时，上一篇还没保存完的内容覆盖到新文档
- 进入全屏时，标题已经填写的话光标直接进正文
- 右键菜单和「+」菜单不再超出屏幕


## v2.6.0
Sep 24, 2026

- 重点事项 · 思维导图：新增概要、外框（⌘/Ctrl+B）、文字大纲面板
- 思维导图导出 PNG / PDF / Markdown / 纯文本，菜单样式与文档导出统一
- 12 种骨架采用中心对齐连线，修复单子节点错位
- 骨架改为列表式选择，下拉菜单支持外部点击 / Esc 收起
- 快速样式可再次点击取消，清除样式恢复默认
- 全屏编辑保留「更多操作」菜单
- 分栏底部新增左右箭头，可与相邻分栏交换位置


## v2.2.0
Feb 14, 2024

- Adding Print and Export PDF Feature
- Adding new sidebar submenu
- To-do detail view textarea with dynamic height
- Adding Rebranding
- Using Sentry for error handle
- Fixing move old tasks to current day
- Adding recurring task filter
- Adding Month days recurring tasks
- Fixing typos and improving translations
- Adding Hindi, Vietnamese and Hebrew
- Adding Docker config To run the development web version
- Moving CI/CD to Github Actions


## v2.1.0
Jun 3, 2023

- Fixing Bugs
- Improving app performance
- Refactoring config menu
- Adding new colors to tasks color picker
- Upgrading all tech stack libraries
- Adding new repeating event option for custom weekdays selector
- Improving splash screen
- Adding sent subtask to bottom on complete setting
- Todo Description markdown link now redirect to external link in web browser
- Adding week start on monday setting
- Improving Chinese and Russian languages
- Close todoModal with Escape Key


## v2.0.0
Nov 24, 2022

- Adding telemetric system
- Adding custom list columns count setting
- Adding compact and expanded view settings
- Calendar start in today date if old items move automatically
- Adding new task list action
- Fixing Bugs
- Moving changelog, contributors, and support us views to web site
- Creating New Website
- Changing license to GNU GPL 3
- Adding Weekdays to recurrent events
- Adding Automatic Reorder Task Option
- Adding Setting to start week Yesterday
- Creating new Behavior Setting Menu
- Adding time to Copy task list action
- Improving contrast for old items/ checked tasks
- Raplacing name WeekToDo for WeekToDo
- improving dark theme switchers btn
- Adding details to recurrent events frecuency

## v1.9.0
Jul 28, 2022

- Disabling temporary offline version for browser for compatibility problems
- Changing Dynamically Tray menu language
- New setting for change Tray icon color
- Adding blur effect to windows background
- Adding exporting message
- Adding background image when no option selected in main view
- Adding clickable links for task texts
- Tasks details dynamic position
- Task details now show over center separator
- Adding Korean language
- Compacting sidebar
- Adding copy list to clipboard option
- Fixing initial notification bug
- Fixing importing bug from old versions
- Fixing edit task in main view bug
- Fixing bug for adding new task on the bottom of the list
- Fixing welcome modal layout bug
- Fixing problem with initial version notifications
- Fixing bug in subtask reorder in main view

## v1.8.5
Jul 08, 2022

- Fixing incompatible style option for Firefox
- Hiding zoom option for Firefox
- Fixing initial load bug for old task and notifications
- Adding view for swap custom lists
- Adding option to quickly maximize / restore main panels
- Adding undo options for remove tasks
- Adding confirmation modal for remove repeating events
- Improving list headers style
- Adding menu to list headers
- Adding option to Reorder tasks lists
- Adding option to Clear tasks lists
- Adding offline availability for web browser
- Adding option to install app from browser
- Fixing bug in automatic movement of old tasks

## v1.8.0
Jun 27, 2022

- Adding repeating tasks
- Adding repeating tasks view
- Fixing todo lists length when the column grows
- Improving listing performance
- Restyling Modal components
- Restyling To-do hover efect
- Fixing bug moving to-do to date in modal
- Building .Pacman format app for arch distributions
- Adding option for move automatically old tasks
- Moving checked tasks to the bottom of the list
- Showing contribute modal after 7 days of use
- Improving contribute modal
- Fixing Config menu sync with welcome modal
- Adding importing alert

## v1.7.0
Apr 09, 2022

- Open task detail with middle click
- Opening app automatic on startup
- Adding app tray system
- Closing app in background
- Improving windows position function
- Refactoring Config Menu UI
- Adding Notification Options
- Adding Reset Data Option
- Fixing bug in task clock icon
- Adding notification on Startup
- Adding custom sound to notification
- Improving donate view
- Minior UI improvment
- Adding notifications to task
- Adding data clear confirmation modal
- Fixing traditional Chinese
- Adding simplified Chinese translation
- Bulding PKG for MacOS

## v1.6.1
Feb 17, 2022

- Fixing major bug in modal detail sub-task field edit action
- Fixing minors bugs
- Adding time to task detail
- Adding time to task item in main view

## v1.6.0
Feb 06, 2022

- Edit release
- Delete release
- Fixing problem with Polish languages selection
- Adding color picker
- Adding circles and checked circles to tasks
- Fixing problem with calendar for Arabic, Polish and Italian
- Refactoring donate View
- Adding social links to about view
- Refactoring Contributor Modal
- Adding Sponsor Modal
- Adding Collaborator Modal
- Adding Contributor / Sponsor web page
- Adding Sponsors to Main Website
- Adding Sponsors to Splash Screen

## v1.5.0
Jan 03, 2022

- Adding Arabic, Italian and Polish languages
- Adding contributors section
- Fixing style problems in task details
- Adding duplicate and remove task in details form
- Redirecting to new Domain Name
- Updating contribute section

## v1.4.0
Sep 17, 2021

- Fixing drag and drop error on task quick editing
- Adding details to tasks
- Adding sub-tasks
- Creating sub-task drag and drop
- Introducing MarkDown to task Notes
- Adding Honney Badger for exception capture

## v1.3.0
Jul 27, 2021

- Fixing Germany errors
- Adding setting to hide Calendar
- Adding setting to change columns count
- Adding setting to change view zoom
- Fixing columns align bug
- Fixing drag and drop bug
- Adding Resizable view divider
- Resizable view divider double click set size to default

## v1.2.0
Jul 02, 2021

- Performance improvements
- Fixing bugs
- Implementing macOS compatibility
- Generating macOS desktop application
- Adding Sponsor space in splash screen
- Updating Contribute View
- Configuring continuous integration and continuous deployment tool for futures release

## v1.1.0
May 17, 2021

- Adding smooth animations
- Adding animation to drag and drop
- Refactoring donation menu
- Refactoring about view
- Adding changelog view
- Adding check for update option for desktop version
- Improving User Interface elements
- Adding Germany languag

## v1.0.0
Apr 02, 2021

- Initial release