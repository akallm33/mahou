console.log("[ModFusion Building Controller] Controller v2 loading")


/*
 * =========================================================
 * ModFusion Building Controller v1
 * =========================================================
 *
 * Connects the pure Registry/Planner modules to the Generation adapter.
 *
 * Safety rules:
 *   - only the cell occupied by a player is considered;
 *   - no terrain scan and no getChunk() call is performed;
 *   - the complete planned footprint must already be loaded;
 *   - a persistent PLACING state is written before structure blocks run;
 *   - terminal states prevent duplicate placement after a restart;
 *   - failed or interrupted cells require an explicit administrator retry.
 */


var MODFUSION_BUILDING_CONTROLLER_SCHEMA_VERSION = 1
var MODFUSION_BUILDING_CONTROLLER_DIMENSION_ID =
    "mahou:modfusion_dimension"

var MODFUSION_BUILDING_CONTROLLER_STATE_PREFIX =
    "mahouModfusionBuildingControllerV1"

var MODFUSION_BUILDING_CONTROLLER_CONFIG = {
    enabled: true,

    playerScanIntervalTicks: 40,
    workerIntervalTicks: 1,
    maxQueueSize: 64,

    planningWarningMillis: 100,
    maximumPlanningMillis: 2000,

    maximumFootprintRadiusChunks: 32
}


var MODFUSION_CONTROLLER_ResourceLocation = Java.loadClass(
    "net.minecraft.resources.ResourceLocation"
)

var MODFUSION_CONTROLLER_MDF_SEED_HOLDER_CLASS_NAME =
    "com.klinbee.moredensityfunctions.randomsamplers." +
    "RandomSampler$WorldSeedHolder"


var MODFUSION_BUILDING_CONTROLLER_QUEUE = []
var MODFUSION_BUILDING_CONTROLLER_QUEUED = Object.create(null)
var MODFUSION_BUILDING_CONTROLLER_ACTIVE = null
var MODFUSION_BUILDING_CONTROLLER_TICK = 0
var MODFUSION_BUILDING_CONTROLLER_EXACT_SEED_TEXT = null


var MODFUSION_BUILDING_CONTROLLER_TERMINAL_STATES = {
    RESERVED: true,
    SKIPPED: true,
    GENERATED: true,
    PLACING: true,
    FAILED: true
}


var MODFUSION_BUILDING_CONTROLLER_STATE_FIELDS = [
    "status",
    "reason",
    "buildingId",
    "targetId",
    "layerId",
    "x",
    "y",
    "z",
    "exactY",
    "updatedTick"
]


/*
 * =========================================================
 * General helpers
 * =========================================================
 */


function modfusionControllerHasOwn(object, key)
{
    return Object.prototype.hasOwnProperty.call(object, key)
}


function modfusionControllerReadInteger(value)
{
    var number = Number(value)

    if(!isFinite(number) || Math.floor(number) !== number)
    {
        return null
    }

    return number
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
        return level.isClientSide() === true
    }
    catch(error1)
    {
        try
        {
            return level.isClientSide === true
        }
        catch(error2)
        {
            return true
        }
    }
}


function modfusionControllerGetLevel(server)
{
    if(server == null)
    {
        return null
    }

    var location = MODFUSION_CONTROLLER_ResourceLocation.tryParse(
        MODFUSION_BUILDING_CONTROLLER_DIMENSION_ID
    )

    if(location == null)
    {
        return null
    }

    try
    {
        return server.getLevel(location)
    }
    catch(error)
    {
        return null
    }
}


function modfusionControllerGetSeedText(level)
{
    if(level == null)
    {
        return null
    }

    /*
     * Do not call String(level.getSeed()) here.  Rhino first converts the
     * Java long to an IEEE-754 number and silently loses its low bits.  The
     * middle-island density function hashes More Density Functions' original
     * 64-bit seed, so even a one-bit difference moves the island centre.
     *
     * Read the exact same Java long used by that density function through a
     * reflected boxed Long and convert the Long itself to decimal text.  The
     * planner then parses the text into its four 16-bit limbs without ever
     * passing through a JavaScript number.
     */
    if(MODFUSION_BUILDING_CONTROLLER_EXACT_SEED_TEXT != null)
    {
        return MODFUSION_BUILDING_CONTROLLER_EXACT_SEED_TEXT
    }

    try
    {
        var classLoader = level.getClass().getClassLoader()
        var holderClass = classLoader.loadClass(
            MODFUSION_CONTROLLER_MDF_SEED_HOLDER_CLASS_NAME
        )

        var seedField = holderClass.getDeclaredField("worldSeed")
        seedField.setAccessible(true)

        var boxedSeed = seedField.get(null)
        var seedText = String(boxedSeed.toString())

        if(!/^-?[0-9]{1,20}$/.test(seedText))
        {
            throw new Error("invalid exact seed text: " + seedText)
        }

        MODFUSION_BUILDING_CONTROLLER_EXACT_SEED_TEXT = seedText

        console.log(
            "[ModFusion Building Controller] Exact 64-bit terrain seed " +
            seedText
        )

        return seedText
    }
    catch(error)
    {
        console.error(
            "[ModFusion Building Controller] Exact world seed is " +
            "unavailable; refusing to plan with a rounded JS number. " +
            error
        )

        return null
    }
}


