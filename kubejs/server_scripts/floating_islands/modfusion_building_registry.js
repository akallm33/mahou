console.log(
    "[ModFusion Buildings] Registry script loaded"
)


var MODFUSION_BUILDING_REGISTRY = {}


/*
 * =========================================================
 * Common Twilight Forest biome pool
 * =========================================================
 *
 * 普通暮色森林建筑可以出现在这些群系中。
 *
 * 注意：
 * 这里仅表示“群系资格”，
 * 并不代表所有建筑都会在这些群系中同时生成。
 *
 * 后续由 Building Distributor 决定：
 * 某个 Structure Region 最终分配哪一种建筑。
 */

var MODFUSION_TWILIGHT_COMMON_BIOMES = [

    "mahou:modded/twilightforest/forest",

    "mahou:modded/twilightforest/dense_forest",

    "mahou:modded/twilightforest/firefly_forest",

    "mahou:modded/twilightforest/clearing",

    "mahou:modded/twilightforest/oak_savannah",

    "mahou:modded/twilightforest/mushroom_forest",

    "mahou:modded/twilightforest/dense_mushroom_forest",

    "mahou:modded/twilightforest/spooky_forest"
]


/*
 * =========================================================
 * Registry helpers
 * =========================================================
 */

function registerModfusionBuilding(
    id,
    config
)
{
    if(id == null)
    {
        console.log(
            "[ModFusion Buildings] ERROR: building id is null"
        )

        return false
    }


    if(config == null)
    {
        console.log(
            "[ModFusion Buildings] ERROR: config is null for " +
            id
        )

        return false
    }


    MODFUSION_BUILDING_REGISTRY[id] =
        config


    console.log(
        "[ModFusion Buildings] Registered: " +
        id
    )


    return true
}


