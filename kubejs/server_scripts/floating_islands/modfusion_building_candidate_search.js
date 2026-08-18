console.log(
    "[ModFusion Candidate Search] Script loaded"
)


/*
 * =========================================================
 * Basic settings
 * =========================================================
 */

var MODFUSION_CANDIDATE_DIMENSION_ID =
    "mahou:modfusion_dimension"


/*
 * Candidate Search algorithm version.
 *
 * v1:
 * 4 x 4 direct candidates
 *
 * v2:
 * 8 x 8 discovery
 * +
 * local refinement
 * +
 * cheap foundation ranking
 */

var MODFUSION_CANDIDATE_VERSION =
    2


/*
 * 8 x 8 discovery grid.
 *
 * 64 points per layer.
 */

var MODFUSION_DISCOVERY_GRID_SIDE =
    8


/*
 * Region edge padding.
 */

var MODFUSION_CANDIDATE_DEFAULT_PADDING =
    96


/*
 * Discovery point jitter inside each grid cell.
 */

var MODFUSION_DISCOVERY_CELL_MIN_RATIO =
    0.15

var MODFUSION_DISCOVERY_CELL_MAX_RATIO =
    0.85


/*
 * Maximum number of FULL Analyzer calls per layer.
 *
 * Discovery / refinement may find many anchors,
 * but only the best anchors enter the expensive Analyzer.
 */

var MODFUSION_MAX_ANALYZER_CANDIDATES_PER_LAYER =
    16


/*
 * =========================================================
 * Floating island layers
 * =========================================================
 */

var MODFUSION_CANDIDATE_LAYERS = [

    {
        id:
            "MIDDLE",

        referenceY:
            80,

        minSurfaceY:
            40,

        maxSurfaceY:
            85
    },

    {
        id:
            "HIGH",

        referenceY:
            128,

        minSurfaceY:
            90,

        maxSurfaceY:
            145
    }
]


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */

function modfusionCandidateClamp(
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


function modfusionCandidatePercent(
    value
)
{
    return (
        Math.round(
            value * 1000
        ) /
        10
    )
}


function modfusionCandidateArrayContains(
    array,
    value
)
{
    if(array == null)
    {
        return false
    }


    var i


    for(
        i = 0;
        i < array.length;
        i++
    )
    {
        if(
            String(array[i]) ===
            String(value)
        )
        {
            return true
        }
    }


    return false
}


/*
 * =========================================================
 * Deterministic hash
 * =========================================================
 */

function modfusionCandidateHashString(
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
 */

function createModfusionCandidateRandom(
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

function shuffleModfusionCandidateArray(
    array,
    seed
)
{
    var result =
        array.slice()


    var random =
        createModfusionCandidateRandom(
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
 * Region information
 * =========================================================
 */

function getModfusionCandidateRegionSize()
{
    /*
     * Read B2's current Region size if possible.
     */

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
                    return size
                }
            }
        }
        catch(error)
        {
            /*
             * Fallback below.
             */
        }
    }


    return 768
}


function getModfusionCandidateRegionBounds(
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


    var regionSize =
        getModfusionCandidateRegionSize()


    var minX =
        regionX *
        regionSize


    var minZ =
        regionZ *
        regionSize


    return {

        regionX:
            regionX,

        regionZ:
            regionZ,

        regionSize:
            regionSize,

        minX:
            minX,

        maxX:
            minX +
            regionSize -
            1,

        minZ:
            minZ,

        maxZ:
            minZ +
            regionSize -
            1
    }
}


/*
 * =========================================================
 * Candidate search padding
 * =========================================================
 */

function getModfusionCandidatePadding(
    config,
    regionSize
)
{
    var padding =
        Number(
            config != null
            ? config.candidateSearchPadding
            : null
        )


    if(
        isNaN(padding) ||
        padding <= 0
    )
    {
        padding =
            MODFUSION_CANDIDATE_DEFAULT_PADDING


        /*
         * Ensure very large foundations also get enough
         * distance from Region borders.
         */

        if(
            config != null &&
            config.foundationRadius != null
        )
        {
            var foundationRadius =
                Number(
                    config.foundationRadius
                )


            if(
                !isNaN(foundationRadius)
            )
            {
                padding =
                    Math.max(
                        padding,
                        foundationRadius +
                        48
                    )
            }
        }
    }


    var maximumPadding =
        Math.floor(
            (
                regionSize -
                64
            ) /
            2
        )


    padding =
        modfusionCandidateClamp(
            padding,
            0,
            maximumPadding
        )


    return Math.floor(
        padding
    )
}


/*
 * =========================================================
 * Allowed layers
 * =========================================================
 */

function getModfusionCandidateAllowedLayers(
    config
)
{
    var result = []


    var allowedLayers =
        null


    if(config != null)
    {
        allowedLayers =
            config.allowedLayers
    }


    var i


    for(
        i = 0;
        i < MODFUSION_CANDIDATE_LAYERS.length;
        i++
    )
    {
        var layer =
            MODFUSION_CANDIDATE_LAYERS[i]


        if(
            allowedLayers == null ||
            modfusionCandidateArrayContains(
                allowedLayers,
                layer.id
            )
        )
        {
            result.push(
                layer
            )
        }
    }


    return result
}


/*
 * =========================================================
 * Deterministic layer order
 * =========================================================
 */

function getModfusionCandidateLayerOrder(
    config,
    seedText
)
{
    var layers =
        getModfusionCandidateAllowedLayers(
            config
        )


    if(layers.length <= 1)
    {
        return layers
    }


    /*
     * Optional Registry override.
     */

    if(
        config != null &&
        config.preferredLayer != null
    )
    {
        var preferredId =
            String(
                config.preferredLayer
            )


        var preferred = []
        var others = []


        var i


        for(
            i = 0;
            i < layers.length;
            i++
        )
        {
            if(
                String(layers[i].id) ===
                preferredId
            )
            {
                preferred.push(
                    layers[i]
                )
            }
            else
            {
                others.push(
                    layers[i]
                )
            }
        }


        if(preferred.length > 0)
        {
            return preferred.concat(
                others
            )
        }
    }


    /*
     * Otherwise rotate order deterministically.
     */

    var startIndex =
        modfusionCandidateHashString(
            seedText +
            "|layer_order"
        ) %
        layers.length


    var result = []


    var j


    for(
        j = 0;
        j < layers.length;
        j++
    )
    {
        result.push(
            layers[
                (
                    startIndex +
                    j
                ) %
                layers.length
            ]
        )
    }


    return result
}


/*
 * =========================================================
 * Generate 8 x 8 discovery points
 * =========================================================
 */

function generateModfusionDiscoveryPositions(
    bounds,
    config,
    seedText
)
{
    var padding =
        getModfusionCandidatePadding(
            config,
            bounds.regionSize
        )


    var usableMinX =
        bounds.minX +
        padding


    var usableMaxX =
        bounds.maxX -
        padding


    var usableMinZ =
        bounds.minZ +
        padding


    var usableMaxZ =
        bounds.maxZ -
        padding


    var usableWidth =
        usableMaxX -
        usableMinX +
        1


    var usableDepth =
        usableMaxZ -
        usableMinZ +
        1


    var cellWidth =
        usableWidth /
        MODFUSION_DISCOVERY_GRID_SIDE


    var cellDepth =
        usableDepth /
        MODFUSION_DISCOVERY_GRID_SIDE


    var random =
        createModfusionCandidateRandom(
            modfusionCandidateHashString(
                seedText +
                "|discovery_positions"
            )
        )


    var points = []


    var gx
    var gz


    for(
        gz = 0;
        gz < MODFUSION_DISCOVERY_GRID_SIDE;
        gz++
    )
    {
        for(
            gx = 0;
            gx < MODFUSION_DISCOVERY_GRID_SIDE;
            gx++
        )
        {
            var ratioX =
                MODFUSION_DISCOVERY_CELL_MIN_RATIO +
                (
                    random() *
                    (
                        MODFUSION_DISCOVERY_CELL_MAX_RATIO -
                        MODFUSION_DISCOVERY_CELL_MIN_RATIO
                    )
                )


            var ratioZ =
                MODFUSION_DISCOVERY_CELL_MIN_RATIO +
                (
                    random() *
                    (
                        MODFUSION_DISCOVERY_CELL_MAX_RATIO -
                        MODFUSION_DISCOVERY_CELL_MIN_RATIO
                    )
                )


            var x =
                Math.floor(
                    usableMinX +
                    (
                        gx *
                        cellWidth
                    ) +
                    (
                        ratioX *
                        cellWidth
                    )
                )


            var z =
                Math.floor(
                    usableMinZ +
                    (
                        gz *
                        cellDepth
                    ) +
                    (
                        ratioZ *
                        cellDepth
                    )
                )


            x =
                modfusionCandidateClamp(
                    x,
                    usableMinX,
                    usableMaxX
                )


            z =
                modfusionCandidateClamp(
                    z,
                    usableMinZ,
                    usableMaxZ
                )


            points.push({

                gridX:
                    gx,

                gridZ:
                    gz,

                x:
                    Math.floor(x),

                z:
                    Math.floor(z)
            })
        }
    }


    /*
     * Search order must not always begin northwest.
     */

    points =
        shuffleModfusionCandidateArray(
            points,
            modfusionCandidateHashString(
                seedText +
                "|discovery_order"
            )
        )


    return {

        padding:
            padding,

        usableMinX:
            usableMinX,

        usableMaxX:
            usableMaxX,

        usableMinZ:
            usableMinZ,

        usableMaxZ:
            usableMaxZ,

        points:
            points
    }
}


/*
 * =========================================================
 * Surface lookup for one specific island layer
 * =========================================================
 */

function findModfusionCandidateSurfaceOnLayer(
    level,
    x,
    z,
    layer
)
{
    var surfaceY =
        global.ModfusionBuildingAnalyzer
            .findSurfaceY(
                level,
                x,
                z,
                layer.referenceY
            )


    if(surfaceY == null)
    {
        return null
    }


    if(
        surfaceY <
        layer.minSurfaceY ||
        surfaceY >
        layer.maxSurfaceY
    )
    {
        return null
    }


    return surfaceY
}


/*
 * =========================================================
 * Refinement radii
 * =========================================================
 */

function getModfusionRefinementRadii(
    config
)
{
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


    /*
     * Inner:
     *
     * approximately one foundation radius.
     *
     * Lich:
     * 8 -> 12
     *
     * Naga:
     * 22 -> 22
     */

    var inner =
        Math.round(
            foundationRadius
        )


    inner =
        modfusionCandidateClamp(
            inner,
            12,
            24
        )


    /*
     * Outer:
     *
     * allows a discovery point near an island edge
     * to move toward a better central anchor.
     */

    var outer =
        Math.round(
            foundationRadius *
            2
        )


    outer =
        modfusionCandidateClamp(
            outer,
            24,
            48
        )


    return {

        inner:
            inner,

        outer:
            outer
    }
}


/*
 * =========================================================
 * Local refinement offsets
 * =========================================================
 *
 * 13 anchors:
 *
 *            N2
 *
 *      NW    N1    NE
 *
 * W2   W1     C    E1   E2
 *
 *      SW    S1    SE
 *
 *            S2
 */

function getModfusionRefinementOffsets(
    inner,
    outer
)
{
    return [

        [0, 0],

        [inner, 0],
        [-inner, 0],
        [0, inner],
        [0, -inner],

        [inner, inner],
        [inner, -inner],
        [-inner, inner],
        [-inner, -inner],

        [outer, 0],
        [-outer, 0],
        [0, outer],
        [0, -outer]
    ]
}


/*
 * =========================================================
 * Cheap foundation support
 * =========================================================
 *
 * IMPORTANT:
 *
 * This does NOT replace Analyzer.
 *
 * It only ranks local anchors before expensive analysis.
 *
 * Five points:
 *
 *       N
 *
 * W     C     E
 *
 *       S
 */

function getModfusionCheapFoundationSupport(
    level,
    centerX,
    centerY,
    centerZ,
    layer,
    config
)
{
    var radius =
        Number(
            config.foundationRadius
        )


    if(
        isNaN(radius) ||
        radius <= 0
    )
    {
        radius =
            16
    }


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
            12
    }


    var offsets = [

        [0, 0],

        [radius, 0],

        [-radius, 0],

        [0, radius],

        [0, -radius]
    ]


    var terrainPoints =
        0


    var stablePoints =
        0


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


        /*
         * Start slightly above center surface.
         *
         * This allows nearby terrain to be somewhat higher
         * while still staying within the same island layer.
         */

        var sampleReferenceY =
            centerY +
            maxHeightDifference


        var sampleY =
            global.ModfusionBuildingAnalyzer
                .findSurfaceY(
                    level,
                    sampleX,
                    sampleZ,
                    sampleReferenceY
                )


        if(sampleY == null)
        {
            continue
        }


        if(
            sampleY <
            layer.minSurfaceY ||
            sampleY >
            layer.maxSurfaceY
        )
        {
            continue
        }


        terrainPoints++


        if(
            Math.abs(
                sampleY -
                centerY
            ) <=
            maxHeightDifference
        )
        {
            stablePoints++
        }
    }


    return {

        totalPoints:
            offsets.length,

        terrainPoints:
            terrainPoints,

        stablePoints:
            stablePoints
    }
}


