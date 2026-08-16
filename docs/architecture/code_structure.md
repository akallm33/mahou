# Mahou Code Structure

## 基本结构

项目根目录主要分为：

- `config/`：各 Mod 的配置以及 FTB Quests 等第三方系统数据。
- `kubejs/`：Mahou 自定义玩法的主要开发区域。

KubeJS 已经规定了一级目录的职责：

- `startup_scripts/`：启动阶段的定义和初始化代码。
- `server_scripts/`：服务端运行时玩法逻辑。
- `client_scripts/`：客户端显示和交互逻辑。
- `data/`：Minecraft datapack 数据。
- `assets/`：Minecraft resource pack 资源。
- `config/`：KubeJS 自身配置。

## 当前目录组织原则

现阶段不提前建立复杂的多层架构。

对于 `startup_scripts/`、`server_scripts/` 和 `client_scripts/`：

1. 一组代码具有明确共同功能时，以该功能建立文件夹。
2. 文件夹名称应直接描述功能，不使用临时代号。
3. 当同级功能文件夹增多后，再根据实际共同点建立更高一级分类。
4. 不为了预测未来而提前建立大量空目录。

当前将：

`startup_scripts/modfusion/`

重命名为：

`startup_scripts/floating_islands/`

因为这组代码当前共同负责浮岛相关功能。

`server_scripts/` 当前代码量较少，暂不进一步分类。
