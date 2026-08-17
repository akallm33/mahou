console.log(
    "[ModFusion Analyzer] Script loaded"
)


var MODFUSION_ANALYZER_DIMENSION_ID =
    "mahou:modfusion_dimension"


/*
 * =========================================================
 * Analyzer settings
 * =========================================================
 */

var MODFUSION_ANALYZER_GRID_SIZE =
    5


/*
 * Surface searching:
 *
 * 优先往下找。
 *
 * 玩家或者未来 Candidate 通常位于岛面附近或上方，
 * 因此向下搜索范围可以比较大。
 *
 * 向上只允许少量搜索，
 * 防止 Middle Island 错误锁定到 High Island。
 */

var MODFUSION_ANALYZER_SURFACE_SCAN_DOWN =
    32

var MODFUSION_ANALYZER_SURFACE_SCAN_UP =
    8


var MODFUSION_ANALYZER_DEFAULT_MAX_HEIGHT_DIFFERENCE =
    12


/*
 * =========================================================
 * Surface blocks
 * =========================================================
 */

var MODFUSION_ANALYZER_PRIMARY_SURFACE_BLOCKS = {

    "minecraft:grass_block":
        true,

    "minecraft:snow_block":
        true,

    "minecraft:mycelium":
        true,

    "minecraft:podzol":
        true
}


var MODFUSION_ANALYZER_FALLBACK_SURFACE_BLOCKS = {

    "minecraft:dirt":
        true,

    "minecraft:coarse_dirt":
        true,

    "minecraft:mud":
        true,

    "minecraft:packed_ice":
        true,

    "minecraft:ice":
        true,

    "minecraft:stone":
        true
}


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */

function modfusionAnalyzerPercent(
    value
)
{
    return (
        Math.round(
            value * 1000
        ) / 10
    )
}


function modfusionAnalyzerBlockInMap(
    blockId,
    map
)
{
    if(blockId == null)
    {
        return false
    }


    return map[
        String(blockId)
    ] === true
}


function getModfusionAnalyzerBlockId(
    level,
    x,
    y,
    z
)
{
    try
    {
        var block =
            level.getBlock(
                x,
                y,
                z
            )


        if(block == null)
        {
            return null
        }


        return String(
            block.id
        )
    }
    catch(error)
    {
        console.log(
            "[ModFusion Analyzer] Block read failed at " +
            x +
            " " +
            y +
            " " +
            z +
            ": " +
            error
        )


        return null
    }
}


/*
 * =========================================================
 * Biome lookup
 * =========================================================
 */

function getModfusionAnalyzerBiomeId(
    level,
    x,
    y,
    z
)
{
    try
    {
        var pos =
            new BlockPos(
                Math.floor(x),
                Math.floor(y),
                Math.floor(z)
            )


        var holder =
            level.getBiome(
                pos
            )


        if(holder == null)
        {
            return null
        }


        var optionalKey =
            holder.unwrapKey()


        if(
            optionalKey == null ||
            !optionalKey.isPresent()
        )
        {
            return null
        }


        return String(
            optionalKey
                .get()
                .location()
        )
    }
    catch(error)
    {
        console.log(
            "[ModFusion Analyzer] Biome lookup failed at " +
            x +
            " " +
            y +
            " " +
            z +
            ": " +
            error
        )


        return null
    }
}


/*
 * =========================================================
 * Surface lookup
 * =========================================================
 */


/*
 * 在 referenceY 附近寻找指定类型的地表。
 *
 * 第一阶段：
 * 向下。
 *
 * 第二阶段：
 * 少量向上。
 */

function findModfusionAnalyzerBlockNearY(
    level,
    x,
    z,
    referenceY,
    blockMap
)
{
    var distance


    /*
     * -----------------------------------------------------
     * Downward search
     * -----------------------------------------------------
     */

    for(
        distance = 0;
        distance <=
        MODFUSION_ANALYZER_SURFACE_SCAN_DOWN;
        distance++
    )
    {
        var lowerY =
            Math.floor(
                referenceY -
                distance
            )


        var lowerBlock =
            getModfusionAnalyzerBlockId(
                level,
                x,
                lowerY,
                z
            )


        if(
            modfusionAnalyzerBlockInMap(
                lowerBlock,
                blockMap
            )
        )
        {
            return lowerY
        }
    }


    /*
     * -----------------------------------------------------
     * Small upward fallback
     * -----------------------------------------------------
     */

    for(
        distance = 1;
        distance <=
        MODFUSION_ANALYZER_SURFACE_SCAN_UP;
        distance++
    )
    {
        var upperY =
            Math.floor(
                referenceY +
                distance
            )


        var upperBlock =
            getModfusionAnalyzerBlockId(
                level,
                x,
                upperY,
                z
            )


        if(
            modfusionAnalyzerBlockInMap(
                upperBlock,
                blockMap
            )
        )
        {
            return upperY
        }
    }


    return null
}


