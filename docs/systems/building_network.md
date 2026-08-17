# Building Network System

## 1. 系统目的

Mahou 的建筑系统以六十四卦建筑为核心。

玩家通过探索世界、挑战 Boss 等方式获得建筑，并将建筑带入个人维度进行布置。建筑之间可以通过有向连线组成网络。

网络并不直接给予简单的固定 Buff，而是通过：

```text
建筑基础数值
+
节点点数规则（Network Rule）
+
路由规则（Routing Rule）
+
有向图结构
```

共同计算出玩家最终获得的数值收益。

整体流程为：

```text
世界中的 Boss / Structure
        ↓
获得 Building
        ↓
在个人维度中放置
        ↓
使用有向线连接
        ↓
形成 Building Network
        ↓
进行网络计算
        ↓
得到属性点 + 能力点
        ↓
统一非线性换算
        ↓
得到玩家实际属性
```

建筑系统主要负责连续型数值成长。

装备、武器及其他系统则可以更多承担全或无、改变玩法方式的离散机制。

---

# 2. 核心设计原则

## 2.1 建筑不是普通饰品

六十四个建筑不应简单设计为：

```text
建筑 A：攻击 +20%
建筑 B：防御 +15%
建筑 C：火伤 +30%
```

建筑的价值应该由两部分共同构成：

```text
基础数值贡献
+
网络中的计算行为
```

因此玩家需要考虑：

```text
选择哪些建筑
+
怎样连接建筑
```

而不是只寻找数值最大的建筑。

---

## 2.2 连线采用有向边

建筑之间的连接采用：

```text
A → B
```

而不是：

```text
A — B
```

因此网络本质上是一个有向图。

这允许网络自然产生：

```text
路径
分叉
汇聚
循环
回流
输入
输出
入度
出度
路径长度
```

等性质。

第一阶段主要使用图论层面的性质。

未来可以进一步研究：

```text
线段长度
线段方向
角度
交叉
建筑空间位置
几何图案
```

等真正的“画线性质”。

但这些不是第一版必须实现的内容。

---

# 3. 八卦与基础魔法属性

当前暂定八卦对应八种魔法属性：

```text
乾 → 光
坤 → 暗
坎 → 水
离 → 火
震 → 雷
巽 → 风
艮 → 岩
兑 → 音 / 共鸣
```

六十四卦由：

```text
上卦
+
下卦
```

组成，因此每种建筑天然具有两个八卦来源。

上下卦可以影响：

```text
建筑基础属性点
网络规则作用对象
网络规则表现形式
介绍文本
```

但暂时不规定所有建筑必须机械地按照：

```text
上卦 = 输出
下卦 = 输入
```

进行设计。

这一关系可以作为设计语言和倾向使用，而不是绝对规则。

---

# 4. 数值系统

## 4.1 两类并列的点数

建筑系统产生的数值主要分成两类：

```text
属性点
+
能力点
```

二者在系统层级上是并列关系。

---

## 4.2 属性点

“属性点”专指八种魔法属性：

```text
光
暗
水
火
雷
风
岩
音 / 共鸣
```

这些属于战斗和魔法体系中的一个细分数值系统。

例如：

```text
火属性点 +5
雷属性点 +3
```

最终可以影响对应属性魔法的实际表现。

无属性魔法可以独立存在，并不需要增加“第九属性”。

无属性魔法主要读取：

```text
通用法术能力
其他能力点
装备机制
```

而不必依赖八种属性中的某一种。

---

# 5. 能力点

能力点用于描述其他连续型玩家能力。

例如：

## 战斗

```text
攻击
防御
生命
生命恢复
攻击速度
暴击
暴击伤害
击退
韧性
```

## 魔法通用

```text
法术强度
施法速度
法力上限
法力恢复
冷却效率
法术范围
持续时间
投射物速度
```

## 移动

```text
移动速度
跳跃能力
冲刺效率
空中机动
坠落抗性
```

## 装备与工具

```text
近战武器效率
远程武器效率
护甲效率
工具效率
耐久效率
挖掘效率
```

## 生存与生产

```text
饱食效率
药水效率
采集效率
种植效率
冶炼效率
制造效率
```

## 探索

```text
结构探测
地图揭示
宝藏发现
传送效率
```

## 其他

