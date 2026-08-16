# 001 - Script Folder Strategy

## 决定

Mahou 的脚本目录现阶段按照实际存在的功能进行分组，不提前建立复杂的多层架构。

当前：

`startup_scripts/modfusion/`

改为：

`startup_scripts/floating_islands/`

## 原因

`modfusion` 是内部代号，不能直接说明代码职责。

当前这一组代码共同负责浮岛相关功能，因此 `floating_islands` 更清晰。

目前 `server_scripts/` 代码较少，暂不进一步分类。

未来当多个功能文件夹出现后，再根据实际形成的共同类别增加上一层目录。

## 原则

目录结构随项目实际复杂度逐渐生长，而不是提前预测未来所有系统。