/*
 * =========================================================
 * Analyzer failure reason
 * =========================================================
 */

function getModfusionCandidateAnalyzerFailureReason(
    result
)
{
    if(result == null)
    {
        return "ANALYZER_NULL"
    }


    if(result.status !== "OK")
    {
        if(result.reason != null)
        {
            return String(
                result.reason
            )
        }


        return "ANALYZER_ERROR"
    }


    if(!result.centerBiomePass)
    {
        return "CENTER_BIOME"
    }


    if(!result.biomeCoveragePass)
    {
        return "BIOME_COVERAGE"
    }


    if(!result.foundationPass)
    {
        return "FOUNDATION"
    }


    return "ANALYZER_REJECTED"
}


/*
 * =========================================================
 * Build refined candidate pool for one layer
 * =========================================================
 */

function buildModfusionLayerCandidatePool(
    level,
    buildingId,
    config,
    layer,
    discovery,
    seedText
)
{
    var surfaceHits =
        0


    var refinedRawCount =
        0


    var refinedSurfaceHits =
        0


    var incompatibleBiomeCount =
        0


    var duplicateCount =
        0


    var anchors = []


    var seen = {}


    var radii =
        getModfusionRefinementRadii(
            config
        )


    var offsets =
        getModfusionRefinementOffsets(
            radii.inner,
            radii.outer
        )


    var i
    var j


    /*
     * -----------------------------------------------------
     * Discovery
     * -----------------------------------------------------
     */

    for(
        i = 0;
        i < discovery.points.length;
        i++
    )
    {
        var discoveryPoint =
            discovery.points[i]


        var discoveryY =
            findModfusionCandidateSurfaceOnLayer(
                level,
                discoveryPoint.x,
                discoveryPoint.z,
                layer
            )


        if(discoveryY == null)
        {
            continue
        }


        surfaceHits++


        /*
         * -------------------------------------------------
         * Local refinement
         * -------------------------------------------------
         *
         * We refine every surface hit.
         *
         * Even if the discovery point's own biome is wrong,
         * a nearby anchor may cross into a compatible biome.
         */

        for(
            j = 0;
            j < offsets.length;
            j++
        )
        {
            refinedRawCount++


            var anchorX =
                Math.round(
                    discoveryPoint.x +
                    offsets[j][0]
                )


            var anchorZ =
                Math.round(
                    discoveryPoint.z +
                    offsets[j][1]
                )


            /*
             * Keep the refined anchor inside the safe
             * searchable part of this Structure Region.
             */

            anchorX =
                modfusionCandidateClamp(
                    anchorX,
                    discovery.usableMinX,
                    discovery.usableMaxX
                )


            anchorZ =
                modfusionCandidateClamp(
                    anchorZ,
                    discovery.usableMinZ,
                    discovery.usableMaxZ
                )


            anchorX =
                Math.floor(
                    anchorX
                )


            anchorZ =
                Math.floor(
                    anchorZ
                )


            var key =
                String(anchorX) +
                "|" +
                String(anchorZ)


            if(seen[key] === true)
            {
                duplicateCount++

                continue
            }


            seen[key] =
                true


            var anchorY =
                findModfusionCandidateSurfaceOnLayer(
                    level,
                    anchorX,
                    anchorZ,
                    layer
                )


            if(anchorY == null)
            {
                continue
            }


            refinedSurfaceHits++


            /*
             * ---------------------------------------------
             * Center biome prefilter
             * ---------------------------------------------
             */

            var biomeId =
                global.ModfusionBuildingAnalyzer
                    .getBiomeId(
                        level,
                        anchorX,
                        anchorY,
                        anchorZ
                    )


            if(
                biomeId == null ||
                !global.ModfusionBuildingRegistry
                    .isAllowedInBiome(
                        buildingId,
                        biomeId
                    )
            )
            {
                incompatibleBiomeCount++

                continue
            }


            /*
             * ---------------------------------------------
             * Cheap support
             * ---------------------------------------------
             */

            var cheapSupport =
                getModfusionCheapFoundationSupport(
                    level,
                    anchorX,
                    anchorY,
                    anchorZ,
                    layer,
                    config
                )


            var tieHash =
                modfusionCandidateHashString(
                    seedText +
                    "|" +
                    layer.id +
                    "|" +
                    anchorX +
                    "|" +
                    anchorZ
                )


            anchors.push({

                x:
                    anchorX,

                y:
                    anchorY,

                z:
                    anchorZ,

                biome:
                    biomeId,

                layer:
                    layer.id,

                sourceGridX:
                    discoveryPoint.gridX,

                sourceGridZ:
                    discoveryPoint.gridZ,

                cheapTerrainPoints:
                    cheapSupport.terrainPoints,

                cheapStablePoints:
                    cheapSupport.stablePoints,

                cheapTotalPoints:
                    cheapSupport.totalPoints,

                tieHash:
                    tieHash
            })
        }
    }


    /*
     * =====================================================
     * Rank candidates
     * =====================================================
     *
     * Primary:
     * stable support
     *
     * Secondary:
     * terrain support
     *
     * Tie:
     * deterministic hash
     */

    anchors.sort(
        function(a, b)
        {
            if(
                a.cheapStablePoints >
                b.cheapStablePoints
            )
            {
                return -1
            }


            if(
                a.cheapStablePoints <
                b.cheapStablePoints
            )
            {
                return 1
            }


            if(
                a.cheapTerrainPoints >
                b.cheapTerrainPoints
            )
            {
                return -1
            }


            if(
                a.cheapTerrainPoints <
                b.cheapTerrainPoints
            )
            {
                return 1
            }


            if(a.tieHash < b.tieHash)
            {
                return -1
            }


            if(a.tieHash > b.tieHash)
            {
                return 1
            }


            return 0
        }
    )


    return {

        layer:
            layer.id,

        discoveryPoints:
            discovery.points.length,

        discoverySurfaceHits:
            surfaceHits,

        refinementInnerRadius:
            radii.inner,

        refinementOuterRadius:
            radii.outer,

        refinedRawCount:
            refinedRawCount,

        refinedSurfaceHits:
            refinedSurfaceHits,

        incompatibleBiomeCount:
            incompatibleBiomeCount,

        duplicateCount:
            duplicateCount,

        compatibleAnchors:
            anchors.length,

        anchors:
            anchors
    }
}