未来还可以根据实际玩法增加新的能力点。

第一版不需要一次确定全部能力点。

原则上应首先控制在有限的核心属性范围内，随实际玩法需求逐渐扩展。

---

# 6. 统一数值原则

Mahou 应尽量把所有可以连续量化的增益纳入统一点数体系。

例如：

```text
建筑
装备
药水
任务奖励
附魔
其他 Mahou 系统
```

如果提供的是连续型数值增益，应尽量转化为：

```text
属性点
或
能力点
```

而不是直接修改最终属性。

整体原则：

```text
所有来源
   ↓
Point Contribution
   ↓
统一汇总
   ↓
Soft-cap Function
   ↓
Final Stat
```

---

# 7. 软上限

点数与实际属性值不采用简单线性关系。

即不应设计为：

```text
1 点 = 固定 +X%
```

而应采用具有边际收益递减的非线性函数。

一种候选形式为：

\\[
V(P)=V_{\max}\frac{P}{K+P}
\\]

其中：

```text
P      = 总点数
V(P)   = 最终属性增益
Vmax   = 理论极限
K      = 达到约一半理论极限时需要的点数
```

例如：

```text
20 点
→ 仍然具有很高收益

40 点
→ 有明显收益

80 点
→ 可以继续提升，但边际收益下降

160 点
→ 仍然有效，但投入效率较低
```

因此不存在简单硬上限：

```text
超过 100 点无效
```

玩家仍然可以极端堆叠单一能力，但成本越来越高。

---

# 8. 软上限必须在所有来源汇总后计算

禁止按照：

```text
建筑 20 点 → 算一次
装备 20 点 → 算一次
药水 20 点 → 算一次
最后相加
```

这种方式计算。

正确流程应为：

```text
建筑 20
+
装备 20
+
药水 20
=
总点数 60
        ↓
统一经过一次软上限曲线
```

否则玩家可以通过多个系统分别获得加成，从而绕过软上限。

---

# 9. 避免独立乘区

除了点数绕过以外，还需要控制最终数值乘区。

例如应谨慎出现：

```text
攻击 ×1.3
物理伤害 ×1.2
近战伤害 ×1.4
最终伤害 ×1.2
Boss伤害 ×1.3
```

多个看似合理的倍率相乘后很容易制造数值爆炸。

因此：

> 新增独立最终乘区必须经过明确设计和审查。

原则上 Mahou 新增的连续数值都应优先进入统一点数系统。

---

# 10. 第三方 Mod 的处理

Mahou 是整合包，因此无法要求所有第三方 Mod 从一开始就遵守 Mahou 点数体系。

当前策略：

```text
Mahou 自己新增的数值
→ 严格遵守统一点数系统

第三方 Mod
→ 初期允许保持自身系统
→ 后期统一进行平衡筛查
```

重点关注：

```text
巨额直接属性加成
独立最终乘区
异常高攻速
异常高暴击
异常冷却缩减
无限资源
无消耗
无冷却
绕过 Mahou 核心限制的能力
```

处理方式由轻到重可以包括：

```text
调整配置
修改配方
推迟获取阶段
限制使用条件
削弱具体效果
禁用物品
禁用配方
必要时 Ban 对应内容
```

判断标准不是：

```text
“这个东西强不强”
```

而主要是：

```text
“它是否绕过 Mahou 数值成长体系的主要限制”
```

---

# 11. 连续数值与离散机制的分工

建筑网络主要负责：

```text
连续型数值
```

例如：

```text
攻击
防御
移速
火属性
雷属性
工具效率
施法速度
```

这些都可以表示成“点数”。

而：

```text
二段跳
投射物分裂
连锁采矿
特殊反击
特殊攻击方式
水上行走
某种特殊传送能力
```

这些属于：

```text
有 / 无
true / false
```

性质的机制，不适合软上限。

这类效果原则上更多留给：

```text
装备
武器
特殊物品
其他机制系统
```

因此：

```text
所有系统的连续数值
→ 统一点数体系

离散机制
→ 装备等玩法系统
```

---

# 12. 建筑定义与建筑实例

必须明确区分：

```text
Building Definition
```

和：

```text
Building Instance
```

---

## 12.1 Building Definition

描述：

> 某一种建筑是什么。

