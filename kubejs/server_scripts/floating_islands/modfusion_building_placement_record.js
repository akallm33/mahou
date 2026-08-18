console.log(
    "[ModFusion Placement Record] Script loaded"
)


/*
 * =========================================================
 * Settings
 * =========================================================
 */

var MODFUSION_PLACEMENT_RECORD_DIMENSION_ID =
    "mahou:modfusion_dimension"


/*
 * Record schema version.
 *
 * 这不是 Distributor / Candidate / Reserve 的版本。
 *
 * 它只表示：
 * persistentData 中这条记录本身的数据结构版本。
 */

var MODFUSION_PLACEMENT_RECORD_VERSION =
    1


/*
 * 每个 Home Region 一条记录。
 *
 * 示例：
 *
 * mahouModfusionBuildingRecord_-1_-1
 *
 * Reserve Region 不单独创建记录。
 * 它属于对应 Home Slot 的记录。
 */

var MODFUSION_PLACEMENT_RECORD_PREFIX =
    "mahouModfusionBuildingRecord_"


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */

function modfusionPlacementRecordIsCorrectDimension(
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
        MODFUSION_PLACEMENT_RECORD_DIMENSION_ID
    )
}


function modfusionPlacementRecordNormalizeRegion(
    value
)
{
    return Math.floor(
        Number(value)
    )
}


/*
 * =========================================================
 * Record key
 * =========================================================
 */

function getModfusionPlacementRecordKey(
    homeRegionX,
    homeRegionZ
)
{
    homeRegionX =
        modfusionPlacementRecordNormalizeRegion(
            homeRegionX
        )


    homeRegionZ =
        modfusionPlacementRecordNormalizeRegion(
            homeRegionZ
        )


    return (
        MODFUSION_PLACEMENT_RECORD_PREFIX +
        homeRegionX +
        "_" +
        homeRegionZ
    )
}


/*
 * =========================================================
 * JSON helpers
 * =========================================================
 */

function parseModfusionPlacementRecord(
    text
)
{
    if(text == null)
    {
        return null
    }


    text =
        String(text)


    if(
        text.length === 0
    )
    {
        return null
    }


    try
    {
        return JSON.parse(
            text
        )
    }
    catch(error)
    {
        console.log(
            "[ModFusion Placement Record] JSON parse failed: " +
            error
        )


        return null
    }
}


function stringifyModfusionPlacementRecord(
    record
)
{
    try
    {
        return JSON.stringify(
            record
        )
    }
    catch(error)
    {
        console.log(
            "[ModFusion Placement Record] JSON stringify failed: " +
            error
        )


        return null
    }
}


/*
 * =========================================================
 * Read record
 * =========================================================
 */

function getModfusionPlacementRecord(
    level,
    homeRegionX,
    homeRegionZ
)
{
    if(
        !modfusionPlacementRecordIsCorrectDimension(
            level
        )
    )
    {
        return null
    }


    var data =
        level.persistentData


    if(data == null)
    {
        return null
    }


    var key =
        getModfusionPlacementRecordKey(
            homeRegionX,
            homeRegionZ
        )


    var raw


    try
    {
        raw =
            data.getString(
                key
            )
    }
    catch(error)
    {
        console.log(
            "[ModFusion Placement Record] Read failed for " +
            key +
            ": " +
            error
        )


        return null
    }


    return parseModfusionPlacementRecord(
        raw
    )
}


/*
 * =========================================================
 * Save record
 * =========================================================
 */

function saveModfusionPlacementRecord(
    level,
    record
)
{
    if(
        !modfusionPlacementRecordIsCorrectDimension(
            level
        )
    )
    {
        return false
    }


    if(record == null)
    {
        return false
    }


    if(
        record.homeRegionX == null ||
        record.homeRegionZ == null
    )
    {
        return false
    }


    var text =
        stringifyModfusionPlacementRecord(
            record
        )


    if(text == null)
    {
        return false
    }


    var key =
        getModfusionPlacementRecordKey(
            record.homeRegionX,
            record.homeRegionZ
        )


    try
    {
        level.persistentData
            .putString(
                key,
                text
            )
    }
    catch(error)
    {
        console.log(
            "[ModFusion Placement Record] Save failed for " +
            key +
            ": " +
            error
        )


        return false
    }


    /*
     * -----------------------------------------------------
     * Verify
     * -----------------------------------------------------
     */

    var verify =
        getModfusionPlacementRecord(
            level,
            record.homeRegionX,
            record.homeRegionZ
        )


    if(verify == null)
    {
        console.log(
            "[ModFusion Placement Record] Verification failed for " +
            key
        )


        return false
    }


    return true
}


