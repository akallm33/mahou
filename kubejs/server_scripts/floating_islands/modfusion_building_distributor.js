console.log("[ModFusion Distributor] Distributor v3 loading")


/*
 * =========================================================
 * ModFusion Building Distributor v3
 * =========================================================
 *
 * One shared random-spread grid controls every building. Each grid cell:
 *
 *   1. deterministically selects one height layer;
 *   2. selects one eligible building by weight;
 *   3. creates a bounded list of candidate X/Z positions;
 *   4. asks Analyzer to accept the first usable position.
 *
 * It does NOT:
 *   - place structures;
 *   - write persistent state;
 *   - react to chunk load;
 *   - scan on every tick;
 *   - check biomes;
 *   - guarantee that every cell has valid terrain.
 *
 * Placement, persistence, and chunk triggering are intentionally left to
 * the next orchestration step. The debug command in this file is read-only.
 */


var MODFUSION_DISTRIBUTOR_SCHEMA_VERSION = 3
var MODFUSION_DISTRIBUTOR_DIMENSION_ID = "mahou:modfusion_dimension"


/*
 * Similar to vanilla random_spread:
 *
 * spacingChunks:
 *   Width and depth of one distribution cell.
 *
 * separationChunks:
 *   Candidate offsets use only the first
 *   spacingChunks - separationChunks chunks of a cell. This guarantees a
 *   minimum axis distance between candidate centers in neighboring cells.
 *
 * maxAttempts:
 *   Number of deterministic positions tested inside one cell. Failed
 *   terrain does not cause an unbounded search.
 */

var MODFUSION_DISTRIBUTOR_CONFIG = {
    spacingChunks: 12,
    separationChunks: 2,
    maxAttempts: 128,
    salt: "mahou:modfusion_buildings:v6",

    layerWeights: [
        {
            id: "MIDDLE",
            weight: 1
        }
    ]
}


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */

function modfusionDistributorHasOwn(object, key)
{
    return Object.prototype.hasOwnProperty.call(object, key)
}


function modfusionDistributorIsObject(value)
{
    return value != null && typeof value === "object" && !Array.isArray(value)
}


function modfusionDistributorGetDimensionId(level)
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


function modfusionDistributorReadInteger(value)
{
    var number = Number(value)

    if(!isFinite(number))
    {
        return null
    }

    return Math.floor(number)
}


function modfusionDistributorCreateError(reason, extra)
{
    var result = {
        schemaVersion: MODFUSION_DISTRIBUTOR_SCHEMA_VERSION,
        status: "ERROR",
        ready: false,
        reason: reason,
        cell: null,
        layerId: null,
        buildingId: null,
        candidate: null,
        analysis: null,
        attempts: []
    }

    if(modfusionDistributorIsObject(extra))
    {
        var key

        for(key in extra)
        {
            if(modfusionDistributorHasOwn(extra, key))
            {
                result[key] = extra[key]
            }
        }
    }

    return result
}


function modfusionDistributorCreateRejected(reason, plan, attempts)
{
    return {
        schemaVersion: MODFUSION_DISTRIBUTOR_SCHEMA_VERSION,
        status: "OK",
        ready: false,
        reason: reason,
        seedKey: plan.seedKey,
        cell: plan.cell,
        layerId: plan.layerId,
        buildingId: plan.buildingId,
        building: plan.building,
        candidate: null,
        analysis: null,
        attempts: Array.isArray(attempts) ? attempts : []
    }
}


