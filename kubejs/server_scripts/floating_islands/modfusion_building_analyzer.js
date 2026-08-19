console.log("[ModFusion Analyzer] Analyzer v3 loading")


/*
 * =========================================================
 * ModFusion Building Analyzer v3
 * =========================================================
 *
 * Responsibility:
 *   1. Find an exposed floating-island surface in a height layer.
 *   2. Check nine foundation points around the building center.
 *   3. Return a deterministic pass/fail result and the ground Y.
 *
 * It does NOT:
 *   - distribute buildings;
 *   - select a building;
 *   - check biomes;
 *   - place structures;
 *   - run every tick.
 */


var MODFUSION_ANALYZER_SCHEMA_VERSION = 3
var MODFUSION_ANALYZER_DIMENSION_ID = "mahou:modfusion_dimension"


/*
 * Surface ranges are inclusive.
 * The complete range is scanned from top to bottom, so surfaces near the
 * lower or upper boundary are not missed.
 */

var MODFUSION_ANALYZER_LAYERS = [
    {
        id: "MIDDLE",
        minSurfaceY: 40,
        maxSurfaceY: 85
    },
    {
        id: "HIGH",
        minSurfaceY: 90,
        maxSurfaceY: 145
    }
]

var MODFUSION_ANALYZER_LAYER_MAP = {}


/*
 * A block must be in this table before it can be treated as ground.
 * More blocks may be registered through the public API or through
 * building.terrain.options.surfaceBlocks.
 */

var MODFUSION_ANALYZER_SURFACE_BLOCKS = {
    "minecraft:grass_block": true,
    "minecraft:dirt": true,
    "minecraft:coarse_dirt": true,
    "minecraft:rooted_dirt": true,
    "minecraft:podzol": true,
    "minecraft:mycelium": true,
    "minecraft:moss_block": true,
    "minecraft:mud": true,
    "minecraft:sand": true,
    "minecraft:red_sand": true,
    "minecraft:gravel": true,
    "minecraft:stone": true,
    "minecraft:deepslate": true,
    "minecraft:snow_block": true,
    "minecraft:ice": true,
    "minecraft:packed_ice": true,
    "minecraft:blue_ice": true,
    "minecraft:terracotta": true
}


/*
 * Fallback list used only when KubeJS cannot expose the block state's
 * replaceable property. Add common plants here; modded plants normally
 * pass through BlockState.canBeReplaced().
 */

var MODFUSION_ANALYZER_OPEN_BLOCKS = {
    "minecraft:air": true,
    "minecraft:cave_air": true,
    "minecraft:void_air": true,
    "minecraft:grass": true,
    "minecraft:short_grass": true,
    "minecraft:tall_grass": true,
    "minecraft:fern": true,
    "minecraft:large_fern": true,
    "minecraft:dead_bush": true,
    "minecraft:snow": true,
    "minecraft:vine": true,
    "minecraft:glow_lichen": true
}


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */

function modfusionAnalyzerHasOwn(object, key)
{
    return Object.prototype.hasOwnProperty.call(object, key)
}


function modfusionAnalyzerIsObject(value)
{
    return value != null && typeof value === "object" && !Array.isArray(value)
}


function modfusionAnalyzerGetDimensionId(level)
{
    if(level == null)
    {
        return null
    }

    try
    {
        return String(level.dimension)
    }
    catch(error)
    {
        return null
    }
}


function modfusionAnalyzerGetBlock(level, x, y, z)
{
    try
    {
        return level.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))
    }
    catch(error)
    {
        return null
    }
}


function modfusionAnalyzerGetBlockId(block)
{
    if(block == null)
    {
        return null
    }

    try
    {
        return String(block.id)
    }
    catch(error)
    {
        return null
    }
}


function modfusionAnalyzerContains(array, value)
{
    if(!Array.isArray(array))
    {
        return false
    }

    var i

    for(i = 0; i < array.length; i++)
    {
        if(String(array[i]) === String(value))
        {
            return true
        }
    }

    return false
}


function modfusionAnalyzerCopyLayer(layer)
{
    if(layer == null)
    {
        return null
    }

    return {
        id: layer.id,
        minSurfaceY: layer.minSurfaceY,
        maxSurfaceY: layer.maxSurfaceY
    }
}