/*
 * =========================================================
 * Delete record
 * =========================================================
 *
 * 暂时只作为开发 API。
 *
 * 没有绑定普通测试命令，
 * 防止误删。
 */

function removeModfusionPlacementRecord(
    level,
    homeRegionX,
    homeRegionZ
)
{
    if(
        !modfusionPlacementRecordIsCorrectDimension(
            level
        )
    )
    {
        return false
    }


    var key =
        getModfusionPlacementRecordKey(
            homeRegionX,
            homeRegionZ
        )


    try
    {
        level.persistentData
            .remove(
                key
            )


        return true
    }
    catch(error)
    {
        console.log(
            "[ModFusion Placement Record] Remove failed for " +
            key +
            ": " +
            error
        )


        return false
    }
}


/*
 * =========================================================
 * Extract analyzer snapshot
 * =========================================================
 *
 * 不保存整个 Analyzer result。
 *
 * 只保存以后调试 / B5 真正有价值的数据。
 */

function getModfusionPlacementAnalyzerSnapshot(
    selected
)
{
    if(
        selected == null ||
        selected.analyzer == null
    )
    {
        return null
    }


    var analyzer =
        selected.analyzer


    return {

        centerBiomePass:
            analyzer.centerBiomePass === true,

        biomeCoverage:
            Number(
                analyzer.biomeCoverage
            ),

        minBiomeCoverage:
            Number(
                analyzer.minBiomeCoverage
            ),

        biomeCoveragePass:
            analyzer.biomeCoveragePass === true,

        foundationRadius:
            Number(
                analyzer.foundationRadius
            ),

        foundationStablePoints:
            Number(
                analyzer.foundationStablePoints
            ),

        foundationTotalPoints:
            Number(
                analyzer.foundationTotalPoints
            ),

        minFoundationPoints:
            Number(
                analyzer.minFoundationPoints
            ),

        foundationPass:
            analyzer.foundationPass === true,

        terrainCoverage:
            Number(
                analyzer.terrainCoverage
            ),

        maxHeightDifference:
            Number(
                analyzer.maxHeightDifference
            )
    }
}


/*
 * =========================================================
 * Build persistent record from B3.2 result
 * =========================================================
 */

