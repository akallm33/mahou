// Mahou Building Network
// Building Definitions
//
// 这个文件只负责描述“建筑是什么”。
// 不负责网络计算，也不直接修改玩家属性。
//
// 当前仍然全部是 Prototype，
// 用于验证建筑网络底层架构。
//
// 一个建筑目前可以包含两类网络行为：
//
// 1. networkRule
//    修改经过节点的点数。
//
// 2. routingRule
//    决定节点输出如何沿出边传播。
//
// 正式六十四卦建筑以后再逐步替换这些测试定义。

global.MahouBuildingDefinitions = {

    // ============================================================
    // Prototype A
    // Source
    // ============================================================

    prototype_source: {
        id: "prototype_source",
        prototype: true,

        name: "Prototype Source",

        hexagramNumber: null,
        hexagramName: null,

        upperTrigram: null,
        lowerTrigram: null,

        upperElement: null,
        lowerElement: null,

        sourceMod: "mahou",
        structureId: null,
        bossId: null,

        // --------------------------------------------------------
        // 基础点数
        // --------------------------------------------------------

        attributePoints: {
            fire: 6
        },

        abilityPoints: {
            attack: 4
        },

        // --------------------------------------------------------
        // Node Rule
        // --------------------------------------------------------

        networkRole: "source",

        networkRule: "pass",

        networkParams: {},

        // --------------------------------------------------------
        // Routing Rule
        // --------------------------------------------------------

        routingRule: "equal",

        routingParams: {},

        // --------------------------------------------------------
        // Text
        // --------------------------------------------------------

        effectTag: "产点",

        introText:
            "“其始也简，其出也直，因势而行。”",

        description:
            "测试建筑。产生火属性点和攻击能力点，并将其正常送入网络。"
    },


    // ============================================================
    // Prototype B
    // Amplifier
    // ============================================================

    prototype_amplifier: {
        id: "prototype_amplifier",
        prototype: true,

        name: "Prototype Amplifier",

        hexagramNumber: null,
        hexagramName: null,

        upperTrigram: null,
        lowerTrigram: null,

        upperElement: null,
        lowerElement: null,

        sourceMod: "mahou",
        structureId: null,
        bossId: null,

        attributePoints: {
            thunder: 3
        },

        abilityPoints: {
            attackSpeed: 2
        },

        networkRole: "amplifier",

        networkRule: "amplify",

        networkParams: {
            targetType: "attribute",
            target: "fire",
            multiplier: 1.25
        },

        routingRule: "equal",

        routingParams: {},

        effectTag: "增幅",

        introText:
            "“势有所承，则因其来而益之。”",

        description:
            "测试建筑。使经过该节点的火属性点提高 25%。"
    },


    // ============================================================
    // Prototype C
    // Converter
    // ============================================================

    prototype_converter: {
        id: "prototype_converter",
        prototype: true,

        name: "Prototype Converter",

        hexagramNumber: null,
        hexagramName: null,

        upperTrigram: null,
        lowerTrigram: null,

        upperElement: null,
        lowerElement: null,

        sourceMod: "mahou",
        structureId: null,
        bossId: null,

        attributePoints: {
            wind: 2
        },

        abilityPoints: {
            movementSpeed: 2
        },

        networkRole: "converter",

        networkRule: "convert",

        networkParams: {
            sourceType: "attribute",
            source: "fire",

            targetType: "attribute",
            target: "wind",

            conversionRatio: 0.50,
            outputMultiplier: 1.00
        },

        routingRule: "equal",

        routingParams: {},

        effectTag: "转换",

        introText:
            "“物极则迁，因其所来，而易其所往。”",

        description:
            "测试建筑。把经过该节点的部分火属性点转换为风属性点。"
    },


    // ============================================================
    // Prototype D
    // Neutral Relay
    // ============================================================
    //
    // 不产点。
    // 不修改点数。
    // 默认均分。
    //
    // 主要用作测试中的纯净终端和中继节点。

    prototype_relay: {
        id: "prototype_relay",
        prototype: true,

        name: "Prototype Relay",

        hexagramNumber: null,
        hexagramName: null,

        upperTrigram: null,
        lowerTrigram: null,

        upperElement: null,
        lowerElement: null,

        sourceMod: "mahou",
        structureId: null,
        bossId: null,

        attributePoints: {},

        abilityPoints: {},

        networkRole: "relay",

        networkRule: "pass",

        networkParams: {},

        routingRule: "equal",

        routingParams: {},

        effectTag: "中继",

        introText:
            "“受其所来，循其所往，不增不损。”",

        description:
            "测试建筑。不产生或修改点数，仅用于正常传递点数。"
    },


    // ============================================================
    // Prototype E
    // Weighted Router
    // ============================================================
    //
    // 不修改点数本身。
    //
    // 但分叉时使用各出边的 weight
    // 决定点数分配比例。
    //
    // 总量仍然守恒。

    prototype_weighted_router: {
        id: "prototype_weighted_router",
        prototype: true,

        name: "Prototype Weighted Router",

        hexagramNumber: null,
        hexagramName: null,

        upperTrigram: null,
        lowerTrigram: null,

        upperElement: null,
        lowerElement: null,

        sourceMod: "mahou",
        structureId: null,
        bossId: null,

        attributePoints: {},

        abilityPoints: {},

        networkRole: "splitter",

        networkRule: "pass",

        networkParams: {},

        routingRule: "weighted",

        routingParams: {},

        effectTag: "权重分流",

        introText:
            "“势有轻重，则流有所偏；分而不失其总。”",

        description:
            "测试建筑。按照各出边权重分配输出点数，总点数保持不变。"
    },


    // ============================================================
    // Prototype F
    // Broadcaster
    // ============================================================
    //
    // 每个后继都得到完整输出。
    //
    // 这是显式的点数复制行为。
    //
    // 因此：
    //
    // 一个输入 → 两个输出
    //
    // 可以使流出的总点数增加一倍。
    //
    // 正式设计中必须谨慎使用。

    prototype_broadcaster: {
        id: "prototype_broadcaster",
        prototype: true,

        name: "Prototype Broadcaster",

        hexagramNumber: null,
        hexagramName: null,

        upperTrigram: null,
        lowerTrigram: null,

        upperElement: null,
        lowerElement: null,

        sourceMod: "mahou",
        structureId: null,
        bossId: null,

        attributePoints: {},

        abilityPoints: {},

        networkRole: "splitter",

        networkRule: "pass",

        networkParams: {},

        routingRule: "broadcast",

        routingParams: {},

        effectTag: "复制分流",

        introText:
            "“一源而众受，其流不减，因分而增。”",

        description:
            "测试建筑。把完整输出复制到每一条出边，因此会增加网络中的总流量。"
    },


    // ============================================================
    // Prototype G
    // Weighted Amplifier
    // ============================================================
    //
    // 用于专门验证：
    //
    // Network Rule
    // +
    // Routing Rule
    //
    // 能否在同一个建筑上组合。
    //
    // 先：
    //
    // 火 × 1.5
    //
    // 再：
    //
    // 按 edge.weight 分流。

    prototype_weighted_amplifier: {
        id: "prototype_weighted_amplifier",
        prototype: true,

        name: "Prototype Weighted Amplifier",

        hexagramNumber: null,
        hexagramName: null,

        upperTrigram: null,
        lowerTrigram: null,

        upperElement: null,
        lowerElement: null,

        sourceMod: "mahou",
        structureId: null,
        bossId: null,

        attributePoints: {},

        abilityPoints: {},

        networkRole: "hybrid",

        networkRule: "amplify",

        networkParams: {
            targetType: "attribute",
            target: "fire",
            multiplier: 1.50
        },

        routingRule: "weighted",

        routingParams: {},

        effectTag: "增幅分流",

        introText:
            "“先益其势，而后权其所往。”",

        description:
            "测试建筑。先使火属性点提高 50%，再按各出边权重分配。"
    }

};