function validateModfusionDistributorConfig()
{
    var spacing = MODFUSION_DISTRIBUTOR_CONFIG.spacingChunks
    var separation = MODFUSION_DISTRIBUTOR_CONFIG.separationChunks
    var attempts = MODFUSION_DISTRIBUTOR_CONFIG.maxAttempts

    if(
        typeof spacing !== "number" ||
        Math.floor(spacing) !== spacing ||
        spacing < 2
    )
    {
        throw new Error(
            "[ModFusion Distributor] spacingChunks must be an integer >= 2"
        )
    }

    if(
        typeof separation !== "number" ||
        Math.floor(separation) !== separation ||
        separation < 1 ||
        separation >= spacing
    )
    {
        throw new Error(
            "[ModFusion Distributor] separationChunks must be from 1 to " +
            (spacing - 1)
        )
    }

    if(
        typeof attempts !== "number" ||
        Math.floor(attempts) !== attempts ||
        attempts < 1 ||
        attempts > 256
    )
    {
        throw new Error(
            "[ModFusion Distributor] maxAttempts must be from 1 to 256"
        )
    }

    if(
        typeof MODFUSION_DISTRIBUTOR_CONFIG.salt !== "string" ||
        MODFUSION_DISTRIBUTOR_CONFIG.salt.length <= 0
    )
    {
        throw new Error(
            "[ModFusion Distributor] salt must be a non-empty string"
        )
    }

    if(
        !Array.isArray(MODFUSION_DISTRIBUTOR_CONFIG.layerWeights) ||
        MODFUSION_DISTRIBUTOR_CONFIG.layerWeights.length <= 0
    )
    {
        throw new Error(
            "[ModFusion Distributor] layerWeights cannot be empty"
        )
    }

    var seen = Object.create(null)
    var i

    for(i = 0; i < MODFUSION_DISTRIBUTOR_CONFIG.layerWeights.length; i++)
    {
        var entry = MODFUSION_DISTRIBUTOR_CONFIG.layerWeights[i]

        if(
            !modfusionDistributorIsObject(entry) ||
            typeof entry.id !== "string" ||
            !/^[A-Z][A-Z0-9_]*$/.test(entry.id) ||
            typeof entry.weight !== "number" ||
            Math.floor(entry.weight) !== entry.weight ||
            entry.weight < 1
        )
        {
            throw new Error(
                "[ModFusion Distributor] Invalid layerWeights entry at " + i
            )
        }

        if(modfusionDistributorHasOwn(seen, entry.id))
        {
            throw new Error(
                "[ModFusion Distributor] Duplicate layer weight: " + entry.id
            )
        }

        seen[entry.id] = true
    }
}


function getModfusionDistributorConfig()
{
    var layers = []
    var i

    for(i = 0; i < MODFUSION_DISTRIBUTOR_CONFIG.layerWeights.length; i++)
    {
        layers.push({
            id: MODFUSION_DISTRIBUTOR_CONFIG.layerWeights[i].id,
            weight: MODFUSION_DISTRIBUTOR_CONFIG.layerWeights[i].weight
        })
    }

    return {
        spacingChunks: MODFUSION_DISTRIBUTOR_CONFIG.spacingChunks,
        separationChunks: MODFUSION_DISTRIBUTOR_CONFIG.separationChunks,
        maxAttempts: MODFUSION_DISTRIBUTOR_CONFIG.maxAttempts,
        salt: MODFUSION_DISTRIBUTOR_CONFIG.salt,
        layerWeights: layers
    }
}


/*
 * =========================================================
 * Seed and deterministic random helpers
 * =========================================================
 *
 * The seed is kept as text. This avoids losing lower bits when a Java long
 * is larger than JavaScript's exact integer range.
 */

function getModfusionDistributorSeedKey(level)
{
    if(level == null)
    {
        return null
    }

    try
    {
        if(typeof level.getSeed === "function")
        {
            return String(level.getSeed())
        }
    }
    catch(error1)
    {
        /* Try the next supported access path. */
    }

    try
    {
        if(level.seed != null)
        {
            return String(level.seed)
        }
    }
    catch(error2)
    {
        /* Try the next supported access path. */
    }

    try
    {
        if(
            level.minecraftLevel != null &&
            typeof level.minecraftLevel.getSeed === "function"
        )
        {
            return String(level.minecraftLevel.getSeed())
        }
    }
    catch(error3)
    {
        /* No supported seed access path was available. */
    }

    return null
}