function modfusionControllerTell(player, message)
{
    if(player != null)
    {
        player.tell(Component.of(String(message)))
    }
}


function getModfusionControllerConfig()
{
    return JSON.parse(JSON.stringify(
        MODFUSION_BUILDING_CONTROLLER_CONFIG
    ))
}


function validateModfusionControllerConfig()
{
    var fields = [
        ["playerScanIntervalTicks", 1, 1200],
        ["workerIntervalTicks", 1, 1200],
        ["maxQueueSize", 1, 4096],
        ["planningWarningMillis", 1, 60000],
        ["maximumPlanningMillis", 1, 60000],
        ["maximumFootprintRadiusChunks", 0, 32]
    ]

    var i

    for(i = 0; i < fields.length; i++)
    {
        var key = fields[i][0]
        var minimum = fields[i][1]
        var maximum = fields[i][2]
        var value = MODFUSION_BUILDING_CONTROLLER_CONFIG[key]

        if(
            typeof value !== "number" ||
            Math.floor(value) !== value ||
            value < minimum ||
            value > maximum
        )
        {
            throw new Error(
                "[ModFusion Building Controller] " + key +
                " must be an integer from " + minimum +
                " to " + maximum
            )
        }
    }

    if(
        MODFUSION_BUILDING_CONTROLLER_CONFIG.planningWarningMillis >
        MODFUSION_BUILDING_CONTROLLER_CONFIG.maximumPlanningMillis
    )
    {
        throw new Error(
            "[ModFusion Building Controller] planningWarningMillis " +
            "cannot exceed maximumPlanningMillis"
        )
    }
}


/*
 * =========================================================
 * Persistent per-cell state
 * =========================================================
 */


function modfusionControllerEncodeCoordinate(value)
{
    var number = modfusionControllerReadInteger(value)

    if(number == null)
    {
        return null
    }

    return number < 0 ? "n" + Math.abs(number) : "p" + number
}


function modfusionControllerGetStateBase(cellX, cellZ)
{
    var x = modfusionControllerEncodeCoordinate(cellX)
    var z = modfusionControllerEncodeCoordinate(cellZ)

    if(x == null || z == null)
    {
        return null
    }

    return MODFUSION_BUILDING_CONTROLLER_STATE_PREFIX +
        "_" + x + "_" + z
}


function modfusionControllerGetData(level)
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


function getModfusionControllerState(level, cellX, cellZ)
{
    var data = modfusionControllerGetData(level)
    var base = modfusionControllerGetStateBase(cellX, cellZ)

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

        exactY: data.getBoolean(base + "_exactY"),
        updatedTick: data.getInt(base + "_updatedTick"),

        cellX: modfusionControllerReadInteger(cellX),
        cellZ: modfusionControllerReadInteger(cellZ)
    }
}


function modfusionControllerClearState(level, cellX, cellZ)
{
    var data = modfusionControllerGetData(level)
    var base = modfusionControllerGetStateBase(cellX, cellZ)

    if(data == null || base == null)
    {
        return false
    }

    try
    {
        var i

        for(
            i = 0;
            i < MODFUSION_BUILDING_CONTROLLER_STATE_FIELDS.length;
            i++
        )
        {
            data.remove(
                base + "_" +
                MODFUSION_BUILDING_CONTROLLER_STATE_FIELDS[i]
            )
        }

        return true
    }
    catch(error)
    {
        console.error(
            "[ModFusion Building Controller] Failed to clear state " +
            cellX + ":" + cellZ + " - " + error
        )

        return false
    }
}


function modfusionControllerWriteState(level, cell, record)
{
    var data = modfusionControllerGetData(level)
    var base = cell != null
        ? modfusionControllerGetStateBase(cell.x, cell.z)
        : null

    if(data == null || base == null || record == null)
    {
        return false
    }

    try
    {
        modfusionControllerClearState(level, cell.x, cell.z)

        data.putString(base + "_status", String(record.status || ""))
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

        data.putBoolean(base + "_exactY", record.exactY === true)
        data.putInt(
            base + "_updatedTick",
            MODFUSION_BUILDING_CONTROLLER_TICK
        )

        return true
    }
    catch(error)
    {
        console.error(
            "[ModFusion Building Controller] Failed to write state " +
            cell.x + ":" + cell.z + " - " + error
        )

        return false
    }
}


function modfusionControllerIsTerminalState(status)
{
    return MODFUSION_BUILDING_CONTROLLER_TERMINAL_STATES[
        String(status || "")
    ] === true
}


/*
 * =========================================================
 * Queue
 * =========================================================
 */


function modfusionControllerCellKey(cell)
{
    return cell != null
        ? String(cell.x) + ":" + String(cell.z)
        : null
}


