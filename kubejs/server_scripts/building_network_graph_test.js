// Mahou Building Network
// Directed Graph / DAG Tests
//
// 专门测试：
//
// - 分叉
// - 汇聚
// - 分叉后汇聚
// - 三路分叉
// - Network Rule 在分支中的工作
// - 汇聚后 Network Rule 的工作
// - 入度 / 出度 / 深度
// - 点数守恒
// - 闭环拒绝
// - 重复边拒绝
// - 自环拒绝
// - 断开网络拒绝
//
// 与 building_network_test.js 分开，
// 避免基础规则测试文件继续无限膨胀。

LevelEvents.loaded(function (event) {

    var level = event.level;
    var dimensionId = String(level.dimension);

    if (dimensionId !== "minecraft:overworld") {
        return;
    }

    if (global.MahouBuildingNetworkGraphTestRan) {
        return;
    }

    global.MahouBuildingNetworkGraphTestRan = true;


    // ============================================================
    // Test State
    // ============================================================

    var passCount = 0;
    var failCount = 0;


    function logPass(message) {
        passCount++;

        console.log(
            "[Mahou Graph Test] PASS: " +
            message
        );
    }


    function logFail(message) {
        failCount++;

        console.error(
            "[Mahou Graph Test] FAIL: " +
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


    console.log(
        "[Mahou Graph Test] ========================================"
    );

    console.log(
        "[Mahou Graph Test] Starting DAG tests..."
    );


    var calculator =
        global.MahouNetworkCalculator;


    if (!calculator) {
        logFail(
            "MahouNetworkCalculator is not loaded"
        );

        return;
    }


    // ============================================================
    // TEST 1
    // scalePoints
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- scalePoints ---"
    );


    var scaleInput = {
        attributes: {
            fire: 10,
            wind: 6
        },

        abilities: {
            attack: 4
        }
    };


    var scaled =
        calculator.scalePoints(
            scaleInput,
            0.5
        );


    assertClose(
        "scale fire",
        scaled.attributes.fire,
        5
    );

    assertClose(
        "scale wind",
        scaled.attributes.wind,
        3
    );

    assertClose(
        "scale attack",
        scaled.abilities.attack,
        2
    );

    assertClose(
        "scale does not mutate input",
        scaleInput.attributes.fire,
        10
    );


    // ============================================================
    // TEST 2
    // Pure Split
    //
    //       B
    //      ↗
    // A
    //      ↘
    //       C
    //
    // 三个节点全部 prototype_source。
    //
    // A：
    // 火6 攻击4
    //
    // 分成两路：
    //
    // 每路：
    // 火3 攻击2
    //
    // B/C 各自再加：
    // 火6 攻击4
    //
    // 所以每个终端：
    // 火9 攻击6
    //
    // 两个终端合计：
    // 火18 攻击12
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Pure Split ---"
    );


    var splitResult =
        calculator.calculateNetwork(

            [
                {
                    id: "S_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "S_B",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "S_C",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "S_A",
                    to: "S_B"
                },

                {
                    from: "S_A",
                    to: "S_C"
                }
            ]

        );


    assertTrue(
        "split returns result",
        splitResult !== null
    );


    if (splitResult) {

        assertEqual(
            "split start count",
            splitResult.starts.length,
            1
        );

        assertEqual(
            "split start",
            splitResult.starts[0],
            "S_A"
        );

        assertEqual(
            "split terminal count",
            splitResult.terminals.length,
            2
        );

        assertClose(
            "split final fire",
            splitResult.points.attributes.fire,
            18
        );

        assertClose(
            "split final attack",
            splitResult.points.abilities.attack,
            12
        );


        var splitA =
            findHistory(
                splitResult,
                "S_A"
            );

        var splitB =
            findHistory(
                splitResult,
                "S_B"
            );

        var splitC =
            findHistory(
                splitResult,
                "S_C"
            );


        assertEqual(
            "split A outdegree",
            splitA.outdegree,
            2
        );

        assertClose(
            "split B input fire",
            splitB.input.attributes.fire,
            3
        );

        assertClose(
            "split C input fire",
            splitC.input.attributes.fire,
            3
        );

        assertClose(
            "split B input attack",
            splitB.input.abilities.attack,
            2
        );

        assertClose(
            "split C input attack",
            splitC.input.abilities.attack,
            2
        );
    }


    // ============================================================
    // TEST 3
    // Pure Merge
    //
    // A →
    //      → C
    // B →
    //
    // A/B 都：
    // 火6 攻击4
    //
    // C 输入：
    // 火12 攻击8
    //
    // C 自己再：
    // 火6 攻击4
    //
    // 最终：
    // 火18 攻击12
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Pure Merge ---"
    );


    var mergeResult =
        calculator.calculateNetwork(

            [
                {
                    id: "M_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "M_B",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "M_C",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "M_A",
                    to: "M_C"
                },

                {
                    from: "M_B",
                    to: "M_C"
                }
            ]

        );


    assertTrue(
        "merge returns result",
        mergeResult !== null
    );


    if (mergeResult) {

        assertEqual(
            "merge start count",
            mergeResult.starts.length,
            2
        );

        assertEqual(
            "merge terminal count",
            mergeResult.terminals.length,
            1
        );

        assertEqual(
            "merge terminal",
            mergeResult.terminals[0],
            "M_C"
        );

        assertClose(
            "merge final fire",
            mergeResult.points.attributes.fire,
            18
        );

        assertClose(
            "merge final attack",
            mergeResult.points.abilities.attack,
            12
        );


        var mergeC =
            findHistory(
                mergeResult,
                "M_C"
            );


        assertEqual(
            "merge C indegree",
            mergeC.indegree,
            2
        );

        assertClose(
            "merge C input fire",
            mergeC.input.attributes.fire,
            12
        );

        assertClose(
            "merge C input attack",
            mergeC.input.abilities.attack,
            8
        );
    }


    // ============================================================
    // TEST 4
    // Diamond
    //
    //       B
    //      ↗ ↘
    // A        D
    //      ↘ ↗
    //       C
    //
    // 四个节点全部 Source。
    //
    // 所有基础点总和：
    //
    // 火：
    // 4 × 6 = 24
    //
    // 攻击：
    // 4 × 4 = 16
    //
    // 图结构本身必须守恒。
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Diamond ---"
    );


    var diamondResult =
        calculator.calculateNetwork(

            [
                {
                    id: "D_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "D_B",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "D_C",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "D_D",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "D_A",
                    to: "D_B"
                },

                {
                    from: "D_A",
                    to: "D_C"
                },

                {
                    from: "D_B",
                    to: "D_D"
                },

                {
                    from: "D_C",
                    to: "D_D"
                }
            ]

        );


    assertTrue(
        "diamond returns result",
        diamondResult !== null
    );


    if (diamondResult) {

        assertClose(
            "diamond final fire",
            diamondResult.points.attributes.fire,
            24
        );

        assertClose(
            "diamond final attack",
            diamondResult.points.abilities.attack,
            16
        );


        var diamondA =
            findHistory(
                diamondResult,
                "D_A"
            );

        var diamondB =
            findHistory(
                diamondResult,
                "D_B"
            );

        var diamondC =
            findHistory(
                diamondResult,
                "D_C"
            );

        var diamondD =
            findHistory(
                diamondResult,
                "D_D"
            );


        assertEqual(
            "diamond A outdegree",
            diamondA.outdegree,
            2
        );

        assertEqual(
            "diamond D indegree",
            diamondD.indegree,
            2
        );

        assertClose(
            "diamond B input fire",
            diamondB.input.attributes.fire,
            3
        );

        assertClose(
            "diamond C input fire",
            diamondC.input.attributes.fire,
            3
        );

        assertClose(
            "diamond D input fire",
            diamondD.input.attributes.fire,
            18
        );

        assertClose(
            "diamond D input attack",
            diamondD.input.abilities.attack,
            12
        );

        assertEqual(
            "diamond A depth",
            diamondA.depth,
            0
        );

        assertEqual(
            "diamond B depth",
            diamondB.depth,
            1
        );

        assertEqual(
            "diamond C depth",
            diamondC.depth,
            1
        );

        assertEqual(
            "diamond D depth",
            diamondD.depth,
            2
        );
    }


    // ============================================================
    // TEST 5
    // Three-way Split
    //
    //       B
    //      /
    // A → C
    //      \
    //       D
    //
    // A 输出：
    // 火6
    //
    // 三等分：
    // 每路火2
    //
    // 四个 Source 总基础点：
    //
    // 火24
    // 攻击16
    //
    // 最终必须守恒。
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Three-way Split ---"
    );


    var tripleSplitResult =
        calculator.calculateNetwork(

            [
                {
                    id: "T_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "T_B",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "T_C",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "T_D",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "T_A",
                    to: "T_B"
                },

                {
                    from: "T_A",
                    to: "T_C"
                },

                {
                    from: "T_A",
                    to: "T_D"
                }
            ]

        );


    assertTrue(
        "three-way split returns result",
        tripleSplitResult !== null
    );


    if (tripleSplitResult) {

        assertClose(
            "three-way final fire",
            tripleSplitResult.points.attributes.fire,
            24
        );

        assertClose(
            "three-way final attack",
            tripleSplitResult.points.abilities.attack,
            16
        );

        assertEqual(
            "three-way terminal count",
            tripleSplitResult.terminals.length,
            3
        );


        var tripleA =
            findHistory(
                tripleSplitResult,
                "T_A"
            );

        var tripleB =
            findHistory(
                tripleSplitResult,
                "T_B"
            );

        var tripleC =
            findHistory(
                tripleSplitResult,
                "T_C"
            );

        var tripleD =
            findHistory(
                tripleSplitResult,
                "T_D"
            );


        assertEqual(
            "three-way A outdegree",
            tripleA.outdegree,
            3
        );

        assertClose(
            "three-way B input fire",
            tripleB.input.attributes.fire,
            2
        );

        assertClose(
            "three-way C input fire",
            tripleC.input.attributes.fire,
            2
        );

        assertClose(
            "three-way D input fire",
            tripleD.input.attributes.fire,
            2
        );


        assertClose(
            "three-way B input attack",
            tripleB.input.abilities.attack,
            4 / 3
        );

        assertClose(
            "three-way C input attack",
            tripleC.input.abilities.attack,
            4 / 3
        );

        assertClose(
            "three-way D input attack",
            tripleD.input.abilities.attack,
            4 / 3
        );
    }


    // ============================================================
    // TEST 6
    // Rule inside a Branch
    //
    //       Amplifier
    //      ↗
    // A
    //      ↘
    //       Source
    //
    // A Source：
    // 火6 攻击4
    //
    // 分叉：
    // 每路火3 攻击2
    //
    // Amplifier：
    //
    // 加雷3、攻速2
    // 火 ×1.25
    //
    // → 火3.75
    //
    // Source：
    //
    // 输入火3攻击2
    // + 自身火6攻击4
    //
    // → 火9攻击6
    //
    // 最终：
    //
    // 火 12.75
    // 雷 3
    //
    // 攻击 8
    // 攻速 2
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Rule in Branch ---"
    );


    var branchRuleResult =
        calculator.calculateNetwork(

            [
                {
                    id: "R_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "R_B",
                    buildingType:
                        "prototype_amplifier"
                },

                {
                    id: "R_C",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "R_A",
                    to: "R_B"
                },

                {
                    from: "R_A",
                    to: "R_C"
                }
            ]

        );


    assertTrue(
        "branch rule returns result",
        branchRuleResult !== null
    );


    if (branchRuleResult) {

        assertClose(
            "branch rule final fire",
            branchRuleResult.points.attributes.fire,
            12.75
        );

        assertClose(
            "branch rule final thunder",
            branchRuleResult.points.attributes.thunder,
            3
        );

        assertClose(
            "branch rule final attack",
            branchRuleResult.points.abilities.attack,
            8
        );

        assertClose(
            "branch rule final attackSpeed",
            branchRuleResult.points.abilities.attackSpeed,
            2
        );
    }


    // ============================================================
    // TEST 7
    // Rule after Merge
    //
    // Source →
    //          → Converter
    // Source →
    //
    // 两个 Source：
    //
    // 输入到 Converter：
    //
    // 火12
    // 攻击8
    //
    // Converter 自身：
    //
    // 风2
    // 移速2
    //
    // 再把50%火转换成风：
    //
    // 火6
    // 风8
    //
    // 最终：
    //
    // 火6
    // 风8
    // 攻击8
    // 移速2
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Rule after Merge ---"
    );


    var mergeRuleResult =
        calculator.calculateNetwork(

            [
                {
                    id: "C_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "C_B",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "C_C",
                    buildingType:
                        "prototype_converter"
                }
            ],

            [
                {
                    from: "C_A",
                    to: "C_C"
                },

                {
                    from: "C_B",
                    to: "C_C"
                }
            ]

        );


    assertTrue(
        "merge rule returns result",
        mergeRuleResult !== null
    );


    if (mergeRuleResult) {

        assertClose(
            "merge rule fire",
            mergeRuleResult.points.attributes.fire,
            6
        );

        assertClose(
            "merge rule wind",
            mergeRuleResult.points.attributes.wind,
            8
        );

        assertClose(
            "merge rule attack",
            mergeRuleResult.points.abilities.attack,
            8
        );

        assertClose(
            "merge rule movementSpeed",
            mergeRuleResult.points.abilities.movementSpeed,
            2
        );


        var converterHistory =
            findHistory(
                mergeRuleResult,
                "C_C"
            );


        assertEqual(
            "converter indegree after merge",
            converterHistory.indegree,
            2
        );

        assertClose(
            "converter input fire after merge",
            converterHistory.input.attributes.fire,
            12
        );
    }


    // ============================================================
    // TEST 8
    // Linear compatibility
    //
    // 新 calculateNetwork 仍然必须正确处理：
    //
    // A → B → C
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Linear Compatibility ---"
    );


    var linearResult =
        calculator.calculateNetwork(

            [
                {
                    id: "L_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "L_B",
                    buildingType:
                        "prototype_amplifier"
                },

                {
                    id: "L_C",
                    buildingType:
                        "prototype_converter"
                }
            ],

            [
                {
                    from: "L_A",
                    to: "L_B"
                },

                {
                    from: "L_B",
                    to: "L_C"
                }
            ]

        );


    assertTrue(
        "new calculator supports linear chain",
        linearResult !== null
    );


    if (linearResult) {

        assertClose(
            "new calculator linear fire",
            linearResult.points.attributes.fire,
            3.75
        );

        assertClose(
            "new calculator linear thunder",
            linearResult.points.attributes.thunder,
            3
        );

        assertClose(
            "new calculator linear wind",
            linearResult.points.attributes.wind,
            5.75
        );
    }


    // ============================================================
    // TEST 9
    // Invalid Cycle
    //
    // A → B
    // ↑   ↓
    // └───┘
    //
    // 当前版本必须拒绝。
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Cycle Rejection ---"
    );


    var cycleResult =
        calculator.calculateNetwork(

            [
                {
                    id: "CY_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "CY_B",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "CY_A",
                    to: "CY_B"
                },

                {
                    from: "CY_B",
                    to: "CY_A"
                }
            ]

        );


    assertTrue(
        "cycle is rejected",
        cycleResult === null
    );


    // ============================================================
    // TEST 10
    // Duplicate Edge
    //
    // A → B
    // A → B
    //
    // 应拒绝。
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Duplicate Edge Rejection ---"
    );


    var duplicateEdgeResult =
        calculator.calculateNetwork(

            [
                {
                    id: "DE_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "DE_B",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "DE_A",
                    to: "DE_B"
                },

                {
                    from: "DE_A",
                    to: "DE_B"
                }
            ]

        );


    assertTrue(
        "duplicate edge is rejected",
        duplicateEdgeResult === null
    );


    // ============================================================
    // TEST 11
    // Self-loop
    //
    // A → A
    //
    // 应拒绝。
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Self-loop Rejection ---"
    );


    var selfLoopResult =
        calculator.calculateNetwork(

            [
                {
                    id: "SL_A",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "SL_A",
                    to: "SL_A"
                }
            ]

        );


    assertTrue(
        "self-loop is rejected",
        selfLoopResult === null
    );


    // ============================================================
    // TEST 12
    // Disconnected Network
    //
    // A → B
    //
    // C → D
    //
    // 两张独立网络不应作为一次计算输入。
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Disconnected Network Rejection ---"
    );


    var disconnectedResult =
        calculator.calculateNetwork(

            [
                {
                    id: "DC_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "DC_B",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "DC_C",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "DC_D",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "DC_A",
                    to: "DC_B"
                },

                {
                    from: "DC_C",
                    to: "DC_D"
                }
            ]

        );


    assertTrue(
        "disconnected network is rejected",
        disconnectedResult === null
    );


    // ============================================================
    // TEST 13
    // Graph Analysis Metadata
    // ============================================================

    console.log(
        "[Mahou Graph Test] --- Graph Metadata ---"
    );


    var metadata =
        calculator.analyzeGraph(

            [
                {
                    id: "G_A",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "G_B",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "G_C",
                    buildingType:
                        "prototype_source"
                },

                {
                    id: "G_D",
                    buildingType:
                        "prototype_source"
                }
            ],

            [
                {
                    from: "G_A",
                    to: "G_B"
                },

                {
                    from: "G_A",
                    to: "G_C"
                },

                {
                    from: "G_B",
                    to: "G_D"
                },

                {
                    from: "G_C",
                    to: "G_D"
                }
            ]

        );


    assertTrue(
        "metadata analysis succeeds",
        metadata !== null
    );


    if (metadata) {

        assertEqual(
            "metadata start count",
            metadata.starts.length,
            1
        );

        assertEqual(
            "metadata terminal count",
            metadata.terminals.length,
            1
        );

        assertEqual(
            "metadata A outgoing",
            metadata.outgoing["G_A"].length,
            2
        );

        assertEqual(
            "metadata D incoming",
            metadata.incoming["G_D"].length,
            2
        );

        assertEqual(
            "metadata A depth",
            metadata.depths["G_A"],
            0
        );

        assertEqual(
            "metadata B depth",
            metadata.depths["G_B"],
            1
        );

        assertEqual(
            "metadata C depth",
            metadata.depths["G_C"],
            1
        );

        assertEqual(
            "metadata D depth",
            metadata.depths["G_D"],
            2
        );
    }


    // ============================================================
    // FINAL SUMMARY
    // ============================================================

    console.log(
        "[Mahou Graph Test] ========================================"
    );

    console.log(
        "[Mahou Graph Test] TEST SUMMARY: PASS=" +
        passCount +
        " FAIL=" +
        failCount
    );


    if (failCount === 0) {
        console.log(
            "[Mahou Graph Test] ALL TESTS PASSED"
        );
    }
    else {
        console.error(
            "[Mahou Graph Test] SOME TESTS FAILED"
        );
    }


    console.log(
        "[Mahou Graph Test] DAG tests finished."
    );

    console.log(
        "[Mahou Graph Test] ========================================"
    );

});