例如“益卦建筑”的定义全世界只有一份。

它包括：

```text
建筑 ID
卦序
卦名
上下卦
属性
来源结构
Boss
基础点数
Network Rule / Network Params
Routing Rule / Routing Params
介绍文本
功能说明
```

64 个建筑原则上都是：

```text
64 份数据
```

而不是：

```text
64 套独立程序
```

---

## 12.2 Building Instance

描述：

> 世界里某一栋实际存在的建筑。

例如：

```text
instanceId
buildingType
dimension
position
rotation
owner
active
```

同一种 Building Definition 可以拥有多个 Building Instance。

---

# 13. Building Definition 不能保存世界状态

例如：

```text
益卦建筑
```

定义中不能保存：

```text
它当前位于哪里
它和谁相连
玩家有没有放置它
```

这些属于：

```text
Building Instance
+
Network Graph
```

---

# 14. 有向边

每条连接单独保存。

例如：

```text
A → B
```

可以表示为：

```text
from = A
to   = B
```

Edge 不应存储在 Building Definition 中。

因此：

```text
建筑是什么
```

和：

```text
建筑现在和谁连接
```

完全分离。

---

# 15. 网络结构

一个 Building Network 可以抽象成：

```text
Nodes
+
Directed Edges
```

其中：

```text
Node = Building Instance
Edge = Directed Connection
```

例如：

```text
A → B → C
    ↓
    D
```

对应：

```text
Nodes:
A
B
C
D

Edges:
A → B
B → C
B → D
```

---

# 16. 网络可以读取的结构性质

第一阶段可以支持：

```text
入度
出度
路径长度
是否分叉
是否汇聚
是否存在闭环
距离起点多少节点
距离终点多少节点
```

未来可以扩展：

```text
实际连线长度
角度
交叉
空间方向
相对位置
形成的几何图案
```

但暂不作为第一版必需内容。

---

# 17. 点数规则、路由规则与图拓扑

建筑网络中的计算行为分成三个不同层次：

```text
Graph Topology
+
Network Rule
+
Routing Rule
```

三者不应混为同一种机制。

---

## 17.1 Network Rule

Network Rule 负责：

> 一个建筑节点收到点数以后，点数本身如何变化。

当前已经实现的基础规则包括：

```text
PASS
AMPLIFY
CONVERT
```

例如：

```text
火 8
↓
AMPLIFY ×1.25
↓
火 10
```

或者：

```text
火 10
↓
CONVERT
↓
火 5
风 5
```

未来可以继续增加：

```text
ADD
DECAY
FILTER
LIMIT
BALANCE
TRANSFER
STORE
RELEASE
EXCHANGE
```

等通用点数处理规则。

建筑定义通过：

```text
networkRule
+
networkParams
```

引用这些规则。

原则上不应为每一个六十四卦单独编写一整套算法。

---

## 17.2 Routing Rule

Routing Rule 负责：

> 一个节点完成 Network Rule 计算以后，输出点数如何沿出边发送。

当前已经实现：

```text
equal
weighted
broadcast
```

### equal

默认规则。

如果一个节点存在两条出边：

```text
      → B
A →
      → C
```

A 输出：

```text
火 10
```

则：

```text
B 收到火 5
C 收到火 5
```

总流量守恒。

### weighted

根据 Directed Edge 上的 `weight` 分配。

例如：

```text
A → B weight=3
A → C weight=1
```

若 A 输出火 10：

```text
B 收到 7.5
C 收到 2.5
```

权重只决定分配比例，总流量仍然守恒。

`weight` 必须是有限数字。

未填写 `weight` 时默认视为 1。

负权重按 0 处理。

### broadcast

每一条出边都获得完整输出。

例如：

```text
A 输出火 10
```

两个后继都会收到：

```text
B = 火 10
C = 火 10
```

因此 broadcast 会增加网络中的总流量。

它属于明确的特殊能力，不能作为默认分叉逻辑。

建筑定义通过：

```text
routingRule
+
routingParams
```

引用路由规则。

---

## 17.3 Graph Topology

普通的：

```text
分叉
汇聚
```

首先属于有向图结构，而不是特殊 Network Rule。

例如：

```text
      B
     ↗
A
     ↘
      C
```

表示 A 的出度为 2。

而：

