# PROJECT_INDEX.md

> OCI Panel 项目索引文件（长期维护版）
>
> 作用：
> - 快速理解当前项目结构与主线
> - 避免开发时上下文丢失、方向跑偏
> - 作为后续开发、重构、排障时的统一检阅文件
> - 新一轮开发前建议先读一遍，重要改动后同步更新

---

# 0. 开发检阅规约（建议每次开工前看）

## 开发前 checklist

开始新一轮开发前，建议先确认：

- 当前产品定位是否仍然围绕“OCI 多账户资产控制平台”
- 本次改动属于哪条主线：
  - 平台基础
  - 账户管理
  - 实例列表
  - 实例详情
  - 创建实例
  - 容量/资源
  - 日志/审计
- 会影响哪些文件：page / api / component / lib / type
- 是否涉及 user-scoped 数据边界
- 是否涉及敏感字段或认证配置
- 是否需要更新本索引文件和 README

## 开发中约束

开发过程中要持续自检：

- 不要把数据库主线改回 JSON 运行时读写
- 不要把真实 OCI 逻辑误回退到 mock
- 不要只做“查看实例 + 开关机”而偏离资产平台主线
- 新增页面/接口时尽量考虑：
  - 当前用户隔离
  - 错误态
  - 空态
  - 与现有主线的一致性

## 开发后 checklist

每轮完成后建议确认：

- `npm run build` 是否通过
- 是否需要重启 launchd 服务
- README 是否过时
- 本索引文件是否需要补充新模块状态
- 是否有关键技术决策需要写进“不要回退的决策”区

---

# 1. 项目定位

## 当前产品定位

这是一个 **Oracle Cloud / OCI 多账户资产控制平台**，不是单纯的实例开关机小工具。

系统采用两层结构：

- 平台用户账户
- 平台用户绑定的多个 OCI 账户
- OCI 账户下的资产、操作、日志、容量与创建能力

## 当前主线目标

逐步形成统一 Web 面板，支持：

- 多账户 OCI API 管理
- 实例资产查看与控制
- 额度 / 资源查询
- 创建实例
- 资产详情页
- 后续继续扩展系统、配置、双栈、网络、模板、更多 OCI 能力

---

# 2. 当前阶段判断

## 平台化阶段

### 已完成
- Phase 1：平台认证基础壳
- Phase 2：OCI 账户 user-scoped + 数据库存储
- Phase 3：日志 user-scoped + 数据库存储
- Phase 4：主 API user-scoped 化与前端兼容
- Phase 4.5：legacy JSON 双轨移除 + 显式迁移脚本

### P2 产品化阶段

#### P2A 创建增强
已完成：
- Shape / 镜像搜索
- 快捷筛选
- 网络约束提示
- 容量参考
- 模板预设
- 默认配置记忆
- 创建前可行性提示（与 capacity 联动）

#### P2B 实例详情资产化
已完成：
- 实例概览增强
- 镜像 / 系统信息
- Shape 深信息
- 网络明细增强
- 风险提示
- 资产关系区
- Boot Volume 细节

#### P2C 实例列表资产化
已完成：
- 公网 / 双栈 / Flex / 风险标记
- 资产筛选
- 列表级风险可见性

#### P2D capacity 产品化
已完成：
- 总览卡
- Compute 重点服务展示
- 结构化 limit values
- 与 create 页联动的创建可行性提示

### 当前建议
P2 已接近完整，后续可继续：
- P2E：首页 / dashboard 产品化
- P2F：统一体验收口

---

# 3. 运行与环境

## 本地路径

- 项目根目录：`/Users/apple/.openclaw/workspace/oci-panel`

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind
- Prisma 7
- SQLite
- `@prisma/adapter-better-sqlite3`
- next-auth
- oci-sdk

## 常驻运行方式

launchd 服务名：
- `org.openclaw.oci-panel`

关键文件：
- `scripts/start-oci-panel.sh`
- `scripts/org.openclaw.oci-panel.plist`
- `~/Library/LaunchAgents/org.openclaw.oci-panel.plist`

常用命令：

```bash
launchctl print gui/$(id -u)/org.openclaw.oci-panel
launchctl kickstart -k gui/$(id -u)/org.openclaw.oci-panel
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/org.openclaw.oci-panel.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/org.openclaw.oci-panel.plist
```

默认地址：
- `http://localhost:3000`
- 局域网/本机监听：`0.0.0.0:3000`

## 当前本地认证相关环境变量

