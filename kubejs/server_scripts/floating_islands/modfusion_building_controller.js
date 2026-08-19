console.log("[ModFusion Controller] Controller v3 loading")


/*
 * =========================================================
 * ModFusion Building Controller v3
 * =========================================================
 *
 * This is the only automatic orchestration module.
 *
 * Responsibilities:
 *   - notice when a player enters a new distribution cell;
 *   - enqueue that cell once;
 *   - resolve candidates gradually;
 *   - preload placement chunks gradually;
 *   - call Generation only after Analyzer passes;
 *   - write terminal cell state to level.persistentData;
 *   - prevent duplicate generation.
 *
 * It does not scan the whole world. Player tick only performs a small
 * interval/cell-change check. Expensive work is performed by a bounded,
 * single-job queue.
 */


var MODFUSION_CONTROLLER_SCHEMA_VERSION = 3
var MODFUSION_CONTROLLER_DIMENSION_ID = "mahou:modfusion_dimension"


var MODFUSION_CONTROLLER_CONFIG = {
    enabled: true,

    /* Check player cell changes every two seconds. */
    playerScanIntervalTicks: 40,

    /* Process at most one queue step per server tick. */
    workerIntervalTicks: 1,

    /* Incremental structure-area preloading. */
    chunksPerWorkerStep: 2,
    placementPreloadRadiusChunks: 3,

    maxQueueSize: 64,

    /*
     * Safety guard.
     *
     * Twilight Forest registered structures may recalculate their own Y.
     * Keep this false until their height behavior is accepted or replaced
     * by an exact-Y adapter.
     */
    allowInexactYAdapters: false,

    /* The origin cell belongs to the ModFusion spawn structure. */
    reservedCells: {
        "0:0": true
    }
}


var MODFUSION_CONTROLLER_STATE_PREFIX =
    "mahouModfusionBuildingControllerV6"


var MODFUSION_CONTROLLER_TERMINAL_STATES = {
    "RESERVED": true,
    "GENERATED": true,
    "NO_VALID_SITE": true,
    "PLACE_FAILED": true
}


var MODFUSION_CONTROLLER_QUEUE = []
var MODFUSION_CONTROLLER_QUEUED_CELLS = Object.create(null)
var MODFUSION_CONTROLLER_ACTIVE_JOB = null
var MODFUSION_CONTROLLER_PLAYER_CELLS = Object.create(null)
var MODFUSION_CONTROLLER_SESSION_BLOCKED = Object.create(null)
var MODFUSION_CONTROLLER_TICK = 0


var MODFUSION_CONTROLLER_STATE_FIELDS = [
    "status",
    "reason",
    "buildingId",
    "targetId",
    "layerId",
    "x",
    "y",
    "z",
    "attempt",
    "updatedTick",
    "exactY"
]


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */

function modfusionControllerHasOwn(object, key)
{
    return Object.prototype.hasOwnProperty.call(object, key)
}


function modfusionControllerIsObject(value)
{
    return value != null && typeof value === "object" && !Array.isArray(value)
}


function modfusionControllerReadInteger(value)
{
    var number = Number(value)

    if(!isFinite(number))
    {
        return null
    }

    return Math.floor(number)
}


function modfusionControllerGetDimensionId(level)
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


function modfusionControllerIsClientLevel(level)
{
    if(level == null)
    {
        return true
    }

    try
    {
        if(typeof level.isClientSide === "function")
        {
            return level.isClientSide()
        }
    }
    catch(error1)
    {
        /* Try the property form. */
    }

    try
    {
        return level.clientSide === true
    }
    catch(error2)
    {
        return false
    }
}


function modfusionControllerGetPlayerKey(player)
{
    if(player == null)
    {
        return null
    }

    try
    {
        if(player.uuid != null)
        {
            return String(player.uuid)
        }
    }
    catch(error1)
    {
        /* Try the profile fallback. */
    }

    try
    {
        return String(player.getGameProfile().getId())
    }
    catch(error2)
    {
        /* Try the name fallback. */
    }

    try
    {
        return String(player.getGameProfile().getName())
    }
    catch(error3)
    {
        return null
    }
}


