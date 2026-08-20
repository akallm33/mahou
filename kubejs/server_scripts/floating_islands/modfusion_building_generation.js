console.log("[ModFusion Building Generation] Adapter layer v2 loading")


/*
 * =========================================================
 * ModFusion Building Generation - Adapter Layer v2
 * =========================================================
 *
 * This file is the only module that is allowed to place a planned
 * building. Registry and Planner remain pure and never touch chunks.
 *
 * Twilight Forest landmark structures ignore the Y supplied to
 * /place structure and derive their elevation from the generator sea
 * level.  This adapter prepares the StructureStart directly, moves all
 * pieces so the root piece starts at the planned island surface, waits
 * for the real bounding-box chunks, and then places those chunks using
 * the same StructureStart API used by the vanilla command.
 */


var MODFUSION_BUILDING_GENERATION_SCHEMA_VERSION = 2
var MODFUSION_BUILDING_GENERATION_DIMENSION_ID =
    "mahou:modfusion_dimension"

var MODFUSION_BUILDING_GENERATION_ADAPTERS =
    Object.create(null)

var MODFUSION_GENERATION_BlockPos = Java.loadClass(
    "net.minecraft.core.BlockPos"
)
var MODFUSION_GENERATION_BoundingBox = Java.loadClass(
    "net.minecraft.world.level.levelgen.structure.BoundingBox"
)
var MODFUSION_GENERATION_ChunkPos = Java.loadClass(
    "net.minecraft.world.level.ChunkPos"
)
var MODFUSION_GENERATION_Registries = Java.loadClass(
    "net.minecraft.core.registries.Registries"
)
var MODFUSION_GENERATION_ResourceLocation = Java.loadClass(
    "net.minecraft.resources.ResourceLocation"
)
var MODFUSION_GENERATION_Predicate = Java.loadClass(
    "java.util.function.Predicate"
)
var MODFUSION_GENERATION_ArrayList = Java.loadClass(
    "java.util.ArrayList"
)
var MODFUSION_GENERATION_NON_NULL_BIOME =
    MODFUSION_GENERATION_Predicate.not(
        MODFUSION_GENERATION_Predicate.isEqual(null)
    )


function modfusionGenerationIsResourceLocation(value)
{
    return typeof value === "string" &&
        /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value)
}


function modfusionGenerationReadBlockCoordinate(value)
{
    var number = Number(value)

    if(
        !isFinite(number) ||
        Math.floor(number) !== number ||
        number < -30000000 ||
        number > 30000000
    )
    {
        return null
    }

    return number
}


function modfusionGenerationGetDimensionId(level)
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


function registerModfusionBuildingAdapter(definition)
{
    if(definition == null || typeof definition !== "object")
    {
        throw new Error(
            "[ModFusion Building Generation] Adapter definition " +
            "must be an object"
        )
    }

    var id = String(definition.id || "")

    if(!modfusionGenerationIsResourceLocation(id))
    {
        throw new Error(
            "[ModFusion Building Generation] Invalid adapter id: " + id
        )
    }

    if(
        typeof definition.prepare !== "function" ||
        typeof definition.place !== "function"
    )
    {
        throw new Error(
            "[ModFusion Building Generation] Adapter " + id +
            " must provide prepare(level, plan) and " +
            "place(level, plan, preparation)"
        )
    }

    if(MODFUSION_BUILDING_GENERATION_ADAPTERS[id] != null)
    {
        throw new Error(
            "[ModFusion Building Generation] Duplicate adapter id: " + id
        )
    }

    MODFUSION_BUILDING_GENERATION_ADAPTERS[id] = {
        id: id,
        exactY: definition.exactY === true,
        prepare: definition.prepare,
        place: definition.place
    }

    return true
}


function getModfusionBuildingAdapter(id)
{
    var key = String(id || "")
    var adapter = MODFUSION_BUILDING_GENERATION_ADAPTERS[key]

    if(adapter == null)
    {
        return null
    }

    return {
        id: adapter.id,
        exactY: adapter.exactY,
        canPrepare: true
    }
}


