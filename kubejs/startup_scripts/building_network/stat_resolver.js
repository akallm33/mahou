// Mahou Building Network
// Stat Resolver
//
// 这个文件负责把最终“属性点 / 能力点”
// 转换成真正可以用于游戏的数值。
//
// 当前仍然是原型阶段：
// - 曲线参数只是测试值
// - 暂时不直接修改 Minecraft 玩家属性
// - 当前只处理非负点数
//
// 以后真正平衡时，只需要主要调整这里的曲线参数，
// 不需要修改 64 个建筑的数据。

global.MahouStatResolver = {

    // ============================================================
    // Prototype Stat Config
    // ============================================================
    //
    // 所有数值目前都只是用于验证系统。
    //
    // 公式：
    //
    // value = maxValue * points / (k + points)
    //
    // 当：
    //
    // points = k
    //
    // 时：
    //
    // value = maxValue / 2
    //
    // 因此：
    //
    // maxValue
    // → 理论软上限
    //
    // k
    // → 决定曲线多快接近软上限

    statConfigs: {

        // --------------------------------------------------------
        // 八种魔法属性
        // --------------------------------------------------------

        attributes: {

            light: {
                maxValue: 1.0,
                k: 20
            },

            dark: {
                maxValue: 1.0,
                k: 20
            },

            water: {
                maxValue: 1.0,
                k: 20
            },

            fire: {
                maxValue: 1.0,
                k: 20
            },

            thunder: {
                maxValue: 1.0,
                k: 20
            },

            wind: {
                maxValue: 1.0,
                k: 20
            },

            rock: {
                maxValue: 1.0,
                k: 20
            },

            resonance: {
                maxValue: 1.0,
                k: 20
            }
        },


        // --------------------------------------------------------
        // 能力点
        // --------------------------------------------------------
        //
        // 第一版只加入当前原型实际使用的三个能力。
        // 以后随着真实建筑设计再逐渐扩展。

        abilities: {

            attack: {
                maxValue: 1.0,
                k: 20
            },

            attackSpeed: {
                maxValue: 0.60,
                k: 15
            },

            movementSpeed: {
                maxValue: 0.40,
                k: 10
            }
        }
    },


    // ============================================================
    // Soft-cap Function
    // ============================================================

    softCap: function (points, maxValue, k) {

        // 第一阶段不处理负点数。
        points = Math.max(0, points || 0);

        if (points === 0) {
            return 0;
        }

        if (maxValue === undefined || k === undefined) {
            return 0;
        }

        if (k <= 0) {
            console.error(
                "[Mahou] Stat Resolver requires k > 0."
            );

            return 0;
        }

        return maxValue * points / (k + points);
    },


    // ============================================================
    // Resolve Single Stat
    // ============================================================

    resolveStat: function (
        groupName,
        statName,
        points
    ) {
        var groupConfig =
            this.statConfigs[groupName];

        if (!groupConfig) {
            console.warn(
                "[Mahou] Unknown stat group: " +
                groupName
            );

            return null;
        }

        var config =
            groupConfig[statName];

        if (!config) {
            console.warn(
                "[Mahou] No resolver config for " +
                groupName +
                "." +
                statName
            );

            return null;
        }

        var value = this.softCap(
            points,
            config.maxValue,
            config.k
        );

        return {
            points: points,
            value: value,
            maxValue: config.maxValue,
            k: config.k
        };
    },


    // ============================================================
    // Resolve Group
    // ============================================================

    resolveGroup: function (
        groupName,
        pointGroup
    ) {
        var result = {};

        if (!pointGroup) {
            return result;
        }

        for (var statName in pointGroup) {

            var resolved =
                this.resolveStat(
                    groupName,
                    statName,
                    pointGroup[statName]
                );

            if (resolved) {
                result[statName] = resolved;
            }
        }

        return result;
    },


    // ============================================================
    // Resolve Complete Point Result
    // ============================================================
    //
    // 输入：
    //
    // {
    //     attributes: {
    //         fire: 3.75,
    //         thunder: 3,
    //         wind: 5.75
    //     },
    //
    //     abilities: {
    //         attack: 4,
    //         attackSpeed: 2,
    //         movementSpeed: 2
    //     }
    // }
    //
    // 输出：
    //
    // {
    //     attributes: {
    //         fire: {
    //             points: 3.75,
    //             value: ...
    //         }
    //     },
    //
    //     abilities: {
    //         attack: {
    //             points: 4,
    //             value: ...
    //         }
    //     }
    // }

    resolve: function (pointResult) {
        pointResult = pointResult || {};

        return {

            attributes:
                this.resolveGroup(
                    "attributes",
                    pointResult.attributes || {}
                ),

            abilities:
                this.resolveGroup(
                    "abilities",
                    pointResult.abilities || {}
                )
        };
    }

};