/*
 * Java-style 32-bit string hash with an extra xor fold. All multiplication
 * remains safely below JavaScript's exact integer limit before truncation.
 */

function modfusionDistributorHash(value)
{
    var text = String(value)
    var hash = 0
    var i

    for(i = 0; i < text.length; i++)
    {
        hash = ((hash * 31) + text.charCodeAt(i)) | 0
    }

    hash ^= hash >>> 16
    hash ^= hash << 7
    hash ^= hash >>> 11

    return hash >>> 0
}


function modfusionDistributorRandomInt(key, bound)
{
    if(bound <= 0)
    {
        return 0
    }

    return modfusionDistributorHash(key) % bound
}


function createModfusionDistributorCellKey(seedKey, cellX, cellZ)
{
    return (
        MODFUSION_DISTRIBUTOR_CONFIG.salt + ":" +
        seedKey + ":" + cellX + ":" + cellZ
    )
}


/*
 * =========================================================
 * Cell coordinates
 * =========================================================
 */

function getModfusionDistributorCell(cellX, cellZ)
{
    var normalizedX = modfusionDistributorReadInteger(cellX)
    var normalizedZ = modfusionDistributorReadInteger(cellZ)

    if(normalizedX == null || normalizedZ == null)
    {
        return null
    }

    var spacing = MODFUSION_DISTRIBUTOR_CONFIG.spacingChunks
    var minimumChunkX = normalizedX * spacing
    var minimumChunkZ = normalizedZ * spacing
    var maximumChunkX = minimumChunkX + spacing - 1
    var maximumChunkZ = minimumChunkZ + spacing - 1

    return {
        x: normalizedX,
        z: normalizedZ,
        key: normalizedX + ":" + normalizedZ,
        minChunkX: minimumChunkX,
        maxChunkX: maximumChunkX,
        minChunkZ: minimumChunkZ,
        maxChunkZ: maximumChunkZ,
        minBlockX: minimumChunkX * 16,
        maxBlockX: maximumChunkX * 16 + 15,
        minBlockZ: minimumChunkZ * 16,
        maxBlockZ: maximumChunkZ * 16 + 15
    }
}


function getModfusionDistributorCellAtBlock(x, z)
{
    var blockX = modfusionDistributorReadInteger(x)
    var blockZ = modfusionDistributorReadInteger(z)

    if(blockX == null || blockZ == null)
    {
        return null
    }

    var chunkX = Math.floor(blockX / 16)
    var chunkZ = Math.floor(blockZ / 16)
    var spacing = MODFUSION_DISTRIBUTOR_CONFIG.spacingChunks

    return getModfusionDistributorCell(
        Math.floor(chunkX / spacing),
        Math.floor(chunkZ / spacing)
    )
}


/*
 * =========================================================
 * Weighted selection
 * =========================================================
 */

function chooseModfusionDistributorWeighted(entries, key, getWeight)
{
    if(!Array.isArray(entries) || entries.length <= 0)
    {
        return null
    }

    var totalWeight = 0
    var i

    for(i = 0; i < entries.length; i++)
    {
        var weight = Number(getWeight(entries[i]))

        if(isFinite(weight) && weight > 0)
        {
            totalWeight += Math.floor(weight)
        }
    }

    if(totalWeight <= 0)
    {
        return null
    }

    var roll = modfusionDistributorRandomInt(key, totalWeight)

    for(i = 0; i < entries.length; i++)
    {
        var entryWeight = Number(getWeight(entries[i]))

        if(!isFinite(entryWeight) || entryWeight <= 0)
        {
            continue
        }

        roll -= Math.floor(entryWeight)

        if(roll < 0)
        {
            return entries[i]
        }
    }

    return entries[entries.length - 1]
}