function modfusionControllerTell(player, message)
{
    console.log("[ModFusion Controller] " + message)

    if(player != null)
    {
        player.tell("[ModFusion Controller] " + message)
    }
}


function validateModfusionControllerConfig()
{
    var integerFields = [
        ["playerScanIntervalTicks", 1, 1200],
        ["workerIntervalTicks", 1, 1200],
        ["chunksPerWorkerStep", 1, 64],
        ["placementPreloadRadiusChunks", 0, 8],
        ["maxQueueSize", 1, 4096]
    ]

    var i

    for(i = 0; i < integerFields.length; i++)
    {
        var key = integerFields[i][0]
        var minimum = integerFields[i][1]
        var maximum = integerFields[i][2]
        var value = MODFUSION_CONTROLLER_CONFIG[key]

        if(
            typeof value !== "number" ||
            Math.floor(value) !== value ||
            value < minimum ||
            value > maximum
        )
        {
            throw new Error(
                "[ModFusion Controller] " + key +
                " must be from " + minimum + " to " + maximum
            )
        }
    }
}


function getModfusionControllerConfig()
{
    var reserved = {}
    var key

    for(key in MODFUSION_CONTROLLER_CONFIG.reservedCells)
    {
        if(modfusionControllerHasOwn(
            MODFUSION_CONTROLLER_CONFIG.reservedCells,
            key
        ))
        {
            reserved[key] = MODFUSION_CONTROLLER_CONFIG.reservedCells[key]
        }
    }

    return {
        enabled: MODFUSION_CONTROLLER_CONFIG.enabled,
        playerScanIntervalTicks:
            MODFUSION_CONTROLLER_CONFIG.playerScanIntervalTicks,
        workerIntervalTicks:
            MODFUSION_CONTROLLER_CONFIG.workerIntervalTicks,
        chunksPerWorkerStep:
            MODFUSION_CONTROLLER_CONFIG.chunksPerWorkerStep,
        placementPreloadRadiusChunks:
            MODFUSION_CONTROLLER_CONFIG.placementPreloadRadiusChunks,
        maxQueueSize: MODFUSION_CONTROLLER_CONFIG.maxQueueSize,
        allowInexactYAdapters:
            MODFUSION_CONTROLLER_CONFIG.allowInexactYAdapters,
        reservedCells: reserved
    }
}


/*
 * =========================================================
 * Persistent cell state
 * =========================================================
 */

function encodeModfusionControllerCoordinate(value)
{
    var number = modfusionControllerReadInteger(value)

    if(number == null)
    {
        return null
    }

    return number < 0 ? "n" + Math.abs(number) : "p" + number
}


function getModfusionControllerStateBase(cellX, cellZ)
{
    var encodedX = encodeModfusionControllerCoordinate(cellX)
    var encodedZ = encodeModfusionControllerCoordinate(cellZ)

    if(encodedX == null || encodedZ == null)
    {
        return null
    }

    return (
        MODFUSION_CONTROLLER_STATE_PREFIX + "_" +
        encodedX + "_" + encodedZ
    )
}


function getModfusionControllerData(level)
{
    if(level == null)
    {
        return null
    }

    try
    {
        return level.persistentData
    }
    catch(error)
    {
        return null
    }
}


function getModfusionControllerCellState(level, cellX, cellZ)
{
    var data = getModfusionControllerData(level)
    var base = getModfusionControllerStateBase(cellX, cellZ)

    if(data == null || base == null)
    {
        return {
            status: "UNAVAILABLE",
            reason: "PERSISTENT_DATA_UNAVAILABLE",
            cellX: cellX,
            cellZ: cellZ
        }
    }

    var status = String(data.getString(base + "_status"))

    if(status.length <= 0)
    {
        status = "UNSEEN"
    }

    return {
        status: status,
        reason: String(data.getString(base + "_reason")),
        buildingId: String(data.getString(base + "_buildingId")),
        targetId: String(data.getString(base + "_targetId")),
        layerId: String(data.getString(base + "_layerId")),
        x: data.getInt(base + "_x"),
        y: data.getInt(base + "_y"),
        z: data.getInt(base + "_z"),
        attempt: data.getInt(base + "_attempt"),
        updatedTick: data.getInt(base + "_updatedTick"),
        exactY: data.getBoolean(base + "_exactY"),
        cellX: modfusionControllerReadInteger(cellX),
        cellZ: modfusionControllerReadInteger(cellZ)
    }
}


