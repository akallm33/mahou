console.log("[ModFusion Spawn] Script loaded")


// ============================================================
// 基础配置
// ============================================================

var MODFUSION_DIMENSION_ID =
    "mahou:modfusion_dimension"

var MODFUSION_SPAWN_TEMPLATE_ID =
    "mahou:modfusion_spawn"

var MODFUSION_SPAWN_GENERATED_KEY =
    "mahouModfusionSpawnStructureGenerated"


// ============================================================
// Structure Template 放置位置
//
// 当前假设：
// 结构模板以 (-8, 140, -8) 作为放置原点
//
// 如果模板本身是 17 x ? x 17，
// 那么模板中心大致就在世界坐标：
//
// X = 0
// Z = 0
// ============================================================

var MODFUSION_TEMPLATE_X = -8
var MODFUSION_TEMPLATE_Y = 0
var MODFUSION_TEMPLATE_Z = -8


// ============================================================
// 玩家进入 ModFusion 后的安全落点
// ============================================================

var MODFUSION_PLAYER_X = 0.5
var MODFUSION_PLAYER_Y = 2
var MODFUSION_PLAYER_Z = 0.5


// ============================================================
// 出生结构周围预加载 Chunk 半径
//
// radius = 2
//
// 会加载：
//
// X Chunk: -2 ~ 2
// Z Chunk: -2 ~ 2
//
// 总共 5 x 5 = 25 个 Chunk
//
// 大致覆盖世界坐标：
// X = -32 ~ 47
// Z = -32 ~ 47
// ============================================================

var MODFUSION_SPAWN_CHUNK_RADIUS = 2


// ============================================================
// 执行服务器权限命令
// ============================================================

function runModfusionCommand(
    server,
    command
)
{
    if(server == null)
    {
        console.log(
            "[ModFusion Spawn] ERROR: server is null"
        )

        return 0
    }


    console.log(
        "[ModFusion Spawn] Command: " +
        command
    )


    return server
        .getCommands()
        .performPrefixedCommand(
            server.createCommandSourceStack(),
            command
        )
}


// ============================================================
// 预加载出生结构周围的 Chunk
//
// 由于结构以负坐标开始放置，例如：
//
// -8, 140, -8
//
// 一个 17x17 的结构至少会同时经过：
//
// Chunk (-1,-1)
// Chunk ( 0,-1)
// Chunk (-1, 0)
// Chunk ( 0, 0)
//
// 因此不能只加载 Chunk 0,0。
// ============================================================

function loadModfusionSpawnChunks(level)
{
    if(level == null)
    {
        return false
    }


    console.log(
        "[ModFusion Spawn] Loading spawn chunks..."
    )


    var cx
    var cz


    for(
        cx = -MODFUSION_SPAWN_CHUNK_RADIUS;
        cx <= MODFUSION_SPAWN_CHUNK_RADIUS;
        cx++
    )
    {
        for(
            cz = -MODFUSION_SPAWN_CHUNK_RADIUS;
            cz <= MODFUSION_SPAWN_CHUNK_RADIUS;
            cz++
        )
        {
            console.log(
                "[ModFusion Spawn] Loading chunk: " +
                cx +
                ", " +
                cz
            )


            level.getChunk(
                cx,
                cz
            )
        }
    }


    console.log(
        "[ModFusion Spawn] Spawn chunks loaded."
    )


    return true
}


// ============================================================
// 确保 ModFusion 出生结构已经生成
//
// 返回：
//
// true
// = 结构已经存在
//   或本次成功生成
//
// false
// = 生成失败
//
// 注意：
//
// 只有 place template 真正成功以后，
// persistentData 才会被写为 true。
// ============================================================

