console.log("[ModFusion Building Registry] Island registry v1 loading")


/*
 * =========================================================
 * ModFusion Building Registry - Island Architecture v1
 * =========================================================
 *
 * This file is a static catalogue only.
 *
 * It never:
 *   - reads terrain or biomes;
 *   - searches for candidate positions;
 *   - loads or generates chunks;
 *   - selects or places a building;
 *   - writes persistent world state.
 *
 * Adding a building later only requires one more definition at the bottom
 * of this file. Buildings from different mods use the same schema.
 */


var MODFUSION_BUILDING_REGISTRY_SCHEMA_VERSION = 1
var MODFUSION_BUILDING_REGISTRY = Object.create(null)
var MODFUSION_BUILDING_IDS = []


/*
 * =========================================================
 * Helpers
 * =========================================================
 */


function modfusionRegistryHasOwn(object, key)
{
    return Object.prototype.hasOwnProperty.call(object, key)
}


function modfusionRegistryFail(message)
{
    throw new Error("[ModFusion Building Registry] " + message)
}


function modfusionRegistryClone(value)
{
    return value == null
        ? value
        : JSON.parse(JSON.stringify(value))
}


function modfusionRegistryIsResourceLocation(value)
{
    return typeof value === "string" &&
        /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(value)
}


function modfusionRegistryReadFinite(value, fallback)
{
    var result = value == null ? fallback : Number(value)

    return isFinite(result) ? result : fallback
}


function modfusionRegistryUniqueStrings(values)
{
    var source = Array.isArray(values) ? values : []
    var seen = Object.create(null)
    var result = []
    var i

    for(i = 0; i < source.length; i++)
    {
        var value = String(source[i])

        if(
            value.length > 0 &&
            !modfusionRegistryHasOwn(seen, value)
        )
        {
            seen[value] = true
            result.push(value)
        }
    }

    return result
}


/*
 * =========================================================
 * Definition normalization
 * =========================================================
 */


function normalizeModfusionBuilding(definition)
{
    if(definition == null || typeof definition !== "object")
    {
        modfusionRegistryFail("building definition must be an object")
    }

    var id = String(definition.id || "")
    var placement = definition.placement || {}
    var selection = definition.selection || {}
    var island = definition.island || {}

    if(!modfusionRegistryIsResourceLocation(id))
    {
        modfusionRegistryFail("invalid building id: " + id)
    }

    if(!modfusionRegistryIsResourceLocation(placement.adapterId))
    {
        modfusionRegistryFail(id + " has an invalid placement.adapterId")
    }

    if(!modfusionRegistryIsResourceLocation(placement.targetId))
    {
        modfusionRegistryFail(id + " has an invalid placement.targetId")
    }

    var weight = modfusionRegistryReadFinite(selection.weight, 1.0)

    var minimumRadius = modfusionRegistryReadFinite(
        island.minimumRadius,
        0.0
    )

    var yOffset = Math.floor(
        modfusionRegistryReadFinite(placement.yOffset, 1)
    )

    var footprintRadiusChunks = Math.floor(
        modfusionRegistryReadFinite(
            placement.footprintRadiusChunks,
            0
        )
    )

    if(weight <= 0.0)
    {
        modfusionRegistryFail(id + " must have selection.weight > 0")
    }

    if(minimumRadius < 0.0)
    {
        modfusionRegistryFail(
            id + " cannot have a negative minimumRadius"
        )
    }

    if(footprintRadiusChunks < 0 || footprintRadiusChunks > 32)
    {
        modfusionRegistryFail(
            id +
            " footprintRadiusChunks must be between 0 and 32"
        )
    }

    var allowedLayers = modfusionRegistryUniqueStrings(
        island.allowedLayers
    )

    if(allowedLayers.length <= 0)
    {
        modfusionRegistryFail(
            id + " must allow at least one island layer"
        )
    }

    var sourceMod = definition.sourceMod != null
        ? String(definition.sourceMod)
        : placement.targetId.split(":")[0]

    return {
        id: id,

        enabled: definition.enabled !== false,

        displayName: String(
            definition.displayName || id
        ),

        sourceMod: sourceMod,

        selection: {
            weight: weight
        },

        island: {
            allowedLayers: allowedLayers,
            minimumRadius: minimumRadius
        },

        placement: {
            adapterId: placement.adapterId,
            targetId: placement.targetId,

            anchorMode: String(
                placement.anchorMode || "ISLAND_CENTER"
            ),

            yOffset: yOffset,

            footprintRadiusChunks:
                footprintRadiusChunks,

            waitForFootprint:
                placement.waitForFootprint !== false,

            rotationMode: String(
                placement.rotationMode ||
                "STRUCTURE_DEFAULT"
            ),

            exactY: placement.exactY === true
        },

        tags:
            modfusionRegistryUniqueStrings(
                definition.tags
            )
    }
}


/*
 * =========================================================
 * Registration and queries
 * =========================================================
 */


function registerModfusionBuilding(definition)
{
    var building =
        normalizeModfusionBuilding(definition)

    if(
        modfusionRegistryHasOwn(
            MODFUSION_BUILDING_REGISTRY,
            building.id
        )
    )
    {
        modfusionRegistryFail(
            "duplicate building id: " +
            building.id
        )
    }

    MODFUSION_BUILDING_REGISTRY[
        building.id
    ] = building

    MODFUSION_BUILDING_IDS.push(
        building.id
    )

    return modfusionRegistryClone(
        building
    )
}