function isModfusionControllerTerminalState(status)
{
    return MODFUSION_CONTROLLER_TERMINAL_STATES[String(status)] === true
}


function clearModfusionControllerCellState(level, cellX, cellZ)
{
    var data = getModfusionControllerData(level)
    var base = getModfusionControllerStateBase(cellX, cellZ)

    if(data == null || base == null)
    {
        return false
    }

    var i

    for(i = 0; i < MODFUSION_CONTROLLER_STATE_FIELDS.length; i++)
    {
        data.remove(
            base + "_" + MODFUSION_CONTROLLER_STATE_FIELDS[i]
        )
    }

    return true
}


function writeModfusionControllerCellState(level, cell, record)
{
    var data = getModfusionControllerData(level)
    var base = getModfusionControllerStateBase(cell.x, cell.z)

    if(data == null || base == null)
    {
        return false
    }

    clearModfusionControllerCellState(level, cell.x, cell.z)

    data.putString(base + "_status", String(record.status))
    data.putString(
        base + "_reason",
        record.reason != null ? String(record.reason) : ""
    )
    data.putString(
        base + "_buildingId",
        record.buildingId != null ? String(record.buildingId) : ""
    )
    data.putString(
        base + "_targetId",
        record.targetId != null ? String(record.targetId) : ""
    )
    data.putString(
        base + "_layerId",
        record.layerId != null ? String(record.layerId) : ""
    )

    data.putInt(
        base + "_x",
        modfusionControllerReadInteger(record.x) != null
            ? modfusionControllerReadInteger(record.x)
            : 0
    )
    data.putInt(
        base + "_y",
        modfusionControllerReadInteger(record.y) != null
            ? modfusionControllerReadInteger(record.y)
            : 0
    )
    data.putInt(
        base + "_z",
        modfusionControllerReadInteger(record.z) != null
            ? modfusionControllerReadInteger(record.z)
            : 0
    )
    data.putInt(
        base + "_attempt",
        modfusionControllerReadInteger(record.attempt) != null
            ? modfusionControllerReadInteger(record.attempt)
            : -1
    )
    data.putInt(base + "_updatedTick", MODFUSION_CONTROLLER_TICK)
    data.putBoolean(base + "_exactY", record.exactY === true)

    return true
}


/*
 * =========================================================
 * Queue management
 * =========================================================
 */

function getModfusionControllerCellQueueKey(cell)
{
    return cell != null ? String(cell.x) + ":" + String(cell.z) : null
}


function isModfusionControllerReservedCell(cell)
{
    var key = getModfusionControllerCellQueueKey(cell)

    return (
        key != null &&
        MODFUSION_CONTROLLER_CONFIG.reservedCells[key] === true
    )
}


