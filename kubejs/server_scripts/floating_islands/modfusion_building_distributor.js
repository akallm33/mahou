console.log(
    "[ModFusion Distributor] Script loaded"
)


/*
 * =========================================================
 * Basic settings
 * =========================================================
 */

var MODFUSION_DISTRIBUTOR_DIMENSION_ID =
    "mahou:modfusion_dimension"


/*
 * 一个 Structure Region 的边长。
 *
 * 这一阶段只影响“建筑分配网格”。
 * 还没有真正生成建筑。
 */

var MODFUSION_STRUCTURE_REGION_SIZE =
    768


/*
 * 4 x 4 Structure Regions
 *
 * 组成一个 Super Region。
 *
 * 每个 Super Region 内进行一次完整的均衡洗牌。
 */

var MODFUSION_SUPER_REGION_SIDE =
    4


/*
 * 当前只有一半 Region 获得建筑槽。
 *
 * 4 x 4 = 16
 *
 * 50%：
 *
 * 8 个建筑槽
 * 8 个空槽
 *
 * 这样避免世界被大型建筑塞满。
 */

var MODFUSION_COMMON_ACTIVE_RATIO =
    0.50


/*
 * Distribution 算法版本。
 *
 * 未来如果我们修改算法，可以增加版本号。
 *
 * 一旦开始正式生成建筑，
 * Placement Record 会固定已经生成过的 Region，
 * 防止版本修改后旧建筑移动。
 */

var MODFUSION_DISTRIBUTION_VERSION =
    1


/*
 * 内部使用的空槽标记。
 */

var MODFUSION_DISTRIBUTOR_EMPTY_SLOT =
    "__MODFUSION_EMPTY__"


/*
 * =========================================================
 * Math helpers
 * =========================================================
 */

function modfusionDistributorClamp(
    value,
    minimum,
    maximum
)
{
    if(value < minimum)
    {
        return minimum
    }


    if(value > maximum)
    {
        return maximum
    }


    return value
}


/*
 * =========================================================
 * World seed
 * =========================================================
 *
 * 不直接把 Java long 转成 JS Number 后计算。
 *
 * World Seed 可能超过 JS 安全整数范围。
 *
 * 所以我们把 Seed 转成 String，
 * 再参与 32-bit hash。
 */

function getModfusionDistributorWorldSeed(
    level
)
{
    /*
     * -----------------------------------------------------
     * Direct level seed
     * -----------------------------------------------------
     */

    try
    {
        var levelSeed =
            level.getSeed()


        if(levelSeed != null)
        {
            return {
                value:
                    String(levelSeed),

                source:
                    "LEVEL"
            }
        }
    }
    catch(error)
    {
        /*
         * Ignore and try fallback.
         */
    }


    /*
     * -----------------------------------------------------
     * Overworld seed fallback
     * -----------------------------------------------------
     */

    try
    {
        var server =
            level.getServer()


        if(server != null)
        {
            var overworld =
                server.overworld()


            if(overworld != null)
            {
                var overworldSeed =
                    overworld.getSeed()


                if(overworldSeed != null)
                {
                    return {
                        value:
                            String(overworldSeed),

                        source:
                            "OVERWORLD"
                    }
                }
            }
        }
    }
    catch(error2)
    {
        /*
         * Ignore.
         */
    }


    /*
     * -----------------------------------------------------
     * Last-resort fallback
     * -----------------------------------------------------
     *
     * 即使 Seed API 在某个 KubeJS 环境下不可访问，
     * Distributor 仍然保持确定性，
     * 只是不同世界会拥有相同布局。
     */

    return {
        value:
            "0",

        source:
            "FALLBACK_ZERO"
    }
}


/*
 * =========================================================
 * Deterministic string hash
 * =========================================================
 *
 * 输出 unsigned 32-bit integer。
 *
 * 所有随机结果都来自：
 *
 * seed string
 * +
 * region coordinates
 *
 * 不使用 Math.random()。
 */

function modfusionDistributorHashString(
    text
)
{
    text =
        String(text)


    var hash =
        0x811C9DC5


    var i


    for(
        i = 0;
        i < text.length;
        i++
    )
    {
        hash ^=
            text.charCodeAt(i)


        /*
         * FNV-like 32-bit multiplication.
         */

        hash =
            (
                hash +
                (hash << 1) +
                (hash << 4) +
                (hash << 7) +
                (hash << 8) +
                (hash << 24)
            ) | 0
    }


    return hash >>> 0
}


