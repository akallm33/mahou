可以，下面我把 Step 4 从现在开始到建筑系统完整落地 的顺序整理成一份可以长期保存的版本。后面如果做到一半需要回顾，我们就以这份路线为准，除非实际测试暴露出必须调整的架构问题。

ModFusion Step 4：建筑 / Boss / 区域生成完整路线

目前的大原则已经确定：

世界生成负责“地形与群系”，Building Distributor 负责“建筑应该分配到哪里”，Candidate Analyzer 负责“这个位置能不能放”，Placement System 负责“真正生成与记录”。

普通建筑和专属 Boss 建筑从架构上分开。

COMMON
普通群系中的多种建筑
→ 强调均匀分配


DEDICATED
特定群系对应特定 Boss 建筑
→ 强调专属区域与进度

Step 4-A — Building Registry / 建筑注册表 ✅ 已完成

文件：

kubejs/server_scripts/floating_islands/
modfusion_building_registry.js

负责定义每栋建筑的静态信息：

structureId
allowedBiomes
regionPolicy
biomeSampleRadius
terrainSampleRadius
minBiomeCoverage
minTerrainCoverage
maxHeightDifference
minStructureSpacing
unique
enabled

当前核心分类：

COMMON
├─ Naga Courtyard
└─ Lich Tower

以后还会加入：

Hedge Maze
Hollow Hills
Mushroom Tower
Quest Grove
普通遗迹
其他 Mod 普通建筑

专属：

DEDICATED
├─ Swamp        → Labyrinth
├─ Fire Swamp   → Hydra Lair
├─ Dark Forest  → Knight Stronghold
├─ Snowy Forest → Yeti Cave
├─ Glacier      → Aurora Palace
└─ Highlands    → Troll Cave

后期再加入：

Dark Forest Center → Dark Tower
Final Plateau      → Final Castle

Registry 只负责描述建筑，不决定建筑在哪里生成。

Step 4-B1 — Building Candidate Analyzer / 候选位置分析器 🟡 已完成原型，待最终校准

文件：

modfusion_building_analyzer.js

当前已经验证可以正确读取：

中心位置
↓
岛屿表面
↓
中心群系
↓
Registry 中允许的建筑
↓
Biome Coverage
↓
Terrain Coverage
↓
Surface Y Range
↓
PASS / FAIL

已经通过实际测试得到两个重要结论：

Mushroom Forest
Biome Coverage ≈ 96%

表示普通暮色群系生态区域连续性很好。

Glacier：

Biome Coverage ≈ 20%

表明自然 Glacier 目前通常只是较小区域，不适合直接承担 Aurora Palace Boss Region。

现在需要完成 Analyzer 校准：

biomeSampleRadius
≠
terrainSampleRadius

以后：

Biome Radius
→ 检查生态区域够不够大


Terrain Radius
→ 检查建筑实际占地区域有没有岛体

同时调整表面寻找：

优先向下扫描
少量向上扫描

防止双层浮岛误判。

完成标准：

普通大型岛：
Biome PASS
Terrain PASS


普通小岛：
Terrain FAIL


小型 Glacier：
Center Biome PASS
Terrain 可能 PASS
Biome Coverage FAIL


大型 Boss Glacier：
未来应该全部 PASS

最重要的是：

Analyzer 只负责判断，不为了让候选通过而降低标准。

Step 4-B2 — Building Distributor / 建筑均衡分配器 ← 下一步重点

新文件预计：

modfusion_building_distributor.js

这是整个 COMMON 建筑系统的核心。

世界 X/Z 平面划分成：

Structure Region

例如初版可以从：

768 × 768

左右开始测试。

每个 Region 不是自己随机抽建筑，而是由 Distributor 决定：

Region (-1,0)
→ Naga


Region (0,0)
→ Lich


Region (1,0)
→ Hollow Hill

我们不采用：

每个 Region
Math.random()

因为会出现建筑聚集。

而采用：

Distribution Slot
+
Seed-based Shuffle

例如未来一个分配周期：

Naga
Lich
Hedge Maze
Small Hollow Hill
Medium Hollow Hill
Large Hollow Hill

每一个周期严格有一次，但顺序根据：

World Seed
+
Super Region 坐标

确定性打乱。

最终达到：

随机的是建筑位置
而不是建筑数量比例

如果以后需要权重：

Hollow Hill ×3
Hedge Maze  ×2
Naga        ×1
Lich        ×1