function enqueueModfusionControllerCell(level, cellX, cellZ, source)
{
    if(MODFUSION_CONTROLLER_CONFIG.enabled !== true)
    {
        return {
            queued: false,
            reason: "CONTROLLER_DISABLED"
        }
    }

    if(
        global.ModfusionBuildingDistributor == null ||
        typeof global.ModfusionBuildingDistributor.getCell !== "function"
    )
    {
        return {
            queued: false,
            reason: "DISTRIBUTOR_NOT_LOADED"
        }
    }

    var cell = global.ModfusionBuildingDistributor.getCell(cellX, cellZ)

    if(cell == null)
    {
        return {
            queued: false,
            reason: "INVALID_CELL"
        }
    }

    var key = getModfusionControllerCellQueueKey(cell)

    if(isModfusionControllerReservedCell(cell))
    {
        var reservedState = getModfusionControllerCellState(
            level,
            cell.x,
            cell.z
        )

        if(reservedState.status !== "RESERVED")
        {
            writeModfusionControllerCellState(level, cell, {
                status: "RESERVED",
                reason: "SPAWN_CELL"
            })
        }

        return {
            queued: false,
            reason: "RESERVED",
            cell: cell
        }
    }

    var state = getModfusionControllerCellState(level, cell.x, cell.z)

    if(isModfusionControllerTerminalState(state.status))
    {
        return {
            queued: false,
            reason: state.status,
            cell: cell,
            state: state
        }
    }

    if(modfusionControllerHasOwn(MODFUSION_CONTROLLER_SESSION_BLOCKED, key))
    {
        return {
            queued: false,
            reason: MODFUSION_CONTROLLER_SESSION_BLOCKED[key],
            cell: cell
        }
    }

    if(modfusionControllerHasOwn(MODFUSION_CONTROLLER_QUEUED_CELLS, key))
    {
        return {
            queued: false,
            reason: "ALREADY_QUEUED",
            cell: cell
        }
    }

    if(
        MODFUSION_CONTROLLER_QUEUE.length >=
        MODFUSION_CONTROLLER_CONFIG.maxQueueSize
    )
    {
        return {
            queued: false,
            reason: "QUEUE_FULL",
            cell: cell
        }
    }

    var job = {
        key: key,
        cell: cell,
        source: source != null ? String(source) : "UNKNOWN",
        phase: "PLAN",
        plan: null,
        candidates: [],
        candidateIndex: 0,
        resolved: null,
        preloadChunks: [],
        preloadIndex: 0,
        analysisFailures: []
    }

    MODFUSION_CONTROLLER_QUEUE.push(job)
    MODFUSION_CONTROLLER_QUEUED_CELLS[key] = true

    console.log(
        "[ModFusion Controller] Queued cell " + key +
        " from " + job.source
    )

    return {
        queued: true,
        reason: null,
        cell: cell
    }
}


function enqueueModfusionControllerAtBlock(level, x, z, source)
{
    if(
        global.ModfusionBuildingDistributor == null ||
        typeof global.ModfusionBuildingDistributor.getCellAtBlock !== "function"
    )
    {
        return {
            queued: false,
            reason: "DISTRIBUTOR_NOT_LOADED"
        }
    }

    var cell = global.ModfusionBuildingDistributor.getCellAtBlock(x, z)

    if(cell == null)
    {
        return {
            queued: false,
            reason: "INVALID_COORDINATES"
        }
    }

    return enqueueModfusionControllerCell(
        level,
        cell.x,
        cell.z,
        source
    )
}


function finishModfusionControllerActiveJob()
{
    if(MODFUSION_CONTROLLER_ACTIVE_JOB != null)
    {
        delete MODFUSION_CONTROLLER_QUEUED_CELLS[
            MODFUSION_CONTROLLER_ACTIVE_JOB.key
        ]
    }

    MODFUSION_CONTROLLER_ACTIVE_JOB = null
}


function getModfusionControllerQueueStatus()
{
    return {
        queued: MODFUSION_CONTROLLER_QUEUE.length,
        active: MODFUSION_CONTROLLER_ACTIVE_JOB != null
            ? {
                cell: {
                    x: MODFUSION_CONTROLLER_ACTIVE_JOB.cell.x,
                    z: MODFUSION_CONTROLLER_ACTIVE_JOB.cell.z
                },
                phase: MODFUSION_CONTROLLER_ACTIVE_JOB.phase,
                candidateIndex:
                    MODFUSION_CONTROLLER_ACTIVE_JOB.candidateIndex,
                preloadIndex:
                    MODFUSION_CONTROLLER_ACTIVE_JOB.preloadIndex,
                preloadTotal:
                    MODFUSION_CONTROLLER_ACTIVE_JOB.preloadChunks.length
            }
            : null
    }
}


/*
 * =========================================================
 * Gradual worker
 * =========================================================
 */

function resolveModfusionControllerPreloadRadius(building)
{
    var defaultRadius =
        MODFUSION_CONTROLLER_CONFIG.placementPreloadRadiusChunks

    if(
        building == null ||
        building.placement == null ||
        building.placement.options == null
    )
    {
        return defaultRadius
    }

    var configured = modfusionControllerReadInteger(
        building.placement.options.preloadRadiusChunks
    )

    if(configured == null)
    {
        return defaultRadius
    }

    if(configured < 0)
    {
        return 0
    }

    if(configured > 8)
    {
        return 8
    }

    return configured
}