/*
 * =========================================================
 * Deterministic PRNG
 * =========================================================
 *
 * xorshift32
 */

function createModfusionDistributorRandom(
    seed
)
{
    var state =
        seed >>> 0


    if(state === 0)
    {
        state =
            0x6D2B79F5
    }


    return function()
    {
        state ^=
            state << 13


        state ^=
            state >>> 17


        state ^=
            state << 5


        return (
            (state >>> 0) /
            4294967296
        )
    }
}


/*
 * =========================================================
 * Deterministic shuffle
 * =========================================================
 */

function shuffleModfusionDistributorArray(
    array,
    seed
)
{
    var result =
        array.slice()


    var random =
        createModfusionDistributorRandom(
            seed
        )


    var i


    for(
        i = result.length - 1;
        i > 0;
        i--
    )
    {
        var j =
            Math.floor(
                random() *
                (i + 1)
            )


        var temp =
            result[i]


        result[i] =
            result[j]


        result[j] =
            temp
    }


    return result
}


/*
 * =========================================================
 * Registry lookup
 * =========================================================
 *
 * Distributor 只获取：
 *
 * enabled
 * +
 * regionPolicy == COMMON
 *
 * 的建筑。
 *
 * DEDICATED Boss 建筑不会进入这里。
 */

function getModfusionCommonBuildingEntries()
{
    var result = []


    if(
        global.ModfusionBuildingRegistry ==
        null
    )
    {
        return result
    }


    var all =
        global.ModfusionBuildingRegistry.all


    if(all == null)
    {
        return result
    }


    var id


    for(id in all)
    {
        var config =
            all[id]


        if(config == null)
        {
            continue
        }


        if(config.enabled === false)
        {
            continue
        }


        if(
            String(config.regionPolicy) !==
            "COMMON"
        )
        {
            continue
        }


        /*
         * ---------------------------------------------
         * Optional distribution weight
         * ---------------------------------------------
         *
         * Registry 当前没有配置时：
         *
         * default = 1
         *
         * 因此：
         *
         * Naga = 1
         * Lich = 1
         *
         * 即 1 : 1。
         */

        var weight =
            Number(
                config.distributionWeight
            )


        if(
            isNaN(weight) ||
            weight <= 0
        )
        {
            weight =
                1
        }


        result.push({
            id:
                String(id),

            weight:
                weight
        })
    }


    /*
     * 固定排序。
     *
     * 不依赖 JS object iteration order。
     */

    result.sort(
        function(a, b)
        {
            if(a.id < b.id)
            {
                return -1
            }


            if(a.id > b.id)
            {
                return 1
            }


            return 0
        }
    )


    return result
}


/*
 * =========================================================
 * Structure Region coordinates
 * =========================================================
 */

function getModfusionStructureRegion(
    blockX,
    blockZ
)
{
    blockX =
        Math.floor(
            Number(blockX)
        )


    blockZ =
        Math.floor(
            Number(blockZ)
        )


    var regionX =
        Math.floor(
            blockX /
            MODFUSION_STRUCTURE_REGION_SIZE
        )


    var regionZ =
        Math.floor(
            blockZ /
            MODFUSION_STRUCTURE_REGION_SIZE
        )


    var minX =
        regionX *
        MODFUSION_STRUCTURE_REGION_SIZE


    var minZ =
        regionZ *
        MODFUSION_STRUCTURE_REGION_SIZE


    return {
        regionX:
            regionX,

        regionZ:
            regionZ,

        minX:
            minX,

        maxX:
            minX +
            MODFUSION_STRUCTURE_REGION_SIZE -
            1,

        minZ:
            minZ,

        maxZ:
            minZ +
            MODFUSION_STRUCTURE_REGION_SIZE -
            1,

        centerX:
            minX +
            Math.floor(
                MODFUSION_STRUCTURE_REGION_SIZE /
                2
            ),

        centerZ:
            minZ +
            Math.floor(
                MODFUSION_STRUCTURE_REGION_SIZE /
                2
            )
    }
}


/*
 * =========================================================
 * Super Region coordinates
 * =========================================================
 */