/*
 * 优先寻找真正的表层材料。
 *
 * 如果没有，再接受：
 *
 * Dirt
 * Mud
 * Packed Ice
 * Stone
 *
 * 等备用材料。
 */

function findModfusionAnalyzerSurfaceY(
    level,
    x,
    z,
    referenceY
)
{
    var surfaceY =
        findModfusionAnalyzerBlockNearY(
            level,
            x,
            z,
            referenceY,
            MODFUSION_ANALYZER_PRIMARY_SURFACE_BLOCKS
        )


    if(surfaceY != null)
    {
        return surfaceY
    }


    return findModfusionAnalyzerBlockNearY(
        level,
        x,
        z,
        referenceY,
        MODFUSION_ANALYZER_FALLBACK_SURFACE_BLOCKS
    )
}


/*
 * =========================================================
 * Foundation Support Analyzer
 * =========================================================
 *
 * 这是现在真正决定 Terrain PASS / FAIL 的系统。
 *
 * 检查 9 点：
 *
 *
 * X -------- X -------- X
 *
 *
 *
 * X -------- C -------- X
 *
 *
 *
 * X -------- X -------- X
 *
 *
 * radius 根据具体建筑决定。
 */

function analyzeModfusionFoundationSupport(
    level,
    centerX,
    centerY,
    centerZ,
    radius,
    maxHeightDifference
)
{
    var offsets = [

        [0, 0],

        [-radius, 0],

        [radius, 0],

        [0, -radius],

        [0, radius],

        [-radius, -radius],

        [-radius, radius],

        [radius, -radius],

        [radius, radius]
    ]


    var totalPoints =
        offsets.length


    var terrainPoints =
        0


    var stablePoints =
        0


    var minimumSurfaceY =
        null


    var maximumSurfaceY =
        null


    var maximumObservedDifference =
        0


    var points = []


    var i


    for(
        i = 0;
        i < offsets.length;
        i++
    )
    {
        var sampleX =
            Math.round(
                centerX +
                offsets[i][0]
            )


        var sampleZ =
            Math.round(
                centerZ +
                offsets[i][1]
            )


        var surfaceY =
            findModfusionAnalyzerSurfaceY(
                level,
                sampleX,
                sampleZ,
                centerY
            )


        var pointResult = {

            x:
                sampleX,

            z:
                sampleZ,

            surfaceY:
                surfaceY,

            terrain:
                false,

            stable:
                false
        }


        if(surfaceY == null)
        {
            points.push(
                pointResult
            )

            continue
        }


        terrainPoints++


        pointResult.terrain =
            true


        if(
            minimumSurfaceY == null ||
            surfaceY <
            minimumSurfaceY
        )
        {
            minimumSurfaceY =
                surfaceY
        }


        if(
            maximumSurfaceY == null ||
            surfaceY >
            maximumSurfaceY
        )
        {
            maximumSurfaceY =
                surfaceY
        }


        var difference =
            Math.abs(
                surfaceY -
                centerY
            )


        if(
            difference >
            maximumObservedDifference
        )
        {
            maximumObservedDifference =
                difference
        }


        if(
            difference <=
            maxHeightDifference
        )
        {
            stablePoints++

            pointResult.stable =
                true
        }


        points.push(
            pointResult
        )
    }


    return {

        radius:
            radius,

        totalPoints:
            totalPoints,

        terrainPoints:
            terrainPoints,

        stablePoints:
            stablePoints,

        minimumSurfaceY:
            minimumSurfaceY,

        maximumSurfaceY:
            maximumSurfaceY,

        maximumObservedDifference:
            maximumObservedDifference,

        points:
            points
    }
}


