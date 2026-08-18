console.log(
    "[ModFusion Generation] Script loaded"
)


/*
 * =========================================================
 * Step 4-C1
 *
 * First real COMMON generation:
 *
 * twilight_naga_courtyard
 *
 *
 * Pipeline:
 *
 * Placement Record
 *      ↓
 * Generation Activation
 *      ↓
 * Resolve all potentially conflicting nearby Home Slots
 *      ↓
 * B5 recalculation
 *      ↓
 * target still PASS
 *      ↓
 * preload footprint chunks
 *      ↓
 * PLACE_PENDING
 *      ↓
 * /place structure
 *      ↓
 * command succeeds
 *      ↓
 * markGenerated()
 *
 *
 * IMPORTANT:
 *
 * C1 currently ONLY allows:
 *
 * twilight_naga_courtyard
 * =========================================================
 */


var MODFUSION_GENERATION_DIMENSION_ID =
    "mahou:modfusion_dimension"


var MODFUSION_GENERATION_VERSION =
    1


var MODFUSION_ACTIVATION_VERSION =
    1


var MODFUSION_C1_BUILDING_ID =
    "twilight_naga_courtyard"


var MODFUSION_C1_EXPECTED_STRUCTURE_ID =
    "twilightforest:naga_courtyard"


/*
 * 如果 Registry 没有提供更具体值，
 * Naga 当前使用 48 blocks 作为结构预加载半径。
 */

var MODFUSION_C1_DEFAULT_PRELOAD_RADIUS =
    48


/*
 * Region fallback.
 */

var MODFUSION_GENERATION_REGION_SIZE_FALLBACK =
    768


/*
 * COMMON spacing fallback.
 */

var MODFUSION_GENERATION_SPACING_FALLBACK =
    768


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */

function modfusionGenerationCorrectDimension(
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
        MODFUSION_GENERATION_DIMENSION_ID
    )
}


function modfusionGenerationFloor(
    value
)
{
    return Math.floor(
        Number(
            value
        )
    )
}


function modfusionGenerationRegionKey(
    regionX,
    regionZ
)
{
    return (
        String(regionX) +
        "|" +
        String(regionZ)
    )
}


/*
 * =========================================================
 * Region size
 * =========================================================
 */

function getModfusionGenerationRegionSize()
{
    if(
        global.ModfusionBuildingDistributor !=
        null
    )
    {
        try
        {
            var sample =
                global.ModfusionBuildingDistributor
                    .getRegion(
                        0,
                        0
                    )


            if(
                sample != null &&
                sample.minX != null &&
                sample.maxX != null
            )
            {
                var size =
                    Number(sample.maxX) -
                    Number(sample.minX) +
                    1


                if(
                    !isNaN(size) &&
                    size > 0
                )
                {
                    return Math.floor(
                        size
                    )
                }
            }
        }
        catch(error)
        {
            console.log(
                "[ModFusion Generation] Region size lookup failed: " +
                error
            )
        }
    }


    return MODFUSION_GENERATION_REGION_SIZE_FALLBACK
}


/*
 * =========================================================
 * COMMON maximum spacing
 * =========================================================
 *
 * Activation 必须覆盖所有可能和目标建筑发生冲突的
 * COMMON building。
 *
 * 因此不是只读取 Naga 的 768，
 * 而是读取当前 Registry 中：
 *
 * enabled
 * +
 * regionPolicy == COMMON
 *
 * 的最大 minStructureSpacing。
 */

function getModfusionMaximumCommonSpacing()
{
    var maximum =
        MODFUSION_GENERATION_SPACING_FALLBACK


    if(
        global.ModfusionBuildingRegistry ==
        null
    )
    {
        return maximum
    }


    var registry =
        global.ModfusionBuildingRegistry.all


    if(registry == null)
    {
        return maximum
    }


    var key


    for(
        key in registry
    )
    {
        var config =
            registry[key]


        if(config == null)
        {
            continue
        }


        if(config.enabled === false)
        {
            continue
        }


        if(
            String(
                config.regionPolicy
            ) !==
            "COMMON"
        )
        {
            continue
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
            continue
        }


        maximum =
            Math.max(
                maximum,
                spacing
            )
    }


    return Math.floor(
        maximum
    )
}


/*
 * =========================================================
 * Resolve Home ownership for current physical Region
 * =========================================================
 *
 * HOME:
 * return itself
 *
 * RESERVE:
 * return its paired Home owner
 */