function enqueueModfusionControllerCell(level, cellX, cellZ, source)
{
    if(MODFUSION_BUILDING_CONTROLLER_CONFIG.enabled !== true)
    {
        return { queued: false, reason: "CONTROLLER_DISABLED" }
    }

    if(
        level == null ||
        modfusionControllerIsClientLevel(level) ||
        modfusionControllerGetDimensionId(level) !==
            MODFUSION_BUILDING_CONTROLLER_DIMENSION_ID
    )
    {
        return { queued: false, reason: "WRONG_DIMENSION" }
    }

    if(
        global.ModfusionBuildingPlanner == null ||
        typeof global.ModfusionBuildingPlanner.getCell !== "function"
    )
    {
        return { queued: false, reason: "PLANNER_NOT_LOADED" }
    }

    var cell

    try
    {
        cell = global.ModfusionBuildingPlanner.getCell(cellX, cellZ)
    }
    catch(error)
    {
        return {
            queued: false,
            reason: "INVALID_CELL",
            detail: String(error)
        }
    }

    var key = modfusionControllerCellKey(cell)
    var state = getModfusionControllerState(level, cell.x, cell.z)

    /*
     * Migrate failures written by the former 100 ms planner limit before the
     * terminal-state gate.  No placement was attempted for this reason, so
     * clearing only this exact legacy record cannot duplicate a structure.
     */
    if(
        state.status === "FAILED" &&
        state.reason === "PLANNER_TIME_BUDGET_EXCEEDED"
    )
    {
        if(!modfusionControllerClearState(level, cell.x, cell.z))
        {
            return {
                queued: false,
                reason: "LEGACY_TIMEOUT_STATE_CLEAR_FAILED",
                cell: cell,
                state: state
            }
        }

        console.log(
            "[ModFusion Building Controller] Reopened legacy " +
            "planner-timeout cell " + key
        )

        state = getModfusionControllerState(level, cell.x, cell.z)
    }

    /*
     * Version 1 used /place structure and wrote PLACE_COMMAND_FAILED when
     * Twilight's real randomized bounds extended beyond the estimated loaded
     * footprint. Version 2 no longer emits that reason, so every record with
     * this exact legacy reason is safe to reopen once for direct placement.
     * The vanilla command checked all chunks before writing any blocks.
     */
    if(
        state.status === "FAILED" &&
        state.reason === "PLACE_COMMAND_FAILED"
    )
    {
        if(!modfusionControllerClearState(level, cell.x, cell.z))
        {
            return {
                queued: false,
                reason: "LEGACY_COMMAND_STATE_CLEAR_FAILED",
                cell: cell,
                state: state
            }
        }

        console.log(
            "[ModFusion Building Controller] Reopened legacy " +
            "command-placement failure cell " + key
        )

        state = getModfusionControllerState(level, cell.x, cell.z)
    }

    /*
     * Adapter v2 initially exposed Java 17's package-private immutable piece
     * list directly to Rhino. The corrected adapter copies that list into a
     * public ArrayList and uses a new failure reason for any future runtime
     * exception, so this exact old record can be reopened once without a
     * retry loop.
     */
    if(
        state.status === "FAILED" &&
        state.reason === "STRUCTURE_PREPARATION_EXCEPTION"
    )
    {
        if(!modfusionControllerClearState(level, cell.x, cell.z))
        {
            return {
                queued: false,
                reason: "LEGACY_PREPARATION_STATE_CLEAR_FAILED",
                cell: cell,
                state: state
            }
        }

        console.log(
            "[ModFusion Building Controller] Reopened legacy " +
            "immutable-piece-list failure cell " + key
        )

        state = getModfusionControllerState(level, cell.x, cell.z)
    }

    if(modfusionControllerIsTerminalState(state.status))
    {
        return {
            queued: false,
            reason: state.status,
            cell: cell,
            state: state
        }
    }

    if(modfusionControllerHasOwn(
        MODFUSION_BUILDING_CONTROLLER_QUEUED,
        key
    ))
    {
        return {
            queued: false,
            reason: "ALREADY_QUEUED",
            cell: cell
        }
    }

    if(
        MODFUSION_BUILDING_CONTROLLER_QUEUE.length >=
        MODFUSION_BUILDING_CONTROLLER_CONFIG.maxQueueSize
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
        source: String(source || "UNKNOWN")
    }

    MODFUSION_BUILDING_CONTROLLER_QUEUE.push(job)
    MODFUSION_BUILDING_CONTROLLER_QUEUED[key] = true

    return {
        queued: true,
        reason: null,
        cell: cell
    }
}


function enqueueModfusionControllerAtBlock(level, blockX, blockZ, source)
{
    if(
        global.ModfusionBuildingPlanner == null ||
        typeof global.ModfusionBuildingPlanner.getCellAtBlock !== "function"
    )
    {
        return { queued: false, reason: "PLANNER_NOT_LOADED" }
    }

    var cell

    try
    {
        cell = global.ModfusionBuildingPlanner.getCellAtBlock(
            blockX,
            blockZ
        )
    }
    catch(error)
    {
        return {
            queued: false,
            reason: "INVALID_COORDINATES",
            detail: String(error)
        }
    }

    return enqueueModfusionControllerCell(
        level,
        cell.x,
        cell.z,
        source
    )
}


function modfusionControllerFinishActiveJob()
{
    if(MODFUSION_BUILDING_CONTROLLER_ACTIVE != null)
    {
        delete MODFUSION_BUILDING_CONTROLLER_QUEUED[
            MODFUSION_BUILDING_CONTROLLER_ACTIVE.key
        ]
    }

    MODFUSION_BUILDING_CONTROLLER_ACTIVE = null
}