`.env` 关键项：

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`

说明：
- 本地当前默认只启用邮箱密码登录
- Google 登录只有在环境变量存在时才应该启用

---

# 4. 重要目录索引

## 根目录重要文件

### `README.md`
项目基础说明。当前已同步到平台化与 P2 现状，但后续功能大改后仍需更新。

### `PROJECT_INDEX.md`
本文件。项目长期索引与导航文件，开发时应常看、常更新。

### `LEGACY_CLEANUP.md`
legacy JSON 清理说明，记录旧数据迁移策略。

### `.env`
本地环境变量。

### `package.json`
脚本与依赖入口。

### `middleware.ts`
认证保护中间件，控制受保护页面访问。

### `prisma/schema.prisma`
数据库主 schema，平台化核心模型定义。

### `dev.db`
本地 SQLite 数据库文件。

---

# 5. 数据模型与存储主线

## Prisma 关键模型

### `User`
平台用户。

### `Account` / `Session` / `VerificationToken`
next-auth 标准认证相关模型。

### `OciAccount`
平台用户绑定的 OCI 账户。

重要点：
- 带 `userId`
- `privateKeyEncrypted`
- `passphraseEncrypted`
- `isDefault`

### `OperationLog`
用户操作日志。

重要点：
- 带 `userId`
- 可关联 `ociAccountId`
- 可记录 `instanceId`

## 当前数据真相来源

### 当前主数据源
- OCI 账户：数据库 `OciAccount`
- 操作日志：数据库 `OperationLog`

### 已不再作为运行时数据源
- `data/oracle-accounts.json`
- `data/operation-logs.json`

这些旧 JSON 只用于显式迁移，不参与请求时自动导入。

---

# 6. API 索引

## 认证与平台

### `src/app/api/auth/[...nextauth]/route.ts`
NextAuth 路由入口。

### `src/app/api/register/route.ts`
平台用户注册接口。

---

## 账户相关

### `src/app/api/accounts/route.ts`
OCI 账户主接口。

作用：
- GET：当前用户的 OCI 账户列表
- POST：新增 OCI 账户
- PATCH：设置默认账户

### `src/app/api/accounts/summary/route.ts`
账户汇总接口。

作用：
- 拉取账户统计
- 汇总实例总数 / running / stopped / 默认状态等

### `src/app/api/accounts/test/route.ts`
测试当前用户某个 OCI 账户可否正常连接。

---

## Dashboard / 首页

### `src/app/api/dashboard/route.ts`
首页总览数据接口。

作用：
- 账户级首页概览
- 当前账户实例摘要
- 当前用户日志摘要

---

## 实例相关

### `src/app/api/instances/route.ts`
实例列表接口。

作用：
- 当前账户实例列表
- 列表资产属性：公网 / 双栈 / Flex / 风险标记

### `src/app/api/instances/[instanceId]/route.ts`
实例详情接口。

作用：
- 单实例详细信息
- 镜像、Shape、网络、Boot Volume、资产关系

### `src/app/api/instances/action/route.ts`
实例动作接口。

作用：
- 开机
- 关机
- 重启
- 写入操作日志

### `src/app/api/instances/create/route.ts`
实例创建接口。

作用：
- 校验创建参数
- 调用真实 OCI 创建实例
- 写日志

---

## 容量与创建辅助

### `src/app/api/capacity/route.ts`
额度/资源接口。

作用：
- region subscriptions
- availability domains
- services
- limit values

### `src/app/api/create-options/route.ts`
创建页选项接口。

作用：
- AD
- shapes
- images
- VCN
- subnets

---

## 日志

### `src/app/api/logs/route.ts`
当前用户日志列表接口。

---

# 7. 页面索引

## 平台页

### `src/app/login/page.tsx`
登录页。

当前说明：
- 邮箱密码登录可用
- Google 登录按钮按配置显示/隐藏

### `src/app/register/page.tsx`
注册页。

### `src/app/settings/page.tsx`
设置页，目前作用较弱，后续可扩展。

---

## OCI 主功能页

### `src/app/page.tsx`
首页 / Dashboard。

当前作用：
- 当前账户总览
- 最近活动
- 基础统计

后续建议：
- 继续做 P2E 产品化

### `src/app/accounts/page.tsx`
账户管理页。

作用：
- 查看账户
- 新增账户
- 后续可补编辑/删除

### `src/app/instances/page.tsx`
实例列表页。

作用：
- 资产化列表
- 筛选
- 快速操作
- 打开详情抽屉

### `src/app/instances/[instanceId]/page.tsx`
实例独立详情页。

作用：
- 单实例资产详情页
- 创建后状态跟踪
- 直接执行动作

### `src/app/create/page.tsx`
创建页。

作用：
- 创建实例主工作区
- P2A 当前最完整的页面之一

### `src/app/capacity/page.tsx`
额度与资源页。

作用：
- Capacity 总览
- Compute 聚焦
- limit values 可读展示

### `src/app/logs/page.tsx`
日志页。

作用：
- 当前用户操作日志检索与筛选

---

# 8. 组件索引

## 账户组件

### `src/components/accounts/account-selector.tsx`
通用账户切换器。

### `src/components/accounts/accounts-table.tsx`
账户表格。

### `src/components/accounts/add-account-form.tsx`
添加账户表单。

---

## Dashboard 组件

### `src/components/dashboard/stat-card.tsx`
首页统计卡片。

### `src/components/dashboard/recent-activity.tsx`
最近活动展示。

### `src/components/dashboard/quick-actions.tsx`
快捷操作组件，目前可继续强化或接入首页。

---

## 实例组件

### `src/components/instances/instances-table.tsx`
实例资产列表核心组件。

### `src/components/instances/instance-details-drawer.tsx`
实例详情抽屉容器。

### `src/components/instances/instance-detail-content.tsx`
实例详情主体内容。

这是当前资产化最重要组件之一。

---

## 布局组件

### `src/components/layout/app-shell.tsx`
全局应用布局壳。

### `src/components/layout/header.tsx`
顶部导航。

### `src/components/layout/sidebar.tsx`
侧边栏导航。

---

## 日志组件

### `src/components/logs/logs-table.tsx`
日志表格。

---

# 9. lib 工具与核心逻辑索引

### `src/lib/prisma.ts`
Prisma Client 初始化。

### `src/lib/auth.ts`
NextAuth 配置与 `requireAuthUser()`。

说明：
- 当前使用 `jwt` session strategy
- 当前支持 credentials
- Google provider 只有在环境变量存在时启用

### `src/lib/crypto.ts`
敏感字段加密/解密。

### `src/lib/accounts-store.ts`
OCI 账户数据库读写封装。

### `src/lib/logs-store.ts`
日志数据库读写封装。

### `src/lib/oci.ts`
OCI SDK 客户端构造与相关逻辑。

### `src/lib/mock-data.ts`
历史 mock 残留文件，现阶段已非主线，应谨慎使用，避免误回滚到 mock 逻辑。

### `src/lib/utils.ts`
通用工具函数。

---

# 10. 类型定义索引

### `src/types/dashboard.ts`
Dashboard / 实例 / 日志 / 详情相关主类型文件。

### `src/types/accounts.ts`
账户相关类型。

### `src/types/next-auth.d.ts`
NextAuth 类型扩展。

---

# 11. 脚本与运维索引

### `scripts/start-oci-panel.sh`
launchd 启动脚本。

### `scripts/org.openclaw.oci-panel.plist`
launchd 配置模板。

### `scripts/migrate-legacy-json-to-prisma.mjs`
显式一次性迁移脚本。

作用：
- 把旧 JSON 数据迁移到 Prisma
- 可指定用户
- 可选归档旧文件

---

# 12. 当前不要回退的关键决策

## 认证
- 本地邮箱密码登录保留
- 当前使用 `jwt` session strategy
- 未配置 Google 时不要强挂 Google provider
- 未启用 Google 时前端不要误显示 Google 登录按钮

## 数据存储
- 账户不要再回退到 JSON 运行时读写
- 日志不要再回退到 JSON 运行时读写
- 旧 JSON 只用于显式迁移

## 产品方向
- 不要把项目做回“实例开关机小工具”
- 核心目标始终是 OCI 多账户资产控制平台
- 创建、容量、资产详情都属于主线，不是附属页

## 技术路线
- Prisma + SQLite（当前阶段）
- next-auth
- 敏感字段服务端加密
- 以后如有需要再切 PostgreSQL

---

# 13. 当前遗留 / 风险提醒

## 需要持续注意

### README 仍需跟随主线变化持续更新
虽然已同步一版，但后续大改后仍容易过时。

### `src/lib/mock-data.ts`
是历史文件，当前主线不要误接回 mock。

### 登录体系暂缓深挖
当前保留基础框架即可，不作为近期主线。

### 账户编辑/删除未补齐
当前账户管理闭环还不完整，后续仍值得做。

---

# 14. 下一步建议（更新时同步修改）

## 当前建议顺序

1. P2E：Dashboard 总览页产品化
2. P2F：全站体验统一收口
3. 之后再考虑：
   - 账户管理闭环（编辑/删除）
   - 更深的 OCI 资产扩展
   - 模板持久化
   - 更精细的 quota / shape 预检查

---

# 15. 使用建议

## 开发前建议
先读：
- 本文件 `PROJECT_INDEX.md`
- 当前要改页面对应的 API / component / lib 文件

## 每次大改后建议
同步更新：
- 本文件对应模块的“当前状态”
- 关键决策与风险提醒
- 下一步建议

## 目标
让项目在任何新上下文下都能快速恢复：
- 知道项目定位
- 知道哪些文件是主线
- 知道哪些决策不能回滚
- 知道当前做到哪里

---

# 16. 一句话总括

> 这个项目当前已经从“本地 OCI 实例面板”转向“平台化的 OCI 多账户资产控制台”，开发时所有页面、API 和重构都应围绕这个主定位展开。