function getModfusionSuperRegion(
    regionX,
    regionZ
)
{
    regionX =
        Math.floor(
            Number(regionX)
        )


    regionZ =
        Math.floor(
            Number(regionZ)
        )


    /*
     * Math.floor 很重要。
     *
     * 它让负坐标也正确：
     *
     * region -1
     * 会属于 super region -1，
     * 而不是错误地属于 0。
     */

    var superX =
        Math.floor(
            regionX /
            MODFUSION_SUPER_REGION_SIDE
        )


    var superZ =
        Math.floor(
            regionZ /
            MODFUSION_SUPER_REGION_SIDE
        )


    var localX =
        regionX -
        (
            superX *
            MODFUSION_SUPER_REGION_SIDE
        )


    var localZ =
        regionZ -
        (
            superZ *
            MODFUSION_SUPER_REGION_SIDE
        )


    var localIndex =
        (
            localZ *
            MODFUSION_SUPER_REGION_SIDE
        ) +
        localX


    return {
        superX:
            superX,

        superZ:
            superZ,

        localX:
            localX,

        localZ:
            localZ,

        localIndex:
            localIndex
    }
}


/*
 * =========================================================
 * Allocate weighted active slots
 * =========================================================
 *
 * 例如：
 *
 * 16 total cells
 * 50% active
 *
 * active = 8
 *
 * Naga weight 1
 * Lich weight 1
 *
 * →
 *
 * Naga = 4
 * Lich = 4
 *
 *
 * 如果以后：
 *
 * Hollow = 3
 * Hedge  = 2
 * Naga   = 1
 * Lich   = 1
 *
 * 系统也可以自动按照比例分配。
 */

function allocateModfusionBuildingCounts(
    entries,
    activeCount,
    seedText
)
{
    var allocations = []


    if(
        entries == null ||
        entries.length === 0 ||
        activeCount <= 0
    )
    {
        return allocations
    }


    var totalWeight =
        0


    var i


    for(
        i = 0;
        i < entries.length;
        i++
    )
    {
        totalWeight +=
            entries[i].weight
    }


    if(totalWeight <= 0)
    {
        return allocations
    }


    var assigned =
        0


    /*
     * -----------------------------------------------------
     * Base allocation
     * -----------------------------------------------------
     */

    for(
        i = 0;
        i < entries.length;
        i++
    )
    {
        var raw =
            (
                activeCount *
                entries[i].weight
            ) /
            totalWeight


        var base =
            Math.floor(
                raw
            )


        var remainder =
            raw -
            base


        allocations.push({
            id:
                entries[i].id,

            weight:
                entries[i].weight,

            count:
                base,

            remainder:
                remainder,

            tieHash:
                modfusionDistributorHashString(
                    seedText +
                    "|extra|" +
                    entries[i].id
                )
        })


        assigned +=
            base
    }


    /*
     * -----------------------------------------------------
     * Largest-remainder distribution
     * -----------------------------------------------------
     *
     * 剩余槽位分给小数部分最大的建筑。
     *
     * 如果 remainder 一样，
     * 使用该 Super Region 自己的确定性 hash
     * 进行 tie-break。
     *
     * 因此未来 6 个等权建筑对应 8 个槽时，
     * 不会永远固定是前两个建筑获得额外槽。
     */

    var remaining =
        activeCount -
        assigned


    allocations.sort(
        function(a, b)
        {
            if(
                a.remainder >
                b.remainder
            )
            {
                return -1
            }


            if(
                a.remainder <
                b.remainder
            )
            {
                return 1
            }


            if(
                a.tieHash <
                b.tieHash
            )
            {
                return -1
            }


            if(
                a.tieHash >
                b.tieHash
            )
            {
                return 1
            }


            return 0
        }
    )


    for(
        i = 0;
        i < remaining;
        i++
    )
    {
        allocations[
            i % allocations.length
        ].count++
    }


    /*
     * 输出重新按照 ID 排序，
     * 便于日志阅读。
     */

    allocations.sort(
        function(a, b)
        {
            if(a.id < b.id)
            {
                return -1
            }


            if(a.id > b.id)
            {
                return 1
            }


            return 0
        }
    )


    return allocations
}


/*
 * =========================================================
 * Generate one Super Region plan
 * =========================================================
 */

