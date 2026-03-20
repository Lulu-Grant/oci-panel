# OCI Panel / 甲骨文控制面板

[![Build](https://github.com/Lulu-Grant/oci-panel/actions/workflows/build.yml/badge.svg)](https://github.com/Lulu-Grant/oci-panel/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/Lulu-Grant/oci-panel)](https://github.com/Lulu-Grant/oci-panel/commits/main)

统一的 Oracle Cloud / OCI 多账户资产控制台。

OCI Panel is a multi-account Oracle Cloud infrastructure console focused on account binding, instance lifecycle operations, asset visibility, capacity insights, creation workflows, and auditability — not just a lightweight power-toggle tool.

## 首页展示图 / 架构图

项目架构说明已整理到：

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

其中包含：
- 高层架构图
- 产品结构图
- 手动刷新控制台的数据流图

## 项目定位

这不是简单的实例开关机工具，而是一个逐步平台化的 OCI 资产控制台，采用两层结构：

- 平台用户账户
- 用户绑定的多个 OCI 账户
- OCI 账户下的资产、日志、容量与创建能力

当前方向重点：
- 多账户 OCI 资产管理
- 实例资产查看与控制
- 创建实例与创建前可行性提示
- 容量 / 资源查询
- 日志 / 审计
- 逐步扩展更多 OCI 原生能力

## Screenshots

### 平台基础
- 平台注册 / 登录
- next-auth 认证基础壳
- middleware 保护
- Prisma 7 + SQLite
- 敏感凭据服务端加密存储
<img width="688" height="681" alt="截圖 2026-03-20 18 05 24" src="https://github.com/user-attachments/assets/e2c88d1f-609a-40b6-8a5e-e8fa36002220" />

### OCI 账户管理
- 添加 OCI 账户
- 测试连接
- 默认账户
- 编辑 / 删除 / 启用 / 停用账户
- 当前用户范围内的账户隔离（user-scoped）
- 账户存储已切到 Prisma `OciAccount`
<img width="1359" height="947" alt="截圖 2026-03-20 18 06 15" src="https://github.com/user-attachments/assets/f8a6be82-a7d6-49b9-af4a-d9c8e5604b82" />

### 实例管理
- 实例列表读取
- 开机 / 关机 / 重启
- 搜索与状态筛选
- 资产标记（公网 / 双栈 / Flex / 风险）
- 详情弹窗
- 创建后状态跟踪
- 高级 DD 功能已转向 OCI 原生能力版探索（不再继续强化 SSH 凭据输入方案）
<img width="1442" height="400" alt="截圖 2026-03-20 18 06 38" src="https://github.com/user-attachments/assets/a9de6b6b-60e2-404a-96fd-c52cdba850b5" />

### 实例资产详情
- 实例基础信息
- 镜像 / 系统信息
- Shape 深信息
- VCN / Subnet / VNIC / NSG 明细
- Boot Volume 明细
- 风险提示
- 资产关系区
<img width="1429" height="726" alt="截圖 2026-03-20 18 07 09" src="https://github.com/user-attachments/assets/f3b101c0-9b90-4350-91ce-63a2ad099cf5" />

### 创建实例
- 账户切换联动
- AD / Shape / Image / VCN / Subnet 加载
- Shape / 镜像搜索与快捷筛选
- 网络约束校验
- Flex OCPU / 内存输入
- 模板预设
- 默认配置记忆
- 调用真实 OCI `launchInstance`
- 与 capacity 联动的创建可行性提示
- 支持 `generated-ssh` / `manual-ssh` / `password` 三种登录初始化模式
<img width="786" height="379" alt="截圖 2026-03-20 18 07 58" src="https://github.com/user-attachments/assets/0b57d97f-7175-4c28-9a9b-67ebec317e65" />
<img width="641" height="526" alt="截圖 2026-03-20 18 07 54" src="https://github.com/user-attachments/assets/2cd2f26f-1625-407d-898c-14cd2007ce9b" />
<img width="788" height="780" alt="截圖 2026-03-20 18 07 50" src="https://github.com/user-attachments/assets/de4caa6c-3fd1-43af-9307-c27dfa931143" />
<img width="782" height="686" alt="截圖 2026-03-20 18 07 44" src="https://github.com/user-attachments/assets/86d4622a-aad3-4e4f-b7ca-811adadc2c7b" />

## 当前已完成主线

### 已完成平台化阶段
- Phase 1：平台认证基础壳
- Phase 2：OCI 账户 user-scoped 化
- Phase 3：日志 user-scoped 化
- Phase 4：主 API user-scoped 化
- Phase 4.5：legacy JSON 双轨清理

### 已完成 P2 主线
- P2A：创建实例增强
- P2B：实例详情资产化
- P2C：实例列表资产化
- P2D：Capacity 产品化
- P2E：Dashboard 产品化第一版

## 手动刷新控制台策略

项目当前采用“手动刷新型控制台”策略：

- 页面优先显示上次成功加载的数据
- 不主动每次进页就重新请求
- 只有点击刷新按钮才拉最新
- 显示“上次刷新时间”
- 新增 / 编辑 / 删除等操作后优先局部更新或标记过期
- 不自动整页重查

当前已接入页面：
- `/accounts`
- `/`
- `/instances`
- `/capacity`
- `/logs`
- `/create`

## 数据存储现状

当前主数据源：

- OCI 账户：Prisma `OciAccount`
- 日志：Prisma `OperationLog`

已不再作为运行时主数据源：

- `data/oracle-accounts.json`
- `data/operation-logs.json`

旧 JSON 仅用于显式迁移。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Prisma 7
- SQLite
- `@prisma/adapter-better-sqlite3`
- next-auth
- oci-sdk

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev -- --hostname 0.0.0.0
```

默认地址：
- `http://localhost:3000`

## 环境变量

见 `.env.example`。

本地基础示例：

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="change-me-to-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED="false"
```

说明：
- 本地默认仅启用邮箱密码登录
- Google 登录只有在后端与前端环境变量都配置完整时才应启用
- 未启用 Google 时，前端不应显示真实 Google 登录按钮

## 运行方式

### 开发模式

```bash
npm run dev -- --hostname 0.0.0.0
```

### 常驻模式（macOS launchd）

服务名：
- `org.openclaw.oci-panel`

常用命令：

```bash
launchctl print gui/$(id -u)/org.openclaw.oci-panel
launchctl kickstart -k gui/$(id -u)/org.openclaw.oci-panel
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/org.openclaw.oci-panel.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/org.openclaw.oci-panel.plist
```

日志位置：
- `.runtime/launchd.out.log`
- `.runtime/launchd.err.log`
- `.runtime/oci-panel.out.log`
- `.runtime/oci-panel.err.log`

## Roadmap

近期最值得继续的方向：

- [ ] 推进 Instances 页面 DD 的 OCI 原生能力版，从能力检测走向真实任务提交
- [ ] 深挖 `osmanagementhub` 的 job / work request / managed instance 能力
- [ ] 继续强化 Dashboard 首页作为多账户 OCI 控制台入口
- [ ] 打磨 Create / Capacity / Instances 的统一体验
- [ ] 增强日志 / 审计 / 错误态 / 空态体验
- [ ] 逐步补齐 GitHub Actions / CI / 文档体系

## Legacy 迁移

如果旧 JSON 还需要迁移到数据库：

```bash
npm run migrate:legacy-json -- --email you@example.com
npm run migrate:legacy-json -- --user-id <platform-user-id>
npm run migrate:legacy-json -- --email you@example.com --archive
```

参考文件：
- `LEGACY_CLEANUP.md`
- `scripts/migrate-legacy-json-to-prisma.mjs`

## 重要项目文件

如果要快速理解项目，优先阅读：

- `PROJECT_INDEX.md`
- `prisma/schema.prisma`
- `src/lib/auth.ts`
- `src/lib/accounts-store.ts`
- `src/lib/logs-store.ts`
- `src/lib/oci.ts`
- `src/lib/manual-cache.ts`
- `src/app/create/page.tsx`
- `src/app/instances/page.tsx`
- `src/app/capacity/page.tsx`

## 开发原则

- 不要回退到 JSON 运行时存储
- 不要把项目做回“实例开关机小工具”
- 不要回退手动刷新控制台策略
- 不要继续把 DD 做成 SSH 凭据输入式方案
- 新一轮开发前建议先读 `PROJECT_INDEX.md`
- 做完大改后记得同步更新索引文件

## 开源协作

- 贡献指南：`CONTRIBUTING.md`
- 安全说明：`SECURITY.md`
- License：`MIT`