function getModfusionGenerationHomeForRegion(
    level,
    regionX,
    regionZ
)
{
    if(
        global.ModfusionBuildingDistributor ==
        null
    )
    {
        return null
    }


    regionX =
        modfusionGenerationFloor(
            regionX
        )


    regionZ =
        modfusionGenerationFloor(
            regionZ
        )


    var assignment =
        global.ModfusionBuildingDistributor
            .getAssignmentForRegion(
                level,
                regionX,
                regionZ
            )


    if(
        assignment == null ||
        assignment.status !== "OK"
    )
    {
        return null
    }


    /*
     * Home Region.
     */

    if(assignment.active)
    {
        return {

            homeRegionX:
                regionX,

            homeRegionZ:
                regionZ,

            buildingId:
                String(
                    assignment.buildingId
                ),

            physicalRegionX:
                regionX,

            physicalRegionZ:
                regionZ,

            physicalType:
                "HOME"
        }
    }


    /*
     * Reserve Region.
     */

    if(
        global.ModfusionBuildingReserveFallback ==
        null
    )
    {
        return null
    }


    var owner =
        global.ModfusionBuildingReserveFallback
            .getReserveOwner(
                level,
                regionX,
                regionZ
            )


    if(
        owner == null ||
        owner.home == null
    )
    {
        return null
    }


    return {

        homeRegionX:
            Number(
                owner.home.regionX
            ),

        homeRegionZ:
            Number(
                owner.home.regionZ
            ),

        buildingId:
            String(
                owner.buildingId
            ),

        physicalRegionX:
            regionX,

        physicalRegionZ:
            regionZ,

        physicalType:
            "RESERVE"
    }
}


/*
 * =========================================================
 * Resolve Home from block coordinate
 * =========================================================
 */

function getModfusionGenerationHomeForBlock(
    level,
    blockX,
    blockZ
)
{
    if(
        global.ModfusionBuildingDistributor ==
        null
    )
    {
        return null
    }


    var assignment =
        global.ModfusionBuildingDistributor
            .getAssignmentForBlock(
                level,
                blockX,
                blockZ
            )


    if(
        assignment == null ||
        assignment.status !== "OK"
    )
    {
        return null
    }


    return getModfusionGenerationHomeForRegion(
        level,
        assignment.regionX,
        assignment.regionZ
    )
}


/*
 * =========================================================
 * Add unique Home Slot
 * =========================================================
 */

function addModfusionActivationHome(
    map,
    list,
    homeRegionX,
    homeRegionZ,
    buildingId,
    sourceRegionX,
    sourceRegionZ
)
{
    homeRegionX =
        modfusionGenerationFloor(
            homeRegionX
        )


    homeRegionZ =
        modfusionGenerationFloor(
            homeRegionZ
        )


    var key =
        modfusionGenerationRegionKey(
            homeRegionX,
            homeRegionZ
        )


    if(map[key] === true)
    {
        return false
    }


    map[key] =
        true


    list.push({

        homeRegionX:
            homeRegionX,

        homeRegionZ:
            homeRegionZ,

        buildingId:
            buildingId != null
            ? String(buildingId)
            : null,

        discoveredFromRegionX:
            sourceRegionX,

        discoveredFromRegionZ:
            sourceRegionZ
    })


    return true
}


/*
 * =========================================================
 * Collect Activation closure
 * =========================================================
 *
 * 假设目标候选为：
 *
 * X/Z
 *
 * 最大 COMMON spacing = R
 *
 *
 * 我们检查：
 *
 * X-R ~ X+R
 * Z-R ~ Z+R
 *
 * 覆盖到的所有物理 Structure Regions。
 *
 *
 * 对每个 Region：
 *
 * HOME
 * → 加入 Home
 *
 * RESERVE
 * → 反查 owner Home
 *
 *
 * 这样可以处理：
 *
 * 一个很远的 Home
 * 最终通过 Reserve
 * 搬到目标建筑附近
 */

function collectModfusionActivationHomes(
    level,
    targetRecord
)
{
    var regionSize =
        getModfusionGenerationRegionSize()


    var spacingRadius =
        getModfusionMaximumCommonSpacing()


    var targetX =
        Number(
            targetRecord.x
        )


    var targetZ =
        Number(
            targetRecord.z
        )


    var minRegionX =
        Math.floor(
            (
                targetX -
                spacingRadius
            ) /
            regionSize
        )


    var maxRegionX =
        Math.floor(
            (
                targetX +
                spacingRadius
            ) /
            regionSize
        )


    var minRegionZ =
        Math.floor(
            (
                targetZ -
                spacingRadius
            ) /
            regionSize
        )


    var maxRegionZ =
        Math.floor(
            (
                targetZ +
                spacingRadius
            ) /
            regionSize
        )


    var homes = []

    var homeMap = {}


    /*
     * Target Home 必须始终包含。
     */

    addModfusionActivationHome(
        homeMap,
        homes,

        targetRecord.homeRegionX,
        targetRecord.homeRegionZ,
        targetRecord.buildingId,

        targetRecord.finalRegionX,
        targetRecord.finalRegionZ
    )


    var physicalRegionCount =
        0


    var regionX
    var regionZ


    for(
        regionX = minRegionX;
        regionX <= maxRegionX;
        regionX++
    )
    {
        for(
            regionZ = minRegionZ;
            regionZ <= maxRegionZ;
            regionZ++
        )
        {
            physicalRegionCount++


            var home =
                getModfusionGenerationHomeForRegion(
                    level,
                    regionX,
                    regionZ
                )


            if(home == null)
            {
                continue
            }


            addModfusionActivationHome(
                homeMap,
                homes,

                home.homeRegionX,
                home.homeRegionZ,
                home.buildingId,

                regionX,
                regionZ
            )
        }
    }


    /*
     * Stable order.
     *
     * ensure 顺序不能依赖 object enumeration。
     */

    homes.sort(
        function(a, b)
        {
            if(
                a.homeRegionX <
                b.homeRegionX
            )
            {
                return -1
            }


            if(
                a.homeRegionX >
                b.homeRegionX
            )
            {
                return 1
            }


            if(
                a.homeRegionZ <
                b.homeRegionZ
            )
            {
                return -1
            }


            if(
                a.homeRegionZ >
                b.homeRegionZ
            )
            {
                return 1
            }


            return 0
        }
    )


    return {

        regionSize:
            regionSize,

        spacingRadius:
            spacingRadius,

        minRegionX:
            minRegionX,

        maxRegionX:
            maxRegionX,

        minRegionZ:
            minRegionZ,

        maxRegionZ:
            maxRegionZ,

        physicalRegionCount:
            physicalRegionCount,

        homes:
            homes
    }
}


