console.log(
    "[ModFusion Buildings] Registry v2 loading"
)


/*
 * =========================================================
 * Schema
 * =========================================================
 *
 * Registry 只负责描述建筑。
 *
 * 它不负责：
 *
 * - 群系判断
 * - 候选位置搜索
 * - 建筑数量分配
 * - 区块加载
 * - 实际生成
 *
 * 后续模块只能读取这里规范化后的配置，
 * 不应硬编码某个具体建筑。
 */


var MODFUSION_BUILDING_SCHEMA_VERSION =
    2


var MODFUSION_BUILDING_REGISTRY = {}

var MODFUSION_BUILDING_IDS = []


var MODFUSION_BUILDING_VALID_LAYERS = {

    "MIDDLE":
        true,

    "HIGH":
        true
}


var MODFUSION_BUILDING_VALID_ANCHOR_POLICIES = {

    "CANDIDATE_SURFACE":
        true,

    "FIXED_Y":
        true
}


var MODFUSION_BUILDING_VALID_ROTATION_POLICIES = {

    "STRUCTURE_DEFAULT":
        true,

    "NONE":
        true,

    "RANDOM_90":
        true
}


var MODFUSION_BUILDING_VALID_RESERVE_POLICIES = {

    "SAME_BUILDING":
        true,

    "DISABLED":
        true
}


/*
 * =========================================================
 * Basic helpers
 * =========================================================
 */


function modfusionBuildingFail(
    message
)
{
    throw new Error(
        "[ModFusion Buildings] " +
        message
    )
}


function modfusionBuildingHasOwn(
    object,
    key
)
{
    return Object.prototype
        .hasOwnProperty
        .call(
            object,
            key
        )
}


function modfusionBuildingIsObject(
    value
)
{
    return (
        value != null &&
        typeof value === "object" &&
        !Array.isArray(value)
    )
}


function modfusionBuildingReadObject(
    value,
    path,
    required
)
{
    if(value == null)
    {
        if(required === true)
        {
            modfusionBuildingFail(
                path +
                " is required"
            )
        }


        return {}
    }


    if(
        !modfusionBuildingIsObject(
            value
        )
    )
    {
        modfusionBuildingFail(
            path +
            " must be an object"
        )
    }


    return value
}


function modfusionBuildingReadString(
    value,
    path,
    defaultValue
)
{
    if(value == null)
    {
        if(defaultValue != null)
        {
            return defaultValue
        }


        modfusionBuildingFail(
            path +
            " is required"
        )
    }


    if(typeof value !== "string")
    {
        modfusionBuildingFail(
            path +
            " must be a string"
        )
    }


    var result =
        String(value).trim()


    if(result.length <= 0)
    {
        modfusionBuildingFail(
            path +
            " cannot be empty"
        )
    }


    return result
}


function modfusionBuildingReadBoolean(
    value,
    path,
    defaultValue
)
{
    if(value == null)
    {
        return defaultValue === true
    }


    if(typeof value !== "boolean")
    {
        modfusionBuildingFail(
            path +
            " must be a boolean"
        )
    }


    return value
}


function modfusionBuildingReadInteger(
    value,
    path,
    defaultValue,
    minimum,
    maximum
)
{
    if(value == null)
    {
        if(defaultValue != null)
        {
            return defaultValue
        }


        modfusionBuildingFail(
            path +
            " is required"
        )
    }


    if(
        typeof value !== "number" ||
        !isFinite(value) ||
        Math.floor(value) !== value
    )
    {
        modfusionBuildingFail(
            path +
            " must be an integer"
        )
    }


    if(
        minimum != null &&
        value < minimum
    )
    {
        modfusionBuildingFail(
            path +
            " must be >= " +
            minimum
        )
    }


    if(
        maximum != null &&
        value > maximum
    )
    {
        modfusionBuildingFail(
            path +
            " must be <= " +
            maximum
        )
    }


    return value
}