function ensureModfusionSpawn(level)
{
    if(level == null)
    {
        console.log(
            "[ModFusion Spawn] ERROR: level is null"
        )

        return false
    }


    // --------------------------------------------------------
    // 确认当前操作的是 ModFusion 维度
    // --------------------------------------------------------

    var dimensionId =
        String(level.dimension)


    if(
        dimensionId !==
        MODFUSION_DIMENSION_ID
    )
    {
        console.log(
            "[ModFusion Spawn] ERROR: Wrong dimension: " +
            dimensionId
        )

        return false
    }


    // --------------------------------------------------------
    // 取得维度级 persistentData
    // --------------------------------------------------------

    var data =
        level.persistentData


    // --------------------------------------------------------
    // 如果以前已经成功生成过，
    // 就不再重复放置结构。
    // --------------------------------------------------------

    if(
        data.getBoolean(
            MODFUSION_SPAWN_GENERATED_KEY
        )
    )
    {
        console.log(
            "[ModFusion Spawn] Spawn structure already generated."
        )

        return true
    }


    console.log(
        "[ModFusion Spawn] First generation."
    )


    // ========================================================
    // 第一步：
    // 预加载出生结构周围所有 Chunk
    // ========================================================

    if(
        !loadModfusionSpawnChunks(
            level
        )
    )
    {
        console.log(
            "[ModFusion Spawn] ERROR: Failed to load spawn chunks."
        )

        return false
    }


    // ========================================================
    // 第二步：
    // 获取服务器实例
    // ========================================================

    var server =
        level.getServer()


    if(server == null)
    {
        console.log(
            "[ModFusion Spawn] ERROR: server is null."
        )

        return false
    }


    // ========================================================
    // 第三步：
    // 生成 Structure Template
    //
    // 最终执行：
    //
    // execute in mahou:modfusion_dimension
    // run place template
    // mahou:modfusion_spawn
    // -8 140 -8
    // ========================================================

    var command =
        "execute in " +
        MODFUSION_DIMENSION_ID +
        " run place template " +
        MODFUSION_SPAWN_TEMPLATE_ID +
        " " +
        MODFUSION_TEMPLATE_X +
        " " +
        MODFUSION_TEMPLATE_Y +
        " " +
        MODFUSION_TEMPLATE_Z


    console.log(
        "[ModFusion Spawn] Placing template..."
    )


    var result =
        runModfusionCommand(
            server,
            command
        )


    console.log(
        "[ModFusion Spawn] Place command result: " +
        result
    )


    // ========================================================
    // place template 执行失败
    //
    // 这里绝对不能写 persistentData。
    // 否则以后就不会再次尝试生成。
    // ========================================================

    if(result <= 0)
    {
        console.log(
            "[ModFusion Spawn] ERROR: place template failed."
        )

        console.log(
            "[ModFusion Spawn] Template: " +
            MODFUSION_SPAWN_TEMPLATE_ID
        )

        console.log(
            "[ModFusion Spawn] Position: " +
            MODFUSION_TEMPLATE_X +
            " " +
            MODFUSION_TEMPLATE_Y +
            " " +
            MODFUSION_TEMPLATE_Z
        )

        return false
    }


    // ========================================================
    // 第四步：
    // 只有确认结构成功生成以后，
    // 才记录永久生成状态。
    // ========================================================

    data.putBoolean(
        MODFUSION_SPAWN_GENERATED_KEY,
        true
    )


    console.log(
        "[ModFusion Spawn] Spawn structure generated successfully."
    )


    return true
}


// ============================================================
// 将玩家传送到 ModFusion 出生结构
// ============================================================

function teleportPlayerToModfusionSpawn(
    player
)
{
    if(player == null)
    {
        console.log(
            "[ModFusion Spawn] ERROR: player is null"
        )

        return false
    }


    var server =
        player.getServer()


    if(server == null)
    {
        console.log(
            "[ModFusion Spawn] ERROR: player server is null"
        )

        return false
    }


    // --------------------------------------------------------
    // 取得玩家名字
    // --------------------------------------------------------

    var playerName =
        player
            .getGameProfile()
            .getName()


    // --------------------------------------------------------
    // 使用 execute in 确保传送到正确维度
    // --------------------------------------------------------

    var command =
        "execute in " +
        MODFUSION_DIMENSION_ID +
        " run tp " +
        playerName +
        " " +
        MODFUSION_PLAYER_X +
        " " +
        MODFUSION_PLAYER_Y +
        " " +
        MODFUSION_PLAYER_Z


    console.log(
        "[ModFusion Spawn] Teleporting player: " +
        playerName
    )


    var result =
        runModfusionCommand(
            server,
            command
        )


    console.log(
        "[ModFusion Spawn] Teleport result: " +
        result
    )


    if(result <= 0)
    {
        console.log(
            "[ModFusion Spawn] ERROR: Player teleport failed."
        )

        return false
    }


    return true
}


// ============================================================
// 暴露给 modfusion_dimension.js
//
// 注意：
//
// 这版不使用 LevelEvents.loaded 自动生成。
//
// 出生结构只会在玩家真正尝试进入维度时，
// 由 modfusion_dimension.js 主动调用 ensure()。
// ============================================================

global.ModfusionSpawn = {

    ensure:
        ensureModfusionSpawn,

    teleportPlayer:
        teleportPlayerToModfusionSpawn,

    dimensionId:
        MODFUSION_DIMENSION_ID,

    templateId:
        MODFUSION_SPAWN_TEMPLATE_ID

}