function generateModfusionSuperRegionPlan(
    level,
    superX,
    superZ
)
{
    if(level == null)
    {
        return {
            status:
                "ERROR",

            reason:
                "LEVEL_IS_NULL"
        }
    }


    if(
        global.ModfusionBuildingRegistry ==
        null
    )
    {
        return {
            status:
                "ERROR",

            reason:
                "BUILDING_REGISTRY_NOT_LOADED"
        }
    }


    superX =
        Math.floor(
            Number(superX)
        )


    superZ =
        Math.floor(
            Number(superZ)
        )


    var entries =
        getModfusionCommonBuildingEntries()


    if(entries.length === 0)
    {
        return {
            status:
                "ERROR",

            reason:
                "NO_COMMON_BUILDINGS"
        }
    }


    var seedInfo =
        getModfusionDistributorWorldSeed(
            level
        )


    var cellCount =
        MODFUSION_SUPER_REGION_SIDE *
        MODFUSION_SUPER_REGION_SIDE


    var activeCount =
        Math.round(
            cellCount *
            MODFUSION_COMMON_ACTIVE_RATIO
        )


    activeCount =
        modfusionDistributorClamp(
            activeCount,
            0,
            cellCount
        )


    var seedText =
        seedInfo.value +
        "|modfusion_distribution_v" +
        MODFUSION_DISTRIBUTION_VERSION +
        "|" +
        superX +
        "|" +
        superZ


    /*
     * -----------------------------------------------------
     * Determine building counts
     * -----------------------------------------------------
     */

    var allocations =
        allocateModfusionBuildingCounts(
            entries,
            activeCount,
            seedText
        )


    /*
     * -----------------------------------------------------
     * Build slot bag
     * -----------------------------------------------------
     */

    var slots = []


    var i
    var j


    for(
        i = 0;
        i < allocations.length;
        i++
    )
    {
        for(
            j = 0;
            j < allocations[i].count;
            j++
        )
        {
            slots.push(
                allocations[i].id
            )
        }
    }


    /*
     * Empty slots.
     */

    while(
        slots.length <
        cellCount
    )
    {
        slots.push(
            MODFUSION_DISTRIBUTOR_EMPTY_SLOT
        )
    }


    /*
     * Safety guard.
     */

    if(
        slots.length >
        cellCount
    )
    {
        slots =
            slots.slice(
                0,
                cellCount
            )
    }


    /*
     * -----------------------------------------------------
     * Shuffle
     * -----------------------------------------------------
     */

    var shuffleSeed =
        modfusionDistributorHashString(
            seedText +
            "|shuffle"
        )


    slots =
        shuffleModfusionDistributorArray(
            slots,
            shuffleSeed
        )


    /*
     * -----------------------------------------------------
     * Count final slots
     * -----------------------------------------------------
     */

    var finalCounts = {}


    for(
        i = 0;
        i < slots.length;
        i++
    )
    {
        var slotId =
            slots[i]


        if(
            finalCounts[slotId] ==
            null
        )
        {
            finalCounts[slotId] =
                0
        }


        finalCounts[slotId]++
    }


    return {
        status:
            "OK",

        version:
            MODFUSION_DISTRIBUTION_VERSION,

        superX:
            superX,

        superZ:
            superZ,

        side:
            MODFUSION_SUPER_REGION_SIDE,

        cellCount:
            cellCount,

        activeCount:
            activeCount,

        emptyCount:
            cellCount -
            activeCount,

        activeRatio:
            MODFUSION_COMMON_ACTIVE_RATIO,

        seedSource:
            seedInfo.source,

        seedHash:
            shuffleSeed,

        entries:
            entries,

        allocations:
            allocations,

        slots:
            slots,

        finalCounts:
            finalCounts
    }
}


/*
 * =========================================================
 * Assignment by Structure Region
 * =========================================================
 */