function modfusionBuildingValidateBuildingId(
    value,
    path
)
{
    var result =
        modfusionBuildingReadString(
            value,
            path,
            null
        )


    if(
        !/^[a-z0-9_.-]+$/.test(
            result
        )
    )
    {
        modfusionBuildingFail(
            path +
            " is not a valid building id: " +
            result
        )
    }


    if(
        result === "__proto__" ||
        result === "prototype" ||
        result === "constructor"
    )
    {
        modfusionBuildingFail(
            path +
            " uses a reserved name"
        )
    }


    return result
}


function modfusionBuildingValidateNamespace(
    value,
    path
)
{
    var result =
        modfusionBuildingReadString(
            value,
            path,
            null
        )


    if(
        !/^[a-z0-9_.-]+$/.test(
            result
        )
    )
    {
        modfusionBuildingFail(
            path +
            " is not a valid namespace: " +
            result
        )
    }


    return result
}


function modfusionBuildingValidateResourceId(
    value,
    path
)
{
    var result =
        modfusionBuildingReadString(
            value,
            path,
            null
        )


    if(
        !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(
            result
        )
    )
    {
        modfusionBuildingFail(
            path +
            " is not a valid resource id: " +
            result
        )
    }


    return result
}


function modfusionBuildingReadEnum(
    value,
    path,
    defaultValue,
    validValues
)
{
    var result =
        modfusionBuildingReadString(
            value,
            path,
            defaultValue
        )


    if(validValues[result] !== true)
    {
        modfusionBuildingFail(
            path +
            " has unsupported value: " +
            result
        )
    }


    return result
}


function modfusionBuildingReadStringArray(
    value,
    path,
    defaultValue,
    validValues,
    allowEmpty
)
{
    var source =
        value


    if(source == null)
    {
        source =
            defaultValue
    }


    if(!Array.isArray(source))
    {
        modfusionBuildingFail(
            path +
            " must be an array"
        )
    }


    var result = []

    var seen = {}

    var i


    for(
        i = 0;
        i < source.length;
        i++
    )
    {
        var item =
            modfusionBuildingReadString(
                source[i],
                path +
                "[" +
                i +
                "]",
                null
            )


        if(
            validValues != null &&
            validValues[item] !== true
        )
        {
            modfusionBuildingFail(
                path +
                " contains unsupported value: " +
                item
            )
        }


        var seenKey =
            "@" +
            item


        if(
            !modfusionBuildingHasOwn(
                seen,
                seenKey
            )
        )
        {
            seen[seenKey] =
                true

            result.push(
                item
            )
        }
    }


    if(
        allowEmpty !== true &&
        result.length <= 0
    )
    {
        modfusionBuildingFail(
            path +
            " cannot be empty"
        )
    }


    return result
}


function modfusionBuildingGetNamespace(
    resourceId
)
{
    var separator =
        resourceId.indexOf(":")


    if(separator <= 0)
    {
        return null
    }


    return resourceId.substring(
        0,
        separator
    )
}


/*
 * =========================================================
 * Section normalization
 * =========================================================
 */


function normalizeModfusionPlacement(
    buildingId,
    value
)
{
    var path =
        buildingId +
        ".placement"


    var placement =
        modfusionBuildingReadObject(
            value,
            path,
            true
        )


    var adapterId =
        modfusionBuildingValidateResourceId(
            placement.adapterId != null
                ? placement.adapterId
                : "mahou:registered_structure",
            path +
            ".adapterId"
        )


    var targetId =
        modfusionBuildingValidateResourceId(
            placement.targetId,
            path +
            ".targetId"
        )


    var anchorPolicy =
        modfusionBuildingReadEnum(
            placement.anchorPolicy,
            path +
            ".anchorPolicy",
            "CANDIDATE_SURFACE",
            MODFUSION_BUILDING_VALID_ANCHOR_POLICIES
        )


    var fixedY =
        null


    if(anchorPolicy === "FIXED_Y")
    {
        fixedY =
            modfusionBuildingReadInteger(
                placement.fixedY,
                path +
                ".fixedY",
                null,
                -2048,
                2048
            )
    }


    var yOffset =
        modfusionBuildingReadInteger(
            placement.yOffset,
            path +
            ".yOffset",
            0,
            -2048,
            2048
        )


    var rotationPolicy =
        modfusionBuildingReadEnum(
            placement.rotationPolicy,
            path +
            ".rotationPolicy",
            "STRUCTURE_DEFAULT",
            MODFUSION_BUILDING_VALID_ROTATION_POLICIES
        )


    var options =
        modfusionBuildingReadObject(
            placement.options,
            path +
            ".options",
            false
        )


    return {

        adapterId:
            adapterId,

        targetId:
            targetId,

        anchorPolicy:
            anchorPolicy,

        fixedY:
            fixedY,

        yOffset:
            yOffset,

        rotationPolicy:
            rotationPolicy,

        options:
            options
    }
}