就把 Slot 写成：

Hollow
Hollow
Hollow
Hedge
Hedge
Naga
Lich

再洗牌。

这样有限探索范围内也能接近预定比例。

这一阶段仍然不生成建筑。

输入：

Region X/Z

输出：

这个 Region 被分配什么建筑

Step 4-B3 — Candidate Search / Region 内寻找真正落点

Distributor 只告诉我们：

Region (3,-2)
Assigned:
twilight_naga_courtyard

接下来不能直接把建筑放在 Region 中心。

需要：

在 Region 内寻找候选点
     ↓
判断有没有浮岛
     ↓
判断是不是允许的群系
     ↓
Candidate Analyzer
     ↓
PASS

例如：

Region
┌────────────────────┐
│      小岛          │
│                    │
│             大岛   │
│             ★      │
│                    │
└────────────────────┘

★ 才是最终候选。

候选搜索应该是确定性的，不能每次重启服务器换地方。

所以候选顺序也由：

World Seed
Region coordinate
Building ID

决定。

如果第一个候选失败：

Candidate #1 FAIL
↓
Candidate #2
↓
Candidate #3

达到上限仍找不到：

Region = NO_VALID_SITE

而不是强行生成。

Step 4-B4 — Placement Record / 建筑生成记录

到这个阶段才开始使用：

level.persistentData

建立：

ModfusionBuildingRecords

记录：

Region
Building ID
X/Y/Z
Generated
Structure ID
Timestamp/Version（可选）

概念上：

region_3_-2:
{
    building:
        twilight_naga_courtyard


    x: 2100
    y: 66
    z: -1400


    generated:
        true
}

这样服务器重启后：

Region 已经处理
→ 不再重新抽取
→ 不重复生成

这一阶段同时解决 Analyzer 目前还没做的：

Spacing
Unique

Step 4-B5 — Spacing Check / 建筑距离检查

即使 Region 已经控制密度，也仍然需要建筑间距离检查。

例如：

Naga:
minStructureSpacing = 768


Aurora:
minStructureSpacing = 1536

候选位置生成前检查已有记录：

Candidate
    ↓
查附近建筑记录
    ↓
距离足够？
    ↓
PASS / FAIL

注意这里至少有两种距离：

sameTypeSpacing

同类建筑距离。

和以后可能增加的：

globalMajorStructureSpacing

不同大型建筑之间也不能太近。

Region 系统负责：

大方向均匀。

Spacing 负责：

最终防止边界情况下两个建筑过近。

Step 4-C1 — COMMON 建筑第一次真实生成

直到这里才开始：

/place structure

建议第一个测试仍然：

Naga Courtyard

或：

Lich Tower

流程：

Distributor
    ↓
Assigned Naga
    ↓
Candidate Search
    ↓
Analyzer PASS
    ↓
Spacing PASS
    ↓
/place structure twilightforest:naga_courtyard ...
    ↓
命令成功
    ↓
写 Placement Record

这里继续遵循出生建筑已经验证过的原则：

只有真实 place 成功以后才能写 generated=true。

不能：

先标记
→ place 失败
→ 世界永远认为已经生成

Step 4-C2 — COMMON 建筑池扩充

第一个 COMMON 建筑跑通后，再逐个加入：

Naga Courtyard
Lich Tower
Hedge Maze
Hollow Hills
Mushroom Tower
Quest Grove
...

每加入一种建筑：

① Registry
② Allowed Biomes
③ Distribution Slots
④ Candidate 参数
⑤ 实际测试

不一次性把所有暮色结构都注册进去。

这一步完成后，我们应该得到：

普通区域
↓
多种建筑
↓
接近目标比例均匀分布
↓
不扎堆
↓
不重复

Step 4-D1 — Biome Rarity / 普通与稀有生态概率调整

等 COMMON 系统稳定以后，再回来优化群系分布。

这一层只负责：

Forest 常见
Dense Forest 常见
Clearing 常见/中等
Enchanted Forest 稀有
Glacier 稀有
...

不负责建筑数量。

也就是彻底坚持：

Biome Frequency
≠
Structure Frequency

普通群系需要保证：

足够的总体面积

但 COMMON 建筑的数量比例由 Distributor 决定。

Step 4-D2 — Boss Region System / 专属 Boss 区域

这是 DEDICATED 建筑真正进入系统的时候。