/*
 * =========================================================
 * Ensure all Activation Home Records
 * =========================================================
 */

function ensureModfusionActivationHomes(
    level,
    closure
)
{
    var created =
        0


    var cached =
        0


    var unresolved =
        0


    var ensured = []


    var i


    for(
        i = 0;
        i < closure.homes.length;
        i++
    )
    {
        var home =
            closure.homes[i]


        var result =
            global.ModfusionBuildingPlacementRecord
                .ensureHome(
                    level,
                    home.homeRegionX,
                    home.homeRegionZ
                )


        if(
            result == null ||
            result.status !== "OK"
        )
        {
            return {

                status:
                    "ERROR",

                reason:
                    (
                        result != null &&
                        result.reason != null
                    )
                    ? String(
                        result.reason
                    )
                    : "NEIGHBOR_RECORD_ENSURE_FAILED",

                failedHome:
                    home
            }
        }


        if(
            result.outcome !==
            "RECORD_AVAILABLE"
        )
        {
            return {

                status:
                    "ERROR",

                reason:
                    "EXPECTED_HOME_RECORD",

                failedHome:
                    home
            }
        }


        if(result.created === true)
        {
            created++
        }
        else
        {
            cached++
        }


        if(
            result.record != null &&
            String(
                result.record.placementState
            ) ===
            "UNRESOLVED"
        )
        {
            unresolved++
        }


        ensured.push({

            homeRegionX:
                home.homeRegionX,

            homeRegionZ:
                home.homeRegionZ,

            buildingId:
                home.buildingId,

            source:
                result.source,

            resolution:
                (
                    result.record != null
                    ? result.record.resolution
                    : null
                )
        })
    }


    return {

        status:
            "OK",

        created:
            created,

        cached:
            cached,

        unresolved:
            unresolved,

        ensured:
            ensured
    }
}


/*
 * =========================================================
 * Save Activation metadata
 * =========================================================
 */

function saveModfusionActivationMetadata(
    level,
    record,
    closure,
    status
)
{
    if(record == null)
    {
        return false
    }


    record.activationVersion =
        MODFUSION_ACTIVATION_VERSION


    record.activationStatus =
        String(
            status
        )


    record.activationSpacingRadius =
        closure.spacingRadius


    record.activationMinRegionX =
        closure.minRegionX


    record.activationMaxRegionX =
        closure.maxRegionX


    record.activationMinRegionZ =
        closure.minRegionZ


    record.activationMaxRegionZ =
        closure.maxRegionZ


    record.activationPhysicalRegionsChecked =
        closure.physicalRegionCount


    record.activationHomeSlotsChecked =
        closure.homes.length


    return global.ModfusionBuildingPlacementRecord
        .save(
            level,
            record
        )
}


/*
 * =========================================================
 * Generation Activation
 * =========================================================
 */