function normalizeModfusionDistribution(
    buildingId,
    value
)
{
    var path =
        buildingId +
        ".distribution"


    var distribution =
        modfusionBuildingReadObject(
            value,
            path,
            true
        )


    var poolId =
        modfusionBuildingValidateResourceId(
            distribution.poolId,
            path +
            ".poolId"
        )


    var weight =
        modfusionBuildingReadInteger(
            distribution.weight,
            path +
            ".weight",
            1,
            1,
            1000000
        )


    var unique =
        modfusionBuildingReadBoolean(
            distribution.unique,
            path +
            ".unique",
            false
        )


    var reservePolicy =
        modfusionBuildingReadEnum(
            distribution.reservePolicy,
            path +
            ".reservePolicy",
            "SAME_BUILDING",
            MODFUSION_BUILDING_VALID_RESERVE_POLICIES
        )


    return {

        poolId:
            poolId,

        weight:
            weight,

        unique:
            unique,

        reservePolicy:
            reservePolicy
    }
}


function normalizeModfusionTerrain(
    buildingId,
    value
)
{
    var path =
        buildingId +
        ".terrain"


    var terrain =
        modfusionBuildingReadObject(
            value,
            path,
            true
        )


    var analyzerId =
        modfusionBuildingValidateResourceId(
            terrain.analyzerId != null
                ? terrain.analyzerId
                : "mahou:floating_island_surface",
            path +
            ".analyzerId"
        )


    var allowedLayers =
        modfusionBuildingReadStringArray(
            terrain.allowedLayers,
            path +
            ".allowedLayers",
            [
                "MIDDLE",
                "HIGH"
            ],
            MODFUSION_BUILDING_VALID_LAYERS,
            false
        )


    var foundationRadius =
        modfusionBuildingReadInteger(
            terrain.foundationRadius,
            path +
            ".foundationRadius",
            null,
            0,
            512
        )


    var minFoundationPoints =
        modfusionBuildingReadInteger(
            terrain.minFoundationPoints,
            path +
            ".minFoundationPoints",
            null,
            1,
            9
        )


    var reliefSampleRadius =
        modfusionBuildingReadInteger(
            terrain.reliefSampleRadius,
            path +
            ".reliefSampleRadius",
            null,
            0,
            1024
        )


    if(
        reliefSampleRadius <
        foundationRadius
    )
    {
        modfusionBuildingFail(
            path +
            ".reliefSampleRadius cannot be smaller than " +
            path +
            ".foundationRadius"
        )
    }


    var maxHeightDifference =
        modfusionBuildingReadInteger(
            terrain.maxHeightDifference,
            path +
            ".maxHeightDifference",
            null,
            0,
            384
        )


    var options =
        modfusionBuildingReadObject(
            terrain.options,
            path +
            ".options",
            false
        )


    return {

        analyzerId:
            analyzerId,

        allowedLayers:
            allowedLayers,

        foundationRadius:
            foundationRadius,

        minFoundationPoints:
            minFoundationPoints,

        reliefSampleRadius:
            reliefSampleRadius,

        maxHeightDifference:
            maxHeightDifference,

        options:
            options
    }
}


function normalizeModfusionSpacing(
    buildingId,
    value
)
{
    var path =
        buildingId +
        ".spacing"


    var spacing =
        modfusionBuildingReadObject(
            value,
            path,
            true
        )


    var ruleId =
        modfusionBuildingValidateResourceId(
            spacing.ruleId != null
                ? spacing.ruleId
                : "mahou:global_radius",
            path +
            ".ruleId"
        )


    var minDistance =
        modfusionBuildingReadInteger(
            spacing.minDistance,
            path +
            ".minDistance",
            null,
            0,
            10000000
        )


    var options =
        modfusionBuildingReadObject(
            spacing.options,
            path +
            ".options",
            false
        )


    return {

        ruleId:
            ruleId,

        minDistance:
            minDistance,

        options:
            options
    }
}