function getModfusionBuildingAdapterIds()
{
    var result = []
    var key

    for(key in MODFUSION_BUILDING_GENERATION_ADAPTERS)
    {
        if(Object.prototype.hasOwnProperty.call(
            MODFUSION_BUILDING_GENERATION_ADAPTERS,
            key
        ))
        {
            result.push(key)
        }
    }

    result.sort()
    return result
}


function modfusionGenerationCreateFailure(reason, extra)
{
    var result = {
        generated: false,
        reason: String(reason || "UNKNOWN_FAILURE")
    }

    if(extra != null && typeof extra === "object")
    {
        var key

        for(key in extra)
        {
            if(Object.prototype.hasOwnProperty.call(extra, key))
            {
                result[key] = extra[key]
            }
        }
    }

    return result
}


function modfusionGenerationValidateIslandSurface(level, plan, x, z)
{
    if(plan == null || plan.island == null)
    {
        return modfusionGenerationCreateFailure("ISLAND_PLAN_MISSING")
    }

    var surfaceY = modfusionGenerationReadBlockCoordinate(
        plan.island.surfaceY
    )

    if(surfaceY == null)
    {
        return modfusionGenerationCreateFailure("INVALID_ISLAND_SURFACE_Y")
    }

    try
    {
        var surfaceState = level.getBlockState(
            new MODFUSION_GENERATION_BlockPos(x, surfaceY, z)
        )

        if(surfaceState == null || surfaceState.isAir())
        {
            return modfusionGenerationCreateFailure(
                "ISLAND_CENTER_NOT_SOLID",
                {
                    checkedX: x,
                    checkedY: surfaceY,
                    checkedZ: z
                }
            )
        }
    }
    catch(error)
    {
        return modfusionGenerationCreateFailure(
            "ISLAND_SURFACE_CHECK_EXCEPTION",
            { detail: String(error) }
        )
    }

    return null
}


function modfusionGenerationCreatePreparationFailure(reason, extra)
{
    var result = modfusionGenerationCreateFailure(reason, extra)
    result.prepared = false
    return result
}


function modfusionGenerationReadPlacement(level, plan)
{
    if(level == null)
    {
        return {
            valid: false,
            failure: modfusionGenerationCreatePreparationFailure(
                "LEVEL_UNAVAILABLE"
            )
        }
    }

    if(
        modfusionGenerationGetDimensionId(level) !==
        MODFUSION_BUILDING_GENERATION_DIMENSION_ID
    )
    {
        return {
            valid: false,
            failure: modfusionGenerationCreatePreparationFailure(
                "WRONG_DIMENSION"
            )
        }
    }

    if(
        plan == null ||
        plan.placement == null ||
        !modfusionGenerationIsResourceLocation(plan.placement.targetId)
    )
    {
        return {
            valid: false,
            failure: modfusionGenerationCreatePreparationFailure(
                "INVALID_TARGET_ID"
            )
        }
    }

    var x = modfusionGenerationReadBlockCoordinate(plan.placement.x)
    var y = modfusionGenerationReadBlockCoordinate(plan.placement.y)
    var z = modfusionGenerationReadBlockCoordinate(plan.placement.z)

    if(x == null || y == null || z == null)
    {
        return {
            valid: false,
            failure: modfusionGenerationCreatePreparationFailure(
                "INVALID_PLACEMENT_COORDINATES"
            )
        }
    }

    return {
        valid: true,
        x: x,
        y: y,
        z: z,
        targetId: String(plan.placement.targetId),
        key: String(plan.placement.targetId) + "@" +
            x + "," + y + "," + z
    }
}