/*
 * =========================================================
 * Analyze best anchors from one layer
 * =========================================================
 */

function analyzeModfusionLayerCandidatePool(
    level,
    buildingId,
    config,
    pool
)
{
    var maxCandidates =
        Number(
            config.maxAnalyzerCandidatesPerLayer
        )


    if(
        isNaN(maxCandidates) ||
        maxCandidates <= 0
    )
    {
        maxCandidates =
            MODFUSION_MAX_ANALYZER_CANDIDATES_PER_LAYER
    }


    maxCandidates =
        Math.floor(
            maxCandidates
        )


    var count =
        Math.min(
            maxCandidates,
            pool.anchors.length
        )


    var attempts = []


    var i


    for(
        i = 0;
        i < count;
        i++
    )
    {
        var anchor =
            pool.anchors[i]


        var analyzerResult =
            global.ModfusionBuildingAnalyzer
                .analyzeBuilding(
                    level,
                    anchor.x,
                    anchor.y,
                    anchor.z,
                    buildingId
                )


        var valid =
            (
                analyzerResult != null &&
                analyzerResult.valid === true
            )


        var reason =
            valid
            ? "VALID"
            : getModfusionCandidateAnalyzerFailureReason(
                analyzerResult
            )


        var attempt = {

            number:
                i + 1,

            layer:
                anchor.layer,

            x:
                anchor.x,

            y:
                anchor.y,

            z:
                anchor.z,

            biome:
                anchor.biome,

            cheapStablePoints:
                anchor.cheapStablePoints,

            cheapTerrainPoints:
                anchor.cheapTerrainPoints,

            cheapTotalPoints:
                anchor.cheapTotalPoints,

            valid:
                valid,

            reason:
                reason,

            analyzer:
                analyzerResult
        }


        attempts.push(
            attempt
        )


        if(valid)
        {
            return {

                found:
                    true,

                selected:
                    attempt,

                attempts:
                    attempts,

                analyzerCandidateCount:
                    count
            }
        }
    }


    return {

        found:
            false,

        selected:
            null,

        attempts:
            attempts,

        analyzerCandidateCount:
            count
    }
}


/*
 * =========================================================
 * Search one Structure Region
 * =========================================================
 */

