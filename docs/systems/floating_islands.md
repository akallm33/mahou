# Floating Islands

## 功能

该系统负责 Mahou 浮岛维度中的浮岛生成。

当前代码位置：

`kubejs/startup_scripts/floating_islands/`

## 当前文件

- `00_Config.js`：浮岛生成参数。
- `01_Island.js`：岛屿数据对象与碰撞判断。
- `02_Noise.js`：实验性噪声函数。
- `03_IslandShape.js`：实验性岛屿轮廓逻辑。
- `04_BuildingManager.js`：岛屿建筑选择原型。
- `05_BiomeManager.js`：岛屿生态类型原型。
- `06_StructureLoader.js`：结构加载接口原型。
- `07_IslandBlockGenerator.js`：实际生成岛体方块。
- `08_IslandManager.js`：岛屿数量、位置、大小和碰撞管理。
- `99_FloatingIslandGenerator.js`：系统入口。

## 当前调用关系

`server_scripts/modfusion_dimension.js`

→ `FloatingIslandGenerator.init(level)`

→ `IslandManager.generate(level)`

→ `IslandBlockGenerator.generate(level, island)`

## 后续方向

未来浮岛将承载来自不同 Mod 的 Boss 建筑，并进一步与建筑收集、六十四卦和建筑网络系统连接。

当前不提前拆分这些代码，等实际功能边界形成后再调整。