function buildModfusionPlacementRecord(
    level,
    resolution
)
{
    if(resolution == null)
    {
        return null
    }


    if(resolution.status !== "OK")
    {
        return null
    }


    if(
        resolution.buildingId == null ||
        resolution.homeRegionX == null ||
        resolution.homeRegionZ == null
    )
    {
        return null
    }


    var homeRegionX =
        modfusionPlacementRecordNormalizeRegion(
            resolution.homeRegionX
        )


    var homeRegionZ =
        modfusionPlacementRecordNormalizeRegion(
            resolution.homeRegionZ
        )


    var buildingId =
        String(
            resolution.buildingId
        )


    /*
     * =====================================================
     * Registry snapshot
     * =====================================================
     */

    var config =
        null


    if(
        global.ModfusionBuildingRegistry !=
        null
    )
    {
        config =
            global.ModfusionBuildingRegistry
                .get(
                    buildingId
                )
    }


    var structureId =
        null


    var placementType =
        null


    var regionPolicy =
        null


    if(config != null)
    {
        if(config.structureId != null)
        {
            structureId =
                String(
                    config.structureId
                )
        }


        if(config.placementType != null)
        {
            placementType =
                String(
                    config.placementType
                )
        }


        if(config.regionPolicy != null)
        {
            regionPolicy =
                String(
                    config.regionPolicy
                )
        }
    }


    /*
     * =====================================================
     * Super Region
     * =====================================================
     */

    var superX =
        null


    var superZ =
        null


    if(
        global.ModfusionBuildingDistributor !=
        null
    )
    {
        try
        {
            var superInfo =
                global.ModfusionBuildingDistributor
                    .getSuperRegion(
                        homeRegionX,
                        homeRegionZ
                    )


            if(superInfo != null)
            {
                superX =
                    Number(
                        superInfo.superX
                    )


                superZ =
                    Number(
                        superInfo.superZ
                    )
            }
        }
        catch(error)
        {
            /*
             * Non-fatal.
             */
        }
    }


    /*
     * =====================================================
     * Version snapshots
     * =====================================================
     */

    var distributionVersion =
        null


    if(
        global.ModfusionBuildingDistributor !=
        null
    )
    {
        try
        {
            var assignment =
                global.ModfusionBuildingDistributor
                    .getAssignmentForRegion(
                        level,
                        homeRegionX,
                        homeRegionZ
                    )


            if(
                assignment != null &&
                assignment.status === "OK" &&
                assignment.plan != null &&
                assignment.plan.version != null
            )
            {
                distributionVersion =
                    Number(
                        assignment.plan.version
                    )
            }
        }
        catch(error2)
        {
            /*
             * Non-fatal.
             */
        }
    }


    var candidateVersion =
        null


    if(
        resolution.homeSearch != null &&
        resolution.homeSearch.version != null
    )
    {
        candidateVersion =
            Number(
                resolution.homeSearch.version
            )
    }
    else if(
        resolution.reserveSearch != null &&
        resolution.reserveSearch.version != null
    )
    {
        candidateVersion =
            Number(
                resolution.reserveSearch.version
            )
    }


    var reserveVersion =
        null


    if(resolution.version != null)
    {
        reserveVersion =
            Number(
                resolution.version
            )
    }


    /*
     * =====================================================
     * Search outcome snapshots
     * =====================================================
     */

    var homeSearchOutcome =
        null


    var reserveSearchOutcome =
        null


    if(
        resolution.homeSearch != null &&
        resolution.homeSearch.outcome != null
    )
    {
        homeSearchOutcome =
            String(
                resolution.homeSearch.outcome
            )
    }


    if(
        resolution.reserveSearch != null &&
        resolution.reserveSearch.outcome != null
    )
    {
        reserveSearchOutcome =
            String(
                resolution.reserveSearch.outcome
            )
    }


    /*
     * =====================================================
     * Base record
     * =====================================================
     */

    var record = {

        /*
         * Record identity
         */

        recordVersion:
            MODFUSION_PLACEMENT_RECORD_VERSION,

        recordId:
            (
                homeRegionX +
                "," +
                homeRegionZ
            ),


        /*
         * Algorithm versions
         */

        distributionVersion:
            distributionVersion,

        candidateVersion:
            candidateVersion,

        reserveVersion:
            reserveVersion,


        /*
         * Structure
         */

        buildingId:
            buildingId,

        structureId:
            structureId,

        placementType:
            placementType,

        regionPolicy:
            regionPolicy,


        /*
         * Super Region
         */

        superX:
            superX,

        superZ:
            superZ,


        /*
         * Home ownership
         */

        homeRegionX:
            homeRegionX,

        homeRegionZ:
            homeRegionZ,


        /*
         * Paired Reserve
         */

        reserveRegionX:
            (
                resolution.reserveRegionX != null
                ? Number(
                    resolution.reserveRegionX
                )
                : null
            ),

        reserveRegionZ:
            (
                resolution.reserveRegionZ != null
                ? Number(
                    resolution.reserveRegionZ
                )
                : null
            ),


        /*
         * B3.2 resolution
         */

        resolution:
            String(
                resolution.outcome
            ),

        resolutionReason:
            (
                resolution.reason != null
                ? String(
                    resolution.reason
                )
                : null
            ),

        homeSearchOutcome:
            homeSearchOutcome,

        reserveSearchOutcome:
            reserveSearchOutcome,

        usedReserve:
            resolution.usedReserve === true,


        /*
         * Physical final Region
         */

        finalRegionX:
            (
                resolution.finalRegionX != null
                ? Number(
                    resolution.finalRegionX
                )
                : null
            ),

        finalRegionZ:
            (
                resolution.finalRegionZ != null
                ? Number(
                    resolution.finalRegionZ
                )
                : null
            ),


        /*
         * Current pipeline state
         *
         * B5 尚未执行。
         */

        placementState:
            (
                resolution.selected != null
                ? "CANDIDATE_RESOLVED"
                : "UNRESOLVED"
            ),

        spacingStatus:
            "NOT_CHECKED",


        /*
         * Actual generation state
         */

        generated:
            false,

        generationStatus:
            "NOT_GENERATED"
    }


    /*
     * =====================================================
     * Selected candidate
     * =====================================================
     */

    if(resolution.selected != null)
    {
        var selected =
            resolution.selected


        record.x =
            Number(
                selected.x
            )


        record.y =
            Number(
                selected.y
            )


        record.z =
            Number(
                selected.z
            )


        record.layer =
            (
                selected.layer != null
                ? String(
                    selected.layer
                )
                : null
            )


        record.biome =
            (
                selected.biome != null
                ? String(
                    selected.biome
                )
                : null
            )


        record.cheapStablePoints =
            (
                selected.cheapStablePoints != null
                ? Number(
                    selected.cheapStablePoints
                )
                : null
            )


        record.cheapTotalPoints =
            (
                selected.cheapTotalPoints != null
                ? Number(
                    selected.cheapTotalPoints
                )
                : null
            )


        record.analyzer =
            getModfusionPlacementAnalyzerSnapshot(
                selected
            )
    }
    else
    {
        record.x =
            null

        record.y =
            null

        record.z =
            null

        record.layer =
            null

        record.biome =
            null

        record.cheapStablePoints =
            null

        record.cheapTotalPoints =
            null

        record.analyzer =
            null
    }


    return record
}