function modfusionAnalyzerResultError(reason, buildingId, extra)
{
    var result = {
        schemaVersion: MODFUSION_ANALYZER_SCHEMA_VERSION,
        status: "ERROR",
        pass: false,
        valid: false,
        reason: reason,
        buildingId: buildingId != null ? String(buildingId) : null,
        center: null,
        foundation: null
    }

    if(modfusionAnalyzerIsObject(extra))
    {
        var key

        for(key in extra)
        {
            if(modfusionAnalyzerHasOwn(extra, key))
            {
                result[key] = extra[key]
            }
        }
    }

    return result
}


function modfusionAnalyzerResultRejected(
    reason,
    building,
    layer,
    x,
    z,
    center,
    foundation
)
{
    return {
        schemaVersion: MODFUSION_ANALYZER_SCHEMA_VERSION,
        status: "OK",
        pass: false,
        valid: false,
        reason: reason,
        buildingId: building != null ? building.id : null,
        targetId: (
            building != null &&
            building.placement != null
        ) ? building.placement.targetId : null,
        layerId: layer != null ? layer.id : null,
        requestedX: x,
        requestedZ: z,
        center: center,
        foundation: foundation
    }
}


/*
 * =========================================================
 * Layer API
 * =========================================================
 */

function initializeModfusionAnalyzerLayers()
{
    var i

    for(i = 0; i < MODFUSION_ANALYZER_LAYERS.length; i++)
    {
        var layer = MODFUSION_ANALYZER_LAYERS[i]

        if(modfusionAnalyzerHasOwn(MODFUSION_ANALYZER_LAYER_MAP, layer.id))
        {
            throw new Error("[ModFusion Analyzer] Duplicate layer: " + layer.id)
        }

        MODFUSION_ANALYZER_LAYER_MAP[layer.id] = layer
    }
}


function getModfusionAnalyzerLayer(layerId)
{
    if(layerId == null)
    {
        return null
    }

    var layer = MODFUSION_ANALYZER_LAYER_MAP[String(layerId)]

    return modfusionAnalyzerCopyLayer(layer)
}


function getModfusionAnalyzerLayers()
{
    var result = []
    var i

    for(i = 0; i < MODFUSION_ANALYZER_LAYERS.length; i++)
    {
        result.push(modfusionAnalyzerCopyLayer(MODFUSION_ANALYZER_LAYERS[i]))
    }

    return result
}


function getModfusionAnalyzerLayerByY(y)
{
    var surfaceY = Number(y)

    if(!isFinite(surfaceY))
    {
        return null
    }

    var i

    for(i = 0; i < MODFUSION_ANALYZER_LAYERS.length; i++)
    {
        var layer = MODFUSION_ANALYZER_LAYERS[i]

        if(surfaceY >= layer.minSurfaceY && surfaceY <= layer.maxSurfaceY)
        {
            return modfusionAnalyzerCopyLayer(layer)
        }
    }

    return null
}


/*
 * =========================================================
 * Surface block API
 * =========================================================
 */

function registerModfusionAnalyzerSurfaceBlock(blockId)
{
    var id = String(blockId)

    if(!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id))
    {
        throw new Error("[ModFusion Analyzer] Invalid block id: " + id)
    }

    MODFUSION_ANALYZER_SURFACE_BLOCKS[id] = true

    return true
}


function createModfusionAnalyzerSurfaceBlocks(building)
{
    var result = {}
    var key

    for(key in MODFUSION_ANALYZER_SURFACE_BLOCKS)
    {
        if(modfusionAnalyzerHasOwn(MODFUSION_ANALYZER_SURFACE_BLOCKS, key))
        {
            result[key] = true
        }
    }

    if(
        building == null ||
        building.terrain == null ||
        building.terrain.options == null
    )
    {
        return result
    }

    var options = building.terrain.options
    var additions = []

    if(Array.isArray(options.surfaceBlocks))
    {
        additions = additions.concat(options.surfaceBlocks)
    }

    /* Compatibility with the previous Registry v2 fields. */
    if(Array.isArray(options.primarySurfaceBlocks))
    {
        additions = additions.concat(options.primarySurfaceBlocks)
    }

    if(Array.isArray(options.fallbackSurfaceBlocks))
    {
        additions = additions.concat(options.fallbackSurfaceBlocks)
    }

    var i

    for(i = 0; i < additions.length; i++)
    {
        result[String(additions[i])] = true
    }

    return result
}


/*
 * The ground block is usable only if the block immediately above it is
 * air or replaceable. This prevents a scan from treating buried stone as
 * the island surface.
 */