function createModfusionControllerPreloadChunks(centerChunkX, centerChunkZ, radius)
{
    var result = []
    var ring

    for(ring = 0; ring <= radius; ring++)
    {
        var dx
        var dz

        for(dx = -ring; dx <= ring; dx++)
        {
            for(dz = -ring; dz <= ring; dz++)
            {
                if(Math.max(Math.abs(dx), Math.abs(dz)) !== ring)
                {
                    continue
                }

                result.push({
                    x: centerChunkX + dx,
                    z: centerChunkZ + dz
                })
            }
        }
    }

    return result
}


function blockModfusionControllerSessionCell(job, reason)
{
    MODFUSION_CONTROLLER_SESSION_BLOCKED[job.key] = String(reason)

    console.log(
        "[ModFusion Controller] Session-blocked cell " + job.key +
        ": " + reason
    )

    finishModfusionControllerActiveJob()
}


function failModfusionControllerCell(level, job, status, reason)
{
    var plan = job.plan
    var candidate = job.resolved != null ? job.resolved.candidate : null
    var analysis = job.resolved != null ? job.resolved.analysis : null
    var center = analysis != null ? analysis.center : null

    writeModfusionControllerCellState(level, job.cell, {
        status: status,
        reason: reason,
        buildingId: plan != null ? plan.buildingId : null,
        targetId: (
            plan != null &&
            plan.building != null &&
            plan.building.placement != null
        ) ? plan.building.placement.targetId : null,
        layerId: plan != null ? plan.layerId : null,
        x: center != null ? center.x : null,
        y: center != null ? center.y : null,
        z: center != null ? center.z : null,
        attempt: candidate != null ? candidate.attempt : -1,
        exactY: false
    })

    console.log(
        "[ModFusion Controller] Cell " + job.key +
        " -> " + status + " / " + reason
    )

    finishModfusionControllerActiveJob()
}


function processModfusionControllerPlan(level, job)
{
    if(
        global.ModfusionBuildingDistributor == null ||
        global.ModfusionBuildingGeneration == null ||
        global.ModfusionBuildingRegistry == null ||
        global.ModfusionBuildingAnalyzer == null
    )
    {
        blockModfusionControllerSessionCell(job, "DEPENDENCY_NOT_LOADED")
        return
    }

    var state = getModfusionControllerCellState(
        level,
        job.cell.x,
        job.cell.z
    )

    if(isModfusionControllerTerminalState(state.status))
    {
        finishModfusionControllerActiveJob()
        return
    }

    var plan = global.ModfusionBuildingDistributor.createPlan(
        level,
        job.cell.x,
        job.cell.z
    )

    if(plan == null || plan.status !== "OK")
    {
        blockModfusionControllerSessionCell(
            job,
            plan != null ? plan.reason : "NULL_PLAN"
        )
        return
    }

    var adapter = global.ModfusionBuildingGeneration.getAdapter(
        plan.building.placement.adapterId
    )

    if(adapter == null)
    {
        blockModfusionControllerSessionCell(job, "UNKNOWN_ADAPTER")
        return
    }

    if(
        adapter.exactY !== true &&
        MODFUSION_CONTROLLER_CONFIG.allowInexactYAdapters !== true
    )
    {
        blockModfusionControllerSessionCell(
            job,
            "INEXACT_Y_ADAPTER_BLOCKED"
        )
        return
    }

    var candidates = global.ModfusionBuildingDistributor.getCandidates(plan)

    if(!Array.isArray(candidates) || candidates.length <= 0)
    {
        failModfusionControllerCell(
            level,
            job,
            "NO_VALID_SITE",
            "NO_CANDIDATES"
        )
        return
    }

    job.plan = plan
    job.candidates = candidates
    job.candidateIndex = 0
    job.phase = "ANALYZE"
}


