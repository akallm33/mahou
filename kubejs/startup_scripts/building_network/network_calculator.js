// Mahou Building Network
// Network Calculator
//
// 负责组织一次完整的建筑网络计算。
//
// 当前支持：
//
// - 单节点
// - 线性网络
// - 分叉
// - 汇聚
// - 多起点
// - 多终点
// - 任意 DAG
// - Routing Rule
// - Edge Weight
//
// 当前暂不支持：
//
// - Cycle / 闭环
//
// ============================================================
//
// 职责划分：
//
// Building Definition
//     ↓
// Network Rule
//     修改“点数是什么”
//
//     ↓
//
// Routing Rule
//     决定“点数往哪里走”
//
//     ↓
//
// Directed Edge
//     保存连接关系以及边自己的参数
//     例如 weight
//
// ============================================================
//
// 默认行为：
//
// 如果建筑没有声明 routingRule：
//
// routingRule = "equal"
//
// 即：
// 所有出边守恒均分。
//
// ============================================================

global.MahouNetworkCalculator = {

    // ============================================================
    // Point Helpers
    // ============================================================

    createEmptyPoints: function () {
        return {
            attributes: {},
            abilities: {}
        };
    },


    clonePoints: function (input) {
        var result =
            this.createEmptyPoints();

        if (!input) {
            return result;
        }

        if (input.attributes) {
            for (
                var attributeKey
                in input.attributes
            ) {
                result.attributes[
                    attributeKey
                ] =
                    input.attributes[
                        attributeKey
                    ];
            }
        }

        if (input.abilities) {
            for (
                var abilityKey
                in input.abilities
            ) {
                result.abilities[
                    abilityKey
                ] =
                    input.abilities[
                        abilityKey
                    ];
            }
        }

        return result;
    },


    addPoints: function (
        target,
        addition
    ) {
        var result =
            this.clonePoints(
                target
            );

        if (!addition) {
            return result;
        }

        if (addition.attributes) {
            for (
                var attributeKey
                in addition.attributes
            ) {
                result.attributes[
                    attributeKey
                ] =
                    (
                        result.attributes[
                            attributeKey
                        ] || 0
                    ) +
                    addition.attributes[
                        attributeKey
                    ];
            }
        }

        if (addition.abilities) {
            for (
                var abilityKey
                in addition.abilities
            ) {
                result.abilities[
                    abilityKey
                ] =
                    (
                        result.abilities[
                            abilityKey
                        ] || 0
                    ) +
                    addition.abilities[
                        abilityKey
                    ];
            }
        }

        return result;
    },


    scalePoints: function (
        input,
        factor
    ) {
        var result =
            this.createEmptyPoints();

        if (
            factor === undefined ||
            factor === null
        ) {
            factor = 0;
        }

        if (!input) {
            return result;
        }

        if (input.attributes) {
            for (
                var attributeKey
                in input.attributes
            ) {
                result.attributes[
                    attributeKey
                ] =
                    input.attributes[
                        attributeKey
                    ] *
                    factor;
            }
        }

        if (input.abilities) {
            for (
                var abilityKey
                in input.abilities
            ) {
                result.abilities[
                    abilityKey
                ] =
                    input.abilities[
                        abilityKey
                    ] *
                    factor;
            }
        }

        return result;
    },


    // ============================================================
    // Building Definitions
    // ============================================================

    getBuildingDefinition: function (
        buildingType
    ) {
        var definitions =
            global.MahouBuildingDefinitions;

        if (!definitions) {
            console.error(
                "[Mahou] Building definitions are not available."
            );

            return null;
        }

        var definition =
            definitions[
                buildingType
            ];

        if (!definition) {
            console.error(
                "[Mahou] Unknown building type: " +
                buildingType
            );

            return null;
        }

        return definition;
    },


    getBasePoints: function (
        definition
    ) {
        return {
            attributes:
                definition.attributePoints ||
                {},

            abilities:
                definition.abilityPoints ||
                {}
        };
    },


    // ============================================================
    // Node Map
    // ============================================================

    buildNodeMap: function (
        nodes
    ) {
        var map = {};

        for (
            var i = 0;
            i < nodes.length;
            i++
        ) {
            var node =
                nodes[i];

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

            map[node.id] =
                node;
        }

        return map;
    },


    // ============================================================
    // Graph Construction
    // ============================================================
    //
    // 同时维护：
    //
    // incoming:
    //     只有节点 ID
    //
    // outgoing:
    //     只有节点 ID
    //
    // incomingEdges:
    //     完整边对象
    //
    // outgoingEdges:
    //     完整边对象
    //
    // 这样：
    //
    // 拓扑算法只需要节点 ID；
    //
    // Routing Rule 则可以读取：
    //
    // edge.weight
    //
    // 等边参数。

    buildGraph: function (
        nodes,
        edges
    ) {
        var nodeMap =
            this.buildNodeMap(
                nodes
            );

        if (!nodeMap) {
            return null;
        }

        var incoming = {};
        var outgoing = {};

        var incomingEdges = {};
        var outgoingEdges = {};

        var existingEdges = {};


        for (
            var i = 0;
            i < nodes.length;
            i++
        ) {
            var nodeId =
                nodes[i].id;

            incoming[nodeId] = [];
            outgoing[nodeId] = [];

            incomingEdges[nodeId] = [];
            outgoingEdges[nodeId] = [];
        }


        for (
            var e = 0;
            e < edges.length;
            e++
        ) {
            var edge =
                edges[e];


            // ----------------------------------------------------
            // Endpoint Validation
            // ----------------------------------------------------

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


            // ----------------------------------------------------
            // Self-loop
            // ----------------------------------------------------

            if (
                edge.from ===
                edge.to
            ) {
                console.error(
                    "[Mahou] Self-loop is not supported: " +
                    edge.from +
                    " -> " +
                    edge.to
                );

                return null;
            }


            // ----------------------------------------------------
            // Duplicate Edge
            // ----------------------------------------------------

            var edgeKey =
                edge.from +
                "->" +
                edge.to;

            if (
                existingEdges[
                    edgeKey
                ]
            ) {
                console.error(
                    "[Mahou] Duplicate edge: " +
                    edge.from +
                    " -> " +
                    edge.to
                );

                return null;
            }

            existingEdges[
                edgeKey
            ] = true;


            // ----------------------------------------------------
            // 保存边
            // ----------------------------------------------------
            //
            // 当前只正式使用：
            //
            // from
            // to
            // weight
            //
            // 以后还可以增加：
            //
            // enabled
            // channel
            // priority
            // filter
            // 等。

            // ----------------------------------------------------
            // Edge Weight Validation
            // ----------------------------------------------------
            //
            // undefined / null：
            // 表示没有显式设置 weight。
            //
            // 显式设置时必须是有限数字。
            //
            // 负数目前允许进入图，
            // Routing Rule 会把它 clamp 到 0。
            //
            // NaN / Infinity / string：
            // 属于错误数据，直接拒绝网络。

            if (
                edge.weight !== undefined &&
                edge.weight !== null
            ) {
                if (
                    typeof edge.weight !== "number" ||
                    !isFinite(edge.weight)
                ) {
                    console.error(
                        "[Mahou] Edge weight must be a finite number: " +
                        edge.from +
                        " -> " +
                        edge.to +
                        ", weight=" +
                        edge.weight
                    );

                    return null;
                }
            }

            var storedEdge = {
                from:
                    edge.from,

                to:
                    edge.to
            };

            if (
                edge.weight !== undefined &&
                edge.weight !== null
            ) {
                storedEdge.weight =
                    edge.weight;
            }


            outgoing[
                edge.from
            ].push(
                edge.to
            );

            incoming[
                edge.to
            ].push(
                edge.from
            );


            outgoingEdges[
                edge.from
            ].push(
                storedEdge
            );

            incomingEdges[
                edge.to
            ].push(
                storedEdge
            );
        }


        return {
            nodeMap:
                nodeMap,

            incoming:
                incoming,

            outgoing:
                outgoing,

            incomingEdges:
                incomingEdges,

            outgoingEdges:
                outgoingEdges
        };
    },


    // ============================================================
    // Weak Connectivity
    // ============================================================

    isWeaklyConnected: function (
        nodes,
        incoming,
        outgoing
    ) {
        if (
            nodes.length <= 1
        ) {
            return true;
        }

        var visited = {};

        var stack = [
            nodes[0].id
        ];

        var visitedCount = 0;


        while (
            stack.length > 0
        ) {
            var current =
                stack.pop();

            if (
                visited[
                    current
                ]
            ) {
                continue;
            }

            visited[
                current
            ] = true;

            visitedCount++;


            var parents =
                incoming[
                    current
                ] || [];

            var children =
                outgoing[
                    current
                ] || [];


            for (
                var p = 0;
                p < parents.length;
                p++
            ) {
                if (
                    !visited[
                        parents[p]
                    ]
                ) {
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
                if (
                    !visited[
                        children[c]
                    ]
                ) {
                    stack.push(
                        children[c]
                    );
                }
            }
        }


        return (
            visitedCount ===
            nodes.length
        );
    },


    // ============================================================
    // Topological Sort
    // ============================================================

    getTopologicalOrder: function (
        nodes,
        incoming,
        outgoing
    ) {
        var indegree = {};
        var queue = [];
        var order = [];


        for (
            var i = 0;
            i < nodes.length;
            i++
        ) {
            var nodeId =
                nodes[i].id;

            indegree[
                nodeId
            ] =
                incoming[
                    nodeId
                ].length;
        }


        // 保持 nodes 原始顺序，
        // 使测试结果稳定。

        for (
            var j = 0;
            j < nodes.length;
            j++
        ) {
            var startId =
                nodes[j].id;

            if (
                indegree[
                    startId
                ] === 0
            ) {
                queue.push(
                    startId
                );
            }
        }


        while (
            queue.length > 0
        ) {
            var current =
                queue.shift();

            order.push(
                current
            );

            var children =
                outgoing[
                    current
                ];


            for (
                var c = 0;
                c < children.length;
                c++
            ) {
                var child =
                    children[c];

                indegree[
                    child
                ]--;


                if (
                    indegree[
                        child
                    ] === 0
                ) {
                    queue.push(
                        child
                    );
                }
            }
        }


        if (
            order.length !==
            nodes.length
        ) {
            console.error(
                "[Mahou] Cycle detected. Cycles are not supported yet."
            );

            return null;
        }


        return order;
    },


    // ============================================================
    // Depth Calculation
    // ============================================================

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
                incoming[
                    nodeId
                ];


            if (
                parents.length === 0
            ) {
                depths[
                    nodeId
                ] = 0;

                continue;
            }


            var maxDepth = 0;


            for (
                var p = 0;
                p < parents.length;
                p++
            ) {
                var parentDepth =
                    depths[
                        parents[p]
                    ] || 0;

                if (
                    parentDepth + 1 >
                    maxDepth
                ) {
                    maxDepth =
                        parentDepth + 1;
                }
            }


            depths[
                nodeId
            ] =
                maxDepth;
        }


        return depths;
    },


    // ============================================================
    // Graph Analysis
    // ============================================================

    analyzeGraph: function (
        nodes,
        edges
    ) {
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
                graph.incoming[
                    nodeId
                ].length === 0
            ) {
                starts.push(
                    nodeId
                );
            }


            if (
                graph.outgoing[
                    nodeId
                ].length === 0
            ) {
                terminals.push(
                    nodeId
                );
            }
        }


        var depths =
            this.calculateDepths(
                order,
                graph.incoming
            );


        return {
            nodeMap:
                graph.nodeMap,

            incoming:
                graph.incoming,

            outgoing:
                graph.outgoing,

            incomingEdges:
                graph.incomingEdges,

            outgoingEdges:
                graph.outgoingEdges,

            order:
                order,

            starts:
                starts,

            terminals:
                terminals,

            depths:
                depths
        };
    },


    // ============================================================
    // Linear Compatibility Analysis
    // ============================================================

    getLinearOrder: function (
        nodes,
        edges
    ) {
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
            var id
            in topology.nodeMap
        ) {
            if (
                topology.incoming[
                    id
                ].length > 1
            ) {
                console.error(
                    "[Mahou] Linear network cannot contain merge at node: " +
                    id
                );

                return null;
            }


            if (
                topology.outgoing[
                    id
                ].length > 1
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
    // Process Node
    // ============================================================
    //
    // 固定顺序：
    //
    // incoming points
    //
    //      ↓
    //
    // building base points
    //
    //      ↓
    //
    // Network Rule
    //
    //      ↓
    //
    // node output
    //
    //      ↓
    //
    // Routing Rule

    processNode: function (
        instance,
        inputPoints,
        context,
        knownDefinition
    ) {
        var definition =
            knownDefinition ||
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


        return rules.apply(
            definition.networkRule ||
                "pass",

            points,

            definition.networkParams ||
                {},

            context || {}
        );
    },


    // ============================================================
    // Routing Successor Conversion
    // ============================================================
    //
    // Graph 内部保存：
    //
    // {
    //     from: "A",
    //     to: "B",
    //     weight: 3
    // }
    //
    // Routing Rule 只需要：
    //
    // {
    //     to: "B",
    //     weight: 3
    // }

    buildRoutingSuccessors: function (
        outgoingEdges
    ) {
        var successors = [];


        for (
            var i = 0;
            i < outgoingEdges.length;
            i++
        ) {
            var edge =
                outgoingEdges[i];

            var successor = {
                to:
                    edge.to
            };


            if (
                edge.weight !==
                undefined
            ) {
                successor.weight =
                    edge.weight;
            }


            successors.push(
                successor
            );
        }


        return successors;
    },


    // ============================================================
    // Routing
    // ============================================================

    routeOutput: function (
        definition,
        output,
        outgoingEdges,
        context
    ) {
        var routingRules =
            global.MahouNetworkRoutingRules;


        if (!routingRules) {
            console.error(
                "[Mahou] Network routing rules are not available."
            );

            return null;
        }


        var successors =
            this.buildRoutingSuccessors(
                outgoingEdges
            );


        var routingRule =
            definition.routingRule ||
            "equal";


        var routingParams =
            definition.routingParams ||
            {};


        return routingRules.apply(
            routingRule,
            output,
            successors,
            routingParams,
            context || {}
        );
    },


    // ============================================================
    // Route Validation
    // ============================================================
    //
    // 当前阶段 Routing Rule 只能把点数发送给
    // “真正存在的直接后继”。
    //
    // 不能凭空跳到网络中其他节点。
    //
    // 以后如果做 Redirect 类型卦象，
    // 再专门扩展这里。

    validateRoutes: function (
        routes,
        outgoing
    ) {
        if (!routes) {
            return false;
        }


        var allowed = {};
        var seenTargets = {};


        for (
            var i = 0;
            i < outgoing.length;
            i++
        ) {
            allowed[
                outgoing[i]
            ] = true;
        }


        for (
            var r = 0;
            r < routes.length;
            r++
        ) {
            var route =
                routes[r];


            if (
                !route ||
                !route.to
            ) {
                console.error(
                    "[Mahou] Routing rule returned an invalid route."
                );

                return false;
            }


            if (
                !allowed[
                    route.to
                ]
            ) {
                console.error(
                    "[Mahou] Routing rule attempted to route to a non-successor: " +
                    route.to
                );

                return false;
            }


            // 同一次 Routing Rule 中，
            // 一个直接后继最多出现一次。
            //
            // 如果以后某种机制确实需要对同一条边
            // 做多个阶段的流量操作，
            // 应在 Routing Rule 内部先合并，
            // 而不是返回重复 route。

            var targetKey =
                "$" +
                route.to;

            if (
                seenTargets[
                    targetKey
                ]
            ) {
                console.error(
                    "[Mahou] Routing rule returned duplicate routes to: " +
                    route.to
                );

                return false;
            }

            seenTargets[
                targetKey
            ] = true;


            if (!route.points) {
                console.error(
                    "[Mahou] Routing rule returned a route without points."
                );

                return false;
            }
        }


        return true;
    },    
    
    // ============================================================
    // Compatibility Helper
    // ============================================================
    //
    // 旧代码中的：
    //
    // distributeOutput(...)
    //
    // 继续保留。
    //
    // 默认仍然执行 equal。
    //
    // 以后正式代码应优先使用 routeOutput。

    distributeOutput: function (
        output,
        successors
    ) {
        var routingRules =
            global.MahouNetworkRoutingRules;


        // 如果 Routing Rules 尚未加载，
        // 做一个安全兼容回退。

        if (!routingRules) {
            var fallbackRoutes = [];

            if (
                !successors ||
                successors.length === 0
            ) {
                return fallbackRoutes;
            }


            var factor =
                1.0 /
                successors.length;


            for (
                var f = 0;
                f < successors.length;
                f++
            ) {
                var fallbackTarget =
                    typeof successors[f] ===
                        "string"
                        ?
                        successors[f]
                        :
                        successors[f].to;


                fallbackRoutes.push({
                    to:
                        fallbackTarget,

                    points:
                        this.scalePoints(
                            output,
                            factor
                        )
                });
            }


            return fallbackRoutes;
        }


        var normalized = [];


        for (
            var i = 0;
            i < successors.length;
            i++
        ) {
            if (
                typeof successors[i] ===
                "string"
            ) {
                normalized.push({
                    to:
                        successors[i]
                });
            }
            else {
                normalized.push(
                    successors[i]
                );
            }
        }


        return routingRules.apply(
            "equal",
            output,
            normalized,
            {},
            {}
        );
    },


    // ============================================================
    // Main DAG Calculator
    // ============================================================

    calculateNetwork: function (
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


        edges =
            edges || [];


        var topology =
            this.analyzeGraph(
                nodes,
                edges
            );

        if (!topology) {
            return null;
        }


        // ========================================================
        // Input Buffers
        // ========================================================

        var inputBuffers = {};


        for (
            var i = 0;
            i < nodes.length;
            i++
        ) {
            inputBuffers[
                nodes[i].id
            ] =
                this.createEmptyPoints();
        }


        var finalPoints =
            this.createEmptyPoints();

        var history = [];


        // ========================================================
        // Topological Evaluation
        // ========================================================

        for (
            var orderIndex = 0;
            orderIndex <
                topology.order.length;
            orderIndex++
        ) {
            var instanceId =
                topology.order[
                    orderIndex
                ];


            var instance =
                topology.nodeMap[
                    instanceId
                ];


            var definition =
                this.getBuildingDefinition(
                    instance.buildingType
                );

            if (!definition) {
                return null;
            }


            var predecessors =
                topology.incoming[
                    instanceId
                ];


            var successors =
                topology.outgoing[
                    instanceId
                ];


            var outgoingEdges =
                topology.outgoingEdges[
                    instanceId
                ];


            var input =
                this.clonePoints(
                    inputBuffers[
                        instanceId
                    ]
                );


            // ====================================================
            // Context
            // ====================================================

            var context = {
                index:
                    orderIndex,

                topologicalIndex:
                    orderIndex,

                networkSize:
                    nodes.length,

                instanceId:
                    instanceId,

                buildingType:
                    instance.buildingType,

                order:
                    topology.order,

                depth:
                    topology.depths[
                        instanceId
                    ],

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


            // ====================================================
            // Network Rule
            // ====================================================

            var output =
                this.processNode(
                    instance,
                    input,
                    context,
                    definition
                );

            if (!output) {
                return null;
            }


            var routedOutputs = [];


            // ====================================================
            // Terminal
            // ====================================================

            if (
                successors.length === 0
            ) {
                finalPoints =
                    this.addPoints(
                        finalPoints,
                        output
                    );
            }


            // ====================================================
            // Routing Rule
            // ====================================================

            else {
                routedOutputs =
                    this.routeOutput(
                        definition,
                        output,
                        outgoingEdges,
                        context
                    );


                if (
                    !routedOutputs
                ) {
                    return null;
                }


                if (
                    !this.validateRoutes(
                        routedOutputs,
                        successors
                    )
                ) {
                    return null;
                }


                // ================================================
                // Send Route Results
                // ================================================

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


            // ====================================================
            // History
            // ====================================================

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

                networkRule:
                    definition.networkRule ||
                    "pass",

                routingRule:
                    definition.routingRule ||
                    "equal",

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
        // Final Result
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

                incomingEdges:
                    topology.incomingEdges,

                outgoingEdges:
                    topology.outgoingEdges,

                depths:
                    topology.depths
            }
        };
    },


    // ============================================================
    // Linear Compatibility API
    // ============================================================

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


        edges =
            edges || [];


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