function activateModfusionNagaHome(
    level,
    homeRegionX,
    homeRegionZ
)
{
    /*
     * -----------------------------------------------------
     * Dependencies
     * -----------------------------------------------------
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
        !modfusionGenerationCorrectDimension(
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
        global.ModfusionBuildingSpacing ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "SPACING_SYSTEM_NOT_LOADED"
        }
    }


    if(
        global.ModfusionBuildingReserveFallback ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "RESERVE_SYSTEM_NOT_LOADED"
        }
    }


    /*
     * -----------------------------------------------------
     * Ensure target B4 record
     * -----------------------------------------------------
     */

    var targetEnsure =
        global.ModfusionBuildingPlacementRecord
            .ensureHome(
                level,
                homeRegionX,
                homeRegionZ
            )


    if(
        targetEnsure == null ||
        targetEnsure.status !== "OK" ||
        targetEnsure.outcome !== "RECORD_AVAILABLE"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "TARGET_RECORD_ENSURE_FAILED"
        }
    }


    var targetRecord =
        targetEnsure.record


    /*
     * -----------------------------------------------------
     * C1 only Naga
     * -----------------------------------------------------
     */

    if(
        String(
            targetRecord.buildingId
        ) !==
        MODFUSION_C1_BUILDING_ID
    )
    {
        return {

            status:
                "OK",

            outcome:
                "NOT_C1_NAGA",

            record:
                targetRecord
        }
    }


    /*
     * -----------------------------------------------------
     * Already generated
     * -----------------------------------------------------
     */

    if(targetRecord.generated === true)
    {
        return {

            status:
                "OK",

            outcome:
                "ALREADY_GENERATED",

            record:
                targetRecord
        }
    }


    /*
     * -----------------------------------------------------
     * No candidate
     * -----------------------------------------------------
     */

    if(
        targetRecord.x == null ||
        targetRecord.y == null ||
        targetRecord.z == null ||
        String(
            targetRecord.placementState
        ) ===
        "UNRESOLVED"
    )
    {
        return {

            status:
                "OK",

            outcome:
                "UNRESOLVED",

            record:
                targetRecord
        }
    }


    /*
     * -----------------------------------------------------
     * Collect nearby Home/Reserve ownership closure
     * -----------------------------------------------------
     */

    var closure =
        collectModfusionActivationHomes(
            level,
            targetRecord
        )


    /*
     * -----------------------------------------------------
     * Ensure every potentially conflicting Home
     * -----------------------------------------------------
     */

    var ensureReport =
        ensureModfusionActivationHomes(
            level,
            closure
        )


    if(
        ensureReport == null ||
        ensureReport.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                (
                    ensureReport != null &&
                    ensureReport.reason != null
                )
                ? ensureReport.reason
                : "ACTIVATION_ENSURE_FAILED",

            closure:
                closure,

            ensureReport:
                ensureReport
        }
    }


    /*
     * -----------------------------------------------------
     * Recalculate B5 after closure has been materialized
     * -----------------------------------------------------
     */

    var spacingReport =
        global.ModfusionBuildingSpacing
            .recalculateAll(
                level
            )


    if(
        spacingReport == null ||
        spacingReport.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "SPACING_RECALCULATION_FAILED",

            closure:
                closure,

            ensureReport:
                ensureReport
        }
    }


    /*
     * -----------------------------------------------------
     * Re-read target after B5
     * -----------------------------------------------------
     */

    targetRecord =
        global.ModfusionBuildingPlacementRecord
            .get(
                level,
                homeRegionX,
                homeRegionZ
            )


    if(targetRecord == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "TARGET_RECORD_DISAPPEARED"
        }
    }


    /*
     * -----------------------------------------------------
     * Target lost spacing competition
     * -----------------------------------------------------
     */

    if(
        String(
            targetRecord.spacingStatus
        ) !==
        "PASS"
    )
    {
        saveModfusionActivationMetadata(
            level,
            targetRecord,
            closure,
            "BLOCKED"
        )


        return {

            status:
                "OK",

            outcome:
                "BLOCKED_BY_SPACING",

            record:
                targetRecord,

            closure:
                closure,

            ensureReport:
                ensureReport,

            spacingReport:
                spacingReport
        }
    }


    /*
     * -----------------------------------------------------
     * Must now be READY_TO_GENERATE
     * -----------------------------------------------------
     */

    if(
        String(
            targetRecord.placementState
        ) !==
        "READY_TO_GENERATE"
    )
    {
        return {

            status:
                "OK",

            outcome:
                "NOT_READY",

            record:
                targetRecord,

            closure:
                closure,

            ensureReport:
                ensureReport,

            spacingReport:
                spacingReport
        }
    }


    /*
     * -----------------------------------------------------
     * Activation PASS
     * -----------------------------------------------------
     */

    saveModfusionActivationMetadata(
        level,
        targetRecord,
        closure,
        "PASS"
    )


    targetRecord =
        global.ModfusionBuildingPlacementRecord
            .get(
                level,
                homeRegionX,
                homeRegionZ
            )


    return {

        status:
            "OK",

        outcome:
            "ACTIVATED",

        record:
            targetRecord,

        closure:
            closure,

        ensureReport:
            ensureReport,

        spacingReport:
            spacingReport
    }
}


/*
 * =========================================================
 * Naga preload radius
 * =========================================================
 */

function getModfusionNagaPreloadRadius(
    record
)
{
    var radius =
        MODFUSION_C1_DEFAULT_PRELOAD_RADIUS


    if(
        global.ModfusionBuildingRegistry !=
        null
    )
    {
        var config =
            global.ModfusionBuildingRegistry
                .get(
                    record.buildingId
                )


        if(config != null)
        {
            /*
             * Optional future Registry override.
             */

            var configured =
                Number(
                    config.generationPreloadRadius
                )


            if(
                !isNaN(configured) &&
                configured > 0
            )
            {
                radius =
                    configured
            }
            else
            {
                var foundation =
                    Number(
                        config.foundationRadius
                    )


                if(
                    !isNaN(foundation) &&
                    foundation > 0
                )
                {
                    radius =
                        Math.max(
                            radius,
                            foundation +
                            24
                        )
                }
            }
        }
    }


    return Math.floor(
        radius
    )
}