function processModfusionControllerAnalyze(level, job)
{
    if(job.candidateIndex >= job.candidates.length)
    {
        failModfusionControllerCell(
            level,
            job,
            "NO_VALID_SITE",
            "NO_VALID_SITE"
        )
        return
    }

    var candidate = job.candidates[job.candidateIndex]

    try
    {
        /* Only the center chunk is explicitly loaded for analysis. */
        level.getChunk(candidate.chunkX, candidate.chunkZ)
    }
    catch(error)
    {
        job.analysisFailures.push({
            attempt: candidate.attempt,
            reason: "CANDIDATE_CHUNK_LOAD_FAILED"
        })

        job.candidateIndex++
        return
    }

    var analysis = global.ModfusionBuildingAnalyzer.analyzeInLayer(
        level,
        job.plan.buildingId,
        candidate.x,
        candidate.z,
        job.plan.layerId,
        false
    )

    if(analysis == null || analysis.pass !== true)
    {
        job.analysisFailures.push({
            attempt: candidate.attempt,
            reason: analysis != null ? analysis.reason : "NULL_ANALYSIS"
        })

        job.candidateIndex++
        return
    }

    job.resolved = {
        schemaVersion: job.plan.schemaVersion,
        status: "OK",
        ready: true,
        reason: null,
        seedKey: job.plan.seedKey,
        cellKey: job.plan.cellKey,
        cell: job.plan.cell,
        layerId: job.plan.layerId,
        buildingId: job.plan.buildingId,
        building: job.plan.building,
        candidate: candidate,
        analysis: analysis,
        attempts: job.analysisFailures.slice(0)
    }

    var radius = resolveModfusionControllerPreloadRadius(
        job.plan.building
    )

    job.preloadChunks = createModfusionControllerPreloadChunks(
        candidate.chunkX,
        candidate.chunkZ,
        radius
    )
    job.preloadIndex = 0
    job.phase = "PRELOAD"
}


function processModfusionControllerPreload(level, job)
{
    var loaded = 0

    while(
        loaded < MODFUSION_CONTROLLER_CONFIG.chunksPerWorkerStep &&
        job.preloadIndex < job.preloadChunks.length
    )
    {
        var chunk = job.preloadChunks[job.preloadIndex]

        try
        {
            level.getChunk(chunk.x, chunk.z)
        }
        catch(error)
        {
            failModfusionControllerCell(
                level,
                job,
                "PLACE_FAILED",
                "PLACEMENT_CHUNK_LOAD_FAILED"
            )
            return
        }

        job.preloadIndex++
        loaded++
    }

    if(job.preloadIndex >= job.preloadChunks.length)
    {
        job.phase = "PLACE"
    }
}


function processModfusionControllerPlace(level, job)
{
    var state = getModfusionControllerCellState(
        level,
        job.cell.x,
        job.cell.z
    )

    if(isModfusionControllerTerminalState(state.status))
    {
        finishModfusionControllerActiveJob()
        return
    }

    var generation = global.ModfusionBuildingGeneration.placeResolved(
        level,
        job.resolved,
        {}
    )

    if(generation == null || generation.generated !== true)
    {
        failModfusionControllerCell(
            level,
            job,
            "PLACE_FAILED",
            generation != null ? generation.reason : "NULL_GENERATION_RESULT"
        )
        return
    }

    var center = job.resolved.analysis.center

    var stateWritten = writeModfusionControllerCellState(
        level,
        job.cell,
        {
            status: "GENERATED",
            reason: "",
            buildingId: generation.buildingId,
            targetId: generation.targetId,
            layerId: job.resolved.layerId,
            x: center.x,
            y: center.y,
            z: center.z,
            attempt: job.resolved.candidate.attempt,
            exactY: generation.exactY === true
        }
    )

    if(!stateWritten)
    {
        console.log(
            "[ModFusion Controller] CRITICAL: Structure generated but " +
            "state write failed for cell " + job.key
        )

        blockModfusionControllerSessionCell(
            job,
            "GENERATED_STATE_WRITE_FAILED"
        )
        return
    }

    console.log(
        "[ModFusion Controller] GENERATED cell " + job.key +
        " -> " + generation.buildingId +
        " at " + center.x + " " + center.y + " " + center.z
    )

    finishModfusionControllerActiveJob()
}


