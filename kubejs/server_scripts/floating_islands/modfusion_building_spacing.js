console.log(
    "[ModFusion Spacing] Script loaded"
)


/*
 * =========================================================
 * Settings
 * =========================================================
 */

var MODFUSION_SPACING_DIMENSION_ID =
    "mahou:modfusion_dimension"


var MODFUSION_SPACING_VERSION =
    1


/*
 * 如果 Registry 中意外缺少 minStructureSpacing，
 * 不允许默认成 0。
 *
 * COMMON 当前 Naga / Lich 都已经明确配置为 768。
 */

var MODFUSION_SPACING_FALLBACK =
    768


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */

function modfusionSpacingCorrectDimension(
    level
)
{
    if(level == null)
    {
        return false
    }


    return (
        String(
            level.dimension
        ) ===
        MODFUSION_SPACING_DIMENSION_ID
    )
}


function modfusionSpacingNumber(
    value,
    fallback
)
{
    var number =
        Number(
            value
        )


    if(isNaN(number))
    {
        return fallback
    }


    return number
}


/*
 * =========================================================
 * Deterministic hash
 * =========================================================
 */

function modfusionSpacingHashString(
    text
)
{
    text =
        String(
            text
        )


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
 * Building spacing
 * =========================================================
 */

function getModfusionBuildingSpacing(
    buildingId
)
{
    if(
        global.ModfusionBuildingRegistry ==
        null
    )
    {
        return MODFUSION_SPACING_FALLBACK
    }


    var config =
        global.ModfusionBuildingRegistry
            .get(
                String(
                    buildingId
                )
            )


    if(config == null)
    {
        return MODFUSION_SPACING_FALLBACK
    }


    var spacing =
        Number(
            config.minStructureSpacing
        )


    if(
        isNaN(spacing) ||
        spacing <= 0
    )
    {
        return MODFUSION_SPACING_FALLBACK
    }


    return Math.floor(
        spacing
    )
}


/*
 * =========================================================
 * Distribution seed for one Home Slot
 * =========================================================
 *
 * 不直接把 Java long World Seed 转 JS Number。
 *
 * 继续复用 Distributor 已经生成的 seedHash，
 * 避免精度风险。
 */

function getModfusionSpacingDistributionSeed(
    level,
    record
)
{
    if(
        global.ModfusionBuildingDistributor ==
        null
    )
    {
        return 0
    }


    try
    {
        var assignment =
            global.ModfusionBuildingDistributor
                .getAssignmentForRegion(
                    level,
                    Number(
                        record.homeRegionX
                    ),
                    Number(
                        record.homeRegionZ
                    )
                )


        if(
            assignment != null &&
            assignment.status === "OK" &&
            assignment.plan != null &&
            assignment.plan.seedHash != null
        )
        {
            return assignment.plan.seedHash
        }
    }
    catch(error)
    {
        console.log(
            "[ModFusion Spacing] Distribution seed lookup failed: " +
            error
        )
    }


    return 0
}


/*
 * =========================================================
 * Deterministic priority
 * =========================================================
 *
 * 数值越小，优先级越高。
 *
 * 不是：
 *
 * 谁先生成 Record 谁优先。
 *
 * 而是完全由世界与 Home Slot 决定。
 */

function getModfusionSpacingPriority(
    level,
    record
)
{
    var distributionSeed =
        getModfusionSpacingDistributionSeed(
            level,
            record
        )


    var seedText =
        String(
            distributionSeed
        ) +
        "|spacing_v" +
        MODFUSION_SPACING_VERSION +
        "|" +
        String(
            record.homeRegionX
        ) +
        "|" +
        String(
            record.homeRegionZ
        ) +
        "|" +
        String(
            record.buildingId
        )


    return modfusionSpacingHashString(
        seedText
    )
}


/*
 * =========================================================
 * Physical distance
 * =========================================================
 */

function getModfusionSpacingDistanceSquared(
    a,
    b
)
{
    var dx =
        Number(a.x) -
        Number(b.x)


    var dz =
        Number(a.z) -
        Number(b.z)


    return (
        dx * dx +
        dz * dz
    )
}


function getModfusionSpacingDistance(
    a,
    b
)
{
    return Math.sqrt(
        getModfusionSpacingDistanceSquared(
            a,
            b
        )
    )
}


/*
 * =========================================================
 * Required spacing between two records
 * =========================================================
 */

function getModfusionRequiredSpacingBetween(
    a,
    b
)
{
    var spacingA =
        getModfusionBuildingSpacing(
            a.buildingId
        )


    var spacingB =
        getModfusionBuildingSpacing(
            b.buildingId
        )


    return Math.max(
        spacingA,
        spacingB
    )
}


/*
 * =========================================================
 * Conflict test
 * =========================================================
 */

function checkModfusionSpacingConflict(
    a,
    b
)
{
    var requiredSpacing =
        getModfusionRequiredSpacingBetween(
            a,
            b
        )


    var distanceSquared =
        getModfusionSpacingDistanceSquared(
            a,
            b
        )


    var requiredSquared =
        requiredSpacing *
        requiredSpacing


    var conflict =
        (
            distanceSquared <
            requiredSquared
        )


    return {

        conflict:
            conflict,

        requiredSpacing:
            requiredSpacing,

        distanceSquared:
            distanceSquared,

        distance:
            Math.sqrt(
                distanceSquared
            )
    }
}


/*
 * =========================================================
 * Is this record a spacing candidate?
 * =========================================================
 */

function isModfusionSpacingCandidate(
    record
)
{
    if(record == null)
    {
        return false
    }


    /*
     * UNRESOLVED 没有实际坐标，
     * 不能参与距离竞争。
     */

    if(
        record.x == null ||
        record.y == null ||
        record.z == null
    )
    {
        return false
    }


    if(
        String(
            record.placementState
        ) ===
        "UNRESOLVED"
    )
    {
        return false
    }


    return true
}


/*
 * =========================================================
 * Prepare candidate
 * =========================================================
 */

function buildModfusionSpacingCandidate(
    level,
    record
)
{
    return {

        record:
            record,

        priority:
            getModfusionSpacingPriority(
                level,
                record
            ),

        minStructureSpacing:
            getModfusionBuildingSpacing(
                record.buildingId
            )
    }
}


/*
 * =========================================================
 * Stable candidate sort
 * =========================================================
 *
 * IMPORTANT:
 *
 * generated=true 的结构以后已经真实存在，
 * 不允许 B5 在未来重新运行时把它“判没”。
 *
 * 所以：
 *
 * 已生成结构优先锁定。
 *
 * 当前 B5 测试阶段所有记录都是 generated=false，
 * 因此实际排序完全由 priorityHash 决定。
 */

function sortModfusionSpacingCandidates(
    candidates
)
{
    candidates.sort(
        function(a, b)
        {
            var aGenerated =
                a.record.generated === true


            var bGenerated =
                b.record.generated === true


            if(
                aGenerated &&
                !bGenerated
            )
            {
                return -1
            }


            if(
                !aGenerated &&
                bGenerated
            )
            {
                return 1
            }


            if(
                a.priority <
                b.priority
            )
            {
                return -1
            }


            if(
                a.priority >
                b.priority
            )
            {
                return 1
            }


            /*
             * Hash 理论上可能碰撞。
             *
             * 使用 Home Region 做稳定 tie-break。
             */

            var aX =
                Number(
                    a.record.homeRegionX
                )


            var bX =
                Number(
                    b.record.homeRegionX
                )


            if(aX < bX)
            {
                return -1
            }


            if(aX > bX)
            {
                return 1
            }


            var aZ =
                Number(
                    a.record.homeRegionZ
                )


            var bZ =
                Number(
                    b.record.homeRegionZ
                )


            if(aZ < bZ)
            {
                return -1
            }


            if(aZ > bZ)
            {
                return 1
            }


            var aBuilding =
                String(
                    a.record.buildingId
                )


            var bBuilding =
                String(
                    b.record.buildingId
                )


            if(aBuilding < bBuilding)
            {
                return -1
            }


            if(aBuilding > bBuilding)
            {
                return 1
            }


            return 0
        }
    )


    return candidates
}


/*
 * =========================================================
 * Clear old spacing metadata
 * =========================================================
 */

function resetModfusionSpacingMetadata(
    record
)
{
    record.spacingVersion =
        MODFUSION_SPACING_VERSION


    record.spacingPriority =
        null


    record.spacingMinStructureSpacing =
        null


    record.spacingConflictWithHomeRegionX =
        null


    record.spacingConflictWithHomeRegionZ =
        null


    record.spacingConflictWithBuildingId =
        null


    record.spacingConflictDistance =
        null


    record.spacingConflictRequired =
        null


    record.spacingWinnerPriority =
        null


    return record
}


/*
 * =========================================================
 * Mark PASS
 * =========================================================
 */

function markModfusionSpacingPass(
    candidate
)
{
    var record =
        candidate.record


    resetModfusionSpacingMetadata(
        record
    )


    record.spacingStatus =
        "PASS"


    record.spacingPriority =
        candidate.priority


    record.spacingMinStructureSpacing =
        candidate.minStructureSpacing


    if(record.generated === true)
    {
        record.placementState =
            "GENERATED"
    }
    else
    {
        record.placementState =
            "READY_TO_GENERATE"
    }


    return record
}


/*
 * =========================================================
 * Mark FAIL
 * =========================================================
 */

function markModfusionSpacingFail(
    candidate,
    winner,
    conflict
)
{
    var record =
        candidate.record


    resetModfusionSpacingMetadata(
        record
    )


    record.spacingStatus =
        "FAIL"


    record.spacingPriority =
        candidate.priority


    record.spacingMinStructureSpacing =
        candidate.minStructureSpacing


    record.spacingConflictWithHomeRegionX =
        Number(
            winner.record.homeRegionX
        )


    record.spacingConflictWithHomeRegionZ =
        Number(
            winner.record.homeRegionZ
        )


    record.spacingConflictWithBuildingId =
        String(
            winner.record.buildingId
        )


    record.spacingConflictDistance =
        conflict.distance


    record.spacingConflictRequired =
        conflict.requiredSpacing


    record.spacingWinnerPriority =
        winner.priority


    /*
     * 当前阶段理论上不会有 generated 结构进入 FAIL。
     *
     * 为未来调试保留专门状态。
     */

    if(record.generated === true)
    {
        record.placementState =
            "GENERATED_SPACING_CONFLICT"
    }
    else
    {
        record.placementState =
            "SPACING_CONFLICT"
    }


    return record
}


/*
 * =========================================================
 * Mark NOT_APPLICABLE
 * =========================================================
 */

function markModfusionSpacingNotApplicable(
    record
)
{
    resetModfusionSpacingMetadata(
        record
    )


    record.spacingStatus =
        "NOT_APPLICABLE"


    if(
        record.generated !== true
    )
    {
        record.placementState =
            "UNRESOLVED"
    }


    return record
}


/*
 * =========================================================
 * Save helper
 * =========================================================
 */

function saveModfusionSpacingRecord(
    level,
    record
)
{
    if(
        global.ModfusionBuildingPlacementRecord ==
        null
    )
    {
        return false
    }


    return global.ModfusionBuildingPlacementRecord
        .save(
            level,
            record
        )
}


/*
 * =========================================================
 * Recalculate ALL STORED records
 * =========================================================
 *
 * IMPORTANT:
 *
 * 这里不是：
 *
 * foreach record:
 *     跟已经保存的 PASS 状态比较
 *
 *
 * 而是每次都：
 *
 * 1. 读取当前全部 B4 Records
 * 2. 清除旧 spacing decision
 * 3. 重新按 deterministic priority 排序
 * 4. 从头计算
 *
 *
 * 因此：
 *
 * A 先创建、B 后创建
 *
 * 和
 *
 * B 先创建、A 后创建
 *
 * 在两条 Record 都存在以后，
 * 最终 B5 结果相同。
 */

function recalculateAllModfusionSpacing(
    level
)
{
    /*
     * =====================================================
     * Dependency checks
     * =====================================================
     */

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
        !modfusionSpacingCorrectDimension(
            level
        )
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "WRONG_DIMENSION"
        }
    }


    if(
        global.ModfusionBuildingPlacementRecord ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "PLACEMENT_RECORD_NOT_LOADED"
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
                "REGISTRY_NOT_LOADED"
        }
    }


    /*
     * =====================================================
     * Read records
     * =====================================================
     */

    var records =
        global.ModfusionBuildingPlacementRecord
            .getAll(
                level
            )


    if(records == null)
    {
        records = []
    }


    var candidates = []

    var unresolved = []


    var i


    for(
        i = 0;
        i < records.length;
        i++
    )
    {
        var record =
            records[i]


        if(
            isModfusionSpacingCandidate(
                record
            )
        )
        {
            candidates.push(
                buildModfusionSpacingCandidate(
                    level,
                    record
                )
            )
        }
        else
        {
            unresolved.push(
                record
            )
        }
    }


    /*
     * =====================================================
     * Deterministic ordering
     * =====================================================
     */

    sortModfusionSpacingCandidates(
        candidates
    )


    /*
     * =====================================================
     * Greedy deterministic acceptance
     * =====================================================
     *
     * 已接受列表只包含真正 PASS 的候选。
     *
     *
     * 例：
     *
     * A priority 10
     * B priority 20
     * C priority 30
     *
     * A-B conflict
     * B-C conflict
     * A-C no conflict
     *
     * 结果：
     *
     * A PASS
     * B FAIL
     * C PASS
     *
     *
     * 不会因为失败的 B 存在，
     * 把 C 也错误删除。
     */

    var accepted = []

    var passed = []

    var failed = []


    for(
        i = 0;
        i < candidates.length;
        i++
    )
    {
        var candidate =
            candidates[i]


        var blockingWinner =
            null


        var blockingConflict =
            null


        var j


        for(
            j = 0;
            j < accepted.length;
            j++
        )
        {
            var winner =
                accepted[j]


            var conflict =
                checkModfusionSpacingConflict(
                    candidate.record,
                    winner.record
                )


            if(conflict.conflict)
            {
                blockingWinner =
                    winner


                blockingConflict =
                    conflict


                break
            }
        }


        /*
         * -------------------------------------------------
         * PASS
         * -------------------------------------------------
         */

        if(blockingWinner == null)
        {
            markModfusionSpacingPass(
                candidate
            )


            accepted.push(
                candidate
            )


            passed.push(
                candidate
            )
        }

        /*
         * -------------------------------------------------
         * FAIL
         * -------------------------------------------------
         */

        else
        {
            markModfusionSpacingFail(
                candidate,
                blockingWinner,
                blockingConflict
            )


            failed.push({

                candidate:
                    candidate,

                winner:
                    blockingWinner,

                conflict:
                    blockingConflict
            })
        }
    }


    /*
     * =====================================================
     * UNRESOLVED
     * =====================================================
     */

    for(
        i = 0;
        i < unresolved.length;
        i++
    )
    {
        markModfusionSpacingNotApplicable(
            unresolved[i]
        )
    }


    /*
     * =====================================================
     * Persist everything
     * =====================================================
     */

    var saveFailures = []


    for(
        i = 0;
        i < records.length;
        i++
    )
    {
        if(
            !saveModfusionSpacingRecord(
                level,
                records[i]
            )
        )
        {
            saveFailures.push({

                homeRegionX:
                    records[i].homeRegionX,

                homeRegionZ:
                    records[i].homeRegionZ,

                buildingId:
                    records[i].buildingId
            })
        }
    }


    if(saveFailures.length > 0)
    {
        return {

            status:
                "ERROR",

            reason:
                "RECORD_SAVE_FAILURE",

            saveFailures:
                saveFailures
        }
    }


    /*
     * =====================================================
     * Result
     * =====================================================
     */

    return {

        status:
            "OK",

        version:
            MODFUSION_SPACING_VERSION,

        totalRecords:
            records.length,

        candidateRecords:
            candidates.length,

        passCount:
            passed.length,

        failCount:
            failed.length,

        notApplicableCount:
            unresolved.length,

        passed:
            passed,

        failed:
            failed,

        unresolved:
            unresolved
    }
}


