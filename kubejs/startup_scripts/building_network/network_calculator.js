// Mahou Building Network
// Network Calculator
//
// 这个文件负责组织建筑网络的一次完整计算。
//
// 当前支持：
//
// - 单节点网络
// - 线性有向网络
// - 多起点汇聚
// - 分叉
// - 分叉后重新汇聚
// - 任意无环有向图（DAG）
//
// 当前暂不支持：
//
// - 闭环 / Cycle
//
// 基础拓扑原则：
//
// 1. 分叉默认守恒均分
//
//        → B
//    A →
//        → C
//
// 如果 A 输出 10 点，而有两个出边：
//
// B 收到 5
// C 收到 5
//
// 2. 汇聚默认直接求和
//
// A →
//     → C
// B →
//
// A 输出 5，B 输出 3：
//
// C 收到 8
//
// 3. 图本身不凭空创造点数。
//    额外复制、增殖、特殊比例等行为以后由具体 Network Rule 提供。
//
// 4. 所有终端节点的最终输出相加，形成整个网络的最终 Point Result。

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
            for (var attributeKey in input.attributes) {
                result.attributes[attributeKey] =
                    input.attributes[attributeKey];
            }
        }

        if (input.abilities) {
            for (var abilityKey in input.abilities) {
                result.abilities[abilityKey] =
                    input.abilities[abilityKey];
            }
        }

        return result;
    },


    // ============================================================
    // 点数合并
    // ============================================================
    //
    // 相同点数直接相加。
    //
    // 例如：
    //
    // A:
    // 火 3
    // 风 2
    //
    // B:
    // 火 4
    // 雷 5
    //
    // ↓
    //
    // 火 7
    // 风 2
    // 雷 5

    addPoints: function (target, addition) {
        var result = this.clonePoints(target);

        if (!addition) {
            return result;
        }

        if (addition.attributes) {
            for (var attributeKey in addition.attributes) {
                result.attributes[attributeKey] =
                    (result.attributes[attributeKey] || 0) +
                    addition.attributes[attributeKey];
            }
        }

        if (addition.abilities) {
            for (var abilityKey in addition.abilities) {
                result.abilities[abilityKey] =
                    (result.abilities[abilityKey] || 0) +
                    addition.abilities[abilityKey];
            }
        }

        return result;
    },


    // ============================================================
    // 点数整体缩放
    // ============================================================
    //
    // 用于分叉时进行守恒均分。
    //
    // 例如：
    //
    // 火 10
    // 攻击 4
    //
    // factor = 0.5
    //
    // ↓
    //
    // 火 5
    // 攻击 2

    scalePoints: function (input, factor) {
        var result = this.createEmptyPoints();

        factor = factor || 0;

        if (!input) {
            return result;
        }

        if (input.attributes) {
            for (var attributeKey in input.attributes) {
                result.attributes[attributeKey] =
                    input.attributes[attributeKey] * factor;
            }
        }

        if (input.abilities) {
            for (var abilityKey in input.abilities) {
                result.abilities[abilityKey] =
                    input.abilities[abilityKey] * factor;
            }
        }

        return result;
    },


    // ============================================================
    // 获取建筑定义
    // ============================================================

    getBuildingDefinition: function (buildingType) {
        var definitions =
            global.MahouBuildingDefinitions;

        if (!definitions) {
            console.error(
                "[Mahou] Building definitions are not available."
            );

            return null;
        }

        var definition =
            definitions[buildingType];

        if (!definition) {
            console.error(
                "[Mahou] Unknown building type: " +
                buildingType
            );

            return null;
        }

        return definition;
    },


    // ============================================================
    // 获取建筑自身基础点数
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
    // 建立有向图
    // ============================================================
    //
    // 输出：
    //
    // {
    //     nodeMap,
    //     incoming,
    //     outgoing
    // }
    //
    // incoming["C"] = ["A", "B"]
    //
    // 表示：
    //
    // A →
    //     → C
    // B →

    buildGraph: function (nodes, edges) {
        var nodeMap =
            this.buildNodeMap(nodes);

        if (!nodeMap) {
            return null;
        }

        var incoming = {};
        var outgoing = {};
        var existingEdges = {};

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

            if (edge.from === edge.to) {
                console.error(
                    "[Mahou] Self-loop is not supported: " +
                    edge.from +
                    " -> " +
                    edge.to
                );

                return null;
            }

            var edgeKey =
                edge.from +
                "->" +
                edge.to;

            if (existingEdges[edgeKey]) {
                console.error(
                    "[Mahou] Duplicate edge: " +
                    edge.from +
                    " -> " +
                    edge.to
                );

                return null;
            }

            existingEdges[edgeKey] = true;

            outgoing[edge.from].push(
                edge.to
            );

            incoming[edge.to].push(
                edge.from
            );
        }

        return {
            nodeMap: nodeMap,
            incoming: incoming,
            outgoing: outgoing
        };
    },


    // ============================================================
    // 检查整个网络是否连通
    // ============================================================
    //
    // 这里检查“弱连通”：
    //
    // 暂时忽略箭头方向，
    // 看所有节点是否属于同一张网络。
    //
    // 如果：
    //
    // A → B
    //
    // C → D
    //
    // 则这是两个独立网络，
    // 不应该作为一次 calculateNetwork 输入。

    isWeaklyConnected: function (
        nodes,
        incoming,
        outgoing
    ) {
        if (nodes.length <= 1) {
            return true;
        }

        var visited = {};
        var stack = [
            nodes[0].id
        ];

        var visitedCount = 0;

        while (stack.length > 0) {
            var current =
                stack.pop();

            if (visited[current]) {
                continue;
            }

            visited[current] = true;
            visitedCount++;

            var parents =
                incoming[current] || [];

            var children =
                outgoing[current] || [];

            for (
                var p = 0;
                p < parents.length;
                p++
            ) {
                if (!visited[parents[p]]) {
                    stack.push(
                        parents[p]
                    );
                }
            }

            for (
                var c = 0;
                c < children.length;
                c++
            ) {
                if (!visited[children[c]]) {
                    stack.push(
                        children[c]
                    );
                }
            }
        }

        return visitedCount === nodes.length;
    },


    // ============================================================
    // 拓扑排序
    // ============================================================
    //
    // 使用 Kahn Algorithm。
    //
    // DAG：
    //
    // A → B
    // ↓   ↓
    // C → D
    //
    // 可以得到：
    //
    // A, B, C, D
    //
    // 或其他合法拓扑顺序。
    //
    // 如果最终无法访问所有节点，
    // 则说明存在闭环。

    getTopologicalOrder: function (
        nodes,
        incoming,
        outgoing
    ) {
        var indegree = {};
        var queue = [];
        var order = [];

        for (var i = 0; i < nodes.length; i++) {
            var nodeId =
                nodes[i].id;

            indegree[nodeId] =
                incoming[nodeId].length;
        }

        // 按 nodes 原始顺序加入队列，
        // 这样测试结果更稳定。
        for (var j = 0; j < nodes.length; j++) {
            var startId =
                nodes[j].id;

            if (indegree[startId] === 0) {
                queue.push(startId);
            }
        }

        while (queue.length > 0) {
            var current =
                queue.shift();

            order.push(current);

            var children =
                outgoing[current];

            for (
                var c = 0;
                c < children.length;
                c++
            ) {
                var child =
                    children[c];

                indegree[child]--;

                if (indegree[child] === 0) {
                    queue.push(child);
                }
            }
        }

        if (order.length !== nodes.length) {
            console.error(
                "[Mahou] Cycle detected. Cycles are not supported yet."
            );

            return null;
        }

        return order;
    },


    // ============================================================
    // 计算节点深度
    // ============================================================
    //
    // 起点：
    //
    // depth = 0
    //
    // 后继节点：
    //
    // depth =
    // 最大前驱 depth + 1
    //
    // 例如：
    //
    // A → B → D
    //  ↘ C ↗
    //
    // A = 0
    // B = 1
    // C = 1
    // D = 2

    calculateDepths: function (
        order,
        incoming
    ) {
        var depths = {};

        for (
            var i = 0;
            i < order.length;
            i++
        ) {
            var nodeId =
                order[i];

            var parents =
                incoming[nodeId];

            if (parents.length === 0) {
                depths[nodeId] = 0;
                continue;
            }

            var maxDepth = 0;

            for (
                var p = 0;
                p < parents.length;
                p++
            ) {
                var parentDepth =
                    depths[parents[p]] || 0;

                if (
                    parentDepth + 1 >
                    maxDepth
                ) {
                    maxDepth =
                        parentDepth + 1;
                }
            }

            depths[nodeId] =
                maxDepth;
        }

        return depths;
    },


    // ============================================================
    // 完整图分析
    // ============================================================

    analyzeGraph: function (nodes, edges) {
        var graph =
            this.buildGraph(
                nodes,
                edges
            );

        if (!graph) {
            return null;
        }

        if (
            !this.isWeaklyConnected(
                nodes,
                graph.incoming,
                graph.outgoing
            )
        ) {
            console.error(
                "[Mahou] Network contains disconnected components."
            );

            return null;
        }

        var order =
            this.getTopologicalOrder(
                nodes,
                graph.incoming,
                graph.outgoing
            );

        if (!order) {
            return null;
        }

        var starts = [];
        var terminals = [];

        for (
            var i = 0;
            i < nodes.length;
            i++
        ) {
            var nodeId =
                nodes[i].id;

            if (
                graph.incoming[nodeId].length === 0
            ) {
                starts.push(nodeId);
            }

            if (
                graph.outgoing[nodeId].length === 0
            ) {
                terminals.push(nodeId);
            }
        }

        var depths =
            this.calculateDepths(
                order,
                graph.incoming
            );

        return {
            nodeMap: graph.nodeMap,
            incoming: graph.incoming,
            outgoing: graph.outgoing,

            order: order,
            starts: starts,
            terminals: terminals,
            depths: depths
        };
    },


    // ============================================================
    // 保留旧接口：检查线性网络
    // ============================================================
    //
    // 旧测试和旧代码仍然可以调用：
    //
    // getLinearOrder(...)
    //
    // 但内部已经建立在新的图分析器之上。

    getLinearOrder: function (nodes, edges) {
        var topology =
            this.analyzeGraph(
                nodes,
                edges
            );

        if (!topology) {
            return null;
        }

        if (
            topology.starts.length !== 1 ||
            topology.terminals.length !== 1
        ) {
            console.error(
                "[Mahou] Linear network must have exactly one start and one terminal."
            );

            return null;
        }

        for (
            var id in topology.nodeMap
        ) {
            if (
                topology.incoming[id].length > 1
            ) {
                console.error(
                    "[Mahou] Linear network cannot contain merge at node: " +
                    id
                );

                return null;
            }

            if (
                topology.outgoing[id].length > 1
            ) {
                console.error(
                    "[Mahou] Linear network cannot contain split at node: " +
                    id
                );

                return null;
            }
        }

        return topology.order;
    },


    // ============================================================
    // 处理一个建筑节点
    // ============================================================
    //
    // 固定顺序：
    //
    // 上游输入
    //      ↓
    // 加入建筑自己的基础点数
    //      ↓
    // 应用 Network Rule
    //      ↓
    // 得到节点输出

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

        var points =
            this.addPoints(
                inputPoints,
                this.getBasePoints(
                    definition
                )
            );

        var rules =
            global.MahouNetworkRules;

        if (!rules) {
            console.error(
                "[Mahou] Network rules are not available."
            );

            return null;
        }

        var output =
            rules.apply(
                definition.networkRule ||
                    "pass",

                points,

                definition.networkParams ||
                    {},

                context ||
                    {}
            );

        return output;
    },


    // ============================================================
    // 分配节点输出
    // ============================================================
    //
    // 当前默认：
    //
    // outdegree = 1
    //
    // 全部输出。
    //
    // outdegree = 2
    //
    // 每条边 1/2。
    //
    // outdegree = 3
    //
    // 每条边 1/3。
    //
    // 因此图结构本身守恒。
    //
    // 以后如果某个卦允许：
    //
    // - 不等比例分流
    // - 复制
    // - 分流增益
    //
    // 可以在这里增加由 Network Rule /
    // Routing Rule 提供的覆盖机制。

    distributeOutput: function (
        output,
        successors
    ) {
        var routes = [];

        if (
            !successors ||
            successors.length === 0
        ) {
            return routes;
        }

        var shareFactor =
            1.0 /
            successors.length;

        var sharedPoints =
            this.scalePoints(
                output,
                shareFactor
            );

        for (
            var i = 0;
            i < successors.length;
            i++
        ) {
            routes.push({
                to: successors[i],

                points:
                    this.clonePoints(
                        sharedPoints
                    )
            });
        }

        return routes;
    },


    // ============================================================
    // 通用 DAG 网络计算器
    // ============================================================
    //
    // 这是新的主接口：
    //
    // calculateNetwork(nodes, edges)
    //
    // 支持任意无环有向图。

    calculateNetwork: function (nodes, edges) {
        if (
            !nodes ||
            nodes.length === 0
        ) {
            console.error(
                "[Mahou] Cannot calculate an empty network."
            );

            return null;
        }

        edges = edges || [];

        var topology =
            this.analyzeGraph(
                nodes,
                edges
            );

        if (!topology) {
            return null;
        }

        // --------------------------------------------------------
        // 每个节点的输入缓存
        // --------------------------------------------------------
        //
        // 所有前驱发来的点数都会先累加到这里。
        //
        // 例如：
        //
        // A →
        //     → C
        // B →
        //
        // C 的 inputBuffers["C"]
        //
        // 会依次收到 A 和 B 的输出，
        // 最终在 C 被处理前自动求和。

        var inputBuffers = {};

        for (
            var i = 0;
            i < nodes.length;
            i++
        ) {
            inputBuffers[nodes[i].id] =
                this.createEmptyPoints();
        }


        var finalPoints =
            this.createEmptyPoints();

        var history = [];


        // --------------------------------------------------------
        // 按拓扑顺序处理节点
        // --------------------------------------------------------

        for (
            var orderIndex = 0;
            orderIndex < topology.order.length;
            orderIndex++
        ) {
            var instanceId =
                topology.order[orderIndex];

            var instance =
                topology.nodeMap[
                    instanceId
                ];

            var predecessors =
                topology.incoming[
                    instanceId
                ];

            var successors =
                topology.outgoing[
                    instanceId
                ];

            var input =
                this.clonePoints(
                    inputBuffers[
                        instanceId
                    ]
                );


            // ----------------------------------------------------
            // Context
            // ----------------------------------------------------
            //
            // Network Rule 以后可以读取这些图信息。
            //
            // 例如：
            //
            // 入度
            // 出度
            // 是否起点
            // 是否终点
            // 深度
            // 前驱
            // 后继

            var context = {
                index:
                    orderIndex,

                topologicalIndex:
                    orderIndex,

                networkSize:
                    nodes.length,

                instanceId:
                    instanceId,

                order:
                    topology.order,

                depth:
                    topology.depths[
                        instanceId
                    ],

                // 为兼容以前的 context，
                // pathLength 暂时定义为：
                //
                // 从某个起点到当前节点的最大节点数。
                //
                // 起点 depth=0
                // → pathLength=1

                pathLength:
                    topology.depths[
                        instanceId
                    ] + 1,

                indegree:
                    predecessors.length,

                outdegree:
                    successors.length,

                isStart:
                    predecessors.length === 0,

                isTerminal:
                    successors.length === 0,

                predecessors:
                    predecessors.slice(0),

                successors:
                    successors.slice(0),

                startIds:
                    topology.starts.slice(0),

                terminalIds:
                    topology.terminals.slice(0)
            };


            // ----------------------------------------------------
            // 节点计算
            // ----------------------------------------------------

            var output =
                this.processNode(
                    instance,
                    input,
                    context
                );

            if (!output) {
                return null;
            }


            // ----------------------------------------------------
            // 终端节点
            // ----------------------------------------------------
            //
            // 终端没有后继。
            //
            // 所有终端输出相加，
            // 成为整个网络最终结果。

            var routedOutputs = [];

            if (successors.length === 0) {
                finalPoints =
                    this.addPoints(
                        finalPoints,
                        output
                    );
            }


            // ----------------------------------------------------
            // 非终端节点
            // ----------------------------------------------------
            //
            // 默认按出边数均分。

            else {
                routedOutputs =
                    this.distributeOutput(
                        output,
                        successors
                    );

                for (
                    var routeIndex = 0;
                    routeIndex <
                        routedOutputs.length;
                    routeIndex++
                ) {
                    var route =
                        routedOutputs[
                            routeIndex
                        ];

                    inputBuffers[
                        route.to
                    ] =
                        this.addPoints(
                            inputBuffers[
                                route.to
                            ],

                            route.points
                        );
                }
            }


            // ----------------------------------------------------
            // History
            // ----------------------------------------------------
            //
            // 主要供开发测试和以后调试使用。

            history.push({
                instanceId:
                    instanceId,

                buildingType:
                    instance.buildingType,

                input:
                    this.clonePoints(
                        input
                    ),

                output:
                    this.clonePoints(
                        output
                    ),

                indegree:
                    predecessors.length,

                outdegree:
                    successors.length,

                depth:
                    topology.depths[
                        instanceId
                    ],

                routedOutputs:
                    routedOutputs
            });
        }


        // ========================================================
        // 返回完整计算结果
        // ========================================================

        return {
            order:
                topology.order,

            starts:
                topology.starts,

            terminals:
                topology.terminals,

            points:
                finalPoints,

            history:
                history,

            topology: {
                incoming:
                    topology.incoming,

                outgoing:
                    topology.outgoing,

                depths:
                    topology.depths
            }
        };
    },


    // ============================================================
    // 旧接口兼容
    // ============================================================
    //
    // calculateLinearNetwork 仍然保留。
    //
    // 它先确认网络确实是一条线，
    // 然后交给新的 calculateNetwork。
    //
    // 因此之前已经通过的旧测试不需要全部重写。

    calculateLinearNetwork: function (
        nodes,
        edges
    ) {
        if (
            !nodes ||
            nodes.length === 0
        ) {
            console.error(
                "[Mahou] Cannot calculate an empty network."
            );

            return null;
        }

        edges = edges || [];

        var linearOrder =
            this.getLinearOrder(
                nodes,
                edges
            );

        if (!linearOrder) {
            return null;
        }

        return this.calculateNetwork(
            nodes,
            edges
        );
    }

};