function processModfusionControllerWorker(server)
{
    if(MODFUSION_CONTROLLER_CONFIG.enabled !== true || server == null)
    {
        return
    }

    var level

    try
    {
        level = server.getLevel(MODFUSION_CONTROLLER_DIMENSION_ID)
    }
    catch(error)
    {
        return
    }

    if(level == null)
    {
        return
    }

    if(MODFUSION_CONTROLLER_ACTIVE_JOB == null)
    {
        if(MODFUSION_CONTROLLER_QUEUE.length <= 0)
        {
            return
        }

        MODFUSION_CONTROLLER_ACTIVE_JOB = MODFUSION_CONTROLLER_QUEUE.shift()
    }

    var job = MODFUSION_CONTROLLER_ACTIVE_JOB

    if(job.phase === "PLAN")
    {
        processModfusionControllerPlan(level, job)
        return
    }

    if(job.phase === "ANALYZE")
    {
        processModfusionControllerAnalyze(level, job)
        return
    }

    if(job.phase === "PRELOAD")
    {
        processModfusionControllerPreload(level, job)
        return
    }

    if(job.phase === "PLACE")
    {
        processModfusionControllerPlace(level, job)
        return
    }

    blockModfusionControllerSessionCell(job, "UNKNOWN_JOB_PHASE")
}


/*
 * =========================================================
 * Player discovery
 * =========================================================
 */

function scanModfusionControllerPlayer(player, level)
{
    if(
        player == null ||
        level == null ||
        modfusionControllerIsClientLevel(level) ||
        modfusionControllerGetDimensionId(level) !==
            MODFUSION_CONTROLLER_DIMENSION_ID
    )
    {
        return
    }

    if(
        global.ModfusionBuildingDistributor == null ||
        typeof global.ModfusionBuildingDistributor.getCellAtBlock !== "function"
    )
    {
        return
    }

    var cell = global.ModfusionBuildingDistributor.getCellAtBlock(
        Math.floor(player.x),
        Math.floor(player.z)
    )

    if(cell == null)
    {
        return
    }

    var playerKey = modfusionControllerGetPlayerKey(player)

    if(playerKey == null)
    {
        return
    }

    var cellKey = getModfusionControllerCellQueueKey(cell)

    if(MODFUSION_CONTROLLER_PLAYER_CELLS[playerKey] === cellKey)
    {
        return
    }

    MODFUSION_CONTROLLER_PLAYER_CELLS[playerKey] = cellKey

    enqueueModfusionControllerCell(
        level,
        cell.x,
        cell.z,
        "PLAYER_CELL_CHANGE"
    )
}


/*
 * =========================================================
 * Reset and inspection helpers
 * =========================================================
 */

function resetModfusionControllerCell(level, cellX, cellZ)
{
    var cell = global.ModfusionBuildingDistributor != null
        ? global.ModfusionBuildingDistributor.getCell(cellX, cellZ)
        : null

    if(level == null || cell == null)
    {
        return false
    }

    var key = getModfusionControllerCellQueueKey(cell)

    clearModfusionControllerCellState(level, cell.x, cell.z)
    delete MODFUSION_CONTROLLER_SESSION_BLOCKED[key]

    var filtered = []
    var i

    for(i = 0; i < MODFUSION_CONTROLLER_QUEUE.length; i++)
    {
        if(MODFUSION_CONTROLLER_QUEUE[i].key !== key)
        {
            filtered.push(MODFUSION_CONTROLLER_QUEUE[i])
        }
    }

    MODFUSION_CONTROLLER_QUEUE = filtered
    delete MODFUSION_CONTROLLER_QUEUED_CELLS[key]

    if(
        MODFUSION_CONTROLLER_ACTIVE_JOB != null &&
        MODFUSION_CONTROLLER_ACTIVE_JOB.key === key
    )
    {
        MODFUSION_CONTROLLER_ACTIVE_JOB = null
    }

    return true
}


/*
 * =========================================================
 * Public API
 * =========================================================
 */

validateModfusionControllerConfig()


global.ModfusionBuildingController = {
    schemaVersion: MODFUSION_CONTROLLER_SCHEMA_VERSION,

    getConfig: getModfusionControllerConfig,
    getState: getModfusionControllerCellState,
    getQueueStatus: getModfusionControllerQueueStatus,

    enqueueCell: enqueueModfusionControllerCell,
    enqueueAtBlock: enqueueModfusionControllerAtBlock,
    resetCell: resetModfusionControllerCell
}


/*
 * Small player-side discovery gate. No terrain scan runs here.
 */