/*
 * =========================================================
 * Preload structure footprint chunks
 * =========================================================
 */

function preloadModfusionNagaChunks(
    level,
    record
)
{
    var radius =
        getModfusionNagaPreloadRadius(
            record
        )


    var minChunkX =
        Math.floor(
            (
                Number(record.x) -
                radius
            ) /
            16
        )


    var maxChunkX =
        Math.floor(
            (
                Number(record.x) +
                radius
            ) /
            16
        )


    var minChunkZ =
        Math.floor(
            (
                Number(record.z) -
                radius
            ) /
            16
        )


    var maxChunkZ =
        Math.floor(
            (
                Number(record.z) +
                radius
            ) /
            16
        )


    var count =
        0


    var chunkX
    var chunkZ


    try
    {
        for(
            chunkX = minChunkX;
            chunkX <= maxChunkX;
            chunkX++
        )
        {
            for(
                chunkZ = minChunkZ;
                chunkZ <= maxChunkZ;
                chunkZ++
            )
            {
                level.getChunk(
                    chunkX,
                    chunkZ
                )


                count++
            }
        }
    }
    catch(error)
    {
        return {

            status:
                "ERROR",

            reason:
                "CHUNK_PRELOAD_FAILED",

            error:
                String(error),

            radius:
                radius,

            chunksLoaded:
                count
        }
    }


    return {

        status:
            "OK",

        radius:
            radius,

        minChunkX:
            minChunkX,

        maxChunkX:
            maxChunkX,

        minChunkZ:
            minChunkZ,

        maxChunkZ:
            maxChunkZ,

        chunksLoaded:
            count
    }
}


/*
 * =========================================================
 * Build structure command
 * =========================================================
 */

function getModfusionNagaStructureCommand(
    record
)
{
    var structureId =
        record.structureId != null
        ? String(
            record.structureId
        )
        : MODFUSION_C1_EXPECTED_STRUCTURE_ID


    return (
        "place structure " +
        structureId +
        " " +
        Math.floor(
            Number(record.x)
        ) +
        " " +
        Math.floor(
            Number(record.y)
        ) +
        " " +
        Math.floor(
            Number(record.z)
        )
    )
}


/*
 * =========================================================
 * Execute server command
 * =========================================================
 */

function runModfusionGenerationCommand(
    level,
    command
)
{
    if(
        level == null ||
        level.server == null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "SERVER_IS_NULL",

            result:
                0
        }
    }


    try
    {
        var result =
            level.server
                .getCommands()
                .performPrefixedCommand(
                    level.server
                        .createCommandSourceStack(),

                    command
                )


        return {

            status:
                "OK",

            result:
                Number(
                    result
                )
        }
    }
    catch(error)
    {
        return {

            status:
                "ERROR",

            reason:
                "COMMAND_EXCEPTION",

            error:
                String(error),

            result:
                0
        }
    }
}


/*
 * =========================================================
 * Persist PLACE_PENDING
 * =========================================================
 *
 * 这是一个重要的 crash-safety 标记。
 *
 * 在真正修改世界之前先保存：
 *
 * PLACE_PENDING
 *
 *
 * 如果服务器在 structure placement 后、
 * markGenerated 前崩溃：
 *
 * 下次不会自动再次 place，
 * 避免同一建筑重叠生成。
 */

function markModfusionGenerationPending(
    level,
    record,
    command
)
{
    record.generationVersion =
        MODFUSION_GENERATION_VERSION


    record.generationStatus =
        "PLACE_PENDING"


    record.generationCommand =
        String(
            command
        )


    record.generationCommandResult =
        null


    return global.ModfusionBuildingPlacementRecord
        .save(
            level,
            record
        )
}


/*
 * =========================================================
 * Persist failed command
 * =========================================================
 */

function markModfusionGenerationFailed(
    level,
    record,
    commandResult,
    reason
)
{
    record.generationVersion =
        MODFUSION_GENERATION_VERSION


    record.generated =
        false


    record.generationStatus =
        "PLACE_FAILED"


    record.generationCommandResult =
        Number(
            commandResult
        )


    record.generationFailureReason =
        reason != null
        ? String(
            reason
        )
        : null


    return global.ModfusionBuildingPlacementRecord
        .save(
            level,
            record
        )
}


/*
 * =========================================================
 * Real Naga generation
 * =========================================================
 */

