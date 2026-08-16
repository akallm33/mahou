// Mahou Building Network
// Network Rules
//
// 这个文件负责定义通用的“点数处理规则”。
// 它不知道具体是哪一个六十四卦建筑，也不直接修改玩家属性。
//
// 输入和输出统一使用：
//
// {
//     attributes: {
//         fire: 10,
//         wind: 3
//     },
//
//     abilities: {
//         attack: 5
//     }
// }

global.MahouNetworkRules = {

    // ============================================================
    // 工具函数
    // ============================================================

    // 创建一份新的 Point Result，避免直接修改原输入对象。
    clonePoints: function (input) {
        var result = {
            attributes: {},
            abilities: {}
        };

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


    // 根据类型取得对应点数容器。
    //
    // type = "attribute"
    // → attributes
    //
    // type = "ability"
    // → abilities
    getPointGroup: function (points, type) {
        if (type === "attribute") {
            return points.attributes;
        }

        if (type === "ability") {
            return points.abilities;
        }

        return null;
    },


    // ============================================================
    // PASS
    // ============================================================
    //
    // 不改变任何输入。
    //
    // 例如：
    //
    // 火 6
    // ↓
    // PASS
    // ↓
    // 火 6

    pass: function (input, params, context) {
        return this.clonePoints(input);
    },


    // ============================================================
    // AMPLIFY
    // ============================================================
    //
    // 放大某一种点数。
    //
    // 例如：
    //
    // 火 8
    // multiplier = 1.25
    //
    // ↓
    //
    // 火 10

    amplify: function (input, params, context) {
        var result = this.clonePoints(input);

        if (!params) {
            return result;
        }

        var group = this.getPointGroup(result, params.targetType);

        if (!group) {
            return result;
        }

        var target = params.target;
        var multiplier = params.multiplier;

        if (
            target === undefined ||
            multiplier === undefined
        ) {
            return result;
        }

        var current = group[target] || 0;

        group[target] = current * multiplier;

        return result;
    },


    // ============================================================
    // CONVERT
    // ============================================================
    //
    // 把一种点数的一部分转换成另一种点数。
    //
    // ratio = 0.5 表示转换 50%。
    //
    // 例如：
    //
    // 火 10
    //
    // source = fire
    // target = wind
    // ratio = 0.5
    //
    // ↓
    //
    // 火 5
    // 风 5

    convert: function (input, params, context) {
        var result = this.clonePoints(input);

        if (!params) {
            return result;
        }

        var sourceGroup =
            this.getPointGroup(
                result,
                params.sourceType
            );

        var targetGroup =
            this.getPointGroup(
                result,
                params.targetType
            );

        if (!sourceGroup || !targetGroup) {
            return result;
        }

        var source = params.source;
        var target = params.target;

        var conversionRatio =
            params.conversionRatio;

        var outputMultiplier =
            params.outputMultiplier;

        if (
            source === undefined ||
            target === undefined ||
            conversionRatio === undefined ||
            outputMultiplier === undefined
        ) {
            return result;
        }

        // 转换比例限制在 0 ~ 1。
        //
        // 0   = 不转换
        // 0.5 = 转换一半
        // 1   = 全部转换

        conversionRatio = Math.max(
            0,
            Math.min(
                1,
                conversionRatio
            )
        );


        // 输出倍率不允许为负。
        //
        // 0.5 = 亏损转换
        // 1.0 = 等量转换
        // 1.5 = 增益转换

        outputMultiplier = Math.max(
            0,
            outputMultiplier
        );


        var sourceAmount =
            sourceGroup[source] || 0;


        // 实际从源属性中取走多少点。

        var consumedAmount =
            sourceAmount *
            conversionRatio;


        // 最终产生多少目标点。

        var producedAmount =
            consumedAmount *
            outputMultiplier;


        // 扣除源点数。

        sourceGroup[source] =
            sourceAmount -
            consumedAmount;


        // 增加目标点数。

        targetGroup[target] =
            (targetGroup[target] || 0) +
            producedAmount;


        return result;
    },


    // ============================================================
    // APPLY
    // ============================================================
    //
    // Network Calculator 不需要知道具体算法。
    //
    // 它只调用：
    //
    // MahouNetworkRules.apply(
    //     "amplify",
    //     points,
    //     params,
    //     context
    // )

    apply: function (ruleName, input, params, context) {
        var rule = this[ruleName];

        if (typeof rule !== "function") {
            console.warn(
                "[Mahou] Unknown network rule: " + ruleName
            );

            return this.clonePoints(input);
        }

        return rule.call(
            this,
            input,
            params || {},
            context || {}
        );
    }

};