```text
A →
     → C
B →
```

表示 C 的入度为 2。

默认情况下：

```text
分叉
→ 由 Routing Rule 决定输出如何分配

汇聚
→ 多条输入流直接求和
```

因此普通 `SPLIT` 和 `MERGE` 不需要作为节点点数规则重复实现。

只有当某个六十四卦需要：

```text
特殊分流
复制
偏置流量
汇聚增益
汇聚损耗
```

时，才通过 Network Rule、Routing Rule 或二者组合表达。

---

# 18. 规则作用对象

Network Rule 可以作用于：

```text
全部属性点
某个八卦属性
上卦属性
下卦属性
某个能力点
输入最高的点数
输入最低的点数
```

Routing Rule 主要作用于：

```text
全部出边
某条出边
出边权重
输出流量比例
```

具体行为由建筑定义中的参数决定。

---

# 19. 规则触发条件与图上下文

Network Rule 和 Routing Rule 都可以读取当前节点的图结构信息。

当前 Calculator 已可以提供：

```text
indegree
outdegree
isStart
isTerminal
depth
pathLength
predecessors
successors
networkSize
```

因此未来规则可以设计为：

```text
始终触发
有输入时
作为网络起点时
作为网络终点时
入度 ≥ N
出度 ≥ N
发生分叉时
发生汇聚时
路径长度 ≥ N
某类点数 ≥ N
```

闭环相关条件需要等 Cycle 计算语义正式确定后再加入。

规则库应该随实际六十四卦设计逐步扩展，而不是提前一次实现全部可能性。

---

# 20. 建筑介绍文本

每个建筑原则上都应具有一条介绍文本。

介绍文本采用：

```text
加引号
略偏文言
体现卦象意象
体现上下卦
暗示设计机制
```

的方式书写。

例如：

> “上巽下震，风行雷动，损上益下，其势愈行愈盛。”

介绍文本主要回答：

> 为什么这个卦被设计成这样的效果？

而不是直接描述具体数值。

---

# 21. 功能说明

介绍文本之外，还必须提供白话功能说明。

例如：

```text
介绍文本：
“上巽下震，风行雷动，损上益下，其势愈行愈盛。”

功能说明：
雷属性点沿有向路径传播时逐渐增强。
```

二者分别承担：

```text
设计依据 / 世界观
```

和：

```text
实际玩法说明
```

---

# 22. 每种建筑需要记录的主要内容

## 身份信息

```text
building_id
卦序
卦名
建筑名称
上卦
下卦
上卦属性
下卦属性
来源 Mod
原 Structure
Boss
获取方式
```

## 数值贡献

```text
属性点
能力点
```

两者可以：

```text
只提供属性点
只提供能力点
两者同时提供
少量提供数值、主要依赖网络规则
```

## 网络信息

```text
节点角色

Network Rule
Network Params

Routing Rule
Routing Params

作用对象
触发条件
方向要求
拓扑要求

传播 / 转换逻辑
```

## 设计信息

```text
数值型 / 网络型 / 混合型
主要游戏领域
强度等级
复杂度
```

## 文本信息

```text
效果标签
介绍文本
功能说明
背景 / 建筑说明（可选）
```

---

# 23. 建筑节点角色

为了方便设计和理解，可以为建筑增加 Network Role 标签。

例如：

```text
Source
Relay
Amplifier
Converter
Splitter
Merger
Filter
Gate
Limiter
Feedback
Storage
Terminal
Hybrid
```

该字段主要用于：

```text
设计分类
UI展示
平衡检查
```

不应该取代真正的 Network Rule。

---

# 24. 设计领域

为了避免 64 个建筑全部变成战斗 Buff，可以为每个建筑记录主要玩法领域。

例如：

```text
魔法
近战
防御
移动
工具
生产
探索
地图
物流
建设
通用
```

最终应检查 64 个建筑的领域分布。

---

# 25. 建筑收起与重新放置

未来计划支持：

```text
一键收起建筑
一键放置建筑
```

因此代码设计必须预留这一能力。

原则上：

```text
世界中的方块
```

只是 Building Instance 的表现形式，不应该成为建筑核心数据的唯一来源。

---

# 26. 收起建筑

未来大致流程：