/*
 * =========================================================
 * Get current Home record after recalculation
 * =========================================================
 */

function getModfusionSpacingRecordForHome(
    level,
    homeRegionX,
    homeRegionZ
)
{
    if(
        global.ModfusionBuildingPlacementRecord ==
        null
    )
    {
        return null
    }


    return global.ModfusionBuildingPlacementRecord
        .get(
            level,
            homeRegionX,
            homeRegionZ
        )
}


/*
 * =========================================================
 * Message helper
 * =========================================================
 */

function modfusionSpacingMessage(
    player,
    message
)
{
    console.log(
        "[ModFusion Spacing] " +
        message
    )


    if(player != null)
    {
        player.tell(
            "[ModFusion Spacing] " +
            message
        )
    }
}


/*
 * =========================================================
 * Pretty distance
 * =========================================================
 */

function modfusionSpacingRounded(
    value
)
{
    return (
        Math.round(
            Number(value) *
            10
        ) /
        10
    )
}


/*
 * =========================================================
 * Print one record
 * =========================================================
 */

function printModfusionSpacingRecord(
    player,
    record
)
{
    if(record == null)
    {
        modfusionSpacingMessage(
            player,
            "Record: NONE"
        )


        return
    }


    modfusionSpacingMessage(
        player,
        "Building: " +
        record.buildingId
    )


    modfusionSpacingMessage(
        player,
        "Home Region: " +
        record.homeRegionX +
        " " +
        record.homeRegionZ
    )


    modfusionSpacingMessage(
        player,
        "Resolution: " +
        record.resolution
    )


    if(
        record.x != null &&
        record.y != null &&
        record.z != null
    )
    {
        modfusionSpacingMessage(
            player,
            "Position: " +
            record.x +
            " " +
            record.y +
            " " +
            record.z
        )
    }


    modfusionSpacingMessage(
        player,
        "Spacing status: " +
        record.spacingStatus
    )


    modfusionSpacingMessage(
        player,
        "Placement state: " +
        record.placementState
    )


    if(record.spacingPriority != null)
    {
        modfusionSpacingMessage(
            player,
            "Priority: " +
            record.spacingPriority
        )
    }


    if(
        record.spacingMinStructureSpacing !=
        null
    )
    {
        modfusionSpacingMessage(
            player,
            "Building spacing: " +
            record.spacingMinStructureSpacing
        )
    }


    /*
     * =====================================================
     * Conflict detail
     * =====================================================
     */

    if(
        String(
            record.spacingStatus
        ) ===
        "FAIL"
    )
    {
        modfusionSpacingMessage(
            player,
            "Conflict winner: " +
            record.spacingConflictWithBuildingId
        )


        modfusionSpacingMessage(
            player,
            "Winner Home Region: " +
            record.spacingConflictWithHomeRegionX +
            " " +
            record.spacingConflictWithHomeRegionZ
        )


        modfusionSpacingMessage(
            player,
            "Distance: " +
            modfusionSpacingRounded(
                record.spacingConflictDistance
            )
        )


        modfusionSpacingMessage(
            player,
            "Required: " +
            record.spacingConflictRequired
        )


        modfusionSpacingMessage(
            player,
            "Winner priority: " +
            record.spacingWinnerPriority
        )
    }


    modfusionSpacingMessage(
        player,
        "Generated: " +
        record.generated
    )
}