function generateModfusionNagaHome(
    level,
    homeRegionX,
    homeRegionZ
)
{
    /*
     * -----------------------------------------------------
     * Ensure record first
     * -----------------------------------------------------
     */

    var ensure =
        global.ModfusionBuildingPlacementRecord
            .ensureHome(
                level,
                homeRegionX,
                homeRegionZ
            )


    if(
        ensure == null ||
        ensure.status !== "OK" ||
        ensure.outcome !== "RECORD_AVAILABLE"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "TARGET_RECORD_ENSURE_FAILED"
        }
    }


    var record =
        ensure.record


    /*
     * -----------------------------------------------------
     * Only Naga
     * -----------------------------------------------------
     */

    if(
        String(
            record.buildingId
        ) !==
        MODFUSION_C1_BUILDING_ID
    )
    {
        return {

            status:
                "OK",

            outcome:
                "NOT_C1_NAGA",

            record:
                record
        }
    }


    /*
     * -----------------------------------------------------
     * Already generated
     * -----------------------------------------------------
     */

    if(record.generated === true)
    {
        return {

            status:
                "OK",

            outcome:
                "ALREADY_GENERATED",

            record:
                record
        }
    }


    /*
     * -----------------------------------------------------
     * Ambiguous previous attempt
     * -----------------------------------------------------
     *
     * Never automatically retry PLACE_PENDING.
     */

    if(
        String(
            record.generationStatus
        ) ===
        "PLACE_PENDING"
    )
    {
        return {

            status:
                "OK",

            outcome:
                "AMBIGUOUS_PREVIOUS_ATTEMPT",

            record:
                record
        }
    }


    /*
     * -----------------------------------------------------
     * Activation
     * -----------------------------------------------------
     */

    var activation =
        activateModfusionNagaHome(
            level,
            homeRegionX,
            homeRegionZ
        )


    if(
        activation == null ||
        activation.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                (
                    activation != null &&
                    activation.reason != null
                )
                ? activation.reason
                : "ACTIVATION_FAILED",

            activation:
                activation
        }
    }


    if(
        activation.outcome !==
        "ACTIVATED"
    )
    {
        return {

            status:
                "OK",

            outcome:
                activation.outcome,

            record:
                activation.record,

            activation:
                activation
        }
    }


    record =
        activation.record


    /*
     * -----------------------------------------------------
     * Structure ID safety
     * -----------------------------------------------------
     */

    var structureId =
        record.structureId != null
        ? String(
            record.structureId
        )
        : MODFUSION_C1_EXPECTED_STRUCTURE_ID


    if(
        structureId !==
        MODFUSION_C1_EXPECTED_STRUCTURE_ID
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "UNEXPECTED_NAGA_STRUCTURE_ID",

            structureId:
                structureId
        }
    }


    /*
     * -----------------------------------------------------
     * Preload footprint
     * -----------------------------------------------------
     */

    var preload =
        preloadModfusionNagaChunks(
            level,
            record
        )


    if(
        preload == null ||
        preload.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "PRELOAD_FAILED",

            preload:
                preload,

            activation:
                activation
        }
    }


    /*
     * -----------------------------------------------------
     * Build command
     * -----------------------------------------------------
     */

    var command =
        getModfusionNagaStructureCommand(
            record
        )


    /*
     * -----------------------------------------------------
     * PLACE_PENDING before world mutation
     * -----------------------------------------------------
     */

    if(
        !markModfusionGenerationPending(
            level,
            record,
            command
        )
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "PLACE_PENDING_SAVE_FAILED"
        }
    }


    /*
     * -----------------------------------------------------
     * REAL WORLD MUTATION
     * -----------------------------------------------------
     */

    var commandReport =
        runModfusionGenerationCommand(
            level,
            command
        )


    /*
     * -----------------------------------------------------
     * Command exception / failure
     * -----------------------------------------------------
     */

    if(
        commandReport == null ||
        commandReport.status !== "OK" ||
        commandReport.result <= 0
    )
    {
        var failedRecord =
            global.ModfusionBuildingPlacementRecord
                .get(
                    level,
                    homeRegionX,
                    homeRegionZ
                )


        if(failedRecord != null)
        {
            markModfusionGenerationFailed(
                level,
                failedRecord,

                commandReport != null
                ? commandReport.result
                : 0,

                commandReport != null
                ? commandReport.reason
                : "UNKNOWN_COMMAND_FAILURE"
            )
        }


        return {

            status:
                "OK",

            outcome:
                "PLACE_FAILED",

            record:
                failedRecord,

            command:
                command,

            commandReport:
                commandReport,

            preload:
                preload,

            activation:
                activation
        }
    }


    /*
     * -----------------------------------------------------
     * Command returned success.
     *
     * ONLY NOW:
     *
     * generated = true
     * -----------------------------------------------------
     */

    var marked =
        global.ModfusionBuildingPlacementRecord
            .markGenerated(
                level,
                homeRegionX,
                homeRegionZ
            )


    /*
     * The structure may already physically exist.
     *
     * If persistence finalization failed,
     * leave PLACE_PENDING.
     *
     * Future calls will refuse duplicate placement.
     */

    if(!marked)
    {
        return {

            status:
                "OK",

            outcome:
                "PLACED_BUT_RECORD_FINALIZE_FAILED",

            command:
                command,

            commandReport:
                commandReport,

            preload:
                preload,

            activation:
                activation
        }
    }


    /*
     * -----------------------------------------------------
     * Optional command result metadata
     * -----------------------------------------------------
     */

    var finalRecord =
        global.ModfusionBuildingPlacementRecord
            .get(
                level,
                homeRegionX,
                homeRegionZ
            )


    if(finalRecord != null)
    {
        finalRecord.generationVersion =
            MODFUSION_GENERATION_VERSION


        finalRecord.generationCommand =
            command


        finalRecord.generationCommandResult =
            commandReport.result


        finalRecord.generationFailureReason =
            null


        /*
         * markGenerated already sets:
         *
         * generated = true
         * generationStatus = GENERATED
         * placementState = GENERATED
         */

        global.ModfusionBuildingPlacementRecord
            .save(
                level,
                finalRecord
            )
    }


    return {

        status:
            "OK",

        outcome:
            "GENERATED",

        record:
            finalRecord,

        command:
            command,

        commandReport:
            commandReport,

        preload:
            preload,

        activation:
            activation
    }
}