/*
 * =========================================================
 * Broad Terrain Analyzer
 * =========================================================
 *
 * 这一层不参与最终 PASS / FAIL。
 *
 * 它只用于告诉我们：
 *
 * 周围总体上有多少陆地。
 *
 * 对浮岛而言：
 *
 * 20%
 * 30%
 * 40%
 *
 * 完全可能是正常现象。
 */

function analyzeModfusionBroadTerrain(
    level,
    centerX,
    centerY,
    centerZ,
    radius,
    maxHeightDifference
)
{
    var halfGrid =
        Math.floor(
            MODFUSION_ANALYZER_GRID_SIZE /
            2
        )


    var totalSamples =
        0


    var terrainSamples =
        0


    var stableTerrainSamples =
        0


    var minimumSurfaceY =
        null


    var maximumSurfaceY =
        null


    var maximumObservedDifference =
        0


    var gx
    var gz


    for(
        gx = -halfGrid;
        gx <= halfGrid;
        gx++
    )
    {
        for(
            gz = -halfGrid;
            gz <= halfGrid;
            gz++
        )
        {
            var sampleX =
                Math.round(
                    centerX +
                    (
                        radius *
                        gx /
                        halfGrid
                    )
                )


            var sampleZ =
                Math.round(
                    centerZ +
                    (
                        radius *
                        gz /
                        halfGrid
                    )
                )


            totalSamples++


            var surfaceY =
                findModfusionAnalyzerSurfaceY(
                    level,
                    sampleX,
                    sampleZ,
                    centerY
                )


            if(surfaceY == null)
            {
                continue
            }


            terrainSamples++


            if(
                minimumSurfaceY == null ||
                surfaceY <
                minimumSurfaceY
            )
            {
                minimumSurfaceY =
                    surfaceY
            }


            if(
                maximumSurfaceY == null ||
                surfaceY >
                maximumSurfaceY
            )
            {
                maximumSurfaceY =
                    surfaceY
            }


            var difference =
                Math.abs(
                    surfaceY -
                    centerY
                )


            if(
                difference >
                maximumObservedDifference
            )
            {
                maximumObservedDifference =
                    difference
            }


            if(
                difference <=
                maxHeightDifference
            )
            {
                stableTerrainSamples++
            }
        }
    }


    var terrainCoverage =
        0


    var stableTerrainCoverage =
        0


    if(totalSamples > 0)
    {
        terrainCoverage =
            terrainSamples /
            totalSamples


        stableTerrainCoverage =
            stableTerrainSamples /
            totalSamples
    }


    return {

        radius:
            radius,

        totalSamples:
            totalSamples,

        terrainSamples:
            terrainSamples,

        stableTerrainSamples:
            stableTerrainSamples,

        terrainCoverage:
            terrainCoverage,

        stableTerrainCoverage:
            stableTerrainCoverage,

        minimumSurfaceY:
            minimumSurfaceY,

        maximumSurfaceY:
            maximumSurfaceY,

        maximumObservedDifference:
            maximumObservedDifference
    }
}


/*
 * =========================================================
 * Biome Coverage Analyzer
 * =========================================================
 */

function analyzeModfusionBiomeCoverage(
    level,
    centerX,
    centerY,
    centerZ,
    buildingId,
    radius
)
{
    var halfGrid =
        Math.floor(
            MODFUSION_ANALYZER_GRID_SIZE /
            2
        )


    var totalSamples =
        0


    var allowedSamples =
        0


    var gx
    var gz


    for(
        gx = -halfGrid;
        gx <= halfGrid;
        gx++
    )
    {
        for(
            gz = -halfGrid;
            gz <= halfGrid;
            gz++
        )
        {
            var sampleX =
                Math.round(
                    centerX +
                    (
                        radius *
                        gx /
                        halfGrid
                    )
                )


            var sampleZ =
                Math.round(
                    centerZ +
                    (
                        radius *
                        gz /
                        halfGrid
                    )
                )


            totalSamples++


            var biomeId =
                getModfusionAnalyzerBiomeId(
                    level,
                    sampleX,
                    centerY,
                    sampleZ
                )


            if(
                biomeId != null &&
                global.ModfusionBuildingRegistry
                    .isAllowedInBiome(
                        buildingId,
                        biomeId
                    )
            )
            {
                allowedSamples++
            }
        }
    }


    var coverage =
        0


    if(totalSamples > 0)
    {
        coverage =
            allowedSamples /
            totalSamples
    }


    return {

        radius:
            radius,

        totalSamples:
            totalSamples,

        allowedSamples:
            allowedSamples,

        coverage:
            coverage
    }
}