function getModfusionControllerQueueStatus()
{
    return {
        queued: MODFUSION_BUILDING_CONTROLLER_QUEUE.length,
        active: MODFUSION_BUILDING_CONTROLLER_ACTIVE != null
            ? {
                key: MODFUSION_BUILDING_CONTROLLER_ACTIVE.key,
                source: MODFUSION_BUILDING_CONTROLLER_ACTIVE.source
            }
            : null
    }
}


function modfusionControllerRemoveQueuedCell(key)
{
    var filtered = []
    var i

    for(i = 0; i < MODFUSION_BUILDING_CONTROLLER_QUEUE.length; i++)
    {
        if(MODFUSION_BUILDING_CONTROLLER_QUEUE[i].key !== key)
        {
            filtered.push(MODFUSION_BUILDING_CONTROLLER_QUEUE[i])
        }
    }

    MODFUSION_BUILDING_CONTROLLER_QUEUE = filtered
    delete MODFUSION_BUILDING_CONTROLLER_QUEUED[key]

    if(
        MODFUSION_BUILDING_CONTROLLER_ACTIVE != null &&
        MODFUSION_BUILDING_CONTROLLER_ACTIVE.key === key
    )
    {
        MODFUSION_BUILDING_CONTROLLER_ACTIVE = null
    }
}


function retryModfusionControllerCell(level, cellX, cellZ, source)
{
    if(
        global.ModfusionBuildingPlanner == null ||
        typeof global.ModfusionBuildingPlanner.getCell !== "function"
    )
    {
        return { queued: false, reason: "PLANNER_NOT_LOADED" }
    }

    var cell

    try
    {
        cell = global.ModfusionBuildingPlanner.getCell(cellX, cellZ)
    }
    catch(error)
    {
        return { queued: false, reason: "INVALID_CELL" }
    }

    var state = getModfusionControllerState(level, cell.x, cell.z)

    if(state.status !== "FAILED")
    {
        return {
            queued: false,
            reason: "STATE_NOT_FAILED",
            state: state,
            cell: cell
        }
    }

    var key = modfusionControllerCellKey(cell)
    modfusionControllerRemoveQueuedCell(key)

    if(!modfusionControllerClearState(level, cell.x, cell.z))
    {
        return {
            queued: false,
            reason: "STATE_CLEAR_FAILED",
            cell: cell
        }
    }

    return enqueueModfusionControllerCell(
        level,
        cell.x,
        cell.z,
        source || "MANUAL_RETRY"
    )
}


/*
 * =========================================================
 * Planning and footprint readiness
 * =========================================================
 */


function modfusionControllerCreatePlan(level, cell)
{
    if(
        global.ModfusionBuildingPlanner == null ||
        typeof global.ModfusionBuildingPlanner.plan !== "function"
    )
    {
        return {
            status: "BLOCKED",
            reason: "PLANNER_NOT_LOADED"
        }
    }

    var seedText = modfusionControllerGetSeedText(level)

    if(seedText == null)
    {
        return {
            status: "BLOCKED",
            reason: "WORLD_SEED_UNAVAILABLE"
        }
    }

    try
    {
        var startedAt = Date.now()
        var plan = global.ModfusionBuildingPlanner.plan(
            seedText,
            cell.x,
            cell.z
        )

        var elapsedMillis = Date.now() - startedAt

        if(
            elapsedMillis >
                MODFUSION_BUILDING_CONTROLLER_CONFIG.planningWarningMillis
        )
        {
            console.warn(
                "[ModFusion Building Controller] Slow planner cell " +
                cell.x + ":" + cell.z + " used " +
                elapsedMillis + " ms"
            )
        }

        if(
            elapsedMillis >
                MODFUSION_BUILDING_CONTROLLER_CONFIG.maximumPlanningMillis
        )
        {
            return {
                status: "BLOCKED",
                reason: "PLANNER_TIME_BUDGET_EXCEEDED",
                detail: "Planner used " + elapsedMillis + " ms",
                cell: cell,
                island: plan != null ? plan.island : null
            }
        }

        return plan
    }
    catch(error)
    {
        return {
            status: "BLOCKED",
            reason: "PLANNER_EXCEPTION",
            detail: String(error)
        }
    }
}