/*
 * =========================================================
 * Print full recalculation report
 * =========================================================
 */

function printModfusionSpacingReport(
    player,
    report
)
{
    if(report == null)
    {
        modfusionSpacingMessage(
            player,
            "ERROR: report is null."
        )


        return
    }


    if(report.status !== "OK")
    {
        modfusionSpacingMessage(
            player,
            "ERROR: " +
            report.reason
        )


        return
    }


    modfusionSpacingMessage(
        player,
        "================================"
    )


    modfusionSpacingMessage(
        player,
        "Spacing version: " +
        report.version
    )


    modfusionSpacingMessage(
        player,
        "Stored records: " +
        report.totalRecords
    )


    modfusionSpacingMessage(
        player,
        "Spacing candidates: " +
        report.candidateRecords
    )


    modfusionSpacingMessage(
        player,
        "PASS: " +
        report.passCount
    )


    modfusionSpacingMessage(
        player,
        "FAIL: " +
        report.failCount
    )


    modfusionSpacingMessage(
        player,
        "NOT_APPLICABLE: " +
        report.notApplicableCount
    )


    /*
     * =====================================================
     * PASS
     * =====================================================
     */

    var i


    if(report.passed.length > 0)
    {
        modfusionSpacingMessage(
            player,
            "--------------------------------"
        )


        modfusionSpacingMessage(
            player,
            "PASS records:"
        )


        for(
            i = 0;
            i < report.passed.length;
            i++
        )
        {
            var passCandidate =
                report.passed[i]


            var passRecord =
                passCandidate.record


            modfusionSpacingMessage(
                player,
                "HOME " +
                passRecord.homeRegionX +
                "," +
                passRecord.homeRegionZ +
                " | " +
                passRecord.buildingId +
                " | POS " +
                passRecord.x +
                "," +
                passRecord.y +
                "," +
                passRecord.z +
                " | priority=" +
                passCandidate.priority
            )
        }
    }


    /*
     * =====================================================
     * FAIL
     * =====================================================
     */

    if(report.failed.length > 0)
    {
        modfusionSpacingMessage(
            player,
            "--------------------------------"
        )


        modfusionSpacingMessage(
            player,
            "CONFLICT records:"
        )


        for(
            i = 0;
            i < report.failed.length;
            i++
        )
        {
            var failure =
                report.failed[i]


            var failedRecord =
                failure.candidate.record


            var winnerRecord =
                failure.winner.record


            modfusionSpacingMessage(
                player,
                "HOME " +
                failedRecord.homeRegionX +
                "," +
                failedRecord.homeRegionZ +
                " | " +
                failedRecord.buildingId +
                " -> LOSES TO HOME " +
                winnerRecord.homeRegionX +
                "," +
                winnerRecord.homeRegionZ +
                " " +
                winnerRecord.buildingId +
                " | distance=" +
                modfusionSpacingRounded(
                    failure.conflict.distance
                ) +
                " required=" +
                failure.conflict.requiredSpacing
            )
        }
    }


    modfusionSpacingMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */

global.ModfusionBuildingSpacing = {

    recalculateAll:
        recalculateAllModfusionSpacing,

    getPriority:
        getModfusionSpacingPriority,

    getBuildingSpacing:
        getModfusionBuildingSpacing,

    checkConflict:
        checkModfusionSpacingConflict,

    getRecord:
        getModfusionSpacingRecordForHome,

    printRecord:
        printModfusionSpacingRecord,

    printReport:
        printModfusionSpacingReport
}


/*
 * =========================================================
 * Test command #1
 * =========================================================
 *
 * /kubejs custom_command modfusion_spacing
 *
 *
 * 当前所在 HOME：
 *
 * 先确保 B4 Record 存在
 *      ↓
 * 对当前全部 stored Records 重算 B5
 *      ↓
 * 输出当前 Home 的最终 spacing 状态
 *
 *
 * 当前所在 RESERVE：
 *
 * 不创建独立记录。
 * 仍然重算当前全部 stored Records。
 */

ServerEvents.customCommand(
    "modfusion_spacing",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Spacing] Command must be run by a player."
            )


            return
        }


        if(
            !modfusionSpacingCorrectDimension(
                player.level
            )
        )
        {
            modfusionSpacingMessage(
                player,
                "ERROR: wrong dimension."
            )


            return
        }


        if(
            global.ModfusionBuildingPlacementRecord ==
            null
        )
        {
            modfusionSpacingMessage(
                player,
                "ERROR: Placement Record system not loaded."
            )


            return
        }


        /*
         * =================================================
         * Ensure current physical Region's B4 state
         * =================================================
         */

        var ensureResult =
            global.ModfusionBuildingPlacementRecord
                .ensureBlock(
                    player.level,

                    Math.floor(
                        player.x
                    ),

                    Math.floor(
                        player.z
                    )
                )


        if(
            ensureResult == null ||
            ensureResult.status !== "OK"
        )
        {
            modfusionSpacingMessage(
                player,
                "ERROR: could not ensure current Placement Record."
            )


            return
        }


        /*
         * =================================================
         * Recalculate
         * =================================================
         */

        var report =
            recalculateAllModfusionSpacing(
                player.level
            )


        printModfusionSpacingReport(
            player,
            report
        )


        if(
            report == null ||
            report.status !== "OK"
        )
        {
            return
        }


        /*
         * =================================================
         * Current Home
         * =================================================
         */

        if(
            ensureResult.outcome ===
            "RECORD_AVAILABLE"
        )
        {
            var record =
                getModfusionSpacingRecordForHome(
                    player.level,

                    ensureResult.record.homeRegionX,

                    ensureResult.record.homeRegionZ
                )


            modfusionSpacingMessage(
                player,
                "Current Home result:"
            )


            printModfusionSpacingRecord(
                player,
                record
            )
        }

        /*
         * =================================================
         * Current Reserve
         * =================================================
         */

        else if(
            ensureResult.outcome ===
            "RESERVE_REGION"
        )
        {
            modfusionSpacingMessage(
                player,
                "Current physical Region is RESERVE."
            )


            if(
                ensureResult.owner != null
            )
            {
                modfusionSpacingMessage(
                    player,
                    "Owner Home Region: " +
                    ensureResult.owner.home.regionX +
                    " " +
                    ensureResult.owner.home.regionZ
                )


                var ownerRecord =
                    getModfusionSpacingRecordForHome(
                        player.level,

                        ensureResult.owner.home.regionX,

                        ensureResult.owner.home.regionZ
                    )


                if(ownerRecord != null)
                {
                    printModfusionSpacingRecord(
                        player,
                        ownerRecord
                    )
                }
                else
                {
                    modfusionSpacingMessage(
                        player,
                        "Owner Placement Record: NOT_CREATED"
                    )
                }
            }
        }
    }
)


/*
 * =========================================================
 * Test command #2
 * =========================================================
 *
 * /kubejs custom_command modfusion_spacing_all
 *
 *
 * 不创建新的 Placement Record。
 *
 * 只对当前已经存在的所有 B4 Records
 * 进行完整重算并输出。
 */

ServerEvents.customCommand(
    "modfusion_spacing_all",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Spacing] Command must be run by a player."
            )


            return
        }


        if(
            !modfusionSpacingCorrectDimension(
                player.level
            )
        )
        {
            modfusionSpacingMessage(
                player,
                "ERROR: wrong dimension."
            )


            return
        }


        var report =
            recalculateAllModfusionSpacing(
                player.level
            )


        printModfusionSpacingReport(
            player,
            report
        )
    }
)


console.log(
    "[ModFusion Spacing] Ready."
)