/*
 * =========================================================
 * Messages
 * =========================================================
 */

function modfusionGenerationMessage(
    player,
    message
)
{
    console.log(
        "[ModFusion Generation] " +
        message
    )


    if(player != null)
    {
        player.tell(
            "[ModFusion Generation] " +
            message
        )
    }
}


/*
 * =========================================================
 * Print Activation
 * =========================================================
 */

function printModfusionActivationReport(
    player,
    report
)
{
    if(report == null)
    {
        modfusionGenerationMessage(
            player,
            "ERROR: activation report is null."
        )


        return
    }


    if(report.status !== "OK")
    {
        modfusionGenerationMessage(
            player,
            "ERROR: " +
            report.reason
        )


        return
    }


    modfusionGenerationMessage(
        player,
        "================================"
    )


    modfusionGenerationMessage(
        player,
        "Activation outcome: " +
        report.outcome
    )


    if(report.record != null)
    {
        modfusionGenerationMessage(
            player,
            "Building: " +
            report.record.buildingId
        )


        modfusionGenerationMessage(
            player,
            "Home Region: " +
            report.record.homeRegionX +
            " " +
            report.record.homeRegionZ
        )


        if(
            report.record.x != null
        )
        {
            modfusionGenerationMessage(
                player,
                "Candidate: " +
                report.record.x +
                " " +
                report.record.y +
                " " +
                report.record.z
            )
        }


        modfusionGenerationMessage(
            player,
            "Spacing: " +
            report.record.spacingStatus
        )


        modfusionGenerationMessage(
            player,
            "Placement state: " +
            report.record.placementState
        )
    }


    if(report.closure != null)
    {
        modfusionGenerationMessage(
            player,
            "--------------------------------"
        )


        modfusionGenerationMessage(
            player,
            "Activation spacing radius: " +
            report.closure.spacingRadius
        )


        modfusionGenerationMessage(
            player,
            "Physical Region range: X " +
            report.closure.minRegionX +
            " ~ " +
            report.closure.maxRegionX +
            ", Z " +
            report.closure.minRegionZ +
            " ~ " +
            report.closure.maxRegionZ
        )


        modfusionGenerationMessage(
            player,
            "Physical Regions checked: " +
            report.closure.physicalRegionCount
        )


        modfusionGenerationMessage(
            player,
            "Unique Home Slots checked: " +
            report.closure.homes.length
        )
    }


    if(report.ensureReport != null)
    {
        modfusionGenerationMessage(
            player,
            "Records created: " +
            report.ensureReport.created
        )


        modfusionGenerationMessage(
            player,
            "Records cached: " +
            report.ensureReport.cached
        )


        modfusionGenerationMessage(
            player,
            "Unresolved nearby Slots: " +
            report.ensureReport.unresolved
        )
    }


    modfusionGenerationMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Print generation result
 * =========================================================
 */

function printModfusionGenerationReport(
    player,
    report
)
{
    if(report == null)
    {
        modfusionGenerationMessage(
            player,
            "ERROR: generation report is null."
        )


        return
    }


    if(report.status !== "OK")
    {
        modfusionGenerationMessage(
            player,
            "ERROR: " +
            report.reason
        )


        return
    }


    modfusionGenerationMessage(
        player,
        "================================"
    )


    modfusionGenerationMessage(
        player,
        "Generation outcome: " +
        report.outcome
    )


    if(report.record != null)
    {
        modfusionGenerationMessage(
            player,
            "Building: " +
            report.record.buildingId
        )


        modfusionGenerationMessage(
            player,
            "Home Region: " +
            report.record.homeRegionX +
            " " +
            report.record.homeRegionZ
        )


        if(report.record.x != null)
        {
            modfusionGenerationMessage(
                player,
                "Requested anchor: " +
                report.record.x +
                " " +
                report.record.y +
                " " +
                report.record.z
            )
        }


        modfusionGenerationMessage(
            player,
            "Spacing: " +
            report.record.spacingStatus
        )


        modfusionGenerationMessage(
            player,
            "Placement state: " +
            report.record.placementState
        )


        modfusionGenerationMessage(
            player,
            "Generated: " +
            report.record.generated
        )


        modfusionGenerationMessage(
            player,
            "Generation status: " +
            report.record.generationStatus
        )
    }


    if(report.preload != null)
    {
        modfusionGenerationMessage(
            player,
            "--------------------------------"
        )


        modfusionGenerationMessage(
            player,
            "Preload radius: " +
            report.preload.radius
        )


        modfusionGenerationMessage(
            player,
            "Chunks loaded: " +
            report.preload.chunksLoaded
        )
    }


    if(report.command != null)
    {
        modfusionGenerationMessage(
            player,
            "Command: " +
            report.command
        )
    }


    if(report.commandReport != null)
    {
        modfusionGenerationMessage(
            player,
            "Command result: " +
            report.commandReport.result
        )
    }


    /*
     * Special safety explanations.
     */

    if(
        report.outcome ===
        "AMBIGUOUS_PREVIOUS_ATTEMPT"
    )
    {
        modfusionGenerationMessage(
            player,
            "Automatic retry refused."
        )


        modfusionGenerationMessage(
            player,
            "Previous state is PLACE_PENDING; inspect the world before changing the record."
        )
    }


    if(
        report.outcome ===
        "PLACED_BUT_RECORD_FINALIZE_FAILED"
    )
    {
        modfusionGenerationMessage(
            player,
            "WARNING: command reported placement success."
        )


        modfusionGenerationMessage(
            player,
            "Record finalization failed; automatic retry is intentionally blocked."
        )
    }


    modfusionGenerationMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */

global.ModfusionBuildingGeneration = {

    getHomeForRegion:
        getModfusionGenerationHomeForRegion,

    getHomeForBlock:
        getModfusionGenerationHomeForBlock,

    collectActivationHomes:
        collectModfusionActivationHomes,

    activateNaga:
        activateModfusionNagaHome,

    generateNaga:
        generateModfusionNagaHome,

    preloadNaga:
        preloadModfusionNagaChunks
}


/*
 * =========================================================
 * Test command #1
 *
 * SAFE DRY ACTIVATION
 * =========================================================
 *
 * /kubejs custom_command modfusion_activate_naga
 *
 *
 * Does:
 *
 * ensure target B4
 * ensure nearby possible conflicts
 * recalculate B5
 *
 *
 * DOES NOT:
 *
 * /place structure
 * generated=true
 */

ServerEvents.customCommand(
    "modfusion_activate_naga",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Generation] Command must be run by a player."
            )


            return
        }


        if(
            !modfusionGenerationCorrectDimension(
                player.level
            )
        )
        {
            modfusionGenerationMessage(
                player,
                "ERROR: wrong dimension."
            )


            return
        }


        var home =
            getModfusionGenerationHomeForBlock(
                player.level,

                Math.floor(
                    player.x
                ),

                Math.floor(
                    player.z
                )
            )


        if(home == null)
        {
            modfusionGenerationMessage(
                player,
                "ERROR: could not resolve Home ownership."
            )


            return
        }


        modfusionGenerationMessage(
            player,
            "Current physical Region type: " +
            home.physicalType
        )


        modfusionGenerationMessage(
            player,
            "Owner Home Region: " +
            home.homeRegionX +
            " " +
            home.homeRegionZ
        )


        var report =
            activateModfusionNagaHome(
                player.level,
                home.homeRegionX,
                home.homeRegionZ
            )


        printModfusionActivationReport(
            player,
            report
        )
    }
)