function modfusionArrayContains(
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


function isModfusionBuildingAllowedInBiome(
    buildingId,
    biomeId
)
{
    var config =
        MODFUSION_BUILDING_REGISTRY[
            buildingId
        ]


    if(config == null)
    {
        return false
    }


    if(config.enabled === false)
    {
        return false
    }


    return modfusionArrayContains(
        config.allowedBiomes,
        biomeId
    )
}


function getModfusionBuildingsForBiome(
    biomeId
)
{
    var result = []

    var id


    for(
        id in MODFUSION_BUILDING_REGISTRY
    )
    {
        if(
            isModfusionBuildingAllowedInBiome(
                id,
                biomeId
            )
        )
        {
            result.push(id)
        }
    }


    return result
}


function getModfusionBuilding(
    buildingId
)
{
    var config =
        MODFUSION_BUILDING_REGISTRY[
            buildingId
        ]


    if(config == null)
    {
        return null
    }


    return config
}


/*
 * =========================================================
 * Twilight Forest COMMON structures
 * =========================================================
 */


/*
 * ---------------------------------------------------------
 * Naga Courtyard
 * ---------------------------------------------------------
 *
 * 官方庭院主体约 44 x 44。
 *
 * foundationRadius = 22
 *
 * Analyzer 会检测：
 *
 * 中心
 * 四个方向
 * 四个角
 *
 * 共 9 点。
 *
 * 至少 7 点拥有稳定岛面才通过。
 */

registerModfusionBuilding(
    "twilight_naga_courtyard",
    {
        structureId:
            "twilightforest:naga_courtyard",

        placementType:
            "structure",

        allowedBiomes:
            MODFUSION_TWILIGHT_COMMON_BIOMES,

        regionPolicy:
            "COMMON",

        unique:
            false,

        enabled:
            true,


        biomeSampleRadius:
            48,

        minBiomeCoverage:
            0.65,


        foundationRadius:
            22,

        minFoundationPoints:
            7,


        terrainSampleRadius:
            32,

        maxHeightDifference:
            12,


        minStructureSpacing:
            768
    }
)


/*
 * ---------------------------------------------------------
 * Lich Tower
 * ---------------------------------------------------------
 *
 * 主塔核心约 15 x 15。
 *
 * foundationRadius = 8
 */

registerModfusionBuilding(
    "twilight_lich_tower",
    {
        structureId:
            "twilightforest:lich_tower",

        placementType:
            "structure",

        allowedBiomes:
            MODFUSION_TWILIGHT_COMMON_BIOMES,

        regionPolicy:
            "COMMON",

        unique:
            false,

        enabled:
            true,


        biomeSampleRadius:
            48,

        minBiomeCoverage:
            0.65,


        foundationRadius:
            8,

        minFoundationPoints:
            7,


        terrainSampleRadius:
            24,

        maxHeightDifference:
            12,


        minStructureSpacing:
            768
    }
)


/*
 * =========================================================
 * Twilight Forest DEDICATED structures
 * =========================================================
 */


/*
 * ---------------------------------------------------------
 * Labyrinth
 * ---------------------------------------------------------
 */

registerModfusionBuilding(
    "twilight_labyrinth",
    {
        structureId:
            "twilightforest:labyrinth",

        placementType:
            "structure",

        allowedBiomes: [
            "mahou:modded/twilightforest/swamp"
        ],

        regionPolicy:
            "DEDICATED",

        unique:
            false,

        enabled:
            true,


        biomeSampleRadius:
            64,

        minBiomeCoverage:
            0.80,


        foundationRadius:
            24,

        minFoundationPoints:
            7,


        terrainSampleRadius:
            32,

        maxHeightDifference:
            12,


        minStructureSpacing:
            1024
    }
)


/*
 * ---------------------------------------------------------
 * Hydra Lair
 * ---------------------------------------------------------
 */

registerModfusionBuilding(
    "twilight_hydra_lair",
    {
        structureId:
            "twilightforest:hydra_lair",

        placementType:
            "structure",

        allowedBiomes: [
            "mahou:modded/twilightforest/fire_swamp"
        ],

        regionPolicy:
            "DEDICATED",

        unique:
            false,

        enabled:
            true,


        biomeSampleRadius:
            64,

        minBiomeCoverage:
            0.80,


        foundationRadius:
            20,

        minFoundationPoints:
            6,


        terrainSampleRadius:
            32,

        maxHeightDifference:
            14,


        minStructureSpacing:
            1024
    }
)


/*
 * ---------------------------------------------------------
 * Knight Stronghold
 * ---------------------------------------------------------
 */

registerModfusionBuilding(
    "twilight_knight_stronghold",
    {
        structureId:
            "twilightforest:knight_stronghold",

        placementType:
            "structure",

        allowedBiomes: [
            "mahou:modded/twilightforest/dark_forest"
        ],

        regionPolicy:
            "DEDICATED",

        unique:
            false,

        enabled:
            true,


        biomeSampleRadius:
            64,

        minBiomeCoverage:
            0.80,


        foundationRadius:
            20,

        minFoundationPoints:
            6,


        terrainSampleRadius:
            32,

        maxHeightDifference:
            14,


        minStructureSpacing:
            1024
    }
)


/*
 * ---------------------------------------------------------
 * Yeti Cave
 * ---------------------------------------------------------
 */

registerModfusionBuilding(
    "twilight_yeti_cave",
    {
        structureId:
            "twilightforest:yeti_cave",

        placementType:
            "structure",

        allowedBiomes: [
            "mahou:modded/twilightforest/snowy_forest"
        ],

        regionPolicy:
            "DEDICATED",

        unique:
            false,

        enabled:
            true,


        biomeSampleRadius:
            64,

        minBiomeCoverage:
            0.80,


        foundationRadius:
            20,

        minFoundationPoints:
            6,


        terrainSampleRadius:
            32,

        maxHeightDifference:
            14,


        minStructureSpacing:
            1024
    }
)


/*
 * ---------------------------------------------------------
 * Aurora Palace
 * ---------------------------------------------------------
 *
 * biomeSampleRadius 很大：
 * 用于判断这里是不是足够大的 Glacier Boss Region。
 *
 * foundationRadius 则小很多：
 * 只判断冰塔真正需要站立的核心区域。
 *
 * 两者必须分开。
 */

registerModfusionBuilding(
    "twilight_aurora_palace",
    {
        structureId:
            "twilightforest:aurora_palace",

        placementType:
            "structure",

        allowedBiomes: [
            "mahou:modded/twilightforest/glacier"
        ],

        regionPolicy:
            "DEDICATED",

        unique:
            false,

        enabled:
            true,


        biomeSampleRadius:
            96,

        minBiomeCoverage:
            0.85,


        foundationRadius:
            16,

        minFoundationPoints:
            5,


        terrainSampleRadius:
            40,

        maxHeightDifference:
            12,


        minStructureSpacing:
            1536
    }
)


/*
 * ---------------------------------------------------------
 * Troll Cave
 * ---------------------------------------------------------
 */

registerModfusionBuilding(
    "twilight_troll_cave",
    {
        structureId:
            "twilightforest:troll_cave",

        placementType:
            "structure",

        allowedBiomes: [
            "mahou:modded/twilightforest/highlands"
        ],

        regionPolicy:
            "DEDICATED",

        unique:
            false,

        enabled:
            true,


        biomeSampleRadius:
            64,

        minBiomeCoverage:
            0.80,


        foundationRadius:
            20,

        minFoundationPoints:
            6,


        terrainSampleRadius:
            32,

        maxHeightDifference:
            14,


        minStructureSpacing:
            1024
    }
)


/*
 * =========================================================
 * Future special-region structures
 * =========================================================
 *
 * 暂时不注册：
 *
 * Dark Tower
 * Final Castle
 *
 * 因为其对应的：
 *
 * dark_forest_center
 * final_plateau
 *
 * 以后由 Boss Region 系统专门生成。
 */


/*
 * =========================================================
 * Public API
 * =========================================================
 */

global.ModfusionBuildingRegistry = {

    get:
        getModfusionBuilding,

    getForBiome:
        getModfusionBuildingsForBiome,

    isAllowedInBiome:
        isModfusionBuildingAllowedInBiome,

    register:
        registerModfusionBuilding,

    all:
        MODFUSION_BUILDING_REGISTRY
}


console.log(
    "[ModFusion Buildings] Registry ready."
)