function getModfusionAssignmentForRegion(
    level,
    regionX,
    regionZ
)
{
    regionX =
        Math.floor(
            Number(regionX)
        )


    regionZ =
        Math.floor(
            Number(regionZ)
        )


    var superInfo =
        getModfusionSuperRegion(
            regionX,
            regionZ
        )


    var plan =
        generateModfusionSuperRegionPlan(
            level,
            superInfo.superX,
            superInfo.superZ
        )


    if(plan.status !== "OK")
    {
        return plan
    }


    var buildingId =
        plan.slots[
            superInfo.localIndex
        ]


    var active =
        buildingId !==
        MODFUSION_DISTRIBUTOR_EMPTY_SLOT


    return {
        status:
            "OK",

        regionX:
            regionX,

        regionZ:
            regionZ,

        superX:
            superInfo.superX,

        superZ:
            superInfo.superZ,

        localX:
            superInfo.localX,

        localZ:
            superInfo.localZ,

        localIndex:
            superInfo.localIndex,

        active:
            active,

        buildingId:
            active
            ? buildingId
            : null,

        plan:
            plan
    }
}


/*
 * =========================================================
 * Assignment by block coordinate
 * =========================================================
 */

function getModfusionAssignmentForBlock(
    level,
    blockX,
    blockZ
)
{
    var region =
        getModfusionStructureRegion(
            blockX,
            blockZ
        )


    var assignment =
        getModfusionAssignmentForRegion(
            level,
            region.regionX,
            region.regionZ
        )


    if(assignment.status !== "OK")
    {
        return assignment
    }


    assignment.region =
        region


    return assignment
}


/*
 * =========================================================
 * Display codes
 * =========================================================
 *
 * A
 * B
 * C
 * ...
 *
 * . = empty
 */

function getModfusionDistributorDisplayCode(
    entries,
    buildingId
)
{
    if(
        buildingId == null ||
        buildingId ===
        MODFUSION_DISTRIBUTOR_EMPTY_SLOT
    )
    {
        return "."
    }


    var alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


    var i


    for(
        i = 0;
        i < entries.length;
        i++
    )
    {
        if(
            entries[i].id ===
            buildingId
        )
        {
            if(i < alphabet.length)
            {
                return alphabet.charAt(i)
            }


            return String(
                i + 1
            )
        }
    }


    return "?"
}


/*
 * =========================================================
 * Message helper
 * =========================================================
 */

function modfusionDistributorMessage(
    player,
    message
)
{
    console.log(
        "[ModFusion Distributor] " +
        message
    )


    if(player != null)
    {
        player.tell(
            "[ModFusion Distributor] " +
            message
        )
    }
}


/*
 * =========================================================
 * Report
 * =========================================================
 */