/*
 * =========================================================
 * Ensure one Home Placement Record
 * =========================================================
 *
 * 这是 B4 最核心的入口。
 *
 *
 * Existing:
 *
 * persistentData
 *      ↓
 * CACHED
 *      ↓
 * 不重新跑 B3.2
 *
 *
 * Missing:
 *
 * B3.2
 *      ↓
 * build record
 *      ↓
 * persistentData
 */

function ensureModfusionPlacementRecordForHome(
    level,
    homeRegionX,
    homeRegionZ
)
{
    /*
     * =====================================================
     * Basic checks
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
        !modfusionPlacementRecordIsCorrectDimension(
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
        global.ModfusionBuildingDistributor ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "DISTRIBUTOR_NOT_LOADED"
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
                "RESERVE_FALLBACK_NOT_LOADED"
        }
    }


    homeRegionX =
        modfusionPlacementRecordNormalizeRegion(
            homeRegionX
        )


    homeRegionZ =
        modfusionPlacementRecordNormalizeRegion(
            homeRegionZ
        )


    /*
     * =====================================================
     * Existing record
     * =====================================================
     */

    var existing =
        getModfusionPlacementRecord(
            level,
            homeRegionX,
            homeRegionZ
        )


    if(existing != null)
    {
        return {

            status:
                "OK",

            outcome:
                "RECORD_AVAILABLE",

            source:
                "CACHED",

            created:
                false,

            record:
                existing
        }
    }


    /*
     * =====================================================
     * Confirm Home Region
     * =====================================================
     */

    var assignment =
        global.ModfusionBuildingDistributor
            .getAssignmentForRegion(
                level,
                homeRegionX,
                homeRegionZ
            )


    if(
        assignment == null ||
        assignment.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "REGION_ASSIGNMENT_FAILED"
        }
    }


    if(!assignment.active)
    {
        return {

            status:
                "OK",

            outcome:
                "RESERVE_REGION",

            source:
                "NONE",

            created:
                false,

            regionX:
                homeRegionX,

            regionZ:
                homeRegionZ,

            record:
                null
        }
    }


    /*
     * =====================================================
     * B3.2 resolution
     * =====================================================
     */

    var resolution =
        global.ModfusionBuildingReserveFallback
            .resolveHome(
                level,
                homeRegionX,
                homeRegionZ
            )


    if(
        resolution == null ||
        resolution.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                (
                    resolution != null &&
                    resolution.reason != null
                )
                ? String(
                    resolution.reason
                )
                : "RESOLUTION_FAILED"
        }
    }


    /*
     * =====================================================
     * Build record
     * =====================================================
     */

    var record =
        buildModfusionPlacementRecord(
            level,
            resolution
        )


    if(record == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "RECORD_BUILD_FAILED"
        }
    }


    /*
     * =====================================================
     * Save
     * =====================================================
     */

    if(
        !saveModfusionPlacementRecord(
            level,
            record
        )
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "RECORD_SAVE_FAILED"
        }
    }


    return {

        status:
            "OK",

        outcome:
            "RECORD_AVAILABLE",

        source:
            "CREATED",

        created:
            true,

        record:
            record
    }
}