```text
玩家执行收起
        ↓
找到 Building Instance
        ↓
保存必要状态
        ↓
处理对应 Directed Edges
        ↓
移除世界结构
        ↓
生成建筑核心 / 建筑物品
```

---

# 27. 放置建筑

未来大致流程：

```text
建筑核心
        ↓
选择放置位置
        ↓
Structure Placement
        ↓
生成对应建筑
        ↓
创建 / 恢复 Building Instance
```

---

# 28. 不优先储存完整建筑方块

如果建筑可以通过固定 Structure Template 重新生成，应优先保存：

```text
buildingType
position
rotation
必要的自定义状态
```

而不是扫描并储存整个大型建筑的全部方块 NBT。

只有真正需要保留的个性化内容，再额外保存。

具体实现方式需要根据各第三方 Mod 的 Structure 实际情况决定。

---

# 29. 核心代码职责

建筑网络系统逻辑上至少包含以下几个职责。

## Building Definitions

负责：

```text
64 种建筑是什么
```

---

## Building Instances

负责：

```text
世界里实际有哪些建筑
```

---

## Network Graph

负责：

```text
建筑之间如何连接
```

Directed Edge 当前可以记录：

```text
from
to
weight（可选）
```

其中 `weight` 只是边参数，只有对应 Routing Rule 读取它时才产生意义。

---

## Network Rules

负责：

```text
节点收到点数以后，
点数本身如何变化
```

当前已经实现：

```text
pass
amplify
convert
```

---

## Network Routing Rules

负责：

```text
节点完成点数计算以后，
输出点数如何沿出边传播
```

当前已经实现：

```text
equal
weighted
broadcast
```

Routing Rule 与 Graph Topology 分离。

---

## Network Calculator

负责：

```text
组织一次完整网络计算
```

包括：

```text
建立图
拓扑排序
汇总输入
调用 Network Rule
调用 Routing Rule
沿边传播
汇总终端输出
```

---

## Stat Resolver

负责：

```text
最终点数如何通过软上限转化为实际属性
```

---

# 30. 第一阶段建议代码结构

第一版暂时不提前拆过多目录。

当前核心结构为：

```text
kubejs/startup_scripts/building_network/
├─ building_definitions.js
├─ network_rules.js
├─ network_routing_rules.js
├─ network_calculator.js
└─ stat_resolver.js
```

测试脚本放在：

```text
kubejs/server_scripts/
├─ building_network_test.js
├─ building_network_graph_test.js
└─ building_network_routing_test.js
```

后续真正需要时再增加：

```text
building_instances.js
building_placement.js
network_storage.js
```

而不是现在提前创建大量：

```text
core/
models/
services/
repositories/
serializers/
```

等抽象层。

项目结构应该随真实复杂度增长。

---

# 31. Building Definitions

`building_definitions.js` 原则上应尽量保持数据化。

例如：

```js
yi: {
    id: "yi",
    hexagramNumber: 42,
    hexagramName: "益",

    upperTrigram: "xun",
    lowerTrigram: "zhen",

    upperElement: "wind",
    lowerElement: "thunder",

    attributePoints: {
        wind: 3,
        thunder: 3
    },

    abilityPoints: {
        attackSpeed: 2
    },

    networkRule: "amplify",

    networkParams: {
        targetType: "attribute",
        target: "thunder",
        multiplier: 1.20
    },

    routingRule: "equal",
    routingParams: {},

    effectTag: "传播增益",

    introText:
        "上巽下震，风行雷动，损上益下，其势愈行愈盛。",

    description:
        "示例建筑。具体机制仍需在正式卦象设计阶段确定。"
}
```

具体字段仍然可以在第一批正式建筑原型设计过程中调整。

---

# 32. Network Rules

`network_rules.js` 负责通用的节点内点数算法。

当前包括：

```text
pass
amplify
convert
```

未来可以根据正式卦象逐步增加：

```text
add
decay
filter
limit
balance
transfer
store
release
exchange
```

Network Rule 不应该知道：

```text
这是益卦
这是第 42 个建筑
这是某个 Boss
```

它只处理：

```text
input
params
network context
```

普通分叉和普通汇聚属于图拓扑，不需要再次实现成 `split` / `merge` 点数规则。

---

# 33. Network Routing Rules

`network_routing_rules.js` 负责节点输出的传播方式。

