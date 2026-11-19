# Obsidian / Notion 社交讨论与桌面交互调研

采样日期：2026-11-19（Asia/Shanghai）。对象已由用户确认是 Obsidian 与 Notion。本报告为眼前日程电脑版的设计输入，不是满意度统计，也不以讨论热度、点赞数代替可用性验证。

## 可直接用于本轮实现的结论

眼前日程适合采用 **Obsidian 的本地可带走、键盘检索、可选关联**，结合 **Notion 的正文与待办混排、折叠补充信息、同一内容的轻量视图切换**。最应保留的是“打开立即写、写完自动保存”，不能要求用户先配置数据库、来源、页码、标签或知识图谱。

建议桌面固定为“侧栏 → 记录列表 → 正文”三栏：侧栏只有今日、全部、笔记、收藏与回收；列表含公开的搜索框；正文直接输入。属性（提醒、地点、备注）按需展开。所有功能有可见入口，命令面板只是加速方式。用户的待办内容、草稿和原有私有云同步规则优先于竞品的操作习惯。

## 方法与限制

- 阅读了 Reddit、Obsidian Forum、Hacker News、V2EX 的公开原始讨论，以下至少各五个讨论样本，同时收集支持和反例。没有登录、发帖、抓取私人工作区或个人笔记。
- 短引文用于核验观点；体验、性能、情绪均标为发帖者主张，不当作本次实测结论。功能事实另用官方文档核对。
- Reddit 页面部分只暴露相对日期，因此明确记为“日期未精确取得”；能从搜索原文取得公历日期的才写确切日期。公开 Reddit JSON 请求返回 403，未绕过。
- 以具有具体使用情境的帖子为主；没有用模板营销文或二手“用户评价聚合站”充当原始用户评价。中文来源以 V2EX 为主。样本存在自选、平台与技术用户偏差，不能推出哪款软件更受大众欢迎。
- 旧帖子反映当时版本。尤其不能把 2023–2024 年的“Notion 没有离线”当作 2026 年现状；目前官方已提供离线能力，见后文。

## Obsidian：具体社交样本