function searchModfusionBuildingCandidateRegion(
    level,
    regionX,
    regionZ
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


    if(
        global.ModfusionBuildingAnalyzer ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "ANALYZER_NOT_LOADED"
        }
    }


    /*
     * =====================================================
     * Dimension
     * =====================================================
     */

    var dimensionId =
        String(
            level.dimension
        )


    if(
        dimensionId !==
        MODFUSION_CANDIDATE_DIMENSION_ID
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


    regionX =
        Math.floor(
            Number(regionX)
        )


    regionZ =
        Math.floor(
            Number(regionZ)
        )


    /*
     * =====================================================
     * Distributor
     * =====================================================
     */

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
        return {

            status:
                "ERROR",

            reason:
                (
                    assignment != null &&
                    assignment.reason != null
                )
                ? assignment.reason
                : "DISTRIBUTOR_ERROR"
        }
    }


    /*
     * =====================================================
     * EMPTY / Reserve Region
     * =====================================================
     *
     * B3.1 still skips these directly.
     *
     * B3.2 will later use them as deterministic Reserve
     * Regions when a Home Region fails.
     */

    if(!assignment.active)
    {
        return {

            status:
                "OK",

            outcome:
                "EMPTY_REGION",

            version:
                MODFUSION_CANDIDATE_VERSION,

            regionX:
                regionX,

            regionZ:
                regionZ,

            buildingId:
                null,

            selected:
                null,

            layerReports:
                []
        }
    }


    /*
     * =====================================================
     * Building
     * =====================================================
     */

    var buildingId =
        String(
            assignment.buildingId
        )


    var config =
        global.ModfusionBuildingRegistry
            .get(
                buildingId
            )


    if(config == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "UNKNOWN_ASSIGNED_BUILDING",

            buildingId:
                buildingId
        }
    }


    /*
     * =====================================================
     * Region bounds
     * =====================================================
     */

    var bounds =
        getModfusionCandidateRegionBounds(
            regionX,
            regionZ
        )


    /*
     * =====================================================
     * Deterministic seed
     * =====================================================
     */

    var distributionSeed =
        0


    if(
        assignment.plan != null &&
        assignment.plan.seedHash != null
    )
    {
        distributionSeed =
            assignment.plan.seedHash
    }


    var seedText =
        String(distributionSeed) +
        "|candidate_v" +
        MODFUSION_CANDIDATE_VERSION +
        "|" +
        regionX +
        "|" +
        regionZ +
        "|" +
        buildingId


    /*
     * =====================================================
     * Discovery points
     * =====================================================
     */

    var discovery =
        generateModfusionDiscoveryPositions(
            bounds,
            config,
            seedText
        )


    /*
     * =====================================================
     * Layer order
     * =====================================================
     */

    var layers =
        getModfusionCandidateLayerOrder(
            config,
            seedText
        )


    if(layers.length === 0)
    {
        return {

            status:
                "ERROR",

            reason:
                "NO_ALLOWED_LAYERS",

            buildingId:
                buildingId
        }
    }


    /*
     * =====================================================
     * Search layers
     * =====================================================
     */

    var layerReports = []


    var allAnalyzerAttempts = []


    var layerIndex


    for(
        layerIndex = 0;
        layerIndex < layers.length;
        layerIndex++
    )
    {
        var layer =
            layers[layerIndex]


        /*
         * -------------------------------------------------
         * Discovery + refinement + ranking
         * -------------------------------------------------
         */

        var pool =
            buildModfusionLayerCandidatePool(
                level,
                buildingId,
                config,
                layer,
                discovery,
                seedText
            )


        /*
         * -------------------------------------------------
         * Full Analyzer only on best anchors
         * -------------------------------------------------
         */

        var analysis =
            analyzeModfusionLayerCandidatePool(
                level,
                buildingId,
                config,
                pool
            )


        var i


        for(
            i = 0;
            i < analysis.attempts.length;
            i++
        )
        {
            allAnalyzerAttempts.push(
                analysis.attempts[i]
            )
        }


        var layerReport = {

            layer:
                layer.id,

            discoveryPoints:
                pool.discoveryPoints,

            discoverySurfaceHits:
                pool.discoverySurfaceHits,

            refinementInnerRadius:
                pool.refinementInnerRadius,

            refinementOuterRadius:
                pool.refinementOuterRadius,

            refinedRawCount:
                pool.refinedRawCount,

            refinedSurfaceHits:
                pool.refinedSurfaceHits,

            incompatibleBiomeCount:
                pool.incompatibleBiomeCount,

            duplicateCount:
                pool.duplicateCount,

            compatibleAnchors:
                pool.compatibleAnchors,

            analyzerCandidateCount:
                analysis.analyzerCandidateCount,

            analyzerAttempts:
                analysis.attempts.length,

            found:
                analysis.found
        }


        layerReports.push(
            layerReport
        )


        /*
         * First VALID wins.
         */

        if(analysis.found)
        {
            return {

                status:
                    "OK",

                outcome:
                    "VALID_SITE_FOUND",

                version:
                    MODFUSION_CANDIDATE_VERSION,

                regionX:
                    regionX,

                regionZ:
                    regionZ,

                superX:
                    assignment.superX,

                superZ:
                    assignment.superZ,

                buildingId:
                    buildingId,

                preferredLayer:
                    layers[0].id,

                discoveryPointCount:
                    discovery.points.length,

                padding:
                    discovery.padding,

                selected:
                    analysis.selected,

                layerReports:
                    layerReports,

                analyzerAttempts:
                    allAnalyzerAttempts
            }
        }
    }


    /*
     * =====================================================
     * No valid site
     * =====================================================
     */

    return {

        status:
            "OK",

        outcome:
            "NO_VALID_SITE",

        version:
            MODFUSION_CANDIDATE_VERSION,

        regionX:
            regionX,

        regionZ:
            regionZ,

        superX:
            assignment.superX,

        superZ:
            assignment.superZ,

        buildingId:
            buildingId,

        preferredLayer:
            layers[0].id,

        discoveryPointCount:
            discovery.points.length,

        padding:
            discovery.padding,

        selected:
            null,

        layerReports:
            layerReports,

        analyzerAttempts:
            allAnalyzerAttempts
    }
}


