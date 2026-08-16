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

## Root config 的版本控制原则

根目录 `config/` 由各个第三方 Mod 使用。

Mahou 当前不默认版本控制这些 Mod 自动生成的配置文件，因为现阶段尚未主动调整这些 Mod 的配置参数。

当前规则：

- `config/ftbquests/` 属于 Mahou 主动制作的任务内容，因此由 Git 跟踪。
- 其他 `config/` 内容默认仅保留在本地，不由 Git 跟踪。
- 当 Mahou 后续明确需要修改某个 Mod 的配置时，再将对应文件或目录从 `.gitignore` 中单独放出并纳入版本控制。

这样，进入 Git 的第三方 Mod 配置本身就表示该配置已经成为 Mahou 主动维护的一部分。

注意：此规则只适用于项目根目录 `config/`，不适用于 `kubejs/config/`。