function isModfusionAnalyzerOpenBlock(block)
{
    var blockId = modfusionAnalyzerGetBlockId(block)

    if(blockId == null)
    {
        return false
    }

    if(MODFUSION_ANALYZER_OPEN_BLOCKS[blockId] === true)
    {
        return true
    }

    try
    {
        if(block.blockState != null && block.blockState.isAir())
        {
            return true
        }
    }
    catch(error1)
    {
        /* Continue to the next safe check. */
    }

    try
    {
        if(block.blockState != null && block.blockState.canBeReplaced())
        {
            return true
        }
    }
    catch(error2)
    {
        /* Unknown blocks remain closed by default. */
    }

    return false
}


function isModfusionAnalyzerExposedSurface(level, x, y, z, surfaceBlocks)
{
    var ground = modfusionAnalyzerGetBlock(level, x, y, z)
    var groundId = modfusionAnalyzerGetBlockId(ground)

    if(groundId == null || surfaceBlocks[groundId] !== true)
    {
        return false
    }

    var above = modfusionAnalyzerGetBlock(level, x, y + 1, z)

    return isModfusionAnalyzerOpenBlock(above)
}


/*
 * Search from top to bottom. On a floating-island column this returns the
 * highest exposed surface inside the requested range.
 */

function findModfusionAnalyzerSurfaceBetween(
    level,
    x,
    z,
    minY,
    maxY,
    surfaceBlocks
)
{
    var sampleX = Math.floor(x)
    var sampleZ = Math.floor(z)
    var lowerY = Math.floor(Math.min(minY, maxY))
    var upperY = Math.floor(Math.max(minY, maxY))
    var y

    for(y = upperY; y >= lowerY; y--)
    {
        if(
            isModfusionAnalyzerExposedSurface(
                level,
                sampleX,
                y,
                sampleZ,
                surfaceBlocks
            )
        )
        {
            return {
                x: sampleX,
                y: y,
                z: sampleZ,
                blockId: modfusionAnalyzerGetBlockId(
                    modfusionAnalyzerGetBlock(level, sampleX, y, sampleZ)
                )
            }
        }
    }

    return null
}


function findModfusionAnalyzerSurfaceInLayer(
    level,
    buildingId,
    x,
    z,
    layerId
)
{
    var layer = getModfusionAnalyzerLayer(layerId)

    if(level == null || layer == null)
    {
        return null
    }

    var building = null

    if(
        buildingId != null &&
        global.ModfusionBuildingRegistry != null
    )
    {
        building = global.ModfusionBuildingRegistry.get(String(buildingId))
    }

    if(buildingId != null && building == null)
    {
        return null
    }

    var surfaceBlocks = createModfusionAnalyzerSurfaceBlocks(building)

    return findModfusionAnalyzerSurfaceBetween(
        level,
        x,
        z,
        layer.minSurfaceY,
        layer.maxSurfaceY,
        surfaceBlocks
    )
}


/*
 * =========================================================
 * Foundation analysis
 * =========================================================
 */