/*
 * =========================================================
 * Analyze one building
 * =========================================================
 */

function analyzeModfusionBuildingCandidate(
    level,
    centerX,
    centerSurfaceY,
    centerZ,
    buildingId
)
{
    /*
     * -----------------------------------------------------
     * Registry check
     * -----------------------------------------------------
     */

    if(
        global.ModfusionBuildingRegistry ==
        null
    )
    {
        return {

            buildingId:
                buildingId,

            status:
                "ERROR",

            reason:
                "BUILDING_REGISTRY_NOT_LOADED"
        }
    }


    var config =
        global.ModfusionBuildingRegistry.get(
            buildingId
        )


    if(config == null)
    {
        return {

            buildingId:
                buildingId,

            status:
                "ERROR",

            reason:
                "UNKNOWN_BUILDING"
        }
    }


    /*
     * -----------------------------------------------------
     * Biome settings
     * -----------------------------------------------------
     */

    var biomeSampleRadius =
        Number(
            config.biomeSampleRadius
        )


    if(
        isNaN(biomeSampleRadius) ||
        biomeSampleRadius <= 0
    )
    {
        biomeSampleRadius =
            48
    }


    var minBiomeCoverage =
        Number(
            config.minBiomeCoverage
        )


    if(isNaN(minBiomeCoverage))
    {
        minBiomeCoverage =
            0.65
    }


    /*
     * -----------------------------------------------------
     * Foundation settings
     * -----------------------------------------------------
     */

    var foundationRadius =
        Number(
            config.foundationRadius
        )


    if(
        isNaN(foundationRadius) ||
        foundationRadius <= 0
    )
    {
        foundationRadius =
            16
    }


    var minFoundationPoints =
        Number(
            config.minFoundationPoints
        )


    if(
        isNaN(minFoundationPoints) ||
        minFoundationPoints <= 0
    )
    {
        minFoundationPoints =
            5
    }


    /*
     * -----------------------------------------------------
     * Broad terrain settings
     * -----------------------------------------------------
     */

    var terrainSampleRadius =
        Number(
            config.terrainSampleRadius
        )


    if(
        isNaN(terrainSampleRadius) ||
        terrainSampleRadius <= 0
    )
    {
        terrainSampleRadius =
            32
    }


    /*
     * -----------------------------------------------------
     * Height settings
     * -----------------------------------------------------
     */

    var maxHeightDifference =
        Number(
            config.maxHeightDifference
        )


    if(
        isNaN(maxHeightDifference) ||
        maxHeightDifference <= 0
    )
    {
        maxHeightDifference =
            MODFUSION_ANALYZER_DEFAULT_MAX_HEIGHT_DIFFERENCE
    }


    /*
     * =====================================================
     * Center biome
     * =====================================================
     */

    var centerBiomeId =
        getModfusionAnalyzerBiomeId(
            level,
            centerX,
            centerSurfaceY,
            centerZ
        )


    var centerBiomePass =
        global.ModfusionBuildingRegistry
            .isAllowedInBiome(
                buildingId,
                centerBiomeId
            )


    /*
     * =====================================================
     * Biome coverage
     * =====================================================
     */

    var biomeResult =
        analyzeModfusionBiomeCoverage(
            level,
            centerX,
            centerSurfaceY,
            centerZ,
            buildingId,
            biomeSampleRadius
        )


    var biomeCoveragePass =
        biomeResult.coverage >=
        minBiomeCoverage


    /*
     * =====================================================
     * Foundation support
     * =====================================================
     */

    var foundationResult =
        analyzeModfusionFoundationSupport(
            level,
            centerX,
            centerSurfaceY,
            centerZ,
            foundationRadius,
            maxHeightDifference
        )


    var foundationPass =
        foundationResult.stablePoints >=
        minFoundationPoints


    /*
     * =====================================================
     * Broad terrain
     * =====================================================
     *
     * Diagnostic only.
     */

    var broadTerrainResult =
        analyzeModfusionBroadTerrain(
            level,
            centerX,
            centerSurfaceY,
            centerZ,
            terrainSampleRadius,
            maxHeightDifference
        )


    /*
     * =====================================================
     * Final result
     * =====================================================
     */

    var valid =
        centerBiomePass &&
        biomeCoveragePass &&
        foundationPass


    return {

        status:
            "OK",


        buildingId:
            buildingId,

        structureId:
            config.structureId,

        regionPolicy:
            config.regionPolicy,


        centerX:
            centerX,

        centerY:
            centerSurfaceY,

        centerZ:
            centerZ,


        /*
         * Center biome
         */

        centerBiome:
            centerBiomeId,

        centerBiomePass:
            centerBiomePass,


        /*
         * Biome coverage
         */

        biomeSampleRadius:
            biomeSampleRadius,

        biomeTotalSamples:
            biomeResult.totalSamples,

        allowedBiomeSamples:
            biomeResult.allowedSamples,

        biomeCoverage:
            biomeResult.coverage,

        minBiomeCoverage:
            minBiomeCoverage,

        biomeCoveragePass:
            biomeCoveragePass,


        /*
         * Foundation
         */

        foundationRadius:
            foundationRadius,

        foundationTotalPoints:
            foundationResult.totalPoints,

        foundationTerrainPoints:
            foundationResult.terrainPoints,

        foundationStablePoints:
            foundationResult.stablePoints,

        minFoundationPoints:
            minFoundationPoints,

        foundationMinimumSurfaceY:
            foundationResult.minimumSurfaceY,

        foundationMaximumSurfaceY:
            foundationResult.maximumSurfaceY,

        foundationMaximumDifference:
            foundationResult.maximumObservedDifference,

        foundationPass:
            foundationPass,


        /*
         * Broad terrain
         */

        terrainSampleRadius:
            terrainSampleRadius,

        terrainTotalSamples:
            broadTerrainResult.totalSamples,

        terrainSamples:
            broadTerrainResult.terrainSamples,

        terrainCoverage:
            broadTerrainResult.terrainCoverage,

        stableTerrainSamples:
            broadTerrainResult.stableTerrainSamples,

        stableTerrainCoverage:
            broadTerrainResult.stableTerrainCoverage,

        minimumSurfaceY:
            broadTerrainResult.minimumSurfaceY,

        maximumSurfaceY:
            broadTerrainResult.maximumSurfaceY,

        maximumObservedDifference:
            broadTerrainResult.maximumObservedDifference,


        /*
         * Height
         */

        maxHeightDifference:
            maxHeightDifference,


        /*
         * Future checks
         */

        spacingStatus:
            "NOT_CHECKED",

        uniqueStatus:
            "NOT_CHECKED",


        /*
         * Final
         */

        terrainPass:
            foundationPass,

        valid:
            valid
    }
}