function hasModfusionBuilding(id)
{
    return (
        id != null &&
        modfusionRegistryHasOwn(
            MODFUSION_BUILDING_REGISTRY,
            String(id)
        )
    )
}


function getModfusionBuilding(id)
{
    return hasModfusionBuilding(id)
        ? modfusionRegistryClone(
            MODFUSION_BUILDING_REGISTRY[
                String(id)
            ]
        )
        : null
}


function getModfusionBuildingIds()
{
    return MODFUSION_BUILDING_IDS.slice(0)
}


function getAllModfusionBuildings()
{
    var result = []
    var i

    for(
        i = 0;
        i < MODFUSION_BUILDING_IDS.length;
        i++
    )
    {
        result.push(
            getModfusionBuilding(
                MODFUSION_BUILDING_IDS[i]
            )
        )
    }

    return result
}


function getEnabledModfusionBuildings()
{
    var all =
        getAllModfusionBuildings()

    var result = []
    var i

    for(i = 0; i < all.length; i++)
    {
        if(all[i].enabled === true)
        {
            result.push(
                all[i]
            )
        }
    }

    return result
}


function getEnabledModfusionBuildingsForIsland(
    layerId,
    islandRadius
)
{
    var layer =
        String(layerId || "")

    var radius =
        modfusionRegistryReadFinite(
            islandRadius,
            0.0
        )

    var enabled =
        getEnabledModfusionBuildings()

    var result = []
    var i

    for(
        i = 0;
        i < enabled.length;
        i++
    )
    {
        var building =
            enabled[i]

        if(
            building
                .island
                .allowedLayers
                .indexOf(layer)
                >= 0
            &&
            radius >=
                building
                    .island
                    .minimumRadius
        )
        {
            result.push(
                building
            )
        }
    }

    return result
}


function getModfusionBuildingsBySourceMod(
    sourceMod
)
{
    var namespace =
        String(sourceMod || "")

    var all =
        getAllModfusionBuildings()

    var result = []
    var i

    for(
        i = 0;
        i < all.length;
        i++
    )
    {
        if(
            all[i].sourceMod ===
            namespace
        )
        {
            result.push(
                all[i]
            )
        }
    }

    return result
}


function getModfusionBuildingTotalWeight(
    buildings
)
{
    var entries =
        Array.isArray(buildings)
            ? buildings
            : getEnabledModfusionBuildings()

    var total = 0.0
    var i

    for(
        i = 0;
        i < entries.length;
        i++
    )
    {
        var building =
            entries[i]

        if(
            building != null &&
            building.enabled === true &&
            building.selection != null
        )
        {
            var weight =
                Number(
                    building
                        .selection
                        .weight
                )

            if(
                isFinite(weight) &&
                weight > 0.0
            )
            {
                total += weight
            }
        }
    }

    return total
}


/*
 * =========================================================
 * Initial large-structure test set
 * =========================================================
 *
 * Equal weights give each structure an expected 25% share.
 *
 * footprintRadiusChunks is only a passive readiness boundary.
 * The future controller may check it with hasChunk(), but must
 * never call getChunk() merely to satisfy it.
 */


function registerModfusionTwilightLargeStructure(
    path,
    displayName,
    footprintRadiusChunks
)
{
    var targetId =
        "twilightforest:" + path

    registerModfusionBuilding({
        id: targetId,

        enabled: true,

        displayName: displayName,

        sourceMod:
            "twilightforest",

        selection: {
            weight: 1.0
        },

        island: {
            allowedLayers: [
                "MIDDLE"
            ],

            minimumRadius:
                150.0
        },

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                targetId,

            anchorMode:
                "ISLAND_CENTER",

            yOffset:
                1,

            footprintRadiusChunks:
                footprintRadiusChunks,

            waitForFootprint:
                true,

            rotationMode:
                "STRUCTURE_DEFAULT",

            exactY:
                false
        },

        tags: [
            "large",
            "boss",
            "twilightforest"
        ]
    })
}


registerModfusionTwilightLargeStructure(
    "naga_courtyard",
    "娜迦庭院",
    4
)


registerModfusionTwilightLargeStructure(
    "dark_tower",
    "暮初恶魂塔",
    4
)


registerModfusionTwilightLargeStructure(
    "aurora_palace",
    "极光宫殿",
    6
)


registerModfusionTwilightLargeStructure(
    "final_castle",
    "终焉堡垒",
    8
)


/*
 * =========================================================
 * Public API
 * =========================================================
 */


global.ModfusionBuildingRegistry = {
    schemaVersion:
        MODFUSION_BUILDING_REGISTRY_SCHEMA_VERSION,

    register:
        registerModfusionBuilding,

    has:
        hasModfusionBuilding,

    get:
        getModfusionBuilding,

    getIds:
        getModfusionBuildingIds,

    getAll:
        getAllModfusionBuildings,

    getEnabled:
        getEnabledModfusionBuildings,

    getEnabledForIsland:
        getEnabledModfusionBuildingsForIsland,

    getBySourceMod:
        getModfusionBuildingsBySourceMod,

    getTotalWeight:
        getModfusionBuildingTotalWeight
}


console.log(
    "[ModFusion Building Registry] " +
    "Island registry v1 ready. " +

    "Registered=" +
    MODFUSION_BUILDING_IDS.length +

    ", enabled=" +
    getEnabledModfusionBuildings().length +

    ", totalWeight=" +
    getModfusionBuildingTotalWeight()
)