/*
 * =========================================================
 * Complete building normalization
 * =========================================================
 */


function normalizeModfusionBuilding(
    buildingId,
    config
)
{
    var path =
        "building[" +
        buildingId +
        "]"


    var source =
        modfusionBuildingReadObject(
            config,
            path,
            true
        )


    var enabled =
        modfusionBuildingReadBoolean(
            source.enabled,
            path +
            ".enabled",
            true
        )


    var displayName =
        modfusionBuildingReadString(
            source.displayName,
            path +
            ".displayName",
            buildingId
        )


    var placement =
        normalizeModfusionPlacement(
            buildingId,
            source.placement
        )


    var sourceModDefault =
        modfusionBuildingGetNamespace(
            placement.targetId
        )


    var sourceMod =
        modfusionBuildingValidateNamespace(
            source.sourceMod != null
                ? source.sourceMod
                : sourceModDefault,
            path +
            ".sourceMod"
        )


    var distribution =
        normalizeModfusionDistribution(
            buildingId,
            source.distribution
        )


    var terrain =
        normalizeModfusionTerrain(
            buildingId,
            source.terrain
        )


    var spacing =
        normalizeModfusionSpacing(
            buildingId,
            source.spacing
        )


    var tags =
        modfusionBuildingReadStringArray(
            source.tags,
            path +
            ".tags",
            [],
            null,
            true
        )


    return {

        schemaVersion:
            MODFUSION_BUILDING_SCHEMA_VERSION,

        id:
            buildingId,

        enabled:
            enabled,

        displayName:
            displayName,

        sourceMod:
            sourceMod,

        placement:
            placement,

        distribution:
            distribution,

        terrain:
            terrain,

        spacing:
            spacing,

        tags:
            tags
    }
}


/*
 * =========================================================
 * Registry operations
 * =========================================================
 */


function registerModfusionBuilding(
    buildingId,
    config
)
{
    var normalizedId =
        modfusionBuildingValidateBuildingId(
            buildingId,
            "buildingId"
        )


    if(
        modfusionBuildingHasOwn(
            MODFUSION_BUILDING_REGISTRY,
            normalizedId
        )
    )
    {
        modfusionBuildingFail(
            "Duplicate building registration: " +
            normalizedId
        )
    }


    var normalized =
        normalizeModfusionBuilding(
            normalizedId,
            config
        )


    MODFUSION_BUILDING_REGISTRY[
        normalizedId
    ] = normalized


    MODFUSION_BUILDING_IDS.push(
        normalizedId
    )


    console.log(
        "[ModFusion Buildings] Registered: " +
        normalizedId +
        " -> " +
        normalized.placement.targetId
    )


    return normalized
}


function hasModfusionBuilding(
    buildingId
)
{
    if(buildingId == null)
    {
        return false
    }


    return modfusionBuildingHasOwn(
        MODFUSION_BUILDING_REGISTRY,
        String(buildingId)
    )
}


function getModfusionBuilding(
    buildingId
)
{
    if(
        !hasModfusionBuilding(
            buildingId
        )
    )
    {
        return null
    }


    return MODFUSION_BUILDING_REGISTRY[
        String(buildingId)
    ]
}


function getModfusionBuildingIds()
{
    var result =
        MODFUSION_BUILDING_IDS.slice(0)


    result.sort()


    return result
}