| 样本与日期 | 可核验短摘录 | 体验主张与实际设计意义 |
| --- | --- | --- |
| [What's your favorite part about obsidian?](https://www.reddit.com/r/ObsidianMD/comments/1k3ompc/whats_your_favorite_part_about_obsidian/)；公开页仅相对日期，未取得精确日 | “Offline first”; “pure” markdown | 用户 kaysn 重视离线、本地文件与任意文本编辑器可读。回复同时争论这些保障在日常是否重要。**借鉴**：清楚显示本机保存状态、Markdown 可导出/可打开；不要把“本地优先”只做宣传口号。 |
| [Did any of you had a hard time learning obsidian?](https://www.reddit.com/r/ObsidianMD/comments/1by9per/did_any_of_you_had_a_hard_time_learning_obsidian/)；公开页仅相对日期，未取得精确日 | “Basic functionality is very simple: notes and folders.” | 一位回复者认为文件夹、笔记与基础快捷键容易理解，命令面板使功能可搜索；同一回复指出 Markdown 语法、插件设置和 CSS 会使非技术用户畏惧。**借鉴**：普通输入无需先学习语法；常用操作有按钮，键盘是第二通道。 |
| [My struggles with Obsidian for college](https://forum.obsidian.md/t/my-struggles-with-obsidian-for-college-asking-for-organization-advice/96108)；2025-02-05 | “more work and pressure” | 大学生喜欢软件，但每条笔记都要想标签、链接、体系，反而增加记录负担。回复建议按实际需要使用文件夹或链接，而非强套方法。**借鉴**：关联与标签均可跳过；不把“每条必有双链”做校验。 |
| [Daily Note ideas](https://www.reddit.com/r/ObsidianMD/comments/1knincr/daily_note_ideas/)；2025-05-15（搜索原文日期） | “simple, uncomplicated, and clean” | 有用户只保留每日记录、临时待办、收件箱；另有人反对把长期知识都埋入每日文件，担心以后找不到。**借鉴**：“今日”是按日期投影的视图，长期笔记仍可全文搜索、独立存在；不强迫每日创建复杂模板。 |
| [Top 10 Recommended Plugin List](https://www.reddit.com/r/ObsidianMD/comments/1f2qre4/top_10_recommended_plugin_list/)；公开页仅相对日期，未取得精确日 | “Work IN Obsidian, not ON Obsidian.” | 社区建议先熟悉原生功能，遇到真实缺口再装插件；也有人不同意“每条笔记必须连另一条”。**借鉴**：首版核心体验完整可用，插件市场/图谱/自定义CSS不作为首屏目标。 |
| [Obsidian 真是个好东西，准备切过去了](https://www.v2ex.com/t/1082827)；2024-10-23 | “文档完全保存在本地” | 发帖者称赞即时渲染、双链、本地文件对应和迁移；也报告编辑/大纲的小问题，并主张专心笔记、少装插件。长文“不卡”是其机器上的个人实测，**不是本报告的跨设备性能结论**。**借鉴**：编辑与预览紧邻、关联不打断正文、可核验的本地落盘。 |

这些样本中，优势不是“图越复杂越好”，而是 **内容留得住、找得回、写起来不被系统打断**。双链和可定制是增益；强制组织、插件配置与同步选择则可能成为额外工作。

## Notion：具体社交样本

| 样本与日期 | 可核验短摘录 | 体验主张与实际设计意义 |
| --- | --- | --- |
| [Favorite feature in notion](https://www.reddit.com/r/Notion/comments/1jzvr4o/favorite_feature_in_notion/)；2025-04-15 | “Toggles.”; “Relational databases with tabbed database views.” | 用户偏好的对象不一致：有人重折叠，有人重数据库多视图，也有人称赞可定制主页和分栏。**借鉴**：备注默认折叠；同一批记录支持轻量列表/卡片切换。不能据此让所有用户先理解关系数据库。 |
| [There’s something about Notion that always brings me back](https://www.reddit.com/r/Notion/comments/1s1mylf/theres_something_about_notion_that_always_brings/)；2026-03-23（搜索原文日期） | “a system that works for me” | 主帖与回复赞赏自己可控的组织和视觉链接；也有回复认为新增 AI 干扰，自己只用一小部分功能。**借鉴**：保留轻量定制与关联，默认只露出写作需要的功能，不把AI入口抢到正文前。 |
| [Are We Making Notion Too Complicated?](https://www.reddit.com/r/Notion/comments/1jcw3y1/are_we_making_notion_too_complicated_after_6/)；2025-03-16 | “Templates that require a 45-minute tutorial” | 六年用户批评好看却难懂的仪表盘、不必要的属性和无效小组件；也认可早期模板提供过价值。**借鉴**：首页不是展示模板的舞台；首条记录只要正文，提醒/备注后补。这个反例与眼前日程用户既有投诉高度一致。 |
| [Notion releases offline mode — Hacker News](https://news.ycombinator.com/item?id=44954665)；2025-08-19 | “Notion for my team, Obsidian for myself.” | 一位使用者描述团队政策、流程、项目资料集中在可搜索的知识库；其他人强调个人本地文件与迁移。**借鉴**：文档可整理和检索，协作与个人笔记是不同任务；首版眼前日程不应伪称已经具备多人权限或团队数据库。 |
| [Has anyone stopped using Notion tables because they are just too slow and clunky?](https://www.reddit.com/r/Notion/comments/152t18e/has_anyone_stopped_using_notion_tables_because/)；2023年旧讨论，精确日未取得 | “just use a simple to-do list” | Windows 用户表示曾喜欢交叉链接数据库，但数据增加后觉得慢，回到简单列表；评论也谈到表格横向滚动难用。这是旧版体验证词，不是对当前版本的性能判定。**借鉴**：大量记录先检索和虚拟/按需显示，别在首页同时渲染多套复杂数据库视图。 |
| [你们真觉得 notion 好用吗？](https://www.v2ex.com/t/806673)；2021-10-09 | “牢记‘写’才是关键” | 主帖抱怨整理时间超过记录；回复则肯定互引、同步块、分栏和资源嵌入，并提醒按自己的工作流使用。**借鉴**：把正文、清单、链接放在同一页，组织能力随内容长出来。此旧帖不作为2026定价或离线事实。 |

中文对照补充：[请问笔记大佬 Notion 和 Obsidian 对比](https://www.v2ex.com/t/1184085) 页面显示 Jan 8（页首未显示年份，故不强行定年）。有人认为 Notion 新建页即写、同步方便，另有人仍没理解数据库；正好说明“基础路径容易”与“高级系统难搭建”可以同时成立。该帖的隐私、价格、AI和离线说法不用于确定当前产品事实。

## 功能事实：用官方资料核对

| 事实 | 官方出处 | 对眼前日程的边界 |
| --- | --- | --- |
| Obsidian 的 vault 是本地文件夹，笔记为 Markdown 纯文本；其他编辑器可编辑，外部文件变更会刷新 | [How Obsidian stores data](https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data) | 真正承诺“本地Markdown”时，必须有实际文件，不可只用浏览器localStorage再换个名称。 |
| Quick switcher 默认 Cmd/Ctrl+O，按名称/别名检索，键盘选中并打开；命令面板默认 Cmd/Ctrl+P | [Quick switcher](https://help.obsidian.md/Plugins/Quick+switcher)、[Command palette](https://help.obsidian.md/Plugins/Command+palette) | 可借鉴动作链，不必照搬全部快捷键；眼前现有Cmd/Ctrl+K搜索约定可保留，但应在菜单中展示。 |
| Obsidian 支持 `[[Wikilink]]` 与普通 Markdown 链接，支持重命名时更新内部链接 | [Internal links](https://help.obsidian.md/Linking+notes+and+files/Internal+links) | 先做可点击关联和反向引用；重命名自动重写等只有实现与验证后才能声明。 |
| Notion 可新建空页立即输入；`/`打开块类型菜单；选中文字有格式菜单 | [Create a page](https://www.notion.com/help/create-your-first-page) | 普通书写无需先选类型；提供少量标题/清单/引用命令即可，首版不必重造完整块编辑引擎。 |
| 同一Notion数据库可切换table、board、calendar、list、gallery等视图并筛选排序 | [Views, filters, sorts & groups](https://www.notion.com/help/views-filters-and-sorts) | 学“同一数据、多种呈现”，不学必须先填一屏属性。 |
| Notion目前所有计划成员均可在桌面/移动App使用离线页；浏览器不支持此能力；免费手动下载页，付费另有自动下载。子页面需单独下载，数据库离线范围有限 | [Use pages offline](https://www.notion.com/help/use-pages-offline) | 不能再写“Notion完全不能离线”。本地即写/断网可开仍是眼前可独立验证的产品目标。 |
| Notion官方列出记录量、可见属性、复杂排序/筛选和多内联数据库会影响加载 | [Optimize database performance](https://www.notion.com/en-gb/help/optimize-database-load-times-and-performance) | 性能工程需测量，不能把社媒抱怨直接归因给Electron或JavaScript。 |

## 眼前日程电脑版：操作逻辑建议

### 最短的三条路径

1. **记下来**：打开软件直接落在正文输入 → 输入文字 → 停笔本机保存。无需标题、类型、日期、来源；首行可自动成为列表标题，空白内容不创建垃圾记录。
2. **找回来**：常驻搜索框 → 底下仍展示全部记录或关键词匹配 → 上方独立显示最多四条语义相关结果。此路径延续用户已确认过的搜索逻辑，不能用纯语义搜索替代普通匹配。
3. **做起来**：把一段文字变为待办 → 可选设置提醒 → 进入今日列表；完成后可恢复。详细时间戳和备注折叠，不挤占正文。

### 实现优先级映射（建议，不是已完成功能）

| 借鉴 | 首版建议 | 明确避免 |
| --- | --- | --- |
| Obsidian本地可迁移 | 本地Markdown文件/可靠存储、实际导出、崩溃恢复、保存状态；保存失败要保留草稿 | 把“自动保存”做成只更新UI，或为测试清用户文件 |
| 键盘检索 | Cmd/Ctrl+K搜索；Cmd/Ctrl+P命令面板；Cmd/Ctrl+N新记录；Esc退出浮层；上下键选择、Enter打开 | 只有快捷键没有可见入口；跟输入法组合状态冲突 |
| 可选双链 | 输入`[[`可联想已有笔记；正文点击打开；右侧按需展开反向引用 | 要求用户每条都加链接；首屏塞关系图谱 |
| Notion正文混排 | Markdown标题、勾选清单、引用和链接；可见格式工具；读/写切换 | 首屏几十种块类型、复杂拖拽树和数据库字段选择器 |
| 折叠信息 | 提醒/地点/备注/完整创建修改时间在详情区；默认只正文 | 来源、版本、页码等与当前任务无关的强制字段 |
| 同一内容多视图 | 列表和卡片是同一份记录的展示；“今日”是过滤视图 | 不同视图复制一份数据，导致编辑/完成状态不同步 |
| 安静、个性化 | 白/黑主题，初音蓝强调；可爱原创图标；信息密度可调但默认简洁 | 表面仿Notion黑白或Obsidian紫色；复制商标、IP角色形状或无意义装饰仪表盘 |

### 操作易用性验收要点

- 新用户不读教程，能在一次打开后输入第一条记录；退出再开内容仍在。
- 本地保存失败、云端未确认、断网三种状态能区分，不显示假成功。
- 列表与正文均能键盘到达；搜索结果不抢正文输入焦点。
- 立即全选替换、中文输入法组合、切换记录、窗口失焦、关闭重开不导致原文拼接或草稿丢失。
- 导入/导出是可核验的文件，安全地处理附件路径；不能把不支持的Notion数据库关系悄悄丢掉后仍说“完整导入”。
- `[[关联]]`、Markdown、命令面板是可选加速，普通笔记用户不必知道术语。

## 本报告与REA的分工

本文件只建立“公开用户如何描述体验”和“官方确认的功能行为”。客户端采用何种组件、包内命令如何注册、窗口与存储边界，须引用独立REA静态产物证据；不能用本报告反推已逆向得到完整实现，更不能据社媒主张复制第三方闭源代码。
