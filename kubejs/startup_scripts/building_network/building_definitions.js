// Mahou Building Network
// Building Definitions
//
// 这个文件只负责描述“建筑是什么”。
// 不负责网络计算，也不负责修改玩家属性。
//
// 当前只放少量测试建筑，用于验证建筑网络的整体计算流程。
// 等底层逻辑验证完成后，再逐步替换为正式的六十四卦建筑数据。

global.MahouBuildingDefinitions = {

    // ============================================================
    // Prototype A
    // 基础产点型建筑
    // ============================================================

    prototype_source: {
        id: "prototype_source",
        prototype: true,

        name: "Prototype Source",

        // 正式建筑以后填写六十四卦信息
        hexagramNumber: null,
        hexagramName: null,

        upperTrigram: null,
        lowerTrigram: null,

        upperElement: null,
        lowerElement: null,

        // 世界来源
        sourceMod: "mahou",
        structureId: null,
        bossId: null,

        // --------------------------------------------------------
        // 基础数值贡献
        // --------------------------------------------------------

        attributePoints: {
            fire: 6
        },

        abilityPoints: {
            attack: 4
        },

        // --------------------------------------------------------
        // 网络规则
        // --------------------------------------------------------

        networkRole: "source",

        networkRule: "pass",

        networkParams: {},

        // --------------------------------------------------------
        // 文本
        // --------------------------------------------------------

        effectTag: "产点",

        introText:
            "“其始也简，其出也直，因势而行。”",

        description:
            "测试建筑。产生火属性点和攻击能力点，并将其正常送入网络。"
    },


    // ============================================================
    // Prototype B
    // 增幅型建筑
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

        effectTag: "增幅",

        introText:
            "“势有所承，则因其来而益之。”",

        description:
            "测试建筑。使经过该节点的火属性点提高 25%。"
    },


    // ============================================================
    // Prototype C
    // 转换型建筑
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

            // 有多少比例的源点数参与转换。
            conversionRatio: 0.50,

            // 每 1 点被转换的源点数，
            // 最终生成多少目标点数。
            outputMultiplier: 1.00
        },

        effectTag: "转换",

        introText:
            "“物极则迁，因其所来，而易其所往。”",

        description:
            "测试建筑。把经过该节点的部分火属性点转换为风属性点。"
    }

};