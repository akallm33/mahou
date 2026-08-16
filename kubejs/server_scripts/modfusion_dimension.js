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
    const dimension = player.getServer().getLevel(VOID_DIMENSION_ID);
    if (!dimension) {
        return;
    }

    // 传送指令
    const command = `execute in ${VOID_DIMENSION_ID} run tp @s 0 161 0`;
    player.getServer().getCommands().performPrefixedCommand(
        player.createCommandSourceStack(),
        command
    );

    player.tell(Component.of('§b🌌 你感受到了一股魔力，踏入了虚空维度！'));
    player.playSound('minecraft:entity.enderman.teleport', 1.0, 1.0);
});

// 进入虚空维度触发
LevelEvents.loaded(function(event){
    var level = event.level
    var dim = String(level.dimension)
    console.log(
        "[Fusion Dimension] Loaded:",
        dim
    )
    if(
        dim !==
        "mahou:modfusion_dimension"
    )
    {
        return
    }
    console.log(
        "[Fusion Dimension] Start generating islands..."
    )
    if(
        global.FloatingIslandGenerator
    )
    {

        global.FloatingIslandGenerator.init(level)

    }
    else
    {
        console.log(
        "[Fusion Dimension] Generator not loaded!"
        )
    }
})