PlayerEvents.tick(function(event)
{
    if(MODFUSION_CONTROLLER_CONFIG.enabled !== true)
    {
        return
    }

    if(
        MODFUSION_CONTROLLER_TICK %
        MODFUSION_CONTROLLER_CONFIG.playerScanIntervalTicks !== 0
    )
    {
        return
    }

    scanModfusionControllerPlayer(event.player, event.level)
})


/*
 * One bounded queue step. When the queue is empty this performs no world
 * access and returns immediately.
 */

ServerEvents.tick(function(event)
{
    MODFUSION_CONTROLLER_TICK++

    if(
        MODFUSION_CONTROLLER_TICK %
        MODFUSION_CONTROLLER_CONFIG.workerIntervalTicks !== 0
    )
    {
        return
    }

    processModfusionControllerWorker(event.server)
})


/*
 * Read-only status for the player's current distribution cell:
 *
 *   /kubejs custom_command modfusion_building_status
 */

ServerEvents.customCommand(
    "modfusion_building_status",
    function(event)
    {
        var player = event.player

        if(player == null)
        {
            return
        }

        var level = player.level

        if(
            modfusionControllerGetDimensionId(level) !==
            MODFUSION_CONTROLLER_DIMENSION_ID
        )
        {
            modfusionControllerTell(player, "Wrong dimension")
            return
        }

        var cell = global.ModfusionBuildingDistributor.getCellAtBlock(
            Math.floor(player.x),
            Math.floor(player.z)
        )

        var state = getModfusionControllerCellState(
            level,
            cell.x,
            cell.z
        )

        var key = getModfusionControllerCellQueueKey(cell)
        var queue = getModfusionControllerQueueStatus()

        modfusionControllerTell(
            player,
            "Cell " + key + " / state " + state.status +
            (state.reason.length > 0 ? " / " + state.reason : "")
        )

        if(state.buildingId.length > 0)
        {
            modfusionControllerTell(
                player,
                "Building " + state.buildingId +
                " / layer " + state.layerId +
                " / position " + state.x + " " + state.y + " " + state.z
            )
        }

        if(modfusionControllerHasOwn(MODFUSION_CONTROLLER_SESSION_BLOCKED, key))
        {
            modfusionControllerTell(
                player,
                "Session blocked: " +
                MODFUSION_CONTROLLER_SESSION_BLOCKED[key]
            )
        }

        modfusionControllerTell(
            player,
            "Queue " + queue.queued +
            " / active " +
            (queue.active != null
                ? queue.active.cell.x + ":" + queue.active.cell.z +
                    " " + queue.active.phase
                : "none")
        )
    }
)


/*
 * Manually enqueue the current cell without changing persistent state:
 *
 *   /kubejs custom_command modfusion_building_enqueue
 */

ServerEvents.customCommand(
    "modfusion_building_enqueue",
    function(event)
    {
        var player = event.player

        if(player == null)
        {
            return
        }

        var result = enqueueModfusionControllerAtBlock(
            player.level,
            Math.floor(player.x),
            Math.floor(player.z),
            "MANUAL_COMMAND"
        )

        modfusionControllerTell(
            player,
            result.queued
                ? "Current cell queued"
                : "Not queued: " + result.reason
        )
    }
)


/*
 * Remove Controller state for the current cell. This does not remove an
 * existing structure; enqueueing afterward may create a duplicate.
 *
 *   /kubejs custom_command modfusion_building_reset_cell
 */

ServerEvents.customCommand(
    "modfusion_building_reset_cell",
    function(event)
    {
        var player = event.player

        if(player == null)
        {
            return
        }

        var cell = global.ModfusionBuildingDistributor.getCellAtBlock(
            Math.floor(player.x),
            Math.floor(player.z)
        )

        var reset = resetModfusionControllerCell(
            player.level,
            cell.x,
            cell.z
        )

        modfusionControllerTell(
            player,
            reset
                ? "Current cell state reset. Existing blocks were not removed."
                : "Current cell reset failed"
        )
    }
)


console.log(
    "[ModFusion Controller] Controller v3 ready. " +
    "Enabled=" + MODFUSION_CONTROLLER_CONFIG.enabled +
    ", allowInexactY=" +
    MODFUSION_CONTROLLER_CONFIG.allowInexactYAdapters
)