function readModfusionAnalyzerTerrainInteger(
    building,
    key,
    defaultValue,
    minimum,
    maximum
)
{
    var terrain = building != null ? building.terrain : null
    var value = terrain != null ? Number(terrain[key]) : NaN

    if(!isFinite(value))
    {
        return defaultValue
    }

    value = Math.floor(value)

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


function analyzeModfusionFoundation(
    level,
    building,
    layer,
    center,
    surfaceBlocks,
    includePoints
)
{
    var radius = readModfusionAnalyzerTerrainInteger(
        building,
        "foundationRadius",
        12,
        1,
        128
    )

    var requiredPoints = readModfusionAnalyzerTerrainInteger(
        building,
        "minFoundationPoints",
        7,
        1,
        9
    )

    var maxHeightDifference = readModfusionAnalyzerTerrainInteger(
        building,
        "maxHeightDifference",
        6,
        0,
        64
    )

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

    var minimumY = Math.max(
        layer.minSurfaceY,
        center.y - maxHeightDifference
    )

    var maximumY = Math.min(
        layer.maxSurfaceY,
        center.y + maxHeightDifference
    )

    var validPoints = 0
    var minimumSurfaceY = null
    var maximumSurfaceY = null
    var maximumObservedDifference = 0
    var points = []
    var i

    for(i = 0; i < offsets.length; i++)
    {
        var pointX = center.x + offsets[i][0]
        var pointZ = center.z + offsets[i][1]
        var surface

        if(offsets[i][0] === 0 && offsets[i][1] === 0)
        {
            surface = center
        }
        else
        {
            surface = findModfusionAnalyzerSurfaceBetween(
                level,
                pointX,
                pointZ,
                minimumY,
                maximumY,
                surfaceBlocks
            )
        }

        var difference = surface != null
            ? Math.abs(surface.y - center.y)
            : null

        var pointValid = surface != null && difference <= maxHeightDifference

        if(pointValid)
        {
            validPoints++

            if(minimumSurfaceY == null || surface.y < minimumSurfaceY)
            {
                minimumSurfaceY = surface.y
            }

            if(maximumSurfaceY == null || surface.y > maximumSurfaceY)
            {
                maximumSurfaceY = surface.y
            }

            if(difference > maximumObservedDifference)
            {
                maximumObservedDifference = difference
            }
        }

        if(includePoints === true)
        {
            points.push({
                x: pointX,
                z: pointZ,
                found: surface != null,
                y: surface != null ? surface.y : null,
                blockId: surface != null ? surface.blockId : null,
                heightDifference: difference,
                valid: pointValid
            })
        }
    }

    return {
        pass: validPoints >= requiredPoints,
        radius: radius,
        totalPoints: offsets.length,
        validPoints: validPoints,
        requiredPoints: requiredPoints,
        maxHeightDifference: maxHeightDifference,
        maximumObservedDifference: maximumObservedDifference,
        minimumSurfaceY: minimumSurfaceY,
        maximumSurfaceY: maximumSurfaceY,
        points: points
    }
}


/*
 * =========================================================
 * Main analysis API
 * =========================================================
 *
 * Request:
 * {
 *     level: level,
 *     buildingId: "twilightforest_naga_courtyard",
 *     x: 2153,
 *     z: 1269,
 *     layerId: "MIDDLE",
 *     includePoints: false
 * }
 */

function analyzeModfusionBuilding(request)
{
    if(!modfusionAnalyzerIsObject(request))
    {
        return modfusionAnalyzerResultError("INVALID_REQUEST", null, null)
    }

    var buildingId = request.buildingId != null
        ? String(request.buildingId)
        : null

    if(request.level == null)
    {
        return modfusionAnalyzerResultError("LEVEL_IS_NULL", buildingId, null)
    }

    var dimensionId = modfusionAnalyzerGetDimensionId(request.level)

    if(dimensionId !== MODFUSION_ANALYZER_DIMENSION_ID)
    {
        return modfusionAnalyzerResultError(
            "WRONG_DIMENSION",
            buildingId,
            { dimension: dimensionId }
        )
    }

    if(global.ModfusionBuildingRegistry == null)
    {
        return modfusionAnalyzerResultError(
            "BUILDING_REGISTRY_NOT_LOADED",
            buildingId,
            null
        )
    }

    var building = global.ModfusionBuildingRegistry.get(buildingId)

    if(building == null)
    {
        return modfusionAnalyzerResultError(
            "UNKNOWN_BUILDING",
            buildingId,
            null
        )
    }

    var layer = getModfusionAnalyzerLayer(request.layerId)

    if(layer == null)
    {
        return modfusionAnalyzerResultError(
            "UNKNOWN_LAYER",
            buildingId,
            { layerId: request.layerId }
        )
    }

    var x = Math.floor(Number(request.x))
    var z = Math.floor(Number(request.z))

    if(!isFinite(x) || !isFinite(z))
    {
        return modfusionAnalyzerResultError(
            "INVALID_COORDINATES",
            buildingId,
            null
        )
    }

    if(building.enabled !== true)
    {
        return modfusionAnalyzerResultRejected(
            "BUILDING_DISABLED",
            building,
            layer,
            x,
            z,
            null,
            null
        )
    }

    if(
        building.terrain == null ||
        !modfusionAnalyzerContains(
            building.terrain.allowedLayers,
            layer.id
        )
    )
    {
        return modfusionAnalyzerResultRejected(
            "LAYER_NOT_ALLOWED",
            building,
            layer,
            x,
            z,
            null,
            null
        )
    }

    var surfaceBlocks = createModfusionAnalyzerSurfaceBlocks(building)

    var center = findModfusionAnalyzerSurfaceBetween(
        request.level,
        x,
        z,
        layer.minSurfaceY,
        layer.maxSurfaceY,
        surfaceBlocks
    )

    if(center == null)
    {
        return modfusionAnalyzerResultRejected(
            "NO_SURFACE_IN_LAYER",
            building,
            layer,
            x,
            z,
            null,
            null
        )
    }

    center.layerId = layer.id

    var foundation = analyzeModfusionFoundation(
        request.level,
        building,
        layer,
        center,
        surfaceBlocks,
        request.includePoints === true
    )

    if(!foundation.pass)
    {
        return modfusionAnalyzerResultRejected(
            "INSUFFICIENT_FOUNDATION",
            building,
            layer,
            x,
            z,
            center,
            foundation
        )
    }

    return {
        schemaVersion: MODFUSION_ANALYZER_SCHEMA_VERSION,
        status: "OK",
        pass: true,
        valid: true,
        reason: null,
        buildingId: building.id,
        targetId: (
            building.placement != null
        ) ? building.placement.targetId : null,
        layerId: layer.id,
        requestedX: x,
        requestedZ: z,
        center: center,
        foundation: foundation
    }
}


function analyzeModfusionBuildingInLayer(
    level,
    buildingId,
    x,
    z,
    layerId,
    includePoints
)
{
    return analyzeModfusionBuilding({
        level: level,
        buildingId: buildingId,
        x: x,
        z: z,
        layerId: layerId,
        includePoints: includePoints === true
    })
}


/*
 * =========================================================
 * Debug output
 * =========================================================
 */

function printModfusionAnalyzerResult(player, result)
{
    var send = function(message)
    {
        console.log("[ModFusion Analyzer] " + message)

        if(player != null)
        {
            player.tell("[ModFusion Analyzer] " + message)
        }
    }

    if(result == null)
    {
        send("Result is null")
        return
    }

    send(
        String(result.buildingId) + " -> " +
        (result.pass ? "PASS" : "REJECTED")
    )

    if(result.reason != null)
    {
        send("Reason: " + result.reason)
    }

    if(result.center != null)
    {
        send(
            "Center: " + result.center.x + " " +
            result.center.y + " " + result.center.z +
            " / " + result.center.blockId +
            " / " + result.center.layerId
        )
    }

    if(result.foundation != null)
    {
        send(
            "Foundation: " + result.foundation.validPoints +
            "/" + result.foundation.totalPoints +
            ", required " + result.foundation.requiredPoints +
            ", Y " + result.foundation.minimumSurfaceY +
            "~" + result.foundation.maximumSurfaceY
        )
    }
}


function getNearestModfusionAnalyzerLayer(y)
{
    var playerY = Number(y)
    var bestLayer = null
    var bestDistance = null
    var i

    for(i = 0; i < MODFUSION_ANALYZER_LAYERS.length; i++)
    {
        var layer = MODFUSION_ANALYZER_LAYERS[i]
        var centerY = (layer.minSurfaceY + layer.maxSurfaceY) / 2
        var distance = Math.abs(playerY - centerY)

        if(bestDistance == null || distance < bestDistance)
        {
            bestDistance = distance
            bestLayer = layer
        }
    }

    return modfusionAnalyzerCopyLayer(bestLayer)
}


/*
 * =========================================================
 * Initialization and public API
 * =========================================================
 */

initializeModfusionAnalyzerLayers()


global.ModfusionBuildingAnalyzer = {
    schemaVersion: MODFUSION_ANALYZER_SCHEMA_VERSION,

    analyze: analyzeModfusionBuilding,
    analyzeInLayer: analyzeModfusionBuildingInLayer,

    findSurfaceInLayer: findModfusionAnalyzerSurfaceInLayer,

    getLayer: getModfusionAnalyzerLayer,
    getLayers: getModfusionAnalyzerLayers,
    getLayerByY: getModfusionAnalyzerLayerByY,

    registerSurfaceBlock: registerModfusionAnalyzerSurfaceBlock,
    print: printModfusionAnalyzerResult
}


/*
 * Stand at the target X/Z and near the desired height layer, then run:
 *
 *     /kubejs custom_command modfusion_analyze
 */

ServerEvents.customCommand(
    "modfusion_analyze",
    function(event)
    {
        var player = event.player

        if(player == null)
        {
            console.log("[ModFusion Analyzer] Command requires a player")
            return
        }

        if(global.ModfusionBuildingRegistry == null)
        {
            player.tell("[ModFusion Analyzer] Building Registry is not loaded")
            return
        }

        var layer = getNearestModfusionAnalyzerLayer(player.y)
        var buildings = global.ModfusionBuildingRegistry.getEnabled()
        var i

        player.tell(
            "[ModFusion Analyzer] Testing layer " + layer.id +
            " at X/Z " + Math.floor(player.x) + "/" + Math.floor(player.z)
        )

        for(i = 0; i < buildings.length; i++)
        {
            var result = analyzeModfusionBuildingInLayer(
                player.level,
                buildings[i].id,
                Math.floor(player.x),
                Math.floor(player.z),
                layer.id,
                false
            )

            printModfusionAnalyzerResult(player, result)
        }
    }
)


console.log("[ModFusion Analyzer] Analyzer v3 ready")