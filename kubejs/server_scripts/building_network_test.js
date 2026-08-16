// Mahou Building Network
// Prototype + Regression Tests
//
// 当前测试覆盖：
//
// 1. Building Definitions
// 2. PASS Rule
// 3. AMPLIFY Rule
// 4. CONVERT Rule
// 5. Point Addition
// 6. Linear Network Calculation
// 7. Stat Resolver
// 8. Soft-cap Function
//
// 当前测试网络：
//
// Source → Amplifier → Converter
//
// 注意：
// 这是开发阶段测试脚本，不属于最终玩家玩法逻辑。

LevelEvents.loaded(function (event) {

    var level = event.level;
    var dimensionId = String(level.dimension);

    // 只在主世界加载时运行测试。
    if (dimensionId !== "minecraft:overworld") {
        return;
    }

    // 防止同一次游戏过程中重复运行。
    if (global.MahouBuildingNetworkPrototypeTestRan) {
        return;
    }

    global.MahouBuildingNetworkPrototypeTestRan = true;


    // ============================================================
    // Test State
    // ============================================================

    var passCount = 0;
    var failCount = 0;


    function logPass(message) {
        passCount++;

        console.log(
            "[Mahou Building Network Test] PASS: " +
            message
        );
    }


    function logFail(message) {
        failCount++;

        console.error(
            "[Mahou Building Network Test] FAIL: " +
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


    console.log(
        "[Mahou Building Network Test] ========================================"
    );

    console.log(
        "[Mahou Building Network Test] Starting prototype and regression tests..."
    );


    // ============================================================
    // Required Systems
    // ============================================================

    var calculator =
        global.MahouNetworkCalculator;

    var rules =
        global.MahouNetworkRules;

    var statResolver =
        global.MahouStatResolver;

    var definitions =
        global.MahouBuildingDefinitions;


    if (!calculator) {
        logFail(
            "MahouNetworkCalculator is not loaded"
        );

        return;
    }


    if (!rules) {
        logFail(
            "MahouNetworkRules is not loaded"
        );

        return;
    }


    if (!statResolver) {
        logFail(
            "MahouStatResolver is not loaded"
        );

        return;
    }


    if (!definitions) {
        logFail(
            "MahouBuildingDefinitions is not loaded"
        );

        return;
    }


    // ============================================================
    // TEST GROUP 1
    // Building Definitions
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- Building Definition Tests ---"
    );


    var sourceDefinition =
        calculator.getBuildingDefinition(
            "prototype_source"
        );


    assertTrue(
        "prototype_source definition exists",
        sourceDefinition !== null
    );


    if (sourceDefinition) {

        assertEqual(
            "source definition id",
            sourceDefinition.id,
            "prototype_source"
        );

        assertClose(
            "source fire points",
            sourceDefinition.attributePoints.fire,
            6
        );

        assertClose(
            "source attack points",
            sourceDefinition.abilityPoints.attack,
            4
        );

        assertEqual(
            "source network rule",
            sourceDefinition.networkRule,
            "pass"
        );
    }


    var amplifierDefinition =
        calculator.getBuildingDefinition(
            "prototype_amplifier"
        );


    assertTrue(
        "prototype_amplifier definition exists",
        amplifierDefinition !== null
    );


    if (amplifierDefinition) {

        assertEqual(
            "amplifier network rule",
            amplifierDefinition.networkRule,
            "amplify"
        );

        assertClose(
            "amplifier multiplier",
            amplifierDefinition.networkParams.multiplier,
            1.25
        );
    }


    var converterDefinition =
        calculator.getBuildingDefinition(
            "prototype_converter"
        );


    assertTrue(
        "prototype_converter definition exists",
        converterDefinition !== null
    );


    if (converterDefinition) {

        assertEqual(
            "converter network rule",
            converterDefinition.networkRule,
            "convert"
        );

        assertClose(
            "converter conversionRatio",
            converterDefinition.networkParams.conversionRatio,
            0.5
        );

        assertClose(
            "converter outputMultiplier",
            converterDefinition.networkParams.outputMultiplier,
            1.0
        );
    }


    // ============================================================
    // TEST GROUP 2
    // PASS Rule
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- PASS Rule Tests ---"
    );


    var passInput = {

        attributes: {
            fire: 10,
            wind: 4
        },

        abilities: {
            attack: 3
        }
    };


    var passOutput =
        rules.apply(
            "pass",
            passInput,
            {},
            {}
        );


    assertClose(
        "PASS keeps fire",
        passOutput.attributes.fire,
        10
    );

    assertClose(
        "PASS keeps wind",
        passOutput.attributes.wind,
        4
    );

    assertClose(
        "PASS keeps attack",
        passOutput.abilities.attack,
        3
    );


    // 检查 PASS 返回的是独立数据，
    // 而不是直接修改原输入。

    passOutput.attributes.fire = 999;


    assertClose(
        "PASS does not mutate input",
        passInput.attributes.fire,
        10
    );


    // ============================================================
    // TEST GROUP 3
    // AMPLIFY Rule
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- AMPLIFY Rule Tests ---"
    );


    // ------------------------------------------------------------
    // Attribute amplification
    //
    // 火 10 × 1.5 = 15
    // ------------------------------------------------------------

    var amplifyAttributeInput = {

        attributes: {
            fire: 10
        },

        abilities: {}
    };


    var amplifyAttributeOutput =
        rules.apply(
            "amplify",

            amplifyAttributeInput,

            {
                targetType: "attribute",
                target: "fire",
                multiplier: 1.5
            },

            {}
        );


    assertClose(
        "AMPLIFY attribute fire",
        amplifyAttributeOutput.attributes.fire,
        15
    );


    assertClose(
        "AMPLIFY does not mutate input",
        amplifyAttributeInput.attributes.fire,
        10
    );


    // ------------------------------------------------------------
    // Ability amplification
    //
    // 攻击 8 × 1.25 = 10
    // ------------------------------------------------------------

    var amplifyAbilityOutput =
        rules.apply(
            "amplify",

            {
                attributes: {},

                abilities: {
                    attack: 8
                }
            },

            {
                targetType: "ability",
                target: "attack",
                multiplier: 1.25
            },

            {}
        );


    assertClose(
        "AMPLIFY ability attack",
        amplifyAbilityOutput.abilities.attack,
        10
    );


    // ------------------------------------------------------------
    // multiplier = 1
    // ------------------------------------------------------------

    var amplifyOneOutput =
        rules.apply(
            "amplify",

            {
                attributes: {
                    thunder: 7
                },

                abilities: {}
            },

            {
                targetType: "attribute",
                target: "thunder",
                multiplier: 1.0
            },

            {}
        );


    assertClose(
        "AMPLIFY x1 keeps value",
        amplifyOneOutput.attributes.thunder,
        7
    );


    // ------------------------------------------------------------
    // 输入中不存在目标属性。
    //
    // 当前定义下等价于：
    //
    // 0 × multiplier = 0
    // ------------------------------------------------------------

    var amplifyMissingOutput =
        rules.apply(
            "amplify",

            {
                attributes: {},

                abilities: {}
            },

            {
                targetType: "attribute",
                target: "fire",
                multiplier: 2.0
            },

            {}
        );


    assertClose(
        "AMPLIFY missing value remains zero",
        amplifyMissingOutput.attributes.fire,
        0
    );


    // ============================================================
    // TEST GROUP 4
    // CONVERT Rule
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- CONVERT Rule Tests ---"
    );


    // ------------------------------------------------------------
    // 4.1
    //
    // 10 火 → 10 风
    //
    // 全部转换
    // 等量输出
    // ------------------------------------------------------------

    var convertEqual =
        rules.apply(
            "convert",

            {
                attributes: {
                    fire: 10
                },

                abilities: {}
            },

            {
                sourceType: "attribute",
                source: "fire",

                targetType: "attribute",
                target: "wind",

                conversionRatio: 1.0,
                outputMultiplier: 1.0
            },

            {}
        );


    assertClose(
        "CONVERT equal fire",
        convertEqual.attributes.fire,
        0
    );

    assertClose(
        "CONVERT equal wind",
        convertEqual.attributes.wind,
        10
    );


    // ------------------------------------------------------------
    // 4.2
    //
    // 10 火 → 15 风
    //
    // 全部转换
    // 1.5倍输出
    // ------------------------------------------------------------

    var convertAmplified =
        rules.apply(
            "convert",

            {
                attributes: {
                    fire: 10
                },

                abilities: {}
            },

            {
                sourceType: "attribute",
                source: "fire",

                targetType: "attribute",
                target: "wind",

                conversionRatio: 1.0,
                outputMultiplier: 1.5
            },

            {}
        );


    assertClose(
        "CONVERT amplified fire",
        convertAmplified.attributes.fire,
        0
    );

    assertClose(
        "CONVERT amplified wind",
        convertAmplified.attributes.wind,
        15
    );


    // ------------------------------------------------------------
    // 4.3
    //
    // 10 火
    //
    // 转换 50%
    // 输出倍率 1.2
    //
    // 消耗 5 火
    // 生成 6 风
    //
    // 最终：
    // 火 5
    // 风 6
    // ------------------------------------------------------------

    var convertPartialAmplified =
        rules.apply(
            "convert",

            {
                attributes: {
                    fire: 10
                },

                abilities: {}
            },

            {
                sourceType: "attribute",
                source: "fire",

                targetType: "attribute",
                target: "wind",

                conversionRatio: 0.5,
                outputMultiplier: 1.2
            },

            {}
        );


    assertClose(
        "CONVERT partial amplified fire",
        convertPartialAmplified.attributes.fire,
        5
    );

    assertClose(
        "CONVERT partial amplified wind",
        convertPartialAmplified.attributes.wind,
        6
    );


    // ------------------------------------------------------------
    // 4.4
    //
    // 10 火 → 5 风
    //
    // 全转换
    // 输出效率 50%
    // ------------------------------------------------------------

    var convertLossy =
        rules.apply(
            "convert",

            {
                attributes: {
                    fire: 10
                },

                abilities: {}
            },

            {
                sourceType: "attribute",
                source: "fire",

                targetType: "attribute",
                target: "wind",

                conversionRatio: 1.0,
                outputMultiplier: 0.5
            },

            {}
        );


    assertClose(
        "CONVERT lossy fire",
        convertLossy.attributes.fire,
        0
    );

    assertClose(
        "CONVERT lossy wind",
        convertLossy.attributes.wind,
        5
    );


    // ------------------------------------------------------------
    // 4.5
    //
    // 属性 → 能力
    //
    // 岩 10
    // 转换40%
    // 输出倍率2
    //
    // 岩 6
    // 防御 8
    // ------------------------------------------------------------

    var convertAttributeToAbility =
        rules.apply(
            "convert",

            {
                attributes: {
                    rock: 10
                },

                abilities: {}
            },

            {
                sourceType: "attribute",
                source: "rock",

                targetType: "ability",
                target: "defense",

                conversionRatio: 0.4,
                outputMultiplier: 2.0
            },

            {}
        );


    assertClose(
        "CONVERT attribute to ability rock",
        convertAttributeToAbility.attributes.rock,
        6
    );

    assertClose(
        "CONVERT attribute to ability defense",
        convertAttributeToAbility.abilities.defense,
        8
    );


    // ------------------------------------------------------------
    // 4.6
    //
    // 能力 → 属性
    //
    // 攻击10
    // 转换50%
    //
    // 攻击5
    // 火5
    // ------------------------------------------------------------

    var convertAbilityToAttribute =
        rules.apply(
            "convert",

            {
                attributes: {},

                abilities: {
                    attack: 10
                }
            },

            {
                sourceType: "ability",
                source: "attack",

                targetType: "attribute",
                target: "fire",

                conversionRatio: 0.5,
                outputMultiplier: 1.0
            },

            {}
        );


    assertClose(
        "CONVERT ability to attribute attack",
        convertAbilityToAttribute.abilities.attack,
        5
    );

    assertClose(
        "CONVERT ability to attribute fire",
        convertAbilityToAttribute.attributes.fire,
        5
    );


    // ------------------------------------------------------------
    // 4.7
    //
    // ratio > 1
    //
    // 自动限制到1
    // ------------------------------------------------------------

    var convertRatioHigh =
        rules.apply(
            "convert",

            {
                attributes: {
                    fire: 10
                },

                abilities: {}
            },

            {
                sourceType: "attribute",
                source: "fire",

                targetType: "attribute",
                target: "wind",

                conversionRatio: 2.0,
                outputMultiplier: 1.0
            },

            {}
        );


    assertClose(
        "CONVERT ratio high clamp fire",
        convertRatioHigh.attributes.fire,
        0
    );

    assertClose(
        "CONVERT ratio high clamp wind",
        convertRatioHigh.attributes.wind,
        10
    );


    // ------------------------------------------------------------
    // 4.8
    //
    // ratio < 0
    //
    // 自动限制到0
    // ------------------------------------------------------------

    var convertRatioLow =
        rules.apply(
            "convert",

            {
                attributes: {
                    fire: 10
                },

                abilities: {}
            },

            {
                sourceType: "attribute",
                source: "fire",

                targetType: "attribute",
                target: "wind",

                conversionRatio: -1.0,
                outputMultiplier: 1.0
            },

            {}
        );


    assertClose(
        "CONVERT ratio low clamp fire",
        convertRatioLow.attributes.fire,
        10
    );

    assertClose(
        "CONVERT ratio low clamp wind",
        convertRatioLow.attributes.wind,
        0
    );


    // ------------------------------------------------------------
    // 4.9
    //
    // outputMultiplier < 0
    //
    // 自动限制到0。
    //
    // 源仍然被消耗，
    // 但不会产生目标点。
    // ------------------------------------------------------------

    var convertNegativeOutput =
        rules.apply(
            "convert",

            {
                attributes: {
                    fire: 10
                },

                abilities: {}
            },

            {
                sourceType: "attribute",
                source: "fire",

                targetType: "attribute",
                target: "wind",

                conversionRatio: 0.5,
                outputMultiplier: -2.0
            },

            {}
        );


    assertClose(
        "CONVERT negative output fire",
        convertNegativeOutput.attributes.fire,
        5
    );

    assertClose(
        "CONVERT negative output wind",
        convertNegativeOutput.attributes.wind,
        0
    );


    // ------------------------------------------------------------
    // 4.10
    //
    // 不修改输入对象。
    // ------------------------------------------------------------

    var convertImmutableInput = {

        attributes: {
            fire: 10
        },

        abilities: {}
    };


    rules.apply(
        "convert",

        convertImmutableInput,

        {
            sourceType: "attribute",
            source: "fire",

            targetType: "attribute",
            target: "wind",

            conversionRatio: 0.5,
            outputMultiplier: 1.0
        },

        {}
    );


    assertClose(
        "CONVERT does not mutate input",
        convertImmutableInput.attributes.fire,
        10
    );


    // ============================================================
    // TEST GROUP 5
    // addPoints
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- Point Addition Tests ---"
    );


    var addInputA = {

        attributes: {
            fire: 2
        },

        abilities: {
            attack: 1
        }
    };


    var addInputB = {

        attributes: {
            fire: 3,
            wind: 4
        },

        abilities: {
            attack: 2,
            movementSpeed: 5
        }
    };


    var addedPoints =
        calculator.addPoints(
            addInputA,
            addInputB
        );


    assertClose(
        "addPoints merges fire",
        addedPoints.attributes.fire,
        5
    );

    assertClose(
        "addPoints adds wind",
        addedPoints.attributes.wind,
        4
    );

    assertClose(
        "addPoints merges attack",
        addedPoints.abilities.attack,
        3
    );

    assertClose(
        "addPoints adds movementSpeed",
        addedPoints.abilities.movementSpeed,
        5
    );


    // 输入对象不能被修改。

    assertClose(
        "addPoints does not mutate first input fire",
        addInputA.attributes.fire,
        2
    );

    assertClose(
        "addPoints does not mutate first input attack",
        addInputA.abilities.attack,
        1
    );


    // ============================================================
    // TEST GROUP 6
    // Complete Linear Network
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- Linear Network Tests ---"
    );


    // Building Instances

    var networkNodes = [

        {
            id: "A",
            buildingType: "prototype_source"
        },

        {
            id: "B",
            buildingType: "prototype_amplifier"
        },

        {
            id: "C",
            buildingType: "prototype_converter"
        }

    ];


    // Directed Edges
    //
    // A → B → C

    var networkEdges = [

        {
            from: "A",
            to: "B"
        },

        {
            from: "B",
            to: "C"
        }

    ];


    var networkResult =
        calculator.calculateLinearNetwork(
            networkNodes,
            networkEdges
        );


    assertTrue(
        "linear network calculation returns result",
        networkResult !== null
    );


    if (networkResult) {

        assertEqual(
            "linear network first node",
            networkResult.order[0],
            "A"
        );

        assertEqual(
            "linear network second node",
            networkResult.order[1],
            "B"
        );

        assertEqual(
            "linear network third node",
            networkResult.order[2],
            "C"
        );


        // --------------------------------------------------------
        // Expected:
        //
        // A:
        // 火 +6
        // 攻击 +4
        //
        // B:
        // 雷 +3
        // 攻速 +2
        //
        // 火：
        // 6 × 1.25 = 7.5
        //
        // C:
        // 风 +2
        // 移速 +2
        //
        // 50% 火 → 风
        //
        // 火：
        // 7.5 → 3.75
        //
        // 风：
        // 2 + 3.75 = 5.75
        // --------------------------------------------------------

        assertClose(
            "linear network fire",
            networkResult.points.attributes.fire,
            3.75
        );

        assertClose(
            "linear network thunder",
            networkResult.points.attributes.thunder,
            3
        );

        assertClose(
            "linear network wind",
            networkResult.points.attributes.wind,
            5.75
        );

        assertClose(
            "linear network attack",
            networkResult.points.abilities.attack,
            4
        );

        assertClose(
            "linear network attackSpeed",
            networkResult.points.abilities.attackSpeed,
            2
        );

        assertClose(
            "linear network movementSpeed",
            networkResult.points.abilities.movementSpeed,
            2
        );


        assertEqual(
            "linear network history length",
            networkResult.history.length,
            3
        );


        // --------------------------------------------------------
        // 第一个节点输出
        // --------------------------------------------------------

        assertClose(
            "history A output fire",
            networkResult.history[0].output.attributes.fire,
            6
        );


        // --------------------------------------------------------
        // 第二个节点输出
        // --------------------------------------------------------

        assertClose(
            "history B output fire",
            networkResult.history[1].output.attributes.fire,
            7.5
        );


        // --------------------------------------------------------
        // 第三个节点输出
        // --------------------------------------------------------

        assertClose(
            "history C output fire",
            networkResult.history[2].output.attributes.fire,
            3.75
        );

        assertClose(
            "history C output wind",
            networkResult.history[2].output.attributes.wind,
            5.75
        );
    }


    // ============================================================
    // TEST GROUP 7
    // Single-node Network
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- Single Node Network Test ---"
    );


    var singleNodeResult =
        calculator.calculateLinearNetwork(

            [
                {
                    id: "ONLY",
                    buildingType: "prototype_source"
                }
            ],

            []
        );


    assertTrue(
        "single node network returns result",
        singleNodeResult !== null
    );


    if (singleNodeResult) {

        assertClose(
            "single node fire",
            singleNodeResult.points.attributes.fire,
            6
        );

        assertClose(
            "single node attack",
            singleNodeResult.points.abilities.attack,
            4
        );

        assertEqual(
            "single node order length",
            singleNodeResult.order.length,
            1
        );
    }


    // ============================================================
    // TEST GROUP 8
    // Soft-cap Function
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- Soft-cap Tests ---"
    );


    // P = 0

    assertClose(
        "softCap zero",
        statResolver.softCap(
            0,
            1.0,
            20
        ),
        0
    );


    // P = K
    //
    // 正好达到 maxValue / 2。

    assertClose(
        "softCap at K",
        statResolver.softCap(
            20,
            1.0,
            20
        ),
        0.5
    );


    // P = 3K
    //
    // = 3/4 Vmax

    assertClose(
        "softCap at 3K",
        statResolver.softCap(
            60,
            1.0,
            20
        ),
        0.75
    );


    // 负点数当前按0处理。

    assertClose(
        "softCap negative points",
        statResolver.softCap(
            -10,
            1.0,
            20
        ),
        0
    );


    // 大量点数趋近上限但不达到。

    var hugeSoftCap =
        statResolver.softCap(
            100000,
            1.0,
            20
        );


    assertTrue(
        "softCap huge value below max",
        hugeSoftCap < 1.0
    );

    assertTrue(
        "softCap huge value approaches max",
        hugeSoftCap > 0.99
    );


    // ============================================================
    // TEST GROUP 9
    // Stat Resolver
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- Stat Resolver Tests ---"
    );


    // attack:
    //
    // P = 20
    // K = 20
    // max = 1
    //
    // → 0.5

    var resolvedAttack =
        statResolver.resolveStat(
            "abilities",
            "attack",
            20
        );


    assertClose(
        "resolver attack points",
        resolvedAttack.points,
        20
    );

    assertClose(
        "resolver attack value",
        resolvedAttack.value,
        0.5
    );


    // attackSpeed:
    //
    // P = 15
    // K = 15
    // max = 0.6
    //
    // → 0.3

    var resolvedAttackSpeed =
        statResolver.resolveStat(
            "abilities",
            "attackSpeed",
            15
        );


    assertClose(
        "resolver attackSpeed value",
        resolvedAttackSpeed.value,
        0.3
    );


    // movementSpeed:
    //
    // P = 10
    // K = 10
    // max = 0.4
    //
    // → 0.2

    var resolvedMovementSpeed =
        statResolver.resolveStat(
            "abilities",
            "movementSpeed",
            10
        );


    assertClose(
        "resolver movementSpeed value",
        resolvedMovementSpeed.value,
        0.2
    );


    // 火属性：
    //
    // P = K = 20
    //
    // → 0.5

    var resolvedFire =
        statResolver.resolveStat(
            "attributes",
            "fire",
            20
        );


    assertClose(
        "resolver fire value",
        resolvedFire.value,
        0.5
    );


    // ============================================================
    // TEST GROUP 10
    // Full Network → Stat Resolver
    // ============================================================

    console.log(
        "[Mahou Building Network Test] --- End-to-End Tests ---"
    );


    if (networkResult) {

        var finalStats =
            statResolver.resolve(
                networkResult.points
            );


        assertClose(
            "end-to-end fire points",
            finalStats.attributes.fire.points,
            3.75
        );


        assertClose(
            "end-to-end fire value",
            finalStats.attributes.fire.value,
            0.15789473684210525
        );


        assertClose(
            "end-to-end thunder value",
            finalStats.attributes.thunder.value,
            0.13043478260869565
        );


        assertClose(
            "end-to-end wind value",
            finalStats.attributes.wind.value,
            0.22330097087378642
        );


        assertClose(
            "end-to-end attack value",
            finalStats.abilities.attack.value,
            0.16666666666666666
        );


        assertClose(
            "end-to-end attackSpeed value",
            finalStats.abilities.attackSpeed.value,
            0.07058823529411765
        );


        assertClose(
            "end-to-end movementSpeed value",
            finalStats.abilities.movementSpeed.value,
            0.06666666666666667
        );
    }


    // ============================================================
    // Final Summary
    // ============================================================

    console.log(
        "[Mahou Building Network Test] ========================================"
    );

    console.log(
        "[Mahou Building Network Test] TEST SUMMARY: PASS=" +
        passCount +
        " FAIL=" +
        failCount
    );


    if (failCount === 0) {

        console.log(
            "[Mahou Building Network Test] ALL TESTS PASSED"
        );
    }
    else {

        console.error(
            "[Mahou Building Network Test] SOME TESTS FAILED"
        );
    }


    console.log(
        "[Mahou Building Network Test] Prototype and regression tests finished."
    );

    console.log(
        "[Mahou Building Network Test] ========================================"
    );

});