function getModfusionControllerFootprintReadiness(level, plan)
{
    if(
        level == null ||
        plan == null ||
        plan.placement == null ||
        plan.placement.footprint == null
    )
    {
        return {
            ready: false,
            reason: "FOOTPRINT_MISSING",
            missing: 0,
            total: 0
        }
    }

    var footprint = plan.placement.footprint
    var centerChunkX = modfusionControllerReadInteger(
        footprint.centerChunkX
    )
    var centerChunkZ = modfusionControllerReadInteger(
        footprint.centerChunkZ
    )

    if(centerChunkX == null || centerChunkZ == null)
    {
        return {
            ready: false,
            reason: "INVALID_FOOTPRINT_CENTER",
            missing: 0,
            total: 0
        }
    }

    var explicitMinimumX = modfusionControllerReadInteger(
        footprint.minChunkX
    )
    var explicitMaximumX = modfusionControllerReadInteger(
        footprint.maxChunkX
    )
    var explicitMinimumZ = modfusionControllerReadInteger(
        footprint.minChunkZ
    )
    var explicitMaximumZ = modfusionControllerReadInteger(
        footprint.maxChunkZ
    )
    var explicitCount = 0

    if(explicitMinimumX != null) explicitCount++
    if(explicitMaximumX != null) explicitCount++
    if(explicitMinimumZ != null) explicitCount++
    if(explicitMaximumZ != null) explicitCount++

    if(explicitCount !== 0 && explicitCount !== 4)
    {
        return {
            ready: false,
            reason: "INCOMPLETE_EXACT_FOOTPRINT",
            missing: 0,
            total: 0
        }
    }

    var minimumX
    var maximumX
    var minimumZ
    var maximumZ
    var radius

    if(explicitCount === 4)
    {
        minimumX = explicitMinimumX
        maximumX = explicitMaximumX
        minimumZ = explicitMinimumZ
        maximumZ = explicitMaximumZ

        if(
            minimumX > maximumX ||
            minimumZ > maximumZ ||
            centerChunkX < minimumX ||
            centerChunkX > maximumX ||
            centerChunkZ < minimumZ ||
            centerChunkZ > maximumZ
        )
        {
            return {
                ready: false,
                reason: "INVALID_EXACT_FOOTPRINT_BOUNDS",
                missing: 0,
                total: 0
            }
        }

        radius = Math.max(
            Math.abs(centerChunkX - minimumX),
            Math.abs(maximumX - centerChunkX),
            Math.abs(centerChunkZ - minimumZ),
            Math.abs(maximumZ - centerChunkZ)
        )
    }
    else
    {
        radius = modfusionControllerReadInteger(footprint.radiusChunks)

        if(radius == null)
        {
            return {
                ready: false,
                reason: "INVALID_FOOTPRINT_RADIUS",
                missing: 0,
                total: 0
            }
        }

        minimumX = footprint.waitForFootprint === true
            ? centerChunkX - radius
            : centerChunkX
        maximumX = footprint.waitForFootprint === true
            ? centerChunkX + radius
            : centerChunkX
        minimumZ = footprint.waitForFootprint === true
            ? centerChunkZ - radius
            : centerChunkZ
        maximumZ = footprint.waitForFootprint === true
            ? centerChunkZ + radius
            : centerChunkZ
    }

    if(
        radius < 0 ||
        radius >
            MODFUSION_BUILDING_CONTROLLER_CONFIG
                .maximumFootprintRadiusChunks
    )
    {
        return {
            ready: false,
            reason: "INVALID_FOOTPRINT_RADIUS",
            missing: 0,
            total: 0
        }
    }

    var total = 0
    var missing = 0
    var firstMissingX = 0
    var firstMissingZ = 0
    var cx
    var cz

    for(cx = minimumX; cx <= maximumX; cx++)
    {
        for(cz = minimumZ; cz <= maximumZ; cz++)
        {
            total++

            var loaded = false

            try
            {
                loaded = level.hasChunk(cx, cz) === true
            }
            catch(error)
            {
                return {
                    ready: false,
                    reason: "CHUNK_READINESS_EXCEPTION",
                    detail: String(error),
                    missing: missing,
                    total: total
                }
            }

            if(!loaded)
            {
                if(missing === 0)
                {
                    firstMissingX = cx
                    firstMissingZ = cz
                }

                missing++
            }
        }
    }

    return {
        ready: missing === 0,
        reason: missing === 0 ? null : "FOOTPRINT_NOT_LOADED",
        missing: missing,
        total: total,
        firstMissingX: firstMissingX,
        firstMissingZ: firstMissingZ,
        minimumChunkX: minimumX,
        maximumChunkX: maximumX,
        minimumChunkZ: minimumZ,
        maximumChunkZ: maximumZ,
        exactBounds: explicitCount === 4
    }
}


/*
 * =========================================================
 * Worker
 * =========================================================
 */


function modfusionControllerWritePlanState(level, plan, status, reason)
{
    return modfusionControllerWriteState(
        level,
        plan.cell,
        {
            status: status,
            reason: reason,
            buildingId: plan.buildingId,
            targetId: plan.placement != null
                ? plan.placement.targetId
                : null,
            layerId: plan.island != null
                ? plan.island.layerId
                : null,
            x: plan.placement != null ? plan.placement.x : 0,
            y: plan.placement != null ? plan.placement.y : 0,
            z: plan.placement != null ? plan.placement.z : 0,
            exactY: plan.placement != null &&
                plan.placement.exactY === true
        }
    )
}


