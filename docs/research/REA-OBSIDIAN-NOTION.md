# 眼前日程电脑版：Obsidian / Notion 的 REA 静态研究

研究日期：2026-11-19。用户已确认第二款软件是 Notion。

本报告只读本机明确安装的应用包，没有打开用户 vault、读取 Notion 工作区、账户缓存、笔记内容，也没有执行目标应用、安装扩展或复制厂商源码到“眼前日程”。这里的“逆向”指实际使用 REA 读取公开分发客户端的 ASAR/JavaScript 产物并建立静态图，不是复刻厂商服务端或证明运行时行为。

## 1. 实际工具与分析对象

已读取 `reverse-engineer-anything` 技能。当前会话没有暴露 REA MCP 工具，版本固定的 CLI 为 `rea-agents@6.7.0`，Node 为24.18.0。`doctor --client codex` 提示 Codex MCP registration `config_drift`；本轮没有修改Codex配置，没有安装Hopper/Ghidra。静态 JavaScript CLI 不依赖这些原生引擎。

| 客户端产物 | 安装版本 | 文件大小 | SHA256 |
| --- | --- | ---: | --- |
| Obsidian `Contents/Resources/app.asar`（启动壳） | 1.14.4 | 480117 B | `839ef8317ee0cf4f5c63273939441ca9bdb7e32c9e84864ee23037a45eb6df00` |
| Obsidian `Contents/Resources/obsidian.asar`（应用核心） | 1.14.4 | 27477966 B | `146ef8470d8cbb4a6db209bdc19bf2bad13350444186c0fd93c31087b142b92f` |
| Notion `Contents/Resources/app.asar`（桌面壳） | 7.39.0 | 13494750 B | `cebe52a8b18e8108ac60b4dbb91b7b0edab6fdd3f53be75fab582b532b66cbad` |