/*
 * =========================================================
 * Search from block coordinate
 * =========================================================
 */

function searchModfusionBuildingCandidateBlock(
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
                (
                    assignment != null &&
                    assignment.reason != null
                )
                ? assignment.reason
                : "DISTRIBUTOR_ERROR"
        }
    }


    return searchModfusionBuildingCandidateRegion(
        level,
        assignment.regionX,
        assignment.regionZ
    )
}


/*
 * =========================================================
 * Output helper
 * =========================================================
 */

function modfusionCandidateMessage(
    player,
    message
)
{
    console.log(
        "[ModFusion Candidate Search] " +
        message
    )


    if(player != null)
    {
        player.tell(
            "[ModFusion Candidate Search] " +
            message
        )
    }
}


/*
 * =========================================================
 * Layer report
 * =========================================================
 */

function printModfusionCandidateLayerReport(
    player,
    layerReport
)
{
    modfusionCandidateMessage(
        player,
        "Layer: " +
        layerReport.layer
    )


    modfusionCandidateMessage(
        player,
        "Discovery surface hits: " +
        layerReport.discoverySurfaceHits +
        " / " +
        layerReport.discoveryPoints
    )


    modfusionCandidateMessage(
        player,
        "Refinement radius: " +
        layerReport.refinementInnerRadius +
        " / " +
        layerReport.refinementOuterRadius
    )


    modfusionCandidateMessage(
        player,
        "Refined surface hits: " +
        layerReport.refinedSurfaceHits +
        " / raw " +
        layerReport.refinedRawCount
    )


    modfusionCandidateMessage(
        player,
        "Biome-incompatible anchors: " +
        layerReport.incompatibleBiomeCount
    )


    modfusionCandidateMessage(
        player,
        "Compatible refined anchors: " +
        layerReport.compatibleAnchors
    )


    modfusionCandidateMessage(
        player,
        "Full Analyzer attempts: " +
        layerReport.analyzerAttempts
    )
}


/*
 * =========================================================
 * Analyzer attempt report
 * =========================================================
 */

function printModfusionCandidateAnalyzerAttempt(
    player,
    attempt,
    globalNumber
)
{
    var line =
        "#" +
        globalNumber +
        " " +
        attempt.layer +
        " " +
        attempt.x +
        " " +
        attempt.y +
        " " +
        attempt.z +
        " -> " +
        attempt.reason


    line +=
        " | cheap=" +
        attempt.cheapStablePoints +
        "/" +
        attempt.cheapTotalPoints


    if(attempt.analyzer != null)
    {
        line +=
            " biome=" +
            modfusionCandidatePercent(
                attempt.analyzer.biomeCoverage
            ) +
            "%"


        line +=
            " foundation=" +
            attempt.analyzer.foundationStablePoints +
            "/" +
            attempt.analyzer.foundationTotalPoints
    }


    modfusionCandidateMessage(
        player,
        line
    )
}


/*
 * =========================================================
 * Full report
 * =========================================================
 */