function processModfusionControllerJob(level, job)
{
    var state = getModfusionControllerState(
        level,
        job.cell.x,
        job.cell.z
    )

    if(modfusionControllerIsTerminalState(state.status))
    {
        modfusionControllerFinishActiveJob()
        return
    }

    var plan = modfusionControllerCreatePlan(level, job.cell)

    if(plan == null)
    {
        modfusionControllerFinishActiveJob()
        return
    }

    if(plan.status === "BLOCKED")
    {
        var blockedReason = plan.reason || "PLANNER_BLOCKED"

        modfusionControllerWriteState(level, job.cell, {
            status: "FAILED",
            reason: blockedReason,
            layerId: plan.island != null ? plan.island.layerId : null
        })

        console.error(
            "[ModFusion Building Controller] Planner blocked cell " +
            job.key + " - " + blockedReason +
            (plan.detail != null ? " / " + plan.detail : "")
        )

        modfusionControllerFinishActiveJob()
        return
    }

    if(plan.status === "RESERVED")
    {
        modfusionControllerWriteState(level, job.cell, {
            status: "RESERVED",
            reason: plan.reason || "RESERVED_CELL",
            layerId: plan.island != null ? plan.island.layerId : null
        })

        modfusionControllerFinishActiveJob()
        return
    }

    if(plan.status === "SKIPPED")
    {
        modfusionControllerWriteState(level, job.cell, {
            status: "SKIPPED",
            reason: plan.reason || "PLANNER_SKIPPED",
            layerId: plan.island != null ? plan.island.layerId : null
        })

        modfusionControllerFinishActiveJob()
        return
    }

    if(plan.status !== "PLANNED")
    {
        modfusionControllerFinishActiveJob()
        return
    }

    if(
        global.ModfusionBuildingGeneration == null ||
        typeof global.ModfusionBuildingGeneration.getAdapter !== "function" ||
        typeof global.ModfusionBuildingGeneration.prepare !== "function" ||
        typeof global.ModfusionBuildingGeneration.place !== "function"
    )
    {
        modfusionControllerFinishActiveJob()
        return
    }

    var adapter = global.ModfusionBuildingGeneration.getAdapter(
        plan.placement.adapterId
    )

    if(adapter == null)
    {
        modfusionControllerWritePlanState(
            level,
            plan,
            "FAILED",
            "UNKNOWN_ADAPTER"
        )

        modfusionControllerFinishActiveJob()
        return
    }

    var preparation = global.ModfusionBuildingGeneration.prepare(
        level,
        plan
    )

    if(preparation == null || preparation.prepared !== true)
    {
        var preparationFailure = preparation != null
            ? preparation.reason
            : "NULL_PREPARATION_RESULT"

        modfusionControllerWritePlanState(
            level,
            plan,
            "FAILED",
            preparationFailure
        )

        console.error(
            "[ModFusion Building Controller] PREPARATION FAILED cell " +
            job.key + " -> " + plan.buildingId + " / " +
            preparationFailure +
            (
                preparation != null && preparation.detail != null
                    ? " / " + preparation.detail
                    : ""
            )
        )

        modfusionControllerFinishActiveJob()
        return
    }

    plan.placement.footprint = preparation.footprint

    var readiness = getModfusionControllerFootprintReadiness(level, plan)

    if(!readiness.ready)
    {
        if(
            readiness.reason !== "FOOTPRINT_NOT_LOADED" &&
            readiness.reason !== "CHUNK_READINESS_EXCEPTION"
        )
        {
            modfusionControllerWritePlanState(
                level,
                plan,
                "FAILED",
                readiness.reason
            )
        }

        modfusionControllerFinishActiveJob()
        return
    }

    state = getModfusionControllerState(
        level,
        job.cell.x,
        job.cell.z
    )

    if(modfusionControllerIsTerminalState(state.status))
    {
        modfusionControllerFinishActiveJob()
        return
    }

    if(!modfusionControllerWritePlanState(
        level,
        plan,
        "PLACING",
        "PLACEMENT_IN_PROGRESS"
    ))
    {
        console.error(
            "[ModFusion Building Controller] Refusing to place cell " +
            job.key + " because PLACING state could not be saved"
        )

        modfusionControllerFinishActiveJob()
        return
    }

    var generation = global.ModfusionBuildingGeneration.place(
        level,
        plan,
        preparation
    )

    if(generation == null || generation.generated !== true)
    {
        var failureReason = generation != null
            ? generation.reason
            : "NULL_GENERATION_RESULT"

        modfusionControllerWritePlanState(
            level,
            plan,
            "FAILED",
            failureReason
        )

        console.error(
            "[ModFusion Building Controller] FAILED cell " + job.key +
            " -> " + plan.buildingId + " / " + failureReason +
            (
                generation != null && generation.detail != null
                    ? " / " + generation.detail
                    : ""
            )
        )

        modfusionControllerFinishActiveJob()
        return
    }

    var stateWritten = modfusionControllerWriteState(
        level,
        plan.cell,
        {
            status: "GENERATED",
            reason: "",
            buildingId: generation.buildingId,
            targetId: generation.targetId,
            layerId: plan.island.layerId,
            x: generation.requestedX,
            y: generation.requestedY,
            z: generation.requestedZ,
            exactY: generation.exactY === true
        }
    )

    if(!stateWritten)
    {
        console.error(
            "[ModFusion Building Controller] CRITICAL: Structure was " +
            "placed but GENERATED state could not be saved for cell " +
            job.key + ". PLACING state must be treated as ambiguous."
        )

        modfusionControllerFinishActiveJob()
        return
    }

    console.log(
        "[ModFusion Building Controller] GENERATED cell " + job.key +
        " -> " + generation.buildingId +
        " at requested position " + generation.requestedX + " " +
        generation.requestedY + " " + generation.requestedZ
    )

    modfusionControllerFinishActiveJob()
}


