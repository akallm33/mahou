const VOID_DIMENSION_ID = 'mahou:modfusion_dimension';
const FALLBACK_Y = -100;
const OVERWORLD_SPAWN_Y = 320;

// 掉落虚空传回主世界
PlayerEvents.tick(event => {
    const { player, level } = event;
    if (level.isClientSide()) return;

    // 获取当前维度 ID（直接比较字符串）
    const dimensionId = String(level.dimension);
    if (dimensionId !== VOID_DIMENSION_ID) return;

    if (player.getY() < FALLBACK_Y) {
        // 获取主世界出生点
        const overworld = player.getServer().overworld();
        if (!overworld) {
            return;
        }

        const spawnPos = overworld.getSharedSpawnPos();

        // 使用原版命令执行传送（稳定可靠）
        const command = `execute in minecraft:overworld run tp @s ${spawnPos.getX()} ${OVERWORLD_SPAWN_Y} ${spawnPos.getZ()}`;
        player.getServer().getCommands().performPrefixedCommand(
            player.createCommandSourceStack(),
            command
        );

        player.playSound('minecraft:entity.enderman.teleport', 1.0, 1.0);
    }
});

// 进入虚空维度
BlockEvents.rightClicked(event => {
    const { player, hand, block, level } = event;
    if (level.isClientSide()) return;

    // 1. 检查是否潜行（Shift）
    if (!player.crouching) return;

    // 2. 检查主手拿的是不是钻石
    const mainHandItem = player.getItemInHand(hand);
    if (!mainHandItem.is('minecraft:diamond')) return;

    // 3. 检查右键点击的方块是不是远古残骸
    if (block.getId() !== 'minecraft:ancient_debris') return;

    // 4. 检查玩家是否已经在虚空维度
    const currentDim = String(level.dimension);
    if (currentDim === VOID_DIMENSION_ID) {
        return;
    }

    // 5. 执行传送
    var dimension =
    player
        .getServer()
        .getLevel(
            VOID_DIMENSION_ID
        )

if(!dimension)
{
    player.tell(
        Component.of(
            "§c融合维度加载失败。"
        )
    )

    return
}


// ============================================================
// 先生成出生结构
// ============================================================

if(!global.ModfusionSpawn)
{
    player.tell(
        Component.of(
            "§c出生结构系统没有加载。"
        )
    )

    return
}


if(
    !global.ModfusionSpawn.ensure(
        dimension
    )
)
{
    player.tell(
        Component.of(
            "§c出生结构生成失败，取消传送。"
        )
    )

    return
}


// ============================================================
// 结构确定存在后，再让玩家进去
// ============================================================

if(
    !global.ModfusionSpawn.teleportPlayer(
        player
    )
)
{
    player.tell(
        Component.of(
            "§c传送失败。"
        )
    )

    return
}


player.tell(
    Component.of(
        "§b🌌 你踏入了融合维度！"
    )
)

player.playSound(
    "minecraft:entity.enderman.teleport",
    1.0,
    1.0
)

});

// ====================
// 维度加载
//
// Step 3A开始：
// 不再调用KJS岛体生成器
// ====================
LevelEvents.loaded(function(event){


    var level=
    event.level


    var dimensionId=
    String(
    level.dimension
    )


    if(
    dimensionId!==
    VOID_DIMENSION_ID
    )
    {
        return
    }


    console.log(
    "[Fusion Dimension] Loaded"
    )


    console.log(
    "[Fusion Dimension] Datapack worldgen active"
    )


})