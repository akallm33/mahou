// Mahou Building Network
// Network Calculator
//
// 这个文件负责组织一次完整的建筑网络计算。
//
// 第一版只支持线性有向网络：
//
// A → B → C → D
//
// 暂时不支持：
// - 分叉
// - 汇聚
// - 闭环
//
// 这些结构以后在规则定义明确后再加入。

global.MahouNetworkCalculator = {

    // ============================================================
    // Point Result
    // ============================================================

    createEmptyPoints: function () {
        return {
            attributes: {},
            abilities: {}
        };
    },


    clonePoints: function (input) {
        var result = this.createEmptyPoints();

        if (!input) {
            return result;
        }

        if (input.attributes) {
            for (var key in input.attributes) {
                result.attributes[key] = input.attributes[key];
            }
        }

        if (input.abilities) {
            for (var key in input.abilities) {
                result.abilities[key] = input.abilities[key];
            }
        }

        return result;
    },


    // ============================================================
    // 点数合并
    // ============================================================
    //
    // target:
    // {
    //     attributes: { fire: 6 },
    //     abilities: { attack: 4 }
    // }
    //
    // addition:
    // {
    //     attributes: { thunder: 3 },
    //     abilities: { attackSpeed: 2 }
    // }
    //
    // ↓
    //
    // {
    //     attributes: {
    //         fire: 6,
    //         thunder: 3
    //     },
    //     abilities: {
    //         attack: 4,
    //         attackSpeed: 2
    //     }
    // }

    addPoints: function (target, addition) {
        var result = this.clonePoints(target);

        if (!addition) {
            return result;
        }

        if (addition.attributes) {
            for (var key in addition.attributes) {
                result.attributes[key] =
                    (result.attributes[key] || 0) +
                    addition.attributes[key];
            }
        }

        if (addition.abilities) {
            for (var key in addition.abilities) {
                result.abilities[key] =
                    (result.abilities[key] || 0) +
                    addition.abilities[key];
            }
        }

        return result;
    },


    // ============================================================
    // 获取建筑定义
    // ============================================================

    getBuildingDefinition: function (buildingType) {
        var definitions = global.MahouBuildingDefinitions;

        if (!definitions) {
            console.error(
                "[Mahou] Building definitions are not available."
            );

            return null;
        }

        var definition = definitions[buildingType];

        if (!definition) {
            console.error(
                "[Mahou] Unknown building type: " + buildingType
            );

            return null;
        }

        return definition;
    },


    // ============================================================
    // 获取建筑自身产生的基础点数
    // ============================================================

    getBasePoints: function (definition) {
        return {
            attributes:
                definition.attributePoints || {},

            abilities:
                definition.abilityPoints || {}
        };
    },


    // ============================================================
    // 建立节点索引
    // ============================================================

    buildNodeMap: function (nodes) {
        var map = {};

        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];

            if (!node.id) {
                console.error(
                    "[Mahou] Building instance has no id."
                );

                return null;
            }

            if (map[node.id]) {
                console.error(
                    "[Mahou] Duplicate building instance id: " +
                    node.id
                );

                return null;
            }

            map[node.id] = node;
        }

        return map;
    },


    // ============================================================
    // 分析线性网络
    // ============================================================
    //
    // 第一版要求：
    //
    // 每个节点：
    // 入度 <= 1
    // 出度 <= 1
    //
    // 整个网络：
    // 只有一个起点
    // 没有闭环

    getLinearOrder: function (nodes, edges) {
        var nodeMap = this.buildNodeMap(nodes);

        if (!nodeMap) {
            return null;
        }

        var incoming = {};
        var outgoing = {};

        for (var i = 0; i < nodes.length; i++) {
            incoming[nodes[i].id] = [];
            outgoing[nodes[i].id] = [];
        }

        for (var e = 0; e < edges.length; e++) {
            var edge = edges[e];

            if (!nodeMap[edge.from]) {
                console.error(
                    "[Mahou] Edge source does not exist: " +
                    edge.from
                );

                return null;
            }

            if (!nodeMap[edge.to]) {
                console.error(
                    "[Mahou] Edge target does not exist: " +
                    edge.to
                );

                return null;
            }

            outgoing[edge.from].push(edge.to);
            incoming[edge.to].push(edge.from);
        }

        // 第一版拒绝分叉和汇聚。
        for (var id in nodeMap) {
            if (incoming[id].length > 1) {
                console.error(
                    "[Mahou] Merge is not supported yet at node: " +
                    id
                );

                return null;
            }

            if (outgoing[id].length > 1) {
                console.error(
                    "[Mahou] Split is not supported yet at node: " +
                    id
                );

                return null;
            }
        }

        // 找唯一的起点。
        var starts = [];

        for (var id in nodeMap) {
            if (incoming[id].length === 0) {
                starts.push(id);
            }
        }

        if (starts.length !== 1) {
            console.error(
                "[Mahou] Prototype network must have exactly one start node."
            );

            return null;
        }

        var order = [];
        var visited = {};
        var current = starts[0];

        while (current !== undefined) {

            // 如果重新访问同一个节点，说明有闭环。
            if (visited[current]) {
                console.error(
                    "[Mahou] Cycle detected. Cycles are not supported yet."
                );

                return null;
            }

            visited[current] = true;
            order.push(current);

            if (outgoing[current].length === 0) {
                current = undefined;
            } else {
                current = outgoing[current][0];
            }
        }

        // 如果还有节点没访问，说明网络并非一条完整链。
        if (order.length !== nodes.length) {
            console.error(
                "[Mahou] Prototype network must be one connected linear chain."
            );

            return null;
        }

        return order;
    },


    // ============================================================
    // 处理一个建筑节点
    // ============================================================
    //
    // 当前统一顺序：
    //
    // 上游输入
    //    ↓
    // 加入建筑自身基础点数
    //    ↓
    // 应用建筑 Network Rule
    //    ↓
    // 输出到下一个节点

    processNode: function (
        instance,
        inputPoints,
        context
    ) {
        var definition =
            this.getBuildingDefinition(
                instance.buildingType
            );

        if (!definition) {
            return null;
        }

        // 先把建筑自己的基础点数加入输入流。
        var points = this.addPoints(
            inputPoints,
            this.getBasePoints(definition)
        );

        var rules = global.MahouNetworkRules;

        if (!rules) {
            console.error(
                "[Mahou] Network rules are not available."
            );

            return null;
        }

        // 再执行这个建筑的网络规则。
        var output = rules.apply(
            definition.networkRule || "pass",
            points,
            definition.networkParams || {},
            context || {}
        );

        return output;
    },


    // ============================================================
    // 计算完整线性网络
    // ============================================================

    calculateLinearNetwork: function (nodes, edges) {
        if (!nodes || nodes.length === 0) {
            console.error(
                "[Mahou] Cannot calculate an empty network."
            );

            return null;
        }

        edges = edges || [];

        var order =
            this.getLinearOrder(nodes, edges);

        if (!order) {
            return null;
        }

        var nodeMap =
            this.buildNodeMap(nodes);

        var points =
            this.createEmptyPoints();

        var history = [];

        for (var i = 0; i < order.length; i++) {
            var instanceId = order[i];
            var instance = nodeMap[instanceId];

            var input =
                this.clonePoints(points);

            var context = {
                index: i,
                pathLength: order.length,
                instanceId: instanceId,
                order: order
            };

            var output =
                this.processNode(
                    instance,
                    input,
                    context
                );

            if (!output) {
                return null;
            }

            history.push({
                instanceId: instanceId,
                buildingType: instance.buildingType,
                input: input,
                output: this.clonePoints(output)
            });

            points = output;
        }

        return {
            order: order,
            points: points,

            // 这个 history 主要用于开发阶段调试。
            // 以后玩家正常游戏不一定需要保留。
            history: history
        };
    }

};