function processModfusionControllerWorker(server)
{
    if(
        MODFUSION_BUILDING_CONTROLLER_CONFIG.enabled !== true ||
        server == null
    )
    {
        return
    }

    var level = modfusionControllerGetLevel(server)

    if(level == null)
    {
        return
    }

    if(MODFUSION_BUILDING_CONTROLLER_ACTIVE == null)
    {
        if(MODFUSION_BUILDING_CONTROLLER_QUEUE.length <= 0)
        {
            return
        }

        MODFUSION_BUILDING_CONTROLLER_ACTIVE =
            MODFUSION_BUILDING_CONTROLLER_QUEUE.shift()
    }

    try
    {
        processModfusionControllerJob(
            level,
            MODFUSION_BUILDING_CONTROLLER_ACTIVE
        )
    }
    catch(error)
    {
        var key = MODFUSION_BUILDING_CONTROLLER_ACTIVE != null
            ? MODFUSION_BUILDING_CONTROLLER_ACTIVE.key
            : "unknown"

        console.error(
            "[ModFusion Building Controller] Worker exception for cell " +
            key + " - " + error
        )

        if(error != null && error.stack != null)
        {
            console.error(String(error.stack))
        }

        /*
         * If PLACING was already persisted, it remains terminal and blocks
         * an unsafe automatic duplicate. Otherwise the cell can be scanned
         * again after this in-memory job is released.
         */
        modfusionControllerFinishActiveJob()
    }
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
            MODFUSION_BUILDING_CONTROLLER_DIMENSION_ID
    )
    {
        return
    }

    enqueueModfusionControllerAtBlock(
        level,
        Math.floor(player.getX()),
        Math.floor(player.getZ()),
        "PLAYER_SCAN"
    )
}


/*
 * =========================================================
 * Command helpers
 * =========================================================
 */


function modfusionControllerGetCommandPlayer(context)
{
    try
    {
        return context.getSource().getPlayerOrException()
    }
    catch(error)
    {
        context.getSource().sendFailure(
            Component.of("该命令只能由玩家执行。")
        )

        return null
    }
}


function modfusionControllerGetPlayerCell(player)
{
    if(
        player == null ||
        global.ModfusionBuildingPlanner == null
    )
    {
        return null
    }

    try
    {
        return global.ModfusionBuildingPlanner.getCellAtBlock(
            Math.floor(player.getX()),
            Math.floor(player.getZ())
        )
    }
    catch(error)
    {
        return null
    }
}


function showModfusionControllerStatus(context)
{
    var player = modfusionControllerGetCommandPlayer(context)

    if(player == null)
    {
        return 0
    }

    var level = player.level

    if(
        modfusionControllerGetDimensionId(level) !==
        MODFUSION_BUILDING_CONTROLLER_DIMENSION_ID
    )
    {
        modfusionControllerTell(player, "§c请在融合维度中执行该命令。")
        return 0
    }

    var cell = modfusionControllerGetPlayerCell(player)

    if(cell == null)
    {
        modfusionControllerTell(player, "§c无法计算当前建筑网格。")
        return 0
    }

    var state = getModfusionControllerState(level, cell.x, cell.z)
    var plan = modfusionControllerCreatePlan(level, cell)
    var queue = getModfusionControllerQueueStatus()

    modfusionControllerTell(
        player,
        "§b[ModFusion Building] 网格 " + cell.key +
        "，状态 " + state.status +
        (state.reason.length > 0 ? "，原因 " + state.reason : "")
    )

    if(plan != null && plan.status === "PLANNED")
    {
        var preparation = null

        if(
            global.ModfusionBuildingGeneration != null &&
            typeof global.ModfusionBuildingGeneration.prepare === "function"
        )
        {
            preparation = global.ModfusionBuildingGeneration.prepare(
                level,
                plan
            )

            if(
                preparation != null &&
                preparation.prepared === true &&
                preparation.footprint != null
            )
            {
                plan.placement.footprint = preparation.footprint
            }
        }

        var readiness = getModfusionControllerFootprintReadiness(
            level,
            plan
        )

        modfusionControllerTell(
            player,
            "§7规划建筑 " + plan.buildingId +
            "，岛屿半径 " +
            (Math.round(plan.island.radius * 10) / 10) +
            "，坐标 " + plan.placement.x + " " +
            plan.placement.y + " " + plan.placement.z
        )

        if(preparation != null && preparation.prepared === true)
        {
            modfusionControllerTell(
                player,
                "§7真实范围 Y=" + preparation.bounds.minY + ".." +
                preparation.bounds.maxY + "，区块 X=" +
                preparation.footprint.minChunkX + ".." +
                preparation.footprint.maxChunkX + " Z=" +
                preparation.footprint.minChunkZ + ".." +
                preparation.footprint.maxChunkZ
            )

            if(readiness.ready)
            {
                modfusionControllerTell(
                    player,
                    "§a真实占地区块已全部加载。"
                )
            }
            else if(readiness.reason === "FOOTPRINT_NOT_LOADED")
            {
                modfusionControllerTell(
                    player,
                    "§e真实占地区块尚缺 " + readiness.missing +
                    "/" + readiness.total + " 个。"
                )
            }
            else
            {
                modfusionControllerTell(
                    player,
                    "§c真实占地检查失败：" + readiness.reason
                )
            }
        }
        else
        {
            modfusionControllerTell(
                player,
                "§c结构预计算失败：" +
                (
                    preparation != null
                        ? preparation.reason
                        : "GENERATION_ADAPTER_UNAVAILABLE"
                )
            )
        }
    }
    else if(plan != null)
    {
        modfusionControllerTell(
            player,
            "§7规划结果 " + plan.status +
            (plan.reason != null ? " / " + plan.reason : "")
        )
    }

    modfusionControllerTell(
        player,
        "§7队列 " + queue.queued +
        "，当前任务 " +
        (queue.active != null ? queue.active.key : "无")
    )

    if(state.status === "PLACING")
    {
        modfusionControllerTell(
            player,
            "§c该网格曾在放置途中被中断；为防止重复，不会自动重试。"
        )
    }

    if(
        state.status === "FAILED" &&
        state.reason === "PLACE_COMMAND_FAILED"
    )
    {
        modfusionControllerTell(
            player,
            "§e这是旧版命令放置失败记录；玩家扫描会自动清除并重新排队。"
        )
    }

    modfusionControllerTell(
        player,
        "§8status 只显示状态；生成由玩家扫描或 enqueue 命令触发。"
    )

    return 1
}