/*
 * =========================================================
 * Analyze position
 * =========================================================
 */

function analyzeModfusionBuildingPosition(
    level,
    x,
    referenceY,
    z
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


    /*
     * -----------------------------------------------------
     * Dimension
     * -----------------------------------------------------
     */

    var dimensionId =
        String(
            level.dimension
        )


    if(
        dimensionId !==
        MODFUSION_ANALYZER_DIMENSION_ID
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "WRONG_DIMENSION",

            dimension:
                dimensionId
        }
    }


    /*
     * -----------------------------------------------------
     * Registry
     * -----------------------------------------------------
     */

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


    /*
     * -----------------------------------------------------
     * Normalize coordinates
     * -----------------------------------------------------
     */

    x =
        Math.floor(
            Number(x)
        )


    referenceY =
        Math.floor(
            Number(referenceY)
        )


    z =
        Math.floor(
            Number(z)
        )


    /*
     * -----------------------------------------------------
     * Find island surface
     * -----------------------------------------------------
     */

    var centerSurfaceY =
        findModfusionAnalyzerSurfaceY(
            level,
            x,
            z,
            referenceY
        )


    if(centerSurfaceY == null)
    {
        return {

            status:
                "REJECTED",

            reason:
                "NO_ISLAND_SURFACE",

            x:
                x,

            y:
                referenceY,

            z:
                z
        }
    }


    /*
     * -----------------------------------------------------
     * Center biome
     * -----------------------------------------------------
     */

    var centerBiomeId =
        getModfusionAnalyzerBiomeId(
            level,
            x,
            centerSurfaceY,
            z
        )


    if(centerBiomeId == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "BIOME_LOOKUP_FAILED",

            x:
                x,

            y:
                centerSurfaceY,

            z:
                z
        }
    }


    /*
     * -----------------------------------------------------
     * Eligible buildings
     * -----------------------------------------------------
     */

    var buildingIds =
        global.ModfusionBuildingRegistry
            .getForBiome(
                centerBiomeId
            )


    var results = []


    var i


    for(
        i = 0;
        i < buildingIds.length;
        i++
    )
    {
        results.push(
            analyzeModfusionBuildingCandidate(
                level,
                x,
                centerSurfaceY,
                z,
                buildingIds[i]
            )
        )
    }


    return {

        status:
            "OK",

        dimension:
            dimensionId,

        x:
            x,

        referenceY:
            referenceY,

        surfaceY:
            centerSurfaceY,

        z:
            z,

        biome:
            centerBiomeId,

        eligibleBuildings:
            buildingIds,

        results:
            results
    }
}