/*
 * =========================================================
 * Resolve Placement Record from player's physical Region
 * =========================================================
 *
 * HOME:
 *
 * ensure Home record.
 *
 *
 * RESERVE:
 *
 * 不创建独立 Record。
 *
 * 只告诉我们：
 *
 * 它属于哪个 Home，
 * 以及那个 Home 有没有已经存在的 Record。
 */

function ensureModfusionPlacementRecordForBlock(
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
        return {

            status:
                "ERROR",

            reason:
                "DISTRIBUTOR_NOT_LOADED"
        }
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
        return {

            status:
                "ERROR",

            reason:
                "BLOCK_ASSIGNMENT_FAILED"
        }
    }


    /*
     * =====================================================
     * Home
     * =====================================================
     */

    if(assignment.active)
    {
        return ensureModfusionPlacementRecordForHome(
            level,
            assignment.regionX,
            assignment.regionZ
        )
    }


    /*
     * =====================================================
     * Reserve
     * =====================================================
     */

    if(
        global.ModfusionBuildingReserveFallback ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "RESERVE_FALLBACK_NOT_LOADED"
        }
    }


    var owner =
        global.ModfusionBuildingReserveFallback
            .getReserveOwner(
                level,
                assignment.regionX,
                assignment.regionZ
            )


    if(owner == null)
    {
        return {

            status:
                "OK",

            outcome:
                "RESERVE_REGION",

            source:
                "NONE",

            regionX:
                assignment.regionX,

            regionZ:
                assignment.regionZ,

            owner:
                null,

            ownerRecord:
                null
        }
    }


    var ownerRecord =
        getModfusionPlacementRecord(
            level,
            owner.home.regionX,
            owner.home.regionZ
        )


    return {

        status:
            "OK",

        outcome:
            "RESERVE_REGION",

        source:
            "NONE",

        regionX:
            assignment.regionX,

        regionZ:
            assignment.regionZ,

        owner:
            owner,

        ownerRecord:
            ownerRecord
    }
}


/*
 * =========================================================
 * Enumerate all records
 * =========================================================
 *
 * B5 Spacing 会直接使用这里。
 */