function getAllModfusionBuildings()
{
    var ids =
        getModfusionBuildingIds()


    var result = []

    var i


    for(
        i = 0;
        i < ids.length;
        i++
    )
    {
        result.push(
            MODFUSION_BUILDING_REGISTRY[
                ids[i]
            ]
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


    for(
        i = 0;
        i < all.length;
        i++
    )
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


function getModfusionBuildingsByPool(
    poolId
)
{
    var normalizedPoolId =
        modfusionBuildingValidateResourceId(
            poolId,
            "poolId"
        )


    var all =
        getEnabledModfusionBuildings()


    var result = []

    var i


    for(
        i = 0;
        i < all.length;
        i++
    )
    {
        if(
            all[i]
                .distribution
                .poolId ===
            normalizedPoolId
        )
        {
            result.push(
                all[i]
            )
        }
    }


    return result
}


function getModfusionBuildingsBySourceMod(
    sourceMod
)
{
    var normalizedSourceMod =
        modfusionBuildingValidateNamespace(
            sourceMod,
            "sourceMod"
        )


    var all =
        getEnabledModfusionBuildings()


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
            normalizedSourceMod
        )
        {
            result.push(
                all[i]
            )
        }
    }


    return result
}


function getModfusionBuildingsByTag(
    tag
)
{
    var normalizedTag =
        modfusionBuildingReadString(
            tag,
            "tag",
            null
        )


    var all =
        getEnabledModfusionBuildings()


    var result = []

    var i
    var j


    for(
        i = 0;
        i < all.length;
        i++
    )
    {
        for(
            j = 0;
            j < all[i].tags.length;
            j++
        )
        {
            if(
                all[i].tags[j] ===
                normalizedTag
            )
            {
                result.push(
                    all[i]
                )

                break
            }
        }
    }


    return result
}


function forEachModfusionBuilding(
    callback
)
{
    if(typeof callback !== "function")
    {
        modfusionBuildingFail(
            "forEach callback must be a function"
        )
    }


    var all =
        getAllModfusionBuildings()


    var i


    for(
        i = 0;
        i < all.length;
        i++
    )
    {
        callback(
            all[i],
            all[i].id
        )
    }
}


function getModfusionBuildingCount()
{
    return MODFUSION_BUILDING_IDS.length
}


/*
 * =========================================================
 * Twilight Forest: common buildings
 * =========================================================
 */


registerModfusionBuilding(
    "twilight_naga_courtyard",
    {
        displayName:
            "Twilight Forest Naga Courtyard",

        sourceMod:
            "twilightforest",

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                "twilightforest:naga_courtyard"
        },

        distribution: {
            poolId:
                "mahou:twilight_common",

            weight:
                1,

            reservePolicy:
                "SAME_BUILDING"
        },

        terrain: {
            foundationRadius:
                22,

            minFoundationPoints:
                7,

            reliefSampleRadius:
                32,

            maxHeightDifference:
                12
        },

        spacing: {
            minDistance:
                768
        },

        tags: [
            "twilightforest",
            "common",
            "boss"
        ]
    }
)


registerModfusionBuilding(
    "twilight_lich_tower",
    {
        displayName:
            "Twilight Forest Lich Tower",

        sourceMod:
            "twilightforest",

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                "twilightforest:lich_tower"
        },

        distribution: {
            poolId:
                "mahou:twilight_common",

            weight:
                1,

            reservePolicy:
                "SAME_BUILDING"
        },

        terrain: {
            foundationRadius:
                8,

            minFoundationPoints:
                7,

            reliefSampleRadius:
                24,

            maxHeightDifference:
                12
        },

        spacing: {
            minDistance:
                768
        },

        tags: [
            "twilightforest",
            "common",
            "boss"
        ]
    }
)


/*
 * =========================================================
 * Twilight Forest: dedicated buildings
 * =========================================================
 */


registerModfusionBuilding(
    "twilight_labyrinth",
    {
        displayName:
            "Twilight Forest Labyrinth",

        sourceMod:
            "twilightforest",

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                "twilightforest:labyrinth"
        },

        distribution: {
            poolId:
                "mahou:twilight_dedicated",

            weight:
                1,

            reservePolicy:
                "SAME_BUILDING"
        },

        terrain: {
            foundationRadius:
                24,

            minFoundationPoints:
                7,

            reliefSampleRadius:
                32,

            maxHeightDifference:
                12
        },

        spacing: {
            minDistance:
                1024
        },

        tags: [
            "twilightforest",
            "dedicated",
            "boss"
        ]
    }
)


