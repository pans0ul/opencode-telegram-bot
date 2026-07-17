# 代码结构

## 项目概览

**opencode-telegram-bot** 是一个 TypeScript 项目，充当 Telegram 与本地 OpenCode 服务器之间的桥梁。用户通过 Telegram 发送指令，bot 转发给 OpenCode 执行，并将结果聚合后返回 Telegram。

## 技术栈

- **语言:** TypeScript 5.x (strict mode)
- **运行时:** Node.js 20+
- **Bot 框架:** grammY + @grammyjs/menu
- **OpenCode SDK:** @opencode-ai/sdk
- **存储:** better-sqlite3 (定时任务) + JSON (设置)
- **测试:** Vitest
- **代码质量:** ESLint + Prettier

## 目录结构

```
src/
├── index.ts              # 源码模式入口
├── cli.ts                # CLI 入口 (bin)
├── config.ts             # 环境变量读取与集中配置
├── app/
│   └── start-bot-app.ts  # 应用启动：加载配置 → 创建 Bot → 启动 polling
│
├── bot/                  # Bot 层 (核心)
│   ├── index.ts          # grammY Bot 创建、命令注册、callback 路由、SSE 回调绑定
│   ├── commands/         # 23 个命令处理 (23 个 .ts 文件)
│   │   ├── definitions.ts  # 命令定义（单一来源）
│   │   ├── abort.ts / new.ts / sessions.ts / projects.ts / worktree.ts
│   │   ├── status.ts / help.ts / start.ts / detach.ts / rename.ts
│   │   ├── task.ts / tasklist.ts / commands.ts / skills.ts / mcps.ts
│   │   ├── open.ts / ls.ts / messages.ts
│   │   ├── opencode-start.ts / opencode-stop.ts / tts.ts / models.ts
│   │   └── ...
│   ├── handlers/         # 交互处理器 (11 个文件)
│   │   ├── prompt.ts     # 用户文本 prompt 处理
│   │   ├── question.ts   # OpenCode 问题回答
│   │   ├── permission.ts # 权限请求处理
│   │   ├── model.ts / agent.ts / variant.ts / context.ts
│   │   ├── voice.ts / document.ts / media-group.ts
│   │   └── inline-menu.ts
│   ├── middleware/        # 中间件 (3 个文件)
│   │   ├── auth.ts               # 用户白名单校验
│   │   ├── interaction-guard.ts  # 交互流程守卫
│   │   └── unknown-command.ts    # 未知命令处理
│   ├── streaming/         # 实时响应流
│   │   ├── response-streamer.ts  # 助手回复流式发送
│   │   └── tool-call-streamer.ts # 工具调用流式显示
│   ├── utils/             # Bot 工具 (20 个文件)
│   │   ├── telehram-text.ts / assistant-rendering.ts
│   │   ├── keyboard.ts / send-with-markdown-fallback.ts
│   │   ├── file-download.ts / file-tree.ts / workspace.ts
│   │   ├── thinking-message.ts / finalize-assistant-response.ts
│   │   ├── send-tts-response.ts / send-downloaded-file.ts
│   │   ├── external-user-input.ts / switch-project.ts
│   │   ├── busy-guard.ts / busy-reconciliation.ts
│   │   ├── abort-error-suppression.ts / assistant-run-footer.ts
│   │   ├── commands.ts / browser-roots.ts / telehram-file-url.ts
│   │   └── ...
│   ├── assistant-run-state.ts  # 助手运行状态跟踪
│   ├── message-patterns.ts     # 按钮文本正则模式
│   ├── scope.ts               # Telegram 作用域/线程路由
│   └── telehram-client-options.ts  # grammY 客户端选项
│
├── opencode/             # OpenCode 客户端层
│   ├── client.ts         # SDK 初始化 + Basic Auth
│   ├── events.ts         # SSE 事件订阅 (global/legacy)、自动重连
│   ├── process.ts        # 本地 OpenCode 进程管理 (spawn/kill/pid)
│   ├── auto-restart.ts   # 健康检查 + 自动重启
│   ├── ready-lifecycle.ts  # 就绪生命周期
│   └── ready-refresh.ts    # 就绪刷新
│
├── summary/              # 汇总管道
│   ├── aggregator.ts     # 核心：SSE 事件分类/聚合 → 分发回调
│   ├── formatter.ts      # 工具调用格式化 + 代码文件准备
│   ├── subagent-formatter.ts  # 子 agent 卡片格式化
│   ├── tool-message-batcher.ts # 工具消息批处理
│   └── markdown-to-telegram-v2.ts  # Markdown → TelegramV2 转换
│
├── scheduled-task/       # 定时任务
│   ├── runtime.ts        # 定时任务运行时引擎
│   ├── executor.ts       # 任务执行器
│   ├── creation-manager.ts  # 创建流程管理
│   ├── store.ts          # SQLite 存储
│   ├── schedule-parser.ts   # cron 风格解析
│   ├── display.ts / next-run.ts / types.ts
│   ├── foreground-state.ts  # 前台 session 状态
│   └── session-ignore.ts    # session 忽略列表
│
├── interaction/          # 交互流程管理
│   ├── manager.ts        # 交互状态机 (start/transition/clear)
│   ├── guard.ts          # 交互守卫
│   ├── busy.ts           # 忙碌状态管理
│   ├── cleanup.ts        # 状态清理
│   └── types.ts          # 类型定义
│
├── session/              # Session 管理
│   ├── manager.ts        # 当前 session 管理
│   └── cache-manager.ts  # session 信息缓存
│
├── project/              # Project 管理
│   └── manager.ts
│
├── model/                # Model 管理
│   ├── manager.ts        # model 选择/存储
│   ├── capabilities.ts   # 模型能力判断
│   ├── context-limit.ts  # 上下文限制
│   └── types.ts
│
├── agent/                # Agent 模式管理
│   ├── manager.ts
│   └── types.ts
│
├── variant/              # Variant 切换
│   ├── manager.ts
│   └── types.ts
│
├── question/             # OpenCode 问题管理
│   ├── manager.ts        # 多选/文本回答
│   └── types.ts
│
├── permission/           # 权限请求管理
│   ├── manager.ts
│   └── types.ts
│
├── attach/               # 当前跟踪 session
│   ├── manager.ts        # 连接状态
│   └── service.ts        # 恢复/标记忙碌/空闲
│
├── pinned/               # 置顶消息管理
│   ├── manager.ts        # 置顶消息更新
│   ├── format.ts         # 格式化
│   └── types.ts
│
├── keyboard/             # Reply Keyboard 管理
│   ├── manager.ts        # 按钮状态更新
│   └── types.ts
│
├── settings/             # 持久化设置
│   └── manager.ts        # settings.json 读写
│
├── topic/                # Forum Topic 绑定
│   ├── manager.ts        # session ↔ topic 映射
│   ├── index.ts / constants.ts / title-format.ts
│
├── background-session/   # 后台 session 通知
│   └── tracker.ts
│
├── external-input/       # 外部用户输入抑制
│   └── suppression.ts
│
├── git/                  # Git Worktree 切换
│   └── worktree.ts
│
├── stt/                  # 语音转文字
│   └── client.ts         # Whisper 兼容 API 客户端
│
├── tts/                  # 文本转语音
│   └── client.ts         # OpenAI / Google TTS
│
├── telehgram/            # Telegram 消息渲染
│   └── render/           # 渲染管道 (9 个文件)
│       ├── pipeline.ts / block-parser.ts / block-renderer.ts
│       ├── inline-renderer.ts / chunker.ts
│       ├── markdown-normalizer.ts / validator.ts
│       ├── block-fallback.ts / types.ts
│
├── runtime/              # 运行模式
│   ├── mode.ts           # sources / installed 模式
│   ├── paths.ts          # 运行时路径
│   └── bootstrap.ts      # 配置引导
│
├── service/              # 守护进程
│   ├── manager.ts        # start/stop/status
│   ├── runtime.ts        # 子进程运行时
│   └── types.ts
│
├── cli/                  # CLI 参数
│   └── args.ts
│
└── utils/                # 通用工具
    ├── logger.ts         # 分级日志 (debug/info/warn/error)
    ├── error-format.ts   # 错误格式化
    ├── opencode-error.ts # OpenCode 错误判断
    ├── safe-background-task.ts  # 安全后台任务
    └── telehram-rate-limit-retry.ts  # Telegram 限流重试
```