function getModfusionDistributorAvailableLayers()
{
    if(
        global.ModfusionBuildingRegistry == null ||
        typeof global.ModfusionBuildingRegistry.getEnabledForLayer !== "function"
    )
    {
        return []
    }

    var configured = MODFUSION_DISTRIBUTOR_CONFIG.layerWeights
    var result = []
    var i

    for(i = 0; i < configured.length; i++)
    {
        var buildings = global.ModfusionBuildingRegistry.getEnabledForLayer(
            configured[i].id
        )

        if(buildings.length > 0)
        {
            result.push({
                id: configured[i].id,
                weight: configured[i].weight
            })
        }
    }

    return result
}


/*
 * =========================================================
 * Deterministic cell plan
 * =========================================================
 */

function createModfusionDistributorPlan(level, cellX, cellZ)
{
    if(level == null)
    {
        return modfusionDistributorCreateError("LEVEL_IS_NULL", null)
    }

    var dimensionId = modfusionDistributorGetDimensionId(level)

    if(dimensionId !== MODFUSION_DISTRIBUTOR_DIMENSION_ID)
    {
        return modfusionDistributorCreateError(
            "WRONG_DIMENSION",
            { dimension: dimensionId }
        )
    }

    if(global.ModfusionBuildingRegistry == null)
    {
        return modfusionDistributorCreateError(
            "BUILDING_REGISTRY_NOT_LOADED",
            null
        )
    }

    var cell = getModfusionDistributorCell(cellX, cellZ)

    if(cell == null)
    {
        return modfusionDistributorCreateError("INVALID_CELL", null)
    }

    var seedKey = getModfusionDistributorSeedKey(level)

    if(seedKey == null)
    {
        return modfusionDistributorCreateError(
            "WORLD_SEED_UNAVAILABLE",
            { cell: cell }
        )
    }

    var cellKey = createModfusionDistributorCellKey(
        seedKey,
        cell.x,
        cell.z
    )

    var availableLayers = getModfusionDistributorAvailableLayers()

    if(availableLayers.length <= 0)
    {
        return modfusionDistributorCreateError(
            "NO_AVAILABLE_LAYERS",
            { seedKey: seedKey, cell: cell }
        )
    }

    var selectedLayer = chooseModfusionDistributorWeighted(
        availableLayers,
        cellKey + ":layer",
        function(entry)
        {
            return entry.weight
        }
    )

    var buildings = global.ModfusionBuildingRegistry.getEnabledForLayer(
        selectedLayer.id
    )

    var selectedBuilding = chooseModfusionDistributorWeighted(
        buildings,
        cellKey + ":building",
        function(building)
        {
            return building.distribution.weight
        }
    )

    if(selectedBuilding == null)
    {
        return modfusionDistributorCreateError(
            "NO_ELIGIBLE_BUILDINGS",
            {
                seedKey: seedKey,
                cell: cell,
                layerId: selectedLayer.id
            }
        )
    }

    return {
        schemaVersion: MODFUSION_DISTRIBUTOR_SCHEMA_VERSION,
        status: "OK",
        ready: false,
        reason: null,
        seedKey: seedKey,
        cellKey: cellKey,
        cell: cell,
        layerId: selectedLayer.id,
        buildingId: selectedBuilding.id,
        building: selectedBuilding,
        candidate: null,
        analysis: null,
        attempts: []
    }
}


function createModfusionDistributorPlanAtBlock(level, x, z)
{
    var cell = getModfusionDistributorCellAtBlock(x, z)

    if(cell == null)
    {
        return modfusionDistributorCreateError(
            "INVALID_COORDINATES",
            null
        )
    }

    return createModfusionDistributorPlan(level, cell.x, cell.z)
}


/*
 * =========================================================
 * Candidate generation
 * =========================================================
 *
 * Every attempt remains inside the same vanilla-style offset range, so
 * retries cannot cross into a neighboring distribution cell.
 */