当前包括：

```text
equal
weighted
broadcast
```

其中：

```text
equal
= 所有出边守恒均分

weighted
= 按 edge.weight 归一化分配，总量守恒

broadcast
= 每条出边获得完整输出，显式允许增加总流量
```

`weight` 的约定为：

```text
未填写
→ 默认 1

负数
→ 按 0 处理

NaN / Infinity / 非数字
→ 属于非法边数据，Calculator 应拒绝
```

Routing Rule 不负责决定“谁和谁连接”，只负责决定已有出边如何获得流量。

---

# 34. Network Calculator

`network_calculator.js` 负责组织计算流程。

当前大致流程：

```text
读取 Building Instance + Directed Edge
↓
建立有向图
↓
检查连通性与非法边
↓
拓扑排序
↓
汇总每个节点的所有上游输入
↓
加入 Building Definition 的基础点数
↓
执行 Network Rule
↓
执行 Routing Rule
↓
沿 Directed Edge 传播
↓
汇聚节点自动求和
↓
汇总所有终端节点输出
↓
得到最终 Point Result
```

当前 Calculator 支持 DAG，但拒绝 Cycle。

Network Calculator 不应包含：

```text
if 建筑 == 益
if 建筑 == 损
if 建筑 == 复
...
```

具体建筑差异应由：

```text
Building Definition
+
Network Rule
+
Routing Rule
```

共同决定。

---

# 35. Stat Resolver

`stat_resolver.js` 只负责：

```text
Point Result
↓
Final Stats
```

例如 Network Calculator 输出：

```js
{
    attributes: {
        fire: 32,
        wind: 18,
        thunder: 44
    },

    abilities: {
        attack: 27,
        defense: 11,
        movementSpeed: 8
    }
}
```

Stat Resolver 再决定：

```text
32 火属性点具体意味着多少火属性增益
27 攻击点具体意味着多少攻击增益
8 移速点具体意味着多少移动速度
```

这样未来修改软上限时，不需要修改 64 个建筑。

---

# 36. 三条代码接口原则

即使第一版实现非常简单，也应尽量保证以下三条原则。

## 原则一

Network Calculator 使用：

```text
Building Instance
+
Directed Edge
```

作为主要输入。

不要直接扫描世界方块来决定网络逻辑。

---

## 原则二

Building Instance 只保存：

```text
buildingType
```

等实例状态。

建筑的固定属性应通过：

```text
buildingType
↓
Building Definitions
```

查找。

不要把建筑定义复制一份到每个实例中。

---

## 原则三

Network Calculator 输出：

```text
Point Result
```

而不是直接修改最终玩家属性。

最终数值统一由：

```text
Stat Resolver
```

处理。

---

# 37. 第一版原型目标

当前底层原型已经验证：

```text
线性网络
分叉
汇聚
多起点
多终点
DAG
equal routing
weighted routing
broadcast routing
Network Rule + Routing Rule 组合
Stat Resolver
```

因此下一阶段不需要继续无限扩充虚拟规则。

更有价值的目标是：

```text
选择少量正式六十四卦建筑
↓
用当前框架实际实现
↓
检查现有抽象是否足够
↓
只有在真实设计需要时再扩展底层规则
```

---

# 38. 总结

建筑系统可以概括为：

```text
Building Definition
= 建筑是什么

Building Instance
= 建筑现在在哪里

Directed Edge
= 建筑怎么连接，以及可选的边参数

Network Rule
= 节点内的点数如何变化

Routing Rule
= 节点输出如何沿出边传播

Network Calculator
= 组织完整网络计算

Stat Resolver
= 点数如何变成最终数值
```

整个系统的核心原则是：

> 建筑提供数值并参与网络计算，有向连线决定图结构，Network Rule 决定点数本身如何变化，Routing Rule 决定输出如何传播；所有连续型收益最终汇入统一点数系统，并在所有来源汇总以后通过软上限转换为最终属性。

世界中的建筑方块只是系统的表现形式。

核心逻辑应建立在：

```text
Building Definition
Building Instance
Directed Graph
Network Rule
Routing Rule
```

之上，从而为未来的：

```text
建筑收起
建筑放置
网络保存
地图显示
网络编辑
多人使用
```

保留足够的扩展空间。