function printModfusionCandidateSearchReport(
    player,
    report
)
{
    if(report == null)
    {
        modfusionCandidateMessage(
            player,
            "ERROR: report is null."
        )

        return
    }


    if(report.status !== "OK")
    {
        modfusionCandidateMessage(
            player,
            "ERROR: " +
            report.reason
        )

        return
    }


    modfusionCandidateMessage(
        player,
        "================================"
    )


    modfusionCandidateMessage(
        player,
        "Region: " +
        report.regionX +
        " " +
        report.regionZ
    )


    /*
     * =====================================================
     * Empty Region
     * =====================================================
     */

    if(
        report.outcome ===
        "EMPTY_REGION"
    )
    {
        modfusionCandidateMessage(
            player,
            "Assignment: EMPTY / RESERVE"
        )


        modfusionCandidateMessage(
            player,
            "B3.1 search skipped."
        )


        modfusionCandidateMessage(
            player,
            "================================"
        )


        return
    }


    /*
     * =====================================================
     * Header
     * =====================================================
     */

    modfusionCandidateMessage(
        player,
        "Building: " +
        report.buildingId
    )


    modfusionCandidateMessage(
        player,
        "Candidate version: " +
        report.version
    )


    modfusionCandidateMessage(
        player,
        "Discovery grid: " +
        MODFUSION_DISCOVERY_GRID_SIDE +
        " x " +
        MODFUSION_DISCOVERY_GRID_SIDE
    )


    modfusionCandidateMessage(
        player,
        "Discovery points: " +
        report.discoveryPointCount
    )


    modfusionCandidateMessage(
        player,
        "Region padding: " +
        report.padding
    )


    modfusionCandidateMessage(
        player,
        "Preferred layer: " +
        report.preferredLayer
    )


    /*
     * =====================================================
     * Layer summaries
     * =====================================================
     */

    var i


    for(
        i = 0;
        i < report.layerReports.length;
        i++
    )
    {
        modfusionCandidateMessage(
            player,
            "--------------------------------"
        )


        printModfusionCandidateLayerReport(
            player,
            report.layerReports[i]
        )
    }


    /*
     * =====================================================
     * Full Analyzer attempts
     * =====================================================
     */

    modfusionCandidateMessage(
        player,
        "--------------------------------"
    )


    modfusionCandidateMessage(
        player,
        "Full Analyzer attempts:"
    )


    if(
        report.analyzerAttempts.length ===
        0
    )
    {
        modfusionCandidateMessage(
            player,
            "NONE"
        )
    }
    else
    {
        for(
            i = 0;
            i < report.analyzerAttempts.length;
            i++
        )
        {
            printModfusionCandidateAnalyzerAttempt(
                player,
                report.analyzerAttempts[i],
                i + 1
            )
        }
    }


    /*
     * =====================================================
     * Final result
     * =====================================================
     */

    modfusionCandidateMessage(
        player,
        "--------------------------------"
    )


    if(
        report.outcome ===
        "VALID_SITE_FOUND"
    )
    {
        var selected =
            report.selected


        modfusionCandidateMessage(
            player,
            "Result: VALID_SITE_FOUND"
        )


        modfusionCandidateMessage(
            player,
            "Selected layer: " +
            selected.layer
        )


        modfusionCandidateMessage(
            player,
            "Selected position: " +
            selected.x +
            " " +
            selected.y +
            " " +
            selected.z
        )


        modfusionCandidateMessage(
            player,
            "Selected biome: " +
            selected.biome
        )


        modfusionCandidateMessage(
            player,
            "Cheap support: " +
            selected.cheapStablePoints +
            "/" +
            selected.cheapTotalPoints
        )


        if(selected.analyzer != null)
        {
            modfusionCandidateMessage(
                player,
                "Biome coverage: " +
                modfusionCandidatePercent(
                    selected.analyzer.biomeCoverage
                ) +
                "%"
            )


            modfusionCandidateMessage(
                player,
                "Foundation: " +
                selected.analyzer.foundationStablePoints +
                "/" +
                selected.analyzer.foundationTotalPoints
            )


            modfusionCandidateMessage(
                player,
                "Broad terrain: " +
                modfusionCandidatePercent(
                    selected.analyzer.terrainCoverage
                ) +
                "%"
            )
        }
    }
    else
    {
        modfusionCandidateMessage(
            player,
            "Result: NO_VALID_SITE"
        )
    }


    modfusionCandidateMessage(
        player,
        "Total full Analyzer calls: " +
        report.analyzerAttempts.length
    )


    modfusionCandidateMessage(
        player,
        "================================"
    )
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */

global.ModfusionBuildingCandidateSearch = {

    searchRegion:
        searchModfusionBuildingCandidateRegion,

    searchBlock:
        searchModfusionBuildingCandidateBlock,

    getRegionBounds:
        getModfusionCandidateRegionBounds,

    generateDiscoveryPositions:
        generateModfusionDiscoveryPositions,

    print:
        printModfusionCandidateSearchReport
}

/*
 * =========================================================
 * B3.2 support
 * Forced building search inside any physical Region
 * =========================================================
 *
 * 普通 searchRegion()：
 *
 * Distributor
 * → 当前 Region 必须本来就被分配建筑
 *
 *
 * forced search：
 *
 * 不考虑这个物理 Region 在 Distributor 中
 * 是 HOME 还是 EMPTY / RESERVE。
 *
 * 直接问：
 *
 * “如果 buildingId 放在这里，
 *  B3.1 能不能找到 VALID SITE？”
 *
 *
 * 主要供：
 *
 * Step 4-B3.2 Reserve Region Fallback
 *
 * 使用。
 */

function searchModfusionSpecificBuildingInRegion(
    level,
    regionX,
    regionZ,
    buildingId
)
{
    /*
     * =====================================================
     * Dependencies
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


    if(
        global.ModfusionBuildingAnalyzer ==
        null
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "ANALYZER_NOT_LOADED"
        }
    }


    /*
     * =====================================================
     * Dimension
     * =====================================================
     */

    var dimensionId =
        String(
            level.dimension
        )


    if(
        dimensionId !==
        MODFUSION_CANDIDATE_DIMENSION_ID
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
     * =====================================================
     * Normalize
     * =====================================================
     */

    regionX =
        Math.floor(
            Number(regionX)
        )


    regionZ =
        Math.floor(
            Number(regionZ)
        )


    buildingId =
        String(
            buildingId
        )


    /*
     * =====================================================
     * Building config
     * =====================================================
     */

    var config =
        global.ModfusionBuildingRegistry
            .get(
                buildingId
            )


    if(config == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "UNKNOWN_BUILDING",

            buildingId:
                buildingId
        }
    }


    if(config.enabled === false)
    {
        return {

            status:
                "ERROR",

            reason:
                "BUILDING_DISABLED",

            buildingId:
                buildingId
        }
    }


    /*
     * B3.2 当前只处理 COMMON quota。
     *
     * DEDICATED Boss Region
     * 以后走另一套系统。
     */

    if(
        String(
            config.regionPolicy
        ) !==
        "COMMON"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                "BUILDING_NOT_COMMON",

            buildingId:
                buildingId
        }
    }


    /*
     * =====================================================
     * Region
     * =====================================================
     */

    var bounds =
        getModfusionCandidateRegionBounds(
            regionX,
            regionZ
        )


    /*
     * =====================================================
     * Get this Region's Super Region
     * =====================================================
     */

    var superInfo =
        global.ModfusionBuildingDistributor
            .getSuperRegion(
                regionX,
                regionZ
            )


    if(superInfo == null)
    {
        return {

            status:
                "ERROR",

            reason:
                "SUPER_REGION_LOOKUP_FAILED"
        }
    }


    /*
     * =====================================================
     * Distribution plan
     * =====================================================
     *
     * 即使目标是 Reserve，
     * 我们仍然使用这个 Super Region 的 seedHash。
     *
     * 因此 Home / Reserve 搜索都保持：
     *
     * World Seed dependent
     * deterministic
     */

    var distributionPlan =
        global.ModfusionBuildingDistributor
            .getSuperRegionPlan(
                level,
                superInfo.superX,
                superInfo.superZ
            )


    if(
        distributionPlan == null ||
        distributionPlan.status !== "OK"
    )
    {
        return {

            status:
                "ERROR",

            reason:
                (
                    distributionPlan != null &&
                    distributionPlan.reason != null
                )
                ? distributionPlan.reason
                : "SUPER_REGION_PLAN_FAILED"
        }
    }


    /*
     * =====================================================
     * Candidate seed
     * =====================================================
     *
     * 必须和普通 Home Search 使用相同规则。
     */

    var seedText =
        String(
            distributionPlan.seedHash
        ) +
        "|candidate_v" +
        MODFUSION_CANDIDATE_VERSION +
        "|" +
        regionX +
        "|" +
        regionZ +
        "|" +
        buildingId


    /*
     * =====================================================
     * Discovery
     * =====================================================
     */

    var discovery =
        generateModfusionDiscoveryPositions(
            bounds,
            config,
            seedText
        )


    /*
     * =====================================================
     * Layers
     * =====================================================
     */

    var layers =
        getModfusionCandidateLayerOrder(
            config,
            seedText
        )


    if(layers.length === 0)
    {
        return {

            status:
                "ERROR",

            reason:
                "NO_ALLOWED_LAYERS",

            buildingId:
                buildingId
        }
    }


    /*
     * =====================================================
     * Search
     * =====================================================
     */

    var layerReports = []

    var allAnalyzerAttempts = []

    var layerIndex


    for(
        layerIndex = 0;
        layerIndex < layers.length;
        layerIndex++
    )
    {
        var layer =
            layers[layerIndex]


        /*
         * Discovery
         * +
         * refinement
         * +
         * cheap ranking
         */

        var pool =
            buildModfusionLayerCandidatePool(
                level,
                buildingId,
                config,
                layer,
                discovery,
                seedText
            )


        /*
         * Full Analyzer
         */

        var analysis =
            analyzeModfusionLayerCandidatePool(
                level,
                buildingId,
                config,
                pool
            )


        var i


        for(
            i = 0;
            i < analysis.attempts.length;
            i++
        )
        {
            allAnalyzerAttempts.push(
                analysis.attempts[i]
            )
        }


        layerReports.push({

            layer:
                layer.id,

            discoveryPoints:
                pool.discoveryPoints,

            discoverySurfaceHits:
                pool.discoverySurfaceHits,

            refinementInnerRadius:
                pool.refinementInnerRadius,

            refinementOuterRadius:
                pool.refinementOuterRadius,

            refinedRawCount:
                pool.refinedRawCount,

            refinedSurfaceHits:
                pool.refinedSurfaceHits,

            incompatibleBiomeCount:
                pool.incompatibleBiomeCount,

            duplicateCount:
                pool.duplicateCount,

            compatibleAnchors:
                pool.compatibleAnchors,

            analyzerCandidateCount:
                analysis.analyzerCandidateCount,

            analyzerAttempts:
                analysis.attempts.length,

            found:
                analysis.found
        })


        if(analysis.found)
        {
            return {

                status:
                    "OK",

                outcome:
                    "VALID_SITE_FOUND",

                forced:
                    true,

                version:
                    MODFUSION_CANDIDATE_VERSION,

                regionX:
                    regionX,

                regionZ:
                    regionZ,

                superX:
                    superInfo.superX,

                superZ:
                    superInfo.superZ,

                buildingId:
                    buildingId,

                preferredLayer:
                    layers[0].id,

                discoveryPointCount:
                    discovery.points.length,

                padding:
                    discovery.padding,

                selected:
                    analysis.selected,

                layerReports:
                    layerReports,

                analyzerAttempts:
                    allAnalyzerAttempts
            }
        }
    }


    return {

        status:
            "OK",

        outcome:
            "NO_VALID_SITE",

        forced:
            true,

        version:
            MODFUSION_CANDIDATE_VERSION,

        regionX:
            regionX,

        regionZ:
            regionZ,

        superX:
            superInfo.superX,

        superZ:
            superInfo.superZ,

        buildingId:
            buildingId,

        preferredLayer:
            layers[0].id,

        discoveryPointCount:
            discovery.points.length,

        padding:
            discovery.padding,

        selected:
            null,

        layerReports:
            layerReports,

        analyzerAttempts:
            allAnalyzerAttempts
    }
}