来源是 `/Applications/Obsidian.app` 和 `/Applications/Notion.app` 已安装产物，本轮没有下载，因此不能把某个官方下载链接说成本次二进制的下载来源。官方分发入口分别是 [Obsidian下载](https://obsidian.md/download) 与 [Notion桌面版](https://www.notion.com/desktop)。版本由安装包Info.plist与内嵌package.json交叉核对。

`codesign --verify --deep --strict` 对两款安装包均返回0。签名显示Obsidian为Dynalist Inc.（Team `6JSW4SJWN9`），Notion为Notion Labs, Incorporated（Team `LBQJ96FQ8D`）。这不等于本轮已经审计其全部安全性。

### REA Evidence 身份与范围

| Evidence | 选定来源 | 实际解析 | 限制 |
| --- | --- | --- | --- |
| `ev_6b4d8fb6036274b0234e1090a1bd3031a39de6670b71b1e2ef7c20de582079d8` | Obsidian启动壳全部相关文件 | 19个JS文件；27个相关文件，0 parse failures | 图为partial；unpacked native完整性声明存在矛盾，按untrusted记录 |
| `ev_c0ac9bf3b0d83e45a3c8fb0405f659d39ccf1a2320350351fb86656378fdf483` | Obsidian核心 `package.json / main.js / app.js` | 2个JS文件，4146088文本字节，0 parse failures | 另35个相关文件不在选定源码范围，动态关系仍未知 |
| `ev_922d1d16679b93a146d65cbfcdff585bddf7c88f8bb6f159edf5ba42cf7d1788` | Notion `package.json / .webpack/main/index.js / .webpack/renderer/tabs/index.js / .webpack/renderer/tab_browser_view/preload.js` | 2个JS完成，1个JS因内存限制跳过；5861936文本字节 | tabs bundle触及1GiB worker heap；另156文件不在选定范围；远程主编辑器不在本地壳内 |

完整原始Evidence保留在本机 `tmp/research/rea/`，约133MB，不应随产品提交GitHub。可发布的精简摘要在 [rea-artifact-summary.json](evidence/rea-artifact-summary.json)，保留Evidence ID、产物摘要、范围、限制与少量节点位置，不包含厂商完整源码。

REA第一次严格校验发现部分unpacked `.node` 的ASAR声明摘要与当前文件字节不同。遵循REA给出的可读恢复路径，以 `--integrity-policy record-and-continue` 重跑，只作静态JS分析，矛盾被保留为untrusted。可能与打包后签名或strip有关，但本轮没有证明具体原因，不能把它称为恶意篡改或漏洞。

## 2. 从产物得到的架构事实

### Obsidian

- 核心REA静态图找到47个字面IPC主进程处理观察，含 `vault-list / vault-open / open-file / vault-move / trash / context-menu / print-to-pdf`。例如 `vault-open` 位于核心 `main.js` 第66行、第5774列附近，节点 `jag_node_7b5628a555b8d3956ccc9b5baa2267a85087f1975c49691d4b389b2c9a6089a8`。
- 这些处理点表明桌面壳把资料库、文件、原生上下文菜单等操作放在系统能力边界。它们是静态注册观察，不证明任意输入都能调用、路径校验完备或运行中一定启用。
- 自行读取同一已哈希ASAR的惰性文本可见 `command-palette:open`、`switcher:open`、`daily-notes` 等字面标识。该补充是普通产物字符串检查，不能冒充新的REA语义关系。
- [官方数据存储说明](https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data)确认Markdown纯文本保存在本地vault目录，元数据缓存可重建，文件可以由其他编辑器管理。这个产品事实由官方文档支持；并非仅凭IPC名称推断。

### Notion

- REA在 `tab_browser_view/preload.js` 中识别出 `__electronApi` 桥接面，静态列出231个成员。与本项目有关的少量成员为 `openQuickSearchResult / openSearchModalFromQuickSearch / newTab / closeTab / newWindow / workspaceSwitcher / sidebarState / setZenMode`。源位置与确切节点保存在精简摘要。
- 静态图还见名为 `Sqlite Server` 和 `Desktop MCP Host` 的utility process观察。存在SQLite服务不能单独证明全部离线功能或同步正确性。
- 本地包主要提供桌面系统集成、标签页、快速搜索、权限等壳能力；页面/数据库主编辑器还依赖远程应用资产。本轮没有在登录态运行Notion，也没有抓私人网络流量，不能声称完整逆向了Notion块编辑器或服务端。
- `tabs/index.js` 因分析worker内存限制未完成，不能把该范围没有发现的能力当作不存在。

两者都采用Electron，但这不构成“眼前日程必须使用同样的内部架构”的理由。可借鉴的是把文件保存、原生窗口和权限与正文编辑分开，让界面只拿到完成当前任务所需的窄接口。

## 3. 操作逻辑与易用性：文档交叉验证

下表是对已核对交互的可用性分析，不是用户实验或速度跑分。

| 交互 | 已核对行为 | 易用性收益 | 眼前日程的取舍 |
| --- | --- | --- | --- |
| 快速打开 | Obsidian Cmd/Ctrl+O，输入名称/别名，方向键和Enter；空搜索显示最近笔记，无结果可创建 | 省去逐层找目录；旧内容再次找到的路径短 | 统一Cmd/Ctrl+K，空态展示最近/收藏，键盘可全程操作 |
| 命令面板 | Obsidian Cmd/Ctrl+P，可按命令名模糊搜索，有最近与置顶命令 | 功能多时减少记菜单层级；也帮助发现功能 | 仅放少量高频命令，支持 `>` 前缀，不把所有设置塞满首页 |
| 搜索/最近 | Notion Cmd/Ctrl+K或P搜索、跳转最近页 | 同一入口兼顾回忆名称与找最近内容 | 搜索正文/标题/标签，命中结果保留上下文，不替换全部记录列表 |
| 直接新建 | Notion桌面Cmd/Ctrl+N新页 | 不需要先建数据库或填属性 | 打开即可写；标题从首行得到，提醒和标签均后补 |
| 块与斜杠 | Notion由可变换/可重排的块组成，`/`列出内容类型，`[]`加空格可建待办 | 从纯文本渐进增强；鼠标与键盘都有路径 | 只提供正文、标题、待办、引用等少量插入；避免数据库属性表先行 |
| 双链/导航 | Notion官方快捷键说明支持 `[[` 链接页面；Obsidian本地文件和关联机制具有清晰的文件语义 | 相关内容从正文可直达，减少重复录入 | `[[笔记名]]` + 可选关联侧栏；不以复杂关系图作为默认首页 |

依据：[Obsidian快切](https://help.obsidian.md/plugins/quick-switcher)、[命令面板](https://help.obsidian.md/plugins/command-palette)、[Notion快捷键](https://www.notion.com/help/keyboard-shortcuts)、[Notion块模型](https://www.notion.com/help/what-is-a-block)。

Obsidian的可扩展性也意味着初学者需要理解vault、Markdown、插件与命令；Notion的块/页面/数据库给结构化工作带来空间，也会增加“先选类型再写”的负担。这是本报告对概念数量和操作路径的设计判断，社交媒体口碑应由独立反馈样本补证，不能从客户端包里推导“用户普遍喜欢”。

## 4. 建议落在眼前日程电脑版的八项能力

1. **直接写，自动存**：默认正文编辑器可以立即输入；不强制标题、类型、来源、版本或时间。显示真实“本机已保存/同步待确认”状态，写入失败不假报。
2. **桌面三栏，按需收起**：左侧资料库/标签，中栏笔记列表，右侧正文。聚焦模式收起两栏，首页没有多层弹窗。
3. **统一键盘入口**：Cmd/Ctrl+K搜索和最近笔记，Cmd/Ctrl+N新建，Cmd/Ctrl+S明确保存；搜索结果支持方向键/Enter，Esc可退。
4. **轻量块能力**：在空行使用 `/` 插入待办、标题、引用或分隔线；保持Markdown可读，不先搬完整Notion数据库。
5. **双链与关联栏**：`[[...]]` 连接笔记，相关内容侧栏按需打开；避免把关系图当成写作必经入口。
6. **本地可带走**：Markdown导入导出、完整备份、文件夹打开/保存原子写入；若实现了真实文件库再宣称“本地文件库”，浏览器localStorage不能冒充此能力。
7. **日程继续贴着正文**：待办勾选、提醒后补、完成可恢复；保留手机端最短流程，桌面端增加快捷键和密集列表。
8. **原生能力窄桥接**：只允许可信应用页访问选定文件夹、导出、系统通知；外链进入系统浏览器，renderer不拿任意文件系统权限或服务凭据。

## 5. 发布边界

允许发布本报告、精简摘要和自行实现的产品代码；完整第三方ASAR、厂商源码和巨型原始REA图留在本机研究目录。报告没有解密、绕过授权、账户抓取或服务端复刻，也不支持“性能更快”“没有安全问题”“全功能离线”等未经运行时验证的结论。

本轮研究确认的是特定安装版本的静态证据，加官方文档的交互说明。桌面成品仍需独立验证输入、保存、重启恢复、Markdown导入导出、快捷键、窗口边界和权限。