function printModfusionDistributorReport(
    player,
    level,
    blockX,
    blockZ
)
{
    if(level == null)
    {
        modfusionDistributorMessage(
            player,
            "ERROR: level is null."
        )

        return
    }


    var dimensionId =
        String(
            level.dimension
        )


    if(
        dimensionId !==
        MODFUSION_DISTRIBUTOR_DIMENSION_ID
    )
    {
        modfusionDistributorMessage(
            player,
            "ERROR: wrong dimension: " +
            dimensionId
        )

        return
    }


    var assignment =
        getModfusionAssignmentForBlock(
            level,
            blockX,
            blockZ
        )


    if(
        assignment == null ||
        assignment.status !== "OK"
    )
    {
        modfusionDistributorMessage(
            player,
            "ERROR: " +
            (
                assignment != null
                ? assignment.reason
                : "UNKNOWN"
            )
        )

        return
    }


    var region =
        assignment.region


    var plan =
        assignment.plan


    modfusionDistributorMessage(
        player,
        "================================"
    )


    modfusionDistributorMessage(
        player,
        "Distribution version: " +
        plan.version
    )


    modfusionDistributorMessage(
        player,
        "Region size: " +
        MODFUSION_STRUCTURE_REGION_SIZE
    )


    modfusionDistributorMessage(
        player,
        "Block position: " +
        Math.floor(blockX) +
        " " +
        Math.floor(blockZ)
    )


    modfusionDistributorMessage(
        player,
        "Structure Region: " +
        assignment.regionX +
        " " +
        assignment.regionZ
    )


    modfusionDistributorMessage(
        player,
        "Region X bounds: " +
        region.minX +
        " ~ " +
        region.maxX
    )


    modfusionDistributorMessage(
        player,
        "Region Z bounds: " +
        region.minZ +
        " ~ " +
        region.maxZ
    )


    modfusionDistributorMessage(
        player,
        "Super Region: " +
        assignment.superX +
        " " +
        assignment.superZ
    )


    modfusionDistributorMessage(
        player,
        "Local cell: " +
        assignment.localX +
        " " +
        assignment.localZ +
        " / index " +
        assignment.localIndex
    )


    modfusionDistributorMessage(
        player,
        "Seed source: " +
        plan.seedSource
    )


    modfusionDistributorMessage(
        player,
        "Seed hash: " +
        plan.seedHash
    )


    modfusionDistributorMessage(
        player,
        "Active slots: " +
        plan.activeCount +
        " / " +
        plan.cellCount
    )


    /*
     * -----------------------------------------------------
     * Current assignment
     * -----------------------------------------------------
     */

    if(assignment.active)
    {
        modfusionDistributorMessage(
            player,
            "Assigned building: " +
            assignment.buildingId
        )
    }
    else
    {
        modfusionDistributorMessage(
            player,
            "Assigned building: EMPTY"
        )
    }


    /*
     * -----------------------------------------------------
     * Legend
     * -----------------------------------------------------
     */

    modfusionDistributorMessage(
        player,
        "--------------------------------"
    )


    modfusionDistributorMessage(
        player,
        "Legend:"
    )


    var i


    for(
        i = 0;
        i < plan.entries.length;
        i++
    )
    {
        modfusionDistributorMessage(
            player,
            getModfusionDistributorDisplayCode(
                plan.entries,
                plan.entries[i].id
            ) +
            " = " +
            plan.entries[i].id
        )
    }


    modfusionDistributorMessage(
        player,
        ". = EMPTY"
    )


    /*
     * -----------------------------------------------------
     * 4 x 4 Super Region map
     * -----------------------------------------------------
     */

    modfusionDistributorMessage(
        player,
        "--------------------------------"
    )


    modfusionDistributorMessage(
        player,
        "Super Region map:"
    )


    var z
    var x


    for(
        z = 0;
        z < plan.side;
        z++
    )
    {
        var row = ""


        for(
            x = 0;
            x < plan.side;
            x++
        )
        {
            var index =
                (
                    z *
                    plan.side
                ) +
                x


            var slot =
                plan.slots[index]


            var code =
                getModfusionDistributorDisplayCode(
                    plan.entries,
                    slot
                )


            if(row.length > 0)
            {
                row += " "
            }


            row +=
                code
        }


        modfusionDistributorMessage(
            player,
            row
        )
    }


    /*
     * -----------------------------------------------------
     * Balance report
     * -----------------------------------------------------
     */

    modfusionDistributorMessage(
        player,
        "--------------------------------"
    )


    modfusionDistributorMessage(
        player,
        "Super Region balance:"
    )


    for(
        i = 0;
        i < plan.entries.length;
        i++
    )
    {
        var id =
            plan.entries[i].id


        var count =
            plan.finalCounts[id]


        if(count == null)
        {
            count =
                0
        }


        modfusionDistributorMessage(
            player,
            id +
            " = " +
            count
        )
    }


    var emptyCount =
        plan.finalCounts[
            MODFUSION_DISTRIBUTOR_EMPTY_SLOT
        ]


    if(emptyCount == null)
    {
        emptyCount =
            0
    }


    modfusionDistributorMessage(
        player,
        "EMPTY = " +
        emptyCount
    )


    modfusionDistributorMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */

global.ModfusionBuildingDistributor = {

    getRegion:
        getModfusionStructureRegion,

    getSuperRegion:
        getModfusionSuperRegion,

    getCommonBuildings:
        getModfusionCommonBuildingEntries,

    getSuperRegionPlan:
        generateModfusionSuperRegionPlan,

    getAssignmentForRegion:
        getModfusionAssignmentForRegion,

    getAssignmentForBlock:
        getModfusionAssignmentForBlock,

    print:
        printModfusionDistributorReport
}


/*
 * =========================================================
 * Test command
 * =========================================================
 *
 * 使用：
 *
 * /kubejs custom_command modfusion_distribution
 *
 * 只输出分配结果。
 *
 * 不扫描地形。
 * 不调用 Analyzer。
 * 不生成建筑。
 * 不写 persistentData。
 */

ServerEvents.customCommand(
    "modfusion_distribution",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Distributor] Command must be run by a player."
            )

            return
        }


        printModfusionDistributorReport(
            player,
            player.level,
            Math.floor(
                player.x
            ),
            Math.floor(
                player.z
            )
        )
    }
)


console.log(
    "[ModFusion Distributor] Ready."
)