/*
 * =========================================================
 * Add B3.2 API
 * =========================================================
 */

global.ModfusionBuildingCandidateSearch
    .searchBuildingInRegion =
    searchModfusionSpecificBuildingInRegion


/*
 * =========================================================
 * Test command
 * =========================================================
 *
 * /kubejs custom_command modfusion_candidate_search
 *
 *
 * B3.1:
 *
 * Distributor
 *      ↓
 * 64-point Discovery
 *      ↓
 * Surface
 *      ↓
 * Local Refinement
 *      ↓
 * Biome Prefilter
 *      ↓
 * Cheap Foundation Ranking
 *      ↓
 * Full Analyzer
 *
 *
 * Still DOES NOT:
 *
 * generate structure
 * write persistentData
 * reserve Region
 */

ServerEvents.customCommand(
    "modfusion_candidate_search",
    function(event)
    {
        var player =
            event.player


        if(player == null)
        {
            console.log(
                "[ModFusion Candidate Search] Command must be run by a player."
            )

            return
        }


        var report =
            searchModfusionBuildingCandidateBlock(
                player.level,

                Math.floor(
                    player.x
                ),

                Math.floor(
                    player.z
                )
            )


        printModfusionCandidateSearchReport(
            player,
            report
        )
    }
)


console.log(
    "[ModFusion Candidate Search] Ready."
)