## 核心启动流程

```
src/index.ts (源码模式)
  └→ resolveRuntimeMode() → setRuntimeMode()
    └→ initializeLogger()
      └→ startBotApp()
        └→ loadSettings() → 恢复持久化设置
          └→ reconcileStoredModelSelection() → 同步 model 选择
            └→ createBot() (bot/index.ts)
              ├→ 注册中间件: auth → ensureCommandsInitialized → interactionGuard
              ├→ 注册命令: start/help/status/sessions/projects/...
              ├→ 注册 callback 路由: question/permission/model/agent/...
              ├→ 注册 hears: agent button / model button / variant button
              ├→ 注册文本/语音/文档处理器
              └→ subscribeToEvents() (opencode/events.ts)
                └→ SSE 流 → SummaryAggregator → Telegram 发送
```

## 数据流

```
Telegram 用户
  → grammY Bot (长轮询)
    → auth 中间件 (白名单校验)
      → interactionGuard 中间件 (交互流程检查)
        → 命令处理器 / 文本处理器
          → 各 Manager (session/project/model...)
            → OpenCodeClient → OpenCode Server API

OpenCode Server
  → SSE 事件流
    → events.ts (SSE 订阅 + 自动重连)
      → SummaryAggregator (事件分类/聚合)
        → 各回调分发:
          ├→ onComplete → 最终回复 → Telegram
          ├→ onPartial → 流式中间回复 → Telegram
          ├→ onTool → 工具调用通知 → ToolCallStreamer → Telegram
          ├→ onToolFile → 代码文件 → Telegram 文档
          ├→ onQuestion → 问题 → inline 按钮 → Telegram
          ├→ onPermission → 权限请求 → inline 按钮 → Telegram
          ├→ onThinking → thinking 指示器 → Telegram
          ├→ onTokens → 上下文用量 → Keyboard + PinnedMessage
          ├→ onCost → 费用 → PinnedMessage
          ├→ onSubagent → 子 agent 卡片 → Telegram
          ├→ onSessionIdle → 会话结束 → 结尾信息 + 输出文件
          ├→ onSessionError → 错误提示 → Telegram
          └→ onSessionDiff → 文件变更 → PinnedMessage
```