function modfusionGenerationGetExactSeedBox(level)
{
    try
    {
        var holderClass = level
            .getClass()
            .getClassLoader()
            .loadClass(
                "com.klinbee.moredensityfunctions.randomsamplers." +
                "RandomSampler$WorldSeedHolder"
            )
        var field = holderClass.getDeclaredField("worldSeed")
        field.setAccessible(true)
        return field.get(null)
    }
    catch(error)
    {
        throw new Error(
            "Unable to read exact 64-bit terrain seed: " + String(error)
        )
    }
}


function prepareModfusionRegisteredStructure(level, plan)
{
    var placement = modfusionGenerationReadPlacement(level, plan)

    if(!placement.valid)
    {
        return placement.failure
    }

    try
    {
        var registryAccess = level.registryAccess()
        var structureRegistry = registryAccess.registryOrThrow(
            MODFUSION_GENERATION_Registries.STRUCTURE
        )
        var structure = structureRegistry.get(
            new MODFUSION_GENERATION_ResourceLocation(
                placement.targetId
            )
        )

        if(structure == null)
        {
            return modfusionGenerationCreatePreparationFailure(
                "STRUCTURE_NOT_REGISTERED",
                { targetId: placement.targetId }
            )
        }

        var chunkSource = level.getChunkSource()
        var generator = chunkSource.getGenerator()
        var startChunk = new MODFUSION_GENERATION_ChunkPos(
            Math.floor(placement.x / 16),
            Math.floor(placement.z / 16)
        )
        var start = structure.generate(
            registryAccess,
            generator,
            generator.getBiomeSource(),
            chunkSource.randomState(),
            level.getStructureManager(),
            modfusionGenerationGetExactSeedBox(level),
            startChunk,
            0,
            level,
            MODFUSION_GENERATION_NON_NULL_BIOME
        )

        if(start == null || !start.isValid())
        {
            return modfusionGenerationCreatePreparationFailure(
                "STRUCTURE_START_INVALID",
                { targetId: placement.targetId }
            )
        }

        /*
         * Do not call start.getBoundingBox() before moving the pieces:
         * StructureStart caches that result.  Twilight's root piece starts
         * at its sea-level-selected elevation, so aligning that root minimum
         * Y to the planned island surface preserves all relative geometry.
         */
        /*
         * Java 17 may return ImmutableCollections$ListN here. That concrete
         * class is package-private, so Rhino cannot legally call its public
         * size/get methods through reflection. Copying through ArrayList's
         * public Collection constructor gives Rhino an accessible class.
         */
        var pieces = new MODFUSION_GENERATION_ArrayList(
            start.getPieces()
        )

        if(pieces == null || pieces.size() <= 0)
        {
            return modfusionGenerationCreatePreparationFailure(
                "STRUCTURE_HAS_NO_PIECES",
                { targetId: placement.targetId }
            )
        }

        var originalAnchorY = Number(
            pieces.get(0).getBoundingBox().minY()
        )
        var verticalOffset = placement.y - originalAnchorY
        var pieceIndex

        for(pieceIndex = 0; pieceIndex < pieces.size(); pieceIndex++)
        {
            pieces.get(pieceIndex).move(0, verticalOffset, 0)
        }

        var bounds = start.getBoundingBox()
        var minimumBuildY = Number(level.getMinBuildHeight())
        var maximumBuildY = Number(level.getMaxBuildHeight())

        if(
            Number(bounds.minY()) < minimumBuildY ||
            Number(bounds.maxY()) >= maximumBuildY
        )
        {
            return modfusionGenerationCreatePreparationFailure(
                "SHIFTED_STRUCTURE_OUT_OF_WORLD",
                {
                    boundsMinY: Number(bounds.minY()),
                    boundsMaxY: Number(bounds.maxY()),
                    minimumBuildY: minimumBuildY,
                    maximumBuildYExclusive: maximumBuildY,
                    verticalOffset: verticalOffset
                }
            )
        }

        var minimumChunkX = Math.floor(Number(bounds.minX()) / 16)
        var maximumChunkX = Math.floor(Number(bounds.maxX()) / 16)
        var minimumChunkZ = Math.floor(Number(bounds.minZ()) / 16)
        var maximumChunkZ = Math.floor(Number(bounds.maxZ()) / 16)
        var centerChunkX = Math.floor(placement.x / 16)
        var centerChunkZ = Math.floor(placement.z / 16)
        var radiusChunks = Math.max(
            Math.abs(centerChunkX - minimumChunkX),
            Math.abs(maximumChunkX - centerChunkX),
            Math.abs(centerChunkZ - minimumChunkZ),
            Math.abs(maximumChunkZ - centerChunkZ)
        )

        return {
            prepared: true,
            generated: false,
            reason: null,
            key: placement.key,
            start: start,
            generator: generator,
            originalAnchorY: originalAnchorY,
            verticalOffset: verticalOffset,
            bounds: {
                minX: Number(bounds.minX()),
                minY: Number(bounds.minY()),
                minZ: Number(bounds.minZ()),
                maxX: Number(bounds.maxX()),
                maxY: Number(bounds.maxY()),
                maxZ: Number(bounds.maxZ())
            },
            footprint: {
                centerChunkX: centerChunkX,
                centerChunkZ: centerChunkZ,
                radiusChunks: radiusChunks,
                waitForFootprint: true,
                minChunkX: minimumChunkX,
                maxChunkX: maximumChunkX,
                minChunkZ: minimumChunkZ,
                maxChunkZ: maximumChunkZ,
                exactBounds: true
            }
        }
    }
    catch(error)
    {
        return modfusionGenerationCreatePreparationFailure(
            "STRUCTURE_PREPARATION_RUNTIME_EXCEPTION",
            {
                targetId: placement.targetId,
                detail: String(error)
            }
        )
    }
}