/*
 * =========================================================
 * Test command #2
 *
 * REAL GENERATION
 * =========================================================
 *
 * /kubejs custom_command modfusion_generate_naga
 *
 *
 * WARNING:
 *
 * This command can actually modify the world.
 */

ServerEvents.customCommand(
    "modfusion_generate_naga",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Generation] Command must be run by a player."
            )


            return
        }


        if(
            !modfusionGenerationCorrectDimension(
                player.level
            )
        )
        {
            modfusionGenerationMessage(
                player,
                "ERROR: wrong dimension."
            )


            return
        }


        var home =
            getModfusionGenerationHomeForBlock(
                player.level,

                Math.floor(
                    player.x
                ),

                Math.floor(
                    player.z
                )
            )


        if(home == null)
        {
            modfusionGenerationMessage(
                player,
                "ERROR: could not resolve Home ownership."
            )


            return
        }


        modfusionGenerationMessage(
            player,
            "Current physical Region type: " +
            home.physicalType
        )


        modfusionGenerationMessage(
            player,
            "Owner Home Region: " +
            home.homeRegionX +
            " " +
            home.homeRegionZ
        )


        var report =
            generateModfusionNagaHome(
                player.level,
                home.homeRegionX,
                home.homeRegionZ
            )


        printModfusionGenerationReport(
            player,
            report
        )
    }
)


console.log(
    "[ModFusion Generation] Ready."
)