function getAllModfusionPlacementRecords(
    level
)
{
    var result = []


    if(
        !modfusionPlacementRecordIsCorrectDimension(
            level
        )
    )
    {
        return result
    }


    var data =
        level.persistentData


    if(data == null)
    {
        return result
    }


    var keys


    try
    {
        keys =
            data.getAllKeys()
    }
    catch(error)
    {
        console.log(
            "[ModFusion Placement Record] getAllKeys failed: " +
            error
        )


        return result
    }


    if(keys == null)
    {
        return result
    }


    var iterator =
        keys.iterator()


    while(
        iterator.hasNext()
    )
    {
        var key =
            String(
                iterator.next()
            )


        if(
            key.indexOf(
                MODFUSION_PLACEMENT_RECORD_PREFIX
            ) !==
            0
        )
        {
            continue
        }


        var raw


        try
        {
            raw =
                data.getString(
                    key
                )
        }
        catch(error2)
        {
            continue
        }


        var record =
            parseModfusionPlacementRecord(
                raw
            )


        if(record != null)
        {
            result.push(
                record
            )
        }
    }


    /*
     * Stable output order.
     */

    result.sort(
        function(a, b)
        {
            var aSuperX =
                Number(a.superX)

            var bSuperX =
                Number(b.superX)


            if(aSuperX < bSuperX)
            {
                return -1
            }


            if(aSuperX > bSuperX)
            {
                return 1
            }


            var aSuperZ =
                Number(a.superZ)

            var bSuperZ =
                Number(b.superZ)


            if(aSuperZ < bSuperZ)
            {
                return -1
            }


            if(aSuperZ > bSuperZ)
            {
                return 1
            }


            var aHomeX =
                Number(a.homeRegionX)

            var bHomeX =
                Number(b.homeRegionX)


            if(aHomeX < bHomeX)
            {
                return -1
            }


            if(aHomeX > bHomeX)
            {
                return 1
            }


            var aHomeZ =
                Number(a.homeRegionZ)

            var bHomeZ =
                Number(b.homeRegionZ)


            if(aHomeZ < bHomeZ)
            {
                return -1
            }


            if(aHomeZ > bHomeZ)
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
 * Mark spacing result
 * =========================================================
 *
 * B5 会调用。
 *
 * 当前 B4 测试不会调用。
 */

function setModfusionPlacementSpacingStatus(
    level,
    homeRegionX,
    homeRegionZ,
    status
)
{
    var record =
        getModfusionPlacementRecord(
            level,
            homeRegionX,
            homeRegionZ
        )


    if(record == null)
    {
        return false
    }


    record.spacingStatus =
        String(
            status
        )


    if(
        String(status) ===
        "PASS"
    )
    {
        if(
            record.placementState ===
            "CANDIDATE_RESOLVED"
        )
        {
            record.placementState =
                "READY_TO_GENERATE"
        }
    }
    else if(
        String(status) ===
        "FAIL"
    )
    {
        if(
            record.placementState !==
            "UNRESOLVED"
        )
        {
            record.placementState =
                "SPACING_CONFLICT"
        }
    }


    return saveModfusionPlacementRecord(
        level,
        record
    )
}


/*
 * =========================================================
 * Mark generated
 * =========================================================
 *
 * IMPORTANT:
 *
 * 以后只有真正执行：
 *
 * /place structure
 *
 * 并确认成功以后，
 * 才调用这个函数。
 *
 *
 * B4 本身绝对不会调用它。
 */

function markModfusionPlacementGenerated(
    level,
    homeRegionX,
    homeRegionZ
)
{
    var record =
        getModfusionPlacementRecord(
            level,
            homeRegionX,
            homeRegionZ
        )


    if(record == null)
    {
        return false
    }


    if(
        record.selected == null &&
        (
            record.x == null ||
            record.y == null ||
            record.z == null
        )
    )
    {
        return false
    }


    /*
     * 必须经过 B5。
     */

    if(
        String(
            record.spacingStatus
        ) !==
        "PASS"
    )
    {
        console.log(
            "[ModFusion Placement Record] Refusing generated=true before spacing PASS: " +
            homeRegionX +
            "," +
            homeRegionZ
        )


        return false
    }


    record.generated =
        true


    record.generationStatus =
        "GENERATED"


    record.placementState =
        "GENERATED"


    return saveModfusionPlacementRecord(
        level,
        record
    )
}


/*
 * =========================================================
 * Message helper
 * =========================================================
 */

function modfusionPlacementRecordMessage(
    player,
    message
)
{
    console.log(
        "[ModFusion Placement Record] " +
        message
    )


    if(player != null)
    {
        player.tell(
            "[ModFusion Placement Record] " +
            message
        )
    }
}


/*
 * =========================================================
 * Print one record
 * =========================================================
 */

function printModfusionPlacementRecord(
    player,
    record,
    source
)
{
    if(record == null)
    {
        modfusionPlacementRecordMessage(
            player,
            "Record: NONE"
        )


        return
    }


    modfusionPlacementRecordMessage(
        player,
        "Record source: " +
        source
    )


    modfusionPlacementRecordMessage(
        player,
        "Record version: " +
        record.recordVersion
    )


    modfusionPlacementRecordMessage(
        player,
        "Building: " +
        record.buildingId
    )


    modfusionPlacementRecordMessage(
        player,
        "Structure: " +
        record.structureId
    )


    modfusionPlacementRecordMessage(
        player,
        "Home Region: " +
        record.homeRegionX +
        " " +
        record.homeRegionZ
    )


    modfusionPlacementRecordMessage(
        player,
        "Paired Reserve: " +
        record.reserveRegionX +
        " " +
        record.reserveRegionZ
    )


    modfusionPlacementRecordMessage(
        player,
        "Resolution: " +
        record.resolution
    )


    if(record.resolutionReason != null)
    {
        modfusionPlacementRecordMessage(
            player,
            "Resolution reason: " +
            record.resolutionReason
        )
    }


    modfusionPlacementRecordMessage(
        player,
        "Used Reserve: " +
        record.usedReserve
    )


    modfusionPlacementRecordMessage(
        player,
        "Placement state: " +
        record.placementState
    )


    modfusionPlacementRecordMessage(
        player,
        "Spacing: " +
        record.spacingStatus
    )


    modfusionPlacementRecordMessage(
        player,
        "Generated: " +
        record.generated
    )


    /*
     * =====================================================
     * Valid candidate
     * =====================================================
     */

    if(
        record.x != null &&
        record.y != null &&
        record.z != null
    )
    {
        modfusionPlacementRecordMessage(
            player,
            "Final Region: " +
            record.finalRegionX +
            " " +
            record.finalRegionZ
        )


        modfusionPlacementRecordMessage(
            player,
            "Selected position: " +
            record.x +
            " " +
            record.y +
            " " +
            record.z
        )


        modfusionPlacementRecordMessage(
            player,
            "Layer: " +
            record.layer
        )


        modfusionPlacementRecordMessage(
            player,
            "Biome: " +
            record.biome
        )


        if(record.analyzer != null)
        {
            modfusionPlacementRecordMessage(
                player,
                "Biome coverage: " +
                (
                    Math.round(
                        Number(
                            record.analyzer.biomeCoverage
                        ) *
                        1000
                    ) /
                    10
                ) +
                "%"
            )


            modfusionPlacementRecordMessage(
                player,
                "Foundation: " +
                record.analyzer.foundationStablePoints +
                "/" +
                record.analyzer.foundationTotalPoints
            )
        }
    }
    else
    {
        modfusionPlacementRecordMessage(
            player,
            "Selected position: NONE"
        )
    }


    modfusionPlacementRecordMessage(
        player,
        "Versions: distribution=" +
        record.distributionVersion +
        " candidate=" +
        record.candidateVersion +
        " reserve=" +
        record.reserveVersion
    )
}


/*
 * =========================================================
 * Print ensure result
 * =========================================================
 */

function printModfusionPlacementEnsureResult(
    player,
    result
)
{
    if(result == null)
    {
        modfusionPlacementRecordMessage(
            player,
            "ERROR: result is null."
        )


        return
    }


    if(result.status !== "OK")
    {
        modfusionPlacementRecordMessage(
            player,
            "ERROR: " +
            result.reason
        )


        return
    }


    modfusionPlacementRecordMessage(
        player,
        "================================"
    )


    /*
     * =====================================================
     * Reserve Region
     * =====================================================
     */

    if(
        result.outcome ===
        "RESERVE_REGION"
    )
    {
        modfusionPlacementRecordMessage(
            player,
            "Current Region: " +
            result.regionX +
            " " +
            result.regionZ
        )


        modfusionPlacementRecordMessage(
            player,
            "Type: RESERVE"
        )


        if(result.owner != null)
        {
            modfusionPlacementRecordMessage(
                player,
                "Reserved for: " +
                result.owner.buildingId
            )


            modfusionPlacementRecordMessage(
                player,
                "Owner Home Region: " +
                result.owner.home.regionX +
                " " +
                result.owner.home.regionZ
            )


            if(result.ownerRecord != null)
            {
                modfusionPlacementRecordMessage(
                    player,
                    "Owner Placement Record: EXISTS"
                )


                modfusionPlacementRecordMessage(
                    player,
                    "Owner Resolution: " +
                    result.ownerRecord.resolution
                )
            }
            else
            {
                modfusionPlacementRecordMessage(
                    player,
                    "Owner Placement Record: NOT_CREATED"
                )
            }
        }
        else
        {
            modfusionPlacementRecordMessage(
                player,
                "Reserve owner: NONE"
            )
        }


        modfusionPlacementRecordMessage(
            player,
            "No independent Placement Record created."
        )


        modfusionPlacementRecordMessage(
            player,
            "================================"
        )


        return
    }


    /*
     * =====================================================
     * Home record
     * =====================================================
     */

    printModfusionPlacementRecord(
        player,
        result.record,
        result.source
    )


    modfusionPlacementRecordMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Print all records
 * =========================================================
 */

function printAllModfusionPlacementRecords(
    player,
    level
)
{
    var records =
        getAllModfusionPlacementRecords(
            level
        )


    modfusionPlacementRecordMessage(
        player,
        "================================"
    )


    modfusionPlacementRecordMessage(
        player,
        "Stored Placement Records: " +
        records.length
    )


    var i


    for(
        i = 0;
        i < records.length;
        i++
    )
    {
        var record =
            records[i]


        var line =
            "#" +
            (i + 1) +
            " HOME " +
            record.homeRegionX +
            "," +
            record.homeRegionZ +
            " | " +
            record.buildingId +
            " | " +
            record.resolution


        if(
            record.x != null &&
            record.z != null
        )
        {
            line +=
                " | POS " +
                record.x +
                "," +
                record.y +
                "," +
                record.z
        }


        line +=
            " | spacing=" +
            record.spacingStatus


        line +=
            " | generated=" +
            record.generated


        modfusionPlacementRecordMessage(
            player,
            line
        )
    }


    modfusionPlacementRecordMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */

global.ModfusionBuildingPlacementRecord = {

    getKey:
        getModfusionPlacementRecordKey,

    get:
        getModfusionPlacementRecord,

    getAll:
        getAllModfusionPlacementRecords,

    ensureHome:
        ensureModfusionPlacementRecordForHome,

    ensureBlock:
        ensureModfusionPlacementRecordForBlock,

    save:
        saveModfusionPlacementRecord,

    remove:
        removeModfusionPlacementRecord,

    setSpacingStatus:
        setModfusionPlacementSpacingStatus,

    markGenerated:
        markModfusionPlacementGenerated,

    print:
        printModfusionPlacementRecord,

    printAll:
        printAllModfusionPlacementRecords
}


/*
 * =========================================================
 * Test command #1
 * =========================================================
 *
 * /kubejs custom_command modfusion_placement_record
 *
 *
 * HOME:
 *
 * 第一次：
 * B3.2
 * → persistentData
 * → source = CREATED
 *
 *
 * 第二次：
 * persistentData
 * → source = CACHED
 *
 *
 * RESERVE:
 *
 * 不创建独立记录。
 */

ServerEvents.customCommand(
    "modfusion_placement_record",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Placement Record] Command must be run by a player."
            )


            return
        }


        var result =
            ensureModfusionPlacementRecordForBlock(
                player.level,

                Math.floor(
                    player.x
                ),

                Math.floor(
                    player.z
                )
            )


        printModfusionPlacementEnsureResult(
            player,
            result
        )
    }
)


/*
 * =========================================================
 * Test command #2
 * =========================================================
 *
 * /kubejs custom_command modfusion_placement_records
 *
 * 列出当前维度已经创建的全部 Placement Records。
 */

ServerEvents.customCommand(
    "modfusion_placement_records",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Placement Record] Command must be run by a player."
            )


            return
        }


        if(
            !modfusionPlacementRecordIsCorrectDimension(
                player.level
            )
        )
        {
            modfusionPlacementRecordMessage(
                player,
                "ERROR: wrong dimension."
            )


            return
        }


        printAllModfusionPlacementRecords(
            player,
            player.level
        )
    }
)


console.log(
    "[ModFusion Placement Record] Ready."
)