function placeModfusionRegisteredStructure(level, plan, preparation)
{
    var placement = modfusionGenerationReadPlacement(level, plan)

    if(!placement.valid)
    {
        return placement.failure
    }

    if(
        preparation == null ||
        preparation.prepared !== true ||
        preparation.key !== placement.key ||
        preparation.start == null ||
        preparation.generator == null ||
        preparation.footprint == null
    )
    {
        return modfusionGenerationCreateFailure(
            "PREPARATION_MISSING_OR_STALE"
        )
    }

    /*
     * Direct structure placement writes blocks incrementally and cannot roll
     * them back. Verify the deterministic island centre immediately before
     * allowing the first block write.
     */
    var surfaceFailure = modfusionGenerationValidateIslandSurface(
        level,
        plan,
        placement.x,
        placement.z
    )

    if(surfaceFailure != null)
    {
        return surfaceFailure
    }

    var footprint = preparation.footprint
    var cx
    var cz

    for(cx = footprint.minChunkX; cx <= footprint.maxChunkX; cx++)
    {
        for(cz = footprint.minChunkZ; cz <= footprint.maxChunkZ; cz++)
        {
            if(level.hasChunk(cx, cz) !== true)
            {
                return modfusionGenerationCreateFailure(
                    "PREPARED_FOOTPRINT_NOT_LOADED",
                    { missingChunkX: cx, missingChunkZ: cz }
                )
            }
        }
    }

    try
    {
        for(cx = footprint.minChunkX; cx <= footprint.maxChunkX; cx++)
        {
            for(cz = footprint.minChunkZ; cz <= footprint.maxChunkZ; cz++)
            {
                var chunkPos = new MODFUSION_GENERATION_ChunkPos(cx, cz)
                var chunkBounds = new MODFUSION_GENERATION_BoundingBox(
                    chunkPos.getMinBlockX(),
                    level.getMinBuildHeight(),
                    chunkPos.getMinBlockZ(),
                    chunkPos.getMaxBlockX(),
                    level.getMaxBuildHeight(),
                    chunkPos.getMaxBlockZ()
                )

                preparation.start.placeInChunk(
                    level,
                    level.structureManager(),
                    preparation.generator,
                    level.getRandom(),
                    chunkBounds,
                    chunkPos
                )
            }
        }
    }
    catch(error)
    {
        return modfusionGenerationCreateFailure(
            "STRUCTURE_PLACEMENT_EXCEPTION",
            {
                targetId: placement.targetId,
                detail: String(error),
                chunkX: cx,
                chunkZ: cz
            }
        )
    }

    return {
        generated: true,
        reason: null,

        adapterId: plan.placement.adapterId,
        buildingId: plan.buildingId,
        targetId: placement.targetId,

        requestedX: placement.x,
        requestedY: placement.y,
        requestedZ: placement.z,

        exactY: true,
        verticalOffset: preparation.verticalOffset,
        bounds: preparation.bounds,
        footprint: preparation.footprint
    }
}


