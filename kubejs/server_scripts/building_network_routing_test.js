// Mahou Building Network
// Routing Rule Tests
//
// 专门测试：
//
// equal
// weighted
// broadcast
//
// 以及：
//
// edge.weight
// Network Rule + Routing Rule
// Calculator Integration
//
// 旧的基础测试和 DAG 测试保持独立。

LevelEvents.loaded(function (event) {

    var level = event.level;
    var dimensionId = String(level.dimension);

    if (dimensionId !== "minecraft:overworld") {
        return;
    }

    if (global.MahouBuildingNetworkRoutingTestRan) {
        return;
    }

    global.MahouBuildingNetworkRoutingTestRan = true;


    // ============================================================
    // Test State
    // ============================================================

    var passCount = 0;
    var failCount = 0;


    function logPass(message) {
        passCount++;

        console.log(
            "[Mahou Routing Test] PASS: " +
            message
        );
    }


    function logFail(message) {
        failCount++;

        console.error(
            "[Mahou Routing Test] FAIL: " +
            message
        );
    }


    function assertClose(
        label,
        actual,
        expected
    ) {
        var tolerance = 0.000001;

        if (
            actual !== undefined &&
            actual !== null &&
            Math.abs(actual - expected) <= tolerance
        ) {
            logPass(
                label +
                " = " +
                actual
            );
        }
        else {
            logFail(
                label +
                " expected " +
                expected +
                ", got " +
                actual
            );
        }
    }


    function assertEqual(
        label,
        actual,
        expected
    ) {
        if (actual === expected) {
            logPass(
                label +
                " = " +
                actual
            );
        }
        else {
            logFail(
                label +
                " expected " +
                expected +
                ", got " +
                actual
            );
        }
    }


    function assertTrue(
        label,
        condition
    ) {
        if (condition) {
            logPass(label);
        }
        else {
            logFail(label);
        }
    }


    function findHistory(
        result,
        instanceId
    ) {
        if (!result || !result.history) {
            return null;
        }

        for (
            var i = 0;
            i < result.history.length;
            i++
        ) {
            if (
                result.history[i].instanceId ===
                instanceId
            ) {
                return result.history[i];
            }
        }

        return null;
    }


    function findRoute(
        routes,
        target
    ) {
        if (!routes) {
            return null;
        }

        for (
            var i = 0;
            i < routes.length;
            i++
        ) {
            if (
                routes[i].to === target
            ) {
                return routes[i];
            }
        }

        return null;
    }


    console.log(
        "[Mahou Routing Test] ========================================"
    );

    console.log(
        "[Mahou Routing Test] Starting routing tests..."
    );


    // ============================================================
    // Required Systems
    // ============================================================

    var routingRules =
        global.MahouNetworkRoutingRules;

    var calculator =
        global.MahouNetworkCalculator;

    var definitions =
        global.MahouBuildingDefinitions;


    if (!routingRules) {
        logFail(
            "MahouNetworkRoutingRules is not loaded"
        );

        return;
    }


    if (!calculator) {
        logFail(
            "MahouNetworkCalculator is not loaded"
        );

        return;
    }


    if (!definitions) {
        logFail(
            "MahouBuildingDefinitions is not loaded"
        );

        return;
    }


    assertTrue(
        "Routing Rules loaded",
        routingRules !== null
    );

    assertTrue(
        "Calculator loaded",
        calculator !== null
    );


    // ============================================================
    // TEST 1
    // Prototype Definitions
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Prototype Definitions ---"
    );


    assertTrue(
        "relay prototype exists",
        definitions.prototype_relay !== undefined
    );

    assertTrue(
        "weighted router prototype exists",
        definitions.prototype_weighted_router !== undefined
    );

    assertTrue(
        "broadcaster prototype exists",
        definitions.prototype_broadcaster !== undefined
    );

    assertTrue(
        "weighted amplifier prototype exists",
        definitions.prototype_weighted_amplifier !== undefined
    );


    assertEqual(
        "weighted router routing rule",
        definitions.prototype_weighted_router.routingRule,
        "weighted"
    );

    assertEqual(
        "broadcaster routing rule",
        definitions.prototype_broadcaster.routingRule,
        "broadcast"
    );

    assertEqual(
        "weighted amplifier network rule",
        definitions.prototype_weighted_amplifier.networkRule,
        "amplify"
    );

    assertEqual(
        "weighted amplifier routing rule",
        definitions.prototype_weighted_amplifier.routingRule,
        "weighted"
    );


    // ============================================================
    // Shared Direct Input
    // ============================================================

    var directInput = {
        attributes: {
            fire: 8
        },

        abilities: {
            attack: 4
        }
    };


    // ============================================================
    // TEST 2
    // EQUAL - Two Outputs
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Equal Two-way ---"
    );


    var equalTwo =
        routingRules.apply(
            "equal",

            directInput,

            [
                {
                    to: "A"
                },

                {
                    to: "B"
                }
            ],

            {},

            {}
        );


    assertEqual(
        "equal two route count",
        equalTwo.length,
        2
    );


    var equalTwoA =
        findRoute(
            equalTwo,
            "A"
        );

    var equalTwoB =
        findRoute(
            equalTwo,
            "B"
        );


    assertClose(
        "equal two A fire",
        equalTwoA.points.attributes.fire,
        4
    );

    assertClose(
        "equal two B fire",
        equalTwoB.points.attributes.fire,
        4
    );

    assertClose(
        "equal two A attack",
        equalTwoA.points.abilities.attack,
        2
    );

    assertClose(
        "equal two B attack",
        equalTwoB.points.abilities.attack,
        2
    );


    // 输入不能被修改。

    assertClose(
        "equal does not mutate fire",
        directInput.attributes.fire,
        8
    );

    assertClose(
        "equal does not mutate attack",
        directInput.abilities.attack,
        4
    );


    // ============================================================
    // TEST 3
    // EQUAL - Three Outputs
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Equal Three-way ---"
    );


    var equalThree =
        routingRules.apply(
            "equal",

            directInput,

            [
                {
                    to: "A"
                },

                {
                    to: "B"
                },

                {
                    to: "C"
                }
            ],

            {},

            {}
        );


    assertClose(
        "equal three A fire",
        findRoute(
            equalThree,
            "A"
        ).points.attributes.fire,
        8 / 3
    );

    assertClose(
        "equal three B fire",
        findRoute(
            equalThree,
            "B"
        ).points.attributes.fire,
        8 / 3
    );

    assertClose(
        "equal three C fire",
        findRoute(
            equalThree,
            "C"
        ).points.attributes.fire,
        8 / 3
    );


    // ============================================================
    // TEST 4
    // WEIGHTED 3:1
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Weighted 3:1 ---"
    );


    var weightedThreeOne =
        routingRules.apply(
            "weighted",

            directInput,

            [
                {
                    to: "A",
                    weight: 3
                },

                {
                    to: "B",
                    weight: 1
                }
            ],

            {},

            {}
        );


    var weightedA =
        findRoute(
            weightedThreeOne,
            "A"
        );

    var weightedB =
        findRoute(
            weightedThreeOne,
            "B"
        );


    assertClose(
        "weighted 3:1 A fire",
        weightedA.points.attributes.fire,
        6
    );

    assertClose(
        "weighted 3:1 B fire",
        weightedB.points.attributes.fire,
        2
    );

    assertClose(
        "weighted 3:1 A attack",
        weightedA.points.abilities.attack,
        3
    );

    assertClose(
        "weighted 3:1 B attack",
        weightedB.points.abilities.attack,
        1
    );


    // 总量守恒。

    assertClose(
        "weighted fire conserved",
        weightedA.points.attributes.fire +
            weightedB.points.attributes.fire,
        8
    );

    assertClose(
        "weighted attack conserved",
        weightedA.points.abilities.attack +
            weightedB.points.abilities.attack,
        4
    );


    // ============================================================
    // TEST 5
    // WEIGHTED - Missing Weight Defaults to 1
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Weighted Default Weight ---"
    );


    var weightedDefault =
        routingRules.apply(
            "weighted",

            directInput,

            [
                {
                    to: "A",
                    weight: 3
                },

                {
                    to: "B"
                }
            ],

            {},

            {}
        );


    assertClose(
        "weighted default A fire",
        findRoute(
            weightedDefault,
            "A"
        ).points.attributes.fire,
        6
    );

    assertClose(
        "weighted default B fire",
        findRoute(
            weightedDefault,
            "B"
        ).points.attributes.fire,
        2
    );


    // ============================================================
    // TEST 6
    // WEIGHTED - No Weights = Equal
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Weighted No Weights ---"
    );


    var weightedNoWeights =
        routingRules.apply(
            "weighted",

            directInput,

            [
                {
                    to: "A"
                },

                {
                    to: "B"
                }
            ],

            {},

            {}
        );


    assertClose(
        "weighted no weights A fire",
        findRoute(
            weightedNoWeights,
            "A"
        ).points.attributes.fire,
        4
    );

    assertClose(
        "weighted no weights B fire",
        findRoute(
            weightedNoWeights,
            "B"
        ).points.attributes.fire,
        4
    );


    // ============================================================
    // TEST 7
    // WEIGHTED - Negative Weight Clamped
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Weighted Negative Weight ---"
    );


    var weightedNegative =
        routingRules.apply(
            "weighted",

            directInput,

            [
                {
                    to: "A",
                    weight: -10
                },

                {
                    to: "B",
                    weight: 1
                }
            ],

            {},

            {}
        );


    assertClose(
        "weighted negative A fire",
        findRoute(
            weightedNegative,
            "A"
        ).points.attributes.fire,
        0
    );

    assertClose(
        "weighted negative B fire",
        findRoute(
            weightedNegative,
            "B"
        ).points.attributes.fire,
        8
    );


    // ============================================================
    // TEST 8
    // WEIGHTED - All Zero Falls Back to Equal
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Weighted Zero Fallback ---"
    );


    var weightedZero =
        routingRules.apply(
            "weighted",

            directInput,

            [
                {
                    to: "A",
                    weight: 0
                },

                {
                    to: "B",
                    weight: 0
                }
            ],

            {},

            {}
        );


    assertClose(
        "weighted zero fallback A fire",
        findRoute(
            weightedZero,
            "A"
        ).points.attributes.fire,
        4
    );

    assertClose(
        "weighted zero fallback B fire",
        findRoute(
            weightedZero,
            "B"
        ).points.attributes.fire,
        4
    );


    // ============================================================
    // TEST 9
    // BROADCAST - Two Outputs
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Broadcast Two-way ---"
    );


    var broadcastTwo =
        routingRules.apply(
            "broadcast",

            directInput,

            [
                {
                    to: "A"
                },

                {
                    to: "B"
                }
            ],

            {},

            {}
        );


    assertClose(
        "broadcast A fire",
        findRoute(
            broadcastTwo,
            "A"
        ).points.attributes.fire,
        8
    );

    assertClose(
        "broadcast B fire",
        findRoute(
            broadcastTwo,
            "B"
        ).points.attributes.fire,
        8
    );

    assertClose(
        "broadcast A attack",
        findRoute(
            broadcastTwo,
            "A"
        ).points.abilities.attack,
        4
    );

    assertClose(
        "broadcast B attack",
        findRoute(
            broadcastTwo,
            "B"
        ).points.abilities.attack,
        4
    );


    // 明确确认复制后的总流量翻倍。

    assertClose(
        "broadcast doubles total fire",
        findRoute(
            broadcastTwo,
            "A"
        ).points.attributes.fire +
            findRoute(
                broadcastTwo,
                "B"
            ).points.attributes.fire,
        16
    );


    // ============================================================
    // TEST 10
    // BROADCAST - Three Outputs
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Broadcast Three-way ---"
    );


    var broadcastThree =
        routingRules.apply(
            "broadcast",

            directInput,

            [
                {
                    to: "A"
                },

                {
                    to: "B"
                },

                {
                    to: "C"
                }
            ],

            {},

            {}
        );


    assertClose(
        "broadcast three A fire",
        findRoute(
            broadcastThree,
            "A"
        ).points.attributes.fire,
        8
    );

    assertClose(
        "broadcast three B fire",
        findRoute(
            broadcastThree,
            "B"
        ).points.attributes.fire,
        8
    );

    assertClose(
        "broadcast three C fire",
        findRoute(
            broadcastThree,
            "C"
        ).points.attributes.fire,
        8
    );


    // ============================================================
    // TEST 11
    // Unknown Rule Falls Back to Equal
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Unknown Rule Fallback ---"
    );


    var unknownRule =
        routingRules.apply(
            "this_rule_does_not_exist",

            directInput,

            [
                {
                    to: "A"
                },

                {
                    to: "B"
                }
            ],

            {},

            {}
        );


    assertClose(
        "unknown rule fallback A fire",
        findRoute(
            unknownRule,
            "A"
        ).points.attributes.fire,
        4
    );

    assertClose(
        "unknown rule fallback B fire",
        findRoute(
            unknownRule,
            "B"
        ).points.attributes.fire,
        4
    );


    // ============================================================
    // TEST 12
    // Calculator + Weighted Router
    //
    // Source
    //   ↓
    // Weighted Router
    //   ├──3──→ B
    //   └──1──→ C
    //
    // Source：
    //
    // 火6
    // 攻击4
    //
    // B：
    //
    // 火4.5
    // 攻击3
    //
    // C：
    //
    // 火1.5
    // 攻击1
    //
    // 总量守恒。
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Calculator Weighted Integration ---"
    );


    var weightedNetwork =
        calculator.calculateNetwork(

            [
                {
                    id: "W_SOURCE",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "W_ROUTER",
                    buildingType:
                        "prototype_weighted_router"
                },

                {
                    id: "W_B",
                    buildingType:
                        "prototype_relay"
                },

                {
                    id: "W_C",
                    buildingType:
                        "prototype_relay"
                }
            ],

            [
                {
                    from: "W_SOURCE",
                    to: "W_ROUTER"
                },

                {
                    from: "W_ROUTER",
                    to: "W_B",
                    weight: 3
                },

                {
                    from: "W_ROUTER",
                    to: "W_C",
                    weight: 1
                }
            ]
        );


    assertTrue(
        "weighted network returns result",
        weightedNetwork !== null
    );


    if (weightedNetwork) {

        var weightedRouterHistory =
            findHistory(
                weightedNetwork,
                "W_ROUTER"
            );

        var weightedBHistory =
            findHistory(
                weightedNetwork,
                "W_B"
            );

        var weightedCHistory =
            findHistory(
                weightedNetwork,
                "W_C"
            );


        assertEqual(
            "weighted router history rule",
            weightedRouterHistory.routingRule,
            "weighted"
        );

        assertClose(
            "weighted network B input fire",
            weightedBHistory.input.attributes.fire,
            4.5
        );

        assertClose(
            "weighted network C input fire",
            weightedCHistory.input.attributes.fire,
            1.5
        );

        assertClose(
            "weighted network B input attack",
            weightedBHistory.input.abilities.attack,
            3
        );

        assertClose(
            "weighted network C input attack",
            weightedCHistory.input.abilities.attack,
            1
        );

        assertClose(
            "weighted network final fire conserved",
            weightedNetwork.points.attributes.fire,
            6
        );

        assertClose(
            "weighted network final attack conserved",
            weightedNetwork.points.abilities.attack,
            4
        );
    }


    // ============================================================
    // TEST 13
    // Edge Weight Metadata
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Edge Weight Metadata ---"
    );


    if (weightedNetwork) {

        var routerEdges =
            weightedNetwork.topology.outgoingEdges[
                "W_ROUTER"
            ];


        assertEqual(
            "router outgoing edge count",
            routerEdges.length,
            2
        );

        assertEqual(
            "router first edge target",
            routerEdges[0].to,
            "W_B"
        );

        assertClose(
            "router first edge weight",
            routerEdges[0].weight,
            3
        );

        assertEqual(
            "router second edge target",
            routerEdges[1].to,
            "W_C"
        );

        assertClose(
            "router second edge weight",
            routerEdges[1].weight,
            1
        );
    }


    // ============================================================
    // TEST 14
    // Weight Is Ignored by Equal Router
    //
    // Source 自己 routingRule = equal。
    //
    // 即便 edge 写：
    //
    // 100 : 1
    //
    // 也仍然应该均分。
    //
    // 证明 weight 不是 Graph 的全局规则，
    // 而只是 Weighted Routing Rule 的参数。
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Equal Ignores Edge Weight ---"
    );


    var equalWeightNetwork =
        calculator.calculateNetwork(

            [
                {
                    id: "E_SOURCE",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "E_A",
                    buildingType:
                        "prototype_relay"
                },

                {
                    id: "E_B",
                    buildingType:
                        "prototype_relay"
                }
            ],

            [
                {
                    from: "E_SOURCE",
                    to: "E_A",
                    weight: 100
                },

                {
                    from: "E_SOURCE",
                    to: "E_B",
                    weight: 1
                }
            ]
        );


    assertTrue(
        "equal weight network returns result",
        equalWeightNetwork !== null
    );


    if (equalWeightNetwork) {

        var equalAHistory =
            findHistory(
                equalWeightNetwork,
                "E_A"
            );

        var equalBHistory =
            findHistory(
                equalWeightNetwork,
                "E_B"
            );


        assertClose(
            "equal ignores weight A fire",
            equalAHistory.input.attributes.fire,
            3
        );

        assertClose(
            "equal ignores weight B fire",
            equalBHistory.input.attributes.fire,
            3
        );

        assertClose(
            "equal ignores weight A attack",
            equalAHistory.input.abilities.attack,
            2
        );

        assertClose(
            "equal ignores weight B attack",
            equalBHistory.input.abilities.attack,
            2
        );
    }


    // ============================================================
    // TEST 15
    // Calculator + Broadcast
    //
    // Source
    //   ↓
    // Broadcaster
    //   ├──→ B
    //   └──→ C
    //
    // 两边都收到：
    //
    // 火6
    // 攻击4
    //
    // 最终：
    //
    // 火12
    // 攻击8
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Calculator Broadcast Integration ---"
    );


    var broadcastNetwork =
        calculator.calculateNetwork(

            [
                {
                    id: "B_SOURCE",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "B_ROUTER",
                    buildingType:
                        "prototype_broadcaster"
                },

                {
                    id: "B_A",
                    buildingType:
                        "prototype_relay"
                },

                {
                    id: "B_B",
                    buildingType:
                        "prototype_relay"
                }
            ],

            [
                {
                    from: "B_SOURCE",
                    to: "B_ROUTER"
                },

                {
                    from: "B_ROUTER",
                    to: "B_A"
                },

                {
                    from: "B_ROUTER",
                    to: "B_B"
                }
            ]
        );


    assertTrue(
        "broadcast network returns result",
        broadcastNetwork !== null
    );


    if (broadcastNetwork) {

        var broadcasterHistory =
            findHistory(
                broadcastNetwork,
                "B_ROUTER"
            );

        var broadcastAHistory =
            findHistory(
                broadcastNetwork,
                "B_A"
            );

        var broadcastBHistory =
            findHistory(
                broadcastNetwork,
                "B_B"
            );


        assertEqual(
            "broadcast history routing rule",
            broadcasterHistory.routingRule,
            "broadcast"
        );

        assertClose(
            "broadcast network A input fire",
            broadcastAHistory.input.attributes.fire,
            6
        );

        assertClose(
            "broadcast network B input fire",
            broadcastBHistory.input.attributes.fire,
            6
        );

        assertClose(
            "broadcast network final fire",
            broadcastNetwork.points.attributes.fire,
            12
        );

        assertClose(
            "broadcast network final attack",
            broadcastNetwork.points.abilities.attack,
            8
        );
    }


    // ============================================================
    // TEST 16
    // Network Rule + Routing Rule Combination
    //
    // Source：
    //
    // 火6
    // 攻击4
    //
    // Weighted Amplifier：
    //
    // 火 × 1.5
    //
    // → 火9
    //
    // 然后按 2:1：
    //
    // A 火6
    // B 火3
    //
    // 攻击不被 amplify：
    //
    // A 8/3
    // B 4/3
    //
    // 最终火总量 = 9
    // 最终攻击总量 = 4
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Network + Routing Combination ---"
    );


    var combinationNetwork =
        calculator.calculateNetwork(

            [
                {
                    id: "C_SOURCE",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "C_HYBRID",
                    buildingType:
                        "prototype_weighted_amplifier"
                },

                {
                    id: "C_A",
                    buildingType:
                        "prototype_relay"
                },

                {
                    id: "C_B",
                    buildingType:
                        "prototype_relay"
                }
            ],

            [
                {
                    from: "C_SOURCE",
                    to: "C_HYBRID"
                },

                {
                    from: "C_HYBRID",
                    to: "C_A",
                    weight: 2
                },

                {
                    from: "C_HYBRID",
                    to: "C_B",
                    weight: 1
                }
            ]
        );


    assertTrue(
        "combination network returns result",
        combinationNetwork !== null
    );


    if (combinationNetwork) {

        var hybridHistory =
            findHistory(
                combinationNetwork,
                "C_HYBRID"
            );

        var combinationA =
            findHistory(
                combinationNetwork,
                "C_A"
            );

        var combinationB =
            findHistory(
                combinationNetwork,
                "C_B"
            );


        assertEqual(
            "hybrid network rule",
            hybridHistory.networkRule,
            "amplify"
        );

        assertEqual(
            "hybrid routing rule",
            hybridHistory.routingRule,
            "weighted"
        );

        assertClose(
            "hybrid output fire",
            hybridHistory.output.attributes.fire,
            9
        );

        assertClose(
            "combination A fire",
            combinationA.input.attributes.fire,
            6
        );

        assertClose(
            "combination B fire",
            combinationB.input.attributes.fire,
            3
        );

        assertClose(
            "combination A attack",
            combinationA.input.abilities.attack,
            8 / 3
        );

        assertClose(
            "combination B attack",
            combinationB.input.abilities.attack,
            4 / 3
        );

        assertClose(
            "combination final fire",
            combinationNetwork.points.attributes.fire,
            9
        );

        assertClose(
            "combination final attack",
            combinationNetwork.points.abilities.attack,
            4
        );
    }


    // ============================================================
    // TEST 17
    // Empty Successor List
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Empty Successors ---"
    );


    var noRoutesEqual =
        routingRules.apply(
            "equal",
            directInput,
            [],
            {},
            {}
        );

    var noRoutesWeighted =
        routingRules.apply(
            "weighted",
            directInput,
            [],
            {},
            {}
        );

    var noRoutesBroadcast =
        routingRules.apply(
            "broadcast",
            directInput,
            [],
            {},
            {}
        );


    assertEqual(
        "equal empty successor count",
        noRoutesEqual.length,
        0
    );

    assertEqual(
        "weighted empty successor count",
        noRoutesWeighted.length,
        0
    );

    assertEqual(
        "broadcast empty successor count",
        noRoutesBroadcast.length,
        0
    );

    // ============================================================
    // TEST 18
    // Weight Robustness
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Weight Robustness ---"
    );


    assertClose(
        "undefined weight defaults to one",
        routingRules.normalizeWeight(
            undefined
        ),
        1
    );

    assertClose(
        "null weight defaults to one",
        routingRules.normalizeWeight(
            null
        ),
        1
    );

    assertClose(
        "negative weight clamps to zero",
        routingRules.normalizeWeight(
            -5
        ),
        0
    );

    assertClose(
        "NaN weight becomes zero",
        routingRules.normalizeWeight(
            0 / 0
        ),
        0
    );

    assertClose(
        "Infinity weight becomes zero",
        routingRules.normalizeWeight(
            1 / 0
        ),
        0
    );

    assertClose(
        "string weight becomes zero",
        routingRules.normalizeWeight(
            "3"
        ),
        0
    );


    // ============================================================
    // TEST 19
    // Invalid Weight Cannot Pollute Weighted Routing
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Invalid Weighted Routing ---"
    );


    var invalidWeighted =
        routingRules.apply(
            "weighted",

            directInput,

            [
                {
                    to: "A",
                    weight: 0 / 0
                },

                {
                    to: "B",
                    weight: 1
                }
            ],

            {},

            {}
        );


    assertClose(
        "NaN weighted route A gets zero",
        findRoute(
            invalidWeighted,
            "A"
        ).points.attributes.fire,
        0
    );

    assertClose(
        "NaN weighted route B gets full flow",
        findRoute(
            invalidWeighted,
            "B"
        ).points.attributes.fire,
        8
    );


    // ============================================================
    // TEST 20
    // All Invalid Weights Fall Back to Equal
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Invalid Weight Fallback ---"
    );


    var allInvalidWeighted =
        routingRules.apply(
            "weighted",

            directInput,

            [
                {
                    to: "A",
                    weight: 0 / 0
                },

                {
                    to: "B",
                    weight: 1 / 0
                }
            ],

            {},

            {}
        );


    assertClose(
        "all invalid fallback A fire",
        findRoute(
            allInvalidWeighted,
            "A"
        ).points.attributes.fire,
        4
    );

    assertClose(
        "all invalid fallback B fire",
        findRoute(
            allInvalidWeighted,
            "B"
        ).points.attributes.fire,
        4
    );


    // ============================================================
    // TEST 21
    // Calculator Rejects Invalid Edge Weights
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Invalid Edge Weight Rejection ---"
    );


    var invalidNaNEdge =
        calculator.calculateNetwork(

            [
                {
                    id: "IW_NAN_A",
                    buildingType:
                        "prototype_relay"
                },

                {
                    id: "IW_NAN_B",
                    buildingType:
                        "prototype_relay"
                }
            ],

            [
                {
                    from: "IW_NAN_A",
                    to: "IW_NAN_B",
                    weight: 0 / 0
                }
            ]
        );


    assertTrue(
        "calculator rejects NaN edge weight",
        invalidNaNEdge === null
    );


    var invalidInfinityEdge =
        calculator.calculateNetwork(

            [
                {
                    id: "IW_INF_A",
                    buildingType:
                        "prototype_relay"
                },

                {
                    id: "IW_INF_B",
                    buildingType:
                        "prototype_relay"
                }
            ],

            [
                {
                    from: "IW_INF_A",
                    to: "IW_INF_B",
                    weight: 1 / 0
                }
            ]
        );


    assertTrue(
        "calculator rejects Infinity edge weight",
        invalidInfinityEdge === null
    );


    var invalidStringEdge =
        calculator.calculateNetwork(

            [
                {
                    id: "IW_STR_A",
                    buildingType:
                        "prototype_relay"
                },

                {
                    id: "IW_STR_B",
                    buildingType:
                        "prototype_relay"
                }
            ],

            [
                {
                    from: "IW_STR_A",
                    to: "IW_STR_B",
                    weight: "3"
                }
            ]
        );


    assertTrue(
        "calculator rejects string edge weight",
        invalidStringEdge === null
    );


    // ============================================================
    // TEST 22
    // Route Validation
    // ============================================================

    console.log(
        "[Mahou Routing Test] --- Route Validation ---"
    );


    var duplicateRoutePoints = {
        attributes: {
            fire: 1
        },

        abilities: {}
    };


    var duplicateRoutesAccepted =
        calculator.validateRoutes(

            [
                {
                    to: "A",
                    points:
                        duplicateRoutePoints
                },

                {
                    to: "A",
                    points:
                        duplicateRoutePoints
                }
            ],

            [
                "A",
                "B"
            ]
        );


    assertTrue(
        "duplicate route target is rejected",
        duplicateRoutesAccepted === false
    );


    var uniqueRoutesAccepted =
        calculator.validateRoutes(

            [
                {
                    to: "A",
                    points:
                        duplicateRoutePoints
                },

                {
                    to: "B",
                    points:
                        duplicateRoutePoints
                }
            ],

            [
                "A",
                "B"
            ]
        );


    assertTrue(
        "unique route targets are accepted",
        uniqueRoutesAccepted === true
    );

    // ============================================================
    // FINAL SUMMARY
    // ============================================================

    console.log(
        "[Mahou Routing Test] ========================================"
    );

    console.log(
        "[Mahou Routing Test] TEST SUMMARY: PASS=" +
        passCount +
        " FAIL=" +
        failCount
    );


    if (failCount === 0) {
        console.log(
            "[Mahou Routing Test] ALL TESTS PASSED"
        );
    }
    else {
        console.error(
            "[Mahou Routing Test] SOME TESTS FAILED"
        );
    }


    console.log(
        "[Mahou Routing Test] Routing tests finished."
    );

    console.log(
        "[Mahou Routing Test] ========================================"
    );

});