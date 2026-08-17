// Mahou Building Network
// Network Routing Rules
//
// 这个文件负责：
//
// “一个建筑节点计算完成后，
//  它的输出应该如何发送到后继节点。”
//
// 它与 network_rules.js 分工不同：
//
// Network Rule:
// 修改点数本身。
//
// Routing Rule:
// 决定点数如何沿连接传播。
//
// 当前支持：
//
// equal
// weighted
// broadcast
//
// 默认规则：equal
//
// ------------------------------------------------------------
//
// equal:
//
// A 输出 火10
//
//       → B 火5
// A →
//       → C 火5
//
// 总量守恒。
//
//
// weighted:
//
// 两条边权重：
//
// A → B weight=3
// A → C weight=1
//
// 火10：
//
// B = 7.5
// C = 2.5
//
// 权重只决定比例，
// 总量仍然守恒。
//
//
// broadcast:
//
// A 输出 火10
//
//       → B 火10
// A →
//       → C 火10
//
// 总量从10变成20。
//
// 这是显式的点数复制行为，
// 只能由特定建筑主动使用。

global.MahouNetworkRoutingRules = {

    // ============================================================
    // Helpers
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


    scalePoints: function (
        input,
        factor
    ) {
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
    // Weight Normalization
    // ============================================================
    //
    // Routing Rule 直接被调用时也必须防止：
    //
    // NaN
    // Infinity
    // -Infinity
    // string
    //
    // 污染整个点数流。
    //
    // undefined / null：
    // 视为没有填写 weight，默认 1。
    //
    // 非法显式值：
    // 按 0 处理。
    //
    // 负数：
    // clamp 到 0。

    normalizeWeight: function (weight) {

        if (
            weight === undefined ||
            weight === null
        ) {
            return 1;
        }

        if (
            typeof weight !== "number" ||
            !isFinite(weight)
        ) {
            return 0;
        }

        return Math.max(
            0,
            weight
        );
    },

    // ============================================================
    // EQUAL
    // ============================================================
    //
    // 默认守恒均分。
    //
    // successors:
    //
    // [
    //     { to: "B" },
    //     { to: "C" }
    // ]
    //
    // ↓
    //
    // 每路得到 1/2。

    equal: function (
        output,
        successors,
        params,
        context
    ) {
        var routes = [];

        if (
            !successors ||
            successors.length === 0
        ) {
            return routes;
        }

        var factor =
            1.0 /
            successors.length;

        for (
            var i = 0;
            i < successors.length;
            i++
        ) {
            routes.push({
                to:
                    successors[i].to,

                points:
                    this.scalePoints(
                        output,
                        factor
                    )
            });
        }

        return routes;
    },


    // ============================================================
    // WEIGHTED
    // ============================================================
    //
    // 按边权重分配。
    //
    // 例如：
    //
    // [
    //     {
    //         to: "B",
    //         weight: 3
    //     },
    //
    //     {
    //         to: "C",
    //         weight: 1
    //     }
    // ]
    //
    // 总权重 = 4
    //
    // B = 3/4
    // C = 1/4
    //
    // 权重必须 >= 0。
    //
    // 没写 weight：
    // 默认按 1 计算。
    //
    // 如果所有权重最终都是0，
    // 则退回 equal，
    // 避免整条网络的点数意外消失。

    weighted: function (
        output,
        successors,
        params,
        context
    ) {
        if (
            !successors ||
            successors.length === 0
        ) {
            return [];
        }

        var totalWeight = 0;
        var weights = [];

        for (
            var i = 0;
            i < successors.length;
            i++
        ) {
            var weight =
                this.normalizeWeight(
                    successors[i].weight
                );

            weights.push(
                weight
            );

            totalWeight +=
                weight;
        }


        // 所有权重无效或为 0：
        //
        // 回退到安全的 equal，
        // 避免网络流量意外全部消失。

        if (totalWeight <= 0) {
            return this.equal(
                output,
                successors,
                params,
                context
            );
        }


        var routes = [];

        for (
            var routeIndex = 0;
            routeIndex <
                successors.length;
            routeIndex++
        ) {
            var factor =
                weights[
                    routeIndex
                ] /
                totalWeight;

            routes.push({
                to:
                    successors[
                        routeIndex
                    ].to,

                points:
                    this.scalePoints(
                        output,
                        factor
                    )
            });
        }

        return routes;
    },


    // ============================================================
    // BROADCAST
    // ============================================================
    //
    // 把完整输出复制给每一条出边。
    //
    // 火10，两个后继：
    //
    // B = 火10
    // C = 火10
    //
    // 因此会主动创造额外总点数。
    //
    // 这是特殊能力，
    // 绝不能作为默认分叉方式。

    broadcast: function (
        output,
        successors,
        params,
        context
    ) {
        var routes = [];

        if (
            !successors ||
            successors.length === 0
        ) {
            return routes;
        }

        for (
            var i = 0;
            i < successors.length;
            i++
        ) {
            routes.push({
                to:
                    successors[i].to,

                points:
                    this.clonePoints(
                        output
                    )
            });
        }

        return routes;
    },


    // ============================================================
    // APPLY
    // ============================================================
    //
    // Calculator 统一调用：
    //
    // MahouNetworkRoutingRules.apply(
    //     "weighted",
    //     output,
    //     successors,
    //     params,
    //     context
    // )
    //
    // 未知规则：
    //
    // 自动回退 equal，
    // 保证默认仍然安全守恒。

    apply: function (
        ruleName,
        output,
        successors,
        params,
        context
    ) {
        ruleName =
            ruleName ||
            "equal";

        var rule =
            this[
                ruleName
            ];

        if (
            typeof rule !==
            "function"
        ) {
            console.warn(
                "[Mahou] Unknown routing rule: " +
                ruleName +
                ". Falling back to equal."
            );

            rule =
                this.equal;
        }

        return rule.call(
            this,
            output,
            successors || [],
            params || {},
            context || {}
        );
    }

};