function prepareModfusionBuildingPlan(level, plan)
{
    if(plan == null || plan.status !== "PLANNED")
    {
        return modfusionGenerationCreatePreparationFailure(
            "PLAN_NOT_READY"
        )
    }

    if(plan.placement == null)
    {
        return modfusionGenerationCreatePreparationFailure(
            "PLACEMENT_MISSING"
        )
    }

    var adapterId = String(plan.placement.adapterId || "")
    var adapter = MODFUSION_BUILDING_GENERATION_ADAPTERS[adapterId]

    if(adapter == null)
    {
        return modfusionGenerationCreatePreparationFailure(
            "UNKNOWN_ADAPTER",
            { adapterId: adapterId }
        )
    }

    try
    {
        var result = adapter.prepare(level, plan)

        if(result == null || typeof result !== "object")
        {
            return modfusionGenerationCreatePreparationFailure(
                "INVALID_PREPARATION_RESULT",
                { adapterId: adapterId }
            )
        }

        result.adapterId = adapterId
        return result
    }
    catch(error)
    {
        return modfusionGenerationCreatePreparationFailure(
            "PREPARATION_ADAPTER_EXCEPTION",
            {
                adapterId: adapterId,
                detail: String(error)
            }
        )
    }
}


function placeModfusionBuildingPlan(level, plan, preparation)
{
    if(plan == null || plan.status !== "PLANNED")
    {
        return modfusionGenerationCreateFailure("PLAN_NOT_READY")
    }

    if(plan.placement == null)
    {
        return modfusionGenerationCreateFailure("PLACEMENT_MISSING")
    }

    var adapterId = String(plan.placement.adapterId || "")
    var adapter = MODFUSION_BUILDING_GENERATION_ADAPTERS[adapterId]

    if(adapter == null)
    {
        return modfusionGenerationCreateFailure(
            "UNKNOWN_ADAPTER",
            { adapterId: adapterId }
        )
    }

    try
    {
        var result = adapter.place(level, plan, preparation)

        if(result == null || typeof result !== "object")
        {
            return modfusionGenerationCreateFailure(
                "INVALID_ADAPTER_RESULT",
                { adapterId: adapterId }
            )
        }

        result.adapterId = adapterId
        result.exactY = adapter.exactY === true
        return result
    }
    catch(error)
    {
        return modfusionGenerationCreateFailure(
            "ADAPTER_EXCEPTION",
            {
                adapterId: adapterId,
                detail: String(error)
            }
        )
    }
}


registerModfusionBuildingAdapter({
    id: "mahou:registered_structure",
    exactY: true,
    prepare: prepareModfusionRegisteredStructure,
    place: placeModfusionRegisteredStructure
})


global.ModfusionBuildingGeneration = {
    schemaVersion: MODFUSION_BUILDING_GENERATION_SCHEMA_VERSION,

    registerAdapter: registerModfusionBuildingAdapter,
    getAdapter: getModfusionBuildingAdapter,
    getAdapterIds: getModfusionBuildingAdapterIds,

    prepare: prepareModfusionBuildingPlan,
    place: placeModfusionBuildingPlan
}


console.log(
    "[ModFusion Building Generation] Adapter layer v2 ready. " +
    "Adapters=" + getModfusionBuildingAdapterIds().join(",")
)