例如：

Aurora Palace

不应该依赖偶然出现的一个小 Glacier。

而是：

Boss Region Selector
      ↓
选择一个稀有大型区域
      ↓
建立 Glacier Boss Region
      ↓
保证区域足够大
      ↓
Candidate Analyzer
      ↓
Aurora Palace

最终：

普通 Glacier
→ 可以自然存在
→ 不一定有 Boss

和：

Aurora Glacier Region
→ 大型 Glacier
→ 专门承载 Aurora Palace

分开。

同理：

Fire Swamp
→ Hydra Region


Snowy Forest
→ Yeti Region


Dark Forest
→ Knight Region

Step 4-D3 — 特殊 Boss 群系

这个阶段正式建立之前故意没加进普通 climate pool 的：

dark_forest_center
thornlands
final_plateau

它们不作为普通随机生态大量出现。

而作为：

Progression / Boss Region

使用。

例如：

Dark Forest
     ↓
Dark Forest Center
     ↓
Dark Tower

以及：

Highlands
   ↓
Thornlands
   ↓
Final Plateau
   ↓
Final Castle

Step 4-E — Boss / Progression / Conquered State

建筑本身全部稳定以后，再接玩法。

包括：

Boss 是否存在
Boss 是否死亡
建筑是否 conquered
玩家进度
Boss 解锁条件
世界进度
重复挑战策略

例如 Aurora Palace：

找到 Aurora Region
     ↓
Aurora Palace
     ↓
Snow Queen
     ↓
击杀
     ↓
ModFusion Progress

这里再决定：

Boss 建筑世界唯一

还是：

世界可存在多个
但玩家只需要完成一次

不提前把 unique 和玩家进度混为一谈。

Step 4-F — 多 Mod 建筑统一接入

暮色森林只是第一套验证对象。

整个系统最终应该允许：

Twilight Forest
Alex's Caves
Aether
Blue Skies
其他 Mod
Mahou 自定义 NBT

共同进入：

Building Registry
      ↓
Distributor / Boss Region
      ↓
Analyzer
      ↓
Placement

普通静态建筑：

/place template

Mod 原生大型建筑：

/place structure

这样 KubeJS 只负责调度，不重新实现各 Mod 自己复杂的 Structure Piece 逻辑。

最终架构图

可以把整个 Step 4 保存成这一张：

                    ModFusion World
                          │
                          ▼
              ┌─────────────────────┐
              │    Biome System     │
              │ 地形 / 群系 / 稀有度 │
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
         COMMON Regions        DEDICATED Regions
              │                     │
              ▼                     ▼
     Building Distributor      Boss Region System
              │                     │
      均衡分配建筑种类          建立专属大型生态区
              │                     │
              └──────────┬──────────┘
                         ▼
                 Candidate Search
                         │
                         ▼
                Candidate Analyzer
                 ┌───────┼────────┐
                 │       │        │
               Biome   Terrain   Height
                 │       │        │
                 └───────┼────────┘
                         ▼
                   Spacing Check
                         │
                         ▼
                 Placement Record
                         │
                         ▼
                    Place Structure
                   /               \
          /place structure      /place template
                 │
                 ▼
               Success
                 │
                 ▼
             generated=true
                 │
                 ▼
          Boss / Progression
当前准确进度
Step 4-A
Building Registry                         ✅


Step 4-B1
Candidate Analyzer                        ✅ 原型
Analyzer Calibration                      🟡 当前处理


Step 4-B2
Building Distributor                      ⬅️ 校准后下一步


Step 4-B3
Candidate Search                          ⬜


Step 4-B4
Placement Record                          ⬜


Step 4-B5
Spacing Check                             ⬜


Step 4-C1
第一个 COMMON Structure 实际生成          ⬜


Step 4-C2
COMMON Structure Pool 扩展                ⬜


Step 4-D1
Biome Rarity 调整                         ⬜


Step 4-D2
Boss Region System                        ⬜


Step 4-D3
特殊 Boss Biome                           ⬜


Step 4-E
Boss / Progression                        ⬜


Step 4-F
其他 Mod 建筑接入                         ⬜

这份路线里最重要的三条原则可以一直保留：群系概率不负责建筑数量；普通建筑通过 Distributor 做确定性的均衡分配；专属 Boss 建筑通过 Boss Region 解决，而不是强塞进偶然生成的小型特殊群系。