/*
 * =========================================================
 * Message output
 * =========================================================
 */

function modfusionAnalyzerMessage(
    player,
    message
)
{
    console.log(
        "[ModFusion Analyzer] " +
        message
    )


    if(player != null)
    {
        player.tell(
            "[ModFusion Analyzer] " +
            message
        )
    }
}


/*
 * =========================================================
 * Report
 * =========================================================
 */

function printModfusionAnalyzerReport(
    player,
    report
)
{
    if(report == null)
    {
        modfusionAnalyzerMessage(
            player,
            "ERROR: report is null."
        )

        return
    }


    /*
     * -----------------------------------------------------
     * Error / rejected before analysis
     * -----------------------------------------------------
     */

    if(report.status !== "OK")
    {
        modfusionAnalyzerMessage(
            player,
            "Result: " +
            report.status +
            " / " +
            report.reason
        )

        return
    }


    /*
     * -----------------------------------------------------
     * Header
     * -----------------------------------------------------
     */

    modfusionAnalyzerMessage(
        player,
        "================================"
    )


    modfusionAnalyzerMessage(
        player,
        "Center: " +
        report.x +
        " " +
        report.surfaceY +
        " " +
        report.z
    )


    modfusionAnalyzerMessage(
        player,
        "Biome: " +
        report.biome
    )


    /*
     * -----------------------------------------------------
     * No structures
     * -----------------------------------------------------
     */

    if(
        report.eligibleBuildings.length ===
        0
    )
    {
        modfusionAnalyzerMessage(
            player,
            "Eligible buildings: NONE"
        )


        modfusionAnalyzerMessage(
            player,
            "================================"
        )


        return
    }


    modfusionAnalyzerMessage(
        player,
        "Eligible buildings: " +
        report.eligibleBuildings.length
    )


    /*
     * -----------------------------------------------------
     * Structures
     * -----------------------------------------------------
     */

    var i


    for(
        i = 0;
        i < report.results.length;
        i++
    )
    {
        var result =
            report.results[i]


        modfusionAnalyzerMessage(
            player,
            "--------------------------------"
        )


        modfusionAnalyzerMessage(
            player,
            "Building: " +
            result.buildingId
        )


        modfusionAnalyzerMessage(
            player,
            "Structure: " +
            result.structureId
        )


        modfusionAnalyzerMessage(
            player,
            "Policy: " +
            result.regionPolicy
        )


        /*
         * -------------------------------------------------
         * Center biome
         * -------------------------------------------------
         */

        modfusionAnalyzerMessage(
            player,
            "Center biome check: " +
            (
                result.centerBiomePass
                ? "PASS"
                : "FAIL"
            )
        )


        /*
         * -------------------------------------------------
         * Biome coverage
         * -------------------------------------------------
         */

        modfusionAnalyzerMessage(
            player,
            "Biome sample radius: " +
            result.biomeSampleRadius
        )


        modfusionAnalyzerMessage(
            player,
            "Biome coverage: " +
            modfusionAnalyzerPercent(
                result.biomeCoverage
            ) +
            "% / required " +
            modfusionAnalyzerPercent(
                result.minBiomeCoverage
            ) +
            "%"
        )


        modfusionAnalyzerMessage(
            player,
            "Biome coverage check: " +
            (
                result.biomeCoveragePass
                ? "PASS"
                : "FAIL"
            )
        )


        /*
         * -------------------------------------------------
         * Foundation
         * -------------------------------------------------
         */

        modfusionAnalyzerMessage(
            player,
            "Foundation radius: " +
            result.foundationRadius
        )


        modfusionAnalyzerMessage(
            player,
            "Foundation terrain: " +
            result.foundationTerrainPoints +
            " / " +
            result.foundationTotalPoints
        )


        modfusionAnalyzerMessage(
            player,
            "Foundation support: " +
            result.foundationStablePoints +
            " / " +
            result.foundationTotalPoints +
            " / required " +
            result.minFoundationPoints
        )


        modfusionAnalyzerMessage(
            player,
            "Foundation Y range: " +
            result.foundationMinimumSurfaceY +
            " ~ " +
            result.foundationMaximumSurfaceY
        )


        modfusionAnalyzerMessage(
            player,
            "Foundation max height difference: " +
            result.foundationMaximumDifference +
            " / allowed " +
            result.maxHeightDifference
        )


        modfusionAnalyzerMessage(
            player,
            "Foundation check: " +
            (
                result.foundationPass
                ? "PASS"
                : "FAIL"
            )
        )


        /*
         * -------------------------------------------------
         * Broad terrain
         * -------------------------------------------------
         *
         * Diagnostic only.
         */

        modfusionAnalyzerMessage(
            player,
            "Broad terrain sample radius: " +
            result.terrainSampleRadius
        )


        modfusionAnalyzerMessage(
            player,
            "Broad terrain coverage (diagnostic): " +
            modfusionAnalyzerPercent(
                result.terrainCoverage
            ) +
            "%"
        )


        modfusionAnalyzerMessage(
            player,
            "Broad stable terrain (diagnostic): " +
            modfusionAnalyzerPercent(
                result.stableTerrainCoverage
            ) +
            "%"
        )


        modfusionAnalyzerMessage(
            player,
            "Broad surface Y range: " +
            result.minimumSurfaceY +
            " ~ " +
            result.maximumSurfaceY
        )


        /*
         * -------------------------------------------------
         * Future checks
         * -------------------------------------------------
         */

        modfusionAnalyzerMessage(
            player,
            "Spacing: NOT CHECKED"
        )


        modfusionAnalyzerMessage(
            player,
            "Unique: NOT CHECKED"
        )


        /*
         * -------------------------------------------------
         * Final
         * -------------------------------------------------
         */

        modfusionAnalyzerMessage(
            player,
            "Result: " +
            (
                result.valid
                ? "VALID"
                : "REJECTED"
            )
        )
    }


    modfusionAnalyzerMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */

global.ModfusionBuildingAnalyzer = {

    analyze:
        analyzeModfusionBuildingPosition,

    analyzeBuilding:
        analyzeModfusionBuildingCandidate,

    getBiomeId:
        getModfusionAnalyzerBiomeId,

    findSurfaceY:
        findModfusionAnalyzerSurfaceY,

    analyzeFoundation:
        analyzeModfusionFoundationSupport,

    analyzeBroadTerrain:
        analyzeModfusionBroadTerrain,

    print:
        printModfusionAnalyzerReport
}


/*
 * =========================================================
 * Test command
 * =========================================================
 *
 * 使用：
 *
 * /kubejs custom_command modfusion_analyze
 *
 * 以玩家当前位置为候选中心。
 */

ServerEvents.customCommand(
    "modfusion_analyze",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Analyzer] Command must be run by a player."
            )

            return
        }


        var level =
            player.level


        var report =
            analyzeModfusionBuildingPosition(
                level,

                Math.floor(
                    player.x
                ),

                Math.floor(
                    player.y
                ),

                Math.floor(
                    player.z
                )
            )


        printModfusionAnalyzerReport(
            player,
            report
        )
    }
)


console.log(
    "[ModFusion Analyzer] Ready."
)