registerModfusionBuilding(
    "twilight_hydra_lair",
    {
        displayName:
            "Twilight Forest Hydra Lair",

        sourceMod:
            "twilightforest",

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                "twilightforest:hydra_lair"
        },

        distribution: {
            poolId:
                "mahou:twilight_dedicated",

            weight:
                1,

            reservePolicy:
                "SAME_BUILDING"
        },

        terrain: {
            foundationRadius:
                20,

            minFoundationPoints:
                6,

            reliefSampleRadius:
                32,

            maxHeightDifference:
                14
        },

        spacing: {
            minDistance:
                1024
        },

        tags: [
            "twilightforest",
            "dedicated",
            "boss"
        ]
    }
)


registerModfusionBuilding(
    "twilight_knight_stronghold",
    {
        displayName:
            "Twilight Forest Knight Stronghold",

        sourceMod:
            "twilightforest",

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                "twilightforest:knight_stronghold"
        },

        distribution: {
            poolId:
                "mahou:twilight_dedicated",

            weight:
                1,

            reservePolicy:
                "SAME_BUILDING"
        },

        terrain: {
            foundationRadius:
                20,

            minFoundationPoints:
                6,

            reliefSampleRadius:
                32,

            maxHeightDifference:
                14
        },

        spacing: {
            minDistance:
                1024
        },

        tags: [
            "twilightforest",
            "dedicated",
            "boss"
        ]
    }
)


registerModfusionBuilding(
    "twilight_yeti_cave",
    {
        displayName:
            "Twilight Forest Yeti Cave",

        sourceMod:
            "twilightforest",

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                "twilightforest:yeti_cave"
        },

        distribution: {
            poolId:
                "mahou:twilight_dedicated",

            weight:
                1,

            reservePolicy:
                "SAME_BUILDING"
        },

        terrain: {
            foundationRadius:
                20,

            minFoundationPoints:
                6,

            reliefSampleRadius:
                32,

            maxHeightDifference:
                14
        },

        spacing: {
            minDistance:
                1024
        },

        tags: [
            "twilightforest",
            "dedicated",
            "boss"
        ]
    }
)


registerModfusionBuilding(
    "twilight_aurora_palace",
    {
        displayName:
            "Twilight Forest Aurora Palace",

        sourceMod:
            "twilightforest",

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                "twilightforest:aurora_palace"
        },

        distribution: {
            poolId:
                "mahou:twilight_dedicated",

            weight:
                1,

            reservePolicy:
                "SAME_BUILDING"
        },

        terrain: {
            foundationRadius:
                16,

            minFoundationPoints:
                5,

            reliefSampleRadius:
                40,

            maxHeightDifference:
                12
        },

        spacing: {
            minDistance:
                1536
        },

        tags: [
            "twilightforest",
            "dedicated",
            "boss"
        ]
    }
)


registerModfusionBuilding(
    "twilight_troll_cave",
    {
        displayName:
            "Twilight Forest Troll Cave",

        sourceMod:
            "twilightforest",

        placement: {
            adapterId:
                "mahou:registered_structure",

            targetId:
                "twilightforest:troll_cave"
        },

        distribution: {
            poolId:
                "mahou:twilight_dedicated",

            weight:
                1,

            reservePolicy:
                "SAME_BUILDING"
        },

        terrain: {
            foundationRadius:
                20,

            minFoundationPoints:
                6,

            reliefSampleRadius:
                32,

            maxHeightDifference:
                14
        },

        spacing: {
            minDistance:
                1024
        },

        tags: [
            "twilightforest",
            "dedicated",
            "boss"
        ]
    }
)


/*
 * =========================================================
 * Public API
 * =========================================================
 *
 * 不暴露内部 registry 对象，避免其他模块直接修改配置。
 */


global.ModfusionBuildingRegistry = {

    schemaVersion:
        MODFUSION_BUILDING_SCHEMA_VERSION,

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

    getByPool:
        getModfusionBuildingsByPool,

    getBySourceMod:
        getModfusionBuildingsBySourceMod,

    getByTag:
        getModfusionBuildingsByTag,

    forEach:
        forEachModfusionBuilding,

    size:
        getModfusionBuildingCount
}


console.log(
    "[ModFusion Buildings] Registry v2 ready. " +
    "Registered buildings: " +
    getModfusionBuildingCount()
)