function enqueueModfusionControllerCommand(context)
{
    var player = modfusionControllerGetCommandPlayer(context)

    if(player == null)
    {
        return 0
    }

    var result = enqueueModfusionControllerAtBlock(
        player.level,
        Math.floor(player.getX()),
        Math.floor(player.getZ()),
        "MANUAL_COMMAND"
    )

    modfusionControllerTell(
        player,
        result.queued
            ? "§a当前网格已加入建筑队列。"
            : "§e未加入队列：" + result.reason
    )

    return result.queued ? 1 : 0
}


function retryModfusionControllerCommand(context)
{
    var player = modfusionControllerGetCommandPlayer(context)

    if(player == null)
    {
        return 0
    }

    if(
        modfusionControllerGetDimensionId(player.level) !==
        MODFUSION_BUILDING_CONTROLLER_DIMENSION_ID
    )
    {
        modfusionControllerTell(player, "§c请在融合维度中执行该命令。")
        return 0
    }

    var cell = modfusionControllerGetPlayerCell(player)

    if(cell == null)
    {
        modfusionControllerTell(player, "§c无法计算当前建筑网格。")
        return 0
    }

    var result = retryModfusionControllerCell(
        player.level,
        cell.x,
        cell.z,
        "MANUAL_RETRY"
    )

    modfusionControllerTell(
        player,
        result.queued
            ? "§a失败状态已清除，当前网格已重新加入队列。"
            : "§e无法重试：" + result.reason
    )

    if(result.queued)
    {
        modfusionControllerTell(
            player,
            "§e请先确认上次失败没有留下部分结构。"
        )
    }

    return result.queued ? 1 : 0
}


/*
 * =========================================================
 * Public API and events
 * =========================================================
 */


validateModfusionControllerConfig()


global.ModfusionBuildingController = {
    schemaVersion: MODFUSION_BUILDING_CONTROLLER_SCHEMA_VERSION,

    getConfig: getModfusionControllerConfig,
    getState: getModfusionControllerState,
    getQueueStatus: getModfusionControllerQueueStatus,
    getFootprintReadiness: getModfusionControllerFootprintReadiness,

    enqueueCell: enqueueModfusionControllerCell,
    enqueueAtBlock: enqueueModfusionControllerAtBlock,
    retryCell: retryModfusionControllerCell
}


PlayerEvents.tick(function(event)
{
    if(
        MODFUSION_BUILDING_CONTROLLER_CONFIG.enabled !== true ||
        MODFUSION_BUILDING_CONTROLLER_TICK %
            MODFUSION_BUILDING_CONTROLLER_CONFIG
                .playerScanIntervalTicks !== 0
    )
    {
        return
    }

    scanModfusionControllerPlayer(event.player, event.level)
})


ServerEvents.tick(function(event)
{
    MODFUSION_BUILDING_CONTROLLER_TICK++

    if(
        MODFUSION_BUILDING_CONTROLLER_TICK %
            MODFUSION_BUILDING_CONTROLLER_CONFIG
                .workerIntervalTicks !== 0
    )
    {
        return
    }

    processModfusionControllerWorker(event.server)
})


ServerEvents.commandRegistry(function(event)
{
    var Commands = event.commands

    event.register(
        Commands
            .literal("modfusion_building")
            .requires(function(source)
            {
                return source.hasPermission(2)
            })
            .then(
                Commands
                    .literal("status")
                    .executes(showModfusionControllerStatus)
            )
            .then(
                Commands
                    .literal("enqueue")
                    .executes(enqueueModfusionControllerCommand)
            )
            .then(
                Commands
                    .literal("retry")
                    .executes(retryModfusionControllerCommand)
            )
    )
})


console.log(
    "[ModFusion Building Controller] Controller v2 ready. " +
    "Enabled=" + MODFUSION_BUILDING_CONTROLLER_CONFIG.enabled +
    ", scanInterval=" +
    MODFUSION_BUILDING_CONTROLLER_CONFIG.playerScanIntervalTicks
)