function createModfusionDistributorCandidate(plan, attemptIndex)
{
    if(
        plan == null ||
        plan.status !== "OK" ||
        plan.cell == null
    )
    {
        return null
    }

    var attempt = modfusionDistributorReadInteger(attemptIndex)

    if(
        attempt == null ||
        attempt < 0 ||
        attempt >= MODFUSION_DISTRIBUTOR_CONFIG.maxAttempts
    )
    {
        return null
    }

    var spacing = MODFUSION_DISTRIBUTOR_CONFIG.spacingChunks
    var separation = MODFUSION_DISTRIBUTOR_CONFIG.separationChunks
    var offsetRange = spacing - separation
    var key = plan.cellKey + ":attempt:" + attempt

    var offsetChunkX = modfusionDistributorRandomInt(
        key + ":chunk_x",
        offsetRange
    )

    var offsetChunkZ = modfusionDistributorRandomInt(
        key + ":chunk_z",
        offsetRange
    )

    var chunkX = plan.cell.minChunkX + offsetChunkX
    var chunkZ = plan.cell.minChunkZ + offsetChunkZ

    var blockX = (
        chunkX * 16 +
        modfusionDistributorRandomInt(key + ":block_x", 16)
    )

    var blockZ = (
        chunkZ * 16 +
        modfusionDistributorRandomInt(key + ":block_z", 16)
    )

    return {
        attempt: attempt,
        x: blockX,
        z: blockZ,
        chunkX: chunkX,
        chunkZ: chunkZ,
        offsetChunkX: offsetChunkX,
        offsetChunkZ: offsetChunkZ
    }
}


function getModfusionDistributorCandidates(plan)
{
    var result = []
    var seen = Object.create(null)
    var i

    for(i = 0; i < MODFUSION_DISTRIBUTOR_CONFIG.maxAttempts; i++)
    {
        var candidate = createModfusionDistributorCandidate(plan, i)

        if(candidate == null)
        {
            continue
        }

        var key = candidate.x + ":" + candidate.z

        if(!modfusionDistributorHasOwn(seen, key))
        {
            seen[key] = true
            result.push(candidate)
        }
    }

    return result
}


/*
 * =========================================================
 * Terrain resolution
 * =========================================================
 */

function resolveModfusionDistributorPlan(level, plan, includeAttempts)
{
    if(plan == null || plan.status !== "OK")
    {
        return plan != null
            ? plan
            : modfusionDistributorCreateError("INVALID_PLAN", null)
    }

    if(
        global.ModfusionBuildingAnalyzer == null ||
        typeof global.ModfusionBuildingAnalyzer.analyzeInLayer !== "function"
    )
    {
        return modfusionDistributorCreateError(
            "BUILDING_ANALYZER_NOT_LOADED",
            {
                seedKey: plan.seedKey,
                cell: plan.cell,
                layerId: plan.layerId,
                buildingId: plan.buildingId
            }
        )
    }

    var candidates = getModfusionDistributorCandidates(plan)
    var attemptResults = []
    var i

    for(i = 0; i < candidates.length; i++)
    {
        var candidate = candidates[i]

        var analysis = global.ModfusionBuildingAnalyzer.analyzeInLayer(
            level,
            plan.buildingId,
            candidate.x,
            candidate.z,
            plan.layerId,
            false
        )

        if(includeAttempts === true)
        {
            attemptResults.push({
                attempt: candidate.attempt,
                x: candidate.x,
                z: candidate.z,
                chunkX: candidate.chunkX,
                chunkZ: candidate.chunkZ,
                pass: analysis != null && analysis.pass === true,
                reason: analysis != null ? analysis.reason : "NULL_ANALYSIS",
                surfaceY: (
                    analysis != null &&
                    analysis.center != null
                ) ? analysis.center.y : null
            })
        }

        if(analysis != null && analysis.pass === true)
        {
            return {
                schemaVersion: MODFUSION_DISTRIBUTOR_SCHEMA_VERSION,
                status: "OK",
                ready: true,
                reason: null,
                seedKey: plan.seedKey,
                cellKey: plan.cellKey,
                cell: plan.cell,
                layerId: plan.layerId,
                buildingId: plan.buildingId,
                building: plan.building,
                candidate: candidate,
                analysis: analysis,
                attempts: attemptResults
            }
        }
    }

    return modfusionDistributorCreateRejected(
        "NO_VALID_SITE",
        plan,
        attemptResults
    )
}