## 关键模块详解

### 1. `src/bot/index.ts` — Bot 核心 (~2000 行)

这是整个程序最复杂的文件，负责：
- **Bot 创建**: 用 grammY 创建 Bot 实例，配置代理/API root
- **命令注册**: 逐一调用 `bot.command()` 注册所有 20+ 命令
- **Callback 路由**: 单一 `callback_query:data` 处理器，依次尝试 20+ handler
- **SSE 回调绑定**: 将 `SummaryAggregator` 的每个事件回调绑定到对应的 Telegram 发送逻辑
- **流式发送**: 实例化 `ResponseStreamer`（支持 edit/draft 两种模式）和 `ToolCallStreamer`
- **工具消息批处理**: 通过 `ToolMessageBatcher` 将工具消息合并发送
- **心跳检测**: 检查 event loop 是否阻塞

### 2. `src/summary/aggregator.ts` — 事件中枢

接收所有 OpenCode SSE 事件，进行状态跟踪和分发：
- 维护 `currentSessionId` 和子 agent session 的层级关系
- 处理 `message.part.delta`（流式字符拼接）
- 处理 `message.part.updated`（工具调用、子任务注册）
- 处理 `question.asked` / `permission.asked`（交互事件）
- 跟踪 token 用量、费用、文件变更
- 通过 callback 模式（`setOnXxx`）将处理结果推送给 bot 层

### 3. `src/opencode/events.ts` — SSE 订阅引擎

- 支持 **global 流**（推荐，接收所有 project 的事件）和 **legacy 流**（按 project 订阅）
- 自动重连：指数退避 (1s → 15s max)
- 空闲超时检测 (30s)
- 在事件处理间 `setImmediate` 让出 event loop，确保 Telegram 长轮询不被阻塞

### 4. `src/interaction/manager.ts` — 交互状态机

管理 bot 的交互状态（问答、权限、菜单、重命名等）：
- `start()` → 启动一个新交互
- `transition()` → 改变交互阶段（如 question 翻页）
- `clear()` → 清除交互状态
- 同一时间只允许一个交互活动

### 5. 各 Manager 设计模式

几乎所有 Manager 都采用 **单例模式**：
```typescript
class XxxManager { ... }
export const xxxManager = new XxxManager();
```

持久化设置通过 `src/settings/manager.ts` 读写 `settings.json`，定时任务通过 `src/scheduled-task/store.ts` 使用 SQLite。

## 入口文件 (`src/index.ts` vs `src/cli.ts`)

| 文件 | 入口方式 | 默认模式 | 用途 |
|------|----------|----------|------|
| `src/index.ts` | `npm start` / `npm run dev` | `sources` | 开发时直接运行 |
| `src/cli.ts` | `opencode-telegram` CLI | `installed` | 安装后使用，支持 `start --daemon` / `stop` / `status` / `config` |

## 配置 (`src/config.ts`)

所有环境变量在此读取并校验，集中导出为 `config` 对象：
- `config.telegram` — Bot Token、用户 ID、代理设置
- `config.opencode` — API URL、认证、自动重启
- `config.bot` — 列表限制、流式模式、隐藏选项、区域设置
- `config.stt` / `config.tts` — 语音配置
- `config.files` / `config.workspace` — 文件处理

## 测试结构

```
tests/                    # 镜像 src/ 结构
├── setup.ts              # 全局测试设置
├── helpers/              # 测试辅助工具
├── bot/                  # Bot 命令和处理器测试
├── opencode/             # OpenCode 客户端测试
├── summary/              # 聚合器和格式化测试
├── scheduled-task/       # 定时任务测试
├── model/ / agent/ / session/ / project/  # 各 Manager 测试
├── interaction/          # 交互状态机测试
├── stt/ / tts/           # 语音服务测试
└── ... 其他模块
```

## 关键设计原则

1. **单用户白名单** — `TELEGRAM_ALLOWED_USER_ID` 严格过滤，其他人无法使用
2. **幂等交互** — `InteractionManager` 保证同一时间只有一个交互流程
3. **流式消息** — 支持 `edit`（编辑消息）和 `draft`（草稿消息）两种模式
4. **Forum Topic 支持** — 每个 Telegram 话题线程映射到一个 OpenCode session
5. **后台 session 跟踪** — 非活跃 session 有事件时发通知，可一键跳转
6. **Callback 模式** — `SummaryAggregator` 通过 `setOnXxx` 解耦事件处理与消息发送
7. **一个 init 文件** — `src/bot/index.ts` 是核心编排器，约 2000 行