function resolveModfusionDistributorCell(
    level,
    cellX,
    cellZ,
    includeAttempts
)
{
    var plan = createModfusionDistributorPlan(level, cellX, cellZ)

    return resolveModfusionDistributorPlan(
        level,
        plan,
        includeAttempts === true
    )
}


function resolveModfusionDistributorAtBlock(level, x, z, includeAttempts)
{
    var plan = createModfusionDistributorPlanAtBlock(level, x, z)

    return resolveModfusionDistributorPlan(
        level,
        plan,
        includeAttempts === true
    )
}


/*
 * =========================================================
 * Debug output
 * =========================================================
 */

function printModfusionDistributorResult(player, result)
{
    var send = function(message)
    {
        console.log("[ModFusion Distributor] " + message)

        if(player != null)
        {
            player.tell("[ModFusion Distributor] " + message)
        }
    }

    if(result == null)
    {
        send("Result is null")
        return
    }

    if(result.status !== "OK")
    {
        send("ERROR: " + result.reason)
        return
    }

    send(
        "Cell " + result.cell.x + "/" + result.cell.z +
        " -> " + result.buildingId +
        " / " + result.layerId
    )

    if(result.ready)
    {
        send(
            "READY at " + result.analysis.center.x + " " +
            result.analysis.center.y + " " +
            result.analysis.center.z +
            " / attempt " + result.candidate.attempt
        )
    }
    else
    {
        send("REJECTED: " + result.reason)
    }

    if(Array.isArray(result.attempts))
    {
        var i

        for(i = 0; i < result.attempts.length; i++)
        {
            var attempt = result.attempts[i]

            send(
                "#" + attempt.attempt +
                " X/Z " + attempt.x + "/" + attempt.z +
                " -> " + (attempt.pass ? "PASS" : attempt.reason) +
                (attempt.surfaceY != null
                    ? " / Y " + attempt.surfaceY
                    : "")
            )
        }
    }
}


/*
 * =========================================================
 * Initialization and public API
 * =========================================================
 */

validateModfusionDistributorConfig()


global.ModfusionBuildingDistributor = {
    schemaVersion: MODFUSION_DISTRIBUTOR_SCHEMA_VERSION,

    getConfig: getModfusionDistributorConfig,
    getSeedKey: getModfusionDistributorSeedKey,

    getCell: getModfusionDistributorCell,
    getCellAtBlock: getModfusionDistributorCellAtBlock,

    createPlan: createModfusionDistributorPlan,
    createPlanAtBlock: createModfusionDistributorPlanAtBlock,
    createCandidate: createModfusionDistributorCandidate,
    getCandidates: getModfusionDistributorCandidates,

    resolvePlan: resolveModfusionDistributorPlan,
    resolveCell: resolveModfusionDistributorCell,
    resolveAtBlock: resolveModfusionDistributorAtBlock,

    print: printModfusionDistributorResult
}


/*
 * Read-only test command. It never calls Generation.
 *
 * Stand anywhere in ModFusion dimension and run:
 *
 *   /kubejs custom_command modfusion_distribution
 */

ServerEvents.customCommand(
    "modfusion_distribution",
    function(event)
    {
        var player = event.player

        if(player == null)
        {
            console.log(
                "[ModFusion Distributor] Command requires a player"
            )
            return
        }

        var result = resolveModfusionDistributorAtBlock(
            player.level,
            Math.floor(player.x),
            Math.floor(player.z),
            true
        )

        printModfusionDistributorResult(player, result)
    }
)


console.log(
    "[ModFusion Distributor] Distributor v3 ready. " +
    "Spacing=" + MODFUSION_DISTRIBUTOR_CONFIG.spacingChunks +
    " chunks, separation=" +
    MODFUSION_DISTRIBUTOR_CONFIG.separationChunks +
    ", attempts=" + MODFUSION_DISTRIBUTOR_CONFIG.maxAttempts
)